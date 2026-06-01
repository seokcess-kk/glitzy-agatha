/**
 * ADN (Across DN — manage.acrosspf.com) 광고 데이터 동기화
 *
 * 응답 구조 (일별 → 캠페인 → 광고그룹 3-tier):
 *   [{ wdate, view_cnt, click_cnt, click_sales, conv_cnt,
 *      campaign: [{ campaign_name, ..., groups: [{ group_name, ... }] }] }]
 *
 * 응답에 campaign_id / group_id 가 없어 name 을 ID 로 사용.
 * ad/소재 레벨이 없으므로 ad_stats 는 채우지 않고 ad_group_stats 만 채운다 (네이버 SA 동일 패턴).
 *
 * 인증: 단일 헤더 `API-KEY`. 환경변수 폴백 = `ADN_ADS_API_KEY`.
 */

import { serverSupabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import { getKstDateString } from '@/lib/date'
import { adStatsOnConflict } from './ad-upsert'

const SERVICE_NAME = 'AdnAds'
const logger = createLogger(SERVICE_NAME)
const API_URL = 'https://manage.acrosspf.com/api/api_report/across_adn_api_report.php'

export interface AdnAdsOptions {
  clientId?: number
  apiKey?: string
}

interface AdnGroupRow {
  group_name?: string
  view_cnt?: number | string
  click_cnt?: number | string
  click_sales?: number | string
  conv_cnt?: number | string
}

interface AdnCampaignRow {
  campaign_name?: string
  view_cnt?: number | string
  click_cnt?: number | string
  click_sales?: number | string
  conv_cnt?: number | string
  groups?: AdnGroupRow[]
}

interface AdnDailyRow {
  wdate?: string
  campaign?: AdnCampaignRow[]
}

function toInt(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function toFloat(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * ADN wdate 정규화 → 'YYYY-MM-DD'.
 * API 응답은 'YYYY/MM/DD' (슬래시) 로 오지만 요청은 'YYYYMMDD' 라 양쪽 처리.
 */
function normalizeWdate(wdate: string): string | null {
  if (/^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(wdate)) {
    const [y, m, d] = wdate.split(/[/\-.]/)
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{8}$/.test(wdate)) {
    return `${wdate.slice(0, 4)}-${wdate.slice(4, 6)}-${wdate.slice(6, 8)}`
  }
  return null
}

/**
 * ADN 일별 성과 수집 → ad_campaign_stats + ad_group_stats
 *
 * API 는 start_date~end_date 범위를 받지만, 다른 매체와의 동기화 라이프사이클 통일을 위해
 * 호출당 단일 일자만 처리한다 (백필은 adSyncManager 가 일별 루프로 호출).
 */
export async function fetchAdnAds(date: Date = new Date(), options?: AdnAdsOptions) {
  const dateStr = getKstDateString(date) // 'YYYY-MM-DD'
  const dateApi = dateStr.replace(/-/g, '') // 'YYYYMMDD'
  const startTime = Date.now()

  const apiKey = options?.apiKey || process.env.ADN_ADS_API_KEY
  if (!apiKey) {
    logger.warn('Missing ADN API key', { clientId: options?.clientId })
    return { platform: 'adn_ads', count: 0, error: 'Missing API key' }
  }

  const supabase = serverSupabase()

  try {
    const url = new URL(API_URL)
    url.searchParams.set('start_date', dateApi)
    url.searchParams.set('end_date', dateApi)

    const { response } = await fetchWithRetry(url.toString(), {
      headers: {
        'API-KEY': apiKey,
        'content-type': 'application/json',
      },
      service: SERVICE_NAME,
      timeout: 30000,
      retries: 3,
    })

    if (!response.ok) {
      throw new Error(`ADN API error: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json().catch(() => null)) as unknown
    if (!Array.isArray(json)) {
      logger.warn('ADN 응답이 배열이 아님', {
        clientId: options?.clientId,
        sample: JSON.stringify(json).slice(0, 200),
      })
      return { platform: 'adn_ads', count: 0 }
    }
    const data = json as AdnDailyRow[]

    interface CampAgg {
      campaignName: string
      statDate: string
      impressions: number
      clicks: number
      spend: number
      conversions: number
    }
    interface GroupAgg extends CampAgg {
      groupName: string
    }

    const campaignRows: CampAgg[] = []
    const groupRows: GroupAgg[] = []

    for (const day of data) {
      if (!day.wdate) continue
      const statDate = normalizeWdate(String(day.wdate))
      if (!statDate) {
        logger.warn('ADN wdate 형식 인식 실패', { wdate: day.wdate })
        continue
      }
      if (!Array.isArray(day.campaign)) continue

      for (const camp of day.campaign) {
        if (!camp.campaign_name) continue
        campaignRows.push({
          campaignName: camp.campaign_name,
          statDate,
          impressions: toInt(camp.view_cnt),
          clicks: toInt(camp.click_cnt),
          spend: toFloat(camp.click_sales),
          conversions: toInt(camp.conv_cnt),
        })

        if (!Array.isArray(camp.groups)) continue
        for (const grp of camp.groups) {
          if (!grp.group_name) continue
          groupRows.push({
            campaignName: camp.campaign_name,
            groupName: grp.group_name,
            statDate,
            impressions: toInt(grp.view_cnt),
            clicks: toInt(grp.click_cnt),
            spend: toFloat(grp.click_sales),
            conversions: toInt(grp.conv_cnt),
          })
        }
      }
    }

    // ad_campaign_stats upsert (campaign_id = campaign_name)
    const campaignDbRows = campaignRows.map((r) => ({
      platform: 'adn_ads',
      campaign_id: r.campaignName,
      campaign_name: r.campaignName,
      campaign_type: 'display',
      spend_amount: r.spend,
      clicks: r.clicks,
      impressions: r.impressions,
      conversions: r.conversions,
      stat_date: r.statDate,
      client_id: options?.clientId || null,
    }))

    if (campaignDbRows.length > 0) {
      const onConflict = adStatsOnConflict('campaign_id', !!options?.clientId)
      const { error } = await supabase.from('ad_campaign_stats').upsert(campaignDbRows, { onConflict })
      if (error) {
        logger.error('ad_campaign_stats upsert 실패', error, { clientId: options?.clientId })
      }
    }

    // ad_group_stats upsert (adgroup_id = group_name)
    const groupDbRows = groupRows.map((r) => ({
      platform: 'adn_ads',
      campaign_id: r.campaignName,
      campaign_name: r.campaignName,
      adgroup_id: r.groupName,
      adgroup_name: r.groupName,
      spend_amount: r.spend,
      clicks: r.clicks,
      impressions: r.impressions,
      conversions: r.conversions,
      stat_date: r.statDate,
      client_id: options?.clientId || null,
    }))

    if (groupDbRows.length > 0) {
      const groupOnConflict = adStatsOnConflict('adgroup_id', !!options?.clientId)
      const { error: groupError } = await supabase
        .from('ad_group_stats')
        .upsert(groupDbRows, { onConflict: groupOnConflict })
      if (groupError) {
        logger.warn('ad_group_stats upsert 오류', {
          error: groupError.message,
          clientId: options?.clientId,
        })
      }
    }

    const duration = Date.now() - startTime
    logger.info('ADN 동기화 완료', {
      clientId: options?.clientId,
      dateStr,
      campaignCount: campaignDbRows.length,
      groupCount: groupDbRows.length,
      durationMs: duration,
    })

    return {
      platform: 'adn_ads',
      count: campaignDbRows.length + groupDbRows.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('ADN 동기화 실패', err, { clientId: options?.clientId })
    return { platform: 'adn_ads', count: 0, error: message }
  }
}
