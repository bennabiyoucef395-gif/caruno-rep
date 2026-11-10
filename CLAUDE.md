# CARUNO ERP — notes for Claude

Dolibarr 24 + MariaDB 11.4 in Docker. Instances live outside the repo and OneDrive:
`C:\Users\TRETEC\caruno-data\instances\<name>\instance.env` (secrets, never in git).
`hanout-vw` = main instance (port 8080), `test` = test instance (container `caruno-test-db-1`, port 8081).
Design reference: `doc/02-professional-erp-blueprint.md`.

## Shop data and tests
- **Automatic tests never write to the shop's Dolibarr.** The counter app's browser tests (caruno-app `web/tools/e2e*.mjs`)
  default to the test instance (`http://localhost:8081`, accounts in `instances/test/test-users.env`). The test Dolibarr is
  built like a shop: `APP_CONTAINER=caruno-test-dolibarr-1` for `10-configure.sh`, `16-counter-client.sh`,
  `20-import-products.sh`, `25-import-photos.sh`, `30-product-names.sh`; `HANOUT_ENV_FILE=…/instances/test/instance.env` for `15-roles.sh`.
  Tests find their fixtures by reference / marker (TEST-STK-001/002, `caruno:comptoir`), never by fixed id.
- Before changing shop data: `scripts/backup-instance.sh <label>` (verified). Test data cleaned from the shop on
  2026-11-07 (parts to the CARUNO bin, test clients closed); list in the `pre-cleanup` backup folder.
- Counter customer: marked `ref_ext = caruno:comptoir` (`provisioning/16-counter-client.sh`), carries the shop profile
  (`caruno-profil.json`: name, address, logo, WhatsApp, RC/NIF/AI/NIS). The front finds it by this marker (fallback id 5) and
  the Caisse / Banque accounts by ref CAISSE / BANQUE. Never close or rename it to a test name.
- Product names: Dolibarr label = French name (`provisioning/30-product-names.sh`, names from `scripts/parts/product_names.py`:
  catalogue French designation + the supplier label's details translated — side, size, engine code), Arabic name in extra field
  `nom_ar`, original supplier label in `nom_fournisseur` (`30-product-names.sh restore` puts it back). Labels edited by hand
  are never overwritten.
- Shop logo: `C:\Users\TRETEC\caruno-data\branding\city-makoudi-2\` (SVG + PNG); the 240 px PNG is in the shop profile.
- Part locations, one per warehouse: first warehouse (Magasin) in extra field `emplacement`, the others in `emplacements`
  ("Réserve=R-03 | Dépôt 2=B-12"), written by the part form, shown under the reserve quantity in Pièces and at the till.
- Counter app on http://localhost:8082: served by Docker (`infra/app/docker-compose.yml`, project `caruno-app`,
  container `caruno-app-web-1`, restarts with Windows) from the caruno-app worktree's `web/` folder — a rebuilt
  `index.html` is live at once. Don't start `serve.mjs` on 8082 by hand (tests use their own ports).
  Desktop / Start menu icon "CARUNO" (Edge app window, shop logo): `scripts/desktop/install-desktop.ps1`.
- Purchase prices stay on the server: Dolibarr add-on `dolibarr-modules/caruno` (hook `beforeApiCall` → Restler
  `onCompose`) removes costs (cost_price, pmp, pa_ht, margins, fourn_*, stock movement price, supplier price lists)
  from API answers for users without "Read supplier prices" (sellers). The till's "vente à perte" warning for them asks
  `POST caruno/belowcost` (yes / no per line, ≤ 60 lines, same cost rule as the app; the till computes it itself when
  the module is absent). Install / update: `provisioning/40-caruno-module.sh`
  (`APP_CONTAINER` picks the instance; re-run after editing the module). Test: `node provisioning/tests/api-costs.mjs`.
  It is the only PHP add-on (user's choice 2026-11-08); extend it rather than adding others.
- Visible wording: staff never see the engine's name ("Dolibarr"); caruno-app `web/tools/wording.mjs` rewrites texts and the
  i18n keys. A new message says what happened ("Pièce enregistrée."), not where.

## Parts catalogue (`caruno_parts`)

Shared reference data (vehicles, parts, OEM numbers, fitment), in its own database `caruno_parts`,
not in Dolibarr (blueprint §B). Today only on the **test** instance.

- Build from scratch: `scripts/parts/build.sh all` (or one step: `data schema base categories engines links functions test`).
  Source: `C:\Users\TRETEC\Documents\bdd pieces auto` (catalogue-pieces.xlsx, modeles.xlsx);
  generated files: `C:\Users\TRETEC\caruno-data\parts-build` (review files `moteurs_a_verifier.csv`,
  `moteurs_non_prouves.csv`, `a_verifier.xlsx`). The script refuses a non-test container unless `PARTS_FORCE=1`.
- Rule tests: `scripts/parts/tests.sh` (must pass after any change to the rules, the SQL or the data).
- Read-only account `caruno_parts` (SELECT, EXECUTE); password `PARTS_DB_PASSWORD` in the test `instance.env`.
- Database collation `utf8mb4_uca1400_ai_ci` (server default): another collation breaks text comparisons
  for utf8mb4 clients. It is accent-insensitive: "Filtre a huile" finds "Filtre à huile".
- `articles.ref` = Dolibarr `llx_product.ref` (TiBAO number): the join key between catalogue and shop.

### Part categories (`scripts/parts/part_categories.py` + reviewed lists)
- **Never create a category without listing it first.** The reviewed lists are the only place a category exists:
  `scripts/parts/categories.csv` (group, name_fr, name_en, name_ar, synonyms = counter words, engine_dependent),
  `category_groups.csv` (the 28 parent groups, FR/EN/AR), `article_categories.csv` (articles classified by hand).
  `caruno_import.py` stops the build when a rule names a category that is not listed. To add or change one:
  write it in the review file, get the shop's OK, then `import_review.py <categories_review.xlsx> scripts/parts`.
  Review file + history: `C:\Users\TRETEC\caruno-data\parts-build\categories\categories_review.xlsx` (reviewed 2026-11-10).
- Two levels in the database: `part_groups` (parent) → `part_categories` (child, `group_id`; `group_name` kept).
  The export (`index.json`) carries name_en, name_ar, synonyms, group_en, group_ar.
- engine_dependent comes from `categories.csv` (wins over the Y/N in the rules). Clutch: kit, disc, pressure plate,
  release bearing, slave cylinder, cable = yes; master cylinder (pedal side) = no.
- Unsure articles are never guessed: they stay in "Non classé" (engine-dependent, so never "compatible" without the
  engine; a NULL category would hide the article from `compatible_parts`). The review file lists them with 3 suggestions.
- One category per article, from its name (FR/EN/ZH keyword rules, first match wins, specific before generic).
  Position/packaging variants are the same category ("Disque de frein" = "Disque de frein avant" = "BRAKE DISC").
- Articles without a usable name ("PIÈCE OEM 03L 145 771", "L", "OTHERS") are classified by the VW-group OEM
  number (middle block's first digit = main group: 1 engine, 2 fuel/exhaust, 6 wheels/brakes, 8 body...),
  also read from the name when the N° OEM column is empty. The rest is "Non classé" (134 articles on 2026-11-10).
- `engine_dependent = 1` when the right part depends on the engine: filters (oil, air, fuel), spark and glow
  plugs, ignition coils, timing kit/belt/chain/tensioners, injectors, turbo, water pump, pistons and rings,
  valves, cylinder head gasket, alternator, starter — and every part bolted to or driven by the engine
  (head, camshaft, crankshaft, gaskets, oil and cooling circuit incl. coolant hoses, intake/exhaust, sensors
  of the engine, engine mounts, clutch, fuel pump, A/C compressor, brake vacuum pump, radiator fan, expansion
  tank, power-steering pump, engine vacuum solenoids, plastic engine cover). "Non classé" too.
- When in doubt, engine-dependent: a wrong "yes" only gives "à confirmer", a wrong "no" shows the part as
  fitting every engine of the model. Cabin filter, gearbox filter, brakes, suspension, steering, body,
  lighting: not engine-dependent (brake size depends on the brake system, not on the engine).

### Engines and vehicle types (`scripts/parts/engines.py`)
- `engines`: one row per engine as sold ("2.0 TDI"), shared by all models. `vehicle_types` = model + engine.
- Fuel from the note: TDI / TD / D / CRDI / CDI / SDI = diesel; TSI / TFSI / FSI / T / 16V / 20V / i / VR6 = essence;
  V6 / V8 say nothing about the fuel; a bare displacement ("2.0") = fuel unknown (generic engine).
- VW group, model from 2007 on: T / TSI / TFSI are one turbo petrol family (TSI for VW/Skoda/Seat, TFSI for
  Audi), D / TD / TDI are TDI. Older "1.8T" stays "T".
- An engine written after a list of models is true for the list, not for each model. A model + engine pair
  becomes a vehicle type only when **proven**: written for that model alone, or repeated on at least 4
  different parts (`MIN_PARTS`). Unproven rows stay at model level with their note.
- `fitment.model_id` is always set; `vehicle_type_id` is set when the engine is proven. Source, confidence
  and the original note are kept on every row. A composite key forbids a vehicle type of another model.
  State on 2026-11-10: 89 engines, 428 vehicle types, 34,279 fitment rows, 3,019 at vehicle-type level,
  899 with an engine note kept at model level (unproven).
- Engine options for customers (`get_engine_options`) come only from these vehicle types (our catalogue notes,
  later seller confirmations), **never from vehicle_ref / vehicle-makes-models** (reference only, see below).
- Checked with Golf 7 and A4 B8 (`sql/90_checks.sql`, `tests.sh`): e.g. Golf 7 + 2.0 TDI gets no oil filter (the
  catalogue lists Golf 7 filters for the 1.2 / 1.4 TSI only); "Je ne sais pas" + oil filter = `moteur_requis`;
  A4 B8 + 2.0 TFSI + filter known at model level = `a_confirmer`; brake discs/pads = `compatible` either way.

### What the customer sees (`scripts/parts/sql/40_functions.sql`)
- `get_engine_options(model_id)` → JSON list of the model's vehicle types, always ending with
  `{"vehicle_type_id": null, "label": "Je ne sais pas"}`. A generic engine ("2.0 (essence ou diesel)") is
  offered only when the model has no specific engine of that displacement.
- `CALL compatible_parts(model_id, vehicle_type_id, filter)` — `vehicle_type_id` NULL = "Je ne sais pas";
  filter = a category group ("Freinage"), a category ("Filtre à huile") or NULL. Status per part:
  - `compatible`: the source names this vehicle type, or the part is not engine-dependent;
  - `a_confirmer`: engine-dependent part known at model level only (shown with its source and confidence),
    part listed for a generic engine of the same displacement, non engine-dependent part listed for another
    engine, or confidence `unverified` (never "compatible", blueprint rule);
  - `moteur_requis`: engine-dependent part while the engine is unknown — **never shown as compatible**,
    the front asks for the engine instead.
  Engine-dependent parts listed for another engine are not returned.
### Export for the front (`scripts/parts/export.sh`, step `export` of build.sh)
The front talks only to Dolibarr (no backend, no PHP module), so it cannot call these functions. It reads
static JSON files built from them instead (`$PARTS_OUT/json`; `PARTS_JSON_DIR=<dir>` also copies them):
- `index.json`: categories (`engine_dependent`) and models (maker, name, generation, years, `file`).
- `models/<id>.json`: `engines` = `get_engine_options(id)` as is; `parts` = `{ref, name, category_id,
  status: {"<vehicle_type_id>": ..., "unknown": ...}, evidence, oem}`. `unknown` = "Je ne sais pas". A part missing
  for an option is not compatible with it. Statuses come from `compatible_parts()`, so files and database agree.
- Price, stock and photo stay in Dolibarr: join on `ref`. Re-export after every rebuild of `caruno_parts`.
- Used by the counter app (worktree `C:/Users/TRETEC/dev/caruno-app`, Catalogue screen):
  `PARTS_JSON_DIR=C:/Users/TRETEC/dev/caruno-app/web/data/parts scripts/parts/export.sh`.

## Vehicle reference data (`vehicle_ref`)

Outside reference data in its own database `vehicle_ref`, **never mixed into `caruno_parts` tables** (caruno_parts.models
only gets reference columns). Today only on the **test** instance. Build: `scripts/vehicle-ref/build.sh all`
(steps `download schema vdb vmm nhtsa test`; refuses a non-test container unless `VREF_FORCE=1`). Downloads and review
files: `C:\Users\TRETEC\caruno-data\vehicle-ref` (`download/<source>/<release>`, `review/`). Table `sources` = release,
licence and checksum of what is loaded. The read-only account `caruno_parts` has SELECT on it.
- `vdb_*` = VehiclesDB (github.com/vehiclesdb/vehiclesdb, CC-BY 4.0), `catalog.sqlite` car rows only. Model level only
  (no generations, no years); model id = `<make>/<slug>`. Vans (Sprinter, Transporter) are not in the car rows.
  Credit required wherever it is used: "Vehicle data by VehiclesDB (vehiclesdb.com)", with a link. Shown in the app
  on "Mon profil" (card "À propos", next to "Paramètres du magasin"; caruno-app `web/tools/patch-from-mockup.mjs`).
  Keep it if the page is reworked; add it to any public page that shows VehiclesDB data.
- `vmm_*` = vehicle-makes-models (github.com/gor3a/vehicle-makes-models), tables as is. Data ODbL (share-alike) copied
  from autoevolution.com: **internal only** — used to check our generation years, never shown to customers, never
  published. **Customer engine options come from our own data (catalogue notes + confirmed engines), never from vmm.**
- Reference engines (views `reference_engines`, `reference_engine_summary`, `sql/40_reference_engines.sql`, step
  `views`): the vmm engines of each catalogue model through `model_links`, as "2.0 TDI (diesel)" + power range +
  `in_catalogue` (our vehicle_types already offer that size and fuel). **Reference only: never an engine option,
  never a fitment.** vmm's columns are often wrong ("2.0L TDI" filed as Gasoline 1395 cc): size and type are read
  from the label first (VW group "2.0L TDI", BMW "320d", Mercedes "C 220 CDI"), with our fuel rules.
  Step `missing` writes `review/moteurs_manquants.csv`: reference engines our catalogue does not offer (the catalogue
  rarely names the engine for BMW, Mercedes, Seat, Toyota).
- `nhtsa_wmi` = NHTSA vPIC WMI codes (public domain) for the makes in `scripts/vehicle-ref/nhtsa_wmi.py`; the `nhtsa`
  step also regenerates `scripts/parts/wmi_nhtsa.py`. Few non-US makes (no Dacia, Chery...).
- VIN decoder: `scripts/parts/vin_decoder.py` (moved from the source folder). The hand-written `WMI` table is checked
  first and always wins (Algerian makes are added there by hand from real VINs), then `wmi_nhtsa.py`, then the 2-letter
  prefixes. Try it: `scripts/parts/vin.sh <VIN>`.
- Model links: `scripts/vehicle-ref/link_models.py` proposes `review/model_links_a_verifier.csv` (VehiclesDB model,
  main vmm generation + every matched vmm generation) and `review/annees_differences.csv` (our years vs theirs).
  The reviewed list is `scripts/parts/model_links.csv` (keyed by maker + model + generation, exact match; edit it by
  hand, Classe G deliberately unlinked). `scripts/parts/build.sh links` writes it at every rebuild:
  `caruno_parts.models.vdb_model_slug` / `vmm_generation_id` (reference columns, no foreign key) and
  `vehicle_ref.model_links` (every matched generation, `is_main`). Checked by `scripts/parts/tests.sh`.
  Year check (2026-11-10): our years kept; the 25 differences come from split or incomplete vmm rows.

## Vehicles API (CARUNO add-on, test instance)
Decided 2026-11-10: the API lives in the add-on (`dolibarr-modules/caruno`, Restler, prefix `/api/index.php/caruno/`),
no separate backend. One shop for now, no customer accounts (the seller saves the vehicle on the customer record);
answers are shaped for several shops later (list of shops per part).
- The add-on reads `caruno_parts` (SELECT, EXECUTE) and `vehicle_ref` (SELECT) through Dolibarr's own database account:
  `provisioning/41-caruno-catalogue-access.sh` (test only unless `CARUNO_FORCE=1`). No catalogue there -> 503.
- VIN decoder in PHP (`class/caruno_vin.class.php`) = port of `scripts/parts/vin_decoder.py`, which stays the only source:
  `scripts/parts/vin_rules.py` writes `data/vin_rules.json` (+ `vin_cases.json`, the Python answers for the test VINs);
  `40-caruno-module.sh` regenerates them before installing. Re-run the installer after changing the decoder.
- **Every VIN search is saved** (`llx_caruno_vin_lookup`, Dolibarr database, so in the shop backup): VIN, seller,
  customer, decoder result, then the model / engine the seller chose (`.../choice`). Internal data: a VIN identifies
  a car and its owner; never published. Models stored by name (`VW|Golf 7|`), never by caruno_parts id (changes at rebuild).
  Customer vehicles: `llx_caruno_vehicle`. The installer runs the module's `init()` so new tables of `sql/` are created.
- Routes so far: `GET vehicles/status` ({vin, catalogue}: the app shows its VIN field only when both are true),
  `POST vehicles/decode`, `POST vehicles/decode/{id}/choice` (by ids, or by name: `model_key` + engine option label,
  which is what the app sends), `GET vehicles/lookups` (admin),
  `GET models/{id}/engines` (= `get_engine_options`), `POST|GET customers/{id}/vehicles` (Dolibarr rights
  societe creer / lire). A saved vehicle answers with its *current* catalogue ids (`model_id`, `vehicle_type_id`, found
  again by name after a rebuild); a car not in the catalogue keeps its VehiclesDB model (`in_catalogue` false).
  Test customer "TEST VEHICULES (tests API)", created once by the test, found by name.
- `GET vehicles/{id}/parts?category=&all=`: statuses from `compatible_parts()` (never re-implemented), label from the
  best evidence row: confirmed = "Compatible", probable for this engine = "Compatible (moteur)", probable for the model
  = "Compatible (modèle)", `a_confirmer` = "À confirmer"; `moteur_requis` not listed (`engine_needed` count + message
  "Précisez le moteur…"); `unverified` not shown. Shops = same rule as the vitrine: `en_ligne` = 1, for sale,
  stock > 0, public price = latest level-1 price (prices by level are on) else base price; 0 = "Sur devis". Never the
  exact stock nor a purchase price. Default: only parts a shop has; `all=1` also the others (shops empty).
  Car not in the catalogue -> 200 with an empty list. Dolibarr (utf8mb4_unicode_ci) and the catalogue (uca1400_ai_ci)
  have different collations: never join them directly, pass the refs as literals.
  The test publishes 2 Golf 7 brake parts with stock (level-1 price written like the app, `multiprices`) and restores them.
- Counter app (caruno-app `web/tools/actions-vehicle.js`): "VIN (n° de châssis)" field in the Catalogue's vehicle box.
  Exact match -> model selected, engine stays "Je ne sais pas"; several -> buttons; maker not in the catalogue -> message;
  every model / engine the seller then picks is saved with the search. Hidden when the server lacks the routes (the
  shop server today), so the live app on 8082 is unchanged for the shop. Browser test: `web/tools/e2e-vin.mjs` (test 8081).
  Node for the browser tests: `C:\Users\TRETEC\tools\node-v22.23.4-win-x64\node.exe` (not on PATH).
  Test: `provisioning/tests/vehicles-api.mjs` (Golf 7, A4 B8, W204, Skoda, BMW, Renault Arkana, Dacia, NHTSA, unknown, typos).

## Online shop (vitrine)
- App page "Magasin en ligne" (caruno-app `web/tools/actions-enligne.js`): product extra field `en_ligne`
  (1 = online; created by `provisioning/12-product-extrafields.sh`), price required to go online, shop WhatsApp
  number in the shop profile (`caruno-profil.json`, field `whatsapp`, international digits e.g. 213555123456).
- Public page: caruno-app `web/vitrine/` reads only `web/vitrine/data/` (not in git), written by
  `scripts/vitrine/export.sh` (SQL in the db container + documents folder on disk; no Dolibarr key in the page).
  Published: parts online + on sale + stock > 0 + price > 0; name, ref, OEM, public price, family, photo.
  Never: purchase price, exact stock, the TIBAO brand. The vitrine shows the last export: re-run it after changes.
