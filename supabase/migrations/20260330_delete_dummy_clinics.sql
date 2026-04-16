-- 더미 병원 3곳(미래성형외과, 강남피부과의원, 서울치과) 및 관련 데이터 전체 삭제
-- slug: mirae, kangnam, seoul

DO $$
DECLARE
  _clinic_ids INT[];
BEGIN
  SELECT ARRAY(SELECT id FROM clinics WHERE slug IN ('mirae', 'kangnam', 'seoul')) INTO _clinic_ids;

  IF array_length(_clinic_ids, 1) IS NULL THEN
    RAISE NOTICE 'No dummy clinics found. Skipping.';
    RETURN;
  END IF;

  -- ═══ NO ACTION FK 테이블 (수동 삭제 필수, 의존 순서) ═══

  -- payments → customers FK
  DELETE FROM payments WHERE clinic_id = ANY(_clinic_ids);
  -- bookings → customers FK, bookings → users(created_by) FK
  DELETE FROM bookings WHERE clinic_id = ANY(_clinic_ids);
  -- consultations → customers FK
  DELETE FROM consultations WHERE clinic_id = ANY(_clinic_ids);
  -- capi_events
  DELETE FROM capi_events WHERE clinic_id = ANY(_clinic_ids);
  -- mc_verification_logs
  DELETE FROM mc_verification_logs WHERE clinic_id = ANY(_clinic_ids);
  -- leads → customers FK
  DELETE FROM leads WHERE clinic_id = ANY(_clinic_ids);
  -- customers (payments/bookings/consultations/leads 삭제 후)
  DELETE FROM customers WHERE clinic_id = ANY(_clinic_ids);
  -- content_stats → content_posts FK
  DELETE FROM content_stats
    WHERE post_id IN (SELECT id FROM content_posts WHERE clinic_id = ANY(_clinic_ids));
  DELETE FROM content_audits
    WHERE clinic_id = ANY(_clinic_ids);
  DELETE FROM content_posts WHERE clinic_id = ANY(_clinic_ids);
  -- ad_campaign_stats
  DELETE FROM ad_campaign_stats WHERE clinic_id = ANY(_clinic_ids);
  -- clinic_api_configs
  DELETE FROM clinic_api_configs WHERE clinic_id = ANY(_clinic_ids);
  -- press_coverage
  DELETE FROM press_coverage WHERE clinic_id = ANY(_clinic_ids);
  -- deleted_records (FK 없지만 정리)
  DELETE FROM deleted_records WHERE clinic_id = ANY(_clinic_ids);
  -- users (bookings.created_by 참조 해소 후)
  DELETE FROM users WHERE clinic_id = ANY(_clinic_ids);

  -- ═══ clinics 삭제 → CASCADE 테이블 자동 정리 ═══
  -- ad_creatives, ad_stats, clinic_treatments, monitoring_keywords,
  -- oauth_states, press_keywords, user_clinic_assignments,
  -- utm_links, utm_templates
  -- + SET NULL: activity_logs, landing_pages, sms_send_logs
  DELETE FROM clinics WHERE id = ANY(_clinic_ids);

  RAISE NOTICE 'Deleted % dummy clinic(s) and all related data.', array_length(_clinic_ids, 1);
END $$;
