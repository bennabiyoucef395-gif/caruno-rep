# CARUNO — application web

L'interface est celle de la maquette validée (`doc/maquette/caruno-maquette.html`), branchée sur le Dolibarr du magasin.

- `index.html` est **généré** : `node web/tools/patch-from-mockup.mjs doc/maquette/caruno-maquette.html web/index.html`.
  On modifie la maquette (ou `tools/patch-from-mockup.mjs`, `tools/actions.js`), puis on régénère.
- `caruno-dolibarr.js` : lecture des données Dolibarr dans la maquette et écritures (ventes, pièces, stock, clients, règlements, devis, commandes).
- Profil du magasin (enseigne, adresse, identifiants, logo) : fichier `caruno-profil.json` dans les documents du client comptoir de Dolibarr, partagé par tous les postes. Langue et nom du poste : sur le poste.
- Arabe et anglais : `i18n-ar.js`, `i18n-en.js` (texte français affiché → arabe, appliqué après chaque rendu, page en droite-à-gauche). Textes à traduire relevés par `node web/tools/collect-texts.mjs sortie.json`.
- Import de pièces (Excel, CSV, PDF) : bibliothèques `vendor/` (SheetJS 0.18.5, pdf.js 3.11.174, copiées de cdnjs).
- La marque TIBAO (catalogue fournisseur importé) n’est jamais affichée.
- Gardé sur le poste : commandes en cours, journal des ventes, session de caisse.
- Catalogue, véhicule du client (marque → modèle → moteur, ou « Je ne sais pas ») : `tools/actions-vehicle.js`. Données dans
  `web/data/parts/` (hors git), exportées de la base `caruno_parts` par le dépôt caruno-erp :
  `PARTS_JSON_DIR=<ce dossier>/web/data/parts scripts/parts/export.sh`. Sans ces données, le catalogue reste la recherche Dolibarr.
  Une pièce qui dépend du moteur n'est jamais affichée « Compatible » tant que le moteur n'est pas choisi.
- Lancer : `node web/tools/serve.mjs 8082` puis http://localhost:8082. Test navigateur : `node web/tools/e2e.mjs` (Dolibarr de développement seulement).
  Choix du véhicule, en lecture seule : `node web/tools/e2e-vehicle.mjs`.

Pas encore relié à Dolibarr (message à l'écran) : retours et avoirs, livraisons partielles, facturation des livraisons,
remise de chèques, dépôt d'espèces, comptes utilisateurs, préparation automatique des commandes fournisseurs.
