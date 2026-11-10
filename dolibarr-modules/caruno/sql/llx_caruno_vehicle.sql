-- CARUNO — a customer's vehicle, saved by a seller (no customer accounts yet: the customer record is the owner).
-- Model stored by name ("VW|Golf 7|"), engine by label; engine NULL = "Je ne sais pas". A car not in the catalogue
-- keeps its VehiclesDB model ("renault/arkana") and gets an empty parts list, not an error.
CREATE TABLE llx_caruno_vehicle (
  rowid               integer AUTO_INCREMENT PRIMARY KEY NOT NULL,
  entity              integer DEFAULT 1 NOT NULL,
  fk_soc              integer NOT NULL,
  vin                 varchar(17) NULL,
  model_key           varchar(200) NULL,
  model_label         varchar(200) NULL,
  vdb_model_id        varchar(120) NULL,
  production_date     date NULL,                     -- first day of the month when only month / year are known
  engine_label        varchar(60) NULL,
  fk_vin_lookup       integer NULL,
  datec               datetime NOT NULL,
  fk_user_creat       integer NOT NULL,
  tms                 timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=innodb;
