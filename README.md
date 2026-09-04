\# Statut Pont Port Saint Nazaire



Carte Lovelace personnalisée pour Home Assistant permettant de suivre l'état en direct des ponts mobiles du port de Saint-Nazaire.



\## Installation via HACS

1\. Dans HACS, allez dans \*\*Dépôts personnalisés\*\*.

2\. Ajoutez ce dépôt avec la catégorie \*\*Lovelace\*\*.

3\. Cliquez sur \*\*Télécharger\*\*.



\## Utilisation



```yaml

type: custom:statut-pont-port-saint-nazaire-card

title: Ponts du Port

entities:

&#x20; - sensor.pont\_du\_pertuis

&#x20; - sensor.pont\_joubert

