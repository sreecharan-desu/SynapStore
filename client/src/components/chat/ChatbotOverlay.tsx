import { useState, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useRecoilValue } from "recoil";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { sendChatMessage } from "../../utils/hfClient";
import { authState } from "../../state/auth";

type Message = {
  role: "user" | "bot";
  content?: string; // user message text
  markdown?: string; // bot markdown response
};

interface ChatbotOverlayProps {
  open: boolean;
  onClose: () => void;
  iconButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const ChatbotOverlay = ({ open, onClose, iconButtonRef }: ChatbotOverlayProps) => {
  const auth = useRecoilValue(authState);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadId = auth.user?.id || "default";

  // Focus management
  useEffect(() => {
    if (open) {
      // Focus overlay container on open
      setTimeout(() => {
        overlayRef.current?.focus();
        inputRef.current?.focus();
      }, 100);
    } else {
      // Return focus to icon button on close
      iconButtonRef?.current?.focus();
    }
  }, [open, iconButtonRef]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent<HTMLDivElement> | globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [open, onClose]);

  // Outside click handler
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const data = await sendChatMessage(threadId, userMsg.content || "");
      let markdown = "";
      if (typeof data === "object" && data.reply_markdown) {
        markdown = data.reply_markdown;
      } else if (data.reply || data.message) {
        markdown = data.reply || data.message;
      } else {
        markdown = JSON.stringify(data);
      }
      setMessages((prev) => [...prev, { role: "bot", markdown }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", markdown: err.message || "Chat failed" },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chatbot-title"
    >
      <div
        ref={overlayRef}
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[80vh] mx-4 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 id="chatbot-title" className="text-lg font-semibold text-white">
            Assistant
          </h2>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-white/60 py-8">
              <p className="text-sm">Ask anything about your store.</p>
            </div>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white border border-white/10"
                }`}
              >
                {m.role === "bot" ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        code: ({ node, inline, ...props }: any) => (
                          <code
                            className={`${
                              inline
                                ? "bg-white/20 px-1 rounded text-pink-200"
                                : "block bg-slate-800 p-2 rounded my-2 overflow-x-auto"
                            }`}
                            {...props}
                          />
                        ),
                        a: ({ node, ...props }: any) => (
                          <a
                            className="text-blue-400 hover:text-blue-300 underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {m.markdown || m.content || ""}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span>{m.content}</span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-white/60 rounded-lg p-3 text-sm">
                Thinking…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotOverlay;

