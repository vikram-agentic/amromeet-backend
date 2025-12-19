-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  phone VARCHAR(20),
  bio TEXT,
  website VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'en',
  notification_email BOOLEAN DEFAULT TRUE,
  notification_sms BOOLEAN DEFAULT FALSE,
  notification_push BOOLEAN DEFAULT TRUE,
  auto_reschedule BOOLEAN DEFAULT FALSE,
  default_meeting_duration INTEGER DEFAULT 30,
  buffer_time_before INTEGER DEFAULT 0,
  buffer_time_after INTEGER DEFAULT 0,
  max_bookings_per_day INTEGER,
  enable_cancellations BOOLEAN DEFAULT TRUE,
  cancellation_notice_hours INTEGER DEFAULT 24,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event types table
CREATE TABLE IF NOT EXISTS event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  color VARCHAR(7) DEFAULT '#14b8a6',
  is_active BOOLEAN DEFAULT TRUE,
  location_type VARCHAR(50) DEFAULT 'google_meet',
  custom_location VARCHAR(255),
  google_meet_required BOOLEAN DEFAULT TRUE,
  buffer_time_before INTEGER DEFAULT 0,
  buffer_time_after INTEGER DEFAULT 0,
  min_advance_notice_minutes INTEGER DEFAULT 0,
  max_advance_booking_days INTEGER DEFAULT 365,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(user_id, slug)
);

-- Availability/Time slots table
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocked dates/times table
CREATE TABLE IF NOT EXISTS blocked_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  reason VARCHAR(100),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type_id UUID NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(20),
  guest_timezone VARCHAR(50),
  scheduled_at TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  description TEXT,
  google_meet_link VARCHAR(255),
  status VARCHAR(50) DEFAULT 'confirmed',
  notes TEXT,
  custom_fields JSONB,
  google_calendar_event_id VARCHAR(255),
  google_calendar_event_link VARCHAR(255),
  reminder_sent_at TIMESTAMP,
  confirmation_sent_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Integrations table (for storing API keys, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, type, provider)
);

-- Page customization table
CREATE TABLE IF NOT EXISTS page_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  hero_image VARCHAR(255),
  logo_url VARCHAR(255),
  primary_color VARCHAR(7) DEFAULT '#14b8a6',
  secondary_color VARCHAR(7) DEFAULT '#1e293b',
  background_image VARCHAR(255),
  custom_css TEXT,
  show_powered_by BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL,
  event_type VARCHAR(100),
  action_type VARCHAR(100),
  visitor_count INTEGER DEFAULT 0,
  booking_count INTEGER DEFAULT 0,
  cancellation_count INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_type_id, date)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_event_types_user_id ON event_types(user_id);
CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(slug);
CREATE INDEX IF NOT EXISTS idx_event_types_deleted_at ON event_types(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_type_id ON bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_blocked_times_user_id ON blocked_times(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_times_start_time ON blocked_times(start_time);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
