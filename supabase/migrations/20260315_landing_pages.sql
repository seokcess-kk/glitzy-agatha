-- 랜딩 페이지 관리 테이블
CREATE TABLE IF NOT EXISTS landing_pages (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,           -- "세레아 3월 프로모션"
  file_name VARCHAR(100) NOT NULL,      -- "lp_A1.html"
  description TEXT,                      -- 관리자 메모
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- leads 테이블에 컬럼 추가
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page_id INTEGER REFERENCES landing_pages(id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_landing_pages_clinic_id ON landing_pages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_is_active ON landing_pages(is_active);
CREATE INDEX IF NOT EXISTS idx_leads_landing_page_id ON leads(landing_page_id);

-- RLS 정책 (필요 시)
-- ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
