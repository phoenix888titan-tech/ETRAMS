-- eTRAMS Energy Management System
-- MySQL Database Schema

CREATE DATABASE IF NOT EXISTS etrams
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE etrams;

-- Table 1: grids
DROP TABLE IF EXISTS power_meters;
DROP TABLE IF EXISTS areas;
DROP TABLE IF EXISTS buildings;
DROP TABLE IF EXISTS loops;
DROP TABLE IF EXISTS grids;
DROP TABLE IF EXISTS users;

CREATE TABLE grids (
  grid_id INT PRIMARY KEY AUTO_INCREMENT,
  grid_code VARCHAR(20) UNIQUE NOT NULL,
  grid_name VARCHAR(100) NOT NULL,
  grid_color VARCHAR(7) DEFAULT '#3B82F6',
  location_lat DECIMAL(10,8) NULL,
  location_lng DECIMAL(11,8) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_grid_status (status)
);

-- Table 2: buildings (connected directly to grids)
CREATE TABLE buildings (
  building_id INT PRIMARY KEY AUTO_INCREMENT,
  grid_id INT NOT NULL,
  building_code VARCHAR(30) UNIQUE NOT NULL,
  building_name VARCHAR(100) NOT NULL,
  building_type ENUM('academic','residential','admin','utility','recreational') DEFAULT 'academic',
  floor_count INT DEFAULT 1,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grid_id) REFERENCES grids(grid_id) ON DELETE CASCADE,
  INDEX idx_building_grid (grid_id),
  INDEX idx_building_status (status),
  INDEX idx_building_type (building_type)
);

-- Table 4: areas
CREATE TABLE areas (
  area_id INT PRIMARY KEY AUTO_INCREMENT,
  building_id INT NOT NULL,
  area_code VARCHAR(20) UNIQUE NOT NULL,
  area_name VARCHAR(100) NOT NULL,
  area_type ENUM('floor','room','common_area','utility','parking','other') DEFAULT 'floor',
  floor_number INT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_id) REFERENCES buildings(building_id) ON DELETE CASCADE,
  INDEX idx_area_building (building_id),
  INDEX idx_area_status (status),
  INDEX idx_area_type (area_type)
);

-- Table 5: power_meters
CREATE TABLE power_meters (
  meter_id INT PRIMARY KEY AUTO_INCREMENT,
  area_id INT NOT NULL,
  meter_code VARCHAR(20) UNIQUE NOT NULL,
  meter_description VARCHAR(200) NOT NULL,
  meter_type ENUM('main','submeter','backup') DEFAULT 'main',
  current_reading DECIMAL(15,3) DEFAULT 0.000,
  previous_reading DECIMAL(15,3) DEFAULT 0.000,
  total_used DECIMAL(15,3) DEFAULT 0.000,
  active_power DECIMAL(10,3) DEFAULT 0.000,
  amps DECIMAL(10,3) DEFAULT 0.000,
  freq DECIMAL(8,3) DEFAULT 0.000,
  power_factor DECIMAL(5,3) DEFAULT 0.000,
  vll DECIMAL(10,3) DEFAULT 0.000,
  vln DECIMAL(10,3) DEFAULT 0.000,
  reactive_power DECIMAL(10,3) DEFAULT 0.000,
  apparent_power DECIMAL(10,3) DEFAULT 0.000,
  total_energy DECIMAL(15,3) DEFAULT 0.000,
  status ENUM('live','down','maintenance','offline') DEFAULT 'down',
  reading_datetime DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE,
  INDEX idx_meter_area (area_id),
  INDEX idx_meter_status (status),
  INDEX idx_meter_reading_datetime (reading_datetime),
  INDEX idx_meter_code (meter_code)
);

-- Table 6: users (login accounts with roles)
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  status ENUM('active','inactive') DEFAULT 'active',
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_status (status)
);
