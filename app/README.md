# CARUNO — application front (Expo, React Native + React Native Web, Tamagui)

Application du magasin de pièces auto, branchée **directement** sur l'API REST du Dolibarr du magasin, avec le jeton de l'utilisateur connecté. Pas de serveur intermédiaire, pas de module Dolibarr. Elle reprend la maquette `doc/maquette/caruno-maquette.html`.

## Lancer

Node 22 LTS requis.

```bash
npm install
npm run catalogue        # construit public/catalogue/tibao-2025.json depuis l'export CSV (hors Git)
npm run web              # serveur de développement Expo, ouvre http://localhost:8081
```

Version web exportée (statique) :

```bash
npm run build:web                # → dist/
node scripts/serve-dist.mjs      # http://localhost:8082
```

Au premier lancement, l'app ouvre **Paramètres** : adresse du Dolibarr (bouton *Tester la connexion*), nom du poste, langue, adresse du catalogue commun, profil du magasin. Ensuite la connexion se fait avec l'identifiant et le mot de passe Dolibarr de l'utilisateur.

## Ce qui marche

| Écran | Contenu |
|---|---|
| Paramètres | Instance Dolibarr distante + test, poste, langue (français, arabe en droite-à-gauche, anglais), catalogue, profil magasin (TVA, mode de stock, entrepôt, comptes Caisse et Banque, client comptoir, fond de caisse) |
| Connexion | `POST /login` par utilisateur ; les droits Dolibarr décident des menus (vente, coûts visibles, banque, création de pièces) |
| Caisse (plein écran) | Recherche Dolibarr (référence, OEM, marque, désignation, code-barres), panier, prix rapides (public, gros, prix du client, dernier prix à ce client, dernière vente, arrondi, prix d'achat selon les droits), clavier complet, paiement espèces par défaut avec rendu, chèque, virement, à crédit, ticket |
| Vente dans Dolibarr | Facture (`ref_ext` = identifiant de vente) → validation sur l'entrepôt (sortie de stock) → règlements sur le compte Caisse. Journal local : une vente coupée est reprise sans doublon (chaque étape relit Dolibarr) |
| Session de caisse | Ouverture avec fond compté, entrées / sorties, clôture : rapport dans l'agenda Dolibarr ; écart et mouvements écrits sur le compte Caisse si l'utilisateur a le droit « banque » |
| Pièces | Liste recherchée dans Dolibarr ; création à partir du catalogue commun (suggestions), pièce liée au catalogue par `ref_ext` |
| Back-office | Menu latéral repliable, mémorisé sur le poste |

## Clavier de la caisse (PC)

Recherche → **Entrée** ajoute la pièce, curseur sur son **prix** → **Entrée** → **quantité** → **Entrée** → retour à la recherche. Un code-barres scanné reste sur la recherche. **↑ ↓** : pièce suivante dans les résultats, ou prix de la ligne précédente / suivante ; dans la quantité, +1 / −1. **Entrée** sur une recherche vide : paiement (espèces pour le total, montant sélectionné) ; **Entrée** valide ; **Entrée** sur le ticket : commande suivante. **Échap** revient à la recherche.

## Données sur l'appareil (pas de base serveur)

Dolibarr reste la seule source des données du magasin. L'appareil garde : réglages, jeton (SecureStore sur mobile ; stockage de session du navigateur sur le web, SecureStore n'existant pas sur le web), journal des ventes non terminées, session de caisse, copie du catalogue.

## Tests

```bash
npm run typecheck
npm run test:api                         # client Dolibarr contre l'instance de dev (crée une vente de test)
npm run build:web && node scripts/e2e.mjs   # parcours complet dans Edge (playwright-core, pas de navigateur téléchargé)
```

Les deux derniers lisent les mots de passe de test dans `C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env` (hors Git ; `CARUNO_TEST_USERS` pour un autre fichier, `DOLI_URL` pour une autre instance). **Ne jamais les lancer contre un magasin réel** : ils créent des factures, une pièce `CARUNO-E2E-…` et des rapports de caisse.

## Pas encore fait

Voir `doc/19-app-front-architecture.md` : profil magasin commun lu depuis Dolibarr, droit « banque » du vendeur, hébergement du catalogue commun, déconnexion de tous les appareils, mode expédition et TVA dans l'enchaînement de vente, plusieurs commandes en parallèle, remboursements, impression, tableau de bord, jeu d'icônes.
