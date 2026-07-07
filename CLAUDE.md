# CLAUDE.md - Guide de Développement Archi Portal (Python)

Ce guide résume les commandes de build, de développement et les principes de conception pour travailler sur le dépôt **Archi Portal**.

---

## 🛠️ Commandes de Démarrage Rapide

### Commandes à la Racine (Workspace)
* **Lancer l'environnement de dev complet** (FastAPI + Web) :
  ```bash
  npm run dev
  ```
* **Installer toutes les dépendances** :
  ```bash
  npm run install:all
  ```

### Commandes pour le Portail Web (`portal-web/`)
* **Lancer le serveur de dev Next.js** (sur le port 3000) :
  ```bash
  npm run --prefix portal-web dev
  ```
* **Compiler l'application Next.js** :
  ```bash
  npm run --prefix portal-web build
  ```
* **Lancer le linter** :
  ```bash
  npm run --prefix portal-web lint
  ```

### Commandes pour le Backend Python (`backend/`)
* **Lancer le serveur FastAPI** (sur le port 8000 avec auto-reload) :
  ```bash
  cd backend && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
* **Lancer le serveur MCP en direct (Stdio)** :
  ```bash
  cd backend && ./venv/bin/python3 -m app.mcp_server
  ```
* **Installer/Mettre à jour les dépendances pip** :
  ```bash
  cd backend && ./venv/bin/pip install -r requirements.txt
  ```

---

## 📐 Directives de Conception et Style

### 1. Structure du Code
* **Backend** : FastAPI (Python 3.11) asynchrone pour l'API HTTP et les WebSockets. Configuration centralisée dans `app/config.py`.
* **Authentification** : Gérée via **Azure Entra ID (OIDC)** et la bibliothèque `msal`. Les endpoints sensibles (POST/PUT) exigent la dépendance `require_architect` (vérification de groupe AD).
* **Client Web** : Next.js App Router (React/TypeScript).
* **Styles** : Utiliser **Vanilla CSS** (`portal-web/src/app/globals.css`). Maintenir le design system sombre premium, glassmorphic et épuré.

### 2. Spécification des Schémas d'Architecture
* Les schémas sont écrits en YAML au sein des fichiers Markdown de documentation :
  ```yaml
  ```yaml type=architecture-diagram
  nodes:
    - id: unique_id
      type: browser | user | gateway | microservice | database | queue | cache | server | third-party | system
      label: "Nom du composant"
      status: active
  edges:
    - from: source_id
      to: target_id
      label: "Protocole / Flux"
  ```
  ```
