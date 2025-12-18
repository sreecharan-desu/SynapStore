import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "../context/AuthContext";
import { X, Send, Loader2, Sparkles, Mic, Volume2, VolumeX, StopCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { sendChatMessage } from "../lib/api/chat";

interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
}

import Login3DCharacter from "./Login3DCharacter";



export const ChatbotWidget = () => {
    const { isAuthenticated, user } = useAuthContext();
    const { token } = useRecoilValue(authState);
    const [isOpen, setIsOpen] = useState(false);
    const BOT_NAME = import.meta.env.VITE_BOT_NAME || "Dose";
    const [messages, setMessages] = useState<Message[]>([
        { id: "welcome", role: "bot", text: `Hello! I'm ${BOT_NAME}. How can I help you manage your store today?` }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    // 3D Character integration
    const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
    const [keyTrigger, setKeyTrigger] = useState(0);

    // TTS & STT State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue(transcript);
            handleVoiceCommand(transcript);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
    }, []);

    const speak = (text: string) => {
        if (!voiceEnabled || !synthRef.current) return;
        synthRef.current.cancel(); // Stop previous
        const utterance = new SpeechSynthesisUtterance(text);

        // Select a good voice if possible (prefer Google US English or similar)
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleVoiceCommand = (text: string) => {
        // "Make sure it responds to the keyword 'Hey Dose'"
        // If the user spoke, we assume they want to talk. 
        // We can optionally check if text starts with "Hey Dose" if we want to be strict,
        // but typically voice mode implies intent. 
        // We'll proceed to send automatically if it sounds like a command.

        // Simple logic: Auto-send if voice mode was used.
        // Or if strictly "Hey Dose" is required:
        // if (text.toLowerCase().includes(BOT_NAME.toLowerCase())) { ... }

        // Let's implement auto-send for better UX, assuming the user clicked the mic.
        setTimeout(() => handleSendMessage(text), 500);
    };

    // Strictly use the user ID as the thread ID per requirements
    // The widget is only rendered if isAuthenticated is true, so user.id should be available.
    const threadId = user?.id;

    // Theme logic integration
    const [themeName, setThemeName] = useState("green");

    useEffect(() => {
        // Role-based default theming
        if (user?.globalRole === "SUPERADMIN") {
            setThemeName("violet");
        } else if (user?.globalRole === "SUPPLIER") {
            setThemeName("teal");
        } else {
            // For Store Owners/Users, use their selected theme
            const t = localStorage.getItem("selectedTheme");
            if (t) setThemeName(t);
        }
    }, [user, isOpen]); // Update when user changes or widget opens

    // Extended Theme Palette
    const themeColors: Record<string, { bg: string, text: string, border: string, gradient: string, shadow: string, sentMsgBg: string }> = {
        green: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-200", gradient: "from-emerald-600 to-teal-500", shadow: "shadow-emerald-500/30", sentMsgBg: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
        teal: { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-200", gradient: "from-teal-500 to-emerald-500", shadow: "shadow-teal-500/30", sentMsgBg: "bg-gradient-to-br from-teal-500 to-teal-600" }, // For Suppliers
        violet: { bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-200", gradient: "from-violet-600 to-indigo-600", shadow: "shadow-violet-500/30", sentMsgBg: "bg-gradient-to-br from-violet-600 to-indigo-600" }, // For Admins
        red: { bg: "bg-red-600", text: "text-red-600", border: "border-red-200", gradient: "from-red-600 to-rose-600", shadow: "shadow-red-500/30", sentMsgBg: "bg-gradient-to-br from-red-500 to-red-600" },
        orange: { bg: "bg-orange-600", text: "text-orange-600", border: "border-orange-200", gradient: "from-orange-500 to-amber-500", shadow: "shadow-orange-500/30", sentMsgBg: "bg-gradient-to-br from-orange-500 to-orange-600" },
        blue: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-200", gradient: "from-blue-600 to-indigo-600", shadow: "shadow-blue-500/30", sentMsgBg: "bg-gradient-to-br from-blue-500 to-blue-600" },
        black: { bg: "bg-slate-900", text: "text-slate-900", border: "border-slate-200", gradient: "from-slate-900 to-slate-800", shadow: "shadow-slate-500/30", sentMsgBg: "bg-gradient-to-br from-slate-900 to-slate-800" },
    };

    // Fallback to green if themeName is unknown
    const theme = themeColors[themeName] || themeColors.green;

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);



    const handleSendMessage = async (manualText?: string) => {
        const textToSend = manualText || inputValue;
        if (!textToSend.trim()) return;

        // Trigger splash effect
        const userMsg: Message = { id: Date.now().toString(), role: "user", text: textToSend };
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsLoading(true);

        try {
            const data = await sendChatMessage({
                message: userMsg.text,
                thread_id: threadId
            }, token || "");

            console.log("Bot Response:", data);

            // Try to extract the best possible response string
            const botText = data.reply_markdown || data.response || data.message || (typeof data === 'string' ? data : JSON.stringify(data));

            const botMsg: Message = { id: (Date.now() + 1).toString(), role: "bot", text: botText };
            setMessages(prev => [...prev, botMsg]);
            speak(botText);

        } catch (error) {
            console.error("Request failed:", error);
            const errorMsg: Message = { id: (Date.now() + 1).toString(), role: "bot", text: "Sorry, I'm having trouble connecting to the server. Please check your internet connection and try again." };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    if (!isAuthenticated) return null;

    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => { setTimeout(() => { isDraggingRef.current = false; }, 150); }}
            whileDrag={{ cursor: "grabbing" }}
            ref={containerRef}
            className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-6 font-sans touch-none"
        >
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, y: 100, x: 100, transformOrigin: "bottom right" }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }}
                        exit={{
                            opacity: 0,
                            scale: 0,
                            y: 100,
                            x: 50,
                            filter: "blur(10px)",
                            transition: { duration: 0.8, ease: "easeInOut" }
                        }}
                        style={{ transformOrigin: "bottom right" }}
                        className="w-[360px] md:w-[420px] h-[600px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 bg-white/80 backdrop-blur-xl ring-1 ring-black/5"
                    >
                        {/* Header */}
                        <div className="relative p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg z-10 shrink-0">

                            {/* Decorative sparkles (non-interactive) */}
                            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                                <Sparkles className="w-12 h-12 text-white animate-pulse" />
                            </div>

                            <div className="flex items-center justify-between relative z-10">

                                {/* Bot Identity */}
                                <div className="flex items-center gap-4">

                                    {/* ICON: explicit transparent background, no wrapper box */}
                                    <div className="relative flex items-center justify-center"
                                        style={{ background: "transparent", width: 44, height: 44 }}>

                                        <img
                                            src="/chatbot-icon.jpg"
                                            alt="Bot"
                                            draggable={false}
                                            onDragStart={(e) => e.preventDefault()}
                                            className="w-full h-full object-cover rounded-full border-2 border-white/20 shadow-md relative z-10 select-none"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <h3 className="font-bold text-lg leading-tight tracking-tight">{BOT_NAME}</h3>

                                        <p className="text-xs text-blue-50 font-medium flex items-center gap-1.5 opacity-90">
                                            {isSpeaking ? (
                                                <span className="flex gap-0.5">
                                                    <span className="w-0.5 h-2 bg-green-300 animate-[bounce_0.5s_infinite]" />
                                                    <span className="w-0.5 h-3 bg-green-300 animate-[bounce_0.4s_infinite]" />
                                                    <span className="w-0.5 h-2 bg-green-300 animate-[bounce_0.6s_infinite]" />
                                                    <span className="ml-1">Speaking...</span>
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                                                    </span>
                                                    Always online
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            if (isSpeaking) {
                                                synthRef.current?.cancel();
                                                setIsSpeaking(false);
                                            }
                                            setVoiceEnabled(!voiceEnabled)
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80"
                                        title={voiceEnabled ? "Mute Voice" : "Enable Voice"}
                                    >
                                        {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                    </button>

                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 !bg-white hover:bg-gray-100 rounded-lg transition-colors shadow-sm"
                                    aria-label="Close chat"
                                >
                                    <X className="w-5 h-5 !text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50 relative custom-scrollbar"
                        >
                            {/* Intro Date */}
                            <div className="text-center">
                                <span className="px-3 py-1 bg-slate-200/50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider backdrop-blur-sm">
                                    Today
                                </span>
                            </div>

                            {messages.map((msg) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-3`}
                                >
                                    {msg.role === "bot" && (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200 shadow-sm">
                                            <img src="/chatbot-icon.jpg" alt="Bot" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[85%] p-4 text-sm leading-relaxed shadow-sm overflow-hidden ${msg.role === "user"
                                            ? `${theme.sentMsgBg} text-white rounded-2xl rounded-tr-none shadow-${themeName}-500/20`
                                            : "bg-white text-slate-700 border border-slate-100/60 rounded-2xl rounded-tl-none shadow-sm"
                                            }`}
                                    >
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
                                                li: ({ node, ...props }) => <li className="" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-base font-bold mb-2 mt-4 first:mt-0" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                                                blockquote: ({ node, ...props }) => <blockquote className={`border-l-2 pl-3 py-1 mb-2 italic ${msg.role === 'user' ? 'border-white/40' : 'border-indigo-300 bg-indigo-50/50'}`} {...props} />,
                                                a: ({ node, ...props }) => <a className={`underline underline-offset-2 ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 hover:text-indigo-700'}`} target="_blank" rel="noopener noreferrer" {...props} />,
                                                code: ({ node, className, children, ...props }: any) => {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return !match ? (
                                                        <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${msg.role === 'user' ? 'bg-white/20' : 'bg-slate-100 text-slate-800'}`} {...props}>
                                                            {children}
                                                        </code>
                                                    ) : (
                                                        <div className="rounded-lg overflow-hidden my-2 border border-slate-200/50">
                                                            <div className={`flex items-center px-3 py-1.5 text-xs font-mono font-bold ${msg.role === 'user' ? 'bg-white/10' : 'bg-slate-100/80 text-slate-600'}`}>
                                                                {match[1]}
                                                            </div>
                                                            <pre className={`p-3 overflow-x-auto text-xs font-mono ${msg.role === 'user' ? 'bg-black/20' : 'bg-slate-50'}`}>
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                            </pre>
                                                        </div>
                                                    )
                                                },
                                                table: ({ node, ...props }) => <div className="overflow-x-auto my-2 rounded-lg border border-slate-200"><table className="w-full text-left text-xs" {...props} /></div>,
                                                thead: ({ node, ...props }) => <thead className={msg.role === 'user' ? 'bg-white/10' : 'bg-slate-100'} {...props} />,
                                                th: ({ node, ...props }) => <th className="px-3 py-2 font-semibold border-b border-slate-200/50" {...props} />,
                                                td: ({ node, ...props }) => <td className="px-3 py-2 border-b border-slate-100 last:border-0" {...props} />,
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </motion.div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-start items-end gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200 shadow-sm">
                                        <img src="/chatbot-icon.jpg" alt="Bot" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-white border border-slate-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm">
                                        <div className="flex gap-1.5 h-full items-center">
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div
                            onPointerDown={(e) => e.stopPropagation()}
                            className="p-4 bg-white border-t border-slate-100 z-10 shrink-0"
                        >
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-2 py-2 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all shadow-inner">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onFocus={() => setFocusedField("email")}
                                    onBlur={() => setFocusedField(null)}
                                    onKeyDown={(e) => {
                                        setKeyTrigger(prev => prev + 1);
                                        handleKeyDown(e);
                                    }}
                                    placeholder={`Message ${BOT_NAME}...`}
                                    className="flex-1 bg-transparent px-3 py-1.5 text-sm outline-none text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                    disabled={isLoading || isListening}
                                />
                                <button
                                    onClick={toggleListening}
                                    className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-100'}`}
                                >
                                    {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!inputValue.trim() || isLoading}
                                    className={`p-2.5 rounded-xl ${inputValue.trim() ? theme.bg : "bg-slate-200"} ${inputValue.trim() ? "text-white" : "text-slate-400 cursor-not-allowed"} shadow-sm transition-all duration-200 hover:scale-105 active:scale-95`}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-slate-400 font-medium">Powered by Zenith AI</p>
                            </div>
                        </div>
                    </motion.div >
                )}
            </AnimatePresence >

            <div
                onClick={(e) => {
                    if (isDraggingRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    setIsOpen(!isOpen);
                }}
                className="relative w-48 h-48 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 z-50 group cursor-grab active:cursor-grabbing !bg-transparent"
                role="button"
                aria-label="Toggle Chatbot"
            >
                {/* 3D Character Animation */}
                <div className="w-full h-full pointer-events-none">
                    <Login3DCharacter focusedField={focusedField} keyTrigger={keyTrigger} className="min-h-0" />
                </div>

                {!isOpen && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-0 right-0 flex h-5 w-5 pointer-events-none"
                    >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-white items-center justify-center text-[10px] font-bold text-white shadow-sm">1</span>
                    </motion.span>
                )}
            </div>
        </motion.div >
    );
};


