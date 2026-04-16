/**
 * Embedding Provider
 * OpenAI text-embedding-3-small (1536차원) 사용
 */

import OpenAI from 'openai'
import { createLogger } from '@/lib/logger'

const logger = createLogger('MediChecker:Embedding')

/**
 * 임베딩 프로바이더 인터페이스
 * 모델 교체 시 이 인터페이스만 구현
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  readonly dimension: number
  readonly model: string
}

/**
 * OpenAI 임베딩 프로바이더
 * text-embedding-3-small (1536차원)
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI
  readonly dimension = 1536
  readonly model = 'text-embedding-3-small'

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable')
    }
    this.client = new OpenAI({ apiKey })
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: this.normalizeText(text),
    })

    return response.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const normalizedTexts = texts.map((t) => this.normalizeText(t))

    const response = await this.client.embeddings.create({
      model: this.model,
      input: normalizedTexts,
    })

    return response.data.map((d) => d.embedding)
  }

  /**
   * 임베딩 전 텍스트 정규화
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  }
}

// 싱글톤 인스턴스
let _embeddingProvider: EmbeddingProvider | null = null

export const embeddingProvider: EmbeddingProvider = {
  get dimension() {
    return getProvider().dimension
  },
  get model() {
    return getProvider().model
  },
  embed(text: string) {
    return getProvider().embed(text)
  },
  embedBatch(texts: string[]) {
    return getProvider().embedBatch(texts)
  },
}

function getProvider(): EmbeddingProvider {
  if (!_embeddingProvider) {
    logger.info('Initializing OpenAI embedding provider', { action: 'init' })
    _embeddingProvider = new OpenAIEmbeddingProvider()
  }
  return _embeddingProvider
}

/**
 * 테스트용 프로바이더 주입
 */
export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  _embeddingProvider = provider
}
