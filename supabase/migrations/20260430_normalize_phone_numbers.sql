-- 휴대폰 번호 표준을 "숫자만"으로 통일
-- 기존에 하이픈 포함으로 저장된 데이터를 일괄 정리
-- normalizePhoneNumber()가 하이픈 제거 방식으로 변경되면서 기존 데이터와 매칭되지 않는 문제 해결

-- users (로그인 계정): UNIQUE 제약이 있어 중복 발생 가능성 검토 필요
-- 하이픈 형식과 숫자 형식이 동일 사용자에게 둘 다 존재하면 수동 정리 후 재실행
UPDATE users
SET phone_number = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE phone_number ~ '[^0-9]';

-- contacts (CDP 고객): client_id + phone_number UNIQUE
UPDATE contacts
SET phone_number = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE phone_number ~ '[^0-9]';

-- 다른 phone_number 컬럼이 있는 테이블도 정리 (NULL 허용)
UPDATE login_logs
SET phone_number = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL AND phone_number ~ '[^0-9]';

-- sms_send_logs.phone_number는 알림 수신자(클라이언트 담당자)용 — 형식 변경 영향 적음
UPDATE sms_send_logs
SET phone_number = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL AND phone_number ~ '[^0-9]';
