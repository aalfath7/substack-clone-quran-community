// Render JSON Tiptap -> HTML secara aman (whitelist node & mark, semua teks di-escape).
// Dipakai di server saat menerbitkan, dan oleh email. Tidak butuh DOM, jadi jalan di Workers.

export type TiptapMark = { type: string; attrs?: Record<string, unknown> };
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

const MAX_DEPTH = 20;

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Hanya izinkan http(s), mailto, dan path internal. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:") return u.toString();
  } catch {}
  return null;
}

function renderMarks(text: string, marks: TiptapMark[] = []) {
  let out = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        out = `<strong>${out}</strong>`;
        break;
      case "italic":
        out = `<em>${out}</em>`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
      case "strike":
        out = `<s>${out}</s>`;
        break;
      case "code":
        out = `<code>${out}</code>`;
        break;
      case "link": {
        const href = safeUrl(mark.attrs?.href);
        if (href) {
          const external = !href.startsWith("/");
          out = `<a href="${escapeHtml(href)}"${external ? ' rel="noopener noreferrer nofollow ugc" target="_blank"' : ""}>${out}</a>`;
        }
        break;
      }
    }
  }
  return out;
}

function renderChildren(node: TiptapNode, depth: number) {
  return (node.content ?? []).map((c) => renderNode(c, depth + 1)).join("");
}

function renderNode(node: TiptapNode, depth = 0): string {
  if (depth > MAX_DEPTH) return "";
  const inner = () => renderChildren(node, depth);
  switch (node.type) {
    case "doc":
      return inner();
    case "text":
      return renderMarks(node.text ?? "", node.marks);
    case "paragraph":
      return `<p dir="auto">${inner()}</p>`;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2; // H1 dipakai judul tulisan
      return `<h${level} dir="auto">${inner()}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${inner()}</ul>`;
    case "orderedList":
      return `<ol>${inner()}</ol>`;
    case "listItem":
      return `<li dir="auto">${inner()}</li>`;
    case "blockquote":
      return `<blockquote dir="auto">${inner()}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml((node.content ?? []).map((c) => c.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";
    case "image": {
      const src = safeUrl(node.attrs?.src);
      if (!src) return "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"></figure>`;
    }
    default:
      // Node tak dikenal: render isinya saja (tanpa tag).
      return inner();
  }
}

export function renderContentHtml(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  return renderNode(doc as TiptapNode);
}

/** Teks polos dari dokumen (untuk ringkasan & email teks). */
export function contentToText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (n: TiptapNode, depth: number) => {
    if (depth > MAX_DEPTH) return;
    if (n.type === "text" && n.text) parts.push(n.text);
    if (n.type === "hardBreak") parts.push("\n");
    for (const c of n.content ?? []) walk(c, depth + 1);
    if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(n.type)) parts.push("\n\n");
  };
  if (doc && typeof doc === "object") walk(doc as TiptapNode, 0);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function makeExcerpt(doc: unknown, max = 220) {
  const text = contentToText(doc).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** Perkiraan waktu baca (menit), 200 kata/menit. */
export function readingMinutes(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
