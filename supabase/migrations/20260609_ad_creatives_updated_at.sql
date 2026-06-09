-- ============================================================
-- Agatha — ad_creatives 에 updated_at 컬럼 추가
-- ============================================================
-- 배경:
--   PUT /api/admin/ad-creatives/[id] 가 수정·활성화 토글 시 항상
--   updated_at 을 set 하는데, 초기 스키마(00000000_agatha_initial.sql)
--   와 후속 보강(20260515_ad_creatives_landing_page_fk.sql) 모두에서
--   updated_at 컬럼이 누락되어 있었다.
--   → PostgREST: "Could not find the 'updated_at' column of
--     'ad_creatives' in the schema cache" 에러로 모든 소재 수정/
--     활성화 토글이 실패.
--
--   다른 갱신 가능 테이블(client_api_configs, manual_inflows)과 동일하게
--   updated_at TIMESTAMPTZ DEFAULT NOW() 로 보강한다. idempotent.
--
-- 적용:
--   Supabase 대시보드 SQL Editor 에서 본 파일 전체 실행.
-- ============================================================

ALTER TABLE public.ad_creatives
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- PostgREST 스키마 캐시 강제 리로드
NOTIFY pgrst, 'reload schema';
