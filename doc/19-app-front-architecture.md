# CARUNO — application front : architecture et décisions

| | |
|---|---|
| Date | 2026-11-03 |
| Statut | Première version de l'application (`app/`), construite à partir de la maquette `doc/maquette/caruno-maquette.html` |
| Remplace | Rien ; complète [18-fonctionnalites-interface.md](18-fonctionnalites-interface.md) |
| Vérifié sur | Dolibarr 24.0.2 de développement (HANOUT VW), Expo SDK 58, React Native 0.88, Tamagui 3 |

## 1. Principes

- Le front appelle **directement** l'API REST du Dolibarr du magasin, avec le jeton de l'utilisateur connecté (`POST /login`). Pas de serveur intermédiaire, pas de module Dolibarr.
- **Dolibarr est la seule source** des données du magasin : pièces, stock, clients, factures, paiements, comptes.
- **Pas de base de données serveur côté app.** L'appareil garde seulement : réglages, jeton, journal des ventes non terminées, session de caisse, copie du catalogue commun.
- Les droits Dolibarr de l'utilisateur décident de l'affichage (vendre, voir les coûts, banque, créer des pièces), plutôt que le nom du groupe.

## 2. Catalogue commun, hors de Dolibarr

- Le catalogue (aujourd'hui TiBAO 2025, ~24 500 pièces) est une **base commune** à toutes les boutiques, qui évoluera. Il n'est pas recopié dans chaque Dolibarr.
- Dolibarr d'une boutique ne contient que **les pièces qu'elle vend** (prix, stock, emplacement, fournisseurs).
- À la création d'une pièce, l'app **suggère** les fiches du catalogue ; la pièce créée garde l'identifiant catalogue dans `ref_ext` (ex. `tibao:420218`), la marque et l'OEM dans les champs supplémentaires `brand` et `oem_ref`.
- Format actuel : un fichier JSON construit par `app/scripts/build-catalogue.mjs` depuis l'export CSV, **non versionné** (données du fournisseur), servi avec l'app. Son adresse se règle dans Paramètres.
- **À décider** : hébergement du catalogue commun (fichier versionné sur un stockage web, ou petite API centrale si les boutiques doivent remonter des corrections et des photos).
- L'instance de dev, où tout TiBAO est importé, reste un prototype ; une vraie boutique n'importe que ses pièces.

## 3. Paramètres

| Niveau | Contenu | Où c'est gardé |
|---|---|---|
| Poste | Adresse du Dolibarr (test de connexion), nom du poste, langue, adresse du catalogue | Sur l'appareil |
| Magasin | TVA oui/non, mode de sortie de stock, entrepôt de la caisse, comptes Caisse et Banque, client comptoir, fond de caisse habituel | Sur l'appareil **pour l'instant** |

**À décider** : profil du magasin commun à tous les postes. Les non-administrateurs ne lisent pas les constantes Dolibarr. Proposition : un fichier JSON rangé dans la GED Dolibarr (module Documents), écrit par le gérant depuis Paramètres, lu par tous les postes à la connexion. Demande d'activer la GED et de donner le droit de lecture aux groupes (provisioning).

## 4. Multilingue

Français (défaut), arabe (droite-à-gauche), anglais. Au premier lancement, langue de l'appareil si elle est proposée. Sur le web le sens de lecture change immédiatement (`dir` sur la page) ; sur mobile, au redémarrage de l'app (`I18nManager`). Textes dans `app/src/i18n/locales.ts`.

## 5. Vente comptoir dans Dolibarr

1. L'app donne un identifiant unique à la vente et l'écrit dans le **journal de l'appareil** avant tout appel.
2. Facture brouillon avec `ref_ext` = identifiant de vente (retrouvée par ce champ si elle existe déjà).
3. Validation avec l'entrepôt de la caisse : sortie de stock (mode facture).
4. Règlements relus avant écriture (`remaintopay`) puis enregistrés sur le compte Caisse (`POST /invoices/paymentsdistributed`) ; les espèces sont nettes du rendu.
5. La vente quitte le journal. Après une coupure, la reprise refait les mêmes étapes en relisant Dolibarr : rien n'est fait deux fois.

Vérifié en vendeur : création, validation (numéro définitif, stock −1), paiement sur le compte Caisse **sans** droit « banque ».

## 6. Session et clôture de caisse

- La clôture TakePOS de Dolibarr (`pos_cash_fence`) n'a **pas d'API REST** : non utilisable sans module ni SQL.
- Montage retenu : les paiements en espèces arrivent sur le compte « Caisse » de Dolibarr. À la clôture :
  - **rapport** (ventes, totaux par mode, fond, entrées / sorties, attendu, compté, écart) en **événement d'agenda** Dolibarr ;
  - **entrées / sorties et écart** en lignes du compte Caisse **si l'utilisateur a le droit « banque »**.
- Le vendeur de dev **n'a pas** le droit « banque » (vérifié : `POST /bankaccounts/{id}/lines` refusé). Ses clôtures laissent les écritures à un responsable.
- **À décider** : donner au vendeur le droit d'écrire sur le compte Caisse, ou garder la validation par un responsable.

## 7. Écrans du back-office

Repris de la maquette, branchés sur Dolibarr. Le menu suit les droits Dolibarr de l'utilisateur ; l'accueil dépend du rôle (responsables au tableau de bord, vendeurs à la caisse, magasiniers au stock).

| Écran | Contenu | Écritures dans Dolibarr |
|---|---|---|
| Pièces | Toutes les pièces, les plus récentes en tête, recherche, filtre de stock ; fiche (stock par entrepôt, 3 niveaux de prix, équivalences OEM, fournisseurs, mouvements) | Création, modification (prix par niveau, seuils, emplacement), correction et transfert de stock |
| Catalogue | Catalogue commun CARUNO, « Créer dans mon magasin » | Création de pièce pré-remplie |
| Stock | Pièces sous le seuil d'alerte, journal des mouvements | — (depuis la fiche pièce) |
| Clients | Liste, fiche (encours, plafond, impayés, factures), formulaire | Création, modification, niveau de prix (`setpricelevel`) |
| Ventes | Devis, commandes, livraisons, factures, avoirs ; document avec lignes et paiements | Encaissement du reste dû d'une facture |
| Achats | Commandes fournisseurs, fournisseurs | — |
| Règlements | Soldes Caisse / Banque, opérations, impayés | — |
| Tableau de bord | Chiffre du jour et du mois, ventes par vendeur, caisse du poste, alertes, ventes interrompues | — |
| Utilisateurs, Mon profil, Scanner | Comptes et groupes ; droits vus par l'app ; douchette USB | — |

## 8. Encore à faire

- Profil magasin commun (§3), droit banque du vendeur (§6), hébergement du catalogue (§2).
- Déconnexion de tous les appareils (`/login` avec `reset=1` demande le mot de passe).
- Mode « sortie à l'expédition » et TVA dans l'enchaînement de vente (aujourd'hui : mode facture, magasin sans TVA).
- Devis et commandes à créer depuis l'app, réception des commandes fournisseurs, retours et avoirs, remise de chèques, inventaire au scan, photos des pièces, impression du ticket, caméra (application mobile, build EAS).
