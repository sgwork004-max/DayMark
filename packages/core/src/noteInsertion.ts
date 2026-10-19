export function insertAIResponseUnderNotes(content: string, response: string, prompt: string): string {
  const context = prompt.replace(/\s+/g, " ").trim().slice(0, 90) || "AI response";
  const block = `### Gemini: ${context}\n\n${response.trim()}`;
  const lines = content.split("\n");
  const notesIndex = lines.findIndex((line) => line.trim().toLowerCase() === "## notes");
  if (notesIndex === -1) return `${content.trimEnd()}\n\n## Notes\n\n${block}\n`;
  lines.splice(notesIndex + 1, 0, "", block, "");
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}
