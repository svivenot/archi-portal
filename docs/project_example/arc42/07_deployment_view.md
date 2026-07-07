# 7. Vue de Déploiement

Infrastructure technique dans laquelle le système est installé et s'exécute.

## 7.1 Déploiement Local (Mode Développement)

```yaml type=architecture-diagram
nodes:
  - id: local_machine
    type: server
    label: "Machine Développeur (localhost)"
    status: active
  - id: next_dev_server
    type: microservice
    label: "Next.js Dev Server (Port 3000)"
  - id: mcp_node_proc
    type: microservice
    label: "Processus Node/MCP (Port 8080)"
  - id: git_repo
    type: folder
    label: "Dépôt Git Local"
edges:
  - from: next_dev_server
    to: mcp_node_proc
    label: "WebSocket (localhost:8080)"
  - from: mcp_node_proc
    to: git_repo
    label: "Accès Disque"
```
