-- ============================================================
--  ByteBudd sample database – fake e-commerce data
-- ============================================================

USE sample_db;

-- ── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    stock       INT NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name  VARCHAR(100) NOT NULL,
    email      VARCHAR(200) NOT NULL UNIQUE,
    city       VARCHAR(100),
    country    VARCHAR(100),
    joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    status      ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    total       DECIMAL(10,2) NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    customer_id INT NOT NULL,
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)  REFERENCES products(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ── Seed data ─────────────────────────────────────────────

INSERT INTO categories (name, description) VALUES
  ('Electronics',   'Gadgets, devices, and accessories'),
  ('Books',         'Fiction, non-fiction, and technical titles'),
  ('Clothing',      'Apparel for all seasons'),
  ('Home & Garden', 'Furniture, tools, and décor'),
  ('Sports',        'Equipment and activewear');

INSERT INTO products (category_id, name, price, stock) VALUES
  (1, 'Wireless Noise-Cancelling Headphones', 149.99,  85),
  (1, 'Mechanical Keyboard – TKL',             89.99, 120),
  (1, '27" 4K Monitor',                       399.99,  40),
  (1, 'USB-C Hub 7-in-1',                      34.99, 200),
  (1, 'Webcam 1080p',                           49.99,  95),
  (2, 'Clean Code – Robert C. Martin',          35.00, 300),
  (2, 'Designing Data-Intensive Applications',  45.00, 250),
  (2, 'The Pragmatic Programmer',               40.00, 180),
  (3, 'Classic Fit Oxford Shirt',               29.99, 500),
  (3, 'Slim Chino Trousers',                    39.99, 350),
  (3, 'Merino Wool Sweater',                    59.99, 200),
  (4, 'Ergonomic Office Chair',                249.99,  30),
  (4, 'Standing Desk Converter',               179.99,  55),
  (4, 'LED Desk Lamp',                          24.99, 400),
  (5, 'Yoga Mat – 6mm',                         22.99, 600),
  (5, 'Resistance Band Set',                    18.99, 450),
  (5, 'Running Shoes – Neutral',                89.99, 220);

INSERT INTO customers (first_name, last_name, email, city, country) VALUES
  ('Alice',   'Johnson',  'alice.johnson@example.com',  'New York',    'US'),
  ('Bob',     'Smith',    'bob.smith@example.com',      'London',      'GB'),
  ('Carlos',  'García',   'carlos.garcia@example.com',  'Madrid',      'ES'),
  ('Diana',   'Lee',      'diana.lee@example.com',      'Toronto',     'CA'),
  ('Ethan',   'Brown',    'ethan.brown@example.com',    'Sydney',      'AU'),
  ('Fatima',  'Al-Rashid','fatima.alrashid@example.com','Dubai',       'AE'),
  ('George',  'Müller',   'george.muller@example.com',  'Berlin',      'DE'),
  ('Hannah',  'Nguyen',   'hannah.nguyen@example.com',  'Ho Chi Minh', 'VN'),
  ('Ivan',    'Petrov',   'ivan.petrov@example.com',    'Moscow',      'RU'),
  ('Julia',   'Costa',    'julia.costa@example.com',    'São Paulo',   'BR'),
  ('Kevin',   'Park',     'kevin.park@example.com',     'Seoul',       'KR'),
  ('Laura',   'Rossi',    'laura.rossi@example.com',    'Rome',        'IT'),
  ('Michael', 'Chen',     'michael.chen@example.com',   'Shanghai',    'CN'),
  ('Nina',    'Patel',    'nina.patel@example.com',     'Mumbai',      'IN'),
  ('Oscar',   'Johansson','oscar.johansson@example.com','Stockholm',   'SE');

-- Orders (spread across statuses)
INSERT INTO orders (customer_id, status, total, created_at) VALUES
  ( 1, 'delivered',  184.98, '2025-11-05 10:23:00'),
  ( 2, 'delivered',   45.00, '2025-11-12 14:05:00'),
  ( 3, 'shipped',    399.99, '2025-12-01 09:00:00'),
  ( 4, 'processing',  89.99, '2026-01-15 11:30:00'),
  ( 5, 'delivered',  249.99, '2026-01-20 16:45:00'),
  ( 6, 'pending',     22.99, '2026-02-03 08:10:00'),
  ( 7, 'delivered',  179.99, '2026-02-14 13:00:00'),
  ( 8, 'cancelled',   35.00, '2026-02-20 17:55:00'),
  ( 9, 'shipped',    149.99, '2026-03-01 10:00:00'),
  (10, 'delivered',   59.99, '2026-03-10 12:30:00'),
  (11, 'processing',  89.99, '2026-03-22 09:15:00'),
  (12, 'delivered',   74.98, '2026-04-01 14:00:00'),
  (13, 'shipped',    434.98, '2026-04-10 11:00:00'),
  (14, 'pending',     18.99, '2026-04-18 08:45:00'),
  (15, 'delivered',  129.98, '2026-05-02 15:20:00'),
  ( 1, 'processing',  89.99, '2026-05-10 10:00:00'),
  ( 3, 'delivered',   40.00, '2026-05-15 09:30:00'),
  ( 5, 'shipped',     34.99, '2026-05-18 14:00:00');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  ( 1,  1, 1, 149.99),
  ( 1,  4, 1,  34.99),
  ( 2,  7, 1,  45.00),
  ( 3,  3, 1, 399.99),
  ( 4,  2, 1,  89.99),
  ( 5, 12, 1, 249.99),
  ( 6, 15, 1,  22.99),
  ( 7, 13, 1, 179.99),
  ( 8,  6, 1,  35.00),
  ( 9,  1, 1, 149.99),
  (10, 11, 1,  59.99),
  (11, 17, 1,  89.99),
  (12,  9, 1,  29.99),
  (12, 16, 1,  18.99),
  (12,  4, 1,  34.99), -- note: total rounded in orders row
  (13,  3, 1, 399.99),
  (13,  4, 1,  34.99),
  (14, 16, 1,  18.99),
  (15,  2, 1,  89.99),
  (15, 10, 1,  39.99),
  (16,  2, 1,  89.99),
  (17,  8, 1,  40.00),
  (18,  4, 1,  34.99);

INSERT INTO reviews (product_id, customer_id, rating, comment) VALUES
  ( 1,  1, 5, 'Amazing sound quality, very comfortable for long sessions.'),
  ( 1,  9, 4, 'Great headphones but the case feels cheap.'),
  ( 2,  4, 5, 'Best keyboard I have ever used. Tactile and quiet.'),
  ( 3,  3, 5, 'Crystal clear display, worth every penny.'),
  ( 6,  2, 4, 'A must-read for any developer.'),
  ( 7,  8, 5, 'Changed the way I think about system design.'),
  (12,  5, 5, 'Super comfortable, my back pain is gone!'),
  (13,  7, 4, 'Solid build, easy to assemble.'),
  (15,  6, 5, 'Perfect thickness, non-slip surface.'),
  (17, 11, 4, 'Good cushioning, runs slightly small.'),
  ( 9, 12, 3, 'Decent quality but the sizing is off.'),
  (11, 10, 5, 'So warm and soft, great for winter.'),
  ( 4, 13, 4, 'Handy hub, all ports work perfectly.'),
  ( 5, 14, 3, 'Image quality is okay, autofocus is slow.'),
  ( 8, 15, 5, 'Timeless advice, re-read it every year.');
