/**
 * 광고 캠페인 성과 이상치 감지
 * - sync-ads cron 이후 호출되어 CTR/지출 이상치를 탐지
 * - 직전 7일 평균 대비 임계값 초과 시 알림 트리거
 */

import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'

const logger = createLogger('AdsAnomaly')

type AnySupabaseClient = { from: (...args: any[]) => any }

export interface AnomalyResult {
  type: 'ctr_drop' | 'spend_spike'
  campaignName: string
  platform: string
  metric: string
  threshold: number
  actual: number
  message: string
}

interface DailyStat {
  campaign_name: string
  platform: string
  spend_amount: number
  clicks: number
  impressions: number
}

/** 숫자를 한국식 금액으로 포맷 (서버 locale 의존 없음) */
function formatKrw(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded >= 100_000_000) return `${Math.round(rounded / 100_000_000)}억`
  if (rounded >= 10_000) return `${Math.round(rounded / 10_000).toLocaleString('en-US')}만`
  return `${rounded.toLocaleString('en-US')}`
}

const CONCURRENCY_LIMIT = 5

/**
 * 광고 성과 이상치 감지
 * @param supabase Supabase 클라이언트
 * @param clientId 클라이언트 ID
 * @returns 감지된 이상치 목록
 */
export async function detectAdsAnomalies(
  supabase: AnySupabaseClient,
  clientId: number,
): Promise<AnomalyResult[]> {
  const today = new Date()

  // 어제 데이터 = latest, 그 이전 6일 = 히스토리 (합계 7일)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getKstDateString(yesterday)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = getKstDateString(sevenDaysAgo)

  // 7일 전 ~ 어제 범위만 조회 (오늘 데이터 제외)
  const { data: stats, error } = await supabase
    .from('ad_campaign_stats')
    .select('campaign_name, platform, spend_amount, clicks, impressions, stat_date')
    .eq('client_id', clientId)
    .gte('stat_date', sevenDaysAgoStr)
    .lte('stat_date', yesterdayStr)

  if (error) {
    logger.error('이상치 감지용 데이터 조회 실패', error, { clientId })
    return []
  }

  if (!stats || stats.length === 0) return []

  // 캠페인별 그룹핑
  const campaignMap = new Map<string, { platform: string; history: DailyStat[]; latest: DailyStat | null }>()

  for (const row of stats) {
    const key = `${row.platform}::${row.campaign_name}`
    if (!campaignMap.has(key)) {
      campaignMap.set(key, { platform: row.platform, history: [], latest: null })
    }
    const entry = campaignMap.get(key)!

    const stat: DailyStat = {
      campaign_name: row.campaign_name,
      platform: row.platform,
      spend_amount: Number(row.spend_amount) || 0,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
    }

    if (row.stat_date === yesterdayStr) {
      entry.latest = stat
    } else {
      entry.history.push(stat)
    }
  }

  const anomalies: AnomalyResult[] = []

  for (const [, campaign] of campaignMap) {
    const { history, latest, platform } = campaign
    if (!latest || history.length < 3) continue // 최소 3일 데이터 필요

    const campaignName = latest.campaign_name

    // 평균 계산
    const avgSpend = history.reduce((s, h) => s + h.spend_amount, 0) / history.length
    const avgCtr = history.reduce((s, h) => {
      return s + (h.impressions > 0 ? h.clicks / h.impressions : 0)
    }, 0) / history.length

    // 1. 일 지출 급증: 직전 평균 대비 200% 초과
    if (avgSpend > 0 && latest.spend_amount > avgSpend * 2) {
      const ratio = Math.round((latest.spend_amount / avgSpend) * 100)
      anomalies.push({
        type: 'spend_spike',
        campaignName,
        platform,
        metric: '일 지출',
        threshold: 200,
        actual: ratio,
        message: `[${platform}] ${campaignName}: 일 지출 ${ratio}% (평균 ${formatKrw(avgSpend)}원 → ${formatKrw(latest.spend_amount)}원)`,
      })
    }

    // 2. CTR 급락: 직전 평균 대비 50% 미만
    const latestCtr = latest.impressions > 0 ? latest.clicks / latest.impressions : 0
    if (avgCtr > 0 && latestCtr < avgCtr * 0.5) {
      const ratio = Math.round((latestCtr / avgCtr) * 100)
      anomalies.push({
        type: 'ctr_drop',
        campaignName,
        platform,
        metric: 'CTR',
        threshold: 50,
        actual: ratio,
        message: `[${platform}] ${campaignName}: CTR ${ratio}% 수준 (평균 ${(avgCtr * 100).toFixed(2)}% → ${(latestCtr * 100).toFixed(2)}%)`,
      })
    }
  }

  if (anomalies.length > 0) {
    logger.info(`이상치 ${anomalies.length}건 감지`, { clientId, types: anomalies.map(a => a.type) })
  }

  return anomalies
}

/**
 * 전체 활성 클라이언트의 이상치 감지 및 요약 메시지 생성
 * 동시 실행 제한(5개)으로 DB 부하 제어
 */
export async function detectAllClientAnomalies(
  supabase: AnySupabaseClient,
): Promise<{ totalAnomalies: number; summaryMessage: string }> {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)

  if (error || !clients || clients.length === 0) {
    return { totalAnomalies: 0, summaryMessage: '' }
  }

  // 동시성 제한 병렬 실행
  const allAnomalies: { clientName: string; anomalies: AnomalyResult[] }[] = []

  for (let i = 0; i < clients.length; i += CONCURRENCY_LIMIT) {
    const batch = clients.slice(i, i + CONCURRENCY_LIMIT)
    const results = await Promise.allSettled(
      batch.map(async (client: { id: number; name: string }) => {
        const anomalies = await detectAdsAnomalies(supabase, client.id)
        return { clientName: client.name, anomalies }
      })
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.anomalies.length > 0) {
        allAnomalies.push(result.value)
      }
    }
  }

  const totalAnomalies = allAnomalies.reduce((s, c) => s + c.anomalies.length, 0)
  if (totalAnomalies === 0) {
    return { totalAnomalies: 0, summaryMessage: '' }
  }

  // SMS용 요약 (최대 3건)
  const lines = allAnomalies.flatMap(c =>
    c.anomalies.map(a => `[${c.clientName}] ${a.message}`)
  )
  const display = lines.slice(0, 3)
  const remaining = lines.length - display.length
  let summaryMessage = `광고 이상치 ${totalAnomalies}건 감지\n${display.join('\n')}`
  if (remaining > 0) {
    summaryMessage += `\n외 ${remaining}건`
  }

  return { totalAnomalies, summaryMessage }
}
