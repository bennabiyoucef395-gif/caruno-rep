-- NHTSA vPIC WMI codes (US government work, public domain), one row per manufacturer + WMI, for the makes queried
-- in nhtsa_wmi.py. maker = our canonical maker name (as in vin_decoder.py), from the manufacturer name.
-- Mostly makers that sell in the US: Dacia, Chery... are missing; vin_decoder.py's hand-written table wins.
DROP TABLE IF EXISTS nhtsa_wmi;

CREATE TABLE nhtsa_wmi (
  mfr_id        INT NOT NULL,              -- NHTSA manufacturer id ("Id" in the API)
  wmi           VARCHAR(6) NOT NULL,       -- 3 chars, or 6 for small makers (chars 1-3 + 12-14)
  manufacturer  VARCHAR(255) NOT NULL,
  country       VARCHAR(80) NULL,
  vehicle_type  VARCHAR(80) NULL,
  maker         VARCHAR(40) NOT NULL,
  created_on    DATE NULL,
  updated_on    DATE NULL,
  PRIMARY KEY (mfr_id, wmi),
  KEY (wmi)
) ENGINE=InnoDB;
