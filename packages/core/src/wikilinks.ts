import type { WikiLink, BacklinkEntry, Note } from "./types.js";

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Extract all [[wiki-links]] from note content */
export function extractWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    for (const m of line.matchAll(WIKILINK_RE)) {
      const link: WikiLink = {
        target: (m[1] ?? "").trim(),
        lineIndex,
        charStart: m.index ?? 0,
      };
      const alias = m[2]?.trim();
      if (alias) link.alias = alias;
      links.push(link);
    }
  }

  return links;
}

/**
 * Build a backlink index: for each note title/id, what notes link to it?
 * Returns Map<targetNoteTitle, BacklinkEntry[]>
 */
export function buildBacklinkIndex(notes: Map<string, Note>): Map<string, BacklinkEntry[]> {
  const index = new Map<string, BacklinkEntry[]>();

  for (const note of notes.values()) {
    const links = extractWikiLinks(note.content);
    for (const link of links) {
      const target = link.target.toLowerCase();
      const existing = index.get(target) ?? [];

      // Grab a short excerpt around the link
      const lines = note.content.split("\n");
      const line = lines[link.lineIndex] ?? "";
      const excerpt = line.slice(Math.max(0, link.charStart - 20), link.charStart + 80).trim();

      existing.push({
        noteId: note.id,
        noteTitle: note.title,
        excerpt,
        lineIndex: link.lineIndex,
      });

      index.set(target, existing);
    }
  }

  return index;
}

/** Resolve a wiki-link target to a note ID */
export function resolveWikiLink(target: string, notes: Map<string, Note>): string | null {
  const t = target.toLowerCase();
  for (const note of notes.values()) {
    if (note.title.toLowerCase() === t) return note.id;
    if (note.filePath.toLowerCase().includes(t)) return note.id;
  }
  return null;
}

/** Get backlinks for a specific note */
export function getBacklinks(
  noteId: string,
  noteTitle: string,
  index: Map<string, BacklinkEntry[]>,
): BacklinkEntry[] {
  return index.get(noteTitle.toLowerCase()) ?? [];
}
