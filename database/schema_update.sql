CREATE TABLE IF NOT EXISTS meter_readings (
  reading_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  meter_id INT NOT NULL,
  reading_value DECIMAL(15,3) NOT NULL,
  active_power DECIMAL(10,3) DEFAULT NULL,
  amps DECIMAL(10,3) DEFAULT NULL,
  freq DECIMAL(10,3) DEFAULT NULL,
  power_factor DECIMAL(10,3) DEFAULT NULL,
  vll DECIMAL(10,3) DEFAULT NULL,
  vln DECIMAL(10,3) DEFAULT NULL,
  reading_datetime DATETIME NOT NULL,
  FOREIGN KEY (meter_id) REFERENCES power_meters(meter_id) ON DELETE CASCADE,
  INDEX idx_meter_datetime (meter_id, reading_datetime)
);
