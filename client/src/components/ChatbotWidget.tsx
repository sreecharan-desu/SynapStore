import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import { X, Send, Loader2, Sparkles, Mic, Volume2, VolumeX, Check } from "lucide-react";
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
import { AIVoiceInput } from "./ui/ai-voice-input";
import { TextShimmer } from "./ui/text-shimmer";

export const ChatbotWidget = () => {
    const { isAuthenticated, user } = useAuthContext();
    const { token } = useRecoilValue(authState);
    const location = useLocation();

    // Hide on Store Create page
    if (location.pathname === "/store/create") return null;

    // Filter for permitted roles
    const userRole = user?.globalRole || "";
    const isVoiceAllowed = ["SUPERADMIN", "SUPPLIER", "STORE_OWNER"].includes(userRole);

    // Reset chat when user/role changes
    useEffect(() => {
        setMessages([
            { id: "welcome-reset", role: "bot", text: `Hello! I'm ${import.meta.env.VITE_BOT_NAME || "Dose"}. How can I help you manage your store today?` }
        ]);
    }, [user?.globalRole, user?.id]);

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
    const [isListening, setIsListening] = useState(false); // Used for manual dictation mode
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

    // Voice permission and Wake Word
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef(isListening); // Ref to track dictation mode inside callbacks
    const isOpenRef = useRef(isOpen);
    const isSpeakingRef = useRef(false);

    // Live Conversation State
    const [isConversationMode, setIsConversationMode] = useState(false);
    const isConversationModeRef = useRef(false);

    // Sync refs
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        isConversationModeRef.current = isConversationMode;
    }, [isConversationMode]);

    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    useEffect(() => {
        isOpenRef.current = isOpen;
        if (!isOpen) {
            setIsConversationMode(false);
            setIsListening(false);
            if (isSpeaking) {
                synthRef.current?.cancel();
                setIsSpeaking(false);
            }
        }
    }, [isOpen]);

    // Check for existing permission on mount or ask
    useEffect(() => {
        if (isAuthenticated && isVoiceAllowed) {
            const timeout = setTimeout(() => {
                if (!permissionGranted) {
                    setShowPermissionModal(true);
                }
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [isAuthenticated, isVoiceAllowed]);

    const initSpeechRecognition = () => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        // Clean up previous instance
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            console.log("Mic Active");
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed') {
                setPermissionGranted(false);
            }
        };

        recognition.onend = () => {
            // Only restart if this is the active instance
            if (recognition !== recognitionRef.current) return;

            // Restart if permission granted AND we are NOT currently speaking
            if (permissionGranted && !isSpeakingRef.current) {
                console.log("Restarting Mic...");
                setTimeout(() => {
                    try {
                        if (!isSpeakingRef.current && recognition === recognitionRef.current) {
                            recognition.start();
                        }
                    } catch (e) { }
                }, 200);
            } else {
                if (!permissionGranted) setIsListening(false);
            }
        };

        recognition.onresult = (event: any) => {
            // Explicitly ignore results if speaking (double check)
            if (isSpeakingRef.current) return;

            const results = Array.from(event.results);
            const lastResult: any = results[results.length - 1];
            const transcript = lastResult[0].transcript.trim().toLowerCase();
            const isFinal = lastResult.isFinal;

            // Debug logger for user
            console.log("🎤 Heard:", transcript, "| Final:", isFinal);

            // 1. Wake Word Detection (Always Active if permission granted)
            const wakeWordTriggers = [
                // Precise
                "hey dose", "hi dose", "hello dose",
                "hey does", "hi does", "hello does",
                "hey doze", "hi doze", "headers",
                "heroes", "shadow", "hay dost",
                // Phonetic / Accent Variations (Based on logs)
                "hey doors", "hey door",
                "head doors", "head door",
                "hate those", "hate dose",
                "hey ghost", "hey those",
                "hey dows", "hey dos",
                "he dose", "he does", "doors", "Hey dost", "hi dost", "hello dost", "hey dost", "hi dost", "hello dost", "hey dost", "hi dost", "hello dost"
            ];

            const detectedWakeWord = wakeWordTriggers.some(trigger => transcript.includes(trigger));

            if (detectedWakeWord) {
                // Trigger if closed OR if open but not yet in conversation mode
                if (!isOpenRef.current || !isConversationModeRef.current) {
                    // setIsOpen(false); // Keep chat window state independent or force closed if desired
                    setIsConversationMode(true);

                    // Respond with the preloaded welcome message
                    const welcomeText = messages.find(m => m.id === "welcome")?.text || `Hello! I'm ${BOT_NAME}.`;

                    // Stop mic to prevent echo during speak, then restart
                    isSpeakingRef.current = true; // Force immediate ref update
                    try { recognition.abort(); } catch (e) { }

                    speak(welcomeText, () => {
                        setIsListening(true);
                        // Force restart recognition logic in case onend didn't catch it
                        if (recognitionRef.current && !recognitionRef.current.started) {
                            try { recognitionRef.current.start(); } catch (e) { initSpeechRecognition(); }
                        }
                    });

                    return;
                }
            }

            // 2. Dictation Mode
            if (isListeningRef.current) {
                setInputValue(transcript);

                if (isFinal) {
                    // Check for exit commands
                    const exitTriggers = [
                        "stop", "goodbye", "bye",
                        "will meet later", "meet later",
                        "see you later", "see you",
                        "talk later", "later",
                        "close", "exit", "quit", "shut down", "leave"
                    ];

                    if (exitTriggers.some(trigger => transcript.includes(trigger))) {
                        console.log("🛑 Exit trigger detected:", transcript);
                        speak("Goodbye! Have a great day.", () => {
                            setIsConversationMode(false);
                            setIsOpen(false);
                        });
                        setIsListening(false);
                        return;
                    }

                    handleVoiceCommand(transcript);
                    // Pause listening logic while processing (don't stop mic completely, just state)
                    setIsListening(false);
                }
            }

        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
        }
    };

    // Initialize ONLY when permission is explicitly granted via our modal
    // Initialize ONLY when permission is explicitly granted via our modal AND role is allowed
    useEffect(() => {
        if (permissionGranted && isVoiceAllowed) {
            // Small delay to ensure audio context is ready
            setTimeout(initSpeechRecognition, 500);
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // Prevent restart loops on cleanup
                recognitionRef.current.stop();
            }
        };
    }, [permissionGranted, isVoiceAllowed]);

    const speak = (text: string, onComplete?: () => void) => {
        if (!voiceEnabled || !synthRef.current) {
            onComplete?.();
            return;
        }

        // Stop speech and potential echo
        synthRef.current.cancel();
        setIsSpeaking(true);
        isSpeakingRef.current = true; // IMMEDIATE sync for race conditions

        // Abort recognition to be safe (prevent self-hearing)
        try { recognitionRef.current?.abort(); } catch (e) { }

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsListening(false);
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            onComplete?.();
            // Restart mic if permission still granted
            if (permissionGranted) {
                try { recognitionRef.current?.start(); } catch (e) { initSpeechRecognition(); }
            }
        };
        synthRef.current.speak(utterance);
    };

    const toggleListening = () => {
        if (!permissionGranted) {
            setShowPermissionModal(true);
            return;
        }

        if (isListening) {
            setIsListening(false);
            setIsConversationMode(false);
        } else {
            setIsListening(true);
            setIsConversationMode(true);
        }
    };

    const handleVoiceCommand = (text: string) => {
        // No delay for conversation mode
        handleSendMessage(text);
    };

    // Strictly use the user ID as the thread ID
    const threadId = user?.id;

    // Theme logic integration
    const [themeName, setThemeName] = useState("green");

    useEffect(() => {
        if (user?.globalRole === "SUPERADMIN") {
            setThemeName("violet");
        } else if (user?.globalRole === "SUPPLIER") {
            setThemeName("teal");
        } else {
            const t = localStorage.getItem("selectedTheme");
            if (t) setThemeName(t);
        }
    }, [user, isOpen]);

    // Extended Theme Palette
    const themeColors: Record<string, { bg: string, text: string, border: string, gradient: string, shadow: string, sentMsgBg: string }> = {
        green: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-200", gradient: "from-emerald-600 to-teal-500", shadow: "shadow-emerald-500/30", sentMsgBg: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
        teal: { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-200", gradient: "from-teal-500 to-emerald-500", shadow: "shadow-teal-500/30", sentMsgBg: "bg-gradient-to-br from-teal-500 to-teal-600" },
        violet: { bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-200", gradient: "from-violet-600 to-indigo-600", shadow: "shadow-violet-500/30", sentMsgBg: "bg-gradient-to-br from-violet-600 to-indigo-600" },
        red: { bg: "bg-red-600", text: "text-red-600", border: "border-red-200", gradient: "from-red-600 to-rose-600", shadow: "shadow-red-500/30", sentMsgBg: "bg-gradient-to-br from-red-500 to-red-600" },
        orange: { bg: "bg-orange-600", text: "text-orange-600", border: "border-orange-200", gradient: "from-orange-500 to-amber-500", shadow: "shadow-orange-500/30", sentMsgBg: "bg-gradient-to-br from-orange-500 to-orange-600" },
        blue: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-200", gradient: "from-blue-600 to-indigo-600", shadow: "shadow-blue-500/30", sentMsgBg: "bg-gradient-to-br from-blue-500 to-blue-600" },
        black: { bg: "bg-slate-900", text: "text-slate-900", border: "border-slate-200", gradient: "from-slate-900 to-slate-800", shadow: "shadow-slate-500/30", sentMsgBg: "bg-gradient-to-br from-slate-900 to-slate-800" },
    };

    const theme = themeColors[themeName] || themeColors.green;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSendMessage = async (manualText?: string) => {
        const textToSend = manualText || inputValue;
        if (!textToSend.trim()) return;

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

            const botText = data.reply_markdown || data.response || data.message || (typeof data === 'string' ? data : JSON.stringify(data));

            const botMsg: Message = { id: (Date.now() + 1).toString(), role: "bot", text: botText };
            setMessages(prev => [...prev, botMsg]);

            // Only speak if in Voice/Conversation Mode
            if (isConversationModeRef.current) {
                speak(botText, () => {
                    if (isConversationModeRef.current) {
                        setIsListening(true);
                    }
                });
            }

        } catch (error) {
            console.error("Request failed:", error);
            const errorMsg: Message = { id: (Date.now() + 1).toString(), role: "bot", text: "Sorry, I'm having trouble connecting to the server. Please check your internet connection and try again." };
            setMessages(prev => [...prev, errorMsg]);

            // Speak error only if in conversation mode
            if (isConversationModeRef.current) {
                speak(errorMsg.text, () => {
                    setIsConversationMode(false);
                    setIsListening(false);
                });
            } else {
                // Not in voice mode, just ensure listening is off
                setIsListening(false);
            }
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

    // ... (keep existing helper functions)

    // Voice Mode UI Component


    if (!isAuthenticated) return null;

    return (
        <>
            {/* Permission Modal */}
            <AnimatePresence>
                {/* Permission Modal ... (Existing) */}
                {showPermissionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    >
                        {/* ... existing permission modal content ... */}
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-white/20 relative"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                                    <Mic className="w-8 h-8 text-blue-500" />
                                </div>

                                <h3 className="text-xl font-bold text-slate-800">Enable Voice Assistant?</h3>

                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Allow ${BOT_NAME} to listen for the wake word <strong>"Hey Dose"</strong> and respond to voice commands automatically.
                                </p>

                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setShowPermissionModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        Not Now
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPermissionGranted(true);
                                            setShowPermissionModal(false);
                                        }}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Enable
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                            className="w-[400px] md:w-[480px] h-[700px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 bg-white/90 backdrop-blur-2xl ring-1 ring-black/5"
                        >
                            {/* Header */}
                            <div className="relative p-5 bg-slate-900/95 text-white shadow-md z-10 shrink-0 border-b border-white/10">
                                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                    <Sparkles className="w-16 h-16 text-white animate-pulse" />
                                </div>

                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex items-center justify-center flex-none w-14 h-14 -ml-1">
                                            <div className="w-full h-full overflow-hidden relative drop-shadow-lg">
                                                <Login3DCharacter focusedField={null} keyTrigger={0} className="w-full h-full min-h-[50px] scale-110" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col">
                                            <h3 className="font-bold text-xl leading-tight tracking-tight text-white">{BOT_NAME}</h3>
                                            <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5 opacity-90 mt-0.5">
                                                {isSpeaking ? (
                                                    <span className="flex gap-0.5 items-center">
                                                        <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" />
                                                        <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce delay-75" />
                                                        <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce delay-150" />
                                                        <span className="ml-1 text-emerald-400 font-semibold">Speaking...</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                        <span className="text-slate-300">Always online</span>
                                                    </>
                                                )}
                                                {permissionGranted && (
                                                    <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded-full border border-white/10 text-white/80">Voice Active</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2.5 bg-white/10 hover:bg-white/20 hover:text-white rounded-xl transition-colors backdrop-blur-sm group"
                                            aria-label="Close chat"
                                        >
                                            <X className="w-5 h-5 text-gray-300 group-hover:text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div
                                onPointerDown={(e) => e.stopPropagation()}
                                className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 relative custom-scrollbar scroll-smooth"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                <div className="text-center py-2">
                                    <span className="px-4 py-1.5 bg-slate-200/50 text-slate-500 text-[11px] font-bold rounded-full uppercase tracking-widest backdrop-blur-sm border border-slate-200/60 shadow-sm">
                                        Today
                                    </span>
                                </div>

                                {messages.map((msg) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        key={msg.id}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-3`}
                                    >
                                        {msg.role === "bot" && (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative -ml-1 -mb-1 shadow-md bg-white border border-slate-100">
                                                <Login3DCharacter focusedField={null} keyTrigger={0} className="w-full h-full min-h-[40px] scale-110 translate-y-1" />
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[85%] p-4 text-[15px] leading-relaxed shadow-sm ${msg.role === "user"
                                                ? `${theme.sentMsgBg} text-white rounded-2xl rounded-tr-none shadow-md`
                                                : "bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-none shadow-sm"
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
                                                    a: ({ node, ...props }) => <a className={`underline underline-offset-2 ${msg.role === 'user' ? 'text-white font-medium' : 'text-indigo-600 hover:text-indigo-700 font-medium'}`} target="_blank" rel="noopener noreferrer" {...props} />,
                                                    code: ({ node, className, children, ...props }: any) => {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return !match ? (
                                                            <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${msg.role === 'user' ? 'bg-white/20' : 'bg-slate-100 text-slate-800 border border-slate-200'}`} {...props}>
                                                                {children}
                                                            </code>
                                                        ) : (
                                                            <div className="rounded-lg overflow-hidden my-2 border border-slate-200/50 shadow-sm">
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
                                                    table: ({ node, ...props }) => <div className="overflow-x-auto my-2 rounded-lg border border-slate-200 shadow-sm"><table className="w-full text-left text-xs bg-white" {...props} /></div>,
                                                    thead: ({ node, ...props }) => <thead className={msg.role === 'user' ? 'bg-white/10' : 'bg-slate-50'} {...props} />,
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
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative -ml-1 -mb-1 shadow-md bg-white border border-slate-100">
                                            <Login3DCharacter focusedField={null} keyTrigger={0} className="w-full h-full min-h-[40px] scale-110 translate-y-1" />
                                        </div>
                                        <div className="bg-white border border-slate-100 px-6 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center">
                                            <TextShimmer className="text-sm font-medium" duration={1}>
                                                Thinking.....
                                            </TextShimmer>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-4 bg-white border-t border-slate-100 z-10 shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]"
                            >
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-3xl px-3 py-2 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all shadow-inner">
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
                                        className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                                        disabled={isLoading || isListening}
                                    />

                                    <div className="flex items-center gap-2 pr-1">
                                        <AIVoiceInput
                                            isListening={isListening}
                                            onStart={toggleListening}
                                            onStop={() => toggleListening()}
                                            className="w-auto py-0 flex-none"
                                            buttonClassName={`p-3 rounded-2xl transition-all w-11 h-11 flex items-center justify-center ${isListening ? '' : 'text-slate-500 hover:bg-white hover:shadow-md hover:text-indigo-600'}`}
                                            visualizerClassName="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white/95 backdrop-blur-xl border border-slate-200 p-3 rounded-2xl shadow-2xl w-64 z-50 pointer-events-none"
                                            visualizerBars={24}
                                        />
                                        <button
                                            onClick={() => handleSendMessage()}
                                            disabled={!inputValue.trim() || isLoading}
                                            className={`p-3 rounded-2xl w-11 h-11 flex items-center justify-center ${inputValue.trim() ? theme.bg : "bg-slate-200"} ${inputValue.trim() ? "text-white shadow-lg shadow-indigo-500/30" : "text-slate-400 cursor-not-allowed"} transition-all duration-300 hover:scale-105 active:scale-95`}
                                        >
                                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="text-center mt-3">
                                    <p className="text-[10px] text-slate-400 font-medium tracking-wide">Powered by Zenith AI</p>
                                </div>
                            </div>
                        </motion.div >
                    )}
                </AnimatePresence >

                {/* 3D Character Toggle Button */}
                <div
                    onClick={(e) => {
                        if (isDraggingRef.current) { e.preventDefault(); e.stopPropagation(); return; }
                        setIsOpen(!isOpen);
                    }}
                    className="relative w-48 h-48 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 z-50 group cursor-grab active:cursor-grabbing !bg-transparent"
                    role="button"
                    aria-label="Toggle Chatbot"
                >
                    <div className="w-full h-full pointer-events-none">
                        <Login3DCharacter focusedField={focusedField} keyTrigger={keyTrigger} className="min-h-0" />
                    </div>
                    {!isOpen && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-0 right-0 flex h-6 w-6 pointer-events-none translate-y-4 -translate-x-4"
                        >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 border-2 border-white items-center justify-center text-[10px] font-bold text-white shadow-md">1</span>
                        </motion.span>
                    )}
                </div>
            </motion.div >

            <AnimatePresence>
                {isConversationMode && isVoiceAllowed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md perspective-1000"
                        onClick={() => {
                            setIsConversationMode(false);
                            setIsListening(false);
                            if (synthRef.current) synthRef.current.cancel();
                        }}
                    >
                        {/* Tablet Container Animation */}
                        <motion.div
                            initial={{ rotateX: 20, scale: 0.8, opacity: 0, y: 100 }}
                            animate={{ rotateX: 0, scale: 1, opacity: 1, y: 0 }}
                            exit={{ rotateX: 20, scale: 0.8, opacity: 0, y: 100 }}
                            transition={{ type: "spring", damping: 20, stiffness: 100 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ perspective: "1000px" }}
                            className="relative w-full max-w-5xl mx-auto h-[90vh] p-4"
                        >
                            {/* Tablet Bezel (Removed - now just a clean container) */}
                            <div className="h-full w-full bg-white rounded-[24px] shadow-2xl flex flex-col ring-1 ring-slate-200 overflow-hidden">
                                {/* Tablet Screen */}
                                <div className="h-full w-full relative flex flex-col">

                                    {/* Header Status */}
                                    <div className="flex items-center justify-between w-full p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0 z-10">
                                        <div className="flex items-center gap-3">
                                            {/* Tablet Icon (Login Character) - Moved Left, Removed Green Circle */}
                                            <div className="w-16 h-16 overflow-hidden relative -ml-2">
                                                <Login3DCharacter focusedField={null} keyTrigger={0} className="w-full h-full min-h-[50px]" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold tracking-widest uppercase text-slate-800">
                                                    DOSE AI
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                    <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400">
                                                        {isSpeaking ? "Speaking" : isListening ? "Listening..." : "Online"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setIsConversationMode(false)}
                                                className="p-2 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors shadow-md border-0"
                                            >
                                                <X className="w-5 h-5 border-none outline-none" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chat History View */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                                        {messages.filter(m => m.id !== 'welcome-reset').map((msg) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                key={msg.id}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-3`}
                                            >
                                                {msg.role === "bot" && (
                                                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 relative -ml-2 -mb-2">
                                                        <Login3DCharacter focusedField={null} keyTrigger={0} className="w-full h-full min-h-[40px]" />
                                                    </div>
                                                )}
                                                <div
                                                    className={`max-w-[80%] p-4 text-sm leading-relaxed shadow-sm ${msg.role === "user"
                                                        ? "bg-slate-900 text-white rounded-2xl rounded-tr-md"
                                                        : "bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-md"
                                                        }`}
                                                >
                                                    {msg.text}
                                                </div>
                                            </motion.div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Live Input / Composer Area */}
                                    <div className="p-6 pt-2 bg-gradient-to-t from-white via-white/90 to-transparent shrink-0">
                                        <div className="relative w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-100 transition-all">
                                            <div className="flex-1 min-h-[48px] flex items-center">
                                                {isSpeaking ? (
                                                    <div className="flex items-center gap-1 h-full">
                                                        <span className="text-slate-500 text-sm italic">Dose is speaking...</span>
                                                        {/* Clean waveform animation */}
                                                        <div className="flex gap-1 h-4 items-center ml-2">
                                                            {[1, 2, 3].map(i => (
                                                                <div key={i} className="w-1 bg-green-500 rounded-full animate-[voice-wave_1s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.1}s`, height: '60%' }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={inputValue}
                                                        onChange={(e) => setInputValue(e.target.value)}
                                                        placeholder={isListening ? "Listening..." : "Type or speak..."}
                                                        className="w-full bg-transparent border-none p-0 text-xl font-light text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                                                        autoFocus
                                                    />
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            {inputValue && !isSpeaking ? (
                                                <button
                                                    onClick={() => handleSendMessage()}
                                                    className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
                                                >
                                                    <Send className="w-5 h-5" />
                                                </button>
                                            ) : (
                                                <div className={`p-3 rounded-xl transition-all duration-500 ${isListening ? 'bg-white shadow-md border border-slate-100' : 'bg-slate-100 text-slate-400'}`}>
                                                    {isListening ? (
                                                        <div className="relative">
                                                            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20"></span>
                                                            <Mic className="w-5 h-5 relative z-10 text-red-500" />
                                                        </div>
                                                    ) : (
                                                        <Mic className="w-5 h-5" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center mt-3">
                                            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                                                POWERED BY ZENITH AI
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >
        </>
    );
};
