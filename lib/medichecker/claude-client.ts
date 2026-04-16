/**
 * Claude API Client
 * Sonnet (판단용) + Haiku (분류용) 모델 관리
 */

import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@/lib/logger'
import { CLASSIFICATION_PROMPT } from '@/lib/medichecker/prompts/classification'
import { QUERY_REWRITE_PROMPT } from '@/lib/medichecker/prompts/query-rewrite'
import { JUDGMENT_PROMPT } from '@/lib/medichecker/prompts/judgment'
import { VERIFICATION_PROMPT } from '@/lib/medichecker/prompts/verification'
import type {
  SearchResult,
  EnrichedContext,
  Violation,
  ClassificationResponse,
  JudgmentResponse,
  VerificationResponse,
} from '@/lib/medichecker/types'

const logger = createLogger('MediChecker:Claude')

// 모델 ID
export const CLAUDE_MODELS = {
  SONNET: 'claude-sonnet-4-20250514',
  HAIKU: 'claude-haiku-4-5-20251001',
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]

let _client: Anthropic | null = null

/**
 * Anthropic 클라이언트 싱글톤
 */
export function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

/**
 * Claude API 호출 (단순화된 인터페이스)
 */
export async function callClaude(options: {
  model: ClaudeModel
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  const client = getClaudeClient()

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0,
    system: options.system,
    messages: options.messages,
  })

  // 텍스트 응답 추출
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textContent.text
}

/**
 * JSON 응답 파싱 (마크다운 코드블록 처리 포함)
 */
function parseJsonResponse<T>(response: string, fallback: T): T {
  // 마크다운 코드블록 제거
  let cleaned = response.trim()

  // ```json ... ``` 또는 ``` ... ``` 형태 처리
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // JSON 객체/배열 추출 시도
  const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) {
    cleaned = jsonMatch[1]
  }

  try {
    return JSON.parse(cleaned) as T
  } catch {
    logger.warn('Failed to parse JSON response', { action: 'parseJson', response: response.slice(0, 200) })
    return fallback
  }
}

/**
 * 2단계: 컨텍스트 분류 (Haiku)
 */
export async function classifyContext(
  text: string,
  adType: string
): Promise<ClassificationResponse> {
  const response = await callClaude({
    model: CLAUDE_MODELS.HAIKU,
    system: CLASSIFICATION_PROMPT.system,
    messages: [
      {
        role: 'user',
        content: CLASSIFICATION_PROMPT.buildUserMessage(text, adType),
      },
    ],
    maxTokens: 1024,
    temperature: 0,
  })

  return parseJsonResponse<ClassificationResponse>(response, {
    specialty: null,
    procedure: null,
    claims: [],
  })
}

/**
 * 3단계: Query Rewriting (Haiku)
 */
export async function rewriteQuery(
  text: string,
  classification: { specialty: string | null; procedure: string | null; claims?: string[] }
): Promise<string[]> {
  const response = await callClaude({
    model: CLAUDE_MODELS.HAIKU,
    system: QUERY_REWRITE_PROMPT.system,
    messages: [
      {
        role: 'user',
        content: QUERY_REWRITE_PROMPT.buildUserMessage(text, classification),
      },
    ],
    maxTokens: 512,
    temperature: 0,
  })

  const queries = parseJsonResponse<string[]>(response, [])

  // 빈 결과시 기본 쿼리 생성
  if (queries.length === 0) {
    const defaultQueries: string[] = []
    if (classification.procedure) {
      defaultQueries.push(`${classification.procedure} 광고 위반`)
    }
    if (classification.specialty) {
      defaultQueries.push(`${classification.specialty} 의료광고 규제`)
    }
    defaultQueries.push('의료법 제56조 위반 사례')
    return defaultQueries.slice(0, 3)
  }

  return queries
}

/**
 * 5단계: 위반 판단 (Sonnet)
 */
export async function judgeViolation(
  adText: string,
  adType: string,
  searchResults: SearchResult[],
  enrichedContext: EnrichedContext
): Promise<JudgmentResponse> {
  const response = await callClaude({
    model: CLAUDE_MODELS.SONNET,
    system: JUDGMENT_PROMPT.system,
    messages: [
      {
        role: 'user',
        content: JUDGMENT_PROMPT.buildUserMessage(
          adText,
          adType,
          searchResults,
          enrichedContext
        ),
      },
    ],
    maxTokens: 4096,
    temperature: 0,
  })

  return parseJsonResponse<JudgmentResponse>(response, {
    violations: [],
    riskScore: 0,
    summary: '판단 실패',
  })
}

/**
 * 6단계: Self-Verification (Sonnet)
 */
export async function verifySelf(
  adText: string,
  initialJudgment: JudgmentResponse,
  context: string
): Promise<VerificationResponse> {
  const response = await callClaude({
    model: CLAUDE_MODELS.SONNET,
    system: VERIFICATION_PROMPT.system,
    messages: [
      {
        role: 'user',
        content: VERIFICATION_PROMPT.buildUserMessage(adText, initialJudgment, context),
      },
    ],
    maxTokens: 4096,
    temperature: 0,
  })

  return parseJsonResponse<VerificationResponse>(response, {
    verified: true,
    modifications: [],
    finalViolations: initialJudgment.violations,
    finalRiskScore: initialJudgment.riskScore,
    finalSummary: initialJudgment.summary,
  })
}
