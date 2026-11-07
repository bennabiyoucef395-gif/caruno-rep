-- Step 4 check: Golf 7 and Audi A4 B8. Engine options, then brake parts and oil filters for one
-- engine (2.0 TDI) and for "Je ne sais pas". Run: scripts/parts/build.sh test

SET @golf := (SELECT m.id FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id
              WHERE k.name = 'VW' AND m.name = 'Golf 7');
SET @a4   := (SELECT m.id FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id
              WHERE k.name = 'AUDI' AND m.name = 'A4' AND m.generation = 'B8');
SET @golf_tdi := (SELECT vt.id FROM vehicle_types vt JOIN engines e ON e.id = vt.engine_id
                  WHERE vt.model_id = @golf AND e.label = '2.0 TDI');
SET @a4_tdi   := (SELECT vt.id FROM vehicle_types vt JOIN engines e ON e.id = vt.engine_id
                  WHERE vt.model_id = @a4 AND e.label = '2.0 TDI');

SELECT 'Golf 7 — moteurs proposés' AS `test`;
SELECT o.* FROM JSON_TABLE(get_engine_options(@golf), '$[*]' COLUMNS (
  vehicle_type_id INT PATH '$.vehicle_type_id', label VARCHAR(80) PATH '$.label')) o;
SELECT 'Audi A4 B8 — moteurs proposés' AS `test`;
SELECT o.* FROM JSON_TABLE(get_engine_options(@a4), '$[*]' COLUMNS (
  vehicle_type_id INT PATH '$.vehicle_type_id', label VARCHAR(80) PATH '$.label')) o;

SELECT 'Golf 7 2.0 TDI — freinage' AS `test`;          CALL compatible_parts(@golf, @golf_tdi, 'Freinage');
SELECT 'Golf 7 2.0 TDI — filtre à huile' AS `test`;    CALL compatible_parts(@golf, @golf_tdi, 'Filtre à huile');
SELECT 'Golf 7 Je ne sais pas — freinage' AS `test`;   CALL compatible_parts(@golf, NULL, 'Freinage');
SELECT 'Golf 7 Je ne sais pas — filtre à huile' AS `test`; CALL compatible_parts(@golf, NULL, 'Filtre à huile');

SELECT 'A4 B8 2.0 TDI — freinage' AS `test`;           CALL compatible_parts(@a4, @a4_tdi, 'Freinage');
SELECT 'A4 B8 2.0 TDI — filtre à huile' AS `test`;     CALL compatible_parts(@a4, @a4_tdi, 'Filtre à huile');
SELECT 'A4 B8 Je ne sais pas — freinage' AS `test`;    CALL compatible_parts(@a4, NULL, 'Freinage');
SELECT 'A4 B8 Je ne sais pas — filtre à huile' AS `test`; CALL compatible_parts(@a4, NULL, 'Filtre à huile');
