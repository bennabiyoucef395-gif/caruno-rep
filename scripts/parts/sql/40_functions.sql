-- CARUNO parts catalogue: engine choice and compatibility rules. See CLAUDE.md "Parts catalogue".

DELIMITER //

-- Engine options a customer can pick for a model, as a JSON array, always ending with
-- {"vehicle_type_id": null, "label": "Je ne sais pas"}.
-- A generic engine (displacement only, fuel unknown) is offered only when the model has no
-- specific engine of the same displacement: "2.0" disappears when "2.0 TDI" / "2.0 TSI" exist.
DROP FUNCTION IF EXISTS get_engine_options //
CREATE FUNCTION get_engine_options(p_model_id INT UNSIGNED) RETURNS LONGTEXT
  READS SQL DATA
BEGIN
  RETURN (
    SELECT JSON_ARRAYAGG(JSON_OBJECT('vehicle_type_id', o.id, 'label', o.label,
                                     'fuel', o.fuel, 'displacement_l', o.disp)
                         ORDER BY o.is_unknown, o.fuel_order, o.disp, o.label)
    FROM (
      SELECT vt.id,
             CASE WHEN e.fuel IS NULL AND e.designation IS NULL
                  THEN CONCAT(e.label, ' (essence ou diesel)')
                  ELSE CONCAT(e.label, IFNULL(CONCAT(' (', e.fuel, ')'), '')) END AS label,
             e.fuel, e.displacement_l AS disp, 0 AS is_unknown,
             CASE e.fuel WHEN 'essence' THEN 1 WHEN 'diesel' THEN 2 ELSE 3 END AS fuel_order
      FROM vehicle_types vt JOIN engines e ON e.id = vt.engine_id
      WHERE vt.model_id = p_model_id
        AND NOT (e.fuel IS NULL AND e.designation IS NULL AND EXISTS (
              SELECT 1 FROM vehicle_types vt2 JOIN engines e2 ON e2.id = vt2.engine_id
              WHERE vt2.model_id = p_model_id AND e2.displacement_l = e.displacement_l
                AND (e2.fuel IS NOT NULL OR e2.designation IS NOT NULL)))
      UNION ALL
      SELECT NULL, 'Je ne sais pas', NULL, NULL, 1, 9
    ) o
  );
END //

-- Parts that fit a model, for a chosen vehicle type or for "Je ne sais pas" (p_vehicle_type_id NULL).
-- p_filter: NULL = all, otherwise a category group ("Freinage") or a category ("Filtre à huile").
-- status per article (best of its fitment rows):
--   compatible     the source names this vehicle type, or the part does not depend on the engine;
--   a_confirmer    plausible but not proven: engine-dependent part known at model level only, part
--                  listed for a generic engine of the same displacement, non engine-dependent part
--                  listed for another engine, or confidence 'unverified';
--   moteur_requis  engine-dependent part while the engine is unknown: NEVER show it as compatible,
--                  ask for the engine instead.
-- Engine-dependent parts listed for another engine are not returned.
DROP PROCEDURE IF EXISTS compatible_parts //
CREATE PROCEDURE compatible_parts(IN p_model_id INT UNSIGNED, IN p_vehicle_type_id INT UNSIGNED,
                                  IN p_filter VARCHAR(120))
  READS SQL DATA
BEGIN
  DECLARE v_disp DECIMAL(3,1) DEFAULT NULL;
  DECLARE v_generic BOOLEAN DEFAULT FALSE;
  IF p_vehicle_type_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM vehicle_types WHERE id = p_vehicle_type_id AND model_id = p_model_id) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'vehicle_type_id does not belong to this model';
    END IF;
    SELECT e.displacement_l, (e.fuel IS NULL AND e.designation IS NULL) INTO v_disp, v_generic
    FROM vehicle_types vt JOIN engines e ON e.id = vt.engine_id WHERE vt.id = p_vehicle_type_id;
  END IF;

  SELECT r.ref, r.name, r.group_name, r.category, r.engine_dependent,
         ELT(MIN(r.rnk), 'compatible', 'a_confirmer', 'moteur_requis') AS status,
         GROUP_CONCAT(DISTINCT CONCAT(IFNULL(r.engine, 'modèle'), ' · ', r.confidence,
                                      IFNULL(CONCAT(' · ', r.note), ''))
                      ORDER BY r.rnk SEPARATOR ' | ') AS evidence
  FROM (
    -- 'unverified' is never "compatible" (blueprint rule): rank 1 becomes 2
    SELECT b.*, b.base_rnk + (b.base_rnk = 1 AND b.confidence = 'unverified') AS rnk
    FROM (
    SELECT a.id, a.ref, a.name, c.group_name, c.name AS category, c.engine_dependent,
           f.confidence, f.note, e.label AS engine,
           CASE
             WHEN f.vehicle_type_id IS NOT NULL AND f.vehicle_type_id = p_vehicle_type_id THEN 1
             WHEN f.vehicle_type_id IS NULL AND NOT c.engine_dependent THEN 1
             WHEN f.vehicle_type_id IS NULL AND p_vehicle_type_id IS NOT NULL THEN 2
             WHEN f.vehicle_type_id IS NULL THEN 3
             -- from here the row names another vehicle type of the model
             WHEN p_vehicle_type_id IS NOT NULL AND e.displacement_l = v_disp
                  AND (v_generic OR (e.fuel IS NULL AND e.designation IS NULL)) THEN 2
             WHEN NOT c.engine_dependent THEN 2
             WHEN p_vehicle_type_id IS NULL THEN 3
             ELSE NULL                                  -- engine-dependent, other engine: not returned
           END AS base_rnk
    FROM fitment f
    JOIN article_oem ao ON ao.oem_id = f.oem_id
    JOIN articles a ON a.id = ao.article_id
    JOIN part_categories c ON c.id = a.category_id
    LEFT JOIN vehicle_types vt ON vt.id = f.vehicle_type_id
    LEFT JOIN engines e ON e.id = vt.engine_id
    WHERE f.model_id = p_model_id
      AND (p_filter IS NULL OR c.group_name = p_filter OR c.name = p_filter)
    ) b
  ) r
  WHERE r.rnk IS NOT NULL
  GROUP BY r.id
  ORDER BY r.group_name, r.category, MIN(r.rnk), r.ref;
END //

DELIMITER ;
