import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useNotesStore } from "../store/notesStore.js";
import { showAppNotice } from "../appNotice.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { label: "Summarize",      prompt: "Summarize this note in 3-5 bullet points." },
  { label: "Extract Tasks",  prompt: "List all action items and tasks mentioned in this note, formatted as a markdown task list." },
  { label: "Continue",       prompt: "Continue writing from where this note left off, matching the tone and style." },
  { label: "Improve",        prompt: "Suggest specific improvements to make this note clearer, more structured, and more useful." },
  { label: "Key Questions",  prompt: "What are the 3 most important questions this note raises or leaves unanswered?" },
];

export function AIPanel({ onClose }: { onClose: () => void }) {
  const { settings, activeNoteId, notes } = useNotesStore();
  const note = activeNoteId ? notes.get(activeNoteId) : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function buildSystemPrompt(): string {
    const noteContext = note
      ? `Current note: "${note.title}"\n\nContent:\n${note.content.slice(0, 4000)}`
      : "No note is currently open.";

    return `You are an AI writing assistant integrated into Manager, a markdown note-taking and task management app.

${noteContext}

You help the user write better notes, extract insights, create tasks, and think through ideas.
- Respond concisely and use markdown formatting
- When generating tasks, use Manager syntax: \`- [ ] task text\`
- When referencing other notes, use wiki-link syntax: \`[[Note Title]]\`
- Keep responses focused and actionable`;
  }

  async function send(userText: string) {
    if (!userText.trim() || streaming) return;
    setError(null);
    const userMsg: Message = { role: "user", content: userText };
    const updatedHistory = [...messages, userMsg];
    setMessages([...updatedHistory, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const history = updatedHistory
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const result = await invoke<{ text: string }>("gemini_generate", {
        systemInstruction: buildSystemPrompt(),
        input: history,
      });

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: result.text.trim() };
        return next;
      });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Request failed");
      setMessages((prev) => prev.slice(0, -1)); // remove empty assistant msg
    } finally {
      setStreaming(false);
    }
  }

  function applyResponse(index: number) {
    if (!note || !activeNoteId) return;
    const response = messages[index];
    if (!response || response.role !== "assistant" || !response.content) return;
    const prompt = [...messages.slice(0, index)].reverse().find((message) => message.role === "user")?.content ?? "AI response";
    document.dispatchEvent(new CustomEvent("daymark:insert-ai-response", {
      detail: { response: response.content, prompt },
    }));
    showAppNotice("AI response added under Notes.");
  }

  return (
    <aside className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-panel-icon"><Sparkles size={15} strokeWidth={1.75} /></span>
          AI Assistant
        </div>
        <button className="panel-close" onClick={onClose}><X size={15} strokeWidth={2} /></button>
      </div>

      {/* Quick action chips */}
      <div className="ai-quick-actions">
        {QUICK_ACTIONS.map(({ label, prompt }) => (
          <button
            key={label}
            className="ai-quick-btn"
            onClick={() => send(prompt)}
            disabled={streaming || !settings.geminiApiKey}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chat history */}
      <div className="ai-messages">
        {messages.length === 0 && !error && (
          <div className="ai-empty">
            <div className="ai-empty-icon"><Sparkles size={36} strokeWidth={1.25} /></div>
            <p>Ask anything about your note, or use a quick action above.</p>
            {!settings.geminiApiKey && (
              <p className="ai-empty-warn">Add a Gemini API key in Settings (⌘,) to get started.</p>
            )}
          </div>
        )}

        {error && <div className="ai-error">{error}</div>}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
            <div className="ai-msg-label">{msg.role === "user" ? "You" : "Assistant"}</div>
            <div
              className="ai-msg-content"
              // Safe: content is from Gemini API or the user themselves.
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
            {msg.role === "assistant" && msg.content && !streaming && (
              <button className="ai-msg-insert" onClick={() => applyResponse(i)} title="Insert under Notes">
                ↳ Insert into note
              </button>
            )}
          </div>
        ))}

        {streaming && <div className="ai-working">Thinking…</div>}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ai-input-area">
        <textarea
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about this note…"
          rows={3}
          disabled={streaming}
        />
        <button
          className={`ai-send-btn ${streaming ? "streaming" : ""}`}
          onClick={() => send(input)}
          disabled={streaming || !input.trim() || !settings.geminiApiKey}
        >
          {streaming ? "…" : "↑"}
        </button>
      </div>
    </aside>
  );
}

/** Minimal safe markdown → HTML: bold, italic, inline code, code blocks, lists */
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- \[ \] (.+)$/gm, '<span class="ai-task">○ $1</span>')
    .replace(/^- \[x\] (.+)$/gm, '<span class="ai-task done">✓ $1</span>')
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n/g, "<br>");
}
