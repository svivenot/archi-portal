# 3. Contexte et Périmètre du Système

Le contexte définit les frontières du système : qui l'utilise et avec quels autres systèmes il communique.

## 3.1 Contexte Métier / Fonctionnel
Description des utilisateurs finaux et des flux de données métier.

```yaml type=architecture-diagram
nodes:
  - id: dev_architect
    type: user
    label: "Développeur / Architecte"
    status: active
  - id: portal_system
    type: system
    label: "Archi Portal (Notre Système)"
    status: active
  - id: mcp_agent
    type: assistant
    label: "Agent IA (Claude Code / Antigravity)"
  - id: version_control
    type: third-party
    label: "Git / GitHub"
edges:
  - from: dev_architect
    to: portal_system
    label: "Consulte & Édite en direct"
  - from: dev_architect
    to: mcp_agent
    label: "Pilote et pose des questions"
  - from: mcp_agent
    to: portal_system
    label: "Met à jour via le serveur MCP"
  - from: portal_system
    to: version_control
    label: "Sauvegarde les fichiers Markdown"
```

## 3.2 Contexte Technique
Interfaces techniques et protocoles utilisés pour connecter le système à son environnement.

* **Communication Agent -> MCP** : JSON-RPC sur stdio ou SSE.
* **Communication MCP -> Portail Web** : WebSockets (flux d'événements temps réel).
* **Stockage** : Système de fichiers local.
