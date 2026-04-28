-- Database Schema for Booking System (PostgreSQL / Supabase)

-- 1. Activities Table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  total_tables INT NOT NULL DEFAULT 1
);

-- Insert initial activities
INSERT INTO activities (name, total_tables) VALUES
  ('8-Ball Pool', 1),
  ('Foosball', 1),
  ('Air Hockey', 1);

-- 2. Bookings Table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Add a constraint to ensure start_time is either on the hour or half hour
  CONSTRAINT valid_start_time CHECK (
    EXTRACT(MINUTE FROM start_time) IN (0, 30) AND
    EXTRACT(SECOND FROM start_time) = 0
  )
);

-- 3. Indexes for performance on availability queries
CREATE INDEX idx_bookings_date_activity ON bookings(booking_date, activity_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
