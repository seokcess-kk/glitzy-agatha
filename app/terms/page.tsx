import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: '서비스 이용약관',
  description: 'Samantha 대시보드 서비스 이용약관',
}

export default function TermsOfServicePage() {
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

        <h1 className="text-3xl font-bold text-foreground mb-2">서비스 이용약관</h1>
        <p className="text-sm text-muted-foreground mb-10">최종 수정일: 2026년 3월 19일</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제1조 (목적)</h2>
            <p>
              본 약관은 주식회사 글리지(이하 &ldquo;회사&rdquo;)가 제공하는 Samantha(Medical Marketing Intelligence) 대시보드
              서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항,
              기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제2조 (정의)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>&ldquo;서비스&rdquo;란 회사가 제공하는 병원 마케팅 인텔리전스 대시보드 및 관련 부가 서비스를 의미합니다.</li>
              <li>&ldquo;이용자&rdquo;란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 의미합니다.</li>
              <li>&ldquo;병원&rdquo;이란 서비스에 등록된 의료기관 고객사(테넌트)를 의미합니다.</li>
              <li>&ldquo;계정&rdquo;이란 이용자가 서비스에 접속하기 위해 부여받은 아이디와 비밀번호를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경사유를 명시하여 7일 전에 공지합니다.</li>
              <li>이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제4조 (서비스의 제공)</h2>
            <p>회사는 다음과 같은 서비스를 제공합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>병원별 마케팅 성과 대시보드</li>
              <li>광고 플랫폼(Google, Meta, TikTok, Naver 등) 데이터 연동 및 분석</li>
              <li>리드 관리 및 고객 여정 추적</li>
              <li>예약·상담·결제 통합 관리</li>
              <li>성과 리포트 생성 및 발송</li>
              <li>기타 회사가 정하는 서비스</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제5조 (이용자의 의무)</h2>
            <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-decimal pl-5 mt-2 space-y-1">
              <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
              <li>서비스에서 얻은 정보를 회사의 사전 동의 없이 상업적으로 이용하는 행위</li>
              <li>회사 및 제3자의 지적재산권을 침해하는 행위</li>
              <li>서비스의 안정적 운영을 방해하는 행위</li>
              <li>다른 이용자의 개인정보를 수집, 저장, 공개하는 행위</li>
              <li>기타 관련 법령에 위반되는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제6조 (계정 관리)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>이용자는 자신의 계정 정보를 안전하게 관리할 책임이 있습니다.</li>
              <li>이용자는 자신의 계정을 제3자에게 양도하거나 공유할 수 없습니다.</li>
              <li>계정의 무단 사용이 발견된 경우 즉시 회사에 통보해야 합니다.</li>
              <li>회사는 보안상의 이유로 비밀번호 변경을 요청할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제7조 (데이터의 관리)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>서비스에 등록된 병원 데이터의 소유권은 해당 병원에 있습니다.</li>
              <li>회사는 서비스 제공 목적 범위 내에서만 데이터를 처리합니다.</li>
              <li>회사는 데이터의 안전한 보관을 위해 합리적인 기술적·관리적 보호 조치를 취합니다.</li>
              <li>서비스 해지 시 병원 데이터는 관련 법령에 따른 보존 기간 경과 후 파기됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제8조 (서비스의 중단)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>회사는 시스템 점검, 장비 교체 및 고장, 통신 두절 등의 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</li>
              <li>서비스 중단 시 회사는 사전에 이용자에게 통지합니다. 단, 불가피한 경우 사후에 통지할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제9조 (책임의 제한)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>회사는 천재지변, 전쟁 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
              <li>회사는 이용자의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
              <li>회사는 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 상실한 것에 대해 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제10조 (지적재산권)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>서비스에 대한 저작권 및 지적재산권은 회사에 귀속됩니다.</li>
              <li>이용자는 서비스를 이용함으로써 얻은 정보를 회사의 사전 동의 없이 복제, 전송, 출판, 배포, 방송 등의 방법으로 이용하거나 제3자에게 제공할 수 없습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">제11조 (분쟁 해결)</h2>
            <ul className="list-decimal pl-5 space-y-2">
              <li>서비스 이용과 관련하여 분쟁이 발생한 경우 양 당사자는 원만한 해결을 위해 성실히 협의합니다.</li>
              <li>협의가 이루어지지 않을 경우 관할 법원은 회사의 본사 소재지를 관할하는 법원으로 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">부칙</h2>
            <p>본 약관은 2026년 3월 19일부터 시행합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground/60">
          &copy; 2026 Glitzy. All rights reserved.
        </div>
      </div>
    </div>
  )
}
