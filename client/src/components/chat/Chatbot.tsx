import { useState } from "react";
import { sendChatMessage } from "../../utils/hfClient";
import { useAuthContext } from "../../auth/AuthContext";

type Message = { role: "user" | "bot"; content: string };

const Chatbot = () => {
  const { isAuthenticated } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadId = "default";

  if (!isAuthenticated) return null;

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const resp = await sendChatMessage(threadId, userMsg.content);
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
    <div className="p-4 rounded-2xl border border-white/15 bg-white/5 backdrop-blur space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Assistant</h2>
        {loading && <span className="text-xs text-white/60">Thinking…</span>}
      </div>
      <div className="h-64 overflow-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-white/60">Ask anything about your store.</p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-lg text-sm ${
              m.role === "user"
                ? "bg-blue-500/20 text-white border border-blue-400/30"
                : "bg-white/10 text-white border border-white/10"
            }`}
          >
            <span className="font-semibold mr-1">{m.role === "user" ? "You" : "Bot"}:</span>
            {m.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none"
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
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;

