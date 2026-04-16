import { createLogger } from '@/lib/logger'

const logger = createLogger('Archive')

type SupabaseClient = ReturnType<typeof import('@/lib/supabase').serverSupabase>

/**
 * 삭제 전 레코드를 deleted_records 테이블에 스냅샷 보관
 * 실패해도 메인 삭제 플로우를 막지 않음
 */
export async function archiveBeforeDelete(
  supabase: SupabaseClient,
  tableName: string,
  recordId: number,
  deletedBy: string | number,
  clinicId?: number | null,
): Promise<void> {
  try {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .single()

    if (!data) return

    await supabase.from('deleted_records').insert({
      table_name: tableName,
      record_id: recordId,
      record_data: data,
      deleted_by: typeof deletedBy === 'string' ? parseInt(deletedBy, 10) : deletedBy,
      clinic_id: clinicId ?? data.clinic_id ?? null,
    })
  } catch (e) {
    logger.warn('삭제 스냅샷 보관 실패', { tableName, recordId, error: e })
  }
}

/**
 * 여러 레코드를 일괄 아카이브 (고객 삭제 시 종속 데이터 보관용)
 */
export async function archiveBulkBeforeDelete(
  supabase: SupabaseClient,
  tableName: string,
  filterColumn: string,
  filterValue: number,
  deletedBy: string | number,
  clinicId?: number | null,
): Promise<void> {
  try {
    const { data: records } = await supabase
      .from(tableName)
      .select('*')
      .eq(filterColumn, filterValue)

    if (!records || records.length === 0) return

    const inserts = records.map((record: any) => ({
      table_name: tableName,
      record_id: record.id,
      record_data: record,
      deleted_by: typeof deletedBy === 'string' ? parseInt(deletedBy, 10) : deletedBy,
      clinic_id: clinicId ?? record.clinic_id ?? null,
    }))

    await supabase.from('deleted_records').insert(inserts)
  } catch (e) {
    logger.warn('일괄 삭제 스냅샷 보관 실패', { tableName, filterColumn, filterValue, error: e })
  }
}
