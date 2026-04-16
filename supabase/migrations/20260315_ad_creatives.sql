-- 광고 소재 관리 테이블
CREATE TABLE IF NOT EXISTS ad_creatives (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  landing_page_id INTEGER REFERENCES landing_pages(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,           -- "3월 프로모션 영상 30초"
  description TEXT,                      -- 소재 설명/메모
  utm_content VARCHAR(100) NOT NULL,    -- "video_30s_promo" (UTM에 사용될 값)
  platform VARCHAR(50),                  -- "meta", "google", "naver" 등
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ad_creatives_clinic_id ON ad_creatives(clinic_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_landing_page_id ON ad_creatives(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_is_active ON ad_creatives(is_active);

-- 같은 병원 내 utm_content 중복 방지 (유니크 제약)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_creatives_clinic_utm_content
ON ad_creatives(clinic_id, utm_content);

-- leads 테이블에 ad_creative_id 컬럼 추가 (향후 소재별 성과 추적용)
-- 현재는 utm_content로 소재를 식별하므로 선택적 사용
-- ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_creative_id INTEGER REFERENCES ad_creatives(id);
-- CREATE INDEX IF NOT EXISTS idx_leads_ad_creative_id ON leads(ad_creative_id);
