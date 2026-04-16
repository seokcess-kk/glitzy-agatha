-- ============================================================
-- Agatha — Marketing Intelligence
-- 초기 DB 스키마 (새 프로젝트용)
-- ============================================================

-- 1. clients (클라이언트 — 멀티테넌트 단위)
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE,
  monthly_budget DECIMAL(12,2),
  erp_client_id TEXT,  -- glitzy-web 거래처 ID (UUID, 견적/계산서 연동용)
  is_active BOOLEAN DEFAULT TRUE,
  notify_phones TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. users (시스템 사용자)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'agency_staff', 'client_admin', 'client_staff', 'demo_viewer')),
  client_id INTEGER REFERENCES clients(id),
  is_active BOOLEAN DEFAULT TRUE,
  password_version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. user_client_assignments (agency_staff ↔ 클라이언트 다대다)
CREATE TABLE user_client_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- 4. user_menu_permissions (사용자별 메뉴 접근 권한)
CREATE TABLE user_menu_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  menu_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, menu_key)
);

-- 5. contacts (연락처 — 전화번호 기반 고객 식별)
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  first_source VARCHAR(50),
  first_campaign_id VARCHAR(100),
  total_conversions INTEGER DEFAULT 0,
  total_conversion_value DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, phone_number)
);

-- 6. leads (리드 — 유입 건 단위)
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  -- UTM 파라미터
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(200),
  utm_term VARCHAR(100),
  -- 유입 정보
  landing_page_id INTEGER,
  inflow_url TEXT,
  campaign_id VARCHAR(100),
  -- 전환 추적
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'converted', 'lost', 'hold', 'invalid')),
  lost_reason VARCHAR(30),
  conversion_value DECIMAL(12,2),
  conversion_memo TEXT,
  -- 알림
  chatbot_sent BOOLEAN DEFAULT FALSE,
  chatbot_sent_at TIMESTAMP,
  -- 메타
  notes TEXT,
  status_changed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- 7. ad_campaign_stats (광고 캠페인 통계 — 일별)
CREATE TABLE ad_campaign_stats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  campaign_id VARCHAR(100),
  campaign_name VARCHAR(200),
  campaign_type VARCHAR(50),
  stat_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend_amount DECIMAL(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, platform, campaign_id, stat_date)
);

-- 8. ad_stats (광고 소재 통계 — 일별)
CREATE TABLE ad_stats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  ad_id VARCHAR(100),
  ad_name VARCHAR(200),
  campaign_id VARCHAR(100),
  platform VARCHAR(20),
  stat_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend_amount DECIMAL(12,2) DEFAULT 0,
  utm_content VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. ad_creatives (광고 소재 자산)
CREATE TABLE ad_creatives (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  name VARCHAR(200) NOT NULL,
  platform VARCHAR(20),
  thumbnail_url TEXT,
  utm_content VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. landing_pages (랜딩페이지)
CREATE TABLE landing_pages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  random_id VARCHAR(8) UNIQUE NOT NULL,
  title VARCHAR(200),
  template_path TEXT,
  original_filename VARCHAR(200),
  gtm_id VARCHAR(50),
  redirect_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- leads.landing_page_id FK (landing_pages 생성 후)
ALTER TABLE leads ADD CONSTRAINT leads_landing_page_fk
  FOREIGN KEY (landing_page_id) REFERENCES landing_pages(id) ON DELETE SET NULL;

-- 11. client_api_configs (클라이언트별 광고 플랫폼 API 설정)
CREATE TABLE client_api_configs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  platform VARCHAR(20) NOT NULL,
  config_data JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, platform)
);

-- 12. utm_templates (UTM 생성기 템플릿)
CREATE TABLE utm_templates (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  base_url TEXT,
  default_params JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. utm_links (생성된 UTM 링크)
CREATE TABLE utm_links (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  template_id INTEGER REFERENCES utm_templates(id),
  label VARCHAR(200),
  original_url TEXT NOT NULL,
  full_url TEXT NOT NULL,
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(200),
  utm_term VARCHAR(100),
  short_code VARCHAR(20),
  qr_data TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. monitoring_keywords (순위 모니터링 키워드)
CREATE TABLE monitoring_keywords (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  keyword VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  related_category VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. monitoring_rankings (일별 순위 기록)
CREATE TABLE monitoring_rankings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  keyword_id INTEGER REFERENCES monitoring_keywords(id) ON DELETE CASCADE,
  rank_date DATE NOT NULL,
  rank_position INTEGER,
  url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 16. invitations (초대 링크)
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  token VARCHAR(100) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  role VARCHAR(20) NOT NULL,
  invited_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. budget_history (예산 변경 이력)
CREATE TABLE budget_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  old_budget DECIMAL(12,2),
  new_budget DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2),
  memo TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 18. client_notify_settings (클라이언트별 알림 설정)
CREATE TABLE client_notify_settings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'sms',
  is_active BOOLEAN DEFAULT TRUE,
  recipients TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, event_type)
);

-- 19. activity_logs (감사 로그)
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(50),
  target_id INTEGER,
  detail JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 20. login_logs (로그인 이력)
CREATE TABLE login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  phone_number VARCHAR(20),
  ip_address VARCHAR(50),
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 21. deleted_records (삭제된 레코드 스냅샷)
CREATE TABLE deleted_records (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  data JSONB NOT NULL,
  deleted_by INTEGER REFERENCES users(id),
  deleted_at TIMESTAMP DEFAULT NOW()
);

-- 22. lead_raw_logs (리드 원본 데이터 — 멱등성 보장)
CREATE TABLE lead_raw_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  idempotency_key VARCHAR(100) UNIQUE,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 23. capi_events (Meta Conversion API 이벤트)
CREATE TABLE capi_events (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  event_name VARCHAR(50) NOT NULL,
  event_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  platform VARCHAR(20) DEFAULT 'meta',
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 24. sms_send_logs (SMS 발송 이력)
CREATE TABLE sms_send_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  phone_number VARCHAR(20),
  message_type VARCHAR(50),
  status VARCHAR(20),
  detail JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 25. oauth_states (OAuth 상태)
CREATE TABLE oauth_states (
  id SERIAL PRIMARY KEY,
  state VARCHAR(200) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  data JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 26. system_settings (시스템 전역 설정)
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 인덱스
-- ============================================================

-- contacts
CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_client ON contacts(client_id);

-- leads
CREATE INDEX idx_leads_client ON leads(client_id);
CREATE INDEX idx_leads_contact ON leads(contact_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_utm ON leads(utm_source, utm_campaign);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_client_created ON leads(client_id, created_at DESC);
CREATE INDEX idx_leads_landing_page ON leads(landing_page_id);

-- ad_campaign_stats
CREATE INDEX idx_ad_stats_client ON ad_campaign_stats(client_id);
CREATE INDEX idx_ad_stats_date ON ad_campaign_stats(stat_date);
CREATE INDEX idx_ad_stats_campaign ON ad_campaign_stats(campaign_id);

-- ad_stats
CREATE INDEX idx_ad_stats_detail_client ON ad_stats(client_id);
CREATE INDEX idx_ad_stats_detail_date ON ad_stats(stat_date);

-- monitoring
CREATE INDEX idx_monitoring_kw_client ON monitoring_keywords(client_id);
CREATE INDEX idx_monitoring_rank_keyword ON monitoring_rankings(keyword_id);
CREATE INDEX idx_monitoring_rank_date ON monitoring_rankings(rank_date);

-- invitations
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_client ON invitations(client_id);

-- budget_history
CREATE INDEX idx_budget_history_client ON budget_history(client_id);

-- client_notify_settings
CREATE INDEX idx_client_notify_client ON client_notify_settings(client_id);

-- activity_logs
CREATE INDEX idx_activity_logs_client ON activity_logs(client_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- login_logs
CREATE INDEX idx_login_logs_created ON login_logs(created_at DESC);

-- capi_events
CREATE INDEX idx_capi_events_lead ON capi_events(lead_id);

-- lead_raw_logs
CREATE INDEX idx_lead_raw_logs_key ON lead_raw_logs(idempotency_key);

-- ============================================================
-- 초기 superadmin 계정 (비밀번호: 실제 운영 시 변경 필수)
-- bcrypt hash of 'admin1234' (cost 10)
-- ============================================================
-- INSERT INTO users (phone_number, password_hash, name, role)
-- VALUES ('01012345678', '$2a$10$XXXXX...실제해시값...', '관리자', 'superadmin');
