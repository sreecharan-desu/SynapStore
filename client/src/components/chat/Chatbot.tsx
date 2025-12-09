import { useState } from "react";
import { sendChatMessage } from "../../utils/hfClient";
import { useAuthContext } from "../../auth/AuthContext";

type Message = { role: "user" | "bot"; content: string };

const Chatbot = () => {
  const { isAuthenticated } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const thread_id = "default";

  if (!isAuthenticated) return null;

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const resp = await sendChatMessage(thread_id, userMsg.content);
      const reply = resp?.reply ?? JSON.stringify(resp);
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: err.message || "Chat failed" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-brand-border bg-white/80 backdrop-blur space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-text">Assistant</h2>
        {loading && <span className="text-xs text-brand-text-muted">Thinking…</span>}
      </div>
      <div className="h-64 overflow-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-brand-text-muted">Ask anything about your store.</p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-lg text-sm ${m.role === "user"
                ? "bg-brand-primary/20 text-brand-text border border-brand-primary/30"
                : "bg-white/10 text-brand-text border border-brand-border"
              }`}
          >
            <span className="font-semibold mr-1">{m.role === "user" ? "You" : "Bot"}:</span>
            {m.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-brand-border text-brand-text placeholder:text-brand-text-muted focus:outline-none"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;

