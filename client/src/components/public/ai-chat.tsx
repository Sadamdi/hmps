import { useState, useRef, useEffect } from "react";
import { X, MessageSquare, PaperclipIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  isBot: boolean;
  text: string;
  timestamp: Date;
}

export default function AIChat() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      isBot: true,
      text: "Halo! Saya adalah asisten AI HMTI. Ada yang bisa saya bantu terkait informasi Teknik Informatika UIN Malang?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      isBot: false,
      text: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // API call would go here in a real implementation
      // For now, we'll simulate a response
      setTimeout(() => {
        const botResponse: Message = {
          id: (Date.now() + 1).toString(),
          isBot: true,
          text: "Terima kasih atas pertanyaannya. Saya masih dalam tahap pengembangan. Untuk informasi lebih lanjut, silakan hubungi sekretariat HMTI UIN Malang.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botResponse]);
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        isBot: true,
        text: "Maaf, terjadi kesalahan. Silakan coba lagi nanti.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Chat Bubble Button */}
      <Button
        className="ai-chat-btn"
        onClick={() => setIsChatOpen(!isChatOpen)}
      >
        {isChatOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="bg-primary text-white px-4 py-4 flex items-center">
            <div className="mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium">AI Assistant HMTI</h3>
              <p className="text-xs text-blue-100">Powered by Gemini AI</p>
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex mb-4 ${msg.isBot ? "" : "justify-end"}`}>
                {msg.isBot && (
                  <div className="flex-shrink-0 mr-2">
                    <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                )}
                <div 
                  className={`${
                    msg.isBot 
                      ? "bg-white" 
                      : "bg-primary text-white"
                  } p-3 rounded-lg shadow-sm max-w-[80%]`}
                >
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex mb-4">
                <div className="flex-shrink-0 mr-2">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm max-w-[80%] flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t">
            <div className="flex">
              <input
                type="text"
                placeholder="Ketik pesanmu di sini..."
                className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
              />
              <Button
                className="bg-primary text-white px-4 py-2 rounded-r-md hover:bg-[#1E40AF]"
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <button className="hover:text-primary flex items-center">
                <PaperclipIcon className="h-4 w-4 mr-1" />
                Lampirkan gambar
              </button>
              <span>Powered by Gemini AI</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
