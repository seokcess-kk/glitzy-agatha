-- 1. agency_staff 다중 병원 배정
CREATE TABLE user_clinic_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

-- 2. 계정별 메뉴 권한
CREATE TABLE user_menu_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, menu_key)
);

-- 3. 모니터링 키워드
CREATE TABLE monitoring_keywords (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('place', 'website', 'smartblock')),
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, keyword, category)
);

-- 4. 일별 순위 데이터
CREATE TABLE monitoring_rankings (
  id BIGSERIAL PRIMARY KEY,
  keyword_id INTEGER NOT NULL REFERENCES monitoring_keywords(id) ON DELETE CASCADE,
  rank_date DATE NOT NULL,
  rank_position INTEGER,
  url TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword_id, rank_date)
);

CREATE INDEX idx_monitoring_rankings_date ON monitoring_rankings(rank_date);
CREATE INDEX idx_monitoring_keywords_clinic ON monitoring_keywords(clinic_id);
CREATE INDEX idx_user_clinic_assignments_user ON user_clinic_assignments(user_id);
