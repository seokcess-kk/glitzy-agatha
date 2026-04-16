# Phase 4: 순위 모니터링 + agency_staff 역할

> 기간: 2026-03-16 | 상태: 완료

순위 모니터링 시스템과 agency_staff 역할 체계 구현 기록

---

## P18: 순위 모니터링 + agency_staff 역할 (2026-03-16)

### 개요
병원 마케팅 실행사 직원이 네이버 플레이스/웹사이트/스마트블록 순위를 매일 기록하고 추적하는 시스템. 이를 위해 여러 병원을 담당하고 계정별 메뉴 권한을 가진 `agency_staff` 역할을 추가.

### DB 마이그레이션 (`20260316_monitoring_agency.sql`)

| 테이블 | 용도 |
|--------|------|
| `user_clinic_assignments` | agency_staff 다중 병원 배정 (user_id + clinic_id UNIQUE) |
| `user_menu_permissions` | 계정별 메뉴 권한 (user_id + menu_key UNIQUE) |
| `monitoring_keywords` | 모니터링 키워드 (place/website/smartblock, clinic별 UNIQUE) |
| `monitoring_rankings` | 일별 순위 데이터 (keyword_id + rank_date UNIQUE, UPSERT 지원) |

### 타입/인증 레이어 변경

| 파일 | 변경 |
|------|------|
| `types/next-auth.d.ts` | UserRole에 `agency_staff` 추가 |
| `lib/auth.ts` | UserRole에 `agency_staff` 추가 |
| `lib/security.ts` | SessionUser.role에 `agency_staff` 추가 |
| `lib/session.ts` | `getClinicId()`에 agency_staff 지원 (배정 병원만 허용) |
| `lib/api-middleware.ts` | `ClinicContext.assignedClinicIds` 추가, `applyClinicFilter()` 헬퍼, `getAssignedClinicIds()` |

### 미들웨어 보호 설계

```
withClinicFilter 래퍼:
├── superadmin: clinicId=파라미터 or null(전체), assignedClinicIds=null
├── agency_staff: clinicId=파라미터(배정 검증) or null, assignedClinicIds=[배정 병원 목록]
├── clinic_admin: clinicId=고정, assignedClinicIds=null
└── clinic_staff: clinicId=고정, assignedClinicIds=null

applyClinicFilter(query, {clinicId, assignedClinicIds}):
├── clinicId 있음 → query.eq('clinic_id', clinicId)
├── assignedClinicIds 있음 & 비어있지 않음 → query.in('clinic_id', assignedClinicIds)
├── assignedClinicIds=[] (배정 0개) → null 반환 (빈 결과)
└── 둘 다 null → 필터 없음 (superadmin 전체 조회)
```

### API 엔드포인트

| 엔드포인트 | 메서드 | 미들웨어 | 설명 |
|---|---|---|---|
| `/api/my/clinics` | GET | withAuth | 역할별 접근 가능 병원 목록 |
| `/api/my/menu-permissions` | GET | withAuth | agency_staff 메뉴 권한 조회 |
| `/api/admin/users/[id]/permissions` | GET/PUT | withSuperAdmin | 병원 배정 + 메뉴 권한 관리 |
| `/api/monitoring/keywords` | GET/POST/PATCH | withClinicFilter/withSuperAdmin | 키워드 CRUD |
| `/api/monitoring/rankings` | GET/POST | withClinicFilter/withAuth | 순위 조회/입력 |
| `/api/monitoring/rankings/bulk` | POST | withAuth | 일괄 순위 입력 (UPSERT) |

### 프론트엔드 페이지

| 경로 | 접근 | 기능 |
|------|------|------|
| `/monitoring` | superadmin, agency_staff, clinic_admin | 월간 순위 테이블 (색상 코딩) + 추이 차트 |
| `/monitoring/input` | superadmin, agency_staff | 일별 순위 입력 (카테고리별 그룹, 스마트블록 URL) |
| `/monitoring/keywords` | superadmin | 키워드 등록/활성화 관리 |

### Sidebar 변경

- `ROLE_LEVEL`에 `agency_staff: 2` 추가
- agency_staff용 클리닉 스위처 (배정 병원만, "전체 병원" 옵션 없음)
- agency_staff 메뉴 필터: `/api/my/menu-permissions`에서 허용 메뉴 fetch
- "순위 모니터링" 그룹 추가 (순위 현황 + 순위 입력)
- 슈퍼어드민 섹션에 "키워드 관리" 추가
- `isActive` 판정 개선: `pathname === href || pathname.startsWith(href + '/')`

### admin/users 페이지 변경

- 역할 선택에 "실행사 담당자" 추가
- agency_staff 선택 시: 병원 다중 선택 체크박스 + 메뉴 권한 체크박스
- 사용자 목록에 agency_staff 배지 (오렌지) + "다중 배정" 표시
- "권한 설정" 버튼 → 병원/메뉴 권한 수정 다이얼로그
- 계정 생성 실패 시 롤백 (유저 삭제, CASCADE로 배정/권한도 삭제)

### 기존 API 보호 강화

`applyClinicFilter` 헬퍼를 통해 기존 20개 `withClinicFilter` API에 agency_staff 데이터 격리 적용:
- `applyClinicFilter()` 사용: campaigns, leads, patients, ads/stats, content/posts, landing-pages, dashboard/trend, press, monitoring/keywords, monitoring/rankings, utm/links, utm/templates
- 로컬 `applyFilter` 람다 + 빈 배열 early return: dashboard/channel, dashboard/funnel, dashboard/campaign, dashboard/kpi, content/analytics, admin/landing-pages/stats
