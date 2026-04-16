/**
 * Demo Viewer 계정 시드 스크립트
 *
 * 사용법:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-demo-user.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_ACCESS_KEY (demo 진입 키, 비밀번호 파생에 사용)
 *
 * 동작:
 *   - username 'demo_viewer' 계정 upsert
 *   - 비밀번호: sha256(DEMO_ACCESS_KEY + pepper) → bcrypt hash
 *   - role: 'demo_viewer', clinic_id: NULL, is_active: true
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const demoKey = process.env.DEMO_ACCESS_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.')
  process.exit(1)
}

if (!demoKey || demoKey.length < 16) {
  console.error('❌ DEMO_ACCESS_KEY가 16자 이상이어야 합니다.')
  console.error('   openssl rand -hex 32 로 생성 후 .env.local에 설정하세요.')
  process.exit(1)
}

const DEMO_USERNAME = 'demo_viewer'
const PEPPER = 'samantha-demo-pepper-v1'

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseKey!, { auth: { persistSession: false } })

  // 실 clinics.id와 충돌 방지 확인 (fixture는 1001~1006 사용)
  const { data: maxClinic } = await supabase
    .from('clinics')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  const maxId = maxClinic?.id ?? 0
  if (maxId >= 1001) {
    console.error(`❌ 실 clinics.id 최댓값(${maxId})이 1001 이상입니다. fixture ID와 충돌 위험.`)
    console.error('   lib/demo/fixtures/clinics.ts의 ID 범위를 조정해주세요.')
    process.exit(1)
  }
  console.log(`✓ clinics.id 최댓값: ${maxId} (fixture ID 1001~1006과 충돌 없음)`)

  // 비밀번호 파생: sha256(DEMO_ACCESS_KEY + pepper) → bcrypt
  const derivedPassword = crypto.createHash('sha256').update(demoKey + PEPPER).digest('hex')
  const passwordHash = await bcrypt.hash(derivedPassword, 10)

  // 기존 demo 계정 확인
  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('username', DEMO_USERNAME)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        role: 'demo_viewer',
        clinic_id: null,
        is_active: true,
        password_version: (existing as { password_version?: number }).password_version ?? 1,
      })
      .eq('id', existing.id)
    if (error) {
      console.error('❌ demo 계정 업데이트 실패:', error.message)
      process.exit(1)
    }
    console.log(`✓ demo 계정 업데이트 (id=${existing.id}, username=${DEMO_USERNAME})`)
  } else {
    const { data: created, error } = await supabase
      .from('users')
      .insert({
        username: DEMO_USERNAME,
        password_hash: passwordHash,
        role: 'demo_viewer',
        clinic_id: null,
        is_active: true,
        password_version: 1,
      })
      .select('id')
      .single()
    if (error) {
      console.error('❌ demo 계정 생성 실패:', error.message)
      process.exit(1)
    }
    console.log(`✓ demo 계정 생성 (id=${created?.id}, username=${DEMO_USERNAME})`)
  }

  console.log('')
  console.log('진입 URL 예시:')
  console.log(`  http://localhost:3000/demo/enter?key=${demoKey}`)
  console.log('')
  console.log('⚠️ DEMO_ACCESS_KEY를 유출하지 마세요. 데모 계정 접근 = 유출.')
}

main().catch(err => {
  console.error('❌ 예상치 못한 오류:', err)
  process.exit(1)
})
