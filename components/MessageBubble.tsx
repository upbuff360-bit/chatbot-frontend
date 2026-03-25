type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

function formatTime(timestamp?: string) {
  if (!timestamp) {
    return null;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "rounded-br-md bg-slate-900 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-700",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {formatTime(timestamp) ? (
          <p className={`mt-2 text-[11px] ${isUser ? "text-slate-300" : "text-slate-400"}`}>{formatTime(timestamp)}</p>
        ) : null}
      </div>
    </div>
  );
}
