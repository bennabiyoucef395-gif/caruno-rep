-- vehicle_ref checks (scripts/vehicle-ref/build.sh test). Every "problem" line must say 0.

SELECT name, version, licence, loaded_at FROM sources ORDER BY name;

SELECT 'vdb_makes' AS tbl, COUNT(*) AS n_rows FROM vdb_makes
UNION ALL SELECT 'vdb_models', COUNT(*) FROM vdb_models
UNION ALL SELECT 'vdb_availability', COUNT(*) FROM vdb_availability
UNION ALL SELECT 'vdb_popularity', COUNT(*) FROM vdb_popularity
UNION ALL SELECT 'vmm_makes', COUNT(*) FROM vmm_makes
UNION ALL SELECT 'vmm_models', COUNT(*) FROM vmm_models
UNION ALL SELECT 'vmm_generations', COUNT(*) FROM vmm_generations
UNION ALL SELECT 'vmm_engines', COUNT(*) FROM vmm_engines
UNION ALL SELECT 'vmm_engine_specs', COUNT(*) FROM vmm_engine_specs
UNION ALL SELECT 'nhtsa_wmi', COUNT(*) FROM nhtsa_wmi;

SELECT 'problem: VehiclesDB rows that are not cars' AS check_name,
       (SELECT COUNT(*) FROM vdb_makes WHERE kind <> 'car') + (SELECT COUNT(*) FROM vdb_models WHERE kind <> 'car')
     + (SELECT COUNT(*) FROM vdb_availability WHERE kind <> 'car') + (SELECT COUNT(*) FROM vdb_popularity WHERE kind <> 'car') AS n
UNION ALL
SELECT 'problem: VehiclesDB models without their make',
       (SELECT COUNT(*) FROM vdb_models m LEFT JOIN vdb_makes k ON k.id = m.make_id AND k.kind = m.kind WHERE k.id IS NULL)
UNION ALL
SELECT 'problem: VehiclesDB availability/popularity without their model',
       (SELECT COUNT(*) FROM vdb_availability a LEFT JOIN vdb_models m ON m.id = a.model_id AND m.kind = a.kind WHERE m.id IS NULL)
     + (SELECT COUNT(*) FROM vdb_popularity p LEFT JOIN vdb_models m ON m.id = p.model_id AND m.kind = p.kind WHERE m.id IS NULL)
UNION ALL
SELECT 'problem: VehiclesDB model id is not <make>/<slug>',
       (SELECT COUNT(*) FROM vdb_models WHERE id <> CONCAT(make_id, '/', slug))
UNION ALL
SELECT 'problem: vmm generations ending before they start',
       (SELECT COUNT(*) FROM vmm_generations WHERE year_end < year_start)
UNION ALL
SELECT 'problem: NHTSA WMI not 3 or 6 characters',
       (SELECT COUNT(*) FROM nhtsa_wmi WHERE CHAR_LENGTH(wmi) NOT IN (3, 6));

-- Spot checks: the reference must know our main makes.
SELECT 'VehiclesDB' AS src, k.name AS make, COUNT(*) AS models FROM vdb_models m JOIN vdb_makes k ON k.id = m.make_id AND k.kind = m.kind
 WHERE k.id IN ('volkswagen', 'audi', 'bmw', 'mercedes-benz', 'skoda', 'seat') GROUP BY k.name
UNION ALL
SELECT 'vehicle-makes-models', k.name, COUNT(*) FROM vmm_generations g JOIN vmm_models m ON m.id = g.model_id JOIN vmm_makes k ON k.id = m.make_id
 WHERE k.name IN ('Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz', 'Škoda', 'SEAT') GROUP BY k.name;
