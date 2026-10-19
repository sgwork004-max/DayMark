/** Parse an Evernote .enex XML export and convert notes to markdown. */

export interface EvernoteNote {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

/** Very lightweight XML tag extractor — no DOM dependency */
function extractTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return m?.[1]?.trim() ?? "";
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) results.push(m[1].trim());
  }
  return results;
}

/** Convert Evernote's ENML (subset of HTML) to markdown */
function enmlToMarkdown(enml: string): string {
  let md = enml;

  // Strip XML declaration and en-note wrapper
  md = md.replace(/<\?xml[^>]*>/gi, "");
  md = md.replace(/<en-note[^>]*>/gi, "").replace(/<\/en-note>/gi, "");

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");

  // Bold / italic
  md = md.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/(b|strong)>/gi, "**$2**");
  md = md.replace(/<(i|em)[^>]*>([\s\S]*?)<\/(i|em)>/gi, "_$2_");

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/(ul|ol)>/gi, "\n");
  md = md.replace(/<(ul|ol)[^>]*>/gi, "");

  // Evernote checkboxes
  md = md.replace(/<en-todo checked="true"\s*\/>/gi, "- [x] ");
  md = md.replace(/<en-todo[^>]*\/>/gi, "- [ ] ");

  // Line breaks / divs
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "$1\n");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse excessive blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim() + "\n";
}

/** Parse a complete .enex XML string, return array of converted notes */
export function parseEnex(enexXml: string): EvernoteNote[] {
  const noteBlocks = extractAll(enexXml, "note");

  return noteBlocks.map((block) => {
    const title   = extractTag(block, "title") || "Untitled";
    const created = extractTag(block, "created") || "";
    const updated = extractTag(block, "updated") || created;
    const tags    = extractAll(block, "tag");
    const content = extractTag(block, "content");
    const md      = content ? enmlToMarkdown(content) : "";

    const tagLine = tags.length > 0 ? `\n${tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}\n` : "";

    const fullContent = `# ${title}\n${tagLine}\n${md}`;

    return {
      title,
      content: fullContent,
      createdAt: created,
      updatedAt: updated,
      tags,
    };
  });
}

/** Convert an Evernote creation timestamp "20230614T120000Z" to ISO "2023-06-14" */
export function enexDateToISO(enexDate: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(enexDate);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}
