-- bookings 테이블에 created_at, updated_at 컬럼 추가
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN bookings.created_at IS '예약이 시스템에 등록/확정된 시점';
COMMENT ON COLUMN bookings.updated_at IS '예약 정보가 마지막으로 수정된 시점';
