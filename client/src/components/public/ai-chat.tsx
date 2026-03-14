import { Button } from '@/components/ui/button';
import { MessageSquare, PaperclipIcon, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
	id: string;
	isBot: boolean;
	text: string;
	timestamp: Date;
	imageUrl?: string;
}

export default function AIChat() {
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([
		{
			id: 'initial',
			isBot: true,
			text: 'Halo! Saya adalah Spyro AI. Ada yang bisa saya bantu terkait informasi Teknik Informatika UIN Malang?',
			timestamp: new Date(),
		},
	]);
	const [inputMessage, setInputMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages]);

	const handleSendMessage = async () => {
		if (!inputMessage.trim() && !imageFile) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			isBot: false,
			text: inputMessage,
			timestamp: new Date(),
			imageUrl: imagePreview || undefined,
		};
		setMessages((prev) => [...prev, userMessage]);
		setInputMessage('');
		setImageFile(null);
		setImagePreview(null);
		setIsLoading(true);

		try {
			let response, data, botText, botImageUrl;
			if (imageFile) {
				const formData = new FormData();
				formData.append('message', userMessage.text);
				formData.append('image', imageFile);
				response = await fetch('/api/chat/message', {
					method: 'POST',
					body: formData,
					credentials: 'include',
				});
			} else {
				response = await fetch('/api/chat/message', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: userMessage.text }),
					credentials: 'include',
				});
			}
			data = await response.json();
			const lastMsg = data?.chat?.messages?.at(-1);
			botText = lastMsg?.content || 'Maaf, terjadi kesalahan pada AI.';
			botImageUrl = lastMsg?.imageUrl;
			const botResponse: Message = {
				id: (Date.now() + 1).toString(),
				isBot: true,
				text: botText,
				timestamp: new Date(),
				imageUrl: botImageUrl,
			};
			setMessages((prev) => [...prev, botResponse]);
			setIsLoading(false);
		} catch {
			setIsLoading(false);
			const errorMessage: Message = {
				id: (Date.now() + 1).toString(),
				isBot: true,
				text: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti.',
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMessage]);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setImageFile(file);
			const reader = new FileReader();
			reader.onload = (ev) => {
				setImagePreview(ev.target?.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	return (
		<div className="fixed bottom-6 right-6 z-40">
			{/* Toggle Button */}
			<Button
				className="ai-chat-btn relative overflow-hidden group"
				onClick={() => setIsChatOpen(!isChatOpen)}
				aria-label={isChatOpen ? 'Tutup AI Chat' : 'Buka AI Chat'}>
				{/* Shimmer overlay on hover */}
				<span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
				{isChatOpen ? (
					<X className="h-6 w-6" />
				) : (
					<MessageSquare className="h-6 w-6" />
				)}
			</Button>

			{/* Chat Window */}
			{isChatOpen && (
				<div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-card border border-border/80 rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden animate-scale-in">
					{/* Header */}
					<div className="bg-gradient-to-r from-[#1a3a6b] to-[#0e2a56] border-b border-border/70 px-4 py-3.5 flex items-center gap-3">
						<div className="flex-shrink-0 w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center animate-glow-pulse">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5 text-cyan-300"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
						</div>
						<div>
							<h3 className="font-semibold text-slate-100 text-sm leading-none">Spyro AI</h3>
							<p className="text-xs text-cyan-300/80 mt-0.5">Powered by Spyro</p>
						</div>
						{/* Online indicator */}
						<div className="ml-auto flex items-center gap-1.5">
							<span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
							<span className="text-xs text-teal-300/80 font-medium">Online</span>
						</div>
					</div>

					{/* Messages Area */}
					<div className="px-4 py-4 h-80 overflow-y-auto bg-background space-y-3 scroll-smooth">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${msg.isBot ? 'items-start gap-2' : 'justify-end'}`}>
								{/* Bot avatar */}
								{msg.isBot && (
									<div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mt-0.5">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-4 w-4 text-cyan-300"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											/>
										</svg>
									</div>
								)}

								{/* Bubble */}
								<div
									className={`px-3 py-2.5 rounded-xl max-w-[82%] text-sm leading-relaxed ${
										msg.isBot
											? 'bg-secondary text-foreground rounded-tl-none border border-border/50'
											: 'bg-primary/25 text-foreground rounded-tr-none border border-primary/20'
									}`}>
									{msg.isBot ? (
										<div className="whitespace-pre-wrap">{msg.text}</div>
									) : (
										<p>{msg.text}</p>
									)}
									{msg.imageUrl && (
										<img
											src={msg.imageUrl}
											alt="Upload"
											className="mt-2 max-w-full rounded-lg"
										/>
									)}
								</div>
							</div>
						))}

						{/* Typing indicator */}
						{isLoading && (
							<div className="flex items-start gap-2">
								<div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-4 w-4 text-cyan-300"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
								</div>
								<div className="bg-secondary border border-border/50 rounded-xl rounded-tl-none px-3.5 py-3 flex items-center gap-1.5">
									<span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce" />
									<span
										className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce"
										style={{ animationDelay: '0.18s' }}
									/>
									<span
										className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce"
										style={{ animationDelay: '0.36s' }}
									/>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Image preview strip */}
					{imagePreview && (
						<div className="px-4 py-2 bg-secondary/60 border-t border-border/50 flex items-center gap-2">
							<img
								src={imagePreview}
								alt="Preview"
								className="h-10 w-10 object-cover rounded-lg border border-border/60"
							/>
							<span className="text-xs text-muted-foreground flex-1 truncate">Gambar terlampir</span>
							<button
								onClick={() => { setImageFile(null); setImagePreview(null); }}
								className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">
								Hapus
							</button>
						</div>
					)}

					{/* Input Area */}
					<div className="border-t border-border/70 bg-card">
						<div className="flex items-center gap-2 px-3 py-2.5">
							{/* Attach button */}
							<button
								type="button"
								onClick={handleUploadClick}
								className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-cyan-300 hover:bg-secondary transition-colors"
								title="Lampirkan gambar">
								<PaperclipIcon className="h-4 w-4" />
							</button>
							<input
								type="file"
								accept="image/*"
								ref={fileInputRef}
								onChange={handleFileChange}
								hidden
							/>

							{/* Text input */}
							<input
								type="text"
								placeholder="Ketik pesanmu..."
								className="flex-1 min-w-0 bg-secondary/60 border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								onKeyDown={handleKeyPress}
								disabled={isLoading}
							/>

							{/* Send button */}
							<button
								onClick={handleSendMessage}
								disabled={isLoading || (!inputMessage.trim() && !imageFile)}
								className="flex-shrink-0 p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200">
								<Send className="h-4 w-4" />
							</button>
						</div>
						<p className="text-center text-xs text-muted-foreground/60 pb-2">Powered by Spyro</p>
					</div>
				</div>
			)}
		</div>
	);
}
