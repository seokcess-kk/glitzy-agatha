import type { Metadata } from 'next'
import { serverSupabase } from '@/lib/supabase'
import { parseId } from '@/lib/security'
import LandingPageContent from './LandingPageContent'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const lpId = parseId(params.id as string | undefined)

  if (!lpId) {
    return { title: '랜딩 페이지' }
  }

  const supabase = serverSupabase()
  const { data } = await supabase
    .from('landing_pages')
    .select('name')
    .eq('id', lpId)
    .eq('is_active', true)
    .single()

  return {
    title: data?.name || '랜딩 페이지',
  }
}

export default function LandingPage() {
  return <LandingPageContent />
}
