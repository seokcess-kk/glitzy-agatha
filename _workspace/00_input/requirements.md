# Agatha 구현 요구사항

## 목표
Samantha(병원 마케팅 SaaS) 코드베이스를 기반으로 Agatha(업종 무관 범용 마케팅 인텔리전스 대시보드)를 구현한다.

## 핵심 변환
1. 병원 도메인 → 범용 마케팅 (Clinic→Client, Patient→Contact 등)
2. 6단계 퍼널 → 심플 3단계 (New→In Progress→Converted)
3. 병원 전용 기능 제거 (MediChecker, 예약/결제/상담, 콘텐츠 감사, 언론보도, 챗봇, ERP)
4. 새 기능 추가 (초대 회원가입, 예산 이력 관리, 리포트 커스터마이징, 수동 등록 유입 경로)
5. UI/UX 재설계 (Blue→Slate+Violet, 다크→라이트, Inter→Pretendard+Geist Mono, 사이드바 토글)

## 참조 문서
- SPEC: docs/SPEC.md (v1.4)
- 디자인 시스템: docs/DESIGN_SYSTEM.md (v1.1)
- Samantha 소스: 현재 코드베이스에 복사됨

## 병렬 작업 요구
Frontend/Backend를 독립적으로 병렬 진행할 수 있게 작업을 분해할 것.
