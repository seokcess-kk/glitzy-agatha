-- UTM 템플릿 및 링크 히스토리 테이블
-- 실행: Supabase Dashboard > SQL Editor에서 실행

-- 1. utm_templates 테이블 (캠페인 템플릿)
CREATE TABLE IF NOT EXISTS utm_templates (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  base_url VARCHAR(500),
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(200),
  utm_term VARCHAR(100),
  platform VARCHAR(30),
  is_default BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, name)
);

-- 2. utm_links 테이블 (생성된 링크 히스토리)
CREATE TABLE IF NOT EXISTS utm_links (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(200),
  utm_term VARCHAR(100),
  label VARCHAR(100),
  template_id INTEGER REFERENCES utm_templates(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_utm_templates_clinic ON utm_templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_utm_templates_default ON utm_templates(clinic_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_utm_links_clinic ON utm_links(clinic_id);
CREATE INDEX IF NOT EXISTS idx_utm_links_created ON utm_links(clinic_id, created_at DESC);

-- 4. 확인 쿼리
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('utm_templates', 'utm_links');
