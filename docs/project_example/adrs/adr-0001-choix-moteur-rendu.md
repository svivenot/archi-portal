# ADR-0001 : Choix du moteur de rendu et de layout de diagramme

* **Statut** : Accepté
* **Date** : 2026-06-27
* **Auteur** : Sylvain

## Contexte
Nous voulons intégrer un outil d'édition de schémas d'architecture dynamique dans le portail **Archi Portal**. Mermaid.js est l'outil standard dans les dépôts Git, mais il offre peu de flexibilité sur la personnalisation visuelle des composants (icônes d'infrastructure, thèmes sophistiqués, interactivité complète) et le contrôle précis du positionnement automatique. Nous avons besoin d'un moteur permettant d'afficher des composants d'architecture stylisés et organisés automatiquement.

## Décision
Nous choisissons d'utiliser la combinaison suivante pour notre moteur de diagramme :
1. **React Flow** pour le rendu interactif des composants d'architecture personnalisés (browser, gateway, database, microservice, etc.).
2. **Dagre** (ou **ELK.js**) pour le calcul automatique et optimisé de la disposition (auto-layout) des nœuds et des flèches en fonction de leurs relations.
3. Un parseur déclaratif basé sur des blocs de code **YAML** insérés dans nos fichiers Markdown.

## Conséquences
* **Positives** :
  - Rendu visuel hautement personnalisable (thème sombre premium, composants d'architecture reconnaissables avec icônes).
  - Positionnement automatique et instantané des éléments lors des mises à jour en temps réel via l'IA.
  - Les schémas restent stockés sous forme textuelle (YAML) dans le Markdown, ce qui est parfait pour Git et les outils d'IA.
* **Négatives / Compromis** :
  - Nécessite d'écrire notre propre parseur YAML et nos propres styles de nœuds dans le frontend React.
  - Plus lourd à mettre en place initialement qu'un simple import de Mermaid.js.
