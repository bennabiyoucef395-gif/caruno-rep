// Textes affichés : le personnel du magasin ne voit jamais le nom du moteur (Dolibarr), seulement ce qui se passe.
// Appliqué par patch-from-mockup.mjs à toute l'application (maquette + actions*.js) et une fois aux dictionnaires
// i18n-ar.js / i18n-en.js, dont les clés sont le texte français. Ordre : du plus précis au plus général.
// Chaque texte doit exister : sinon la génération s'arrête (un texte changé dans la maquette ne passe pas inaperçu).
export const WORDING = [
  // badges et sous-titres
  ['</span> · <span class="badge b-ok">Dolibarr</span>', '</span>'],
  ['<span class="badge b-ok">Dolibarr</span> ', ''],
  ['Pièces réelles de la base Dolibarr, en lecture seule.', 'Toutes les pièces du catalogue, en lecture seule.'],
  // enregistrements, créations
  ['Enregistrement du rapport de caisse dans Dolibarr…', 'Enregistrement du rapport de caisse…'],
  ['Enregistrement de la vente dans Dolibarr…', 'Enregistrement de la vente…'],
  ['Enregistrement de la pièce dans Dolibarr…', 'Enregistrement de la pièce…'],
  ['Création du client dans Dolibarr…', 'Création du client…'],
  ['Validation dans Dolibarr…', 'Validation…'],
  ['Réception dans Dolibarr…', 'Réception…'],
  ['Pièce enregistrée dans Dolibarr.', 'Pièce enregistrée.'],
  ['Mot de passe modifié dans Dolibarr.', 'Mot de passe modifié.'],
  ['Magasin enregistré dans Dolibarr.', 'Magasin enregistré.'],
  ['Client enregistré dans Dolibarr.', 'Client enregistré.'],
  ['Fournisseur créé dans Dolibarr.', 'Fournisseur créé.'],
  [' photo(s) envoyée(s) dans Dolibarr.', ' photo(s) envoyée(s).'],
  [' créée en brouillon dans Dolibarr.', ' créée en brouillon.'],
  [' enregistré dans Dolibarr.', ' enregistré.'],
  [' créée dans Dolibarr.', ' créée.'],
  [' créé dans Dolibarr.', ' créé.'],
  [' dans Dolibarr : facture ', ' : facture '],
  ['il sera joint à la commande dans Dolibarr.', 'il sera joint à la commande.'],
  ['La validation crée la facture dans Dolibarr, sort le stock (', 'La validation crée la facture, sort le stock ('],
  ['CARUNO relit la facture dans Dolibarr avant chaque étape', 'CARUNO relit la facture enregistrée avant chaque étape'],
  ['chaque étape relit Dolibarr avant d’écrire.', 'chaque étape relit le serveur avant d’écrire.'],
  ['Prix non renseignés dans Dolibarr.', 'Prix non renseignés.'],
  ['Pièce déjà dans Dolibarr (même référence)', 'Pièce déjà enregistrée (même référence)'],
  ['Absente de Dolibarr', 'Pas encore dans les pièces'],
  // suppressions
  ['La pièce sera effacée de Dolibarr. Cette action ne peut pas être annulée.', 'La pièce sera effacée définitivement. Cette action ne peut pas être annulée.'],
  [' « Supprimer définitivement » l’efface de Dolibarr, seulement si elle ne figure sur aucun document.', ' « Supprimer définitivement » l’efface, seulement si elle ne figure sur aucun document.'],
  [' supprimée définitivement de Dolibarr.', ' supprimée définitivement.'],
  // connexion, erreurs
  ['Session Dolibarr expirée : reconnectez-vous.', 'Session expirée : reconnectez-vous.'],
  ['Déconnecté de Dolibarr sur ce poste.', 'Déconnecté sur ce poste.'],
  ['Connecté à Dolibarr : ', 'Connecté : '],
  ['Dolibarr injoignable à ', 'Serveur du magasin injoignable à '],
  ['Erreur Dolibarr ', 'Erreur du serveur '],
  ['Dolibarr refuse la modification du magasin.', 'Modification du magasin refusée.'],
  ['Dolibarr refuse la modification : droit', 'Modification refusée : droit'],
  ['<h2>Connexion à Dolibarr</h2>', '<h2>Connexion au serveur du magasin</h2>'],
  ['Adresse de Dolibarr', 'Adresse du serveur du magasin'],
  ['Compte Dolibarr du magasin (POST /login). Le jeton reste dans cet onglet ; aucune donnée n’est modifiée.', 'Votre compte du magasin. Aucune donnée n’est modifiée.'],
  // pages du gérant (utilisateurs, profil)
  ['Comptes Dolibarr du magasin et leur rôle', 'Comptes du magasin et leur rôle'],
  ['Un seul groupe Dolibarr par utilisateur', 'Un seul rôle par utilisateur'],
  ['le groupe Gérant ne peut que lire les utilisateurs dans Dolibarr.', 'le rôle Gérant ne peut que lire les utilisateurs.'],
  ['<dt>Dolibarr</dt><dd>24.0.2</dd>', '<dt>Version du serveur</dt><dd>24.0.2</dd>'],
  ['<dl class="kv"><dt>Dolibarr</dt>', '<dl class="kv"><dt>Serveur</dt>'],
  ['Lus dans Dolibarr (fiche de la société) et le profil du magasin.', 'Lus sur le serveur (fiche de la société) et dans le profil du magasin.'],
  ['Étapes côté Dolibarr', 'Étapes enregistrées'],
];

// Applique la table à un texte ; strict = chaque entrée doit être trouvée au moins une fois.
export function applyWording(s, strict) {
  for (const [a, b] of WORDING) {
    if (!s.includes(a)) { if (strict) throw new Error('Texte introuvable (tools/wording.mjs) : ' + a); continue; }
    s = s.split(a).join(b);
  }
  return s;
}
