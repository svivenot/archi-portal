# 5. Vue par Blocs (Structure du Système)

Décomposition du système en composants logiques ou physiques (Niveau 1, puis Niveau 2 si nécessaire).

## 5.1 Système Global (Niveau 1)

```yaml type=architecture-diagram
nodes:
  - id: next_app
    type: browser
    label: "Client Web (Next.js App)"
    status: active
  - id: mcp_server
    type: gateway
    label: "Serveur MCP (Node.js)"
    status: active
  - id: file_system
    type: database
    label: "Documents Markdown (FS)"
    status: active
edges:
  - from: next_app
    to: mcp_server
    label: "WebSockets (Live Preview)"
  - from: mcp_server
    to: file_system
    label: "Lecture / Écriture"
  - from: next_app
    to: file_system
    label: "Lecture (Static Props)"
```

## 5.2 Description des Composants du Niveau 1

### Serveur MCP
Responsable de l'API MCP, de l'exposition des outils pour l'IA, du File Watcher (surveillance) et de l'envoi d'événements WebSocket au client Web.

### Client Web (Next.js)
Affiche le référentiel des projets, gère la navigation arc42/ADR, parse le Markdown et dessine les schémas via le moteur de positionnement automatique.
