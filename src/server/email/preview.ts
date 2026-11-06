import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Email } from "./send";

/** Save a preview outside the public directory without sending or opening it. */
export async function previewEmail({ subject, html, text }: Email) {
  const directory = join(process.cwd(), "emails-preview");
  await mkdir(directory, { recursive: true, mode: 0o755 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const previewPath = join(
    directory,
    `email-preview-${timestamp}-${randomUUID()}.html`,
  );
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  await writeFile(
    previewPath,
    html ??
      `<!doctype html><html><head><meta charset="utf-8"><title>${escape(subject)}</title></head><body><pre style="white-space:pre-wrap">${escape(text ?? "")}</pre></body></html>`,
    { mode: 0o644 },
  );

  console.info(`[email preview] ${subject}: ${previewPath}`);

  return { previewPath };
}
