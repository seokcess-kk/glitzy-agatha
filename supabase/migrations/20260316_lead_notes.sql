-- 리드 메모 컬럼 추가
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
