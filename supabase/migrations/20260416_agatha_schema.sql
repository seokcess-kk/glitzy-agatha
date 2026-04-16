-- Agatha Schema Migration
-- Phase 3 + Phase 4: 인증 시스템 변경 + DB 스키마 리팩터링

-- 1. 테이블 리네이밍
ALTER TABLE IF EXISTS clinics RENAME TO clients;
ALTER TABLE IF EXISTS customers RENAME TO contacts;
ALTER TABLE IF EXISTS user_clinic_assignments RENAME TO user_client_assignments;
ALTER TABLE IF EXISTS clinic_api_configs RENAME TO client_api_configs;

-- 2. 컬럼 리네이밍 (모든 테이블의 clinic_id → client_id)
ALTER TABLE users RENAME COLUMN clinic_id TO client_id;
ALTER TABLE contacts RENAME COLUMN clinic_id TO client_id;
ALTER TABLE leads RENAME COLUMN clinic_id TO client_id;
ALTER TABLE leads RENAME COLUMN customer_id TO contact_id;
ALTER TABLE ad_campaign_stats RENAME COLUMN clinic_id TO client_id;
ALTER TABLE landing_pages RENAME COLUMN clinic_id TO client_id;
ALTER TABLE ad_creatives RENAME COLUMN clinic_id TO client_id;
ALTER TABLE monitoring_keywords RENAME COLUMN clinic_id TO client_id;
ALTER TABLE monitoring_rankings RENAME COLUMN clinic_id TO client_id;
ALTER TABLE activity_logs RENAME COLUMN clinic_id TO client_id;
ALTER TABLE lead_raw_logs RENAME COLUMN clinic_id TO client_id;
ALTER TABLE capi_events RENAME COLUMN clinic_id TO client_id;
ALTER TABLE utm_templates RENAME COLUMN clinic_id TO client_id;
ALTER TABLE utm_links RENAME COLUMN clinic_id TO client_id;
ALTER TABLE user_client_assignments RENAME COLUMN clinic_id TO client_id;
ALTER TABLE client_api_configs RENAME COLUMN clinic_id TO client_id;
ALTER TABLE sms_send_logs RENAME COLUMN clinic_id TO client_id;

-- 3. users 테이블 변경 (username → phone_number)
ALTER TABLE users RENAME COLUMN username TO phone_number;
-- phone_number UNIQUE 제약 추가 (없으면)
ALTER TABLE users ADD CONSTRAINT users_phone_number_unique UNIQUE (phone_number);

-- 4. 역할명 변경
UPDATE users SET role = 'client_admin' WHERE role = 'clinic_admin';
UPDATE users SET role = 'client_staff' WHERE role = 'clinic_staff';

-- 5. contacts 테이블 — 추가 컬럼
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_conversions INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_conversion_value DECIMAL(12,2) DEFAULT 0;

-- 6. leads 테이블 — 추가 컬럼
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversion_value DECIMAL(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversion_memo TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(30);

-- 7. 신규 테이블: invitations
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  token VARCHAR(100) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  role VARCHAR(20) NOT NULL,
  invited_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. 신규 테이블: budget_history
CREATE TABLE IF NOT EXISTS budget_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  old_budget DECIMAL(12,2),
  new_budget DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2),
  memo TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 9. 신규 테이블: client_notify_settings
CREATE TABLE IF NOT EXISTS client_notify_settings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'sms',
  is_active BOOLEAN DEFAULT TRUE,
  recipients TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, event_type)
);

-- 10. 병원 전용 테이블 삭제
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS clinic_treatments CASCADE;
DROP TABLE IF EXISTS press_coverage CASCADE;
DROP TABLE IF EXISTS press_keywords CASCADE;
DROP TABLE IF EXISTS instagram_posts CASCADE;
DROP TABLE IF EXISTS youtube_videos CASCADE;
DROP TABLE IF EXISTS mc_law_articles CASCADE;
DROP TABLE IF EXISTS mc_procedures CASCADE;
DROP TABLE IF EXISTS mc_relations CASCADE;
DROP TABLE IF EXISTS mc_chunks CASCADE;
DROP TABLE IF EXISTS mc_verification_logs CASCADE;
DROP TABLE IF EXISTS chatbot_conversations CASCADE;
DROP TABLE IF EXISTS chatbot_messages CASCADE;

-- 11. 인덱스
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_client ON invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_client ON budget_history(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notify_client ON client_notify_settings(client_id);
