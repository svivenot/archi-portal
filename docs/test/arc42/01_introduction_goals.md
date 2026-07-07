# 1. Introduction et buts de l'architecture (test)

## 1.1 Description des Tâches
Nouveau projet d'architecture test. Rédigez l'introduction et décrivez les exigences de ce système ici.

## 1.2 Buts de Qualité
*Buts de qualité du projet.*

## 1.3 Parties Prenantes
*Liste des parties prenantes.*


```yaml
# architecture_description
nodes:
  - id: client
    label: Navigateur Client
    type: browser
  - id: gateway
    label: API Gateway
    type: gateway
  - id: service
    label: Service Core
    type: service
  - id: db
    label: Base de Données
    type: database
  - id: toto
    label: toto
    type: aws
  - id: db2
    label: db2
    type: database
  - id: dynamo
    label: dynamo
    type: aws-dynamodb
edges:
  - source: client
    target: gateway
    label: Requêtes HTTPS
  - source: gateway
    target: service
    label: Proxying gRPC
  - source: service
    target: db
    label: SQL Read/Write
```
