-- ============================================================
-- Agatha — public 스키마 전체 테이블에 RLS 활성화
-- ============================================================
-- 목적: Supabase 보안 린터의 rls_disabled_in_public,
--       sensitive_columns_exposed (invitations.token) ERROR 해소.
--
-- 원리: 백엔드 API는 모두 SUPABASE_SERVICE_ROLE_KEY로 접근하며
--       service_role은 RLS를 우회하므로 기존 동작에는 영향이 없다.
--       anon/authenticated 키로 PostgREST를 통해 들어오는 요청은
--       정책이 없어 모두 차단된다 (의도된 동작 — 클라이언트는
--       Next.js API routes를 거쳐서만 데이터를 조회한다).
--
-- 적용 방법:
--   Supabase 대시보드 → SQL Editor 에서 본 파일 전체 실행
--   또는 supabase CLI: supabase db push
-- ============================================================

ALTER TABLE public.clients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_stats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creatives            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_links               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_keywords     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_rankings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notify_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_raw_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capi_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_send_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings         ENABLE ROW LEVEL SECURITY;

-- 검증 쿼리 (선택):
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace
--   AND relkind = 'r'
-- ORDER BY relname;
