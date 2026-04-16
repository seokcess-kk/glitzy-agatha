-- clinic_api_configs 테이블 스키마 보완
-- 누락 컬럼 추가 (광고 API 키 관리용)

-- 누락 컬럼 추가
ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;
ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS last_test_result VARCHAR(20);
ALTER TABLE clinic_api_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- clinic_id NOT NULL 변경 (기존 NULL 데이터 없다고 가정, 있으면 먼저 정제)
ALTER TABLE clinic_api_configs ALTER COLUMN clinic_id SET NOT NULL;

-- UNIQUE 제약 (없으면 추가)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'clinic_api_configs'::regclass
    AND contype = 'u'
    AND conname LIKE '%clinic_id%platform%'
  ) THEN
    ALTER TABLE clinic_api_configs ADD CONSTRAINT clinic_api_configs_clinic_id_platform_key UNIQUE (clinic_id, platform);
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_clinic ON clinic_api_configs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_api_configs_active ON clinic_api_configs(clinic_id, is_active);
