-- 순위 모니터링 더미 데이터
-- Supabase Dashboard > SQL Editor에서 실행
-- 사전 조건: clinic_id=1 존재, monitoring_keywords/monitoring_rankings 테이블 생성 완료

DO $$
DECLARE
  v_clinic_id INTEGER := 1;
  v_kw_id INTEGER;
  v_day INTEGER;
  v_date DATE;
  v_base_rank INTEGER;
  v_rank INTEGER;
BEGIN

-- ============================================
-- 1. 키워드 등록
-- ============================================

-- 네이버 플레이스
INSERT INTO monitoring_keywords (clinic_id, keyword, category, is_active)
VALUES
  (v_clinic_id, '강남 성형외과', 'place', true),
  (v_clinic_id, '강남역 피부과', 'place', true),
  (v_clinic_id, '논현동 리프팅', 'place', true),
  (v_clinic_id, '강남 보톡스', 'place', true)
ON CONFLICT (clinic_id, keyword, category) DO NOTHING;

-- 웹사이트
INSERT INTO monitoring_keywords (clinic_id, keyword, category, is_active)
VALUES
  (v_clinic_id, '강남 성형외과 추천', 'website', true),
  (v_clinic_id, '울쎄라 리프팅 가격', 'website', true),
  (v_clinic_id, '쌍꺼풀 수술 잘하는 곳', 'website', true)
ON CONFLICT (clinic_id, keyword, category) DO NOTHING;

-- 스마트블록
INSERT INTO monitoring_keywords (clinic_id, keyword, category, is_active)
VALUES
  (v_clinic_id, '강남 성형외과', 'smartblock', true),
  (v_clinic_id, '보톡스 가격', 'smartblock', true),
  (v_clinic_id, '필러 후기', 'smartblock', true)
ON CONFLICT (clinic_id, keyword, category) DO NOTHING;

-- ============================================
-- 2. 3월 순위 데이터 (1일~16일)
-- ============================================

-- === 네이버 플레이스 ===

-- 강남 성형외과: 2~5위 왔다갔다, 점진적 상승
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '강남 성형외과' AND category = 'place';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 5),
  (v_kw_id, '2026-03-02', 5),
  (v_kw_id, '2026-03-03', 4),
  (v_kw_id, '2026-03-04', 4),
  (v_kw_id, '2026-03-05', 3),
  (v_kw_id, '2026-03-06', 4),
  (v_kw_id, '2026-03-07', 3),
  (v_kw_id, '2026-03-08', 3),
  (v_kw_id, '2026-03-09', 2),
  (v_kw_id, '2026-03-10', 3),
  (v_kw_id, '2026-03-11', 2),
  (v_kw_id, '2026-03-12', 2),
  (v_kw_id, '2026-03-13', 1),
  (v_kw_id, '2026-03-14', 2),
  (v_kw_id, '2026-03-15', 1),
  (v_kw_id, '2026-03-16', 1)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- 강남역 피부과: 7~12위, 약간 불안정
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '강남역 피부과' AND category = 'place';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 12),
  (v_kw_id, '2026-03-02', 11),
  (v_kw_id, '2026-03-03', 10),
  (v_kw_id, '2026-03-04', 11),
  (v_kw_id, '2026-03-05', 9),
  (v_kw_id, '2026-03-06', 10),
  (v_kw_id, '2026-03-07', 8),
  (v_kw_id, '2026-03-08', 9),
  (v_kw_id, '2026-03-09', 7),
  (v_kw_id, '2026-03-10', 8),
  (v_kw_id, '2026-03-11', 7),
  (v_kw_id, '2026-03-12', 7),
  (v_kw_id, '2026-03-13', 8),
  (v_kw_id, '2026-03-14', 7),
  (v_kw_id, '2026-03-15', 6),
  (v_kw_id, '2026-03-16', 7)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- 논현동 리프팅: 1~3위 상위 유지
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '논현동 리프팅' AND category = 'place';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 2),
  (v_kw_id, '2026-03-02', 1),
  (v_kw_id, '2026-03-03', 1),
  (v_kw_id, '2026-03-04', 2),
  (v_kw_id, '2026-03-05', 1),
  (v_kw_id, '2026-03-06', 1),
  (v_kw_id, '2026-03-07', 2),
  (v_kw_id, '2026-03-08', 1),
  (v_kw_id, '2026-03-09', 1),
  (v_kw_id, '2026-03-10', 1),
  (v_kw_id, '2026-03-11', 2),
  (v_kw_id, '2026-03-12', 1),
  (v_kw_id, '2026-03-13', 1),
  (v_kw_id, '2026-03-14', 1),
  (v_kw_id, '2026-03-15', 2),
  (v_kw_id, '2026-03-16', 1)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- 강남 보톡스: 15~20위 하위, 점진적 개선
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '강남 보톡스' AND category = 'place';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 20),
  (v_kw_id, '2026-03-02', 19),
  (v_kw_id, '2026-03-03', 18),
  (v_kw_id, '2026-03-04', 19),
  (v_kw_id, '2026-03-05', 17),
  (v_kw_id, '2026-03-06', 16),
  (v_kw_id, '2026-03-07', 18),
  (v_kw_id, '2026-03-08', 15),
  (v_kw_id, '2026-03-09', 14),
  (v_kw_id, '2026-03-10', 15),
  (v_kw_id, '2026-03-11', 13),
  (v_kw_id, '2026-03-12', 12),
  (v_kw_id, '2026-03-13', 13),
  (v_kw_id, '2026-03-14', 11),
  (v_kw_id, '2026-03-15', 10),
  (v_kw_id, '2026-03-16', 10)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- === 웹사이트 ===

-- 강남 성형외과 추천: 3~8위
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '강남 성형외과 추천' AND category = 'website';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 8),
  (v_kw_id, '2026-03-02', 7),
  (v_kw_id, '2026-03-03', 7),
  (v_kw_id, '2026-03-04', 6),
  (v_kw_id, '2026-03-05', 5),
  (v_kw_id, '2026-03-06', 6),
  (v_kw_id, '2026-03-07', 5),
  (v_kw_id, '2026-03-08', 4),
  (v_kw_id, '2026-03-09', 5),
  (v_kw_id, '2026-03-10', 4),
  (v_kw_id, '2026-03-11', 3),
  (v_kw_id, '2026-03-12', 4),
  (v_kw_id, '2026-03-13', 3),
  (v_kw_id, '2026-03-14', 3),
  (v_kw_id, '2026-03-15', 3),
  (v_kw_id, '2026-03-16', 3)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- 울쎄라 리프팅 가격: 1~4위 상위
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '울쎄라 리프팅 가격' AND category = 'website';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 3),
  (v_kw_id, '2026-03-02', 2),
  (v_kw_id, '2026-03-03', 2),
  (v_kw_id, '2026-03-04', 1),
  (v_kw_id, '2026-03-05', 2),
  (v_kw_id, '2026-03-06', 1),
  (v_kw_id, '2026-03-07', 1),
  (v_kw_id, '2026-03-08', 2),
  (v_kw_id, '2026-03-09', 1),
  (v_kw_id, '2026-03-10', 1),
  (v_kw_id, '2026-03-11', 1),
  (v_kw_id, '2026-03-12', 2),
  (v_kw_id, '2026-03-13', 1),
  (v_kw_id, '2026-03-14', 1),
  (v_kw_id, '2026-03-15', 1),
  (v_kw_id, '2026-03-16', 1)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- 쌍꺼풀 수술 잘하는 곳: 10~18위, 변동 큼
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '쌍꺼풀 수술 잘하는 곳' AND category = 'website';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position) VALUES
  (v_kw_id, '2026-03-01', 18),
  (v_kw_id, '2026-03-02', 15),
  (v_kw_id, '2026-03-03', 17),
  (v_kw_id, '2026-03-04', 13),
  (v_kw_id, '2026-03-05', 14),
  (v_kw_id, '2026-03-06', 11),
  (v_kw_id, '2026-03-07', 13),
  (v_kw_id, '2026-03-08', 10),
  (v_kw_id, '2026-03-09', 12),
  (v_kw_id, '2026-03-10', 11),
  (v_kw_id, '2026-03-11', 10),
  (v_kw_id, '2026-03-12', 12),
  (v_kw_id, '2026-03-13', 9),
  (v_kw_id, '2026-03-14', 10),
  (v_kw_id, '2026-03-15', 8),
  (v_kw_id, '2026-03-16', 9)
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position;

-- === 스마트블록 (순위 + URL) ===

-- 강남 성형외과: 1~5위
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '강남 성형외과' AND category = 'smartblock';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position, url) VALUES
  (v_kw_id, '2026-03-01', 4, 'https://blog.naver.com/testclinic/001'),
  (v_kw_id, '2026-03-02', 3, 'https://blog.naver.com/testclinic/001'),
  (v_kw_id, '2026-03-03', 3, 'https://blog.naver.com/testclinic/002'),
  (v_kw_id, '2026-03-04', 2, 'https://blog.naver.com/testclinic/002'),
  (v_kw_id, '2026-03-05', 2, 'https://blog.naver.com/testclinic/003'),
  (v_kw_id, '2026-03-06', 3, 'https://blog.naver.com/testclinic/003'),
  (v_kw_id, '2026-03-07', 2, 'https://blog.naver.com/testclinic/003'),
  (v_kw_id, '2026-03-08', 1, 'https://blog.naver.com/testclinic/004'),
  (v_kw_id, '2026-03-09', 2, 'https://blog.naver.com/testclinic/004'),
  (v_kw_id, '2026-03-10', 1, 'https://blog.naver.com/testclinic/004'),
  (v_kw_id, '2026-03-11', 1, 'https://blog.naver.com/testclinic/005'),
  (v_kw_id, '2026-03-12', 2, 'https://blog.naver.com/testclinic/005'),
  (v_kw_id, '2026-03-13', 1, 'https://blog.naver.com/testclinic/005'),
  (v_kw_id, '2026-03-14', 1, 'https://blog.naver.com/testclinic/006'),
  (v_kw_id, '2026-03-15', 1, 'https://blog.naver.com/testclinic/006'),
  (v_kw_id, '2026-03-16', 1, 'https://blog.naver.com/testclinic/006')
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position, url = EXCLUDED.url;

-- 보톡스 가격: 3~10위
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '보톡스 가격' AND category = 'smartblock';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position, url) VALUES
  (v_kw_id, '2026-03-01', 10, 'https://blog.naver.com/testclinic/b01'),
  (v_kw_id, '2026-03-02', 9, 'https://blog.naver.com/testclinic/b01'),
  (v_kw_id, '2026-03-03', 8, 'https://blog.naver.com/testclinic/b01'),
  (v_kw_id, '2026-03-04', 7, 'https://blog.naver.com/testclinic/b02'),
  (v_kw_id, '2026-03-05', 8, 'https://blog.naver.com/testclinic/b02'),
  (v_kw_id, '2026-03-06', 6, 'https://blog.naver.com/testclinic/b02'),
  (v_kw_id, '2026-03-07', 7, 'https://blog.naver.com/testclinic/b03'),
  (v_kw_id, '2026-03-08', 5, 'https://blog.naver.com/testclinic/b03'),
  (v_kw_id, '2026-03-09', 6, 'https://blog.naver.com/testclinic/b03'),
  (v_kw_id, '2026-03-10', 4, 'https://blog.naver.com/testclinic/b04'),
  (v_kw_id, '2026-03-11', 5, 'https://blog.naver.com/testclinic/b04'),
  (v_kw_id, '2026-03-12', 4, 'https://blog.naver.com/testclinic/b04'),
  (v_kw_id, '2026-03-13', 3, 'https://blog.naver.com/testclinic/b05'),
  (v_kw_id, '2026-03-14', 4, 'https://blog.naver.com/testclinic/b05'),
  (v_kw_id, '2026-03-15', 3, 'https://blog.naver.com/testclinic/b05'),
  (v_kw_id, '2026-03-16', 3, 'https://blog.naver.com/testclinic/b06')
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position, url = EXCLUDED.url;

-- 필러 후기: 5~15위, 불안정
SELECT id INTO v_kw_id FROM monitoring_keywords WHERE clinic_id = v_clinic_id AND keyword = '필러 후기' AND category = 'smartblock';
INSERT INTO monitoring_rankings (keyword_id, rank_date, rank_position, url) VALUES
  (v_kw_id, '2026-03-01', 15, 'https://blog.naver.com/testclinic/f01'),
  (v_kw_id, '2026-03-02', 12, 'https://blog.naver.com/testclinic/f01'),
  (v_kw_id, '2026-03-03', 14, 'https://blog.naver.com/testclinic/f01'),
  (v_kw_id, '2026-03-04', 10, 'https://blog.naver.com/testclinic/f02'),
  (v_kw_id, '2026-03-05', 11, 'https://blog.naver.com/testclinic/f02'),
  (v_kw_id, '2026-03-06', 8, 'https://blog.naver.com/testclinic/f02'),
  (v_kw_id, '2026-03-07', 10, 'https://blog.naver.com/testclinic/f02'),
  (v_kw_id, '2026-03-08', 7, 'https://blog.naver.com/testclinic/f03'),
  (v_kw_id, '2026-03-09', 9, 'https://blog.naver.com/testclinic/f03'),
  (v_kw_id, '2026-03-10', 6, 'https://blog.naver.com/testclinic/f03'),
  (v_kw_id, '2026-03-11', 8, 'https://blog.naver.com/testclinic/f04'),
  (v_kw_id, '2026-03-12', 5, 'https://blog.naver.com/testclinic/f04'),
  (v_kw_id, '2026-03-13', 7, 'https://blog.naver.com/testclinic/f04'),
  (v_kw_id, '2026-03-14', 5, 'https://blog.naver.com/testclinic/f05'),
  (v_kw_id, '2026-03-15', 6, 'https://blog.naver.com/testclinic/f05'),
  (v_kw_id, '2026-03-16', 5, 'https://blog.naver.com/testclinic/f05')
ON CONFLICT (keyword_id, rank_date) DO UPDATE SET rank_position = EXCLUDED.rank_position, url = EXCLUDED.url;

RAISE NOTICE '순위 모니터링 더미 데이터 생성 완료!';
RAISE NOTICE '- 키워드: 10개 (place 4, website 3, smartblock 3)';
RAISE NOTICE '- 순위 데이터: 160건 (10키워드 x 16일)';
RAISE NOTICE '- 기간: 2026-03-01 ~ 2026-03-16';
RAISE NOTICE '';
RAISE NOTICE '순위 패턴:';
RAISE NOTICE '  [place] 강남 성형외과: 5→1위 (점진 상승)';
RAISE NOTICE '  [place] 강남역 피부과: 12→7위 (중위권 개선)';
RAISE NOTICE '  [place] 논현동 리프팅: 1~2위 (상위 유지)';
RAISE NOTICE '  [place] 강남 보톡스: 20→10위 (하위에서 개선)';
RAISE NOTICE '  [website] 강남 성형외과 추천: 8→3위';
RAISE NOTICE '  [website] 울쎄라 리프팅 가격: 3→1위 (상위 고정)';
RAISE NOTICE '  [website] 쌍꺼풀 수술 잘하는 곳: 18→9위 (큰 변동)';
RAISE NOTICE '  [smartblock] 강남 성형외과: 4→1위 + URL 추적';
RAISE NOTICE '  [smartblock] 보톡스 가격: 10→3위 + URL 추적';
RAISE NOTICE '  [smartblock] 필러 후기: 15→5위 (불안정) + URL 추적';

END $$;

-- 확인 쿼리
SELECT '키워드' as item, COUNT(*) as count FROM monitoring_keywords WHERE clinic_id = 1
UNION ALL
SELECT '순위 데이터', COUNT(*) FROM monitoring_rankings mr
JOIN monitoring_keywords mk ON mr.keyword_id = mk.id WHERE mk.clinic_id = 1;
