-- capi_events.lead_id FK를 ON DELETE CASCADE로 변경
-- 리드 삭제 시 관련 CAPI 이벤트 로그도 함께 삭제
ALTER TABLE capi_events
  DROP CONSTRAINT capi_events_lead_id_fkey,
  ADD CONSTRAINT capi_events_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
