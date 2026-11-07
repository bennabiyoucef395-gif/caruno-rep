# CARUNO ERP — notes for Claude

Dolibarr 24 + MariaDB 11.4 in Docker. Instances live outside the repo and OneDrive:
`C:\Users\TRETEC\caruno-data\instances\<name>\instance.env` (secrets, never in git).
`hanout-vw` = main instance (port 8080), `test` = test instance (container `caruno-test-db-1`, port 8081).
Design reference: `doc/02-professional-erp-blueprint.md`.

## Parts catalogue (`caruno_parts`)

Shared reference data (vehicles, parts, OEM numbers, fitment), in its own database `caruno_parts`,
not in Dolibarr (blueprint §B). Today only on the **test** instance.

- Build from scratch: `scripts/parts/build.sh all` (or one step: `data schema base categories engines functions test`).
  Source: `C:\Users\TRETEC\Documents\bdd pieces auto` (catalogue-pieces.xlsx, modeles.xlsx);
  generated files: `C:\Users\TRETEC\caruno-data\parts-build` (review files `moteurs_a_verifier.csv`,
  `moteurs_non_prouves.csv`, `a_verifier.xlsx`). The script refuses a non-test container unless `PARTS_FORCE=1`.
- Rule tests: `scripts/parts/tests.sh` (must pass after any change to the rules, the SQL or the data).
- Read-only account `caruno_parts` (SELECT, EXECUTE); password `PARTS_DB_PASSWORD` in the test `instance.env`.
- Database collation `utf8mb4_uca1400_ai_ci` (server default): another collation breaks text comparisons
  for utf8mb4 clients. It is accent-insensitive: "Filtre a huile" finds "Filtre à huile".
- `articles.ref` = Dolibarr `llx_product.ref` (TiBAO number): the join key between catalogue and shop.

### Part categories (`scripts/parts/part_categories.py`)
- One category per article, from its name (FR/EN/ZH keyword rules, first match wins, specific before generic).
  Position/packaging variants are the same category ("Disque de frein" = "Disque de frein avant" = "BRAKE DISC").
- Articles without a usable name ("PIÈCE OEM 03L 145 771", "L", "OTHERS") are classified by the VW-group OEM
  number (middle block's first digit = main group: 1 engine, 2 fuel/exhaust, 6 wheels/brakes, 8 body...).
  The rest is "Non classé".
- `engine_dependent = 1` when the right part depends on the engine: filters (oil, air, fuel), spark and glow
  plugs, ignition coils, timing kit/belt/chain/tensioners, injectors, turbo, water pump, pistons and rings,
  valves, cylinder head gasket, alternator, starter — and every part bolted to or driven by the engine
  (head, camshaft, crankshaft, gaskets, oil and cooling circuit incl. coolant hoses, intake/exhaust, sensors
  of the engine, engine mounts, clutch, fuel pump, A/C compressor, brake vacuum pump). "Non classé" too.
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
- Open point: the front talks only to Dolibarr (no backend, no PHP module), so it cannot call these
  functions directly. Planned: an export of per-model JSON files built with these same functions.
