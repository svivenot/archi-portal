import os
import sys
from pathlib import Path
from datetime import date

# Resolve parent directory to avoid ModuleNotFoundError when running from outside Cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server.fastmcp import FastMCP
from app.config import DOCS_DIR

mcp = FastMCP("Archi Portal")

def get_project_path(project: str) -> Path:
    # Path traversal protection
    clean_project = os.path.basename(os.path.normpath(project))
    return Path(DOCS_DIR) / clean_project

def get_file_path(project: str, relative_path: str) -> Path:
    proj_path = get_project_path(project)
    # Simple path traversal protection
    clean_rel = relative_path.replace("../", "").replace("..\\", "")
    return proj_path / clean_rel

@mcp.tool()
def list_projects() -> list[str]:
    """Liste tous les projets disponibles dans le référentiel de documentation."""
    docs_path = Path(DOCS_DIR)
    if not docs_path.exists():
        return []
    return [d.name for d in docs_path.iterdir() if d.is_dir()]

@mcp.tool()
def list_documents(project: str) -> dict:
    """Liste tous les documents arc42 et les ADRs pour un projet spécifique."""
    proj_path = get_project_path(project)
    if not proj_path.exists():
        raise ValueError(f"Le projet '{project}' n'existe pas.")

    arc42_path = proj_path / "arc42"
    adrs_path = proj_path / "adrs"

    arc42_files = [f.name for f in arc42_path.glob("*.md")] if arc42_path.exists() else []
    adr_files = [f.name for f in adrs_path.glob("*.md")] if adrs_path.exists() else []

    return {
        "project": project,
        "arc42": sorted(arc42_files),
        "adrs": sorted(adr_files)
    }

@mcp.tool()
def read_document(project: str, relative_path: str) -> str:
    """Lit le contenu d'un document spécifique (arc42 ou ADR) au format Markdown."""
    file_path = get_file_path(project, relative_path)
    if not file_path.exists() or file_path.is_dir():
        raise FileNotFoundError(f"Le document '{relative_path}' n'existe pas dans le projet '{project}'.")
    
    return file_path.read_text(encoding="utf-8")

@mcp.tool()
def write_document(project: str, relative_path: str, content: str) -> str:
    """Crée ou modifie le contenu d'un fichier de documentation spécifique."""
    file_path = get_file_path(project, relative_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return f"Le document '{relative_path}' a été écrit avec succès."

@mcp.tool()
def create_adr(
    project: str,
    id: str,
    title: str,
    title_human: str,
    status: str,
    context: str,
    decision: str,
    consequences: str
) -> str:
    """Crée un nouveau document ADR (Architecture Decision Record) formaté dans le projet."""
    formatted_title = f"adr-{id}-{title}.md"
    file_path = get_file_path(project, f"adrs/{formatted_title}")
    file_path.parent.mkdir(parents=True, exist_ok=True)

    adr_content = f"""# ADR-{id} : {title_human}

* **Statut** : {status}
* **Date** : {date.today().isoformat()}
* **Auteur** : IA (Assistant MCP Python)

## Contexte
{context}

## Décision
{decision}

## Conséquences
{consequences}
"""
    file_path.write_text(adr_content, encoding="utf-8")

    # Update index in 09_architecture_decisions.md if it exists
    adr_list_path = get_file_path(project, "arc42/09_architecture_decisions.md")
    if adr_list_path.exists():
        list_content = adr_list_path.read_text(encoding="utf-8")
        list_entry = f"* **[ADR-{id} : {title_human}](../adrs/{formatted_title})**"
        if formatted_title not in list_content:
            list_content = list_content.strip() + f"\n{list_entry}\n"
            adr_list_path.write_text(list_content, encoding="utf-8")

    return f"ADR créé avec succès : adrs/{formatted_title}"

@mcp.tool()
def update_arc42_section(project: str, section_number: int, content: str) -> str:
    """Met à jour le contenu d'une des 12 sections du modèle arc42 pour un projet donné."""
    proj_path = get_project_path(project)
    arc42_path = proj_path / "arc42"
    if not arc42_path.exists():
        raise ValueError(f"Le dossier arc42 n'existe pas pour le projet '{project}'.")

    padded_number = f"{section_number:02d}"
    matched_file = None
    for f in arc42_path.glob("*.md"):
        if f.name.startswith(padded_number):
            matched_file = f
            break

    if not matched_file:
        raise FileNotFoundError(f"Impossible de trouver la section {section_number} dans '{arc42_path}'.")

    matched_file.write_text(content, encoding="utf-8")
    return f"Section {section_number} ({matched_file.name}) mise à jour avec succès."

# Helper functions for operational architecture
def load_current_arch() -> dict:
    import json
    path = Path(DOCS_DIR) / "current_architecture.json"
    if not path.exists():
        return {"namespaces": [], "services": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Auto migration if namespaces field is missing
        if "namespaces" not in data or not isinstance(data["namespaces"], list):
            unique_ns = set(s.get("namespace", "Core") for s in data.get("services", []) if s.get("namespace"))
            data["namespaces"] = [{"name": ns, "description": f"Groupe de services {ns}."} for ns in unique_ns]
        return data
    except Exception:
        return {"namespaces": [], "services": []}

def save_current_arch(data: dict):
    import json
    path = Path(DOCS_DIR) / "current_architecture.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@mcp.tool()
def list_current_architecture() -> dict:
    """Liste tous les namespaces et les services de la cartographie de l'architecture actuelle."""
    return load_current_arch()

@mcp.tool()
def save_current_service(
    id: str,
    name: str,
    namespace: str,
    type: str = "service",
    description: str = "",
    version: str = "1.0.0",
    status: str = "active"
) -> str:
    """Ajoute ou modifie un service applicatif dans la cartographie opérationnelle de l'architecture actuelle."""
    data = load_current_arch()
    
    # Auto-create namespace if it does not exist
    ns_list = data.setdefault("namespaces", [])
    ns_names = [n["name"].lower() for n in ns_list]
    if namespace.lower() not in ns_names:
        ns_list.append({"name": namespace, "description": f"Groupe de services {namespace}."})
        
    new_svc = {
        "id": id,
        "name": name,
        "namespace": namespace,
        "type": type,
        "description": description,
        "version": version,
        "status": status
    }
    
    services = data.setdefault("services", [])
    existing_idx = next((i for i, s in enumerate(services) if s["id"] == id), None)
    if existing_idx is not None:
        services[existing_idx] = new_svc
    else:
        services.append(new_svc)
        
    save_current_arch(data)
    return f"Service '{name}' ({id}) enregistré avec succès dans le namespace '{namespace}'."

@mcp.tool()
def delete_current_service(id: str) -> str:
    """Supprime un service applicatif de la cartographie opérationnelle de l'architecture actuelle."""
    data = load_current_arch()
    services = data.setdefault("services", [])
    updated = [s for s in services if s["id"] != id]
    if len(updated) == len(services):
        return f"Aucun service trouvé avec l'identifiant '{id}'."
    data["services"] = updated
    save_current_arch(data)
    return f"Service '{id}' supprimé avec succès."

@mcp.tool()
def save_current_namespace(name: str, description: str = "", is_system: bool = False) -> str:
    """Crée ou met à jour la description d'un namespace (groupe de services) de l'architecture actuelle."""
    data = load_current_arch()
    namespaces = data.setdefault("namespaces", [])
    
    new_ns = {"name": name, "description": description, "isSystem": is_system}
    existing_idx = next((i for i, n in enumerate(namespaces) if n["name"].lower() == name.lower()), None)
    if existing_idx is not None:
        namespaces[existing_idx] = new_ns
    else:
        namespaces.append(new_ns)
        
    save_current_arch(data)
    return f"Namespace '{name}' enregistré avec succès (isSystem={is_system})."

@mcp.tool()
def set_namespace_system_flag(name: str, is_system: bool) -> str:
    """Active ou désactive le tag 'System' (infrastructure) d'un namespace existant."""
    data = load_current_arch()
    namespaces = data.setdefault("namespaces", [])
    
    existing = next((n for n in namespaces if n["name"].lower() == name.lower()), None)
    if not existing:
        return f"Erreur : le namespace '{name}' n'existe pas."
        
    existing["isSystem"] = is_system
    save_current_arch(data)
    status_str = "activé (System)" if is_system else "désactivé (non-System)"
    return f"Le tag 'System' pour le namespace '{existing['name']}' a été {status_str}."

@mcp.tool()
def delete_current_namespace(name: str, cascade: bool = True) -> str:
    """Supprime un namespace de l'architecture actuelle (et supprime aussi en cascade ses services associés par défaut)."""
    data = load_current_arch()
    namespaces = data.setdefault("namespaces", [])
    services = data.setdefault("services", [])
    
    updated_ns = [n for n in namespaces if n["name"].lower() != name.lower()]
    if len(updated_ns) == len(namespaces):
        return f"Aucun namespace trouvé sous le nom '{name}'."
        
    if cascade:
        updated_svc = [s for s in services if s.get("namespace", "").lower() != name.lower()]
        deleted_count = len(services) - len(updated_svc)
        data["services"] = updated_svc
        msg = f"Namespace '{name}' supprimé avec {deleted_count} services associés en cascade."
    else:
        msg = f"Namespace '{name}' supprimé."
        
    data["namespaces"] = updated_ns
    save_current_arch(data)
    return msg

@mcp.tool()
def list_documentation_versions(project: str) -> list[str]:
    """Liste toutes les versions figées de la documentation d'architecture pour un projet donné (ainsi que la version DRAFT)."""
    proj_path = get_project_path(project)
    versions_dir = proj_path / "versions"
    if not versions_dir.exists() or not versions_dir.is_dir():
        return ["DRAFT"]
    
    versions = [d.name for d in versions_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]
    return ["DRAFT"] + sorted(versions, reverse=True)

@mcp.tool()
def freeze_documentation_version(project: str) -> str:
    """Fige l'état de travail actuel (DRAFT) de la documentation d'un projet dans une nouvelle version yyyy.MM.dd.inc."""
    import shutil
    from datetime import datetime
    
    proj_path = get_project_path(project)
    if not proj_path.exists():
        raise ValueError(f"Le projet '{project}' n'existe pas.")
        
    today_str = datetime.now().strftime("%Y.%m.%d")
    versions_dir = proj_path / "versions"
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
    new_ver = f"{today_str}.{next_inc:02d}"
    version_dir = versions_dir / new_ver
    
    try:
        src_arc42 = proj_path / "arc42"
        if src_arc42.exists() and src_arc42.is_dir():
            shutil.copytree(src_arc42, version_dir / "arc42")
        src_adrs = proj_path / "adrs"
        if src_adrs.exists() and src_adrs.is_dir():
            shutil.copytree(src_adrs, version_dir / "adrs")
            
        if not (version_dir / "arc42").exists():
            (version_dir / "arc42").mkdir(parents=True, exist_ok=True)
            
        return f"Version '{new_ver}' figée avec succès."
    except Exception as e:
        return f"Erreur de gel de version : {str(e)}"

@mcp.tool()
def read_versioned_document(project: str, version: str, relative_path: str) -> str:
    """Lit le contenu d'un document d'une version spécifique figée (ou DRAFT)."""
    proj_path = get_project_path(project)
    if version != "DRAFT":
        version_path = proj_path / "versions" / version
    else:
        version_path = proj_path
        
    clean_rel = relative_path.replace("../", "").replace("..\\", "")
    file_path = version_path / clean_rel
    
    if not file_path.exists() or file_path.is_dir():
        raise FileNotFoundError(f"Le document '{relative_path}' est introuvable sous la version '{version}'.")
        
    return file_path.read_text(encoding="utf-8")

if __name__ == "__main__":
    mcp.run()
