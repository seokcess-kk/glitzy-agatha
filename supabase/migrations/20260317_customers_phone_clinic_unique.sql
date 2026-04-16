-- 고객 전화번호 유니크 제약을 병원별 복합 유니크로 변경
-- 기존: phone_number 단독 UNIQUE → 다른 병원에서 동일 번호 고객 생성 불가
-- 변경: (phone_number, clinic_id) 복합 UNIQUE → 같은 병원 내에서만 중복 불가

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_number_key;
ALTER TABLE customers ADD CONSTRAINT customers_phone_clinic_unique UNIQUE (phone_number, clinic_id);
