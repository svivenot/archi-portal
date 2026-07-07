import os
import json
import shutil
from pathlib import Path
from pydantic import BaseModel
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from app.config import (
    DOCS_DIR,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_REDIRECT_URI,
    AZURE_AUTHORITY,
    AZURE_SCOPES,
    SESSION_COOKIE_NAME,
    REQUIRED_ROLE_ARCHITECT
)
from app.auth import get_msal_app, get_current_user, require_architect, require_admin, generate_local_session_token
from app.file_watcher import DocWatcher

app = FastAPI(title="Archi Portal API", version="1.0.0")

# CORS setup to talk to Next.js (usually on port 3000)
app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# In-memory WebSocket clients
active_websockets: Set[WebSocket] = set()
watcher = None

# 1. Real-time broadcast coroutine (dispatched by file_watcher thread)
async def broadcast_file_change(file_path: str, event_type: str):
    if not active_websockets:
        return
        
    try:
        rel_path = os.path.relpath(file_path, DOCS_DIR)
        path_parts = Path(rel_path).parts
        if len(path_parts) < 2:
            return

        project = path_parts[0]
        doc_path = "/".join(path_parts[1:])

        content = ""
        if event_type != "unlink" and os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

        message = {
            "type": "file_change" if event_type != "unlink" else "file_deleted",
            "project": project,
            "path": doc_path,
            "content": content,
            "timestamp": int(os.path.getmtime(file_path) * 1000) if event_type != "unlink" else 0
        }

        print(f"[WebSocket] Broadcasting {event_type} on {project}/{doc_path} to {len(active_websockets)} clients")
        
        # Gather all sends to run concurrently
        payload = json.dumps(message)
        for client in active_websockets.copy():
            try:
                await client.send_text(payload)
            except Exception as e:
                print(f"[WebSocket] Error sending to client, removing: {e}")
                active_websockets.discard(client)
    except Exception as e:
        print(f"[WebSocket] Error during broadcast: {e}")

# Lifecycle events
@app.on_event("startup")
async def startup_event():
    global watcher
    watcher = DocWatcher(broadcast_file_change)
    watcher.start()

@app.on_event("shutdown")
async def shutdown_event():
    global watcher
    if watcher:
        watcher.stop()

# 2. Authentication endpoints
@app.get("/api/auth/login")
async def login():
    msal_app = get_msal_app()
    if not msal_app:
        # Mock mode (Dev local) redirect back to nextjs dashboard with a mock code
        return RedirectResponse(url=f"{AZURE_REDIRECT_URI}?code=mock-dev-code")

    # Start OIDC flow
    auth_url = msal_app.get_authorization_request_url(
        AZURE_SCOPES,
        redirect_uri=AZURE_REDIRECT_URI
    )
    return RedirectResponse(url=auth_url)

@app.get("/api/auth/callback")
async def auth_callback(code: str, response: Response):
    # Mock authentication handling
    if code == "mock-dev-code" or not AZURE_CLIENT_ID or not AZURE_CLIENT_SECRET:
        mock_user = {
            "name": "Sylvain (Dev Mode)",
            "email": "sylvain@local.dev",
            "roles": [REQUIRED_ROLE_ARCHITECT],
            "mock": True
        }
        token = generate_local_session_token(mock_user)
        # Redirect to Next.js homepage
        redirect_url = "http://localhost:3000"
        res = RedirectResponse(url=redirect_url)
        res.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=token,
            httponly=True,
            samesite="lax",
            secure=False  # True in production (HTTPS)
        )
        return res

    # Real MSAL flow
    msal_app = get_msal_app()
    if not msal_app:
        raise HTTPException(status_code=500, detail="MSAL not configured")

    token_result = msal_app.acquire_token_by_authorization_code(
        code,
        scopes=AZURE_SCOPES,
        redirect_uri=AZURE_REDIRECT_URI
    )

    if "error" in token_result:
        raise HTTPException(status_code=400, detail=f"Authentication error: {token_result.get('error_description')}")

    # Extract user profile from ID token claims
    claims = token_result.get("id_token_claims", {})
    user_info = {
        "name": claims.get("name", "Utilisateur Microsoft"),
        "email": claims.get("preferred_username", claims.get("email", "")),
        "roles": claims.get("roles", []),
        "groups": claims.get("groups", []),
        "mock": False
    }

    # Generate local session JWT cookie
    session_token = generate_local_session_token(user_info)
    
    res = RedirectResponse(url="http://localhost:3000")
    res.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=True  # Ensure HTTPS in production
    )
    return res

@app.get("/api/auth/logout")
async def logout(response: Response):
    res = RedirectResponse(url="http://localhost:3000")
    res.delete_cookie(SESSION_COOKIE_NAME)
    return res

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

# 3. Document APIs
@app.get("/api/docs")
async def get_docs(
    project: str = Query(None),
    file: str = Query(None),
    q: str = Query(None),
    version: str = Query("DRAFT"),
    user: dict = Depends(get_current_user) # Secure access
):
    docs_path = Path(DOCS_DIR)
    
    # Case 1: No project -> Return list of projects with metadata & search support
    if not project:
        if not docs_path.exists():
            return {"projects": []}
            
        projects_data = []
        for d in docs_path.iterdir():
            if d.is_dir() and not d.name.startswith("."):
                proj_name = d.name
                
                # Calculate last updated time and search score
                last_updated = 0
                search_score = 0
                description = "Aucune description disponible."
                adr_count = 0
                section_count = 0
                
                # Scan project files
                md_files = list(d.glob("**/*.md"))
                for f in md_files:
                    try:
                        mtime = f.stat().st_mtime
                        if mtime > last_updated:
                            last_updated = mtime
                            
                        # Count sections/adrs
                        parts = f.parts
                        if "arc42" in parts:
                            section_count += 1
                        elif "adrs" in parts and f.name != "adr-template.md":
                            adr_count += 1
                            
                        # Extract description from 01_introduction_goals.md
                        if f.name.endswith("01_introduction_goals.md"):
                            lines = f.read_text(encoding="utf-8").split("\n")
                            desc_lines = []
                            capture = False
                            for line in lines:
                                if line.strip().startswith("## 1.1 Description des Tâches") or line.strip().startswith("## 1.1 Description des taches"):
                                    capture = True
                                    continue
                                if capture:
                                    if line.startswith("## ") or line.startswith("# "):
                                        break
                                    if line.strip():
                                        desc_lines.append(line.strip())
                            if desc_lines:
                                description = " ".join(desc_lines)[:180] + "..."
                    except Exception as e:
                        print(f"Error reading metadata for {f}: {e}")
                        pass
                
                # Perform search match if q is provided
                if q:
                    q_lower = q.lower()
                    # 1. Project name match (weight 150)
                    if q_lower in proj_name.lower():
                        search_score += 150
                        
                    # 2. Document content match
                    for f in md_files:
                        try:
                            content = f.read_text(encoding="utf-8")
                            if q_lower in content.lower():
                                # Check headings vs body
                                lines = content.split("\n")
                                for line in lines:
                                    line_lower = line.lower()
                                    if q_lower in line_lower:
                                        if line.startswith("# "): # H1 heading (weight 50)
                                            search_score += 50
                                        elif line.startswith("## ") or line.startswith("### "): # H2/H3 (weight 20)
                                            search_score += 20
                                        else: # Body occurrences
                                            search_score += line_lower.count(q_lower) * 2
                        except Exception:
                            pass
                            
                # If searching and no match, skip project
                if q and search_score == 0:
                    continue
                    
                projects_data.append({
                    "name": proj_name,
                    "last_updated": int(last_updated * 1000) if last_updated else 0, # Convert to ms
                    "description": description,
                    "adr_count": adr_count,
                    "section_count": section_count,
                    "search_score": search_score
                })
                
        return {"projects": projects_data}

    proj_path = docs_path / project
    if not proj_path.exists() or not proj_path.is_dir():
        raise HTTPException(status_code=404, detail="Projet introuvable")

    # If loading a specific frozen version, adjust root path
    if version and version != "DRAFT":
        proj_path = proj_path / "versions" / version
        if not proj_path.exists() or not proj_path.is_dir():
            raise HTTPException(status_code=404, detail="Version introuvable")

    # Case 2: Project specified + file specified -> Return file content
    if file:
        file_path = proj_path / file
        # Path traversal check
        if not str(file_path.resolve()).startswith(str(proj_path.resolve())):
            raise HTTPException(status_code=403, detail="Accès refusé")
        if not file_path.exists() or file_path.is_dir():
            raise HTTPException(status_code=404, detail="Fichier introuvable")
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}

    # Case 3: Project specified -> Return project structure (arc42 files + adrs)
    arc42_path = proj_path / "arc42"
    adrs_path = proj_path / "adrs"

    arc42_files = []
    if arc42_path.exists():
        for f in arc42_path.glob("*.md"):
            name = f.name
            display_name = name.split("_", 1)[1].replace(".md", "").replace("_", " ") if "_" in name else name.replace(".md", "")
            try:
                number = int(name.split("_")[0])
            except ValueError:
                number = 99
            arc42_files.append({
                "name": name,
                "displayName": display_name.title(),
                "number": number,
                "path": f"arc42/{name}"
            })
        arc42_files.sort(key=lambda x: x["number"])

    adr_files = []
    if adrs_path.exists():
        for f in adrs_path.glob("*.md"):
            if f.name == "adr-template.md":
                continue
            name = f.name
            # Parse adr-0001-title.md
            title = name.replace(".md", "")
            if name.startswith("adr-"):
                parts = name.split("-", 2)
                if len(parts) >= 3:
                    title = f"ADR-{parts[1]} : {parts[2].replace('-', ' ')}"
            adr_files.append({
                "name": name,
                "displayName": title,
                "path": f"adrs/{name}"
            })

    # Scan available versions for the project (always relative to the main project folder)
    versions = []
    versions_dir = docs_path / project / "versions"
    if versions_dir.exists() and versions_dir.is_dir():
        for d in versions_dir.iterdir():
            if d.is_dir() and not d.name.startswith("."):
                versions.append(d.name)
    versions.sort(reverse=True)

    return {
        "project": project,
        "arc42": arc42_files,
        "adrs": adr_files,
        "versions": ["DRAFT"] + versions
    }

class DocSavePayload(BaseModel):
    project: str
    file: str
    content: str

# Write API (Requires architect role check)
@app.post("/api/docs")
async def save_doc(
    payload: DocSavePayload,
    user: dict = Depends(require_architect)
):
    project = payload.project
    file = payload.file
    content = payload.content

    # Restrict editing of the template project to users with the Admin role (Admins group)
    if project == "project_example":
        roles = user.get("roles", [])
        groups = user.get("groups", [])
        is_admin = "Admins" in roles or "Admins" in groups
        if not is_admin and not user.get("mock"):
            raise HTTPException(
                status_code=403,
                detail="Modification refusée. Rôle 'Administrateur' (groupe Admins) requis pour modifier le modèle de projet."
            )

    proj_path = Path(DOCS_DIR) / project
    if not proj_path.exists():
        raise HTTPException(status_code=404, detail="Projet introuvable")
        
    file_path = proj_path / file
    # Path traversal check
    if not str(file_path.resolve()).startswith(str(proj_path.resolve())):
        raise HTTPException(status_code=403, detail="Accès interdit")
        
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    return {"message": "Document sauvegardé avec succès"}

def generate_next_version(project_dir: Path) -> str:
    from datetime import datetime
    today_str = datetime.now().strftime("%Y.%m.%d")
    
    versions_dir = project_dir / "versions"
    max_inc = 0
    if versions_dir.exists() and versions_dir.is_dir():
        for d in versions_dir.iterdir():
            if d.is_dir() and d.name.startswith(today_str):
                parts = d.name.split(".")
                if len(parts) == 4:
                    try:
                        inc = int(parts[3])
                        if inc > max_inc:
                            max_inc = inc
                    except ValueError:
                        pass
    next_inc = max_inc + 1
    return f"{today_str}.{next_inc:02d}"

class CreateVersionPayload(BaseModel):
    project: str

@app.post("/api/docs/version")
async def create_version(
    payload: CreateVersionPayload,
    user: dict = Depends(require_architect)
):
    project = payload.project
    docs_path = Path(DOCS_DIR)
    proj_path = docs_path / project
    if not proj_path.exists() or not proj_path.is_dir():
        raise HTTPException(status_code=404, detail="Projet introuvable")

    # Generate next version code
    new_ver = generate_next_version(proj_path)
    version_dir = proj_path / "versions" / new_ver

    try:
        # Copy arc42 folder
        src_arc42 = proj_path / "arc42"
        if src_arc42.exists() and src_arc42.is_dir():
            shutil.copytree(src_arc42, version_dir / "arc42")

        # Copy adrs folder
        src_adrs = proj_path / "adrs"
        if src_adrs.exists() and src_adrs.is_dir():
            shutil.copytree(src_adrs, version_dir / "adrs")

        # Guarantee at least empty folders structure if none existed
        if not (version_dir / "arc42").exists():
            (version_dir / "arc42").mkdir(parents=True, exist_ok=True)

        # Notify websockets
        for ws in list(active_websockets):
            try:
                await ws.send_text(json.dumps({"type": "reload", "message": "Nouvelle version créée"}))
            except Exception:
                active_websockets.discard(ws)

        return {"success": True, "version": new_ver}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de création de version : {str(e)}")

class ProjectCreatePayload(BaseModel):
    name: str

@app.post("/api/projects")
async def create_project(
    payload: ProjectCreatePayload,
    user: dict = Depends(require_architect)
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom du projet ne peut pas être vide")
        
    # Sanitize name to be a safe directory name
    sanitized_name = "".join(c for c in name if c.isalnum() or c in " _-").strip()
    sanitized_name = sanitized_name.replace(" ", "_").lower()
    
    if not sanitized_name:
        raise HTTPException(status_code=400, detail="Nom du projet invalide")
        
    proj_dir = Path(DOCS_DIR) / sanitized_name
    if proj_dir.exists():
        raise HTTPException(status_code=400, detail="Un projet avec ce nom existe déjà")
        
    try:
        arc42_dir = proj_dir / "arc42"
        adrs_dir = proj_dir / "adrs"
        
        arc42_dir.mkdir(parents=True, exist_ok=True)
        adrs_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy arc42 template files from project_example
        example_dir = Path(DOCS_DIR) / "project_example"
        
        if example_dir.exists():
            # Copy arc42 files
            for f in (example_dir / "arc42").glob("*.md"):
                shutil.copy(f, arc42_dir / f.name)
                
            # Copy adr template
            adr_template = example_dir / "adrs" / "adr-template.md"
            if adr_template.exists():
                shutil.copy(adr_template, adrs_dir / "adr-template.md")
                
            # Customize 01_introduction_goals.md
            intro_file = arc42_dir / "01_introduction_goals.md"
            if intro_file.exists():
                intro_content = (
                    f"# 1. Introduction et buts de l'architecture ({name})\n\n"
                    f"## 1.1 Description des Tâches\n"
                    f"Nouveau projet d'architecture {name}. Rédigez l'introduction et décrivez les exigences de ce système ici.\n\n"
                    f"## 1.2 Buts de Qualité\n"
                    f"*Buts de qualité du projet.*\n\n"
                    f"## 1.3 Parties Prenantes\n"
                    f"*Liste des parties prenantes.*"
                )
                intro_file.write_text(intro_content, encoding="utf-8")
                
            # Empty other concept/constraint files to make them "empty" templates
            for f in arc42_dir.glob("*.md"):
                if f.name == "01_introduction_goals.md":
                    continue
                content = f.read_text(encoding="utf-8")
                lines = content.split("\n")
                if lines:
                    title_line = lines[0]
                    f.write_text(f"{title_line}\n\n*Section à rédiger pour le projet {name}.*", encoding="utf-8")
        else:
            # Fallback if project_example is not found
            for i, section in enumerate([
                "01_introduction_goals", "02_architecture_constraints", "03_system_scope_context",
                "04_solution_strategy", "05_building_block_view", "06_runtime_view",
                "07_deployment_view", "08_concepts", "09_architecture_decisions",
                "10_quality_requirements", "11_risks", "12_glossary"
            ], 1):
                f_name = f"{section}.md"
                title = section.replace("_", " ").title()
                (arc42_dir / f_name).write_text(f"# {i}. {title}\n\n*Section à rédiger.*", encoding="utf-8")
            
            (adrs_dir / "adr-template.md").write_text(
                "# ADR-XXXX: [Titre de la décision]\n\n## Statut\nProposé\n\n## Contexte\n[Contexte]\n\n## Décision\n[Décision]\n\n## Conséquences\n[Conséquences]",
                encoding="utf-8"
            )
            
        return {"message": f"Projet '{name}' créé avec succès", "project": sanitized_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du projet: {str(e)}")

ICONS_CONFIG_FILE = Path(DOCS_DIR) / "icons.json"

DEFAULT_ICONS = {
    "user": "User",
    "browser": "Laptop",
    "client": "Laptop",
    "gateway": "Shuffle",
    "api_gateway": "Shuffle",
    "microservice": "Cpu",
    "service": "Cpu",
    "backend": "Cpu",
    "database": "Database",
    "db": "Database",
    "queue": "Shuffle",
    "broker": "Shuffle",
    "cache": "Zap",
    "server": "HardDrive",
    "folder": "FolderGit2",
    "git": "FolderGit2",
    "third-party": "Cloud",
    "external": "Cloud",
    "system": "Box",
    "aws": "/icons/aws/generic.svg",
    "azure": "/icons/azure/generic.svg",
    "kubernetes": "/icons/k8s/generic.svg",
    "k8s": "/icons/k8s/generic.svg",
    
    # AWS Library
    "aws-lambda": "/icons/aws/lambda.svg",
    "aws-step-functions": "/icons/aws/step-functions.svg",
    "aws-s3": "/icons/aws/s3.svg",
    "aws-dynamodb": "/icons/aws/dynamodb.svg",
    "aws-sqs": "/icons/aws/sqs.svg",
    "aws-rds": "/icons/aws/rds.svg",
    "aws-ecs": "/icons/aws/ecs.svg",
    "aws-eks": "/icons/aws/eks.svg",
    "aws-api-gateway": "/icons/aws/api-gateway.svg",
    
    # Azure Library
    "azure-function": "/icons/azure/function.svg",
    "azure-blob-storage": "/icons/azure/blob-storage.svg",
    "azure-cosmosdb": "/icons/azure/cosmosdb.svg",
    "azure-service-bus": "/icons/azure/service-bus.svg",
    "azure-app-service": "/icons/azure/app-service.svg",
    "azure-sql": "/icons/azure/sql.svg",
    
    # Kubernetes Library
    "k8s-pod": "/icons/k8s/pod.svg",
    "k8s-deployment": "/icons/k8s/deployment.svg",
    "k8s-service": "/icons/k8s/service.svg",
    "k8s-ingress": "/icons/k8s/ingress.svg",
    "k8s-job": "/icons/k8s/job.svg",
    "k8s-configmap": "/icons/k8s/configmap.svg",
    "k8s-secret": "/icons/k8s/secret.svg"
}

@app.get("/api/icons")
async def get_icons(user: dict = Depends(get_current_user)):
    data = dict(DEFAULT_ICONS)
    if ICONS_CONFIG_FILE.exists():
        try:
            with open(ICONS_CONFIG_FILE, "r", encoding="utf-8") as f:
                user_icons = json.load(f)
                data.update(user_icons)
        except Exception:
            pass
    return data

@app.post("/api/icons")
async def save_icons(
    payload: dict,
    user: dict = Depends(require_admin)
):
    try:
        # Normalize keys to lowercase
        sanitized = {str(k).lower().strip(): str(v).strip() for k, v in payload.items() if k}
        ICONS_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(ICONS_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(sanitized, f, indent=2, ensure_ascii=False)
        return sanitized
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture: {str(e)}")

# Path to current architecture file
CURRENT_ARCH_FILE = Path("/Users/sylvain/archi_portal/docs/current_architecture.json")

# Default services payload to initialize if not exists
DEFAULT_CURRENT_ARCH = {
    "namespaces": [
        {"name": "Core", "description": "Services et passerelles critiques de la plateforme.", "isSystem": False},
        {"name": "Security", "description": "Sécurité, authentification et contrôle d'accès.", "isSystem": False},
        {"name": "Billing", "description": "Gestion des abonnements et traitement des transactions Stripe.", "isSystem": False},
        {"name": "ingress-nginx", "description": "Contrôle d'accès externe et routage Kubernetes.", "isSystem": True}
    ],
    "services": [
        {
            "id": "api-gateway",
            "name": "API Gateway",
            "namespace": "Core",
            "type": "gateway",
            "description": "Point d'entrée unique de l'ensemble du trafic client. Assure le routage, le throttling et la validation de clé d'API.",
            "version": "1.5.2",
            "status": "active"
        },
        {
            "id": "auth-service",
            "name": "Service d'Authentification",
            "namespace": "Security",
            "type": "aws-lambda",
            "description": "Gère l'authentification des utilisateurs, la validation et le renouvellement des jetons JWT.",
            "version": "2.0.1",
            "status": "active"
        },
        {
            "id": "payment-processor",
            "name": "Processeur de Paiements",
            "namespace": "Billing",
            "type": "aws-lambda",
            "description": "Exécute les transactions financières de manière asynchrone avec Stripe.",
            "version": "1.1.0",
            "status": "active"
        },
        {
            "id": "user-database",
            "name": "Base de Données Utilisateurs",
            "namespace": "Security",
            "type": "aws-rds",
            "description": "Stocke les profils utilisateurs et leurs privilèges d'accès.",
            "version": "Postgres 15.3",
            "status": "active"
        },
        {
            "id": "portal-dashboard",
            "name": "Tableau de Bord Frontend",
            "namespace": "Core",
            "type": "browser",
            "description": "Interface web utilisateur pour la consultation des rapports et de la cartographie.",
            "version": "0.8.0",
            "status": "active"
        },
        {
            "id": "ingress-controller",
            "name": "Ingress Controller NGINX",
            "namespace": "ingress-nginx",
            "type": "k8s-ingress",
            "description": "Gère l'accès externe vers les services HTTP s'exécutant dans le cluster Kubernetes.",
            "version": "1.8.0",
            "status": "active"
        },
        {
            "id": "billing-worker",
            "name": "Billing Job",
            "namespace": "Billing",
            "type": "k8s-job",
            "description": "Tâche planifiée de facturation mensuelle s'exécutant la nuit.",
            "version": "0.2.1",
            "status": "active"
        }
    ],
    "connections": [
        {"from": "portal-dashboard", "to": "api-gateway", "label": "HTTPS"},
        {"from": "api-gateway", "to": "auth-service", "label": "gRPC"},
        {"from": "api-gateway", "to": "payment-processor", "label": "REST (Stripe)"},
        {"from": "api-gateway", "to": "ingress-controller", "label": "HTTP"},
        {"from": "auth-service", "to": "user-database", "label": "PostgreSQL"}
    ]
}

@app.get("/api/current-architecture")
async def get_current_architecture(
    version: str = Query("DRAFT"),
    user: dict = Depends(get_current_user)
):
    target_file = CURRENT_ARCH_FILE
    if version and version != "DRAFT":
        target_file = CURRENT_ARCH_FILE.parent / "current_architecture_versions" / f"{version}.json"
        if not target_file.exists():
            raise HTTPException(status_code=404, detail=f"Version {version} introuvable")

    if not CURRENT_ARCH_FILE.exists():
        try:
            CURRENT_ARCH_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(CURRENT_ARCH_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_CURRENT_ARCH, f, indent=2, ensure_ascii=False)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur d'initialisation: {str(e)}")
            
    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Backward compatibility if namespaces key is missing or is not a list
        if "namespaces" not in data or not isinstance(data["namespaces"], list):
            unique_ns = set(s.get("namespace", "Core") for s in data.get("services", []) if s.get("namespace"))
            data["namespaces"] = [{"name": ns, "description": f"Groupe de services {ns}.", "isSystem": ns.lower() == "ingress-nginx"} for ns in unique_ns]
            
            # Save it back so it persists in the new format (only if writing to DRAFT)
            if version == "DRAFT":
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

        # Backward compatibility if connections list is missing
        if "connections" not in data or not isinstance(data["connections"], list):
            data["connections"] = [
                {"from": "portal-dashboard", "to": "api-gateway", "label": "HTTPS"},
                {"from": "api-gateway", "to": "auth-service", "label": "gRPC"},
                {"from": "api-gateway", "to": "payment-processor", "label": "REST (Stripe)"},
                {"from": "api-gateway", "to": "ingress-controller", "label": "HTTP"},
                {"from": "auth-service", "to": "user-database", "label": "PostgreSQL"}
            ]
            if version == "DRAFT":
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                    
        # Scan all available versions of current architecture
        versions = []
        versions_dir = CURRENT_ARCH_FILE.parent / "current_architecture_versions"
        if versions_dir.exists() and versions_dir.is_dir():
            for f in versions_dir.glob("*.json"):
                versions.append(f.stem)
        versions.sort(reverse=True)
        
        data["versions"] = ["DRAFT"] + versions
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de lecture: {str(e)}")

@app.post("/api/current-architecture")
async def save_current_architecture(
    payload: dict,
    user: dict = Depends(get_current_user)
):
    try:
        CURRENT_ARCH_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CURRENT_ARCH_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            
        for ws in list(active_websockets):
            try:
                await ws.send_text(json.dumps({"type": "reload", "message": "Mise à jour de l'architecture actuelle"}))
            except Exception:
                active_websockets.discard(ws)
                
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'écriture: {str(e)}")

@app.post("/api/current-architecture/version")
async def freeze_current_architecture_version(
    user: dict = Depends(require_architect)
):
    if not CURRENT_ARCH_FILE.exists():
        raise HTTPException(status_code=404, detail="Aucune architecture de départ à figer")
        
    from datetime import datetime
    today_str = datetime.now().strftime("%Y.%m.%d")
    
    versions_dir = CURRENT_ARCH_FILE.parent / "current_architecture_versions"
    versions_dir.mkdir(parents=True, exist_ok=True)
    
    max_inc = 0
    for f in versions_dir.glob("*.json"):
        if f.stem.startswith(today_str):
            parts = f.stem.split(".")
            if len(parts) == 4:
                try:
                    inc = int(parts[3])
                    if inc > max_inc:
                        max_inc = inc
                except ValueError:
                    pass
    next_inc = max_inc + 1
    new_ver = f"{today_str}.{next_inc:02d}"
    
    dest_file = versions_dir / f"{new_ver}.json"
    
    try:
        shutil.copy2(CURRENT_ARCH_FILE, dest_file)
        
        # Notify WebSocket clients
        for ws in list(active_websockets):
            try:
                await ws.send_text(json.dumps({"type": "reload", "message": "Nouvelle version d'architecture figée"}))
            except Exception:
                active_websockets.discard(ws)
                
        return {"success": True, "version": new_ver}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de création de version: {str(e)}")

# 4. WebSocket endpoint for Next.js live preview reload
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    print(f"[WebSocket] Connection accepted. Total connections: {len(active_websockets)}")
    try:
        # Welcome message
        await websocket.send_text(json.dumps({"type": "welcome", "message": "Connecté au WebSocket FastAPI"}))
        # Keep client connection open
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        print(f"[WebSocket] Connection disconnected. Total connections: {len(active_websockets)}")
    except Exception as e:
        print(f"[WebSocket] Unexpected disconnection: {e}")
        active_websockets.discard(websocket)
