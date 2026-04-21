"use client";

import { useCallback, useRef, useState } from "react";

type AnalysisResponse = {
  filename: string;
  kind: string;
  chars: number;
  insights: string[];
  actionItems: string[];
  nextMeetingTopics: string[];
};

const ACCEPTED =
  ".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [meetingContext, setMeetingContext] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  const onSubmit = useCallback(async () => {
    if (!file) return;
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (meetingContext.trim()) form.append("meetingContext", meetingContext.trim());
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setStatus("error");
    }
  }, [file, meetingContext]);

  const reset = () => {
    setFile(null);
    setMeetingContext("");
    setResult(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Transcript Analysis</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Upload a meeting transcript (.txt, .pdf, or .docx). Get insights, action items, and
          topics to track for the next conversation.
        </p>
      </header>

      {status !== "done" && (
        <section className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {(file.size / 1024).toFixed(1)} KB · click to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop a transcript here, or click to browse</p>
                <p className="mt-1 text-xs text-neutral-500">.txt · .pdf · .docx</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ctx" className="block text-sm font-medium">
              Meeting context <span className="text-neutral-400">(optional)</span>
            </label>
            <p className="mt-1 text-xs text-neutral-500">
              Who was on the call and what was it about? Helps tailor the analysis.
            </p>
            <textarea
              id="ctx"
              value={meetingContext}
              onChange={(e) => setMeetingContext(e.target.value)}
              rows={3}
              placeholder="e.g. Intro call with Series A founder in fintech, investor-side diligence"
              className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!file || status === "loading"}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {status === "loading" ? "Analyzing…" : "Analyze transcript"}
            </button>
            {file && status !== "loading" && (
              <button
                type="button"
                onClick={reset}
                className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Clear
              </button>
            )}
          </div>

          {status === "error" && error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {status === "loading" && (
            <p className="text-sm text-neutral-500">
              This can take 20–60 seconds for longer transcripts…
            </p>
          )}
        </section>
      )}

      {status === "done" && result && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Analysis of</p>
              <p className="font-medium">{result.filename}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Analyze another
            </button>
          </div>

          <ResultCard title="Key insights" items={result.insights} accent="blue" />
          <ResultCard title="Action items" items={result.actionItems} accent="green" />
          <ResultCard
            title="Topics for next meeting"
            items={result.nextMeetingTopics}
            accent="amber"
          />
        </section>
      )}
    </main>
  );
}

function ResultCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "blue" | "green" | "amber";
}) {
  const accentMap = {
    blue: "border-blue-200 dark:border-blue-900",
    green: "border-green-200 dark:border-green-900",
    amber: "border-amber-200 dark:border-amber-900",
  } as const;

  return (
    <div className={`rounded-2xl border ${accentMap[accent]} p-6`}>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">None identified.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
