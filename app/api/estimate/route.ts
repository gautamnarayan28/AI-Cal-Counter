import { NextResponse } from "next/server";

const USER_EMAIL_HEADER = "oai-authenticated-user-email";

// Best-effort per-identity throttle. This lives in the Worker isolate, so it is
// not a hard global cap: a request served by a fresh isolate starts with an
// empty window. It exists to stop a single caller from looping the endpoint.
// Move these counters into D1 once the `DB` binding is real, and keep a monthly
// spend limit set on the OpenAI key as the actual backstop.
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const MAX_PER_HOUR = 30;
const MAX_PER_MINUTE = 8;
const MAX_TRACKED_IDENTITIES = 500;

const hits = new Map<string, number[]>();

type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < HOUR_MS);

  const lastMinute = recent.filter((time) => now - time < MINUTE_MS);
  if (lastMinute.length >= MAX_PER_MINUTE) {
    const oldest = Math.min(...lastMinute);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((MINUTE_MS - (now - oldest)) / 1000)) };
  }
  if (recent.length >= MAX_PER_HOUR) {
    const oldest = Math.min(...recent);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((HOUR_MS - (now - oldest)) / 1000)) };
  }

  // Only successful requests extend the window, so hitting the limit does not
  // keep pushing the caller's own retry further out.
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_IDENTITIES) {
    for (const [identity, times] of hits) {
      if (!times.some((time) => now - time < HOUR_MS)) hits.delete(identity);
    }
  }

  return { allowed: true };
}

/**
 * Resolves the caller from the identity headers Dispatch injects. Returns null
 * for anonymous callers in production. SIWC proves identity but not workspace
 * membership, so set ALLOWED_ESTIMATE_EMAILS to keep this key to yourself.
 */
function identify(request: Request): { identity: string; allowed: boolean } | null {
  const email = request.headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();

  if (email) {
    const allowlist = (process.env.ALLOWED_ESTIMATE_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    return { identity: email, allowed: allowlist.length === 0 || allowlist.includes(email) };
  }

  // Local `vinext dev` has no Dispatch in front of it to inject the headers.
  if (process.env.NODE_ENV !== "production") {
    return { identity: "local-development", allowed: true };
  }

  return null;
}

const mealSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "A concise, readable name for the complete meal.",
    },
    items: {
      type: "array",
      description: "Each distinct food or calorie-relevant component in the meal.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The food name." },
          quantity: { type: "number", description: "The estimated count of the stated unit." },
          unit: { type: "string", description: "A short practical unit such as roti, bowl, cup, piece, slice, tbsp, or serving." },
          caloriesPerUnit: { type: "integer", description: "Estimated calories in one stated unit." },
        },
        required: ["name", "quantity", "unit", "caloriesPerUnit"],
        additionalProperties: false,
      },
    },
    lowEstimate: { type: "integer", description: "A realistic lower bound for the full meal." },
    highEstimate: { type: "integer", description: "A realistic upper bound for the full meal." },
    confidence: { type: "string", enum: ["High", "Medium"] },
    assumption: { type: "string", description: "One concise sentence explaining the most important portion or preparation assumptions." },
  },
  required: ["name", "items", "lowEstimate", "highEstimate", "confidence", "assumption"],
  additionalProperties: false,
} as const;

type OpenAIItem = {
  name: string;
  quantity: number;
  unit: string;
  caloriesPerUnit: number;
};

type OpenAIMeal = {
  name: string;
  items: OpenAIItem[];
  lowEstimate: number;
  highEstimate: number;
  confidence: "High" | "Medium";
  assumption: string;
};

function outputText(response: unknown) {
  if (!response || typeof response !== "object") return "";
  const data = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (data.output_text) return data.output_text;
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  const caller = identify(request);
  if (!caller) {
    return NextResponse.json(
      { error: "Please sign in before estimating a meal." },
      { status: 401 },
    );
  }
  if (!caller.allowed) {
    return NextResponse.json(
      { error: "This account does not have access to the estimator." },
      { status: 403 },
    );
  }

  // Throttle before parsing the body: a photo request carries megabytes of
  // base64 that there is no reason to decode for a caller who is over budget.
  const limit = checkRateLimit(caller.identity);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `That is a lot of estimates at once. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI is ready, but an API key still needs to be added." },
      { status: 503 },
    );
  }

  let description = "";
  let imageDataUrl = "";
  try {
    const body = await request.json() as { description?: unknown; imageDataUrl?: unknown };
    description = typeof body.description === "string" ? body.description.trim() : "";
    imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  } catch {
    return NextResponse.json({ error: "Please enter a meal description." }, { status: 400 });
  }

  if ((!description && !imageDataUrl) || description.length > 500) {
    return NextResponse.json(
      { error: "Please enter a meal description or choose a photo." },
      { status: 400 },
    );
  }

  if (imageDataUrl) {
    const isSupportedImage = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageDataUrl);
    if (!isSupportedImage || imageDataUrl.length > 8_000_000) {
      return NextResponse.json(
        { error: "The prepared photo is too large or uses an unsupported format." },
        { status: 400 },
      );
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning: { effort: "low" },
        max_output_tokens: 900,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You estimate calories for a casual personal food journal from text, meal photos, or both together. Break the meal into distinct editable items. Interpret Indian foods and household measures naturally. Respect explicit quantities and carefully count visible discrete foods. When a photo and a written note both arrive, treat the note as authoritative for quantities, ingredients, and preparation, and read the photo for everything the note leaves unsaid; raise confidence to High only when the note resolves the portions. Include calorie-relevant oil, butter, dressings, sauces, and drinks when stated, visible, or strongly implied. Use realistic typical portions when information is missing. caloriesPerUnit must describe exactly one listed unit; do not put the full multi-unit calories there. For photos, never claim certainty about hidden ingredients or portion depth. Estimates of this kind tend to understate large servings, so do not shade portions downward when a dish looks generous, and keep the range wide enough to cover that. Provide a useful range and one concise assumption. Do not give health advice or moralize. This is an approximate estimate, not a medical measurement.",
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: description || "Identify and estimate this meal." },
              ...(imageDataUrl
                ? [{ type: "input_image", image_url: imageDataUrl, detail: "high" }]
                : []),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "meal_estimate",
            strict: true,
            schema: mealSchema,
          },
        },
      }),
    });

    const responseBody = await response.json();
    if (!response.ok) {
      const message = (responseBody as { error?: { message?: string } }).error?.message;
      throw new Error(message || "OpenAI could not estimate this meal.");
    }

    const text = outputText(responseBody);
    if (!text) throw new Error("OpenAI returned an empty estimate.");

    const estimate = JSON.parse(text) as OpenAIMeal;
    const items = estimate.items
      .filter((item) => item.name && item.unit)
      .map((item) => ({
        name: item.name.slice(0, 80),
        quantity: Math.max(0.25, Math.min(Number(item.quantity) || 1, 50)),
        unit: item.unit.slice(0, 24),
        caloriesPerUnit: Math.max(0, Math.min(Math.round(Number(item.caloriesPerUnit) || 0), 5000)),
      }));

    if (!items.length) throw new Error("OpenAI did not identify any meal items.");

    const totalCalories = Math.round(
      items.reduce((sum, item) => sum + item.quantity * item.caloriesPerUnit, 0),
    );

    return NextResponse.json({
      name: estimate.name.slice(0, 120),
      items,
      totalCalories,
      lowEstimate: Math.min(Math.max(estimate.lowEstimate, 0), totalCalories),
      highEstimate: Math.max(estimate.highEstimate, totalCalories),
      confidence: estimate.confidence,
      assumption: estimate.assumption.slice(0, 240),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The meal could not be estimated.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
