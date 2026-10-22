/** Convert an Obsidian markdown note to Manager format.
 *
 * Differences handled:
 * - Obsidian embed `![[note]]` → `[[note]]`
 * - Obsidian tags `#tag/subtag` → `#tag-subtag`
 * - Obsidian `%%comment%%` → removed
 * - Obsidian callouts `> [!NOTE]` → `> **Note:**`
 * - Obsidian dataview ```` ```dataview ```` → removed block
 * - Task format is identical
 * - WikiLinks are identical
 */
export function convertObsidianNote(content: string, title: string): string {
  let out = content;

  // Remove dataview code blocks
  out = out.replace(/```dataview[\s\S]*?```/g, "");

  // Remove Obsidian comments %%...%%
  out = out.replace(/%%[\s\S]*?%%/g, "");

  // Convert embeds ![[x]] → [[x]]
  out = out.replace(/!\[\[([^\]]+)\]\]/g, "[[$1]]");

  // Convert callouts > [!TYPE] Title → > **Type:** Title
  out = out.replace(/^> \[!(\w+)\]\s*(.*)/gm, (_, type, title) =>
    `> **${type.charAt(0) + type.slice(1).toLowerCase()}:** ${title}`.trim()
  );

  // Flatten nested tags: #parent/child → #parent-child
  out = out.replace(/#([\w/]+)/g, (_, tag: string) =>
    "#" + tag.replace(/\//g, "-")
  );

  // Add title as H1 if missing, keeping YAML frontmatter at the top.
  const frontmatter = /^---\n[\s\S]*?\n---\n?/.exec(out.trimStart())?.[0] ?? "";
  const body = out.trimStart().slice(frontmatter.length).trimStart();
  if (!/^# /.test(body)) {
    out = `${frontmatter}# ${title}\n\n${body}`;
  } else {
    out = `${frontmatter}${body}`;
  }

  return out.trim() + "\n";
}

export interface ObsidianImportResult {
  title: string;
  filename: string;
  content: string;
  folder: string;
}

/** Parse a list of {filename, content} file entries (from the vault folder) */
export function importObsidianVault(
  files: { filename: string; content: string; folder: string }[]
): ObsidianImportResult[] {
  return files
    .filter((f) => f.filename.endsWith(".md"))
    .map((f) => {
      const title = f.filename.replace(/\.md$/, "");
      return {
        title,
        filename: f.filename,
        folder: f.folder,
        content: convertObsidianNote(f.content, title),
      };
    });
}
