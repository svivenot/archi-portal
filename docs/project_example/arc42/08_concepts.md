# 8. Concepts Transversaux

Règles de conception globales et solutions valables pour plusieurs parties du système.

## 8.1 Modélisation Visuelle
Les diagrammes sont conçus de manière déclarative en YAML au sein de blocs de code spécifiques dans le Markdown. Cela permet de séparer la description logique (nœuds, types et liens) de leur mise en page visuelle, déléguée à l'algorithme d'auto-layout du client web.

## 8.2 Sécurité et Accès Local
Le serveur MCP fonctionne localement sur la machine de l'utilisateur, ce qui évite d'exposer les fichiers de documentation internes ou le code source sur un cloud public tiers non sécurisé.
