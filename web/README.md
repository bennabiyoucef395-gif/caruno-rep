# CARUNO — application web

L'interface est celle de la maquette validée (`doc/maquette/caruno-maquette.html`), branchée sur le Dolibarr du magasin.

- `index.html` est **généré** : `node web/tools/patch-from-mockup.mjs doc/maquette/caruno-maquette.html web/index.html`.
  On modifie la maquette (ou `tools/patch-from-mockup.mjs`, `tools/actions.js`), puis on régénère.
- `caruno-dolibarr.js` : lecture des données Dolibarr dans la maquette et écritures (ventes, pièces, stock, clients, règlements, devis, commandes).
- Gardé sur le poste : commandes en cours, journal des ventes, session de caisse.
- Lancer : `node web/tools/serve.mjs 8082` puis http://localhost:8082. Test navigateur : `node web/tools/e2e.mjs` (Dolibarr de développement seulement).

Pas encore relié à Dolibarr (message à l'écran) : retours et avoirs, livraisons partielles, facturation des livraisons,
remise de chèques, dépôt d'espèces, comptes utilisateurs, préparation automatique des commandes fournisseurs.
