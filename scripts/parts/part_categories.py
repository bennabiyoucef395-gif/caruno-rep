"""
CARUNO — part categories from the catalogue article names (Désignation).

Ordered keyword rules (FR / EN / ZH) -> one category per article name. First match wins,
so specific rules come before generic ones ("FILTRE À HUILE" before "HUILE").
engine_dependent ("yes"/"no"): "yes" = the right part depends on the engine, so a customer who
does not know the engine is never told it fits. Rule of thumb: a part bolted to or driven by the
engine is "yes". When in doubt, "yes": a wrong "yes" only costs a "à confirmer" label, a wrong
"no" shows the part as fitting every engine of the model.

Articles without a usable name ("PIÈCE OEM 03L 145 771", "L", "OTHERS"...) are classified by the
VW-group OEM number when it has one (main group = first digit of the middle block), otherwise
they go to "Non classé", which is engine-dependent on purpose (safe side).
"""
import re, unicodedata

def norm(s):
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFKD", s.replace("’", "'").replace("ˈ", " ").replace("，", ","))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper()
    s = re.sub(r"\s*\b\d+\s*OF\s*411\b", "", s)           # "BRAKE DISC 3 OF 411"
    s = re.sub(r"(\d)OF\s*411", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()

Y, N = "yes", "no"
# (group, category, engine_dependent, regex) — regex on norm(name)
RULES = [
    # ---------------- Moteur : distribution ----------------
    ("Distribution", "Kit de distribution", Y, r"KIT DE DISTRIBUTION"),
    ("Distribution", "Tendeur / guide de distribution", Y,
     r"TENDEUR, (CHAINE|COURROIE) DE DISTRIBUTION|TENSIONER, TIMING|GUIDE PULLEY,TIMING|TIMING IDLER|时规惰轮|RAIL DE GUIDAGE|GUIDE RAIL|CHAIN ADJUSTER"),
    ("Distribution", "Courroie de distribution", Y, r"COURROIE DE DISTRIBUTION$"),
    ("Distribution", "Chaîne de distribution", Y, r"^CHAINE DE DISTRIBUTION|TIMING CHAIN$|^CHAINE$"),
    ("Distribution", "Déphaseur d'arbre à cames", Y, r"DEPHASEUR|CAMSHAFT ADJUSTER|ACTIONNEUR D'ARBRE A CAMES|REGULATING VALVE, CAMSHAFT"),
    ("Distribution", "Carter de distribution", Y, r"CARTER DE DISTRIBUTION"),
    # ---------------- Moteur : courroie accessoires ----------------
    ("Courroie d'accessoires", "Courroie d'accessoires", Y, r"COURROIE STRIEE|COURROIE TRAPEZOIDALE|V-RIBBED BELT"),
    ("Courroie d'accessoires", "Galet / tendeur de courroie", Y,
     r"GALET TENDEUR|TENDEUR DE COURROIE|BELT TENSIONER|TENSIONER PULLEY|TENSIONER BEARING|IDLER PULLEY|BELT ADJUSTER|ENGINE BELT TENSIONER"),
    ("Courroie d'accessoires", "Poulie de vilebrequin", Y, r"POULIE DE VILEBREQUIN"),
    # ---------------- Allumage / préchauffage ----------------
    ("Allumage", "Bougie d'allumage", Y, r"BOUGIE D'ALLUMAGE|^SPARK PLUG"),
    ("Allumage", "Bougie de préchauffage", Y, r"BOUGIE DE PRECHAUFFAGE|GLOW PLUG"),
    ("Allumage", "Bobine d'allumage", Y, r"BOBINE D'ALLUMAGE|IGNITION COIL|RUBBER SLEEVE FOR SPARK PLUG"),
    ("Allumage", "Faisceau / câbles d'allumage", Y, r"CABLES D'ALLUMAGE|IGNITION WIRE"),
    ("Allumage", "Allumeur / module d'allumage", Y, r"ALLUMEUR|MODULE D'ALLUMAGE|DISTRIBUTOR (CAP|ROTOR)"),
    # ---------------- Injection / alimentation ----------------
    ("Injection / carburant", "Injecteur", Y, r"INJECTEUR|FUEL INJECTOR"),
    ("Injection / carburant", "Pompe haute pression", Y, r"POMPE HAUTE PRESSION|POMPE A CARBURANT DE PRESSION HAUTE"),
    ("Injection / carburant", "Capteur / régulateur de pression carburant", Y,
     r"PRESSION DE CARBURANT|燃油压力传感器"),
    ("Injection / carburant", "Boîtier papillon", Y, r"BOITIER PAPILLON|THROTTLE POSITION|IDLE CONTROL VALVE|CABLE DE PAPILLON"),
    ("Injection / carburant", "Carburateur", Y, r"CARBURATEUR|CARBURETOR"),
    ("Injection / carburant", "Pompe à carburant", Y, r"POMPE A CARBURANT|FUEL PUMP(?! FILTER| UNION| GASKET)|COVER FUEL PUMP|GASOLINE PUMP|RELAIS, POMPE A CARBURANT"),
    ("Injection / carburant", "Jauge / flotteur de carburant", N, r"JAUGE DE CARBURANT|FUEL FLOAT|FUEL SENDER"),
    ("Injection / carburant", "Durite de carburant", N, r"DURITE DE CARBURANT|FUEL PUMP UNION"),
    ("Injection / carburant", "Bouchon / trappe de réservoir", N, r"BOUCHON DE RESERVOIR|TANK FLAP|FUEL FILLER DOOR"),
    ("Injection / carburant", "Canister à charbon actif", N, r"CANISTER|FUEL TANK VENTILATION"),
    # ---------------- Filtration ----------------
    ("Filtration", "Filtre à huile", Y, r"^FILTRE A HUILE$|^OIL FILTER$"),
    ("Filtration", "Filtre à air", Y, r"^FILTRE A AIR$|^AIR FILTER$"),
    ("Filtration", "Filtre à carburant", Y, r"FILTRE A CARBURANT|FUEL FILTER|FILTRE DE RESERVOIR DE CARBURANT|FUEL PUMP FILTER"),
    ("Filtration", "Filtre d'habitacle", N, r"FILTRE D'HABITACLE|A/C FILTER|ACTIVATED CARBON FILTER"),
    ("Filtration", "Filtre de boîte automatique", N, r"FILTRE DE BOITE|A/T FILTER"),
    ("Filtration", "Boîtier de filtre à air", Y, r"AIR FILTER (BOX|MOUNT)"),
    # ---------------- Suralimentation ----------------
    ("Suralimentation", "Turbocompresseur", Y,
     r"TURBOCOMPRESSEUR|TURBOCHARGER|ACTIONNEUR DE TURBO|TURBO OUTER|SUPERCHARGER"),
    ("Suralimentation", "Durite de turbo", Y, r"DURITE DE TURBO"),
    ("Suralimentation", "Refroidisseur de turbo (intercooler)", Y, r"REFROIDISSEUR DE TURBO"),
    # ---------------- Moteur : haut moteur ----------------
    ("Haut moteur", "Joint de culasse", Y, r"JOINT(S)? DE CULASSE|CYLINDER HEAD GASKET|HEAD GASKET SET|CYLINDER HEAD WATER SEAL"),
    ("Haut moteur", "Soupape / guide / joint de queue", Y,
     r"^VALVE( AVEC)?$|VALVE D'ECHAPPEMENT|INLET VALVE|VALVE MOTEUR|VALVE DE GUIDAGE|QUEUE DE SOUPAPE|VALVE GASKET|VALVE LOCK PLATE"),
    ("Haut moteur", "Culbuteur / poussoir", Y, r"CULBUTEUR$|^CULBUTEUR|TAPPET|PUSH ROD"),
    ("Haut moteur", "Culasse", Y, r"^CULASSE"),
    ("Haut moteur", "Arbre à cames", Y, r"^ARBRE A CAMES(?! DE BOITE)|BRIDGE BRACKET,CAMSHAFT"),
    ("Haut moteur", "Joint de cache-culbuteurs", Y, r"CACHE-CULBUTEURS|VALVE COVER (GASKET|RUBBER)|气门室垫圆圈"),
    ("Haut moteur", "Couvre-culasse", Y, r"COUVRE-CULASSE|VALVE COVER BAFFLE|汽缸盖堵盖"),
    # ---------------- Moteur : bas moteur ----------------
    ("Bas moteur", "Piston", Y, r"^PISTON$"),
    ("Bas moteur", "Segments de piston", Y, r"SEGMENTS DE PISTON|PISTON RINGS"),
    ("Bas moteur", "Bielle", Y, r"CON ROD|^CONNECTING ROD$|SMALL END BUSHES"),
    ("Bas moteur", "Coussinet / palier de vilebrequin", Y,
     r"COUSSINET|ROULEMENT METAL|METEL BEARING|CRANKSHAFT NEEDLE|THRUST WASHER|ROULEMENT MOTEUR"),
    ("Bas moteur", "Vilebrequin", Y, r"^VILEBREQUIN$"),
    ("Bas moteur", "Joint spi de vilebrequin", Y, r"JOINT SPI DE VILEBREQUIN|CRANKSHAFT OIL SEAL"),
    ("Bas moteur", "Chemise de cylindre", Y, r"CYLINDER LINERS|CYLINDER WATER PLUG|汽缸水堵盖"),
    ("Bas moteur", "Arbre d'équilibrage", Y, r"BALANCE SHAFT"),
    ("Bas moteur", "Volant moteur", Y, r"VOLANT MOTEUR"),
    ("Bas moteur", "Kit de réparation moteur", Y, r"KIT DE REPARATION MOTEUR|ENGINE RUBBER RING SET"),
    ("Bas moteur", "Support moteur", Y,
     r"SUPPORT MOTEUR|ENGINE MOUNT|PATTE DE FIXATION MOTEUR|SILENTBLOC MOTEUR|CAOUTCHOUC SUPERIEUR MOTEUR|发动机支架|BALANCER BRACKET|扭力支架座|FRONT ENGINE INSTALLATION"),
    # ---------------- Lubrification ----------------
    ("Lubrification", "Pompe à huile", Y, r"^POMPE A HUILE$|^OIL PUMP|INTERMEDIATE GEAR,OIL PUMP|CHAIN, OIL PUMP|OIL PUMP CHAIN"),
    ("Lubrification", "Carter d'huile / joint", Y, r"CARTER D'HUILE$|JOINT DE CARTER D'HUILE$|^OIL PAN|OIL SCRAPER"),
    ("Lubrification", "Refroidisseur d'huile moteur", Y,
     r"^REFROIDISSEUR D'HUILE$|^OIL COOLER|JOINT, REFROIDISSEUR D'HUILE|ECHANGEUR THERMIQUE|HEAT EXCHANGER"),
    ("Lubrification", "Support / boîtier de filtre à huile", Y, r"COUVERCLE DE FILTRE A HUILE|OIL FILTER SEAT|OIL SEAT"),
    ("Lubrification", "Capteur / manocontact d'huile", Y, r"NIVEAU D'HUILE|MANOCONTACT|OIL LEVEL SENSOR|TEMPERATURE D'HUILE"),
    ("Lubrification", "Jauge d'huile", Y, r"JAUGE D'HUILE|OIL DIPSTICK"),
    ("Lubrification", "Reniflard / séparateur d'huile", Y,
     r"RENIFLARD|SEPARATEUR D'HUILE|BREATHER|PCV VALVE|OIL-WATER SEPARATOR|BLOCK VENT VALVE"),
    ("Lubrification", "Tuyau / gicleur d'huile", N, r"TUYAU D'HUILE|TUYAU DE RETOUR D'HUILE|TUYAU DE REFROIDISSEMENT D'HUILE|OIL PIPE JOINT|OIL DRAIN PIPE|OIL NOZZLE|HIGH-PRESSURE OIL PIPE"),
    ("Lubrification", "Bouchon de vidange / remplissage", N, r"OIL DRAIN PLUG|SCREW DRAIN PLUG|OIL FILLER CAP"),
    # ---------------- Refroidissement ----------------
    ("Refroidissement", "Pompe à eau", Y, r"^POMPE A EAU$|^WATER PUMP"),
    ("Refroidissement", "Pompe à eau additionnelle", Y, r"POMPE A EAU ADDITIONNELLE|ADDITIONAL WATER PUMP"),
    ("Refroidissement", "Thermostat", Y, r"THERMOSTAT"),
    ("Refroidissement", "Durite de refroidissement", Y,
     r"DURITE DE (REFROIDISSEMENT|LIQUIDE|RADIATEUR|RESERVOIR D'EXPANSION)|DURITE D'EAU|COOLING WATER PIPE|WATER HOSE|BUSHING IRON HOSE|OVERFLOW PIPE"),
    ("Refroidissement", "Raccord d'eau", Y, r"RACCORD D'EAU|WATER CONECTOR|PLUG FOR WATER FLANGE|水通胶圈|^RACCORD$"),
    ("Refroidissement", "Radiateur", Y, r"^RADIATEUR|^RADIATOR$|BOUCHON DE RADIATEUR|PATTE DE FIXATION DE RADIATEUR|水箱卡子"),
    ("Refroidissement", "Vase d'expansion", N, r"VASE D'EXPANSION|EXPANSION TANK|RESERVOIR D'EAU ADDITIONNEL|附加水箱|KETTLE LID"),
    ("Refroidissement", "Ventilateur de radiateur", N,
     r"VENTILATEUR|RADIATOR FAN|HELICE DE VENTILATEUR|FAN BLADE|FAN CLUTCH|CARENAGE|COWLING, RADIATOR|FAN SUPPORT"),
    ("Refroidissement", "Sonde / contacteur de température", N, r"SONDE DE TEMPERATURE|TEMPERATURE SENSOR|INTERRUPTEUR DE TEMPERATURE|COOLANT LEVEL"),
    ("Refroidissement", "Robinet / vanne de chauffage", N, r"ROBINET DE CHAUFFAGE|VALVE DE REFROIDISSEMENT"),
    # ---------------- Admission / échappement ----------------
    ("Admission / échappement", "Débitmètre d'air", Y, r"DEBITMETRE|AIR MASS METER"),
    ("Admission / échappement", "Durite / conduit d'admission", Y,
     r"DURITE DE FILTRE A AIR|AIR FILTER HOSE|TUYAU D'ADMISSION|INTAKE PIPE|CONDUIT D'AIR D'ADMISSION|INTAKE RESONATOR|AIR PIPE CONNECTOR|^INTAKE$|CONTROL VALVE, AIR INTAKE"),
    ("Admission / échappement", "Collecteur d'admission / joint", Y, r"COLLECTEUR D'ADMISSION|COLLECTEUR EN JEU|INTAKE MANIFOLD"),
    ("Admission / échappement", "Collecteur d'échappement / joint", Y, r"COLLECTEUR D'ECHAPPEMENT|EXHAUST MANIFOLD"),
    ("Admission / échappement", "Vanne EGR", Y, r"VANNE EGR"),
    ("Admission / échappement", "Sonde lambda", Y, r"SONDE LAMBDA"),
    ("Admission / échappement", "Échappement / silencieux", Y, r"SILENCER|MUFFLER|TUYAU D'ECHAPPEMENT|SILENTBLOC D'ECHAPPEMENT"),
    ("Admission / échappement", "Électrovanne / valve de dépression", N,
     r"ELECTROVANNE|SHUT-?OFF VALVE|DEPRESSION|VALVE DE COMMANDE DE PRESSION|VACUUM TUBE|RESTRICTOR"),
    # ---------------- Électricité moteur ----------------
    ("Charge / démarrage", "Alternateur", Y, r"ALTERNAT|POULIE D'ALTERNATEUR|GENERATOR PULLEY|REGULATEUR DE TENSION|CARBON BRUSHES"),
    ("Charge / démarrage", "Démarreur", Y, r"DEMARREUR|STARTER|SOLENOID SWITCH|INTERRUPTEUR ELECTROMAGNETIQUE"),
    ("Charge / démarrage", "Batterie", N, r"BATTERY"),
    ("Capteurs", "Capteur de vilebrequin / arbre à cames", Y,
     r"CAPTEUR DE VILEBREQUIN|CAPTEUR D'ARBRE A CAMES|CAMSHAFT SENSOR|IGNITION PULSE|ECCENTRIC SHAFT SENSOR"),
    ("Capteurs", "Capteur ABS", N, r"CAPTEUR ABS|WHEEL SPEED SENSOR|ABS PUMP"),
    ("Capteurs", "Capteur de stationnement", N, r"CAPTEUR DE STATIONNEMENT|PARKING SENSOR"),
    ("Capteurs", "Capteur de pression (autre)", N, r"CAPTEUR DE PRESSION$|刹车压力传感器"),
    ("Capteurs", "Capteur (autre)", N, r"^CAPTEUR$"),
    # ---------------- Freinage ----------------
    ("Freinage", "Disque de frein", N, r"DISQUE DE FREIN|BRAKE DISC$"),
    ("Freinage", "Plaquettes de frein", N, r"PLAQUETTES DE FREIN|BRAKE PAD"),
    ("Freinage", "Mâchoires / tambour de frein", N, r"MACHOIRES DE FREIN|BRAKE SHOE|TAMBOUR DE FREIN|REAR BRAKE LEATHER|WHEEL CYLINDER"),
    ("Freinage", "Étrier de frein", N, r"ETRIER DE FREIN|BRAKE CALIPER|BRAKE CLASP"),
    ("Freinage", "Témoin d'usure de frein", N, r"TEMOIN D'USURE|BRAKE SENSOR"),
    ("Freinage", "Maître-cylindre de frein", N, r"MAITRE-CYLINDRE DE FREIN|BRAKE MASTER|CYLINDRE PRINCIPAL DE FREIN"),
    ("Freinage", "Flexible de frein", N, r"DURITE DE FREIN|刹车铜管|BRAKE BOOSTER PIPE"),
    ("Freinage", "Câble / levier de frein à main", N, r"CABLE DE FREIN|BRAKE CABLE|HANDBRAKE|HANDER BRAKE|TENDEUR DE FREIN"),
    ("Freinage", "Frein de stationnement électrique", N,
     r"ACTIONNEUR DE FREIN|BRAKE ACTUATOR|FREIN DE STATIONNEMENT|CYLINDRE DE FREIN|PARK BRAKE"),
    ("Freinage", "Pompe à vide (frein)", Y, r"POMPE A VIDE|VACUUM PUMP"),   # mounted on / driven by the engine
    ("Freinage", "Servo-frein", N, r"BRAKE BOOSTER"),
    ("Freinage", "Liquide / réservoir de frein", N, r"BRAKE FLUID"),
    ("Freinage", "Tôle de protection de disque", N, r"BRAKE DISC BAFFLE"),
    # ---------------- Embrayage / transmission ----------------
    ("Embrayage", "Kit d'embrayage", Y, r"KIT D'EMBRAYAGE|CLUTCH KIT"),
    ("Embrayage", "Disque d'embrayage", Y, r"DISQUE D'EMBRAYAGE|CLUTCH DISC"),
    ("Embrayage", "Mécanisme d'embrayage", Y, r"PLAQUE DE PRESSION|CLUTCH PRESSURE PLATE"),
    ("Embrayage", "Butée d'embrayage", N, r"BUTEE D'EMBRAYAGE|RELEASE BEARING|分离"),
    ("Embrayage", "Émetteur d'embrayage", N, r"EMETTEUR D'EMBRAYAGE|CLUTCH MASTER|CYLINDRE PRINCIPAL D'EMBRAYAGE"),
    ("Embrayage", "Récepteur d'embrayage", N, r"RECEPTEUR D'EMBRAYAGE|CLUTCH SLAVE|CLUTCH PUMP HOSE"),
    ("Embrayage", "Câble d'embrayage", N, r"CABLE D'EMBRAYAGE|CLUTCH CABLE|CLUTCH SHAFT"),
    ("Embrayage", "Pédale / pédalier", N, r"PEDAL"),
    ("Transmission", "Joint homocinétique", N, r"HOMOCINETIQUE|C\.?V JOINT(?! BOOT)|CV JOINT"),
    ("Transmission", "Soufflet de cardan", N, r"C\.?V BOOT|C\.V JOINT BOOT"),
    ("Transmission", "Flector", N, r"FLECTOR|PROPELLER SHAFT JIONT"),
    ("Transmission", "Arbre de transmission", N,
     r"ARBRE DE TRANSMISSION|DRIVESHAFT|FLANGED SHAFT|STUB SHAFT|UNIVERSAL JOINT|DEVIATING SHAFT|半轴卡环"),
    ("Transmission", "Palier central", N, r"PALIER CENTRAL|CENTRE BEARING|PROPELLER SHAFT SEAT"),
    ("Transmission", "Support de boîte de vitesses", N,
     r"SUPPORT DE BOITE|TRANSMISSION MOUNT|FIXATION DE BOITE|TRANSFER CASE RUBBER|波箱油底垫铁套"),
    ("Transmission", "Calculateur de boîte de vitesses", N, r"CALCULATEUR DE BOITE|TRANSMISSION CONTROL UNIT|GEARBOX CIRCUIT BOARD|A/T WIRING"),
    ("Transmission", "Refroidisseur d'huile de boîte", N, r"REFROIDISSEUR D'HUILE DE BOITE|GEAR OIL COOLER|TRANSMISSION COOLING"),
    ("Transmission", "Différentiel", N, r"DIFFERENTIAL|差速器"),
    ("Transmission", "Boîte de vitesses (pièces internes)", N,
     r"BOITE$|DE BOITE DE VITESSES$|DE BOITE(?! A GANTS)\b|CARTER D'EMBRAYAGE|POMPE A HUILE DE TRANSMISSION|TORQUE CONVERTER|^TRANSMISSION$|DQ381|GEARBOX OIL|SHIFT FINGER|DE TRANSMISSION$|^ROULEMENT DE BOITE"),
    ("Transmission", "Commande / levier de vitesses", N,
     r"CABLE DE VITESSES|(?<!ODOMETER )(?<!RAIN )GEAR|SELECTOR|SHIFT|LEVIER DE VITESSES|REVERSING LEVER|KNOB SHAFT|换挡胶套"),
    # ---------------- Suspension ----------------
    ("Suspension", "Suspension pneumatique (jambe / ressort)", N,
     r"JAMBE DE SUSPENSION PNEUMATIQUE|RESSORT PNEUMATIQUE|AIR SPRING(?! SOLENOID)|AIR STRUT"),
    ("Suspension", "Compresseur / valve de suspension pneumatique", N, r"SUSPENSION PNEUMATIQUE|AIR SUPPLY UNIT|AIR SPRING SOLENOID"),
    ("Suspension", "Butée / coupelle d'amortisseur", N,
     r"BUTEE D'AMORTISSEUR|COUPELLE|BOUCHON SUPERIEUR D'AMORTISSEUR|SHOCK PAD|RUBBER BUFFER,SHOCK|SHOCK BUFFER|BUTEE EN CAOUTCHOUC|SPRING PLATE|SPRING CAP|SPRING MOUNTING|SHOCK SNAP RING|SHOCK ABSORBER BRACKET"),
    ("Suspension", "Soufflet / kit de protection d'amortisseur", N, r"PROTECTION D'AMORTISSEUR|SOUFFLET D'AMORTISSEUR|BOOT FOR SHOCK|SHOCK ABSORBER REPAIR"),
    ("Suspension", "Amortisseur", N, r"AMORTISSEUR|SHOCK ABSORBER|DAPMER"),
    ("Suspension", "Ressort de suspension", N, r"COIL SPRING|^RESSORT$|固定弹簧"),
    ("Suspension", "Bras d'essieu arrière", N, r"BRAS D'ESSIEU|REAR AXLE (ARM|ROD)"),
    ("Suspension", "Bras de suspension", N, r"BRAS DE SUSPENSION|BRAS OSCILLANT|CONTROL ARM|PULL ARM|CONNECTING ARM|ARM SEAT"),
    ("Suspension", "Silentbloc de barre stabilisatrice", N, r"SILENTBLOC DE BARRE|STABILIZER BUSHING|REPARATION DE BARRE STABILISATRICE"),
    ("Suspension", "Biellette de barre stabilisatrice", N, r"BIELLETTE DE BARRE|STABILIZER LINK"),
    ("Suspension", "Barre stabilisatrice", N, r"^BARRE STABILISATRICE"),
    ("Suspension", "Silentbloc de suspension", N,
     r"SILENTBLOC|SUSPENSION BUSHING|ARM BUSHING|SWING ARM|PATTE DE FIXATION, BRAS|SUPPORT D'ESSIEU|ADJUSTING ECCENTRIC"),
    ("Suspension", "Rotule de suspension", N, r"ROTULE DE SUSPENSION|BALL JOINT"),
    ("Suspension", "Essieu / berceau", N, r"^ESSIEU"),
    ("Suspension", "Kit de train roulant", N, r"WHEEL .*-PIECE SET|后轮三件套|后轮穿销|AXLE PIN"),
    # ---------------- Direction ----------------
    ("Direction", "Rotule axiale de direction", N, r"ROTULE AXIALE|TIE ROD AXLE"),
    ("Direction", "Rotule de direction", N, r"ROTULE DE DIRECTION|TIE ROD END"),
    ("Direction", "Biellette de direction", N, r"BIELLETTE DE DIRECTION|TIE ROD ASSEMBLY|BIELLETTE CENTRALE|CENTER LINK|IDLER ARM"),
    ("Direction", "Soufflet de direction", N, r"SOUFFLET DE DIRECTION|STEERING BOOT|JOINTS DE DIRECTION"),
    ("Direction", "Crémaillère / boîtier de direction", N, r"BOITIER DE DIRECTION|STEERING BOX|转向器总成|STEERING (SHAFT|DAMPER|BALL)"),
    ("Direction", "Direction assistée (pompe / réservoir / durite)", N,
     r"POMPE HYDRAULIQUE|HYDRAULIC PUMP|POWER PUMP|DIRECTION ASSISTEE|DIRECTION PIPE|STEERIN OIL"),
    # ---------------- Roues ----------------
    ("Roues / moyeux", "Porte-moyeu", N, r"PORTE-MOYEU|WHEEL POT"),
    ("Roues / moyeux", "Roulement de roue", N, r"ROULEMENT DE (ROUE|MOYEU)|WHEEL BEARING|^ROULEMENT$"),
    ("Roues / moyeux", "Moyeu de roue", N, r"MOYEU DE ROUE|WHEEL HUB"),
    ("Roues / moyeux", "Vis / écrou de roue", N, r"VIS DE ROUE|WHEEL NUT|WHEEL BOLT|防盗螺丝"),
    ("Roues / moyeux", "Roue / pneu / capteur de pression", N, r"^ROUE$|TIRE|CACHE DE ROUE"),
    # ---------------- Éclairage ----------------
    ("Éclairage", "Glace de phare", N, r"GLACE DE PHARE|HEADLIGHT LENS"),
    ("Éclairage", "Lave-phare", N, r"LAVE-PHARE|HEADLIGHT WASHER|PULVERISATION DE PHARE"),
    ("Éclairage", "Correcteur / module de phare", N,
     r"CORRECTEUR DE PHARE|HEADLIGHT LEVEL|MODULE DE COMMANDE DE PHARE|HEADLIGHT DRIVER|INTERRUPTEUR DE PHARE"),
    ("Éclairage", "Support / moulure de phare", N,
     r"SUPPORT DE PHARE|HEAD LIGHT SEAT|HEADLIGHT BRACKET|REPARATION DE PHARE|MOULURE DE PHARE|CADRE DE PHARE|HEADLIGHT TRIM|BOUCHON DE PHARE"),
    ("Éclairage", "Cadre / moulure d'antibrouillard", N,
     r"CADRE D'ANTIBROUILLARD|FOG LIGHTS? FRAME|FOG LAMP FRAME|FOG LIGHT TRIM|DE FEU ANTIBROUILLARD|雾灯圈|这款产品没有-雾灯"),
    ("Éclairage", "Phare", N, r"^PHARE$|HEADLIGHT$|HEAD LAMP"),
    ("Éclairage", "Antibrouillard", N, r"ANTIBROUILLARD|FOGLIGHT"),
    ("Éclairage", "Feu arrière / feu stop", N, r"FEUX? ARRIERE|TAILLIGHT|FEU DE PARE-CHOCS ARRIERE|STOP LIGHT|CAR TAIL"),
    ("Éclairage", "Clignotant / répétiteur", N, r"^CLIGNOTANT|REPETITEUR|SIDE MIRROR POINTER"),
    ("Éclairage", "Feu de position / jour / latéral", N, r"FEU DE POSITION|CORNER LIGHT|FEU LATERAL|DAYTIME LIGHT|CATADIOPTRE"),
    ("Éclairage", "Ampoule / douille", N, r"BULB|氙气灯泡"),
    ("Éclairage", "Éclairage intérieur / plaque", N, r"LICENSE PLATE LIGHT|ROOF LIGHT|OVERHEAD LIGHT|FEU SUPERIEUR ARRIERE"),
    # ---------------- Climatisation / chauffage ----------------
    ("Climatisation / chauffage", "Compresseur de climatisation", Y, r"^COMPRESSEUR$|^COMPRESSOR"),
    ("Climatisation / chauffage", "Condenseur de climatisation", N, r"CONDENSEUR|AIR CONDITIONING CONDENSER"),
    ("Climatisation / chauffage", "Évaporateur / détendeur / déshydrateur", N,
     r"EVAPORAT|DETENDEUR|RECEIVER DRIER|A/C PRESSURE"),
    ("Climatisation / chauffage", "Pulseur d'air / résistance", N, r"PULSEUR"),
    ("Climatisation / chauffage", "Commande / aérateur de chauffage", N, r"HEATER CONTROLS|FRESH AIR VENTS|AIR OUTLET|AIR DUCT BAFFLE"),
    # ---------------- Électricité / commandes ----------------
    ("Électricité / commandes", "Commande de lève-vitre", N, r"COMMANDE DE LEVE-VITRE|WINDOW LIFTER SWITCH"),
    ("Électricité / commandes", "Commodo", N, r"COMMODO|TURN SIGNAL SWITCH|COMBINATION CONTROL"),
    ("Électricité / commandes", "Contacteur d'allumage / clé", N,
     r"INTERRUPTEUR D'ALLUMAGE|IGNITION LOCK|SERRURE DE DIRECTION|^CLE$"),
    ("Électricité / commandes", "Contacteur de feu stop", N, r"CONTACTEUR DE FEU STOP|BRAKE LIGHT SWITCH"),
    ("Électricité / commandes", "Interrupteur (autre)", N, r"INTERRUPTEUR|SWITCH"),
    ("Électricité / commandes", "Relais / fusible / calculateur", N,
     r"RELAIS|RELAY|FUSE|TRANSFORMER|CONTROLLER|MODULE DE COMMANDE|CALCULATEUR|WIRE HARNESS|BATTERY LINE"),
    ("Électricité / commandes", "Tableau de bord / compteur", N, r"INSTRUMENT PANEL|POINTER|ODOMETER|SPEEDOMETER|^DASHBOARD$"),
    ("Électricité / commandes", "Avertisseur (klaxon)", N, r"HORN"),
    ("Électricité / commandes", "Antenne", N, r"ANTENNA|天线"),
    # ---------------- Essuyage ----------------
    ("Essuyage", "Balai d'essuie-glace", N, r"BALAI|WIPER BLADE|JEU D'ESSUIE|KIT D'ESSUIE"),
    ("Essuyage", "Bras / moteur / tringlerie d'essuie-glace", N, r"ESSUIE-GLACE|WIPER|RAIN GEAR"),
    ("Essuyage", "Lave-glace (pompe / réservoir / gicleur)", N, r"LAVE-GLACE|WASHER"),
    # ---------------- Carrosserie ----------------
    ("Carrosserie", "Cache crochet de remorquage", N, r"CROCHET DE REMORQUAGE|TOW COVER"),
    ("Carrosserie", "Grille de pare-chocs", N, r"GRILLE DE PARE-CHOCS|BUMPER GRILL$|LOWER GRILLE|下中网盖"),
    ("Carrosserie", "Fixation / support de pare-chocs", N,
     r"(FIXATION|SUPPORT|PATTE|TRAVERSE) DE PARE-CHOCS|BUMPER (BRACKET|SUPPORT|FIXED BAR|FOAM)"),
    ("Carrosserie", "Moulure / becquet / protection de pare-chocs", N,
     r"(MOULURE|BAGUETTE BRILLANTE|BECQUET|GARNITURE|EMBOUT|PROTECTION INFERIEURE) DE PARE-CHOCS|BUMPER (GRILL (PLATING|TRIM|FRAME)|TRIM|BRIGHT|UNDER)|前杠|保险杠"),
    ("Carrosserie", "Pare-chocs", N, r"^PARE-CHOCS|^FRONT BUMPER$|^BUMPER$"),
    ("Carrosserie", "Calandre", N, r"CALANDRE|RADIATOR GRILL|HOOD GRILLE|GRILL TRIM"),
    ("Carrosserie", "Pare-boue / bavette", N, r"PARE-BOUE|FENDER LINING|BAVETTE|MUDGUARD"),
    ("Carrosserie", "Moulure / baguette d'aile ou de porte", N,
     r"MOULURE|BAGUETTE BRILLANTE|FENDER (CROM|TRIM)|CROM DOOR|DOOR PROTECTION|REAR TRIM STRIP|挡水饰条"),
    ("Carrosserie", "Aile", N, r"^AILE$|^FENDER$|SUPPORT D'AILE|GRILLE D'AILE|RADIATEUR D'AILE"),
    ("Carrosserie", "Charnière de capot", N, r"CHARNIERE DE CAPOT|BONNET HINGE"),
    ("Carrosserie", "Câble / serrure de capot", N, r"(CABLE|SERRURE) DE CAPOT|HOOD (RELEASE|HANDLE)|BONNET LOCK"),
    ("Carrosserie", "Vérin de capot", N, r"VERIN DE CAPOT|GAS SPRING BONNET|HOOD SPRING"),
    ("Carrosserie", "Insonorisant de capot", N, r"INSONORISANT"),
    ("Carrosserie", "Capot", N, r"^CAPOT$|^BONNET$"),
    ("Carrosserie", "Vérin de hayon", N, r"VERIN DE HAYON|GAS SPRING (BOOT|RUBBER)"),
    ("Carrosserie", "Serrure de hayon / coffre", N, r"SERRURE DE HAYON|TRUNK LOCK|REAR LID"),
    ("Carrosserie", "Glace de rétroviseur", N, r"GLACE DE RETROVISEUR|SIDE MIRROR GLASS"),
    ("Carrosserie", "Coque / cadre de rétroviseur", N, r"COQUE DE RETROVISEUR|SIDE MIRROR (FRAME|INTERIOR)|REVERSING MIRROR TRIM"),
    ("Carrosserie", "Rétroviseur", N, r"RETROVISEUR|SIDE MIRROR"),
    ("Carrosserie", "Bas de caisse / marchepied", N,
     r"BAS DE CAISSE|SIDE SKIRT|BODY BOARD|ENTRY STEP|PROTECTION LATERALE|DOOR SILL"),
    ("Carrosserie", "Tablier / traverse de radiateur", N, r"TABLIER AVANT|TRAVERSE DE RADIATEUR|RADIATOR CROSSBEAM|FRONT COWLING"),
    ("Carrosserie", "Conduit d'air / protection sous moteur", N,
     r"CONDUIT D'AIR|ISOLANT PHONIQUE|NOISE INSULATION|HEAT INSULATION|PROTECTION DE RADIATEUR|WATER DEFLECTOR|CACHE MOTEUR|DEFLECTEUR MOTEUR|PROTECTION DE CARROSSERIE"),
    ("Carrosserie", "Monogramme / emblème", N, r"MONOGRAMME|EMBLEM|LOGO"),
    ("Carrosserie", "Becquet / aileron", N, r"^BECQUET$|REAR WING"),
    ("Carrosserie", "Porte / vitre", N, r"车门"),
    ("Carrosserie", "Support de plaque", N, r"SUPPORT DE PLAQUE"),
    # ---------------- Ouvrants ----------------
    ("Ouvrants", "Lève-vitre", N, r"LEVE-VITRE|WINDOW LIFTER|升降器马达"),
    ("Ouvrants", "Serrure de porte", N, r"SERRURE|DOOR LOCK|CENTRAL LOCKING|STRIKER|^LATCH$"),
    ("Ouvrants", "Poignée de porte / de maintien", N,
     r"POIGNEE|DOOR HANDLE|HANDLE (COVER|SEAT)|BOOTH HANDES|CABLE D'OUVERTURE DE PORTE|CLE DE PORTE|GLOVE BOX HANDLE"),
    ("Ouvrants", "Charnière / arrêt de porte", N, r"CHARNIERE|DOOR (SLIDING|CHECK|LIMIT)|GALET DE PORTE|DOOR NUB|DOOR FRAME BRACKET|DOOR MART"),
    # ---------------- Habitacle ----------------
    ("Habitacle", "Airbag", N, r"AIRBAG|AIR BAG"),
    ("Habitacle", "Garnitures / accessoires d'habitacle", N,
     r"BOITE A GANTS|ARMREST|SEAT (ADJUSTMENT|CLAMP)|SUNROOF|SUNSHADE|CAR MAT|CIGARETTE|STOWAGE|DASHBOARD FRAMEWORK|SEAT FRAME|尾箱踏板|TRIMMING COVER|TRAY GLUE"),
    # ---------------- Génériques (en dernier) ----------------
    ("Divers", "Joint spi (autre)", N, r"^JOINT SPI$|OIL SEAL|RADIAL SHAFT SEAL|SIEGE DE JOINT D'HUILE"),
    ("Divers", "Joint / bague d'étanchéité", N,
     r"ETANCHEITE|SEALING GASKET|OTHER GASKET|SEAL O RING|BOUCHON EN CAOUTCHOUC|密封修包|胶垫|RUBBER PAD|PLUG COVER|FLANGE (COVER|LID)|DOUILLE DE GUIDAGE|锥形环|BAGUE"),
    ("Divers", "Patte / support de fixation", N,
     r"PATTE DE FIXATION|MOUNT BRACKET|^BRACKET|SUPPORT EN CAOUTCHOUC|COOLER BRACKET|PRESSURE CONVERTER|SAMPLE HOLDER|BATTERY HOLDER|FIX PLATE|COVER PLATE|^CACHE$"),
    ("Divers", "Visserie / clips", N,
     r"^VIS$|SCREW|^NUT$|RIVET|CLIP|BOLT REPAIR|固定卡|FIX PIN|THROUGH PIN|^M\d+X\d+$|螺丝"),
    ("Divers", "Fluides / graisses", N, r"GREASE|ANTIFREEZE"),
    ("Divers", "Actionneur / valve (autre)", N, r"^ACTIONNEUR$|^VALVE"),
]
COMPILED = [(g, c, e, re.compile(rx)) for g, c, e, rx in RULES]
UNCLASSIFIED = ("Divers", "Non classé", Y)

# VW-group part numbers "03L 145 771 A": the middle block's first digit is the main group.
RE_VAG_OEM = re.compile(r"^[0-9A-Z]{3} ?(\d)(\d)\d ?\d{3}\b")
VAG_GROUPS = {
    "0": ("Accessoires", N), "1": ("Moteur", Y), "2": ("Carburant / échappement / clim", Y),
    "3": ("Boîte de vitesses", N), "4": ("Train avant / direction", N), "5": ("Train arrière", N),
    "6": ("Roues / freins", N), "7": ("Leviers / pédales", N), "8": ("Carrosserie", N),
    "9": ("Électricité", N),
}
VAG_ENGINE_ELECTRICS = {"90", "91"}       # 903 alternator, 905 ignition, 906/907 engine control, 911 starter

def vag_group(oem):
    m = RE_VAG_OEM.match(norm(oem)) if oem else None
    if not m:
        return None
    main, sub = m.group(1), m.group(1) + m.group(2)
    if sub in VAG_ENGINE_ELECTRICS:
        return ("Sans désignation", f"Sans désignation – électricité moteur (VAG {main}xx)", Y)
    label, eng = VAG_GROUPS[main]
    return ("Sans désignation", f"Sans désignation – {label.lower()} (VAG {main}xx)", eng)

def categorize(name, oem=None):
    """(group, category, engine_dependent) for an article name; the OEM number is the fallback."""
    n = norm(name)
    if not n.startswith("PIECE OEM"):
        for g, c, e, rx in COMPILED:
            if rx.search(n):
                return g, c, e
    return vag_group(oem) or UNCLASSIFIED
