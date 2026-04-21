# Transcript Analysis

Upload a meeting transcript (TXT / PDF / DOCX). Get back:

1. **Key insights** — what matters from an investor's lens
2. **Action items** — concrete next steps
3. **Topics for next meeting** — threads to pick up

Built for personal use analyzing calls with founders, operators, and other investors.

---

## How it works

```
 Browser (you upload file)
        │
        ▼
 Next.js app (extracts text from PDF/DOCX, sends plain text to n8n)
        │
        ▼
 n8n workflow: Webhook → AI Agent (Claude) → Respond
        │
        ▼
 Browser displays 3 result cards
```

You run two things: the **n8n workflow** (handles the AI) and the **Next.js app** (the UI). Set up n8n first, then the web app.

---

## Part A — Set up the n8n workflow

You need an n8n instance and an Anthropic API key.

### 1. Get an n8n instance

Either:
- **n8n Cloud** (easiest) — sign up at [n8n.io](https://n8n.io/cloud/) and you get a hosted instance.
- **Self-hosted** — follow [n8n's docker instructions](https://docs.n8n.io/hosting/installation/docker/). Make sure the "LangChain / AI" nodes are enabled (they are by default in recent versions).

### 2. Get an Anthropic API key

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Go to **API Keys** → **Create Key**. Copy it.

### 3. Import the workflow into n8n

1. In n8n, click **Workflows** → **+ Add workflow** → **⋯** menu → **Import from file**.
2. Select `n8n/workflow.json` from this project.
3. The workflow "Transcript Analysis" appears with 5 nodes (Webhook → AI Agent → Respond, plus Anthropic model and output parser attached to the Agent).

### 4. Connect your Anthropic key in n8n

1. Click the **Anthropic Chat Model** node.
2. Under **Credential to connect with**, click **Create New Credential**.
3. Paste your Anthropic API key. Save.
4. In the same node, confirm the model. The default `claude-sonnet-4-5-20250929` works; if you want the newest, pick `claude-sonnet-4-6` from the dropdown (or type it manually).

### 5. Activate the workflow and copy the Production URL

1. Click the **Webhook** node.
2. Copy the **Production URL** (looks like `https://your-n8n.app/webhook/analyze-transcript`). Save this — you need it in the next part.
3. Toggle **Active** (top-right of the workflow editor) to ON. The production webhook only works when the workflow is active.

---

## Part B — Run the web app

### 1. Install Node.js (one-time)

Download the LTS installer from [nodejs.org](https://nodejs.org/) and run it. Restart your terminal after.

### 2. Open a terminal in the `web/` folder

On Windows, open PowerShell and run:

```powershell
cd "C:\Users\elija\OneDrive\Desktop\Transcript Analysis\web"
```

### 3. Create the `.env.local` file

Copy `.env.local.example` to `.env.local`, then open it and paste your n8n Production URL:

```
N8N_WEBHOOK_URL=https://your-n8n.app/webhook/analyze-transcript
```

Save and close.

### 4. Start the app

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using it

1. Drag a transcript onto the page (or click to browse). TXT, PDF, and DOCX work.
2. Optional: type a line of context — e.g. "Intro call with Series A fintech founder" — to sharpen the analysis.
3. Click **Analyze transcript**. Takes 20–60 seconds for most calls.
4. Three result cards appear. Click **Analyze another** to start over.

---

## Limits (v1)

- **Transcript size**: up to ~50k tokens (roughly a 3-hour call). Larger files are rejected with a clear error.
- **Scanned PDFs**: won't work — the PDF must have selectable text. If you only have scans, use a separate OCR tool first (e.g. Adobe Acrobat's "Recognize Text").
- **No history**: nothing is saved. Each analysis is standalone.

---

## Troubleshooting

**"Server missing N8N_WEBHOOK_URL"** — `.env.local` isn't set, or the dev server was already running when you created it. Stop (`Ctrl+C`) and re-run `npm run dev`.

**"Could not reach the n8n workflow"** — the webhook URL is wrong, or the workflow isn't Active in n8n. Double-check both.

**"n8n workflow returned 404"** — the workflow is inactive, or you copied the **Test URL** instead of the **Production URL**. Test URLs only work while you're staring at the workflow with "Listen for test event" clicked.

**"n8n returned an unexpected shape"** — the AI output couldn't be parsed. Open the workflow's last execution in n8n to see what came back. Usually fixable by rerunning.

**The file appears to be empty or unreadable** — the PDF has no extractable text (it's a scan). OCR it first.

---

## Project layout

```
Transcript Analysis/
├── README.md            ← you're reading it
├── n8n/
│   └── workflow.json    ← import this into n8n
└── web/                 ← the Next.js app
    ├── app/
    │   ├── page.tsx     ← upload UI and results display
    │   ├── layout.tsx
    │   └── api/analyze/route.ts  ← parses file, calls n8n
    ├── lib/parse.ts     ← PDF/DOCX/TXT text extraction
    ├── .env.local       ← your n8n URL (you create this)
    └── package.json
```
