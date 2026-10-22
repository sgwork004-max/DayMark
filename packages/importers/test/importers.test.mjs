import test from "node:test";
import assert from "node:assert/strict";
import { convertCraftNote, convertObsidianNote } from "../dist/index.js";

test("keeps Obsidian frontmatter first and does not duplicate the title", () => {
  const note = convertObsidianNote("---\ntags: [demo]\n---\n# Imported idea\n\nSee #demo\n", "Imported idea");
  assert.equal(note, "---\ntags: [demo]\n---\n# Imported idea\n\nSee #demo\n");
});

test("adds a missing title after Obsidian frontmatter", () => {
  const note = convertObsidianNote("---\ntags: [x]\n---\nNo heading here\n", "Fresh");
  assert.equal(note, "---\ntags: [x]\n---\n# Fresh\n\nNo heading here\n");
});

test("does not mistake a leading tag for a title", () => {
  assert.equal(convertObsidianNote("#tag first line\n", "Tagged"), "# Tagged\n\n#tag first line\n");
  assert.equal(convertCraftNote("#tag first\n", "Craft"), "# Craft\n\n#tag first\n");
});
