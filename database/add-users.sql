-- eTRAMS — non-destructive migration: adds the users table to an existing database
-- (does NOT drop or touch any meter/grid data)
-- Apply with: mysql -u root -p etrams < database/add-users.sql

USE etrams;

CREATE TABLE IF NOT EXISTS users (
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

-- Default accounts (bcrypt hashes of the passwords shown below):
--   admin  / admin123  (role: admin)
--   viewer / viewer123 (role: viewer)
-- Insert only when the table is empty so re-running the migration is safe.
INSERT INTO users (username, password_hash, full_name, role)
SELECT 'admin', '$2b$10$7yazmf/8j4SvK7ZM/gWMW.bAtnpZz.GeE0/pAfRyxoFWdus3qZxIe', 'Administrator', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO users (username, password_hash, full_name, role)
SELECT 'viewer', '$2b$10$riQnGF7/XyYwDFZXYXSSQeha7LgtrLBynlOK2YDvIDin04tpJSXFa', 'Viewer', 'viewer'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'viewer');
