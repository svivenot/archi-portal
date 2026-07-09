# 🏛️ Archi Portal

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Orchestrator-Docker%20Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2015-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-8B5CF6?style=for-the-badge)](https://modelcontextprotocol.io/)

**Archi Portal** is a collaborative software architecture documentation repository designed for developers and architects. It structures, visualizes, and synchronizes technical documentation based on the **arc42** template, **ADRs (Architecture Decision Records)**, and **iSAQB** design principles.

The portal supports **real-time rendering (Live Preview)**, SSO user access management via **Azure Entra ID**, and AI-assisted editing using the **MCP (Model Context Protocol)** open standard.

---

## 🌟 Key Features

* **📖 Modular Documentation (arc42)**: Structured drafting across 12 standard sections (Quality Goals, Context, Logical View, etc.) in Markdown format.
* **⚡ Architecture Decision Records (ADRs)**: Chronological management and automatic indexing of design decisions and technology choices.
* **🗺️ Interactive Operational Mapping**: Real-time visualization of service topologies and interaction flows (powered by **React Flow** and the **Dagre** auto-layout engine).
* **🔄 Real-time Synchronization**: Hot-reloading of documents and diagrams via local **WebSockets** (`watchdog`).
* **📥 Multi-Format Document Export**:
  * **Markdown**: Consolidated export of all project sections into a single markdown file.
  * **Professional PDF**: Direct A4 portrait PDF generation (mathematically calibrated to 794px at 96 DPI, with 15mm page margins) ensuring zero table or diagram clipping/overlap.
  * **PNG Images**: High-definition snapshot captures of your active operational architecture diagram.
  * **Draw.io XML**: Diagram exports ready to be opened and edited directly in Draw.io.
* **🔒 SSO Authentication**: Native integration with **Azure Entra ID (OIDC)** and a mock local developer profile for sandbox testing.
* **🤖 AI Integration (MCP Server)**: Enables intelligent agents (like Claude Code, Cursor, etc.) to browse, analyze, read, and write documentation or topology services autonomously.

---

## 📂 Project Structure

* **[`/docs/`](./docs)**: Persistent storage for architecture projects (markdown files) and the operational topology mapping (json).
* **[`/backend/`](./backend)**: API HTTP & WebSocket server (**FastAPI with Python 3.11**). Hosts the MCP server, file watcher daemon, and SSO callback authentication.
* **[`/portal-web/`](./portal-web)**: Modern user portal (**Next.js 15 in TypeScript**) optimized for viewing, interactive modelling, and exporting.

---

## 🚀 Running with Docker Compose (Recommended)

Docker Compose allows you to launch the entire stack (Frontend, Backend, and PostgreSQL database) in an isolated, pre-configured sandbox.

### 1. Build and launch the stack
Run the following command in the project root directory:

```bash
docker compose up --build
```

### 2. Available Services
* **Web Portal (Next.js)**: [http://localhost:3000](http://localhost:3000)
* **Backend API (FastAPI)**: [http://localhost:8000](http://localhost:8000)
* **Database (PostgreSQL)**: Port `5432`

### 3. Data Persistence
* The markdown documents and JSON topology mapping are mounted directly from your host machine via the `./docs:/docs` volume. **Any updates made from the web portal are saved directly to your local workspace files**.
* The PostgreSQL database persists its tables and records locally via the named Docker volume `pgdata`.

---

## 🛠️ Running Locally for Development (Without Docker)

If you prefer to run services manually for local development:

### 1. Start the Python FastAPI Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Next.js Frontend
In a separate terminal window:
```bash
cd portal-web
npm install
npm run dev
```

*(Note: A helper npm script in the root directory allows you to start both the backend and frontend simultaneously by running `npm run dev` in the root folder).*

---

## 🤖 Model Context Protocol (MCP)

The built-in **MCP** server empowers AI agents to read and write documentation, write ADRs, or manage system namespaces directly inside the repository.

### Client Configuration (e.g. Claude Code / Cursor / Claude Desktop)

Declare the MCP server in your client configuration file (e.g. `mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "archi-portal": {
      "command": "/path/to/your/project/backend/venv/bin/python3",
      "args": ["/path/to/your/project/backend/app/mcp_server.py"]
    }
  }
}
```

### Catalog of Exposed AI Tools:
* **`list_projects`**: Lists all available architecture projects.
* **`list_documents`**: Retrieves all arc42 chapters and ADR markdown files of a project.
* **`read_document`** / **`write_document`**: Reads and writes specific markdown documentation files.
* **`update_arc42_section`**: Modifies a specific arc42 chapter content.
* **`create_adr`**: Formats and indexes a new Architecture Decision Record in the decisions log.
* **`list_current_architecture`**: Exposes the active operational mapping (namespaces and services).
* **`save_current_service`** / **`delete_current_service`**: Adds, updates, or removes an active service node.
* **`save_current_namespace`** / **`delete_current_namespace`**: Manages logical namespace groupings in the topology mapping.
* **`freeze_documentation_version`**: Freezes the current `DRAFT` state of a project into a read-only incremental release version.

---

## 🗺️ Modeling Architecture Diagrams

To add operational flow diagrams in any of your project markdown files, insert a YAML block of type `architecture-diagram`. The portal will automatically parse it and render it as an interactive, styled, auto-positioned flow chart:

```yaml
```yaml type=architecture-diagram
nodes:
  - id: client
    type: browser
    label: "Client Browser"
  - id: gateway
    type: gateway
    label: "API Gateway"
  - id: service
    type: service
    label: "Core API"
  - id: db
    type: database
    label: "PostgreSQL Database"
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

### Supported Node Types:
* `user` (User actor)
* `browser` (Web frontend / browser)
* `gateway` (API Gateway)
* `service` (Backend service / Microservice)
* `database` (Database instances)
* `queue` (Message Broker / Queue)
* `cache` (Redis / Memcached memory store)
* `server` (Server / VM instance)
* `third-party` (External SaaS / API)
* `system` (Global external system)
