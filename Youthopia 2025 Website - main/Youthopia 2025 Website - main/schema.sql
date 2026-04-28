-- =========================================================
-- LEVEL UP — Database Schema (PostgreSQL / Supabase)
-- Run this in the Supabase SQL editor.
-- =========================================================

-- 1. Activities
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  total_tables    INT NOT NULL DEFAULT 1,
  price_per_slot  INT NOT NULL DEFAULT 200,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS price_per_slot INT NOT NULL DEFAULT 200;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255) NOT NULL,
  customer_phone  VARCHAR(32),
  booking_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_start_time CHECK (
    EXTRACT(MINUTE FROM start_time) IN (0, 30) AND
    EXTRACT(SECOND FROM start_time) = 0
  )
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_bookings_date_activity ON bookings(booking_date, activity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time   ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_activities_is_active  ON activities(is_active);

-- =========================================================
-- 3. Row Level Security
-- =========================================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings   ENABLE ROW LEVEL SECURITY;

-- Anyone can read active activities
DROP POLICY IF EXISTS "Public read active activities" ON activities;
CREATE POLICY "Public read active activities"
  ON activities FOR SELECT USING (is_active = true);

-- Authenticated users (admins) can read everything including inactive
DROP POLICY IF EXISTS "Auth read all activities" ON activities;
CREATE POLICY "Auth read all activities"
  ON activities FOR SELECT USING (auth.role() = 'authenticated');

-- Only authenticated users can create/update/delete activities
DROP POLICY IF EXISTS "Auth insert activities" ON activities;
CREATE POLICY "Auth insert activities"
  ON activities FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth update activities" ON activities;
CREATE POLICY "Auth update activities"
  ON activities FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth delete activities" ON activities;
CREATE POLICY "Auth delete activities"
  ON activities FOR DELETE USING (auth.role() = 'authenticated');

-- Anyone can read bookings (needed for availability counting)
DROP POLICY IF EXISTS "Public read bookings" ON bookings;
CREATE POLICY "Public read bookings"
  ON bookings FOR SELECT USING (true);

-- Anyone can insert a booking
DROP POLICY IF EXISTS "Public insert bookings" ON bookings;
CREATE POLICY "Public insert bookings"
  ON bookings FOR INSERT WITH CHECK (true);

-- Only authenticated users can delete bookings
DROP POLICY IF EXISTS "Auth delete bookings" ON bookings;
CREATE POLICY "Auth delete bookings"
  ON bookings FOR DELETE USING (auth.role() = 'authenticated');

-- =========================================================
-- 4. Seed data (only if table is empty)
-- =========================================================
INSERT INTO activities (name, total_tables, price_per_slot)
SELECT * FROM (VALUES
  ('8-Ball Pool', 1, 200),
  ('Foosball',    1, 150),
  ('Air Hockey',  1, 180)
) AS v(name, total_tables, price_per_slot)
WHERE NOT EXISTS (SELECT 1 FROM activities);
