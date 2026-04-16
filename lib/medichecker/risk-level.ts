/**
 * 리스크 레벨 유틸
 * 위험도 점수 → 라벨/색상 매핑 (중복 제거용)
 */

export interface RiskLevel {
  label: string
  color: 'rose' | 'amber' | 'emerald'
  subtitleColor: 'negative' | 'positive' | undefined
  badgeVariant: 'destructive' | 'warning' | 'success'
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return { label: '위험', color: 'rose', subtitleColor: 'negative', badgeVariant: 'destructive' }
  }
  if (score >= 40) {
    return { label: '주의', color: 'amber', subtitleColor: undefined, badgeVariant: 'warning' }
  }
  return { label: '양호', color: 'emerald', subtitleColor: 'positive', badgeVariant: 'success' }
}
