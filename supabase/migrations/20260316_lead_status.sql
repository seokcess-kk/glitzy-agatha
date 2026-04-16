-- 리드 상태 컬럼 추가 (캠페인 리드 아웃바운딩 관리용)
-- 상태값: new(신규), no_answer(부재), consulted(상담완료), booked(예약완료), hold(보류), rejected(거절)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_status VARCHAR(20) DEFAULT 'new';
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON leads(lead_status);
