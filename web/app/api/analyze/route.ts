import { extractTranscriptFromFile } from "@/lib/parse";

export const runtime = "nodejs";
export const maxDuration = 120;

export type AnalysisResult = {
  insights: string[];
  actionItems: string[];
  nextMeetingTopics: string[];
};

const ROUGH_CHARS_PER_TOKEN = 4;
const MAX_TOKENS = 50_000;
const MAX_CHARS = MAX_TOKENS * ROUGH_CHARS_PER_TOKEN;

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json(
      { error: "Server missing N8N_WEBHOOK_URL. See README for setup." },
      { status: 500 }
    );
  }

  let file: File;
  let meetingContext: string | undefined;
  try {
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File) || uploaded.size === 0) {
      return Response.json(
        { error: "No file was uploaded." },
        { status: 400 }
      );
    }
    file = uploaded;
    const ctx = form.get("meetingContext");
    if (typeof ctx === "string" && ctx.trim().length > 0) {
      meetingContext = ctx.trim();
    }
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await extractTranscriptFromFile(file);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read the file.";
    return Response.json({ error: message }, { status: 400 });
  }

  if (!parsed.text || parsed.text.length < 50) {
    return Response.json(
      {
        error:
          "The file appears to be empty or unreadable. If it's a scanned PDF, try a text-based version.",
      },
      { status: 400 }
    );
  }

  if (parsed.text.length > MAX_CHARS) {
    return Response.json(
      {
        error: `Transcript is too long (~${Math.round(
          parsed.text.length / ROUGH_CHARS_PER_TOKEN / 1000
        )}k tokens). The current limit is ${MAX_TOKENS / 1000}k tokens.`,
      },
      { status: 413 }
    );
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: parsed.text,
        filename: parsed.filename,
        kind: parsed.kind,
        meetingContext: meetingContext ?? null,
      }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reach n8n.";
    return Response.json(
      { error: `Could not reach the n8n workflow: ${message}` },
      { status: 502 }
    );
  }

  if (!n8nResponse.ok) {
    const body = await n8nResponse.text().catch(() => "");
    return Response.json(
      {
        error: `n8n workflow returned ${n8nResponse.status}. ${body.slice(0, 500)}`,
      },
      { status: 502 }
    );
  }

  let payload: unknown;
  try {
    payload = await n8nResponse.json();
  } catch {
    return Response.json(
      { error: "n8n workflow did not return valid JSON." },
      { status: 502 }
    );
  }

  const normalized = normalizeAnalysis(payload);
  if (!normalized) {
    return Response.json(
      {
        error:
          "n8n returned an unexpected shape. Expected { insights, actionItems, nextMeetingTopics }.",
        raw: payload,
      },
      { status: 502 }
    );
  }

  return Response.json({
    filename: parsed.filename,
    kind: parsed.kind,
    chars: parsed.text.length,
    ...normalized,
  });
}

function normalizeAnalysis(raw: unknown): AnalysisResult | null {
  const candidate = unwrap(raw);
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;

  const insights = toStringArray(obj.insights ?? obj.keyInsights ?? obj.takeaways);
  const actionItems = toStringArray(
    obj.actionItems ?? obj.action_items ?? obj.nextSteps ?? obj.actions
  );
  const nextMeetingTopics = toStringArray(
    obj.nextMeetingTopics ??
      obj.next_meeting_topics ??
      obj.topics ??
      obj.followUpTopics
  );

  if (!insights && !actionItems && !nextMeetingTopics) return null;

  return {
    insights: insights ?? [],
    actionItems: actionItems ?? [],
    nextMeetingTopics: nextMeetingTopics ?? [],
  };
}

function unwrap(raw: unknown): unknown {
  if (Array.isArray(raw) && raw.length === 1) return unwrap(raw[0]);
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("output" in obj) return unwrap(obj.output);
    if ("json" in obj) return unwrap(obj.json);
    if ("data" in obj && typeof obj.data === "object") return unwrap(obj.data);
  }
  if (typeof raw === "string") {
    try {
      return unwrap(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return raw;
}

function toStringArray(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .map((s) => s.trim())
      .filter(Boolean);
    return cleaned;
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n+/)
      .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }
  return null;
}
