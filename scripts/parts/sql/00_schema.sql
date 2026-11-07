-- CARUNO parts catalogue (caruno_parts). Shared reference data: vehicles, parts, OEM numbers, fitment.
-- See doc/02-professional-erp-blueprint.md §B and CLAUDE.md. Rebuilt from scratch by scripts/parts/build.sh.

CREATE TABLE data_sources (
  id    SMALLINT UNSIGNED PRIMARY KEY,
  name  VARCHAR(80) NOT NULL,
  type  VARCHAR(30) NOT NULL                      -- catalogue | supplier_data | shop_declared | oem_match
) ENGINE=InnoDB;

CREATE TABLE manufacturers (
  id    INT UNSIGNED PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE models (
  id               INT UNSIGNED PRIMARY KEY,
  manufacturer_id  INT UNSIGNED NOT NULL,
  name             VARCHAR(80) NOT NULL,
  generation       VARCHAR(40) NULL,
  year_from        SMALLINT UNSIGNED NULL,
  year_to          SMALLINT UNSIGNED NULL,
  FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
) ENGINE=InnoDB;

-- engine_dependent = 1: the right part depends on the engine. Without a known engine
-- (vehicle_type_id NULL, "Je ne sais pas") such a part is never shown as compatible.
CREATE TABLE part_categories (
  id                INT UNSIGNED PRIMARY KEY,
  group_name        VARCHAR(60) NOT NULL,
  name              VARCHAR(120) NOT NULL UNIQUE,
  engine_dependent  BOOLEAN NOT NULL
) ENGINE=InnoDB;

CREATE TABLE articles (
  id           INT UNSIGNED PRIMARY KEY,
  ref          VARCHAR(40) NOT NULL UNIQUE,      -- = Dolibarr llx_product.ref
  name         VARCHAR(255) NOT NULL,
  name_ar      VARCHAR(255) NULL,
  remark       VARCHAR(255) NULL,
  category_id  INT UNSIGNED NULL,
  source_id    SMALLINT UNSIGNED NOT NULL,
  FOREIGN KEY (category_id) REFERENCES part_categories(id),
  FOREIGN KEY (source_id) REFERENCES data_sources(id),
  KEY (category_id)
) ENGINE=InnoDB;

CREATE TABLE oem_numbers (
  id              INT UNSIGNED PRIMARY KEY,
  oem             VARCHAR(80) NOT NULL,            -- as printed
  oem_normalized  VARCHAR(80) NOT NULL UNIQUE      -- A-Z0-9 only: what search uses
) ENGINE=InnoDB;

CREATE TABLE article_oem (
  article_id  INT UNSIGNED NOT NULL,
  oem_id      INT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, oem_id),
  KEY (oem_id),
  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (oem_id) REFERENCES oem_numbers(id)
) ENGINE=InnoDB;

-- One row per engine as sold ("2.0 TDI"), shared by all models that use it.
-- fuel NULL = the source gave only a displacement ("2.0"): generic engine.
CREATE TABLE engines (
  id              INT UNSIGNED PRIMARY KEY,
  label           VARCHAR(60) NOT NULL UNIQUE,
  displacement_l  DECIMAL(3,1) NULL,
  fuel            ENUM('diesel','essence') NULL,
  designation     VARCHAR(30) NULL,                -- TDI, TSI, 16V, ...
  engine_code     VARCHAR(10) NULL,                -- CJXA, ABU, ... when known
  power_hp        SMALLINT UNSIGNED NULL
) ENGINE=InnoDB;

-- A vehicle type = one model with one engine (Golf 7 + 2.0 TDI).
CREATE TABLE vehicle_types (
  id         INT UNSIGNED PRIMARY KEY,
  model_id   INT UNSIGNED NOT NULL,
  engine_id  INT UNSIGNED NOT NULL,
  label      VARCHAR(160) NOT NULL,
  UNIQUE (model_id, engine_id),
  UNIQUE (id, model_id),                           -- target of fitment's composite key
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (engine_id) REFERENCES engines(id)
) ENGINE=InnoDB;

-- Part (through its OEM number) <-> vehicle. model_id is always set; vehicle_type_id is set when the
-- source names the engine. The composite key forbids a vehicle type of another model.
CREATE TABLE fitment (
  id               INT UNSIGNED PRIMARY KEY,
  oem_id           INT UNSIGNED NOT NULL,
  model_id         INT UNSIGNED NOT NULL,
  vehicle_type_id  INT UNSIGNED NULL,
  source_id        SMALLINT UNSIGNED NOT NULL,
  confidence       ENUM('confirmed','probable','unverified') NOT NULL,
  note             VARCHAR(255) NULL,              -- kept as found in the source
  KEY (model_id, vehicle_type_id),
  KEY (vehicle_type_id),
  KEY (oem_id),
  FOREIGN KEY (oem_id) REFERENCES oem_numbers(id),
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (vehicle_type_id, model_id) REFERENCES vehicle_types(id, model_id),
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
) ENGINE=InnoDB;
