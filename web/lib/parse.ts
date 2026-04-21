import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export type ParsedTranscript = {
  text: string;
  filename: string;
  kind: "txt" | "pdf" | "docx";
};

export async function extractTranscriptFromFile(file: File): Promise<ParsedTranscript> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: text.trim(), filename: file.name, kind: "pdf" };
  }

  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { text: value.trim(), filename: file.name, kind: "docx" };
  }

  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return { text: buffer.toString("utf-8").trim(), filename: file.name, kind: "txt" };
  }

  throw new Error(
    `Unsupported file type: ${file.name}. Upload a .txt, .pdf, or .docx file.`
  );
}
