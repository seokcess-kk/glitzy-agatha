import { test as setup, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/auth.fixture'
import * as fs from 'fs'
import * as path from 'path'

const authDir = '.auth'
const superadminFile = path.join(authDir, 'superadmin.json')

setup('superadmin 인증 상태 저장', async ({ page }) => {
  // .auth 디렉토리 생성
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const user = TEST_USERS.superadmin

  // 로그인 페이지로 이동
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // 로그인 폼 입력
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')

  // 대시보드 리다이렉트 대기
  await page.waitForURL('/', { timeout: 15000 })
  await expect(page).toHaveURL('/')

  // 인증 상태 저장
  await page.context().storageState({ path: superadminFile })
})
