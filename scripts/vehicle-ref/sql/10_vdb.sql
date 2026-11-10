-- VehiclesDB (github.com/vehiclesdb/vehiclesdb), CC-BY 4.0: credit "Vehicle data by VehiclesDB (vehiclesdb.com)".
-- catalog.sqlite tables as is, car rows only (kind = 'car'). No generations and no years in this source:
-- a model ("bmw/3-series") covers every generation. Model id = "<make>/<slug>" (the slug alone repeats across makes).
DROP TABLE IF EXISTS vdb_popularity, vdb_availability, vdb_models, vdb_makes, vdb_meta;

CREATE TABLE vdb_meta (
  `key`  VARCHAR(40) PRIMARY KEY,
  value  VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE vdb_makes (
  id            VARCHAR(60) NOT NULL,
  kind          VARCHAR(16) NOT NULL,
  name          VARCHAR(80) NULL,
  former_slugs  VARCHAR(255) NULL,
  PRIMARY KEY (id, kind)
) ENGINE=InnoDB;

CREATE TABLE vdb_models (
  id                        VARCHAR(120) NOT NULL,
  kind                      VARCHAR(16) NOT NULL,
  make_id                   VARCHAR(60) NULL,
  slug                      VARCHAR(100) NULL,
  name                      VARCHAR(120) NULL,
  body_types                VARCHAR(80) NULL,
  regions                   VARCHAR(40) NULL,
  global_popularity_decile  TINYINT NULL,
  mass_popularity_decile    TINYINT NULL,
  PRIMARY KEY (id, kind),
  KEY (make_id, kind)
) ENGINE=InnoDB;

CREATE TABLE vdb_availability (
  model_id  VARCHAR(120) NULL,
  kind      VARCHAR(16) NULL,
  country   VARCHAR(8) NULL,
  evidence  VARCHAR(40) NULL,
  source    VARCHAR(60) NULL,
  KEY (model_id, kind)
) ENGINE=InnoDB;

CREATE TABLE vdb_popularity (
  model_id    VARCHAR(120) NULL,
  kind        VARCHAR(16) NULL,
  country     VARCHAR(8) NULL,
  `rank`      INT NULL,
  decile      TINYINT NULL,
  confidence  VARCHAR(20) NULL,
  KEY (model_id, kind)
) ENGINE=InnoDB;
