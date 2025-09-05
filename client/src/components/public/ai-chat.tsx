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
		} catch (error) {
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
			<Button
				className="ai-chat-btn"
				onClick={() => setIsChatOpen(!isChatOpen)}>
				{isChatOpen ? (
					<X className="h-6 w-6" />
				) : (
					<MessageSquare className="h-6 w-6" />
				)}
			</Button>
			{isChatOpen && (
				<div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-lg shadow-xl overflow-hidden">
					<div className="bg-primary text-white px-4 py-4 flex items-center">
						<div className="mr-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6"
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
							<h3 className="font-medium">Spyro AI</h3>
							<p className="text-xs text-blue-100">Powered by Spyro</p>
						</div>
					</div>
					<div className="px-4 py-4 h-96 overflow-y-auto bg-gray-50">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex mb-4 ${msg.isBot ? '' : 'justify-end'}`}>
								{msg.isBot && (
									<div className="flex-shrink-0 mr-2">
										<div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-5 w-5"
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
									</div>
								)}
								<div
									className={`$ {
										msg.isBot ? 'bg-white' : 'bg-gray-200 text-gray-900'
									} p-3 rounded-lg shadow-sm max-w-[80%]`}>
									<div className="prose prose-sm max-w-none">
										{msg.isBot ? (
											<div className="whitespace-pre-wrap">{msg.text}</div>
										) : (
											<p className="text-sm">{msg.text}</p>
										)}
										{msg.imageUrl && (
											<img
												src={msg.imageUrl}
												alt="User upload"
												className="mt-2 max-w-xs rounded"
											/>
										)}
									</div>
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
											stroke="currentColor">
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
									<div
										className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
										style={{ animationDelay: '0.2s' }}></div>
									<div
										className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
										style={{ animationDelay: '0.4s' }}></div>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>
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
							className="bg-primary text-white px-4 py-2 hover:bg-[#1E40AF]"
							onClick={handleSendMessage}
							disabled={isLoading || (!inputMessage.trim() && !imageFile)}>
							<Send className="h-5 w-5" />
						</Button>
					</div>
					<div className="mt-2 flex justify-between text-xs text-gray-500 items-center">
						<button
							type="button"
							className="hover:text-primary flex items-center"
							onClick={handleUploadClick}>
							<PaperclipIcon className="h-4 w-4 mr-1" />
							Lampirkan gambar
						</button>
						<input
							type="file"
							accept="image/*"
							ref={fileInputRef}
							onChange={handleFileChange}
							hidden
						/>
						{imagePreview && (
							<div className="flex items-center ml-2">
								<img
									src={imagePreview}
									alt="Preview"
									className="h-10 w-10 object-cover rounded mr-2"
								/>
								<button
									onClick={() => {
										setImageFile(null);
										setImagePreview(null);
									}}
									className="text-red-500 hover:text-red-700 text-xs">
									Hapus
								</button>
							</div>
						)}
						<span>Powered by Spyro</span>
					</div>
				</div>
			)}
		</div>
	);
}
