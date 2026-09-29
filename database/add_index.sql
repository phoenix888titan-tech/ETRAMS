-- Add an index specifically on reading_datetime to allow extremely fast range queries across all meters.
ALTER TABLE meter_readings ADD INDEX idx_reading_datetime (reading_datetime);
