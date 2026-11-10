-- CARUNO — every VIN search made by a seller (found or not), and the model / engine the seller then chose.
-- Internal data: a VIN identifies a car (and its owner); never published. Models are stored by name
-- ("VW|Golf 7|" = maker|model|generation), not by caruno_parts id: those ids change at each catalogue rebuild.
CREATE TABLE llx_caruno_vin_lookup (
  rowid               integer AUTO_INCREMENT PRIMARY KEY NOT NULL,
  entity              integer DEFAULT 1 NOT NULL,
  vin                 varchar(17) NOT NULL,          -- normalised (upper case, I/O/Q fixed); what was typed if invalid
  vin_typed           varchar(64) NULL,              -- as typed, when different
  datec               datetime NOT NULL,
  fk_user             integer NOT NULL,              -- the seller
  fk_soc              integer NULL,                  -- the customer, when known
  valid               smallint DEFAULT 0 NOT NULL,
  maker               varchar(40) NULL,
  maker_source        varchar(10) NULL,              -- hand / nhtsa
  model_years         varchar(20) NULL,              -- "2015,1985"
  year_confidence     varchar(10) NULL,
  level               varchar(10) NOT NULL,          -- exact / model / make / none
  candidates          text NULL,                     -- JSON: model keys proposed
  chosen_model_key    varchar(200) NULL,             -- "VW|Golf 7|" — the seller's choice
  chosen_model_label  varchar(200) NULL,
  chosen_engine       varchar(60) NULL,              -- engine label, NULL with chosen_engine_unknown = 1 ("Je ne sais pas")
  chosen_engine_unknown smallint DEFAULT 0 NOT NULL,
  chosen_vdb_model    varchar(120) NULL,             -- VehiclesDB model ("renault/arkana") when not in the catalogue
  date_choice         datetime NULL,
  fk_user_choice      integer NULL
) ENGINE=innodb;
