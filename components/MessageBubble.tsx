type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /^###\s+(.+)$/gm,
      "<strong style=\"display:block;margin-top:10px;margin-bottom:3px;font-weight:700;font-size:0.8rem;letter-spacing:0.01em;\">$1</strong>"
    )
    .replace(
      /^\[(.+)\]$/gm,
      "<strong style=\"display:block;margin-top:12px;margin-bottom:3px;font-weight:700;font-size:0.8rem;letter-spacing:0.01em;\">$1</strong>"
    )
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>")
    .replace(/<\/strong><br>/g, "<\/strong>");
}

function formatTime(timestamp?: string) {
  if (!timestamp) {
    return null;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function MessageBubble({
  role,
  content,
  timestamp,
  suggestions = [],
  onSuggestionClick,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const visibleSuggestions = !isUser ? suggestions.filter(Boolean).slice(0, 4) : [];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={[
            "w-full rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
            isUser
              ? "rounded-br-md bg-slate-900 text-white"
              : "rounded-bl-md border border-slate-200 bg-white text-slate-700",
          ].join(" ")}
        >
          <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          {formatTime(timestamp) ? (
            <p className={`mt-2 text-[11px] ${isUser ? "text-slate-300" : "text-slate-400"}`}>{formatTime(timestamp)}</p>
          ) : null}
        </div>
        {visibleSuggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}