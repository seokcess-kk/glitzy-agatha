-- 삭제 데이터 스냅샷 보관 테이블
-- 실제 삭제 전 원본 데이터를 JSONB로 보관하여 히스토리 유지
CREATE TABLE IF NOT EXISTS deleted_records (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  record_data JSONB NOT NULL,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  clinic_id INTEGER,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_table ON deleted_records(table_name);
CREATE INDEX IF NOT EXISTS idx_deleted_records_clinic ON deleted_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at ON deleted_records(deleted_at DESC);
