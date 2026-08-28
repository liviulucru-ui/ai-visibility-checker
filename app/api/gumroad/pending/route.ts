import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { audit_id } = body;

    if (!audit_id) {
      return NextResponse.json({ success: false, error: 'missing_audit_id' }, { status: 400 });
    }

    const { data: audit, error: fetchError } = await supabaseAdmin
      .from('audits')
      .select('id,status,is_paid,findings')
      .eq('id', audit_id)
      .single();

    if (fetchError || !audit) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }

    if (!audit.is_paid) {
       return NextResponse.json({ success: true, pending: true });
    }

    return NextResponse.json({ success: true, pending: false, is_paid: true });

  } catch (error) {
    console.error('[Gumroad Pending Error]', error);
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 });
  }
}
