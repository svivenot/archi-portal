# 11. Risques et Dettes Techniques

Risques identifiés pour l'architecture et dettes techniques à suivre.

* **Risque de performance d'auto-layout** : Pour des très grands schémas (+100 nœuds), l'auto-layout en JS dans le navigateur peut saccader.
  - *Atténuation* : Recommander la découpe en plusieurs schémas plus petits (un par sous-composant/niveau 2).
* **Compatibilité des clients MCP** : Différents assistants IA (Claude Code, Antigravity, Cursor) ont des façons légèrement différentes de déclarer et appeler les serveurs MCP.
  - *Atténuation* : Respecter scrupuleusement la spécification standard MCP de base (JSON-RPC 2.0).
