-- 병원별 시술 메뉴 카탈로그 (POS형 결제 입력용)
CREATE TABLE IF NOT EXISTS clinic_treatments (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  default_price INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(clinic_id, name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_clinic_treatments_clinic ON clinic_treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_treatments_active ON clinic_treatments(clinic_id, is_active);
