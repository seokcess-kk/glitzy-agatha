import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: 'Agatha 대시보드 개인정보처리방침',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft size={16} />
          돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground mb-10">최종 수정일: 2026년 3월 19일</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. 개인정보의 처리 목적</h2>
            <p>
              주식회사 글리지(이하 &ldquo;회사&rdquo;)는 Agatha(Marketing Intelligence) 대시보드 서비스(이하 &ldquo;서비스&rdquo;)
              제공을 위해 다음 목적으로 개인정보를 처리합니다.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>서비스 회원 관리 및 본인 확인</li>
              <li>클라이언트 마케팅 데이터 분석 및 대시보드 제공</li>
              <li>광고 성과 데이터 연동 및 리포트 생성</li>
              <li>고객 문의 응대 및 서비스 개선</li>
              <li>서비스 이용 통계 및 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. 수집하는 개인정보 항목</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-foreground">필수 항목</h3>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>아이디, 비밀번호, 이름, 이메일 주소</li>
                  <li>소속 클라이언트 정보, 직책/역할</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-foreground">자동 수집 항목</h3>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>접속 IP 주소, 접속 일시, 브라우저 정보</li>
                  <li>서비스 이용 기록, 접속 로그</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
              단, 관련 법령에 의해 보존이 필요한 경우 아래 기간 동안 보관합니다.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
              <li>접속에 관한 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. 개인정보의 제3자 제공</h2>
            <p>
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. 개인정보의 파기 절차 및 방법</h2>
            <p>
              회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체 없이 해당 개인정보를 파기합니다.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>전자적 파일 형태: 복구 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. 개인정보의 안전성 확보 조치</h2>
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>SSL/TLS를 통한 데이터 전송 암호화</li>
              <li>접근 권한 관리 및 역할 기반 접근 제어(RBAC)</li>
              <li>개인정보 접근 로그 기록 및 모니터링</li>
              <li>정기적인 보안 점검 실시</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. 정보주체의 권리·의무 및 행사 방법</h2>
            <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
            <p className="mt-2">
              위 권리 행사는 회사에 서면, 이메일 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. 개인정보 보호책임자</h2>
            <ul className="list-none space-y-1">
              <li><span className="text-foreground font-medium">담당부서:</span> 개인정보보호팀</li>
              <li><span className="text-foreground font-medium">이메일:</span> inner@glitzy.co.kr</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. 개인정보처리방침의 변경</h2>
            <p>
              이 개인정보처리방침은 법령, 정책 또는 보안 기술의 변경에 따라 내용의 추가, 삭제 및
              수정이 있을 수 있으며, 변경 시 서비스 내 공지사항을 통해 고지합니다.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground/60">
          &copy; 2026 Glitzy. All rights reserved.
        </div>
      </div>
    </div>
  )
}
