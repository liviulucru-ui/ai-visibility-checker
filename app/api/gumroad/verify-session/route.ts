import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function expectedPermalink() {
  const productUrl = process.env.GUMROAD_PRODUCT_URL_2;

  if (!productUrl) {
    return null;
  }

  try {
    return new URL(productUrl).pathname
      .split("/")
      .filter(Boolean)
      .at(-1) ?? null;
  } catch {
    return null;
  }
}

function extractAuditIdFromSale(sale: any): string | null {
  const customFields =
    sale?.custom_fields ??
    sale?.custom_fields_values ??
    {};

  if (customFields && typeof customFields === "object") {
    const direct =
      customFields.audit_id ??
      customFields.auditId ??
      customFields["Audit ID"];

    if (typeof direct === "string") {
      return direct;
    }

    if (Array.isArray(customFields)) {
      for (const field of customFields) {
        const name = String(
          field?.name ??
            field?.label ??
            field?.key ??
            "",
        ).toLowerCase();

        if (
          name === "audit_id" ||
          name === "audit id"
        ) {
          const value = String(
            field?.value ?? "",
          ).trim();

          if (value) {
            return value;
          }
        }
      }
    }
  }

  const fallback =
    sale?.audit_id ??
    sale?.auditId;

  return typeof fallback === "string"
    ? fallback
    : null;
}

async function verifySale(saleId: string) {
  const accessToken =
    process.env.GUMROAD_ACCESS_TOKEN_2;

  if (!accessToken) {
    return {
      ok: false,
      unavailable: true as const,
      sale: null,
      auditId: null,
    };
  }

  try {
    const response = await fetch(
      `https://api.gumroad.com/v2/sales/${encodeURIComponent(
        saleId,
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        unavailable:
          response.status >= 500 ||
          response.status === 429,
        sale: null,
        auditId: null,
      };
    }

    const payload = await response
      .json()
      .catch(() => null);

    if (!payload) {
      return {
        ok: false,
        unavailable: true as const,
        sale: null,
        auditId: null,
      };
    }

    const sale =
      payload?.sale ??
      payload?.purchase ??
      payload;

    const returnedSaleId = String(
      sale?.id ??
        sale?.sale_id ??
        "",
    );

    const permalink =
      sale?.product?.permalink ??
      sale?.product_permalink ??
      sale?.permalink ??
      null;

    const currency = String(
      sale?.currency ??
        sale?.currency_type ??
        "",
    ).toUpperCase();

    const rawPrice =
      sale?.price ??
      sale?.price_cents ??
      null;

    const price =
      rawPrice === null ||
      rawPrice === undefined
        ? null
        : Number(rawPrice);

    const expected = expectedPermalink();

    const auditId =
      extractAuditIdFromSale(sale);

    const refunded =
      sale?.refunded === true;

    const disputed =
      sale?.disputed === true;

    const chargebacked =
      sale?.chargebacked === true;

    const expectedProductId =
      process.env.GUMROAD_PRODUCT_ID;

    const productId =
      sale?.product_id ??
      sale?.product?.id ??
      null;

    const productMatches =
      !expectedProductId ||
      !productId ||
      productId === expectedProductId;

    const permalinkMatches =
      !expected ||
      !permalink ||
      permalink === expected;

    const saleIdMatches =
      returnedSaleId === saleId;

    const currencyMatches =
      !currency ||
      currency === "USD";

    /*
     * Price validation:
     * Gumroad commonly reports price in cents.
     * If price is present, require $19.
     */
    const priceMatches =
      price === null ||
      price === 1900 ||
      price === 19;

    const ok =
      saleIdMatches &&
      !refunded &&
      !disputed &&
      !chargebacked &&
      productMatches &&
      permalinkMatches &&
      currencyMatches &&
      priceMatches;

    return {
      ok,
      unavailable: false as const,
      sale,
      auditId,
    };
  } catch (error) {
    console.error(
      "[Verify Session] Gumroad verification error",
      error instanceof Error
        ? error.message
        : error,
    );

    return {
      ok: false,
      unavailable: true as const,
      sale: null,
      auditId: null,
    };
  }
}

export async function POST(
  req: Request,
) {
  try {
    const body = await req
      .json()
      .catch(() => ({}));

    const auditId = String(
      body?.audit_id ??
        body?.auditId ??
        "",
    ).trim();

    const saleId = String(
      body?.sale_id ??
        body?.saleId ??
        "",
    ).trim();

    if (!auditId) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "missing_audit_id",
        },
        { status: 400 },
      );
    }

    if (!isUuid(auditId)) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "invalid_audit_id",
        },
        { status: 400 },
      );
    }

    /*
     * Load by UUID using admin client.
     * No RLS, no token hash filters.
     */
    const { data: audit, error: fetchError } =
      await supabaseAdmin
        .from("audits")
        .select(
          `
          id,
          email,
          status,
          is_paid,
          findings,
          gumroad_sale_id,
          payment_verified_at
        `,
        )
        .eq("id", auditId)
        .maybeSingle();

    if (fetchError) {
      console.error(
        "[Verify Session] Supabase fetch error",
        fetchError.message,
      );

      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "database_error",
        },
        { status: 503 },
      );
    }

    if (!audit) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "not_found",
        },
        { status: 404 },
      );
    }

    /*
     * Already verified by webhook or earlier request.
     */
    if (audit.is_paid) {
      return NextResponse.json(
        {
          success: true,
          ok: true,
          verified: true,
          source: "database",
          audit: {
            id: audit.id,
            is_paid: true,
            status: audit.status,
            payment_verified_at:
              audit.payment_verified_at,
          },
        },
        { status: 200 },
      );
    }

    /*
     * Existing audit + no saleId = pending,
     * never false 404.
     */
    if (!saleId) {
      return NextResponse.json(
        {
          success: true,
          ok: true,
          verified: false,
          pending: true,
          audit: {
            id: audit.id,
            status: audit.status,
            is_paid: false,
          },
        },
        { status: 200 },
      );
    }

    const verification =
      await verifySale(saleId);

    /*
     * Temporary Gumroad unavailability:
     * existing audit remains pending.
     */
    if (verification.unavailable) {
      return NextResponse.json(
        {
          success: true,
          ok: true,
          verified: false,
          pending: true,
        },
        { status: 200 },
      );
    }

    /*
     * Invalid/unverified sale:
     * do not unlock.
     *
     * We still return pending for normal eventual-consistency
     * cases unless the sale clearly contradicts the audit.
     */
    if (!verification.ok) {
      return NextResponse.json(
        {
          success: true,
          ok: true,
          verified: false,
          pending: true,
        },
        { status: 200 },
      );
    }

    /*
     * Gumroad must confirm this sale belongs
     * to the same audit ID.
     */
    if (
      !verification.auditId ||
      verification.auditId !== auditId
    ) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          verified: false,
          error: "audit_mismatch",
        },
        { status: 403 },
      );
    }

    const sale =
      verification.sale;

    /*
     * Optional email binding for extra safety.
     */
    const auditEmail =
      normalizeEmail(audit.email);

    const saleEmail =
      normalizeEmail(
        sale?.email ??
          sale?.purchase_email,
      );

    if (
      auditEmail &&
      saleEmail &&
      auditEmail !== saleEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          verified: false,
          error: "email_mismatch",
        },
        { status: 403 },
      );
    }

    const now =
      new Date().toISOString();

    const verifiedSaleId = String(
      sale?.id ??
        sale?.sale_id ??
        saleId,
    );

    /*
     * IMPORTANT:
     * Payment verification is payment state.
     * Preserve it explicitly.
     */
    const { data: updatedAudit, error: updateError } =
      await supabaseAdmin
        .from("audits")
        .update({
          is_paid: true,
          gumroad_sale_id:
            verifiedSaleId,
          status:
            "payment_verified",
          payment_verified_at: now,
          updated_at: now,
        })
        .eq("id", auditId)
        .select(
          `
          id,
          status,
          is_paid,
          gumroad_sale_id,
          payment_verified_at,
          findings
        `,
        )
        .single();

    if (updateError || !updatedAudit) {
      console.error(
        "[Verify Session] Supabase update error",
        updateError?.message,
      );

      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "payment_update_failed",
        },
        { status: 503 },
      );
    }

    console.log(
      `[Verify Session] PAYMENT VERIFIED audit=${auditId} sale=${verifiedSaleId}`,
    );

    return NextResponse.json(
      {
        success: true,
        ok: true,
        verified: true,
        is_paid: true,
        source: "gumroad",
        redirect_url:
          `/results/${auditId}?paid=true`,
        audit: {
          id: updatedAudit.id,
          status:
            updatedAudit.status,
          is_paid:
            updatedAudit.is_paid,
          payment_verified_at:
            updatedAudit.payment_verified_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[Verify Session Error]",
      error instanceof Error
        ? error.message
        : error,
    );

    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: "internal_error",
      },
      { status: 500 },
    );
  }
}