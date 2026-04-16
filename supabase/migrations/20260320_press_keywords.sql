-- 언론보도 다중 키워드 지원
CREATE TABLE press_keywords (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, keyword)
);

CREATE INDEX idx_press_keywords_clinic ON press_keywords(clinic_id);

-- press_coverage에 keyword_id 추가 (기존 데이터는 NULL 허용)
ALTER TABLE press_coverage ADD COLUMN keyword_id INTEGER REFERENCES press_keywords(id) ON DELETE SET NULL;
CREATE INDEX idx_press_coverage_keyword ON press_coverage(keyword_id);
