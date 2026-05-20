/**
 * 금액 / 숫자 포맷 헬퍼
 *
 * 정책: Agatha 의 모든 금액 표시는 **원 단위(정수)** 로 통일.
 * 소수점 표시 금지. 음수, NaN, undefined, null 은 0 으로 처리.
 *
 * 비율(ROAS, CTR, CVR, conversion_rate) 은 이 모듈을 사용하지 않고
 * 컴포넌트에서 직접 toFixed(1/2) 로 처리 (소수점 유지).
 */

/** 표시용 안전 변환 — NaN/undefined/null → 0 */
function safeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value
}

/**
 * 금액 풀 표기 (정수 원)
 * 예: 1234567 → "1,234,567원"  /  withUnit=false → "1,234,567"
 *
 * 소수점은 항상 잘림(Math.round 적용).
 * 음수도 그대로 표현 (예: -1,200원)
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: { withUnit?: boolean } = {}
): string {
  const { withUnit = true } = options
  const n = Math.round(safeNumber(amount))
  const formatted = n.toLocaleString('ko-KR')
  return withUnit ? `${formatted}원` : formatted
}

/**
 * 금액 콤팩트 표기 (정수 자리수만 사용, 소수점 없음)
 * 예: 123 → "123원"
 *     12_345 → "1만원"
 *     123_456_789 → "1억 2,346만원"
 *     1_234_567_890 → "12억 3,457만원"
 *
 * 차트 라벨/배지처럼 좁은 공간에 사용.
 * withUnit=false 시 "원" 생략.
 */
export function formatCurrencyCompact(
  amount: number | null | undefined,
  options: { withUnit?: boolean } = {}
): string {
  const { withUnit = true } = options
  const n = Math.round(safeNumber(amount))
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const unit = withUnit ? '원' : ''

  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000)
    const man = Math.floor((abs % 100_000_000) / 10_000)
    const manStr = man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''
    return `${sign}${eok}억${manStr}${unit}`
  }
  if (abs >= 10_000) {
    const man = Math.floor(abs / 10_000)
    return `${sign}${man.toLocaleString('ko-KR')}만${unit}`
  }
  return `${sign}${abs.toLocaleString('ko-KR')}${unit}`
}

/**
 * 일반 정수 포맷 (콤마)
 * 예: 1234567 → "1,234,567"
 *
 * 금액이 아닌 카운트(노출수/클릭수/리드수 등) 용도.
 */
export function formatNumber(value: number | null | undefined): string {
  return Math.round(safeNumber(value)).toLocaleString('ko-KR')
}
