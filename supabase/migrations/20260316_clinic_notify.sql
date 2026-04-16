-- 병원 담당자 알림 설정 컬럼 추가
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS notify_phone VARCHAR(20);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN DEFAULT false;
