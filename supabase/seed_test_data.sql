-- Samantha 테스트 데이터 시드
-- Supabase Dashboard > SQL Editor에서 실행

-- 변수: 테스트할 clinic_id (없으면 NULL)
-- 실제 clinic이 있다면 해당 ID로 변경하세요
DO $$
DECLARE
  v_clinic_id INTEGER := 1;  -- 테스트용 clinic_id
  v_customer_id INTEGER;
  v_lead_id INTEGER;
  v_booking_id INTEGER;
BEGIN

-- 1. 테스트용 clinic 생성 (없는 경우)
INSERT INTO clinics (id, name, slug, created_at)
VALUES (1, '테스트병원', 'test-clinic', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. 고객 + 리드 + 예약 + 상담 + 결제 데이터 생성

-- ============================================
-- 채널: Meta (spring_promo 캠페인) - 10명
-- ============================================

-- 고객 1: Meta → 예약 → 방문 → 상담 → 결제 (풀퍼널)
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0001', '김메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '20 days')
RETURNING id INTO v_customer_id;

INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_content, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', 'banner_v1', NOW() - INTERVAL '20 days', true)
RETURNING id INTO v_lead_id;

INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '18 days', 'visited', NOW() - INTERVAL '19 days');

INSERT INTO consultations (customer_id, clinic_id, status, consultation_date, notes, created_at)
VALUES (v_customer_id, v_clinic_id, '시술확정', (NOW() - INTERVAL '18 days')::date, '리프팅 상담 완료', NOW() - INTERVAL '18 days');

INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '울쎄라 리프팅', 2500000, (NOW() - INTERVAL '17 days')::date, NOW() - INTERVAL '17 days');

-- 고객 2: Meta → 예약 → 방문 → 결제
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0002', '이메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '18 days')
RETURNING id INTO v_customer_id;

INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_content, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', 'video_30s', NOW() - INTERVAL '18 days', true);

INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '15 days', 'treatment_confirmed', NOW() - INTERVAL '16 days');

INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '보톡스', 350000, (NOW() - INTERVAL '14 days')::date, NOW() - INTERVAL '14 days');

-- 고객 3: Meta → 예약 → 방문 (상담 중)
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0003', '박메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '10 days')
RETURNING id INTO v_customer_id;

INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '10 days', true);

INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '7 days', 'visited', NOW() - INTERVAL '8 days');

INSERT INTO consultations (customer_id, clinic_id, status, consultation_date, created_at)
VALUES (v_customer_id, v_clinic_id, '상담중', (NOW() - INTERVAL '7 days')::date, NOW() - INTERVAL '7 days');

-- 고객 4-6: Meta → 예약만
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0004', '최메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '8 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '8 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '3 days', 'confirmed', NOW() - INTERVAL '7 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0005', '정메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '5 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '5 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '5 days', 'confirmed', NOW() - INTERVAL '4 days');

-- 고객 7-10: Meta → 리드만 (예약 안 함)
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0006', '강메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '3 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '3 days', true);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0007', '조메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '2 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '2 days', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0008', '윤메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '1 day')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '1 day', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-1001-0009', '장메타', 'meta', 'spring_promo', v_clinic_id, NOW() - INTERVAL '12 hours')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '12 hours', false);

-- ============================================
-- 채널: Google (search_brand 캠페인) - 8명
-- ============================================

-- 고객 1-2: Google → 풀퍼널
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0001', '김구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '25 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_term, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', '강남성형외과', NOW() - INTERVAL '25 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '22 days', 'treatment_confirmed', NOW() - INTERVAL '23 days');
INSERT INTO consultations (customer_id, clinic_id, status, consultation_date, created_at)
VALUES (v_customer_id, v_clinic_id, '시술확정', (NOW() - INTERVAL '22 days')::date, NOW() - INTERVAL '22 days');
INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '코필러', 800000, (NOW() - INTERVAL '21 days')::date, NOW() - INTERVAL '21 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0002', '이구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '15 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_term, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', '보톡스가격', NOW() - INTERVAL '15 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '12 days', 'visited', NOW() - INTERVAL '13 days');
INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '보톡스', 280000, (NOW() - INTERVAL '11 days')::date, NOW() - INTERVAL '11 days');

-- 고객 3-4: Google → 예약만
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0003', '박구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '7 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '7 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '2 days', 'confirmed', NOW() - INTERVAL '5 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0004', '최구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '4 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '4 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '7 days', 'confirmed', NOW() - INTERVAL '3 days');

-- 고객 5-8: Google → 리드만
INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0005', '정구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '3 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '3 days', true);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0006', '강구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '2 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '2 days', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0007', '조구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '1 day')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '1 day', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-2001-0008', '윤구글', 'google', 'search_brand', v_clinic_id, NOW() - INTERVAL '6 hours')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '6 hours', false);

-- ============================================
-- 채널: Phone (전화 문의) - 5명, 전환율 높음
-- ============================================

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-3001-0001', '김전화', 'phone', NULL, v_clinic_id, NOW() - INTERVAL '14 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'phone', NOW() - INTERVAL '14 days', false);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '12 days', 'treatment_confirmed', NOW() - INTERVAL '13 days');
INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '쌍꺼풀 수술', 1500000, (NOW() - INTERVAL '10 days')::date, NOW() - INTERVAL '10 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-3001-0002', '이전화', 'phone', NULL, v_clinic_id, NOW() - INTERVAL '10 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'phone', NOW() - INTERVAL '10 days', false);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '8 days', 'visited', NOW() - INTERVAL '9 days');
INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '필러', 450000, (NOW() - INTERVAL '7 days')::date, NOW() - INTERVAL '7 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-3001-0003', '박전화', 'phone', NULL, v_clinic_id, NOW() - INTERVAL '5 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'phone', NOW() - INTERVAL '5 days', false);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '1 day', 'confirmed', NOW() - INTERVAL '4 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-3001-0004', '최전화', 'phone', NULL, v_clinic_id, NOW() - INTERVAL '2 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'phone', NOW() - INTERVAL '2 days', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-3001-0005', '정전화', 'phone', NULL, v_clinic_id, NOW() - INTERVAL '1 day')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'phone', NOW() - INTERVAL '1 day', false);

-- ============================================
-- 채널: Naver (naver_blog 캠페인) - 4명
-- ============================================

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-4001-0001', '김네이버', 'naver', 'naver_blog', v_clinic_id, NOW() - INTERVAL '12 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'naver', 'blog', 'naver_blog', NOW() - INTERVAL '12 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '9 days', 'visited', NOW() - INTERVAL '10 days');
INSERT INTO payments (customer_id, clinic_id, treatment_name, payment_amount, payment_date, created_at)
VALUES (v_customer_id, v_clinic_id, '스킨 보톡스', 180000, (NOW() - INTERVAL '8 days')::date, NOW() - INTERVAL '8 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-4001-0002', '이네이버', 'naver', 'naver_blog', v_clinic_id, NOW() - INTERVAL '6 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'naver', 'blog', 'naver_blog', NOW() - INTERVAL '6 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() + INTERVAL '4 days', 'confirmed', NOW() - INTERVAL '5 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-4001-0003', '박네이버', 'naver', 'naver_blog', v_clinic_id, NOW() - INTERVAL '3 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'naver', 'blog', 'naver_blog', NOW() - INTERVAL '3 days', false);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-4001-0004', '최네이버', 'naver', 'naver_blog', v_clinic_id, NOW() - INTERVAL '1 day')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'naver', 'blog', 'naver_blog', NOW() - INTERVAL '1 day', false);

-- ============================================
-- 채널: TikTok (summer_sale 캠페인) - 3명
-- ============================================

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-5001-0001', '김틱톡', 'tiktok', 'summer_sale', v_clinic_id, NOW() - INTERVAL '8 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'tiktok', 'short', 'summer_sale', NOW() - INTERVAL '8 days', true);
INSERT INTO bookings (customer_id, clinic_id, booking_datetime, status, created_at)
VALUES (v_customer_id, v_clinic_id, NOW() - INTERVAL '5 days', 'visited', NOW() - INTERVAL '6 days');

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-5001-0002', '이틱톡', 'tiktok', 'summer_sale', v_clinic_id, NOW() - INTERVAL '4 days')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'tiktok', 'short', 'summer_sale', NOW() - INTERVAL '4 days', true);

INSERT INTO customers (phone_number, name, first_source, first_campaign_id, clinic_id, created_at)
VALUES ('010-5001-0003', '박틱톡', 'tiktok', 'summer_sale', v_clinic_id, NOW() - INTERVAL '1 day')
RETURNING id INTO v_customer_id;
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'tiktok', 'short', 'summer_sale', NOW() - INTERVAL '1 day', false);

-- ============================================
-- 광고 비용 데이터 (ad_campaign_stats)
-- ============================================

-- Meta 광고비 (최근 4주)
INSERT INTO ad_campaign_stats (clinic_id, platform, campaign_id, campaign_name, stat_date, impressions, clicks, spend_amount) VALUES
(v_clinic_id, 'meta', 'meta_spring_001', 'spring_promo', (NOW() - INTERVAL '28 days')::date, 50000, 1200, 150000),
(v_clinic_id, 'meta', 'meta_spring_001', 'spring_promo', (NOW() - INTERVAL '21 days')::date, 55000, 1350, 165000),
(v_clinic_id, 'meta', 'meta_spring_001', 'spring_promo', (NOW() - INTERVAL '14 days')::date, 48000, 1100, 140000),
(v_clinic_id, 'meta', 'meta_spring_001', 'spring_promo', (NOW() - INTERVAL '7 days')::date, 52000, 1250, 155000);

-- Google 광고비
INSERT INTO ad_campaign_stats (clinic_id, platform, campaign_id, campaign_name, stat_date, impressions, clicks, spend_amount) VALUES
(v_clinic_id, 'google', 'google_brand_001', 'search_brand', (NOW() - INTERVAL '28 days')::date, 30000, 800, 120000),
(v_clinic_id, 'google', 'google_brand_001', 'search_brand', (NOW() - INTERVAL '21 days')::date, 32000, 850, 130000),
(v_clinic_id, 'google', 'google_brand_001', 'search_brand', (NOW() - INTERVAL '14 days')::date, 28000, 750, 110000),
(v_clinic_id, 'google', 'google_brand_001', 'search_brand', (NOW() - INTERVAL '7 days')::date, 35000, 900, 140000);

-- TikTok 광고비
INSERT INTO ad_campaign_stats (clinic_id, platform, campaign_id, campaign_name, stat_date, impressions, clicks, spend_amount) VALUES
(v_clinic_id, 'tiktok', 'tiktok_summer_001', 'summer_sale', (NOW() - INTERVAL '14 days')::date, 80000, 2000, 100000),
(v_clinic_id, 'tiktok', 'tiktok_summer_001', 'summer_sale', (NOW() - INTERVAL '7 days')::date, 95000, 2400, 120000);

-- ============================================
-- 다중 리드 테스트 (재방문 고객)
-- ============================================

-- 김메타: 2번째 유입 (다른 캠페인으로 재방문)
SELECT id INTO v_customer_id FROM customers WHERE phone_number = '010-1001-0001';
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_content, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'retargeting_01', '리프팅재방문', NOW() - INTERVAL '5 days', true);

-- 김메타: 3번째 유입 (네이버로 재방문)
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'naver', 'blog', 'summer_event', NOW() - INTERVAL '1 day', false);

-- 이메타: 2번째 유입
SELECT id INTO v_customer_id FROM customers WHERE phone_number = '010-1001-0002';
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'summer_sale', NOW() - INTERVAL '3 days', true);

-- 김구글: 2번째 유입 (Meta 광고로 재방문)
SELECT id INTO v_customer_id FROM customers WHERE phone_number = '010-2001-0001';
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, utm_content, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'display', 'retargeting_01', 'banner_re', NOW() - INTERVAL '2 days', true);

-- 김전화: 광고로 재방문 (2번째)
SELECT id INTO v_customer_id FROM customers WHERE phone_number = '010-3001-0001';
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'meta', 'cpc', 'spring_promo', NOW() - INTERVAL '4 days', true);

-- 김네이버: 2번째 유입 (Google로)
SELECT id INTO v_customer_id FROM customers WHERE phone_number = '010-4001-0001';
INSERT INTO leads (customer_id, clinic_id, utm_source, utm_medium, utm_campaign, created_at, chatbot_sent)
VALUES (v_customer_id, v_clinic_id, 'google', 'cpc', 'search_brand', NOW() - INTERVAL '3 days', true);

RAISE NOTICE '테스트 데이터 생성 완료!';
RAISE NOTICE '- 고객: 30명';
RAISE NOTICE '- 리드: 36건 (다중 리드 6건 추가)';
RAISE NOTICE '- 예약: 15건';
RAISE NOTICE '- 결제: 8건';
RAISE NOTICE '- 총 결제액: 약 6,060,000원';
RAISE NOTICE '';
RAISE NOTICE '다중 리드 고객 (테스트용):';
RAISE NOTICE '  - 김메타 (010-1001-0001): 3회 유입';
RAISE NOTICE '  - 이메타 (010-1001-0002): 2회 유입';
RAISE NOTICE '  - 김구글 (010-2001-0001): 2회 유입';
RAISE NOTICE '  - 김전화 (010-3001-0001): 2회 유입';
RAISE NOTICE '  - 김네이버 (010-4001-0001): 2회 유입';

END $$;

-- 확인 쿼리
SELECT
  'customers' as table_name, COUNT(*) as count FROM customers WHERE clinic_id = 1
UNION ALL
SELECT 'leads', COUNT(*) FROM leads WHERE clinic_id = 1
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings WHERE clinic_id = 1
UNION ALL
SELECT 'consultations', COUNT(*) FROM consultations WHERE clinic_id = 1
UNION ALL
SELECT 'payments', COUNT(*) FROM payments WHERE clinic_id = 1
UNION ALL
SELECT 'ad_campaign_stats', COUNT(*) FROM ad_campaign_stats WHERE clinic_id = 1;
