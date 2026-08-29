import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { PurchaseStatus } from '@/components/purchase-status'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export default async function PurchaseComplete({ searchParams }: { searchParams: Promise<{ auditId?: string; audit_id?: string; sale_id?: string; 'custom_fields[audit_id]'?: string; 'url_params[audit_id]'?: string }> }) {
  const params = await searchParams
  const sale_id = params.sale_id
  const finalAuditId = params.auditId || params.audit_id || params['custom_fields[audit_id]'] || params['url_params[audit_id]'] || sale_id || ''
  const cookie = (await cookies()).get('purchase_access')?.value
  const [cookieId, token] = cookie?.split(':') ?? []
  if (!finalAuditId || cookieId !== finalAuditId || !token) return <PurchaseStatus auditId={finalAuditId} saleId={sale_id} />

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('audits').select('id,status,is_paid,findings').eq('id', finalAuditId).eq('report_access_token_hash', createHash('sha256').update(token).digest('hex')).maybeSingle()
  }
  return <PurchaseStatus auditId={finalAuditId} saleId={sale_id} />
}
