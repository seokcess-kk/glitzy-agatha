-- 병원 알림 연락처 최대 3개 지원
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS notify_phones TEXT[] DEFAULT '{}';

-- 기존 단일 번호 마이그레이션
UPDATE clinics SET notify_phones = ARRAY[notify_phone]
  WHERE notify_phone IS NOT NULL AND notify_phone != ''
  AND (notify_phones IS NULL OR notify_phones = '{}');
