import { forwardRef } from "react";
import { MessageCircle } from "lucide-react";

interface ChatbotIconProps {
  onClick: () => void;
  ariaLabel?: string;
}

const ChatbotIcon = forwardRef<HTMLButtonElement, ChatbotIconProps>(
  ({ onClick, ariaLabel = "Open chat" }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        aria-label={ariaLabel}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50 flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 z-50"
      >
        <MessageCircle className="w-7 h-7" />
      </button>
    );
  }
);

ChatbotIcon.displayName = "ChatbotIcon";

export default ChatbotIcon;

