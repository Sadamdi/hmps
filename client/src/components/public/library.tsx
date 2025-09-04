import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import MediaDisplay from '../MediaDisplay';

interface LibraryItem {
	id: number;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	date: string;
	time: string;
	type: 'photo' | 'video';
}

export default function Library() {
	const [searchQuery, setSearchQuery] = useState('');
	const [currentLibraryItemId, setCurrentLibraryItemId] = useState<
		number | null
	>(null);
	const [currentImageIndex, setCurrentImageIndex] = useState(0);

	const { data: libraryItems = [], isLoading } = useQuery({
		queryKey: ['/api/library'],
		placeholderData: [],
	});

	const searchLibrary = (items: LibraryItem[]) => {
		if (!searchQuery) return items;
		return items.filter((item) =>
			item.title.toLowerCase().includes(searchQuery.toLowerCase())
		);
	};

	const filteredLibraryItems = searchLibrary(libraryItems as LibraryItem[]);
	const currentItem = filteredLibraryItems.find(
		(item) => item.id === currentLibraryItemId
	);

	return (
		<section
			id="library"
			className="py-16 bg-gray-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div
					className="text-center mb-12"
					data-aos="fade-up">
					<h2 className="text-3xl font-bold text-gray-900 font-serif">
						Library
					</h2>
					<div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
					<p className="mt-4 text-lg text-gray-600">
						Koleksi foto dan video kegiatan Himpunan
					</p>
				</div>

				<div
					className="mb-8"
					data-aos="fade-up"
					data-aos-delay="100">
					<div className="relative max-w-lg mx-auto">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Search className="h-5 w-5 text-gray-400" />
						</div>
						<input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							type="text"
							className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
							placeholder="Cari di library..."
						/>
					</div>
				</div>

				{isLoading ? (
					<div className="animate-pulse space-y-8">
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="bg-white rounded-lg overflow-hidden shadow-md">
									<div className="h-48 bg-gray-200"></div>
									<div className="p-6 space-y-3">
										<div className="h-4 bg-gray-200 rounded w-3/4"></div>
										<div className="h-4 bg-gray-200 rounded"></div>
										<div className="h-4 bg-gray-200 rounded w-5/6"></div>
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<>
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{filteredLibraryItems.map((item: LibraryItem, index) => (
								<div
									key={item.id}
									className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
									data-aos="fade-up"
									data-aos-delay={index * 100}>
									<div className="h-48 relative overflow-hidden group">
										{/* Image Slider Controls */}
										{item.images.length > 1 && (
											<div>
												<button
													onClick={(e) => {
														e.stopPropagation();
														setCurrentImageIndex(
															Math.max(currentImageIndex - 1, 0)
														);
													}}
													className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
													<ChevronLeft className="h-5 w-5" />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														setCurrentImageIndex(
															Math.min(
																currentImageIndex + 1,
																item.images.length - 1
															)
														);
													}}
													className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition">
													<ChevronRight className="h-5 w-5" />
												</button>
											</div>
										)}

										<MediaDisplay
											src={item.images[0]}
											alt={item.title}
											type={item.type === 'video' ? 'video' : 'image'}
											className="w-full h-full"
										/>

										{/* Video Indicator */}
										{item.type === 'video' && (
											<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
												<div className="bg-white rounded-full p-3">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														className="h-8 w-8 text-primary"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor">
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth="2"
															d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
														/>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth="2"
															d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
														/>
													</svg>
												</div>
											</div>
										)}

										{/* Multi Image Indicator */}
										{item.images.length > 1 && (
											<div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs rounded px-2 py-1">
												<span>{`1/${item.images.length}`}</span>
											</div>
										)}
									</div>

									<div className="p-6">
										<div className="flex justify-between items-center mb-3">
											<span className="text-xs text-gray-500">{`${item.date} · ${item.time}`}</span>
											<span className="capitalize text-xs px-2 py-1 bg-gray-100 rounded-full">
												{item.type}
											</span>
										</div>
										<h3 className="font-bold text-xl mb-2">{item.title}</h3>
										<p className="text-gray-600 mb-4 line-clamp-2">
											{item.description}
										</p>
										<Dialog>
											<DialogTrigger asChild>
												<Button
													onClick={() => {
														setCurrentLibraryItemId(item.id);
														setCurrentImageIndex(0);
													}}
													variant="link"
													className="text-primary hover:text-[#1E40AF] p-0 h-auto font-medium">
													Lihat detail →
												</Button>
											</DialogTrigger>
											<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
												<DialogHeader>
													<DialogTitle className="text-2xl font-bold font-serif">
														{item.title}
													</DialogTitle>
												</DialogHeader>

												{item.type === 'photo' ? (
													<div className="mb-6 relative">
														<div className="relative">
															<div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
																<MediaDisplay
																	src={item.images[currentImageIndex]}
																	alt={`${item.title} - Image ${
																		currentImageIndex + 1
																	}`}
																	type="image"
																/>
															</div>

															{item.images.length > 1 && (
																<div className="absolute inset-0 flex items-center justify-between px-4">
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() =>
																			setCurrentImageIndex(
																				Math.max(currentImageIndex - 1, 0)
																			)
																		}
																		disabled={currentImageIndex === 0}
																		className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-black hover:bg-opacity-60">
																		<ChevronLeft className="h-6 w-6" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() =>
																			setCurrentImageIndex(
																				Math.min(
																					currentImageIndex + 1,
																					item.images.length - 1
																				)
																			)
																		}
																		disabled={
																			currentImageIndex ===
																			item.images.length - 1
																		}
																		className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-black hover:bg-opacity-60">
																		<ChevronRight className="h-6 w-6" />
																	</Button>
																</div>
															)}

															{item.images.length > 1 && (
																<div className="flex space-x-2 mt-4 overflow-x-auto pb-2">
																	{item.images.map((image, index) => (
																		<button
																			key={index}
																			onClick={() =>
																				setCurrentImageIndex(index)
																			}
																			className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden ${
																				currentImageIndex === index
																					? 'ring-2 ring-primary'
																					: ''
																			}`}>
																			<MediaDisplay
																				src={image}
																				alt={`Thumbnail ${index + 1}`}
																				type="image"
																				className="w-full h-full object-cover"
																			/>
																		</button>
																	))}
																</div>
															)}
														</div>
													</div>
												) : (
													// Video content - use MediaDisplay for proper video rendering
													<div className="mb-6 relative">
														<div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
															<MediaDisplay
																src={item.images[currentImageIndex]}
																alt={`${item.title} - Video ${
																	currentImageIndex + 1
																}`}
																type="video"
																className="w-full h-full"
															/>
														</div>

														{item.images.length > 1 && (
															<div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() =>
																		setCurrentImageIndex(
																			Math.max(currentImageIndex - 1, 0)
																		)
																	}
																	disabled={currentImageIndex === 0}
																	className="pointer-events-auto bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-black hover:bg-opacity-60">
																	<ChevronLeft className="h-6 w-6" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() =>
																		setCurrentImageIndex(
																			Math.min(
																				currentImageIndex + 1,
																				item.images.length - 1
																			)
																		)
																	}
																	disabled={
																		currentImageIndex === item.images.length - 1
																	}
																	className="pointer-events-auto bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-black hover:bg-opacity-60">
																	<ChevronRight className="h-6 w-6" />
																</Button>
															</div>
														)}

														{item.images.length > 1 && (
															<div className="flex space-x-2 mt-4 overflow-x-auto pb-2">
																{item.images.map((videoUrl, index) => (
																	<button
																		key={index}
																		onClick={() => setCurrentImageIndex(index)}
																		className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden relative ${
																			currentImageIndex === index
																				? 'ring-2 ring-primary'
																				: ''
																		}`}>
																		<MediaDisplay
																			src={videoUrl}
																			alt={`Video thumbnail ${index + 1}`}
																			type="video"
																		/>
																		<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
																			<svg
																				className="h-4 w-4 text-white"
																				fill="none"
																				stroke="currentColor"
																				viewBox="0 0 24 24">
																				<path
																					strokeLinecap="round"
																					strokeLinejoin="round"
																					strokeWidth="2"
																					d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
																				/>
																			</svg>
																		</div>
																	</button>
																))}
															</div>
														)}
													</div>
												)}

												<div className="mb-4 flex items-center text-sm text-gray-500">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														className="h-4 w-4 mr-1"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor">
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth="2"
															d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
														/>
													</svg>
													<span>{`${item.date} · ${item.time}`}</span>
												</div>

												<div className="prose max-w-none">
													{item.fullDescription}
												</div>
											</DialogContent>
										</Dialog>
									</div>
								</div>
							))}
						</div>

						<div
							className="text-center mt-10"
							data-aos="fade-up"
							data-aos-delay="200">
							<a href="/library">
								<Button
									variant="outline"
									className="btn-secondary">
									Lihat Semua Media
								</Button>
							</a>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
