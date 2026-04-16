/**
 * API 키 암호화/복호화 유틸리티
 * - AES-256-GCM 암호화
 * - 환경변수 API_ENCRYPTION_KEY (32바이트 base64)
 * - 키 없으면 경고 로그 + 평문 JSON 폴백 (개발환경)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM 권장 IV 길이
const AUTH_TAG_LENGTH = 16

/**
 * 환경변수에서 암호화 키를 가져온다.
 * 없으면 null 반환 (평문 폴백 모드)
 */
function getEncryptionKey(): Buffer | null {
  const keyBase64 = process.env.API_ENCRYPTION_KEY
  if (!keyBase64) {
    return null
  }

  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    logger.error('API_ENCRYPTION_KEY must be 32 bytes (base64 encoded). Got ' + key.length + ' bytes')
    return null
  }

  return key
}

/**
 * API 설정 객체를 AES-256-GCM으로 암호화한다.
 *
 * 반환 형식: base64(iv:authTag:ciphertext)
 * API_ENCRYPTION_KEY가 없으면 평문 JSON을 반환한다 (개발환경 폴백).
 */
export function encryptApiConfig(config: Record<string, unknown>): string {
  const key = getEncryptionKey()
  const jsonStr = JSON.stringify(config)

  if (!key) {
    logger.warn('API_ENCRYPTION_KEY not set. Storing config as plaintext (dev fallback)')
    return jsonStr
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(jsonStr, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // iv:authTag:ciphertext → base64
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString('base64')
}

/**
 * 암호화된 문자열을 복호화하여 객체로 반환한다.
 *
 * 복호화 실패 시 null을 반환한다 (크래시 방지).
 * 평문 JSON 폴백: 암호화되지 않은 JSON 문자열도 처리한다.
 */
export function decryptApiConfig(encrypted: string): Record<string, unknown> | null {
  if (!encrypted) {
    return null
  }

  // 평문 JSON 폴백 감지 ('{' 로 시작하면 평문)
  if (encrypted.startsWith('{')) {
    try {
      return JSON.parse(encrypted) as Record<string, unknown>
    } catch (e) {
      logger.error('Failed to parse plaintext config JSON', e)
      return null
    }
  }

  const key = getEncryptionKey()
  if (!key) {
    logger.error('API_ENCRYPTION_KEY not set. Cannot decrypt encrypted config')
    return null
  }

  try {
    const combined = Buffer.from(encrypted, 'base64')

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      logger.error('Encrypted data too short')
      return null
    }

    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>
  } catch (e) {
    logger.error('Failed to decrypt API config', e)
    return null
  }
}
