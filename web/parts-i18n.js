/* Noms des pièces du catalogue (anglais du fournisseur) en français et en arabe.
   Règle : la fin du nom anglais est la pièce (« Shock Absorber »), ce qui précède la précise (« Front ») :
   « Front Shock Absorber R » → « Amortisseur avant droit » / « ممتص الصدمات أمامي يمين ».
   HEADS : pièce → [français, genre fr, arabe, genre ar] ; WORDS : précision → [fr masc., fr fém., ar masc., ar fém.].
   Un nom dont un mot n'est pas connu reste en anglais (pas de traduction approximative). */
(function () {
  const H = {
    // ---- refroidissement, eau
    'pipe': ['Tuyau', 'm', 'أنبوب', 'm'], 'water pipe': ['Durite d’eau', 'f', 'خرطوم الماء', 'm'], 'cooling water pipe': ['Durite de refroidissement', 'f', 'خرطوم ماء التبريد', 'm'],
    'coolant pipe': ['Durite de liquide de refroidissement', 'f', 'خرطوم سائل التبريد', 'm'], 'hose': ['Durite', 'f', 'خرطوم', 'm'], 'breather hose': ['Durite de reniflard', 'f', 'خرطوم التهوية', 'm'],
    'air filter hose': ['Durite de filtre à air', 'f', 'خرطوم فلتر الهواء', 'm'], 'filter hose': ['Durite de filtre', 'f', 'خرطوم الفلتر', 'm'], 'turbocharger pipe': ['Durite de turbo', 'f', 'خرطوم التيربو', 'm'],
    'water conector': ['Raccord d’eau', 'm', 'وصلة ماء', 'f'], 'water connector': ['Raccord d’eau', 'm', 'وصلة ماء', 'f'], 'conector': ['Raccord', 'm', 'وصلة', 'f'], 'connector': ['Raccord', 'm', 'وصلة', 'f'],
    'complate water conector': ['Raccord d’eau complet', 'm', 'وصلة ماء كاملة', 'f'], 'radiator': ['Radiateur', 'm', 'رادياتير', 'm'], 'water pump': ['Pompe à eau', 'f', 'مضخة الماء', 'f'],
    'additional water pump': ['Pompe à eau additionnelle', 'f', 'مضخة ماء إضافية', 'f'], 'expansion tank': ['Vase d’expansion', 'm', 'خزان التمدد', 'm'], 'thermostat': ['Thermostat', 'm', 'ترموستات', 'm'],
    'thermostat housing': ['Boîtier de thermostat', 'm', 'علبة الترموستات', 'f'], 'radiator fan': ['Ventilateur de radiateur', 'm', 'مروحة الرادياتير', 'f'], 'fan': ['Ventilateur', 'm', 'مروحة', 'f'],
    'cowling, radiator fan': ['Carénage de ventilateur de radiateur', 'm', 'غطاء مروحة الرادياتير', 'm'], 'oil cooler': ['Refroidisseur d’huile', 'm', 'مبرد الزيت', 'm'], 'gear oil cooler': ['Refroidisseur d’huile de boîte', 'm', 'مبرد زيت العلبة', 'm'],
    'cooler': ['Refroidisseur', 'm', 'مبرد', 'm'], 'turbo cooler': ['Refroidisseur de turbo', 'm', 'مبرد التيربو', 'm'], 'heat exchanger': ['Échangeur thermique', 'm', 'مبادل حراري', 'm'],
    'condenser': ['Condenseur', 'm', 'مكثف', 'm'], 'air conditioning condenser': ['Condenseur de climatisation', 'm', 'مكثف المكيف', 'm'], 'evaporator': ['Évaporateur', 'm', 'مبخر', 'm'],
    'air conditioning evaporator': ['Évaporateur de climatisation', 'm', 'مبخر المكيف', 'm'], 'compressor': ['Compresseur', 'm', 'ضاغط', 'm'], 'interior blower': ['Pulseur d’air habitacle', 'm', 'مروحة التدفئة', 'f'],
    'blower': ['Pulseur d’air', 'm', 'مروحة', 'f'], 'reservoir': ['Réservoir', 'm', 'خزان', 'm'], 'water reservoir': ['Réservoir d’eau', 'm', 'خزان الماء', 'm'], 'wash water reservoir': ['Réservoir de lave-glace', 'm', 'خزان ماء المساحات', 'm'],
    // ---- moteur
    'engine mount': ['Support moteur', 'm', 'كرسي المحرك', 'm'], 'transmission mount': ['Support de boîte de vitesses', 'm', 'كرسي علبة السرعات', 'm'], 'mount': ['Support', 'm', 'كرسي', 'm'],
    'gasket': ['Joint', 'm', 'جوان', 'm'], 'sealing gasket': ['Joint d’étanchéité', 'm', 'جوان إحكام', 'm'], 'gasket set': ['Pochette de joints', 'f', 'طقم جوانات', 'm'], 'valve cover gasket': ['Joint de cache-culbuteurs', 'm', 'جوان غطاء الصمامات', 'm'],
    'cover gasket': ['Joint de couvercle', 'm', 'جوان الغطاء', 'm'], 'cylinder head gasket': ['Joint de culasse', 'm', 'جوان رأس المحرك', 'm'], 'head gasket': ['Joint de culasse', 'm', 'جوان رأس المحرك', 'm'],
    'head gasket set': ['Pochette de joints de culasse', 'f', 'طقم جوانات رأس المحرك', 'm'], 'manifold gasket': ['Joint de collecteur', 'm', 'جوان المجمع', 'm'], 'intake manifold gasket': ['Joint de collecteur d’admission', 'm', 'جوان مجمع السحب', 'm'],
    'sump gasket': ['Joint de carter', 'm', 'جوان حوض الزيت', 'm'], 'oil sump gasket': ['Joint de carter d’huile', 'm', 'جوان حوض الزيت', 'm'], 'gasket，oil cooler': ['Joint de refroidisseur d’huile', 'm', 'جوان مبرد الزيت', 'm'],
    'cylinder head cover': ['Couvre-culasse', 'm', 'غطاء رأس المحرك', 'm'], 'head cover': ['Couvre-culasse', 'm', 'غطاء رأس المحرك', 'm'], 'piston': ['Piston', 'm', 'مكبس', 'm'], 'piston rings': ['Segments de piston', 'm', 'حلقات المكبس', 'f'],
    'oil seal': ['Joint spi', 'm', 'سدادة زيت', 'f'], 'crankshaft oil seal': ['Joint spi de vilebrequin', 'm', 'سدادة زيت عمود الكرنك', 'f'], 'seal': ['Joint', 'm', 'سدادة', 'f'], 'oil seat': ['Siège de joint d’huile', 'm', 'قاعدة الزيت', 'f'],
    'oil pan': ['Carter d’huile', 'm', 'حوض الزيت', 'm'], 'oil pump': ['Pompe à huile', 'f', 'مضخة الزيت', 'f'], 'oil filter': ['Filtre à huile', 'm', 'فلتر الزيت', 'm'], 'camshaft adjuster': ['Déphaseur d’arbre à cames', 'm', 'منظم عمود الكامات', 'm'],
    'timing chain': ['Chaîne de distribution', 'f', 'سلسلة التوقيت', 'f'], 'timing belt': ['Courroie de distribution', 'f', 'سير التوقيت', 'm'], 'timing kit': ['Kit de distribution', 'm', 'طقم التوقيت', 'm'], 'chain': ['Chaîne', 'f', 'سلسلة', 'f'],
    'guide rail': ['Rail de guidage', 'm', 'سكة توجيه', 'f'], 'tensioner': ['Tendeur', 'm', 'شداد', 'm'], 'belt tensioner': ['Tendeur de courroie', 'm', 'شداد السير', 'm'], 'tensioner pulley': ['Galet tendeur', 'm', 'بكرة الشد', 'f'],
    'tension roller': ['Galet tendeur', 'm', 'بكرة الشد', 'f'], 'pulley': ['Poulie', 'f', 'بكرة', 'f'], 'roller': ['Galet', 'm', 'بكرة', 'f'], 'belt': ['Courroie', 'f', 'سير', 'm'], 'v-ribbed belt': ['Courroie striée', 'f', 'سير محزز', 'm'],
    'injection valve': ['Injecteur', 'm', 'بخاخ', 'm'], 'solenoid valve': ['Électrovanne', 'f', 'صمام كهربائي', 'm'], 'valve': ['Valve', 'f', 'صمام', 'm'], 'turbocharger': ['Turbocompresseur', 'm', 'تيربو', 'm'],
    'activated carbon canister': ['Canister à charbon actif', 'm', 'علبة الفحم النشط', 'f'], 'carbon canister': ['Canister à charbon', 'm', 'علبة الفحم', 'f'], 'canister': ['Canister', 'm', 'علبة الفحم', 'f'],
    'spark plug': ['Bougie d’allumage', 'f', 'شمعة الإشعال', 'f'], 'plug': ['Bouchon', 'm', 'سدادة', 'f'], 'ignition coil': ['Bobine d’allumage', 'f', 'بوبينة الإشعال', 'f'], 'coil': ['Bobine', 'f', 'بوبينة', 'f'],
    'ignition wire set': ['Jeu de câbles d’allumage', 'm', 'طقم أسلاك الإشعال', 'm'], 'wire set': ['Jeu de câbles', 'm', 'طقم أسلاك', 'm'], 'separator': ['Séparateur', 'm', 'فاصل', 'm'],
    // ---- carburant, air, filtres
    'filter': ['Filtre', 'm', 'فلتر', 'm'], 'air filter': ['Filtre à air', 'm', 'فلتر الهواء', 'm'], 'fuel filter': ['Filtre à carburant', 'm', 'فلتر البنزين', 'm'], 'a/c filter': ['Filtre d’habitacle', 'm', 'فلتر المكيف', 'm'],
    'a/t filter': ['Filtre de boîte automatique', 'm', 'فلتر العلبة الأوتوماتيكية', 'm'], 'a/t filter kit': ['Kit filtre de boîte automatique', 'm', 'طقم فلتر العلبة الأوتوماتيكية', 'm'], 'filter kit': ['Kit de filtre', 'm', 'طقم فلتر', 'm'],
    'fuel pump': ['Pompe à carburant', 'f', 'مضخة البنزين', 'f'], 'complete fuel pump': ['Pompe à carburant complète', 'f', 'مضخة بنزين كاملة', 'f'], 'pump': ['Pompe', 'f', 'مضخة', 'f'], 'hydraulic pump': ['Pompe hydraulique', 'f', 'مضخة هيدروليكية', 'f'],
    'air mass meter': ['Débitmètre d’air', 'm', 'حساس كمية الهواء', 'm'], 'mass meter': ['Débitmètre', 'm', 'حساس كمية الهواء', 'm'], 'air duct': ['Conduit d’air', 'm', 'مجرى الهواء', 'm'], 'duct': ['Conduit', 'm', 'مجرى', 'm'],
    'tank': ['Réservoir', 'm', 'خزان', 'm'],
    // ---- freinage
    'brake pad set': ['Jeu de plaquettes de frein', 'm', 'طقم فحمات الفرامل', 'm'], 'pad set': ['Jeu de plaquettes', 'm', 'طقم فحمات', 'm'], 'brake disc': ['Disque de frein', 'm', 'قرص الفرامل', 'm'], 'disc': ['Disque', 'm', 'قرص', 'm'],
    'brake shoe set': ['Jeu de mâchoires de frein', 'm', 'طقم فكوك الفرامل', 'm'], 'shoe set': ['Jeu de mâchoires', 'm', 'طقم فكوك', 'm'], 'brake sensor': ['Témoin d’usure de frein', 'm', 'حساس الفرامل', 'm'],
    'brake master cylinder': ['Maître-cylindre de frein', 'm', 'الأسطوانة الرئيسية للفرامل', 'f'], 'master cylinder': ['Maître-cylindre', 'm', 'أسطوانة رئيسية', 'f'], 'cylinder': ['Cylindre', 'm', 'أسطوانة', 'f'],
    // ---- embrayage, transmission
    'clutch master cylinder': ['Émetteur d’embrayage', 'm', 'الأسطوانة الرئيسية للقابض', 'f'], 'clutch slave cylinder': ['Récepteur d’embrayage', 'm', 'الأسطوانة الثانوية للقابض', 'f'], 'slave cylinder': ['Récepteur', 'm', 'أسطوانة ثانوية', 'f'],
    'release bearing': ['Butée d’embrayage', 'f', 'رولمان الدبرياج', 'm'], 'driveshaft': ['Arbre de transmission', 'm', 'عمود نقل الحركة', 'm'], 'c.v joint': ['Joint homocinétique', 'm', 'مفصل الكردان', 'm'], 'cv joint': ['Joint homocinétique', 'm', 'مفصل الكردان', 'm'],
    'c.v joint kit': ['Kit joint homocinétique', 'm', 'طقم مفصل الكردان', 'm'], 'joint kit': ['Kit de joint', 'm', 'طقم مفصل', 'm'], 'centre bearing': ['Palier central', 'm', 'رولمان الوسط', 'm'], 'gear': ['Pignon', 'm', 'ترس', 'm'],
    // ---- suspension, direction
    'bushing': ['Silentbloc', 'm', 'جلبة', 'f'], 'suspension bushing': ['Silentbloc de suspension', 'm', 'جلبة التعليق', 'f'], 'stabilizer bushing': ['Silentbloc de barre stabilisatrice', 'm', 'جلبة عمود التوازن', 'f'],
    'control arm': ['Bras de suspension', 'm', 'ذراع التحكم', 'm'], 'arm': ['Bras', 'm', 'ذراع', 'm'], 'axle arm': ['Bras d’essieu', 'm', 'ذراع المحور', 'm'], 'rear axle arm': ['Bras d’essieu arrière', 'm', 'ذراع المحور الخلفي', 'm'],
    'shock absorber': ['Amortisseur', 'm', 'ممتص الصدمات', 'm'], 'absorber': ['Amortisseur', 'm', 'ممتص الصدمات', 'm'], 'shock absorber gas': ['Amortisseur à gaz', 'm', 'ممتص صدمات غازي', 'm'],
    'supply unit(shock absorber)': ['Compresseur de suspension pneumatique', 'm', 'ضاغط التعليق الهوائي', 'm'], 'supply unit shock absorber': ['Compresseur de suspension pneumatique', 'm', 'ضاغط التعليق الهوائي', 'm'],
    'air supply unit shock absorber': ['Compresseur de suspension pneumatique', 'm', 'ضاغط التعليق الهوائي', 'm'], 'shock dust cover kit': ['Kit de protection d’amortisseur', 'm', 'طقم غطاء غبار ممتص الصدمات', 'm'], 'shock pad': ['Butée d’amortisseur', 'f', 'وسادة ممتص الصدمات', 'f'], 'pad': ['Butée', 'f', 'وسادة', 'f'],
    'air strut': ['Jambe de suspension pneumatique', 'f', 'دعامة هوائية', 'f'], 'strut': ['Jambe de suspension', 'f', 'دعامة', 'f'], 'air spring': ['Ressort pneumatique', 'm', 'نابض هوائي', 'm'], 'spring': ['Ressort', 'm', 'نابض', 'm'],
    'stabilizer link': ['Biellette de barre stabilisatrice', 'f', 'رابط عمود التوازن', 'm'], 'link': ['Biellette', 'f', 'رابط', 'm'], 'ball joint': ['Rotule de suspension', 'f', 'مفصل كروي', 'm'], 'joint': ['Joint', 'm', 'مفصل', 'm'],
    'tie rod end': ['Rotule de direction', 'f', 'رأس ذراع التوجيه', 'm'], 'rod end': ['Rotule', 'f', 'رأس الذراع', 'm'], 'rod axle joint': ['Rotule axiale', 'f', 'مفصل محوري', 'm'], 'axle joint': ['Rotule axiale', 'f', 'مفصل محوري', 'm'],
    'rod assembly': ['Barre complète', 'f', 'ذراع كامل', 'm'], 'steering box': ['Boîtier de direction', 'm', 'علبة التوجيه', 'f'], 'complete steering box': ['Boîtier de direction complet', 'm', 'علبة توجيه كاملة', 'f'],
    'steering boot': ['Soufflet de direction', 'm', 'جلدة التوجيه', 'f'], 'boot': ['Soufflet', 'm', 'جلدة', 'f'], 'wheel hub': ['Moyeu de roue', 'm', 'محور العجلة', 'm'], 'hub': ['Moyeu', 'm', 'محور', 'm'],
    'wheel bearing': ['Roulement de roue', 'm', 'رولمان العجلة', 'm'], 'bearing': ['Roulement', 'm', 'رولمان', 'm'], 'bearing rep. kit': ['Kit de réparation de roulement', 'm', 'طقم إصلاح الرولمان', 'm'],
    'wheel speed sensor': ['Capteur ABS', 'm', 'حساس سرعة العجلة', 'm'],
    // ---- carrosserie
    'bumper': ['Pare-chocs', 'm', 'صدام', 'm'], 'front bumper': ['Pare-chocs avant', 'm', 'صدام أمامي', 'm'], 'back bumper': ['Pare-chocs arrière', 'm', 'صدام خلفي', 'm'], 'bumper set': ['Kit pare-chocs', 'm', 'طقم صدام', 'm'],
    'bumper grill': ['Grille de pare-chocs', 'f', 'شبكة الصدام', 'f'], 'radiator grill': ['Calandre', 'f', 'شبكة الرادياتير', 'f'], 'grill': ['Grille', 'f', 'شبكة', 'f'], 'bumper spoiler': ['Becquet de pare-chocs', 'm', 'جناح الصدام', 'm'],
    'spoiler': ['Becquet', 'm', 'جناح', 'm'], 'bumper support': ['Support de pare-chocs', 'm', 'حامل الصدام', 'm'], 'bumper bracket': ['Patte de pare-chocs', 'f', 'حامل الصدام', 'm'], 'bumper clamp': ['Fixation de pare-chocs', 'f', 'مشبك الصدام', 'm'],
    'bumper trim': ['Moulure de pare-chocs', 'f', 'حلية الصدام', 'f'], 'trim': ['Moulure', 'f', 'حلية', 'f'], 'bonnet': ['Capot', 'm', 'غطاء المحرك', 'm'], 'gas spring bonnet': ['Vérin de capot', 'm', 'مساعد غطاء المحرك', 'm'],
    'spring bonnet': ['Vérin de capot', 'm', 'مساعد غطاء المحرك', 'm'], 'gas spring boot': ['Vérin de hayon', 'm', 'مساعد الصندوق الخلفي', 'm'], 'spring boot': ['Vérin de hayon', 'm', 'مساعد الصندوق الخلفي', 'm'],
    'bonnet cable': ['Câble de capot', 'm', 'كابل غطاء المحرك', 'm'], 'bonnet lock': ['Serrure de capot', 'f', 'قفل غطاء المحرك', 'm'], 'front cowling': ['Tablier avant', 'm', 'غطاء أمامي', 'm'], 'cowling': ['Carénage', 'm', 'غطاء', 'm'],
    'fender': ['Aile', 'f', 'رفرف', 'm'], 'fender lining': ['Pare-boue d’aile', 'm', 'بطانة الرفرف', 'f'], 'lining': ['Garniture', 'f', 'بطانة', 'f'], 'fender crom': ['Moulure chromée d’aile', 'f', 'حلية كروم الرفرف', 'f'],
    'noise insulation': ['Isolant phonique', 'm', 'عازل الصوت', 'm'], 'insulation': ['Isolant', 'm', 'عازل', 'm'], 'tow cover cap': ['Cache crochet de remorquage', 'm', 'غطاء خطاف السحب', 'm'], 'cover cap': ['Cache', 'm', 'غطاء', 'm'],
    'washer cover': ['Cache de lave-phare', 'm', 'غطاء غسالة الضوء', 'm'], 'cover': ['Cache', 'm', 'غطاء', 'm'], 'cap': ['Bouchon', 'm', 'غطاء', 'm'], 'frame': ['Cadre', 'm', 'إطار', 'm'], 'logo': ['Logo', 'm', 'شعار', 'm'],
    'guard': ['Protection', 'f', 'واقي', 'm'], 'side mirror': ['Rétroviseur', 'm', 'مرآة جانبية', 'f'], 'mirror': ['Rétroviseur', 'm', 'مرآة', 'f'], 'side mirror glass': ['Glace de rétroviseur', 'f', 'زجاج المرآة الجانبية', 'm'],
    'mirror glass': ['Glace de rétroviseur', 'f', 'زجاج المرآة', 'm'], 'glass': ['Glace', 'f', 'زجاج', 'm'], 'side mirror cover': ['Coque de rétroviseur', 'f', 'غطاء المرآة الجانبية', 'm'], 'mirror cover': ['Coque de rétroviseur', 'f', 'غطاء المرآة', 'm'],
    'door handle': ['Poignée de porte', 'f', 'مقبض الباب', 'm'], 'handle': ['Poignée', 'f', 'مقبض', 'm'], 'door lock': ['Serrure de porte', 'f', 'قفل الباب', 'm'], 'lock': ['Serrure', 'f', 'قفل', 'm'],
    'window lifter': ['Lève-vitre', 'm', 'رافعة الزجاج', 'f'], 'lifter': ['Lève-vitre', 'm', 'رافعة', 'f'], 'window lifter switch': ['Commande de lève-vitre', 'f', 'مفتاح رافعة الزجاج', 'm'], 'lifter switch': ['Commande de lève-vitre', 'f', 'مفتاح الرافعة', 'm'],
    'wiper blade': ['Balai d’essuie-glace', 'm', 'ماسحة الزجاج', 'f'], 'blade': ['Balai', 'm', 'ماسحة', 'f'], 'plate': ['Plaque', 'f', 'لوحة', 'f'], 'seat': ['Siège', 'm', 'قاعدة', 'f'],
    // ---- éclairage
    'headlight': ['Phare', 'm', 'ضوء أمامي', 'm'], 'headlight lens': ['Glace de phare', 'f', 'زجاج الضوء الأمامي', 'm'], 'lens': ['Glace', 'f', 'زجاج', 'm'], 'headlight support': ['Support de phare', 'm', 'حامل الضوء الأمامي', 'm'],
    'headlight level sensor': ['Capteur de correcteur de phare', 'm', 'حساس مستوى الضوء الأمامي', 'm'], 'taillight': ['Feu arrière', 'm', 'ضوء خلفي', 'm'], 'foglight': ['Antibrouillard', 'm', 'ضوء الضباب', 'm'], 'light': ['Feu', 'm', 'ضوء', 'm'],
    'refletor': ['Catadioptre', 'm', 'عاكس', 'm'], 'reflector': ['Catadioptre', 'm', 'عاكس', 'm'],
    // ---- électricité, capteurs
    'sensor': ['Capteur', 'm', 'حساس', 'm'], 'level sensor': ['Capteur de niveau', 'm', 'حساس المستوى', 'm'], 'crankshaft sensor': ['Capteur de vilebrequin', 'm', 'حساس عمود الكرنك', 'm'], 'oxygen sensor': ['Sonde lambda', 'f', 'حساس الأكسجين', 'm'],
    'speed sensor': ['Capteur de vitesse', 'm', 'حساس السرعة', 'm'], 'pressure sensor': ['Capteur de pression', 'm', 'حساس الضغط', 'm'], 'pressure switch': ['Manocontact', 'm', 'مفتاح الضغط', 'm'], 'switch': ['Interrupteur', 'm', 'مفتاح', 'm'],
    'alternator': ['Alternateur', 'm', 'دينامو', 'm'], 'starter': ['Démarreur', 'm', 'مارش', 'm'], 'motor': ['Moteur', 'm', 'محرك', 'm'], 'module': ['Module', 'm', 'وحدة', 'f'], 'cable': ['Câble', 'm', 'كابل', 'm'],
    // ---- divers
    'kit': ['Kit', 'm', 'طقم', 'm'], 'kits': ['Kits', 'm', 'أطقم', 'm'], 'set': ['Jeu', 'm', 'طقم', 'm'], 'repair kit': ['Kit de réparation', 'm', 'طقم إصلاح', 'm'], 'rep. kit': ['Kit de réparation', 'm', 'طقم إصلاح', 'm'],
    'support': ['Support', 'm', 'حامل', 'm'], 'bracket': ['Patte de fixation', 'f', 'حامل', 'm'], 'clamp': ['Collier', 'm', 'مشبك', 'm'], 'housing': ['Boîtier', 'm', 'علبة', 'f'], 'box': ['Boîtier', 'm', 'علبة', 'f'],
    'ring': ['Bague', 'f', 'حلقة', 'f'], 'rings': ['Bagues', 'f', 'حلقات', 'f'], 'rubber': ['Caoutchouc', 'm', 'مطاط', 'm'], 'assembly': ['Ensemble', 'm', 'مجموعة', 'f'], 'rail': ['Rail', 'm', 'سكة', 'f'],
    'adjuster': ['Régleur', 'm', 'منظم', 'm'], 'meter': ['Compteur', 'm', 'عداد', 'm'], 'pan': ['Carter', 'm', 'حوض', 'm'], 'end': ['Embout', 'm', 'طرف', 'm'],
    // ---- deuxième série (noms fréquents restants)
    'tie rod axle joint': ['Rotule axiale de direction', 'f', 'مفصل ذراع التوجيه المحوري', 'm'], 'tie rod assembly': ['Biellette de direction complète', 'f', 'ذراع توجيه كامل', 'm'], 'tie rod': ['Biellette de direction', 'f', 'ذراع التوجيه', 'm'],
    'gear oil sump gasket': ['Joint de carter de boîte', 'm', 'جوان حوض زيت العلبة', 'm'], 'oil pan gasket': ['Joint de carter d’huile', 'm', 'جوان حوض الزيت', 'm'], 'transmission oil sump': ['Carter de boîte', 'm', 'حوض زيت العلبة', 'm'],
    'camshaft sensor': ['Capteur d’arbre à cames', 'm', 'حساس عمود الكامات', 'm'], 'camshaft': ['Arbre à cames', 'm', 'عمود الكامات', 'm'], 'crankshaft': ['Vilebrequin', 'm', 'عمود الكرنك', 'm'], 'crankshaft pulley': ['Poulie de vilebrequin', 'f', 'بكرة عمود الكرنك', 'f'],
    'vapour separator': ['Séparateur d’huile', 'm', 'فاصل الأبخرة', 'm'], 'corner light': ['Feu de position d’angle', 'm', 'ضوء الزاوية', 'm'], 'coolant temperature': ['Sonde de température', 'f', 'حساس حرارة الماء', 'm'],
    'temperature sensor': ['Sonde de température', 'f', 'حساس الحرارة', 'm'], 'propeller shaft jiont': ['Flector d’arbre de transmission', 'm', 'مفصل عمود الكردان', 'm'], 'propeller shaft joint': ['Flector d’arbre de transmission', 'm', 'مفصل عمود الكردان', 'm'],
    'body board': ['Cache de bas de caisse', 'm', 'لوح الهيكل', 'm'], 'headlight washer jet motor': ['Pompe de lave-phare', 'f', 'مضخة غسالة الضوء', 'f'], 'washer jet': ['Gicleur de lave-glace', 'm', 'رشاش الماء', 'm'], 'washer pump': ['Pompe de lave-glace', 'f', 'مضخة ماء المساحات', 'f'],
    'rubber buffer': ['Tampon caoutchouc', 'm', 'وسادة مطاطية', 'f'], 'buffer': ['Tampon', 'm', 'وسادة', 'f'], 'fuel float': ['Jauge de carburant', 'f', 'عوامة البنزين', 'f'], 'float': ['Flotteur', 'm', 'عوامة', 'f'],
    'dust cover': ['Cache-poussière', 'm', 'غطاء الغبار', 'm'], 'gear dust cover': ['Soufflet de levier de vitesses', 'm', 'جلدة عصا السرعات', 'f'], 'license bracket': ['Support de plaque', 'm', 'حامل اللوحة', 'm'], 'boot lock': ['Serrure de hayon', 'f', 'قفل الصندوق الخلفي', 'm'],
    'steering wheel return ring': ['Ressort spiralé d’airbag', 'm', 'حلقة المقود', 'f'], 'solenoid valve block': ['Bloc d’électrovannes', 'm', 'كتلة الصمامات الكهربائية', 'f'], 'relay': ['Relais', 'm', 'ريلاي', 'm'], 'under guard': ['Protection inférieure', 'f', 'واقي سفلي', 'm'],
    'vacuum pump': ['Pompe à vide', 'f', 'مضخة الفراغ', 'f'], 'brake system': ['Système de freinage', 'm', 'نظام الفرامل', 'm'], 'system': ['Système', 'm', 'نظام', 'm'], 'oil gage': ['Jauge d’huile', 'f', 'مقياس الزيت', 'm'], 'oil dipstick': ['Jauge d’huile', 'f', 'مقياس الزيت', 'm'],
    'oil dipstick funnel': ['Tube de jauge d’huile', 'm', 'أنبوب مقياس الزيت', 'm'], 'starter gear': ['Lanceur de démarreur', 'm', 'ترس المارش', 'm'], 'crankcase breather': ['Reniflard de carter', 'm', 'تهوية علبة المرفق', 'f'],
    'fog lights frame': ['Cadre d’antibrouillard', 'm', 'إطار ضوء الضباب', 'm'], 'main bearing': ['Coussinet de palier', 'm', 'سبيكة رئيسية', 'f'], 'blower motor resistor': ['Résistance de pulseur', 'f', 'مقاومة المروحة', 'f'], 'resistor': ['Résistance', 'f', 'مقاومة', 'f'],
    'coil spring': ['Ressort hélicoïdal', 'm', 'نابض لولبي', 'm'], 'muffler hanger': ['Silentbloc d’échappement', 'm', 'علاقة الشكمان', 'f'], 'muffler': ['Silencieux', 'm', 'شكمان', 'm'], 'voltage regulator': ['Régulateur de tension', 'm', 'منظم الجهد', 'm'], 'regulator': ['Régulateur', 'm', 'منظم', 'm'],
    'boot for shock absorber': ['Soufflet d’amortisseur', 'm', 'جلدة ممتص الصدمات', 'f'], 'rocker arm': ['Culbuteur', 'm', 'ذراع الصمام', 'm'], 'timing system cover': ['Carter de distribution', 'm', 'غطاء التوقيت', 'm'], 'fender support': ['Support d’aile', 'm', 'حامل الرفرف', 'm'],
    'mudguard': ['Bavette', 'f', 'واقي الطين', 'm'], 'high pressure pump': ['Pompe haute pression', 'f', 'مضخة الضغط العالي', 'f'], 'cylinder head': ['Culasse', 'f', 'رأس المحرك', 'm'], 'brake light switch': ['Contacteur de feu stop', 'm', 'مفتاح ضوء الفرامل', 'm'],
    'radiator grill without logo': ['Calandre sans logo', 'f', 'شبكة الرادياتير بدون شعار', 'f'], 'bonnet hinge': ['Charnière de capot', 'f', 'مفصلة غطاء المحرك', 'f'], 'hinge': ['Charnière', 'f', 'مفصلة', 'f'], 'fender grill': ['Grille d’aile', 'f', 'شبكة الرفرف', 'f'],
    'flywheel': ['Volant moteur', 'm', 'دولاب الموازنة', 'm'], 'intake manifold': ['Collecteur d’admission', 'm', 'مجمع السحب', 'm'], 'manifold': ['Collecteur', 'm', 'مجمع', 'm'], 'turn signal switch': ['Commodo de clignotant', 'm', 'مفتاح الإشارة', 'm'],
    'air bag': ['Airbag', 'm', 'وسادة هوائية', 'f'], 'generator pulley': ['Poulie d’alternateur', 'f', 'بكرة الدينامو', 'f'], 'guide sleeve': ['Douille de guidage', 'f', 'جلبة توجيه', 'f'], 'sleeve': ['Douille', 'f', 'جلبة', 'f'],
    'wheel hub bearing': ['Roulement de moyeu', 'm', 'رولمان محور العجلة', 'm'], 'stabiliser': ['Barre stabilisatrice', 'f', 'عمود التوازن', 'm'], 'stabilizer': ['Barre stabilisatrice', 'f', 'عمود التوازن', 'm'], 'friction bearing': ['Coupelle d’amortisseur', 'f', 'رولمان الدعامة', 'm'],
    'front axle': ['Essieu avant', 'm', 'المحور الأمامي', 'm'], 'axle': ['Essieu', 'm', 'محور', 'm'], 'glow plug': ['Bougie de préchauffage', 'f', 'شمعة التسخين', 'f'], 'steering knuckle': ['Porte-moyeu', 'm', 'مفصل التوجيه', 'm'],
    'oil filter housing cap': ['Couvercle de filtre à huile', 'm', 'غطاء علبة فلتر الزيت', 'm'], 'oil filter housing': ['Boîtier de filtre à huile', 'm', 'علبة فلتر الزيت', 'f'], 'valve stem seal': ['Joint de queue de soupape', 'm', 'جلدة الصمام', 'f'],
    'grab handle': ['Poignée de maintien', 'f', 'مقبض التمسك', 'm'], 'transmission control unit': ['Calculateur de boîte de vitesses', 'm', 'كمبيوتر علبة السرعات', 'm'], 'control unit': ['Calculateur', 'm', 'وحدة التحكم', 'f'], 'unit': ['Unité', 'f', 'وحدة', 'f'],
    'gear shift cable': ['Câble de vitesses', 'm', 'كابل السرعات', 'm'], 'heater valve': ['Robinet de chauffage', 'm', 'صمام التدفئة', 'm'], 'expansion valve': ['Détendeur de climatisation', 'm', 'صمام التمدد', 'm'], 'column switch': ['Commodo', 'm', 'مفتاح المقود', 'm'],
    'name plate': ['Monogramme', 'm', 'لوحة الاسم', 'f'], 'egr valve': ['Vanne EGR', 'f', 'صمام EGR', 'm'], 'v-belt': ['Courroie trapézoïdale', 'f', 'سير', 'm'], 'sound absorber': ['Insonorisant', 'm', 'عازل الصوت', 'm'], 'bonnet sound absorber': ['Insonorisant de capot', 'm', 'عازل صوت غطاء المحرك', 'm'],
    'bolt': ['Vis', 'f', 'برغي', 'm'], 'guide pulley': ['Galet enrouleur', 'm', 'بكرة توجيه', 'f'], 'door open cable': ['Câble d’ouverture de porte', 'm', 'كابل فتح الباب', 'm'], 'fan blade': ['Hélice de ventilateur', 'f', 'ريشة المروحة', 'f'], 'side skirt': ['Bas de caisse', 'm', 'جانب الهيكل', 'm'],
    'wheel': ['Roue', 'f', 'عجلة', 'f'], 'side mirror pointer': ['Clignotant de rétroviseur', 'm', 'إشارة المرآة الجانبية', 'f'], 'fender pointer': ['Répétiteur de clignotant', 'm', 'إشارة الرفرف', 'f'], 'pointer': ['Clignotant', 'm', 'إشارة', 'f'],
    'strip': ['Baguette', 'f', 'شريط', 'm'], 'lamp': ['Feu', 'm', 'مصباح', 'm'], 'taillights': ['Feux arrière', 'm', 'أضواء خلفية', 'f'], 'lights': ['Feux', 'm', 'أضواء', 'f'], 'caliper': ['Étrier de frein', 'm', 'فك الفرامل', 'm'], 'brake caliper': ['Étrier de frein', 'm', 'فك الفرامل', 'm'],
    'drum': ['Tambour', 'm', 'طنبور', 'm'], 'brake drum': ['Tambour de frein', 'm', 'طنبور الفرامل', 'm'], 'throttle body': ['Boîtier papillon', 'm', 'علبة الخانق', 'f'], 'lever': ['Levier', 'm', 'ذراع', 'm'], 'actuator': ['Actionneur', 'm', 'مشغل', 'm'],
    'flange': ['Bride', 'f', 'شفة', 'f'], 'baffle': ['Déflecteur', 'm', 'حاجز', 'm'], 'heater': ['Chauffage', 'm', 'مدفأة', 'f'], 'carburetor': ['Carburateur', 'm', 'كاربراتير', 'm'], 'crossbeam': ['Traverse', 'f', 'عارضة', 'f'], 'distributor': ['Allumeur', 'm', 'موزع', 'm'],
    'pin': ['Axe', 'm', 'محور', 'm'], 'hood': ['Capot', 'm', 'غطاء المحرك', 'm'], 'shoe': ['Mâchoire', 'f', 'فك', 'm'], 'key': ['Clé', 'f', 'مفتاح', 'm'], 'booth key': ['Clé', 'f', 'مفتاح', 'm'], 'hanger': ['Suspente', 'f', 'علاقة', 'f'], 'block': ['Bloc', 'm', 'كتلة', 'f'],
    'p/s reservouir': ['Réservoir de direction assistée', 'm', 'خزان زيت التوجيه', 'm'], 'p/s hosing': ['Durite de direction assistée', 'f', 'خرطوم التوجيه', 'm'], 'wiper arm': ['Bras d’essuie-glace', 'm', 'ذراع المساحة', 'm'], 'wiper motor': ['Moteur d’essuie-glace', 'm', 'محرك المساحات', 'm'],
    'window regulator': ['Lève-vitre', 'm', 'رافعة الزجاج', 'f'], 'shift lever': ['Levier de vitesses', 'm', 'عصا السرعات', 'f'], 'parking brake cable': ['Câble de frein à main', 'm', 'كابل فرامل اليد', 'm'], 'switch, park brake': ['Commande de frein de parking', 'f', 'مفتاح فرامل الوقوف', 'm'],
  };
  // Précisions : [fr masculin, fr féminin, ar masculin, ar féminin].
  const W = {
    front: ['avant', 'avant', 'أمامي', 'أمامية'], back: ['arrière', 'arrière', 'خلفي', 'خلفية'], rear: ['arrière', 'arrière', 'خلفي', 'خلفية'], middle: ['central', 'centrale', 'وسطي', 'وسطية'], centre: ['central', 'centrale', 'وسطي', 'وسطية'], center: ['central', 'centrale', 'وسطي', 'وسطية'],
    left: ['gauche', 'gauche', 'يسار', 'يسار'], right: ['droit', 'droite', 'يمين', 'يمين'], l: ['gauche', 'gauche', 'يسار', 'يسار'], r: ['droit', 'droite', 'يمين', 'يمين'], 'l/r': ['gauche/droit', 'gauche/droite', 'يسار/يمين', 'يسار/يمين'],
    fl: ['avant gauche', 'avant gauche', 'أمامي يسار', 'أمامية يسار'], fr: ['avant droit', 'avant droite', 'أمامي يمين', 'أمامية يمين'], bl: ['arrière gauche', 'arrière gauche', 'خلفي يسار', 'خلفية يسار'], br: ['arrière droit', 'arrière droite', 'خلفي يمين', 'خلفية يمين'],
    rl: ['arrière gauche', 'arrière gauche', 'خلفي يسار', 'خلفية يسار'], rr: ['arrière droit', 'arrière droite', 'خلفي يمين', 'خلفية يمين'],
    upper: ['supérieur', 'supérieure', 'علوي', 'علوية'], up: ['supérieur', 'supérieure', 'علوي', 'علوية'], top: ['supérieur', 'supérieure', 'علوي', 'علوية'], lower: ['inférieur', 'inférieure', 'سفلي', 'سفلية'], down: ['inférieur', 'inférieure', 'سفلي', 'سفلية'], bottom: ['inférieur', 'inférieure', 'سفلي', 'سفلية'],
    outer: ['extérieur', 'extérieure', 'خارجي', 'خارجية'], inner: ['intérieur', 'intérieure', 'داخلي', 'داخلية'], interior: ['intérieur', 'intérieure', 'داخلي', 'داخلية'], side: ['latéral', 'latérale', 'جانبي', 'جانبية'],
    small: ['petit', 'petite', 'صغير', 'صغيرة'], big: ['grand', 'grande', 'كبير', 'كبيرة'], long: ['long', 'longue', 'طويل', 'طويلة'], short: ['court', 'courte', 'قصير', 'قصيرة'], normal: ['standard', 'standard', 'عادي', 'عادية'],
    black: ['noir', 'noire', 'أسود', 'سوداء'], white: ['blanc', 'blanche', 'أبيض', 'بيضاء'], yellow: ['jaune', 'jaune', 'أصفر', 'صفراء'], red: ['rouge', 'rouge', 'أحمر', 'حمراء'], silver: ['argent', 'argent', 'فضي', 'فضية'], grey: ['gris', 'grise', 'رمادي', 'رمادية'],
    chromed: ['chromé', 'chromée', 'كروم', 'كروم'], chrome: ['chromé', 'chromée', 'كروم', 'كروم'], crom: ['chromé', 'chromée', 'كروم', 'كروم'], carbon: ['carbone', 'carbone', 'كربون', 'كربون'], crystal: ['cristal', 'cristal', 'كريستال', 'كريستال'], led: ['LED', 'LED', 'LED', 'LED'], xenon: ['xénon', 'xénon', 'زينون', 'زينون'],
    complete: ['complet', 'complète', 'كامل', 'كاملة'], complate: ['complet', 'complète', 'كامل', 'كاملة'], electric: ['électrique', 'électrique', 'كهربائي', 'كهربائية'], electronic: ['électronique', 'électronique', 'إلكتروني', 'إلكترونية'],
    additional: ['additionnel', 'additionnelle', 'إضافي', 'إضافية'], auxiliary: ['auxiliaire', 'auxiliaire', 'مساعد', 'مساعدة'], hydraulic: ['hydraulique', 'hydraulique', 'هيدروليكي', 'هيدروليكية'], mechanical: ['mécanique', 'mécanique', 'ميكانيكي', 'ميكانيكية'],
    automatic: ['automatique', 'automatique', 'أوتوماتيكي', 'أوتوماتيكية'], manual: ['manuel', 'manuelle', 'يدوي', 'يدوية'], new: ['neuf', 'neuve', 'جديد', 'جديدة'], old: ['ancien modèle', 'ancien modèle', 'قديم', 'قديمة'], sport: ['sport', 'sport', 'رياضي', 'رياضية'],
    engine: ['moteur', 'moteur', 'المحرك', 'المحرك'], oil: ['d’huile', 'd’huile', 'الزيت', 'الزيت'], water: ['d’eau', 'd’eau', 'الماء', 'الماء'], fuel: ['de carburant', 'de carburant', 'البنزين', 'البنزين'], air: ['d’air', 'd’air', 'الهواء', 'الهواء'],
    brake: ['de frein', 'de frein', 'الفرامل', 'الفرامل'], clutch: ['d’embrayage', 'd’embrayage', 'القابض', 'القابض'], steering: ['de direction', 'de direction', 'التوجيه', 'التوجيه'], suspension: ['de suspension', 'de suspension', 'التعليق', 'التعليق'],
    door: ['de porte', 'de porte', 'الباب', 'الباب'], wheel: ['de roue', 'de roue', 'العجلة', 'العجلة'], radiator: ['de radiateur', 'de radiateur', 'الرادياتير', 'الرادياتير'], turbo: ['de turbo', 'de turbo', 'التيربو', 'التيربو'], gearbox: ['de boîte de vitesses', 'de boîte de vitesses', 'علبة السرعات', 'علبة السرعات'],
    cylinder: ['de cylindre', 'de cylindre', 'الأسطوانة', 'الأسطوانة'], tank: ['de réservoir', 'de réservoir', 'الخزان', 'الخزان'], bumper: ['de pare-chocs', 'de pare-chocs', 'الصدام', 'الصدام'], headlight: ['de phare', 'de phare', 'الضوء الأمامي', 'الضوء الأمامي'],
    stabilizer: ['de barre stabilisatrice', 'de barre stabilisatrice', 'عمود التوازن', 'عمود التوازن'], control: ['de commande', 'de commande', 'التحكم', 'التحكم'], axle: ['d’essieu', 'd’essieu', 'المحور', 'المحور'], vacuum: ['à dépression', 'à dépression', 'الفراغ', 'الفراغ'],
    gas: ['à gaz', 'à gaz', 'غازي', 'غازية'], pressure: ['de pression', 'de pression', 'الضغط', 'الضغط'], intake: ['d’admission', 'd’admission', 'السحب', 'السحب'], exhaust: ['d’échappement', 'd’échappement', 'العادم', 'العادم'],
    timing: ['de distribution', 'de distribution', 'التوقيت', 'التوقيت'], ignition: ['d’allumage', 'd’allumage', 'الإشعال', 'الإشعال'], cooling: ['de refroidissement', 'de refroidissement', 'التبريد', 'التبريد'], coolant: ['de liquide de refroidissement', 'de liquide de refroidissement', 'سائل التبريد', 'سائل التبريد'],
    transmission: ['de transmission', 'de transmission', 'ناقل الحركة', 'ناقل الحركة'], power: ['assisté', 'assistée', 'مساعد', 'مساعدة'], tow: ['de remorquage', 'de remorquage', 'السحب', 'السحب'], fog: ['antibrouillard', 'antibrouillard', 'الضباب', 'الضباب'],
    with: ['avec', 'avec', 'مع', 'مع'], without: ['sans', 'sans', 'بدون', 'بدون'], hole: ['trou', 'trou', 'ثقب', 'ثقب'], and: ['et', 'et', 'و', 'و'], 'a/t': ['de boîte auto', 'de boîte auto', 'العلبة الأوتوماتيكية', 'العلبة الأوتوماتيكية'],
    shock: ['d’amortisseur', 'd’amortisseur', 'ممتص الصدمات', 'ممتص الصدمات'], under: ['inférieur', 'inférieure', 'سفلي', 'سفلية'], inside: ['intérieur', 'intérieure', 'داخلي', 'داخلية'], outside: ['extérieur', 'extérieure', 'خارجي', 'خارجية'],
    aluminum: ['aluminium', 'aluminium', 'ألمنيوم', 'ألمنيوم'], aluminium: ['aluminium', 'aluminium', 'ألمنيوم', 'ألمنيوم'], plastic: ['plastique', 'plastique', 'بلاستيك', 'بلاستيك'], iron: ['métal', 'métal', 'حديد', 'حديد'], metal: ['métal', 'métal', 'معدني', 'معدنية'], metel: ['métal', 'métal', 'معدني', 'معدنية'],
    main: ['principal', 'principale', 'رئيسي', 'رئيسية'], high: ['haut', 'haute', 'عالي', 'عالية'], low: ['bas', 'basse', 'منخفض', 'منخفضة'], double: ['double', 'double', 'مزدوج', 'مزدوجة'], single: ['simple', 'simple', 'مفرد', 'مفردة'], two: ['double', 'double', 'مزدوج', 'مزدوجة'],
    rh: ['droit', 'droite', 'يمين', 'يمين'], lh: ['gauche', 'gauche', 'يسار', 'يسار'], modified: ['modifié', 'modifiée', 'معدل', 'معدلة'], fancy: ['décoratif', 'décorative', 'زينة', 'زينة'], bright: ['brillant', 'brillante', 'لامع', 'لامعة'], blue: ['bleu', 'bleue', 'أزرق', 'زرقاء'],
    body: ['de carrosserie', 'de carrosserie', 'الهيكل', 'الهيكل'], wiper: ['d’essuie-glace', 'd’essuie-glace', 'المساحات', 'المساحات'], washer: ['de lave-glace', 'de lave-glace', 'الغسالة', 'الغسالة'], window: ['de vitre', 'de vitre', 'الزجاج', 'الزجاج'],
    crankshaft: ['de vilebrequin', 'de vilebrequin', 'عمود الكرنك', 'عمود الكرنك'], camshaft: ['d’arbre à cames', 'd’arbre à cames', 'عمود الكامات', 'عمود الكامات'], temperature: ['de température', 'de température', 'الحرارة', 'الحرارة'], dust: ['anti-poussière', 'anti-poussière', 'الغبار', 'الغبار'],
    guide: ['de guidage', 'de guidage', 'التوجيه', 'التوجيه'], sealing: ['d’étanchéité', 'd’étanchéité', 'إحكام', 'إحكام'], master: ['principal', 'principale', 'رئيسي', 'رئيسية'], propeller: ['de transmission', 'de transmission', 'الكردان', 'الكردان'], manifold: ['de collecteur', 'de collecteur', 'المجمع', 'المجمع'],
    system: ['du système', 'du système', 'النظام', 'النظام'], throttle: ['de papillon', 'de papillon', 'الخانق', 'الخانق'], speed: ['de vitesse', 'de vitesse', 'السرعة', 'السرعة'], release: ['de débrayage', 'de débrayage', 'التحرير', 'التحرير'], parking: ['de stationnement', 'de stationnement', 'الوقوف', 'الوقوف'],
    turn: ['de clignotant', 'de clignotant', 'الإشارة', 'الإشارة'], signal: ['de signalisation', 'de signalisation', 'الإشارة', 'الإشارة'], return: ['de retour', 'de retour', 'الرجوع', 'الرجوع'], heater: ['de chauffage', 'de chauffage', 'التدفئة', 'التدفئة'], fresh: ['d’air frais', 'd’air frais', 'الهواء النقي', 'الهواء النقي'],
    blower: ['de pulseur', 'de pulseur', 'المروحة', 'المروحة'], motor: ['de moteur', 'de moteur', 'المحرك', 'المحرك'], solenoid: ['électromagnétique', 'électromagnétique', 'كهرومغناطيسي', 'كهرومغناطيسية'], corner: ['d’angle', 'd’angle', 'الزاوية', 'الزاوية'], license: ['de plaque', 'de plaque', 'اللوحة', 'اللوحة'],
    expansion: ['d’expansion', 'd’expansion', 'التمدد', 'التمدد'], spark: ['d’allumage', 'd’allumage', 'الإشعال', 'الإشعال'], oxygen: ['à oxygène', 'à oxygène', 'الأكسجين', 'الأكسجين'], glove: ['de boîte à gants', 'de boîte à gants', 'علبة القفازات', 'علبة القفازات'],
    sliding: ['coulissant', 'coulissante', 'منزلق', 'منزلقة'], swing: ['oscillant', 'oscillante', 'متأرجح', 'متأرجحة'], spray: ['de pulvérisation', 'de pulvérisation', 'الرش', 'الرش'], vent: ['d’aération', 'd’aération', 'التهوية', 'التهوية'], vents: ['d’aération', 'd’aération', 'التهوية', 'التهوية'],
    plating: ['chromé', 'chromée', 'مطلي', 'مطلية'], gray: ['gris', 'grise', 'رمادي', 'رمادية'], green: ['vert', 'verte', 'أخضر', 'خضراء'], kit: ['en kit', 'en kit', 'طقم', 'طقم'], set: ['en jeu', 'en jeu', 'طقم', 'طقم'], repair: ['de réparation', 'de réparation', 'الإصلاح', 'الإصلاح'],
    for: ['pour', 'pour', 'لـ', 'لـ'], wheel: ['de roue', 'de roue', 'العجلة', 'العجلة'], lights: ['de feux', 'de feux', 'الأضواء', 'الأضواء'], light: ['de feu', 'de feu', 'الضوء', 'الضوء'], lamp: ['de feu', 'de feu', 'الضوء', 'الضوء'], taillights: ['de feux arrière', 'de feux arrière', 'الأضواء الخلفية', 'الأضواء الخلفية'],
    rubber: ['en caoutchouc', 'en caoutchouc', 'مطاطي', 'مطاطية'], fender: ['d’aile', 'd’aile', 'الرفرف', 'الرفرف'], bonnet: ['de capot', 'de capot', 'غطاء المحرك', 'غطاء المحرك'], gear: ['de boîte', 'de boîte', 'العلبة', 'العلبة'], hydraulic: ['hydraulique', 'hydraulique', 'هيدروليكي', 'هيدروليكية'],
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/[，]/g, '，').replace(/\s+/g, ' ').trim();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const cache = { fr: {}, ar: {} };
  // Traduit un nom anglais du catalogue ; renvoie null si un mot n'est pas connu.
  function translate(label, lang) {
    const k = norm(label);
    if (!k || (lang !== 'fr' && lang !== 'ar')) return null;
    if (k in cache[lang]) return cache[lang][k];
    // « Tensioner, timing chain » : chaque partie se traduit, sinon le nom reste en anglais.
    const parts = k.split(/\s*[,，]\s*/).filter(Boolean);
    let out;
    if (parts.length > 1) { const t = parts.map((p) => one(p, lang)); out = t.every(Boolean) ? t.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ') : null; }
    else out = one(k, lang);
    cache[lang][k] = out;
    return out;
  }
  function one(k, lang) {
    let out = null;
    const words = k.replace(/[()]/g, ' ').trim().split(/\s+/);
    // Codes moteur ou valeurs (M278, N52/N53, 87℃…) en fin de nom : repris tels quels.
    const pass = [];
    while (words.length > 1 && /\d|℃/.test(words[words.length - 1])) pass.unshift(words.pop().toUpperCase());
    // « with hole » / « without hole » : précision en fin de nom.
    const tail = [];
    while (words.length > 1) {
      const last = words[words.length - 1], two = words.slice(-2).join(' ');
      if (two === 'with hole' || two === 'without hole') { tail.unshift(two); words.splice(-2); continue; }
      if (W[last] && !H[words.join(' ')] && (H[words.slice(0, -1).join(' ')] || /^(l|r|fl|fr|bl|br|rl|rr|l\/r|led|black|white|yellow|red|silver|grey|chromed|small|big|long|short|normal|upper|lower|outer|inner|middle|crom|carbon|crystal|left|right|up|down|top|bottom|gas|new|old|electric)$/.test(last))) { tail.unshift(last); words.pop(); continue; }
      break;
    }
    for (let i = 0; i < words.length && !out; i++) {
      const head = words.slice(i).join(' '), h = H[head];
      if (!h) continue;
      const pre = words.slice(0, i);
      if (pre.some((w) => !W[w])) break;
      const fem = lang === 'fr' ? h[1] === 'f' : h[3] === 'f';
      const q = (w) => W[w][(lang === 'fr' ? 0 : 2) + (fem ? 1 : 0)];
      const quals = pre.slice().reverse().map(q).concat(tail.map((t) => (W[t] ? q(t) : t.split(' ').map((x) => W[x][lang === 'fr' ? 0 : 2]).join(' '))));
      out = cap((lang === 'fr' ? h[0] : h[2]) + (quals.length ? ' ' + quals.join(' ') : '') + (pass.length ? ' ' + pass.join(' ') : ''));
    }
    return out;
  }
  // Recherche : noms anglais dont la traduction contient le texte tapé (pour chercher « plaquettes » ou « فحمات »).
  function englishFor(query, lang, labels) {
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = n(query).trim();
    if (q.length < 3) return [];
    return labels.filter((l) => { const t = translate(l, lang); return t && n(t).indexOf(q) !== -1; });
  }
  window.PARTS_I18N = { translate, englishFor, heads: H, words: W };
})();
