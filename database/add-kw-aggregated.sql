-- Safe migration: adds kw_aggregated_monthly table only
-- Run this on the VPS: mysql -u root -p etrams < database/add-kw-aggregated.sql

USE etrams;

CREATE TABLE IF NOT EXISTS kw_aggregated_monthly (
  agg_id    INT PRIMARY KEY AUTO_INCREMENT,
  grid_id   INT NOT NULL,
  year      SMALLINT NOT NULL,
  month     TINYINT NOT NULL,
  total_kw  DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grid_year_month (grid_id, year, month),
  FOREIGN KEY (grid_id) REFERENCES grids(grid_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
