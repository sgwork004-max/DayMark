/** Convert Craft exported markdown to Manager format.
 *
 * Craft exports markdown with:
 * - `* item` for bullets (already markdown)
 * - `- [ ] task` for tasks (already compatible)
 * - Craft block IDs like `<!-- {"blockID":"…"} -->` → remove
 * - Double-bracket links already present
 */
export function convertCraftNote(content: string, title: string): string {
  let out = content;

  // Remove Craft block ID comments
  out = out.replace(/<!--\s*\{[^}]*\}\s*-->/g, "");

  // Craft uses * for bullets — convert to - for consistency
  out = out.replace(/^\* /gm, "- ");

  // Remove Craft's metadata section if present at top (--- block with craftType)
  if (out.startsWith("---")) {
    const endFm = out.indexOf("---", 3);
    if (endFm > 0) {
      const fm = out.slice(0, endFm + 3);
      if (fm.includes("craftType")) {
        out = out.slice(endFm + 3).trimStart();
      }
    }
  }

  // Add title as H1 if missing
  if (!out.trimStart().startsWith("#")) {
    out = `# ${title}\n\n${out}`;
  }

  return out.trim() + "\n";
}
