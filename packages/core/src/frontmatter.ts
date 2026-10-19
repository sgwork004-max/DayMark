import type { Frontmatter } from "./types.js";

const YAML_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Parse YAML frontmatter from note content. Returns { frontmatter, body }. */
export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const m = YAML_BLOCK_RE.exec(content);
  if (!m) return { frontmatter: {}, body: content };

  const yaml = m[1] ?? "";
  const body = content.slice(m[0].length).replace(/^\r?\n/, "");
  const frontmatter: Frontmatter = {};

  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if (!key) continue;

    if (raw.startsWith("[") && raw.endsWith("]")) {
      // Array: [a, b, c]
      frontmatter[key] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      frontmatter[key] = raw.replace(/^["']|["']$/g, "");
    }
  }

  return { frontmatter, body };
}

/** Serialize frontmatter + body back to a full note string */
export function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return body;

  const lines = ["---"];
  for (const key of keys) {
    const val = frontmatter[key];
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.join(", ")}]`);
    } else if (val !== undefined && val !== null && val !== "") {
      lines.push(`${key}: ${String(val)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n") + body;
}

/** Check whether content has a YAML frontmatter block */
export function hasFrontmatter(content: string): boolean {
  return YAML_BLOCK_RE.test(content);
}
