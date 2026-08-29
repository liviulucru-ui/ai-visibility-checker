import { createHash, randomBytes } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

type QueryResult = {
  query: string;
  results: SearchResult[];
  unavailable?: boolean;
  provider_error?: string;
};

const interpretationSchema = z.object({
  visibility_score: z.number().min(0).max(100),
  summary: z.string(),
  brand_presence: z.enum([
    "High",
    "Medium",
    "Low",
    "Not Found",
  ]),
  top_competitors: z.array(
    z.object({
      name: z.string(),
      domain: z.string(),
      strengths: z.string(),
    }),
  ),
  ai_readiness_breakdown: z.object({
    chatgpt_visibility: z.string(),
    perplexity_search_rank: z.string(),
    google_gemini_presence: z.string(),
  }),
  actionable_recommendations: z.array(
    z.object({
      priority: z.enum(["High", "Medium"]),
      action: z.string(),
      impact: z.string(),
    }),
  ),
});

type Interpretation = z.infer<typeof interpretationSchema>;

function text(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value.trim().slice(0, 240)
    : fallback;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function privateIp(address: string) {
  if (net.isIPv4(address)) {
    return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(
      address,
    );
  }

  if (net.isIPv6(address)) {
    return (
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      address.startsWith("fe80:")
    );
  }

  return true;
}

async function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Enter a valid business website.");
  }

  const trimmed = value.trim();

  const raw = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsed = new URL(raw);

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new Error("Enter a public http(s) website.");
  }

  if (
    parsed.hostname === "localhost" ||
    !parsed.hostname.includes(".")
  ) {
    throw new Error("Enter a public website hostname.");
  }

  const addresses = await dns.lookup(parsed.hostname, {
    all: true,
  });

  if (
    !addresses.length ||
    addresses.some(({ address }) => privateIp(address))
  ) {
    throw new Error(
      "That website is not publicly reachable.",
    );
  }

  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
}

function cleanSearchResults(raw: unknown): SearchResult[] {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray(
      (raw as { organic_results?: unknown[] })
        .organic_results,
    )
  ) {
    return [];
  }

  return (
    raw as {
      organic_results: Array<{
        title?: unknown;
        link?: unknown;
        snippet?: unknown;
      }>;
    }
  ).organic_results
    .slice(0, 10)
    .map((item) => ({
      title:
        typeof item.title === "string"
          ? item.title
          : "",
      link:
        typeof item.link === "string" ? item.link : "",
      snippet:
        typeof item.snippet === "string"
          ? item.snippet
          : "",
    }));
}

function deterministicScore(
  queries: QueryResult[],
  businessName: string,
  websiteUrl: string,
) {
  const validQueries = queries.filter(
    (query) => query.results.length > 0,
  );

  if (!validQueries.length) {
    return null;
  }

  const domain = new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .toLowerCase();

  const businessNeedle =
    businessName.toLowerCase();

  const mentions = validQueries.filter(({ results }) =>
    results.some((result) =>
      `${result.title ?? ""} ${result.link ?? ""} ${
        result.snippet ?? ""
      }`
        .toLowerCase()
        .includes(businessNeedle),
    ),
  ).length;

  const firstPositions = validQueries.filter(
    ({ results }) =>
      `${results[0]?.title ?? ""} ${
        results[0]?.link ?? ""
      }`
        .toLowerCase()
        .includes(businessNeedle),
  ).length;

  const citations = validQueries.filter(({ results }) =>
    results.some((result) =>
      (result.link ?? "")
        .toLowerCase()
        .includes(domain),
    ),
  ).length;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (mentions / validQueries.length) * 55 +
          (firstPositions / validQueries.length) *
            25 +
          (citations / validQueries.length) * 20,
      ),
    ),
  );
}

async function runSerpApi(params: {
  businessName: string;
  location: string;
  country: string;
  category: string;
  mainService: string;
}) {
  const key =
    process.env.SERPAPI_KEY_2 ??
    process.env.SERPAPI_KEY;

  if (!key) {
    throw new Error(
      "SerpApi is not configured on the server.",
    );
  }

  const {
    businessName,
    location,
    country,
    category,
    mainService,
  } = params;

  const generatedQueries = [
    `"${businessName}" ${category}`,
    `"${businessName}" ${mainService || category}`,
    `best ${category} ${
      mainService || "services"
    } in ${country || location}`,
    `top ${category} ${country || location}`,
  ];

  const uniqueQueries = [
    ...new Set(
      generatedQueries
        .map((query) => query.trim())
        .filter(Boolean),
    ),
  ];

  const queryResults: QueryResult[] = [];

  for (const query of uniqueQueries) {
    try {
      const searchParams = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: key,
        num: "10",
      });

      const response = await fetch(
        `https://serpapi.com/search.json?${searchParams.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        },
      );

      const rawText = await response.text();

      let data: unknown;

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `SerpApi returned invalid JSON for query: ${query}`,
        );
      }

      const apiError =
        data &&
        typeof data === "object" &&
        typeof (data as { error?: unknown }).error ===
          "string"
          ? String(
              (data as { error: string }).error,
            )
          : "";

      if (!response.ok || apiError) {
        queryResults.push({
          query,
          results: [],
          unavailable: true,
          provider_error:
            apiError ||
            `SerpApi returned HTTP ${response.status}`,
        });

        continue;
      }

      queryResults.push({
        query,
        results: cleanSearchResults(data),
        unavailable: false,
      });
    } catch (error) {
      queryResults.push({
        query,
        results: [],
        unavailable: true,
        provider_error:
          error instanceof Error
            ? error.message
            : "Unknown SerpApi error",
      });
    }
  }

  const validQueries = queryResults.filter(
    (query) => !query.unavailable,
  );

  if (!validQueries.length) {
    const firstError = queryResults.find(
      (query) => query.provider_error,
    )?.provider_error;

    throw new Error(
      `SerpApi error: ${
        firstError || "all search queries failed"
      }`,
    );
  }

  return queryResults;
}

async function runGemini(params: {
  businessName: string;
  websiteUrl: string;
  location: string;
  country: string;
  category: string;
  mainService: string;
  queryResults: QueryResult[];
}): Promise<Interpretation> {
  const key =
    process.env.GEMINI_API_KEY_2 ??
    process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "Gemini is not configured on the server.",
    );
  }

  const modelName =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

  const google = createGoogleGenerativeAI({
    apiKey: key,
  });

  const prompt = `
You are a senior SEO and AI Brand Visibility analyst.

Analyze the supplied Google search evidence for this business.

BUSINESS
Business name: ${params.businessName}
Website: ${params.websiteUrl}
Location: ${params.location}
Country: ${params.country}
Category: ${params.category}
Main service: ${params.mainService}

SEARCH EVIDENCE
${JSON.stringify(params.queryResults, null, 2)}

RULES
- Use only the supplied evidence.
- Do not invent rankings, competitors, citations, facts, traffic, reviews, or AI-engine visibility.
- If evidence is weak, say so.
- visibility_score must be an integer or number between 0 and 100.
- Recommendations must be practical and directly related to improving AI/search visibility.
- Return ONLY valid JSON.
- Do not wrap the JSON in markdown unless unavoidable.

Return exactly this structure:

{
  "visibility_score": 0,
  "summary": "string",
  "brand_presence": "High",
  "top_competitors": [
    {
      "name": "string",
      "domain": "string",
      "strengths": "string"
    }
  ],
  "ai_readiness_breakdown": {
    "chatgpt_visibility": "string",
    "perplexity_search_rank": "string",
    "google_gemini_presence": "string"
  },
  "actionable_recommendations": [
    {
      "priority": "High",
      "action": "string",
      "impact": "string"
    }
  ]
}

Allowed brand_presence values:
"High", "Medium", "Low", "Not Found"

Allowed recommendation priority values:
"High", "Medium"
`.trim();

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await generateText({
        model: google(modelName),
        temperature: 0.2,
        prompt,
      });

      const cleaned = response.text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed: unknown = JSON.parse(cleaned);

      return interpretationSchema.parse(parsed);
    } catch (error) {
      lastError = error;

      console.warn(
        `AUDIT GEMINI ATTEMPT ${attempt} FAILED`,
        error instanceof Error
          ? error.message
          : "Unknown Gemini error",
      );
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Gemini error: ${lastError.message}`
      : "Gemini failed to generate a valid audit.",
  );
}

export async function POST(request: Request) {
  let auditId: string | undefined;

  try {
    const body = await request.json();

    const businessName = text(
      body?.businessName ?? body?.business_name,
    );

    const location = text(body?.location);
    const country = text(body?.country);
    const category = text(body?.category);

    const mainService = text(
      body?.mainService ?? body?.main_service,
    );

    const rawWebsite =
      body?.website ??
      body?.website_url ??
      body?.url ??
      body?.domain;

    const email =
      text(body?.email, "").toLowerCase() || null;

    if (
      !businessName ||
      !location ||
      !country ||
      !category
    ) {
      return NextResponse.json(
        {
          error:
            "Business name, location, country, and category are required.",
        },
        { status: 400 },
      );
    }

    const websiteUrl =
      await normalizeUrl(rawWebsite);

    const accessToken =
      randomBytes(32).toString("hex");

    const accessTokenHash = createHash("sha256")
      .update(accessToken)
      .digest("hex");

    /*
     * 1. Create queued audit.
     */
    const { data: audit, error: insertError } =
      await supabaseAdmin
        .from("audits")
        .insert({
          business_name: businessName,
          website_url: websiteUrl,
          location,
          country,
          category,
          main_service: mainService || null,
          email,
          status: "queued",
          score: null,
          findings: null,
          is_paid: false,
          access_token_hash: accessTokenHash,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

    if (insertError || !audit) {
      console.error(
        "AUDIT INSERT FAILED",
        insertError?.message,
      );

      return NextResponse.json(
        {
          error:
            "Audit service is temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    auditId = audit.id;

    console.log(`AUDIT CREATED: ${auditId}`);

    /*
     * 2. queued -> processing
     */
    const { data: processingAudit, error: processingError } =
      await supabaseAdmin
        .from("audits")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", auditId)
        .select("id,status")
        .single();

    if (processingError || !processingAudit) {
      throw new Error(
        `Could not set audit to processing: ${
          processingError?.message ??
          "unknown database error"
        }`,
      );
    }

    console.log(`AUDIT PROCESSING: ${auditId}`);

    /*
     * 3. SerpAPI
     */
    const queryResults = await runSerpApi({
      businessName,
      location,
      country,
      category,
      mainService,
    });

    console.log(
      `AUDIT SERP COMPLETE: ${auditId}`,
    );

    /*
     * 4. Gemini
     */
    const interpretation = await runGemini({
      businessName,
      websiteUrl,
      location,
      country,
      category,
      mainService,
      queryResults,
    });

    console.log(
      `AUDIT GEMINI COMPLETE: ${auditId}`,
    );

    /*
     * Deterministic search score is retained as
     * supporting evidence, while Gemini's validated
     * visibility_score is used as the final report score.
     */
    const searchEvidenceScore =
      deterministicScore(
        queryResults,
        businessName,
        websiteUrl,
      );

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          interpretation.visibility_score,
        ),
      ),
    );

    const findings = {
      business_name: businessName,
      website_url: websiteUrl,
      location,
      country,
      category,
      main_service: mainService || null,

      queries_analyzed: queryResults.length,

      raw_search_evidence: queryResults,
      query_results: queryResults,

      deterministic_score:
        searchEvidenceScore,

      deterministic_score_inputs: {
        valid_queries: queryResults.filter(
          (query) =>
            !query.unavailable &&
            query.results.length > 0,
        ).length,

        mentions_weight: 55,
        top_result_weight: 25,
        citations_weight: 20,
      },

      ai_interpretation: interpretation,

      ai_interpretation_status:
        "available",

      note: queryResults.some(
        (query) => query.unavailable,
      )
        ? "Some SerpApi queries were unavailable."
        : null,
    };

    /*
     * 5. processing -> ready
     *
     * select().single() is intentional:
     * the UPDATE must not silently succeed without
     * updating the expected database row.
     */
    const { data: readyAudit, error: updateError } =
      await supabaseAdmin
        .from("audits")
        .update({
          status: "ready",
          score,
          findings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auditId)
        .select(
          "id,status,score,findings,is_paid",
        )
        .single();

    if (updateError || !readyAudit) {
      throw new Error(
        `Could not save generated audit: ${
          updateError?.message ??
          "unknown database error"
        }`,
      );
    }

    console.log(
      `AUDIT READY: ${auditId}`,
    );

    return NextResponse.json(
      {
        auditId,
        accessToken,
        status: "ready",
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown audit error";

    console.error(
      `AUDIT FAILED${
        auditId ? `: ${auditId}` : ""
      }`,
      message,
    );

    /*
     * Never leave an already-created audit stuck
     * forever in queued or processing.
     */
    if (auditId) {
      try {
        const { error: failedUpdateError } =
          await supabaseAdmin
            .from("audits")
            .update({
              status: "failed",
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", auditId);

        if (failedUpdateError) {
          console.error(
            `AUDIT FAILED STATUS UPDATE ERROR: ${auditId}`,
            failedUpdateError.message,
          );
        }
      } catch (failedStatusError) {
        console.error(
          `AUDIT FAILED STATUS UPDATE EXCEPTION: ${auditId}`,
          failedStatusError,
        );
      }
    }

    const safeClientError =
      message.startsWith("Enter ") ||
      message.includes("public website");

    return NextResponse.json(
      {
        error: safeClientError
          ? message
          : "The audit could not be generated right now. Please try again.",
        auditId,
      },
      {
        status: safeClientError ? 400 : 502,
      },
    );
  }
}

export async function GET(request: Request) {
  try {
    const params = new URL(
      request.url,
    ).searchParams;

    const id = params.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        {
          error: "Audit ID required.",
        },
        { status: 400 },
      );
    }

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error: "Invalid Audit ID format.",
        },
        { status: 400 },
      );
    }

    /*
     * IMPORTANT:
     *
     * Existence lookup is ONLY by UUID.
     *
     * Do NOT filter by:
     * - status
     * - is_paid
     * - access_token_hash
     * - report_access_token_hash
     */
    const { data: audit, error } =
      await supabaseAdmin
        .from("audits")
        .select(
          `
          id,
          business_name,
          website_url,
          location,
          country,
          category,
          main_service,
          email,
          status,
          score,
          findings,
          is_paid,
          gumroad_sale_id,
          payment_verified_at,
          created_at,
          updated_at
        `,
        )
        .eq("id", id)
        .maybeSingle();

    if (error) {
      console.error(
        `GET AUDIT DATABASE ERROR: ${id}`,
        error.message,
      );

      return NextResponse.json(
        {
          error:
            "Audit service is temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    /*
     * ONLY a genuinely nonexistent UUID gets 404.
     */
    if (!audit) {
      return NextResponse.json(
        {
          error: "Audit not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(audit, {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/audits FAILED",
      error instanceof Error
        ? error.message
        : error,
    );

    return NextResponse.json(
      {
        error:
          "Audit service is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}