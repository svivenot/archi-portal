# 🏛️ Archi Portal

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Orchestrator-Docker%20Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2015-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8B5CF6?style=for-the-badge)](https://modelcontextprotocol.io/)

**Archi Portal** est un référentiel collaboratif de documentation d'architecture logicielle conçu pour les équipes de développement et les architectes. Il structure, visualise et synchronise la documentation technique autour des standards **arc42**, des fiches de décisions **ADR (Architecture Decision Records)**, et des démarches de conception de l'**iSAQB**.

Le portail supporte le **rendu en temps réel (Live Preview)**, la gestion d'accès SSO via **Azure Entra ID**, et l'édition assistée par IA via le protocole ouvert **MCP (Model Context Protocol)**.

---

## 🌟 Fonctionnalités Clés

* **📖 Documentation modulaire (arc42)** : Rédaction structurée en 12 chapitres (Buts de qualité, Contexte, Vues logiques, etc.) au format Markdown.
* **⚡ Architecture Decision Records (ADRs)** : Gestion chronologique et indexation automatique des choix technologiques et de design.
* **🗺️ Schéma Opérationnel Interactif** : Visualisation en temps réel de la cartographie des services et des flux (basée sur **React Flow** et le moteur d'auto-layout **Dagre**).
* **🔄 Synchronisation Temps Réel** : Rechargement à chaud de la documentation et des schémas via des **WebSockets** locaux (`watchdog`).
* **📥 Multi-Export de Documents** :
  * **Markdown** : Export consolidé de tous les chapitres d'un projet en un unique fichier.
  * **PDF Professionnel** : Exportation directe calibrée au format A4 portrait (794px à 96 DPI, marges de 15mm) sans distorsion ni troncature des tableaux et schémas.
  * **Images PNG** : Capture haute définition du schéma d'architecture actuel.
  * **Draw.io XML** : Exportation des diagrammes pour être éditables directement dans draw.io.
* **🔒 Authentification SSO** : Intégration native avec **Azure Entra ID (OIDC)** et mode développement local simulé.
* **🤖 Intégration IA (Serveur MCP)** : Permet à des agents intelligents (Claude Code, Cursor, etc.) de lire et d'éditer la documentation ou la cartographie de manière autonome.

---

## 📂 Structure du Projet

* **[`/docs/`](./docs)** : Stockage persistant au format Markdown/JSON des projets et de la cartographie.
* **[`/backend/`](./backend)** : API HTTP & WebSocket (**FastAPI en Python 3.11**). Héberge le serveur MCP, le File Watcher et la logique d'authentification.
* **[`/portal-web/`](./portal-web)** : Portail utilisateur moderne (**Next.js 15 en TypeScript**) optimisé pour la lecture, la modélisation et l'export.

---

## 🚀 Démarrage avec Docker Compose (Recommandé)

Docker Compose permet de lancer instantanément les trois composants de la solution (Frontend, Backend et la base de données PostgreSQL) dans un environnement isolé et prêt à l'emploi.

### 1. Lancement de la stack
Exécutez la commande suivante à la racine du projet :

```bash
docker compose up --build
```

### 2. Services disponibles
* **Portail Web (Next.js)** : [http://localhost:3000](http://localhost:3000)
* **API Backend (FastAPI)** : [http://localhost:8000](http://localhost:8000)
* **Base de Données (PostgreSQL)** : Port `5432`

### 3. Persistance des données
* Les documents Markdown et JSON de l'architecture sont montés sur votre machine hôte via le volume `./docs:/docs`. **Toute modification effectuée depuis le portail web est directement sauvegardée dans vos fichiers locaux**.
* La base de données PostgreSQL conserve ses données de manière persistante via le volume Docker nommé `pgdata`.

---

## 🛠️ Démarrage en Mode Développement Local (Sans Docker)

Si vous souhaitez exécuter le projet en local pour du développement classique :

### 1. Démarrer le Backend Python
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Démarrer le Frontend Next.js
Dans un autre terminal :
```bash
cd portal-web
npm install
npm run dev
```

*(Note : Un script d'aide dans le dossier racine permet de lancer le frontend et le backend simultanément en exécutant la commande `npm run dev` depuis la racine).*

---

## 🤖 Model Context Protocol (MCP)

Le serveur **MCP** intégré permet à un assistant IA d'interagir directement avec votre référentiel d'architecture pour documenter les projets à votre place ou analyser la cartographie.

### Configuration du client (ex: Claude Code / Cursor / Claude Desktop)

Déclarez le serveur MCP dans votre configuration (ex. `mcp.json` ou `claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "archi-portal": {
      "command": "/chemin/vers/votre/projet/backend/venv/bin/python3",
      "args": ["/chemin/vers/votre/projet/backend/app/mcp_server.py"]
    }
  }
}
```

### Liste des outils (Tools) exposés à l'IA :
* **`list_projects`** : Liste tous les projets d'architecture.
* **`list_documents`** : Obtient les chapitres arc42 et ADRs d'un projet.
* **`read_document`** / **`write_document`** : Lit et modifie les fichiers Markdown de documentation.
* **`update_arc42_section`** : Met à jour précisément un des 12 chapitres arc42.
* **`create_adr`** : Génère une fiche ADR formalisée et l'inscrit dans le catalogue des décisions.
* **`list_current_architecture`** : Récupère la cartographie opérationnelle (namespaces et services).
* **`save_current_service`** / **`delete_current_service`** : Ajoute, édite ou retire un service applicatif du schéma de flux.
* **`save_current_namespace`** / **`delete_current_namespace`** : Gère les groupes logiques/techniques de la cartographie.
* **`freeze_documentation_version`** : Gèle l'état de travail actuel (DRAFT) du projet dans une version incrémentale.

---

## 🗺️ Modéliser des Schémas d'Architecture

Dans n'importe quel fichier Markdown de documentation, décrivez votre architecture logicielle dans un bloc de code YAML. Le portail le transformera automatiquement en un diagramme de flux interactif, stylisé et positionné par Dagre :

```yaml
```yaml type=architecture-diagram
nodes:
  - id: client
    type: browser
    label: "Navigateur Client"
  - id: gateway
    type: gateway
    label: "API Gateway"
  - id: service
    type: service
    label: "Service Core"
  - id: db
    type: database
    label: "PostgreSQL DB"
edges:
  - from: client
    to: gateway
    label: "HTTPS/REST"
  - from: gateway
    to: service
    label: "gRPC"
  - from: service
    to: db
    label: "SQL"
```
```

### Types de Nœuds supportés :
* `user` (Acteur)
* `browser` (Interface Web)
* `gateway` (Passerelle API)
* `service` (Microservice / API)
* `database` (Base de Données)
* `queue` (File de messages / Broker)
* `cache` (Cache Redis / Memcached)
* `server` (Serveur / VM)
* `third-party` (Service externe)
* `system` (Système global)
