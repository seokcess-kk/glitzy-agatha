-- landing_pages ID를 8자리 랜덤 숫자로 변경
-- 기존 SERIAL → INTEGER (앱 레벨에서 생성)

-- 1. 시퀀스 기본값 제거
ALTER TABLE landing_pages ALTER COLUMN id DROP DEFAULT;

-- 2. 시퀀스 삭제
DROP SEQUENCE IF EXISTS landing_pages_id_seq;
