import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { PurchaseStatus } from '@/components/purchase-status'

export const runtime = 'nodejs'

export default async function PurchaseComplete({ searchParams }: { searchParams: Promise<{ audit_id?: string; sale_id?: string }> }) {
  const { audit_id, sale_id } = await searchParams
  const finalAuditId = audit_id || sale_id
  const cookie = (await cookies()).get('purchase_access')?.value
  const [cookieId, token] = cookie?.split(':') ?? []
  if (!finalAuditId || cookieId !== finalAuditId || !token) return <PurchaseStatus auditId={finalAuditId ?? ''} />
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    const { data } = await createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).from('audits').select('id,status').eq('id', finalAuditId).eq('report_access_token_hash', createHash('sha256').update(token).digest('hex')).maybeSingle()
    if (data?.status === 'ready') redirect(`/results/${finalAuditId}?token=${encodeURIComponent(token)}`)
  }
  return <PurchaseStatus auditId={finalAuditId} />
}
