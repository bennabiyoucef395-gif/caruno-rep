-- vehicle-makes-models (github.com/gor3a/vehicle-makes-models), data ODbL 1.0, copied from autoevolution.com.
-- INTERNAL ONLY: used to check our generation years; never shown to customers, never the source of the engine
-- options offered to them (those come from our own catalogue notes and confirmed engines).
-- vehicles.sqlite tables as is. Generations have no chassis code ("A4 (2007)") and are split by doors and facelift.
DROP TABLE IF EXISTS vmm_engine_specs, vmm_engines, vmm_generations, vmm_models, vmm_makes;

CREATE TABLE vmm_makes (
  id       INT PRIMARY KEY,
  `group`  VARCHAR(60) NOT NULL,
  name     VARCHAR(60) NOT NULL,
  country  VARCHAR(40) NULL
) ENGINE=InnoDB;

CREATE TABLE vmm_models (
  id          INT PRIMARY KEY,
  make_id     INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  year_start  SMALLINT NULL,
  year_end    SMALLINT NULL,
  FOREIGN KEY (make_id) REFERENCES vmm_makes(id)
) ENGINE=InnoDB;

CREATE TABLE vmm_generations (
  id          INT PRIMARY KEY,
  model_id    INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  year_start  SMALLINT NULL,
  year_end    SMALLINT NULL,
  body_type   VARCHAR(60) NULL,
  FOREIGN KEY (model_id) REFERENCES vmm_models(id)
) ENGINE=InnoDB;

-- displacement_cc is declared INTEGER upstream but holds a few decimals: DOUBLE keeps them as they are.
CREATE TABLE vmm_engines (
  id                          INT PRIMARY KEY,
  generation_id               INT NOT NULL,
  label                       VARCHAR(120) NOT NULL,
  fuel_type                   VARCHAR(60) NULL,
  cylinders                   INT NULL,
  displacement_cc             DOUBLE NULL,
  power_hp                    DOUBLE NULL,
  torque_nm                   DOUBLE NULL,
  transmission                VARCHAR(255) NULL,
  drivetrain                  VARCHAR(60) NULL,
  zero_to_100_s               DOUBLE NULL,
  top_speed_kmh               DOUBLE NULL,
  fuel_economy_combined_l100  DOUBLE NULL,
  length_mm                   INT NULL,
  width_mm                    INT NULL,
  height_mm                   INT NULL,
  wheelbase_mm                INT NULL,
  curb_weight_kg              INT NULL,
  FOREIGN KEY (generation_id) REFERENCES vmm_generations(id)
) ENGINE=InnoDB;

CREATE TABLE vmm_engine_specs (
  id         INT PRIMARY KEY,
  engine_id  INT NOT NULL,
  `key`      VARCHAR(120) NOT NULL,
  value      TEXT NOT NULL,
  FOREIGN KEY (engine_id) REFERENCES vmm_engines(id)
) ENGINE=InnoDB;
