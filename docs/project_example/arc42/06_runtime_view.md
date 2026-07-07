# 6. Vue Logique et Dynamique (Scénarios)

Description du comportement du système lors de scénarios d'utilisation clés.

## 6.1 Scénario : Mise à jour en temps réel via un Agent IA
1. L'utilisateur demande à l'Agent IA (ex. Claude Code) : "Ajoute le composant base de données SQL dans le schéma de la vue par blocs".
2. L'Agent appelle l'outil MCP `update_arc42_section` ou modifie le fichier Markdown correspondant.
3. Le serveur MCP écrit la modification sur le disque.
4. Le File Watcher du serveur MCP détecte le changement.
5. Le serveur MCP diffuse le nouveau contenu en WebSocket au portail web Next.js.
6. L'application Next.js reçoit le nouveau Markdown, parse le bloc YAML du schéma, recalcule la disposition (Auto-Layout) et affiche le schéma mis à jour instantanément.
