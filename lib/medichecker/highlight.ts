/**
 * 위반 텍스트 하이라이트 위치 매칭 유틸리티
 *
 * AI가 position을 직접 계산하지 않고, text 필드만 출력.
 * 이 함수가 원본 텍스트에서 위반 텍스트의 위치를 찾아 highlightRanges를 계산.
 */

import type { Violation } from '@/lib/medichecker/types'

/**
 * 텍스트 정규화 (공백, 줄바꿈 통일)
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

/**
 * 정규화된 텍스트에서 원본 텍스트로 인덱스 매핑
 */
function findOriginalRange(
  original: string,
  normalizedQuery: string
): [number, number] | null {
  const normalizedOriginal = normalizeText(original)
  const normalizedIndex = normalizedOriginal.indexOf(normalizedQuery)

  if (normalizedIndex === -1) return null

  // 정규화된 인덱스를 원본 인덱스로 변환
  let normalizedPos = 0
  let originalStart = -1
  let originalEnd = -1

  for (let i = 0; i < original.length; i++) {
    const char = original[i]
    const isWhitespace = /\s/.test(char)

    // 연속 공백 스킵 (첫 번째 공백만 카운트)
    if (isWhitespace) {
      const prevChar = i > 0 ? original[i - 1] : ''
      if (/\s/.test(prevChar)) continue
    }

    if (normalizedPos === normalizedIndex && originalStart === -1) {
      originalStart = i
    }

    if (normalizedPos === normalizedIndex + normalizedQuery.length - 1) {
      originalEnd = i + 1
      break
    }

    normalizedPos++
  }

  if (originalStart === -1 || originalEnd === -1) return null
  return [originalStart, originalEnd]
}

/**
 * 핵심 구절 추출 (첫 번째 의미 있는 단어들)
 */
function extractCorePhrase(text: string): string {
  // 특수문자 제거하고 핵심 단어들만 추출
  const words = text
    .replace(/[^\w가-힣\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2)

  // 처음 3개 단어 사용
  return words.slice(0, 3).join('.*')
}

/**
 * 단일 위반에 대한 하이라이트 범위 찾기
 */
function findSingleViolationRange(
  fullText: string,
  violationText: string
): [number, number][] {
  if (!violationText || violationText.trim() === '') {
    return []
  }

  // 1차: 정확한 indexOf 매칭
  const exactIndex = fullText.indexOf(violationText)
  if (exactIndex !== -1) {
    return [[exactIndex, exactIndex + violationText.length]]
  }

  // 2차: 공백/줄바꿈 정규화 후 매칭
  const normalizedQuery = normalizeText(violationText)
  const normalizedRange = findOriginalRange(fullText, normalizedQuery)
  if (normalizedRange) {
    return [normalizedRange]
  }

  // 3차: 핵심 구절 추출 → 부분 매칭
  const corePhrase = extractCorePhrase(violationText)
  if (corePhrase) {
    try {
      const regex = new RegExp(corePhrase, 'i')
      const match = fullText.match(regex)
      if (match && match.index !== undefined) {
        const start = match.index
        const end = start + match[0].length
        return [[start, end]]
      }
    } catch {
      // regex 실패 시 무시
    }
  }

  // 4차: 완전 실패 → 빈 배열 (깨진 UI 방지)
  return []
}

/**
 * 같은 문구가 여러 번 등장할 때 가장 적합한 위치 선택
 */
function findBestMatch(
  fullText: string,
  violationText: string,
  contextHint?: string
): [number, number] | null {
  const ranges: [number, number][] = []
  let index = 0

  // 모든 등장 위치 찾기
  while (true) {
    const found = fullText.indexOf(violationText, index)
    if (found === -1) break
    ranges.push([found, found + violationText.length])
    index = found + 1
  }

  if (ranges.length === 0) return null
  if (ranges.length === 1) return ranges[0]

  // contextHint (originalText)가 있으면 그 안에 포함된 위치 우선
  if (contextHint) {
    const contextIndex = fullText.indexOf(contextHint)
    if (contextIndex !== -1) {
      const contextEnd = contextIndex + contextHint.length
      for (const range of ranges) {
        if (range[0] >= contextIndex && range[1] <= contextEnd) {
          return range
        }
      }
    }
  }

  // 기본: 첫 번째 등장 위치
  return ranges[0]
}

/**
 * 위반 목록에 highlightRanges 추가
 */
export function findViolationRanges(
  fullText: string,
  violations: Violation[]
): Violation[] {
  return violations.map(violation => {
    // omission 타입은 하이라이트 없음
    if (violation.type === 'omission') {
      return { ...violation, highlightRanges: [] }
    }

    // 같은 문구가 여러 번 등장하는지 확인
    const occurrenceCount = (fullText.match(new RegExp(
      violation.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    )) || []).length

    let ranges: [number, number][]

    if (occurrenceCount > 1) {
      // 같은 문구 중복 → contextHint로 최적 위치 선택
      const bestMatch = findBestMatch(fullText, violation.text, violation.originalText)
      ranges = bestMatch ? [bestMatch] : []
    } else {
      // 일반적인 단일 매칭
      ranges = findSingleViolationRange(fullText, violation.text)
    }

    return { ...violation, highlightRanges: ranges }
  })
}

/**
 * 하이라이트된 위반이 있는지 확인
 */
export function hasHighlightableViolations(violations: Violation[]): boolean {
  return violations.some(v =>
    v.type === 'expression' &&
    v.highlightRanges &&
    v.highlightRanges.length > 0
  )
}
