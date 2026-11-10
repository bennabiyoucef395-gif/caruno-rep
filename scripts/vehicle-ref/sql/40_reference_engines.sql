-- Reference engines (vehicle-makes-models), REFERENCE ONLY: never an engine option for customers, never a fitment.
-- Used to list the engines our catalogue does not cover (scripts/vehicle-ref/build.sh missing).
-- The vmm data has errors ("2.0L TDI" filed as Gasoline 1395 cc): the engine size and type are read from the label
-- first ("2.0L TDI ...", BMW "320d", Mercedes "C 220 CDI"); vmm's own columns only fill the gaps.
-- Fuel rules = ours: TDI / TD / D / SDI / CDI / BMW "…d" = diesel; TSI / TFSI / FSI / T / Turbo / 16V / 20V / MPI / BMW "…i" = essence.

CREATE OR REPLACE VIEW reference_engines AS
SELECT x.caruno_model_id, x.vmm_engine_id, x.vmm_generation_id, x.vmm_label, x.power_hp, x.displacement_l, x.family,
       CASE WHEN x.family IN ('TDI', 'TD', 'D', 'SDI') OR x.diesel_name THEN 'diesel'
            WHEN x.family IN ('TSI', 'TFSI', 'FSI', 'T', 'TURBO', '16V', '20V', 'MPI', 'VR6') OR x.petrol_name THEN 'essence'
            WHEN x.fuel_type IN ('Diesel', 'Mild Hybrid Diesel') THEN 'diesel'
            WHEN x.fuel_type IN ('Gasoline', 'Mild Hybrid', 'Hybrid Gasoline') THEN 'essence'
            ELSE NULL END AS fuel,                 -- NULL: electric, hybrid, gas... or unknown
       x.fuel_type AS vmm_fuel_type
FROM (
  SELECT l.caruno_model_id, e.id AS vmm_engine_id, e.generation_id AS vmm_generation_id, e.label AS vmm_label,
         ROUND(e.power_hp) AS power_hp, e.fuel_type,
         -- REGEXP_SUBSTR gives '' (not NULL) when nothing matches: NULLIF makes it NULL.
         CAST(COALESCE(NULLIF(REGEXP_SUBSTR(e.label, '^[0-9]+\\.[0-9](?=L )'), ''), ROUND(e.displacement_cc / 1000, 1))
              AS DECIMAL(3,1)) AS displacement_l,
         NULLIF(UPPER(REGEXP_SUBSTR(e.label, '(?<=^[0-9]\\.[0-9]L )(TDI|TSI|TFSI|FSI|SDI|TD|D|T|16v|20v|Turbo|MPI|VR6)(?= )')), '')
           AS family,
         e.label REGEXP '\\b[0-9]{3}(d|td|tds)\\b|\\bCDI\\b|\\b[0-9]{3} d\\b|\\bBlueTEC\\b' AS diesel_name,
         e.label REGEXP '\\b[0-9]{3}i\\b' AS petrol_name
  FROM model_links l
  JOIN vmm_engines e ON e.generation_id = l.vmm_generation_id
) x;

-- One row per model and reference engine ("2.0 TDI (diesel)"), with the power range, and whether our catalogue
-- already offers an engine of that size and fuel for this model (caruno_parts.vehicle_types).
CREATE OR REPLACE VIEW reference_engine_summary AS
SELECT r.caruno_model_id,
       CONCAT(r.displacement_l, IFNULL(CONCAT(' ', r.family), ''), ' (', IFNULL(r.fuel, 'autre'), ')') AS label,
       r.displacement_l, r.fuel,
       MIN(r.power_hp) AS hp_min, MAX(r.power_hp) AS hp_max, COUNT(*) AS vmm_variants,
       EXISTS (SELECT 1 FROM caruno_parts.vehicle_types vt JOIN caruno_parts.engines en ON en.id = vt.engine_id
               WHERE vt.model_id = r.caruno_model_id AND en.displacement_l = r.displacement_l
                 AND (en.fuel <=> r.fuel OR en.fuel IS NULL)) AS in_catalogue
FROM reference_engines r
WHERE r.displacement_l IS NOT NULL
GROUP BY r.caruno_model_id, r.displacement_l, r.family, r.fuel;
