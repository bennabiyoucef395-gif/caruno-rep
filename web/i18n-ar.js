/* Traduction arabe de l'interface CARUNO.
   Clé : texte français exact tel qu'affiché, les nombres remplacés par # ; valeur : arabe (les # reprennent les nombres dans l'ordre).
   Les textes absents restent en français. Liste à compléter avec web/tools/collect-texts.mjs. */
window.AR = {
  // ---- menu, écrans
  'Caisse': 'الصندوق', 'Pièces': 'القطع', 'Catalogue': 'الكتالوج', 'Stock': 'المخزون', 'Clients': 'الزبائن', 'Ventes': 'المبيعات', 'Achats': 'المشتريات',
  'Règlements': 'التسديدات', 'Scanner': 'الماسح', 'Tableau de bord': 'لوحة القيادة', 'Utilisateurs': 'المستخدمون', 'Mon profil': 'ملفي', 'Back-office': 'الإدارة',
  'Menu': 'القائمة', 'Ouvrir le menu': 'فتح القائمة', 'Replier le menu': 'طي القائمة', 'Déplier le menu': 'فتح القائمة', 'Navigation principale': 'التنقل الرئيسي', 'Navigation mobile': 'تنقل الهاتف',
  'Plus': 'المزيد', 'Bord': 'اللوحة', 'Accueil': 'الرئيسية', 'Page introuvable': 'الصفحة غير موجودة', 'Retour au back-office': 'العودة إلى الإدارة', 'CARUNO — Maquette magasin': 'CARUNO',
  'Se connecter': 'دخول', 'Se déconnecter': 'تسجيل الخروج', 'Identifiant': 'اسم المستخدم', 'Identifiant *': 'اسم المستخدم *', 'Mot de passe': 'كلمة المرور', 'Connexion…': 'جارٍ الدخول…',
  'Adresse du Dolibarr du magasin': 'عنوان Dolibarr الخاص بالمحل', 'Gestion du magasin de pièces': 'تسيير محل قطع الغيار',
  'Identifiant et mot de passe Dolibarr du magasin. Les menus et les prix visibles dépendent de vos droits.': 'اسم المستخدم وكلمة مرور Dolibarr الخاصة بالمحل. القوائم والأسعار المعروضة حسب صلاحياتك.',
  'Identifiant ou mot de passe refusé.': 'اسم المستخدم أو كلمة المرور مرفوضة.', 'Chargement des données du magasin depuis Dolibarr…': 'جارٍ تحميل بيانات المحل من Dolibarr…', 'Chargement impossible': 'تعذر التحميل',
  'Réessayer': 'إعادة المحاولة', 'Chargement…': 'جارٍ التحميل…', 'Déconnecté.': 'تم تسجيل الخروج.',
  'Ce n’est pas une adresse web : mettez l’adresse du Dolibarr (ex. http://localhost:8080).': 'هذا ليس عنوان ويب: أدخل عنوان Dolibarr (مثال http://localhost:8080).',

  // ---- rôles, mots courants
  'Gérant': 'المسير', 'Responsable': 'المسؤول', 'Vendeur': 'البائع', 'Magasinier': 'أمين المخزن', 'Comptable': 'المحاسب',
  'Annuler': 'إلغاء', 'Enregistrer': 'حفظ', 'Fermer': 'إغلاق', 'Modifier': 'تعديل', 'Supprimer': 'حذف', 'Retour': 'رجوع', 'Valider': 'تأكيد', 'Voir': 'عرض', 'Ouvrir': 'فتح',
  'Choisir': 'اختيار', 'Choisi': 'مختار', 'Créer': 'إنشاء', 'Ajouter': 'إضافة', 'Rechercher': 'بحث', 'Imprimer': 'طباعة', 'Exporter': 'تصدير', 'Importer': 'استيراد', 'Vous': 'أنت',
  'Précédent': 'السابق', 'Suivant': 'التالي', 'Page # / #': 'صفحة # / #', 'Total': 'المجموع', 'TOTAL': 'المجموع', 'Date': 'التاريخ', 'Mode': 'الطريقة', 'Montant': 'المبلغ', 'Motif': 'السبب',
  'Statut': 'الحالة', 'État': 'الحالة', 'Type': 'النوع', 'Note': 'ملاحظة', 'Nom': 'الاسم', 'Nom *': 'الاسم *', 'Téléphone': 'الهاتف', 'E-mail': 'البريد الإلكتروني', 'Adresse': 'العنوان',
  'Ville': 'المدينة', 'Commune': 'البلدية', 'Catégorie': 'الفئة', 'Document': 'الوثيقة', 'Objet': 'الموضوع', 'Lignes': 'الأسطر', 'Session': 'الجلسة', 'Historique': 'السجل', 'Photo': 'صورة', 'Photos': 'الصور',
  'Format': 'الصيغة', 'Sens': 'الاتجاه', 'Utilisateur': 'المستخدم', 'Rôle': 'الدور', 'Opération': 'العملية', 'Actif': 'نشط', 'Désactiver': 'تعطيل', 'Réactiver': 'تفعيل',
  '# DA': '# دج', 'DA': 'دج', 'Langue': 'اللغة',

  // ---- familles, entrepôts, catégories clients, niveaux
  'Moteur': 'المحرك', 'Filtration': 'الترشيح', 'Freinage': 'الفرامل', 'Embrayage et transmission': 'القابض وناقل الحركة', 'Suspension et direction': 'التعليق والتوجيه',
  'Électricité et électronique': 'الكهرباء والإلكترونيك', 'Refroidissement et climatisation': 'التبريد والتكييف', 'Carrosserie et accessoires': 'الهيكل والإكسسوارات',
  'Embrayage': 'القابض', 'Suspension': 'التعليق', 'Électricité': 'الكهرباء', 'Refroidissement': 'التبريد', 'Carrosserie': 'الهيكل',
  'Magasin': 'المحل', 'Réserve': 'المخزن', 'Magasin #': 'المحل #', 'Magasin # ·': 'المحل # ·', 'Entrepôt': 'المستودع', 'Entrepôts': 'المستودعات',
  'Particulier': 'فرد', 'Particuliers': 'أفراد', 'Garage': 'ورشة', 'Garages': 'ورشات', 'Revendeur': 'بائع جملة', 'Revendeurs': 'باعة جملة', 'Tous': 'الكل',
  'Public': 'العموم', 'Gros': 'الجملة', '# · Public': '# · العموم', '· Public # DA': '· العموم # دج',
  'Comptant': 'نقداً', 'comptant': 'نقداً', '# jours': '# يوماً', '# jours fin de mois': '# يوماً نهاية الشهر',

  // ---- statuts, documents
  'Brouillon': 'مسودة', 'Envoyé': 'مرسل', 'Accepté': 'مقبول', 'Refusé': 'مرفوض', 'À préparer': 'للتحضير', 'Prête': 'جاهزة', 'Livrée en partie': 'مسلمة جزئياً', 'Livrée': 'مسلمة',
  'Facturée': 'مفوترة', 'À facturer': 'للفوترة', 'Impayée': 'غير مدفوعة', 'Partielle': 'جزئية', 'Payée': 'مدفوعة', 'En retard': 'متأخرة', 'Déduit': 'مخصوم', 'Remboursé': 'مسترد',
  'À valoir': 'رصيد', 'Utilisé': 'مستعمل', 'Envoyée': 'مرسلة', 'En réception': 'قيد الاستلام', 'Reçue': 'مستلمة', 'Livré': 'مسلم', 'Fermée': 'مغلقة', 'Ouverte': 'مفتوحة',
  'Devis': 'عرض سعر', 'Commande': 'طلبية', 'Livraison': 'تسليم', 'Facture': 'فاتورة', 'Avoir': 'إشعار دائن', 'Commandes': 'الطلبيات', 'Livraisons': 'التسليمات', 'Factures': 'الفواتير', 'Avoirs': 'الإشعارات الدائنة',
  'Devis (#)': 'عروض الأسعار (#)', 'Commandes (#)': 'الطلبيات (#)', 'Livraisons (#)': 'التسليمات (#)', 'Factures (#)': 'الفواتير (#)', 'Avoirs (#)': 'الإشعارات الدائنة (#)',
  'FACTURE': 'فاتورة', 'BON DE COMMANDE': 'وصل طلبية', 'BON DE LIVRAISON': 'وصل تسليم', 'DEVIS': 'عرض سعر', 'FACTURE D’AVOIR': 'فاتورة إشعار دائن',

  // ---- pièces
  'Pièce': 'القطعة', 'Désignation': 'التسمية', 'Marque': 'العلامة', 'Référence': 'المرجع', 'Réf.': 'مرجع', 'Réf. #': 'مرجع #', 'Réf. / OEM': 'المرجع / OEM',
  'Référence OEM': 'مرجع OEM', 'Référence fabricant': 'مرجع الصانع', 'Code-barres': 'الباركود', 'Code-barres EAN': 'باركود EAN', 'Famille': 'العائلة', 'Famille *': 'العائلة *', 'Familles': 'العائلات',
  'Empl.': 'المكان', 'Emplacement': 'المكان', 'Emplacement Magasin': 'المكان في المحل', 'Emplacement Réserve': 'المكان في المخزن', 'Coût PMP': 'متوسط التكلفة', 'Coût moyen (PMP)': 'متوسط التكلفة',
  'Nouvelle pièce': 'قطعة جديدة', 'Modifier la pièce': 'تعديل القطعة', 'Créer la pièce': 'إنشاء القطعة', 'Retour à la fiche': 'العودة إلى البطاقة', 'Fiche complète': 'البطاقة الكاملة',
  'Ajouter à la vente': 'أضف إلى البيع', 'Étiquette': 'الملصق', 'Nombre d’étiquettes': 'عدد الملصقات', 'Transférer': 'تحويل', 'Corriger': 'تصحيح', 'Corriger le stock': 'تصحيح المخزون',
  'Toutes les familles': 'كل العائلات', 'Tous les stocks': 'كل المخزون', 'En stock': 'متوفر', 'Sous le seuil': 'تحت الحد', 'En rupture': 'نافد', 'Rupture': 'نافد', 'En stock · #': 'متوفر · #',
  'Stock bas · #': 'مخزون منخفض · #', 'Réserve seulement': 'في المخزن فقط', 'Rupture · équivalences': 'نافد · بدائل', 'État du stock': 'حالة المخزون',
  '# références · # sous le seuil d’alerte': '# مرجع · # تحت حد التنبيه', 'Référence, OEM, marque, EAN, désignation…': 'مرجع، OEM، علامة، باركود، تسمية…',
  'Prix de vente': 'سعر البيع', 'Prix d’achat': 'سعر الشراء', 'Prix public': 'سعر العموم', 'Prix plancher': 'أدنى سعر', 'Prix plancher # DA': 'أدنى سعر # دج', 'Prix minimum # DA': 'أدنى سعر # دج',
  'Prix': 'السعر', 'Niveau': 'المستوى', 'Niveaux de prix': 'مستويات الأسعار', 'Marges': 'الهوامش', 'Équivalences': 'البدائل', 'Équivalences (même OEM)': 'البدائل (نفس OEM)', 'même OEM': 'نفس OEM',
  'Cette pièce': 'هذه القطعة', 'Aucune autre pièce avec cet OEM.': 'لا توجد قطعة أخرى بنفس OEM.', 'Fournisseurs': 'الموردون', 'Fournisseur': 'المورد', 'Réf. fournisseur': 'مرجع المورد',
  'Référence fournisseur': 'مرجع المورد', 'Achat': 'الشراء', 'Délai': 'المدة', 'Mouvements récents': 'آخر الحركات', 'Tous les mouvements': 'كل الحركات', 'Aucune photo': 'لا توجد صورة', 'Aucun mouvement.': 'لا توجد حركة.',
  'Ajouter des photos': 'إضافة صور', 'Sur téléphone, « Ajouter » ouvre l’appareil photo. Chaque photo est réduite avant l’envoi.': 'على الهاتف، «إضافة» يفتح الكاميرا. كل صورة تصغر قبل الإرسال.',
  'Seuil d’alerte': 'حد التنبيه', 'Seuil d’alerte # · stock souhaité #': 'حد التنبيه # · المخزون المرغوب #', 'Stock souhaité': 'المخزون المرغوب', 'Stock initial': 'المخزون الأولي', 'Stock initial en Magasin': 'المخزون الأولي في المحل',
  'Stock actuel : Magasin # · Réserve #': 'المخزون الحالي: المحل # · المخزن #', 'Quantité réelle': 'الكمية الحقيقية', 'Casse': 'كسر', 'Perte': 'ضياع', 'Erreur de saisie': 'خطأ في الإدخال',
  'Identification': 'التعريف', 'Les champs * sont obligatoires': 'الحقول * إجبارية', 'Sans espaces ni points : sert aux équivalences': 'بدون فراغات أو نقاط: يستعمل للبدائل',
  'Type de pièce CARUNO': 'نوع القطعة', 'Type CARUNO :': 'النوع:', 'Vocabulaire commun, prépare le futur catalogue': 'مفردات مشتركة للكتالوج', 'Remise en dessous : gérant seulement': 'التخفيض تحته: المسير فقط',
  'Crée un mouvement « stock initial ». Sinon, passer par une réception.': 'ينشئ حركة «مخزون أولي». وإلا استعمل الاستلام.', 'Fournisseur principal': 'المورد الرئيسي',
  'Prenez la pièce sur un fond uni : face, dos, boîte, étiquette fabricant.': 'صوّر القطعة على خلفية موحدة: الوجه، الظهر، العلبة، ملصق الصانع.',
  'Pièce enregistrée dans Dolibarr.': 'تم حفظ القطعة في Dolibarr.', 'Enregistrement de la pièce dans Dolibarr…': 'جارٍ حفظ القطعة في Dolibarr…', 'Aucune pièce ne correspond.': 'لا توجد قطعة مطابقة.',

  // ---- import
  'Importer des pièces': 'استيراد القطع', 'Choisir un fichier Excel, CSV ou PDF': 'اختر ملف Excel أو CSV أو PDF', 'Fichier à importer': 'الملف المراد استيراده',
  'Excel ou CSV : une ligne par pièce, la première ligne peut porter les titres des colonnes. PDF : tarif ou catalogue avec un tableau ; les colonnes sont détectées, vous choisissez ensuite laquelle est la référence, la désignation, le prix…': 'Excel أو CSV: سطر لكل قطعة، ويمكن أن يحمل السطر الأول عناوين الأعمدة. PDF: قائمة أسعار أو كتالوج بجدول؛ تكتشف الأعمدة ثم تختار أيها المرجع والتسمية والسعر…',
  'La première ligne contient les titres des colonnes': 'السطر الأول يحتوي عناوين الأعمدة', '— ignorer —': '— تجاهل —', 'Mettre à jour': 'تحديث', 'Ignorer': 'تجاهل',
  'Pièce déjà dans Dolibarr (même référence)': 'قطعة موجودة في Dolibarr (نفس المرجع)', 'Importer # pièce(s)': 'استيراد # قطعة', 'Prix garage': 'سعر الورشة', 'Prix gros': 'سعر الجملة',
  'Import en cours…': 'جارٍ الاستيراد…', 'Import terminé': 'انتهى الاستيراد', 'Traitées': 'المعالجة', 'Créées': 'المنشأة', 'Mises à jour': 'المحدثة', 'Ignorées': 'المتجاهلة', 'Erreurs': 'الأخطاء',
  'Ne fermez pas la page pendant l’import.': 'لا تغلق الصفحة أثناء الاستيراد.', 'Pièces existantes': 'القطع الموجودة',

  // ---- catalogue
  'OEM (avec ou sans espaces), référence, désignation, modèle, marque du véhicule…': 'OEM (بفراغات أو بدونها)، مرجع، تسمية، طراز، علامة المركبة…', 'Modèles': 'الطرازات', 'Véhicules': 'المركبات',
  'Compatibilité (catalogue fournisseur)': 'التوافق', 'Marques de véhicule': 'علامات المركبات', 'OEM normalisé (recherche)': 'OEM الموحد (للبحث)', 'Tous entrepôts confondus.': 'كل المستودعات.',
  'Codes modèles tels que publiés par le fournisseur, non vérifiés (moteur, années).': 'رموز الطرازات كما نشرها المورد، غير مؤكدة (المحرك، السنوات).', 'Photos sur le web (OEM)': 'صور على الويب (OEM)',
  'Prix non renseignés dans Dolibarr.': 'الأسعار غير مسجلة في Dolibarr.', 'Recherche…': 'جارٍ البحث…', 'Recherche en cours…': 'جارٍ البحث…',

  // ---- stock
  'Alertes (#)': 'التنبيهات (#)', 'Mouvements': 'الحركات', 'Transfert': 'تحويل', 'Inventaire': 'الجرد', '# pièces sous le seuil': '# قطعة تحت الحد', 'À commander': 'للطلب',
  'Préparer les commandes fournisseurs': 'تحضير طلبيات الموردين', 'Transfert entre entrepôts': 'تحويل بين المستودعات', 'De': 'من', 'Vers': 'إلى', 'Quantité': 'الكمية', 'Qté': 'الكمية',
  'Réceptions': 'الاستلامات', 'Transferts': 'التحويلات', 'Corrections et inventaires': 'التصحيحات والجرد', 'Famille à compter': 'العائلة المراد عدها', 'Compter au scan': 'العد بالماسح',
  'Attendu (Magasin)': 'المتوقع (المحل)', 'Attendu (Réserve)': 'المتوقع (المخزن)', 'Compté': 'المعدود', 'Écart': 'الفرق', 'Appliquer les écarts': 'تطبيق الفروقات', 'Seuil': 'الحد',
  'Magasin et Réserve · # pièces': 'المحل والمخزن · # قطعة', 'Magasin et Réserve · # pièces · valeur # DA au PMP': 'المحل والمخزن · # قطعة · القيمة # دج',

  // ---- clients
  'Nouveau client': 'زبون جديد', 'Modifier le client': 'تعديل الزبون', 'Créer le client': 'إنشاء الزبون', 'Nom, ville, téléphone…': 'الاسم، المدينة، الهاتف…', 'Client': 'الزبون',
  '# clients · encours total # DA': '# زبون · مجموع الديون # دج', 'Encours': 'الديون الجارية', 'Plafond': 'السقف', 'Encours / plafond': 'الديون / السقف', 'Encours à # % du plafond': 'الديون عند # % من السقف',
  'sur un plafond de # DA': 'من سقف # دج', 'pas de crédit autorisé': 'لا بيع بالدين', 'Factures ouvertes': 'فواتير مفتوحة', 'Avoir disponible': 'رصيد متاح', 'Relevé de compte': 'كشف الحساب', 'Relancer': 'تذكير',
  'Facturé net (12 mois)': 'المفوتر الصافي (12 شهراً)', 'Dernière facture': 'آخر فاتورة', 'Devis refusés': 'عروض مرفوضة', 'Documents en cours': 'الوثائق الجارية', 'Commandes en cours': 'الطلبيات الجارية',
  'Livraisons à facturer': 'تسليمات للفوترة', 'Factures impayées': 'فواتير غير مدفوعة', 'Rien en cours.': 'لا شيء جارٍ.', 'Facturer les livraisons': 'فوترة التسليمات', 'Encaisser un règlement': 'تحصيل دفعة',
  'Vente comptoir': 'بيع في الكاونتر', 'Coordonnées': 'معلومات الاتصال', 'Identifiants légaux': 'المعرّفات القانونية', 'Conditions commerciales': 'الشروط التجارية', 'Conditions de paiement': 'شروط الدفع',
  'Remise client %': 'تخفيض الزبون %', 'Plafond d’encours (DA)': 'سقف الدين (دج)', '0 = pas de vente à crédit': '0 = لا بيع بالدين', 'Raison sociale': 'الاسم التجاري', 'Nom et prénom': 'الاسم واللقب',
  'RC': 'س.ت', 'NIF': 'ر.ج', 'NIS': 'ر.إ', 'Article d’imposition': 'المادة الجبائية', 'Encours après vente : # DA / # DA': 'الديون بعد البيع: # دج / # دج',

  // ---- ventes
  'Devis, commandes, livraisons, factures et avoirs': 'عروض الأسعار، الطلبيات، التسليمات، الفواتير والإشعارات الدائنة', 'Nouveau devis': 'عرض سعر جديد', 'Nouvelle commande': 'طلبية جديدة',
  'Référence, client…': 'المرجع، الزبون…', 'Tous les statuts': 'كل الحالات', 'Aucun document.': 'لا توجد وثيقة.', 'Reste dû': 'الباقي', 'Déjà payé': 'مدفوع', 'Paiements': 'المدفوعات', 'Encaisser': 'تحصيل',
  'Retour / avoir': 'إرجاع / إشعار دائن', 'Retour client': 'إرجاع زبون', 'Valider et envoyer': 'تأكيد وإرسال', 'Valider la commande': 'تأكيد الطلبية', 'Enregistrer en brouillon': 'حفظ كمسودة',
  'Prix au niveau du client': 'السعر حسب مستوى الزبون', 'Remise globale %': 'تخفيض إجمالي %', 'Ajouter une pièce : référence, OEM, marque…': 'أضف قطعة: مرجع، OEM، علامة…', 'Ajouter une pièce': 'أضف قطعة',
  'Aucune ligne. Cherchez une pièce ci-dessus.': 'لا توجد أسطر. ابحث عن قطعة أعلاه.', 'Note pour le client': 'ملاحظة للزبون', 'PU': 'سعر الوحدة', 'Note privée · prix modifiés à la caisse': 'ملاحظة خاصة · أسعار عدلت في الصندوق',
  'Livraison sans effet sur le stock (mode facture) : il sort à la facture.': 'التسليم لا يؤثر على المخزون (وضع الفاتورة): يخرج عند الفاتورة.', 'Livrer le reste': 'تسليم الباقي', 'Livrer': 'تسليم',
  'Marquer prête': 'جاهزة', 'Convertir en commande': 'تحويل إلى طلبية', 'Facturer': 'فوترة', 'Format A4': 'صيغة A4', 'Ticket 80 mm': 'تذكرة 80 مم', 'Imprimer ou PDF': 'طباعة أو PDF',
  'Identifiants légaux repris du profil magasin et de la fiche client (valeurs de test).': 'المعرّفات القانونية مأخوذة من ملف المحل وبطاقة الزبون.', 'Date : #/#/#': 'التاريخ: #/#/#', 'Échéance : #/#/#': 'الاستحقاق: #/#/#',
  'Signature du livreur': 'إمضاء المسلّم', 'Signature du client': 'إمضاء الزبون', 'Merci de votre visite': 'شكراً لزيارتكم', 'Documents liés': 'وثائق مرتبطة', 'Refusé ': 'مرفوض',

  // ---- achats
  'Commandes fournisseurs et réceptions': 'طلبيات الموردين والاستلامات', 'Commandes fournisseurs': 'طلبيات الموردين', 'Nouvelle commande fournisseur': 'طلبية مورد جديدة', 'Nouveau fournisseur': 'مورد جديد',
  'Créer la commande': 'إنشاء الطلبية', 'Aucune ligne.': 'لا توجد أسطر.', 'Ajouter une pièce…': 'أضف قطعة…', 'Pièces référencées': 'القطع المسجلة', 'Envoyer au fournisseur': 'إرسال إلى المورد',
  'Commandé': 'المطلوب', 'Reçu': 'المستلم', 'Contrôle': 'المراقبة', 'Conforme': 'مطابق', 'À scanner': 'للمسح', 'Bon de livraison': 'وصل التسليم', 'Valider la réception (#)': 'تأكيد الاستلام (#)',
  'Photographier le BL': 'تصوير وصل التسليم', 'Réception': 'الاستلام', 'Scanner au téléphone': 'المسح بالهاتف', 'Réceptionner': 'استلام',

  // ---- règlements
  'Paiements reçus, chèques et comptes du magasin': 'المدفوعات المستلمة، الصكوك وحسابات المحل', 'Déposer des espèces en banque': 'إيداع النقود في البنك', 'Caisse magasin': 'صندوق المحل', 'Banque': 'البنك',
  'compte courant': 'الحساب الجاري', 'Chèques à remettre': 'صكوك للإيداع', '# chèque(s)': '# صك', 'Encaissé aujourd’hui': 'المحصل اليوم', 'espèces, chèques et virements': 'نقداً وصكوك وتحويلات',
  'Paiements reçus': 'المدفوعات المستلمة', 'Chèques à remettre (#)': 'صكوك للإيداع (#)', 'Opérations bancaires': 'العمليات البنكية', 'Tous les modes': 'كل الطرق', 'Aucune opération.': 'لا توجد عملية.',
  'Aucun chèque en attente.': 'لا يوجد صك في الانتظار.', '# chèque(s) à remettre en banque': '# صك للإيداع في البنك', 'Créer le bordereau (# · # DA)': 'إنشاء الجدول (# · # دج)', 'Bordereaux de remise': 'جداول الإيداع', 'Bordereau': 'الجدول',
  'Aucun paiement.': 'لا يوجد دفع.', 'espèces dans le tiroir, fond inclus': 'النقود في الدرج، مع الرصيد',

  // ---- tableau de bord
  'Chiffre d’affaires du jour': 'رقم أعمال اليوم', '# ventes · panier moyen # DA': '# بيع · متوسط السلة # دج', 'Impayés clients': 'ديون الزبائن', '# client(s) avec des factures en retard': '# زبون لديه فواتير متأخرة',
  'sur le coût moyen pondéré (PMP)': 'على أساس متوسط التكلفة', 'Ventes du jour par vendeur': 'مبيعات اليوم حسب البائع', '· # ventes': '· # بيع', 'Point de caisse': 'حالة الصندوق', 'Encaissé': 'المحصل',
  'Espèces': 'نقداً', 'Chèques': 'صكوك', 'Virements': 'تحويلات', 'Espèces attendues en caisse :': 'النقود المتوقعة في الصندوق:', '(caisse fermée)': '(الصندوق مغلق)', 'Compter la caisse': 'عد الصندوق',
  'Compter et fermer la caisse': 'عد الصندوق وإغلاقه', 'À vérifier': 'للتحقق', 'Aucune vente interrompue.': 'لا يوجد بيع متوقف.', '# prix modifié(s) à la caisse aujourd’hui :': '# سعر عدل في الصندوق اليوم:',
  '# pièces sous le seuil d’alerte.': '# قطعة تحت حد التنبيه.', 'Voir le stock': 'عرض المخزون',

  // ---- utilisateurs, profil
  'Comptes Dolibarr du magasin et leur rôle': 'حسابات Dolibarr للمحل ودورها', 'Nouvel utilisateur': 'مستخدم جديد', 'Rôle (groupe)': 'الدور (المجموعة)', 'Désactivé': 'معطل', 'Nom affiché *': 'الاسم المعروض *',
  'Créer l’utilisateur': 'إنشاء المستخدم', 'Un seul groupe Dolibarr par utilisateur': 'مجموعة Dolibarr واحدة لكل مستخدم', 'Un mot de passe provisoire est généré et affiché une seule fois.': 'تنشأ كلمة مرور مؤقتة وتعرض مرة واحدة.',
  'À trancher : aujourd’hui le groupe Gérant ne peut que lire les utilisateurs dans Dolibarr. Créer ou désactiver un compte depuis CARUNO demande le droit « user:user:creer ».': 'ملاحظة: إنشاء أو تعطيل حساب يتطلب صلاحية «user:user:creer» في Dolibarr.',
  'Mon magasin': 'محلي', 'Nom du magasin (enseigne)': 'اسم المحل (اللافتة)', 'Logo du magasin': 'شعار المحل', 'Ajouter le logo': 'إضافة الشعار', 'Changer le logo': 'تغيير الشعار', 'Retirer le logo': 'حذف الشعار',
  'Enregistrer le magasin': 'حفظ المحل', 'Le nom, l’adresse et le logo apparaissent dans le menu, sur les tickets et les factures, sur tous les postes du magasin.': 'يظهر الاسم والعنوان والشعار في القائمة وعلى التذاكر والفواتير، في كل أجهزة المحل.',
  'Seul le gérant ou le responsable peut modifier ces informations.': 'فقط المسير أو المسؤول يمكنه تعديل هذه المعلومات.', 'Langue et poste': 'اللغة والجهاز', 'Langue de l’application': 'لغة التطبيق',
  'Nom de ce poste': 'اسم هذا الجهاز', 'Enregistrer le poste': 'حفظ الجهاز', 'Sortie de stock': 'خروج المخزون', 'sortie à la validation de la facture': 'الخروج عند تأكيد الفاتورة', 'TVA': 'الرسم على القيمة المضافة',
  'non assujetti : prix sans TVA': 'غير خاضع: أسعار بدون رسم', 'Changer mon mot de passe': 'تغيير كلمة المرور', 'Mot de passe actuel': 'كلمة المرور الحالية', 'Nouveau mot de passe': 'كلمة المرور الجديدة',
  '8 caractères minimum': '8 أحرف على الأقل', 'Magasin enregistré dans Dolibarr.': 'تم حفظ المحل في Dolibarr.', 'Enregistrement du magasin…': 'جارٍ حفظ المحل…', 'Le nom du magasin est obligatoire.': 'اسم المحل إجباري.',

  // ---- scanner
  'Caméra du téléphone ou douchette USB': 'كاميرا الهاتف أو ماسح USB', 'Consulter': 'استعلام', 'Placez le code-barres dans le cadre': 'ضع الباركود داخل الإطار', 'Simuler un scan': 'المسح',
  'Saisir ou scanner un code, puis Entrée': 'أدخل أو امسح رمزاً ثم Enter', 'Code lu :': 'الرمز المقروء:', 'Entrepôt compté': 'المستودع المعدود', 'Commande reçue': 'الطلبية المستلمة',
  'Aucune commande fournisseur en attente de réception.': 'لا توجد طلبية مورد في انتظار الاستلام.', 'Fiche et photos': 'البطاقة والصور', 'Vendre': 'بيع', 'Enregistrer le comptage': 'حفظ العد',
  'Scannez le code-barres avec la douchette.': 'امسح الباركود بالماسح.', 'Scannez le code-barres avec la douchette : il arrive dans la recherche.': 'امسح الباركود بالماسح: يظهر في البحث.', 'Conforme ': 'مطابق',

  // ---- caisse
  'Caisse fermée': 'الصندوق مغلق', 'Caisse ouverte · #:#': 'الصندوق مفتوح · #:#', 'Menu de la caisse': 'قائمة الصندوق', 'Commandes et tickets': 'الطلبيات والتذاكر', 'Rembourser un ticket': 'استرجاع تذكرة',
  'Entrée / sortie d’espèces': 'إدخال / إخراج نقود', 'Fermer la caisse': 'إغلاق الصندوق', 'Ouvrir la caisse': 'فتح الصندوق', 'Fond de caisse compté': 'رصيد الصندوق المعدود',
  'Référence, OEM, marque, désignation… ou douchette': 'مرجع، OEM، علامة، تسمية… أو الماسح', 'Rechercher une pièce': 'البحث عن قطعة', 'Entrée': 'Enter', 'Échap': 'Esc',
  'ajouter → prix → quantité → recherche': 'إضافة ← السعر ← الكمية ← البحث', 'pièce ou ligne précédente / suivante': 'القطعة أو السطر السابق / التالي', 'sur recherche vide : paiement': 'على بحث فارغ: الدفع', 'recherche': 'البحث',
  'Panier vide.': 'السلة فارغة.', 'Touchez une pièce ou scannez un code-barres.': 'المس قطعة أو امسح باركود.', 'Panier · # article': 'السلة · # قطعة', 'Panier · # articles': 'السلة · # قطع',
  'Paiement': 'الدفع', 'Rembourser': 'استرجاع', 'Diminuer': 'إنقاص', 'Augmenter': 'زيادة', 'Retirer la ligne': 'حذف السطر', 'Prix rapides': 'أسعار سريعة', 'Arrondi': 'تقريب',
  'Dernière vente · #/#': 'آخر بيع · #/#', 'À ce client · #/#': 'لهذا الزبون · #/#', 'Ajouter un motif': 'إضافة سبب', 'Infos  #': 'معلومات #', 'Dernières ventes': 'آخر المبيعات', 'Jamais vendue.': 'لم تبع أبداً.', 'Jamais vendue': 'لم تبع أبداً',
  'Ajouter · # DA': 'إضافة · # دج', 'Motif du changement de prix': 'سبب تغيير السعر', 'Nouveau prix': 'السعر الجديد', 'Motif (facultatif)': 'السبب (اختياري)', 'Client fidèle': 'زبون وفي',
  'Alignement sur un concurrent': 'مجاراة منافس', 'Emballage abîmé': 'تغليف تالف', 'Erreur d’étiquette': 'خطأ في الملصق', 'Geste commercial': 'لفتة تجارية', 'Pièce commandée spécialement': 'قطعة مطلوبة خصيصاً',
  'Le changement de prix est écrit dans la note privée de la facture, visible du gérant, du responsable et du comptable.': 'تغيير السعر يكتب في الملاحظة الخاصة للفاتورة، ويراه المسير والمسؤول والمحاسب.',
  'Note (imprimée sur le ticket)': 'ملاحظة (تطبع على التذكرة)', 'Fiche rapide. RC, NIF et plafond se complètent dans Clients.': 'بطاقة سريعة. س.ت ور.ج والسقف تكمل في الزبائن.', 'Créer et choisir': 'إنشاء واختيار',
  'Apport de monnaie': 'إضافة فكة', 'Achat de fournitures': 'شراء لوازم', 'Sortie': 'إخراج', 'Rechercher un client': 'البحث عن زبون', 'Vente anonyme': 'بيع بدون اسم',
  'Paiement comptant': 'دفع نقدي', 'Modes de paiement': 'طرق الدفع', 'Chèque': 'صك', 'Virement': 'تحويل', 'Avoir client': 'رصيد الزبون', 'Compte client (à crédit)': 'حساب الزبون (بالدين)',
  'Reste à payer': 'الباقي للدفع', 'Rendu monnaie': 'الباقي للزبون', 'Montant réglé': 'المبلغ المدفوع', 'Total à payer # DA': 'المجموع للدفع # دج', 'Reçu :': 'المستلم:', 'Exact': 'المبلغ بالضبط', 'Espèces reçues': 'النقود المستلمة',
  'Paiement en espèces par défaut. Touchez un autre mode pour le remplacer, ou modifiez le montant pour payer en plusieurs fois.': 'الدفع نقداً افتراضياً. المس طريقة أخرى لاستبداله، أو عدل المبلغ للدفع على عدة مرات.',
  'Tapez le montant reçu puis': 'اكتب المبلغ المستلم ثم', 'pour valider': 'للتأكيد', 'retour aux pièces': 'العودة إلى القطع', 'Validation': 'التأكيد', 'Choisissez un mode de paiement.': 'اختر طريقة دفع.',
  'La validation crée la facture dans Dolibarr, sort le stock (sortie à la validation de la facture) et enregistre les paiements.': 'التأكيد ينشئ الفاتورة في Dolibarr، ويخرج المخزون ويسجل المدفوعات.',
  'Paiement réussi': 'تم الدفع', 'Vente validée': 'تم تأكيد البيع', 'Imprimer le ticket': 'طباعة التذكرة', 'Facture A4': 'فاتورة A4', 'nouvelle commande': 'طلبية جديدة', 'Étapes côté Dolibarr': 'المراحل في Dolibarr',
  'Connexion perdue': 'انقطع الاتصال', 'Reprendre maintenant': 'استئناف الآن', 'Nouvelle commande, reprendre plus tard': 'طلبية جديدة، الاستئناف لاحقاً', 'Reprendre': 'استئناف', 'Plus tard': 'لاحقاً', 'Vente interrompue': 'بيع متوقف',
  'Enregistrement de la vente dans Dolibarr…': 'جارٍ تسجيل البيع في Dolibarr…', 'En cours (#)': 'جارية (#)', 'Tickets validés': 'التذاكر المؤكدة', 'Créée': 'أنشئت', 'Articles': 'القطع', 'Vente': 'البيع',
  'Réimprimer': 'إعادة الطباعة', 'N° de ticket, facture ou client…': 'رقم التذكرة أو الفاتورة أو الزبون…', 'Aucune commande en cours.': 'لا توجد طلبية جارية.', 'Aucun ticket.': 'لا توجد تذكرة.',
  'Chiffre d’affaires': 'رقم الأعمال', '# (gardées pour la prochaine session)': '# (محفوظة للجلسة القادمة)', 'Par mode de paiement': 'حسب طريقة الدفع', 'Avoirs clients': 'أرصدة الزبائن', 'Compte client (crédit)': 'حساب الزبون (دين)',
  'Contrôle des espèces': 'مراقبة النقود', 'Fond d’ouverture': 'رصيد الافتتاح', '+ Espèces encaissées (nettes des remboursements)': '+ النقود المحصلة (صافية من الاسترجاع)', '+ Entrées': '+ الإدخالات', '− Sorties': '− الإخراجات',
  '− Déposé en banque': '− المودع في البنك', 'Attendu dans le tiroir': 'المتوقع في الدرج', 'Espèces comptées': 'النقود المعدودة', 'Entrées et sorties': 'الإدخالات والإخراجات', 'Ventes': 'المبيعات',
  'Particulier · prix Public': 'فرد · سعر العموم', 'Garage · prix Garage': 'ورشة · سعر الورشة', 'Revendeur · prix Gros': 'بائع جملة · سعر الجملة',
  'Particulier · niv. #': 'فرد · مستوى #', 'Garage · niv. #': 'ورشة · مستوى #', 'Revendeur · niv. #': 'بائع جملة · مستوى #', 'Particulier · Public': 'فرد · العموم', 'Garage · Garage': 'ورشة · الورشة', 'Revendeur · Gros': 'بائع جملة · الجملة',
  'Aucune pièce. Essayez la référence OEM ou une autre marque.': 'لا توجد قطعة. جرب مرجع OEM أو علامة أخرى.', 'Transférer ': 'تحويل', 'Commandes ': 'الطلبيات',

  // ---- impression
  'Bon d’achat': 'وصل شراء', 'BON D’ACHAT': 'وصل شراء', 'Client :': 'الزبون:',
  'Prix inférieur au prix d’achat : vente à perte': 'السعر أقل من سعر الشراء: بيع بخسارة', 'Prix inférieur au prix d’achat (# DA) : vente à perte': 'السعر أقل من سعر الشراء (# دج): بيع بخسارة',
  'Vente à perte :': 'بيع بخسارة:',
};
// Textes composés : dates, mois, titres avec une référence.
(function () {
  const J = { lundi: 'الاثنين', mardi: 'الثلاثاء', mercredi: 'الأربعاء', jeudi: 'الخميس', vendredi: 'الجمعة', samedi: 'السبت', dimanche: 'الأحد' };
  const M = { janvier: 'جانفي', 'février': 'فيفري', mars: 'مارس', avril: 'أفريل', mai: 'ماي', juin: 'جوان', juillet: 'جويلية', 'août': 'أوت', septembre: 'سبتمبر', octobre: 'أكتوبر', novembre: 'نوفمبر', 'décembre': 'ديسمبر' };
  const m = (x) => M[x.toLowerCase()] || x, j = (x) => J[x.toLowerCase()] || x;
  window.AR_RULES = [
    [/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) (\d+) (\S+) (\d{4})$/i, (s, d, n, mo, y) => j(d) + ' ' + n + ' ' + m(mo) + ' ' + y],
    [/^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre) (\d{4})$/i, (s, mo, y) => m(mo) + ' ' + y],
    [/^([+−]?\d+) % par rapport à (\S+)$/, (s, p, mo) => p + ' % مقارنة بـ ' + m(mo)],
    [/^Marge brute de (\S+)$/, (s, mo) => 'الهامش الخام لشهر ' + m(mo)],
    [/^Paiement · (\S+)$/, (s, r) => 'الدفع · ' + r],
    [/^Client · (\S+)$/, (s, r) => 'الزبون · ' + r],
    [/^Fermer la caisse · (\S+)$/, (s, r) => 'إغلاق الصندوق · ' + r],
    [/^Imprimer (facture|devis|commande|livraison|avoir) (\S+)$/, (s, t, r) => 'طباعة ' + ({ facture: 'فاتورة', devis: 'عرض سعر', commande: 'طلبية', livraison: 'تسليم', avoir: 'إشعار دائن' })[t] + ' ' + r],
    [/^Importer (.+\.\w{2,4})$/, (s, f) => 'استيراد ' + f],
    [/^(.+) sous le prix d’achat\. Vérifiez les prix avant de valider\.$/, (s, p) => p + ' تحت سعر الشراء. تحقق من الأسعار قبل التأكيد.'],
    [/^(.+) : pas encore relié à Dolibarr\. À faire dans Dolibarr pour l’instant\.$/, (s, w) => w + ': غير مربوط بعد بـ Dolibarr. يتم في Dolibarr حالياً.'],
  ];
})();
