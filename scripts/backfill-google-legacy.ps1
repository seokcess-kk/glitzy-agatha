<#
.SYNOPSIS
  Google Ads 'ad 레벨 동기화 도입(2026-05-20)' 이전 기간의 ad_stats 갭을 메우는 일괄 재백필.

.DESCRIPTION
  커밋 99758be(2026-05-20 20:13) 배포 전에는 Google 의 ad 레벨(ad_stats) 동기화가 없었다.
  그래서 5/20 이전에 동기화된 모든 클라이언트의 Google 데이터는 ad_stats 가 비어 있어
  '소재별 성과' 화면에서 지출/노출/클릭이 누락되고, '캠페인 순위'(ad_campaign_stats)와
  수치가 어긋난다. 또한 campaign_type 도 채워지지 않아 null 로 남는다.

  이 스크립트는 대상 클라이언트들의 5/19 이전 기간을 '현재 코드'로 재백필해
  ad_stats / campaign_type 을 채운다. 프로덕션 /api/admin/backfill-ads 엔드포인트를
  CRON_SECRET 으로 호출하며, 90일 제한 + 함수 maxDuration(300초) 을 회피하기 위해
  기간을 ChunkDays 단위로 분할 호출한다. upsert 라 멱등(중복 실행해도 안전)하다.

  ※ 캠페인/소재가 현재 'ENABLED' 상태여야 수집된다(fetchGoogleAds/fetchGoogleAdStats 의
    campaign.status='ENABLED' 필터). 이미 종료된 캠페인의 과거 데이터는 채워지지 않을 수 있다.

.PARAMETER ClientIds
  재백필 대상 클라이언트 ID 배열. 아래 README 의 'Google 클라이언트 목록 SQL' 로 조회해 전달.

.PARAMETER BaseUrl
  프로덕션 호스트. 기본값 https://agatha.glitzy.kr

.PARAMETER CronSecret
  Bearer 인증 토큰. 미지정 시 $env:CRON_SECRET 사용.

.PARAMETER StartDate / EndDate
  백필 범위. 기본 2026-03-01 ~ 2026-05-19 (ad 레벨 동기화 시작 직전까지).
  데이터가 없는 날짜는 0건으로 안전하게 통과한다. 더 과거 데이터가 있으면 StartDate 를 당긴다.

.EXAMPLE
  $env:CRON_SECRET = '...'
  ./scripts/backfill-google-legacy.ps1 -ClientIds 1,5,12

.EXAMPLE
  ./scripts/backfill-google-legacy.ps1 -ClientIds 7 -StartDate 2026-01-01 -EndDate 2026-05-19
#>
param(
  [Parameter(Mandatory = $true)][int[]]$ClientIds,
  [string]$BaseUrl = 'https://agatha.glitzy.kr',
  [string]$CronSecret = $env:CRON_SECRET,
  [string]$StartDate = '2026-03-01',
  [string]$EndDate = '2026-05-19',
  [int]$ChunkDays = 30,
  [int]$DelaySeconds = 2
)

# 콘솔 한글 출력 깨짐 방지 (PowerShell 콘솔 코드페이지 → UTF-8)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not $CronSecret) { throw 'CRON_SECRET 환경변수(또는 -CronSecret)가 필요합니다.' }

$start = [datetime]::ParseExact($StartDate, 'yyyy-MM-dd', $null)
$end = [datetime]::ParseExact($EndDate, 'yyyy-MM-dd', $null)
if ($start -gt $end) { throw 'StartDate 가 EndDate 보다 늦습니다.' }

$summary = @()

foreach ($cid in $ClientIds) {
  Write-Host "================ client $cid ================" -ForegroundColor Cyan
  $cur = $start
  $clientTotal = 0
  $clientErrors = 0
  while ($cur -le $end) {
    $chunkEnd = $cur.AddDays($ChunkDays - 1)
    if ($chunkEnd -gt $end) { $chunkEnd = $end }

    $body = @{
      clientId  = $cid
      startDate = $cur.ToString('yyyy-MM-dd')
      endDate   = $chunkEnd.ToString('yyyy-MM-dd')
      platforms = @('google_ads')
    } | ConvertTo-Json -Compress

    Write-Host ("  [{0} ~ {1}] 백필 요청..." -f $cur.ToString('yyyy-MM-dd'), $chunkEnd.ToString('yyyy-MM-dd'))
    try {
      $res = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/backfill-ads" `
        -Headers @{ Authorization = "Bearer $CronSecret" } `
        -ContentType 'application/json' -Body $body -TimeoutSec 600
      Write-Host ("    OK  syncedDays={0} totalCount={1} errorCount={2}" -f $res.syncedDays, $res.totalCount, $res.errorCount) -ForegroundColor Green
      $clientTotal += [int]$res.totalCount
      $clientErrors += [int]$res.errorCount
    }
    catch {
      Write-Host ("    실패: {0}" -f $_.Exception.Message) -ForegroundColor Red
      $clientErrors++
    }

    $cur = $chunkEnd.AddDays(1)
    Start-Sleep -Seconds $DelaySeconds
  }
  $summary += [pscustomobject]@{ clientId = $cid; totalCount = $clientTotal; errorCount = $clientErrors }
}

Write-Host "`n================ 요약 ================" -ForegroundColor Cyan
$summary | Format-Table -AutoSize
Write-Host '완료. 소재별 성과 / 캠페인 순위 지출이 정합됐는지 검증 SQL 로 확인하세요.'
