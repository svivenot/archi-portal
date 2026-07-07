# 4. Stratégie de Solution

Résumé des décisions clés de conception et des principes technologiques choisis pour structurer le système.

## 4.1 Décisions Technologiques Clés
* **Next.js** pour le frontend du portail afin de supporter une navigation multi-projets performante avec routage dynamique et recherche globale.
* **Node.js (TypeScript)** pour le serveur MCP, permettant une réutilisation rapide des types et des librairies de parsing Markdown/YAML.
* **React Flow + Dagre** pour le rendu de schémas interactifs et le positionnement automatique.

## 4.2 Principes de Conception
* **Local-first** : La documentation appartient au dépôt Git du projet.
* **Indépendance des assistants IA** : L'intégration MCP assure que n'importe quel assistant compatible MCP peut mettre à jour la documentation.
