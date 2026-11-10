ALTER TABLE llx_caruno_vin_lookup ADD INDEX idx_caruno_vin_lookup_vin (vin);
ALTER TABLE llx_caruno_vin_lookup ADD INDEX idx_caruno_vin_lookup_datec (datec);
ALTER TABLE llx_caruno_vin_lookup ADD INDEX idx_caruno_vin_lookup_fk_soc (fk_soc);
