import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
	value: string;
	onChange: (content: string) => void;
	placeholder?: string;
	height?: number;
	articleId?: string; // Add articleId prop for image uploads
}

export default function RichTextEditor({
	value,
	onChange,
	placeholder = 'Write your content here...',
	height = 400,
	articleId,
}: RichTextEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const loadTinyMCE = async () => {
			// Get API key from environment variable
			const apiKey = import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key';

			// Load TinyMCE from CDN
			if (!(window as any).tinymce) {
				const script = document.createElement('script');
				script.src = `https://cdn.tiny.cloud/1/${apiKey}/tinymce/6/tinymce.min.js`;
				script.referrerPolicy = 'origin';
				document.head.appendChild(script);

				script.onload = () => {
					initTinyMCE();
				};

				script.onerror = () => {
					console.error(
						'❌ Failed to load TinyMCE. Please check your API key.'
					);
					createFallbackEditor();
				};
			} else {
				initTinyMCE();
			}
		};

		const createFallbackEditor = () => {
			if (editorRef.current) {
				editorRef.current.innerHTML = `
					<div class="fallback-editor border rounded p-4">
						<div class="mb-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
							⚠️ TinyMCE failed to load. Using basic editor. Please check your API key.
						</div>
						<textarea
							class="w-full border rounded p-3 resize-none"
							style="height: ${height}px"
							placeholder="${placeholder}"
							value="${value}"
						></textarea>
					</div>
				`;

				const textarea = editorRef.current.querySelector(
					'textarea'
				) as HTMLTextAreaElement;
				if (textarea) {
					textarea.value = value;
					textarea.addEventListener('input', (e) => {
						onChange((e.target as HTMLTextAreaElement).value);
					});
				}
			}
		};

		const initTinyMCE = () => {
			if (editorRef.current && (window as any).tinymce) {
				(window as any).tinymce.init({
					target: editorRef.current,
					height: height,
					menubar: true,
					// Simplified plugins untuk menghindari conflicts
					plugins: [
						'advlist',
						'autolink',
						'lists',
						'link',
						'image',
						'charmap',
						'anchor',
						'searchreplace',
						'visualblocks',
						'code',
						'fullscreen',
						'insertdatetime',
						'media',
						'table',
						'help',
						'wordcount',
					],
					// Simplified toolbar
					toolbar:
						'undo redo | formatselect | bold italic underline strikethrough | ' +
						'alignleft aligncenter alignright alignjustify | ' +
						'bullist numlist outdent indent | link image table | ' +
						'forecolor backcolor | code fullscreen help',

					// CSS fixes untuk mencegah conflicts
					content_style: `
						body {
							font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
							font-size: 14px;
							line-height: 1.6;
							margin: 20px;
							background: white;
						}
						h1, h2, h3, h4, h5, h6 {
							color: #333;
							margin-top: 20px;
							margin-bottom: 10px;
						}
						p { margin-bottom: 16px; }
						img { max-width: 100%; height: auto; }
						.mce-content-body { min-height: 300px; }
					`,

					// UI fixes untuk mencegah toolbar bugs
					skin: 'oxide',
					theme: 'silver',

					// Fix z-index dan positioning issues
					inline: false,
					fixed_toolbar_container: false,

					// Custom image upload handler
					images_upload_handler: async (blobInfo: any, progress: any) => {
						return new Promise(async (resolve, reject) => {
							try {
								console.log(
									'🖼️ TinyMCE Image Upload Started:',
									blobInfo.filename()
								);

								const formData = new FormData();
								formData.append('image', blobInfo.blob(), blobInfo.filename());

								// Use articleId if available
								const targetArticleId = articleId || 'temp-' + Date.now();
								formData.append('articleId', targetArticleId.toString());

								console.log('📤 Uploading to article:', targetArticleId);

								const response = await fetch('/api/upload/content-image', {
									method: 'POST',
									body: formData,
								});

								if (!response.ok) {
									throw new Error(`Upload failed: ${response.statusText}`);
								}

								const data = await response.json();
								console.log('✅ Image uploaded:', data.url);

								// Return the URL for TinyMCE to use
								resolve(data.url);
							} catch (error) {
								console.error('❌ Image upload failed:', error);
								reject(error);
							}
						});
					},

					// Allow paste images
					paste_data_images: true,

					// File picker for images
					file_picker_types: 'image',
					file_picker_callback: (callback: any, value: any, meta: any) => {
						if (meta.filetype === 'image') {
							const input = document.createElement('input');
							input.setAttribute('type', 'file');
							input.setAttribute('accept', 'image/*');

							input.addEventListener('change', async (e: any) => {
								const file = e.target.files[0];
								if (file) {
									try {
										const formData = new FormData();
										formData.append('image', file);

										const targetArticleId = articleId || 'temp-' + Date.now();
										formData.append('articleId', targetArticleId.toString());

										const response = await fetch('/api/upload/content-image', {
											method: 'POST',
											body: formData,
										});

										if (!response.ok) {
											throw new Error(`Upload failed: ${response.statusText}`);
										}

										const data = await response.json();
										callback(data.url, { alt: file.name });
									} catch (error) {
										console.error('❌ File picker upload failed:', error);
									}
								}
							});

							input.click();
						}
					},

					// Ensure proper event handling
					init_instance_callback: (editor: any) => {
						console.log('✅ TinyMCE initialized successfully');

						// ENHANCED: Force fix all dialogs immediately after init
						const setupDialogFixes = () => {
							// Create comprehensive dialog fix function
							const forceFixDialogs = () => {
								// Target all dialog elements
								const dialogs = document.querySelectorAll('.tox-dialog');
								const dialogWraps =
									document.querySelectorAll('.tox-dialog-wrap');
								const backdrops = document.querySelectorAll(
									'.tox-dialog-wrap__backdrop'
								);

								// Target all possible input types in dialogs
								const inputs = document.querySelectorAll(`
									.tox-dialog input[type="text"],
									.tox-dialog input[type="url"],
									.tox-dialog input[type="email"], 
									.tox-dialog textarea,
									.tox-textfield,
									.tox-textarea,
									.tox-selectfield select,
									.tox-dialog .tox-textfield,
									.tox-dialog .tox-textarea
								`);

								const buttons = document.querySelectorAll(
									'.tox-dialog .tox-button'
								);

								if (dialogs.length > 0) {
									console.log(
										`🔧 Fixing ${dialogs.length} dialogs with ${inputs.length} inputs`
									);
								}

								// Fix backdrop positioning
								backdrops.forEach((backdrop: any) => {
									backdrop.style.setProperty('position', 'fixed', 'important');
									backdrop.style.setProperty('top', '0', 'important');
									backdrop.style.setProperty('left', '0', 'important');
									backdrop.style.setProperty('width', '100vw', 'important');
									backdrop.style.setProperty('height', '100vh', 'important');
									backdrop.style.setProperty('z-index', '9999', 'important');
									backdrop.style.setProperty(
										'background',
										'rgba(0, 0, 0, 0.5)',
										'important'
									);
									backdrop.style.setProperty(
										'pointer-events',
										'auto',
										'important'
									);
								});

								// Fix dialog wrapper positioning
								dialogWraps.forEach((wrap: any) => {
									wrap.style.setProperty('position', 'fixed', 'important');
									wrap.style.setProperty('z-index', '10000', 'important');
									wrap.style.setProperty('pointer-events', 'auto', 'important');
									wrap.style.setProperty('top', '0', 'important');
									wrap.style.setProperty('left', '0', 'important');
									wrap.style.setProperty('width', '100%', 'important');
									wrap.style.setProperty('height', '100%', 'important');
									wrap.style.setProperty('display', 'flex', 'important');
									wrap.style.setProperty('align-items', 'center', 'important');
									wrap.style.setProperty(
										'justify-content',
										'center',
										'important'
									);
								});

								// Fix dialog container
								dialogs.forEach((dialog: any) => {
									dialog.style.setProperty('position', 'relative', 'important');
									dialog.style.setProperty('z-index', '10001', 'important');
									dialog.style.setProperty(
										'pointer-events',
										'auto',
										'important'
									);
									dialog.style.setProperty(
										'background-color',
										'white',
										'important'
									);
									dialog.style.setProperty(
										'border',
										'1px solid #ccc',
										'important'
									);
									dialog.style.setProperty('border-radius', '8px', 'important');
									dialog.style.setProperty(
										'box-shadow',
										'0 10px 25px rgba(0,0,0,0.3)',
										'important'
									);
									dialog.style.setProperty('max-width', '90vw', 'important');
									dialog.style.setProperty('max-height', '90vh', 'important');
									dialog.style.setProperty('overflow', 'visible', 'important');
								});

								// CRITICAL: Fix all input fields
								inputs.forEach((input: any, index) => {
									// Remove all conflicting attributes
									input.removeAttribute('readonly');
									input.removeAttribute('disabled');
									input.removeAttribute('aria-disabled');

									// Set essential attributes
									input.setAttribute('tabindex', '0');
									input.setAttribute('contenteditable', 'false');

									// Apply critical styles with maximum priority
									const criticalStyles = [
										['pointer-events', 'auto'],
										['cursor', 'text'],
										['z-index', '10002'],
										['position', 'relative'],
										['background-color', 'white'],
										['border', '1px solid #ccc'],
										['padding', '8px 12px'],
										['font-size', '14px'],
										['line-height', '1.4'],
										['color', '#333'],
										['width', '100%'],
										['box-sizing', 'border-box'],
										['user-select', 'text'],
										['-webkit-user-select', 'text'],
										['-moz-user-select', 'text'],
										['display', 'block'],
										['visibility', 'visible'],
										['opacity', '1'],
										['outline', 'none'],
										['border-radius', '4px'],
										['transition', 'border-color 0.2s, box-shadow 0.2s'],
									];

									criticalStyles.forEach(([property, value]) => {
										input.style.setProperty(property, value, 'important');
									});

									// Force enable interactivity
									input.disabled = false;
									input.readOnly = false;

									// Enhanced event handling
									const enhanceInput = (inputEl: any) => {
										// Remove existing event listeners by cloning
										const newInput = inputEl.cloneNode(true);
										if (inputEl.parentNode) {
											inputEl.parentNode.replaceChild(newInput, inputEl);
										}

										// Add comprehensive event listeners
										[
											'mousedown',
											'mouseup',
											'click',
											'focus',
											'blur',
											'keydown',
											'keyup',
											'input',
											'change',
										].forEach((eventType) => {
											newInput.addEventListener(
												eventType,
												(e: Event) => {
													e.stopPropagation();

													if (
														eventType === 'click' ||
														eventType === 'mousedown'
													) {
														console.log(`🖱️ Input ${index + 1} ${eventType}`);
														setTimeout(() => newInput.focus(), 10);
													}

													if (eventType === 'focus') {
														console.log(`✅ Input ${index + 1} focused`);
														newInput.style.setProperty(
															'border-color',
															'#3b82f6',
															'important'
														);
														newInput.style.setProperty(
															'box-shadow',
															'0 0 0 2px rgba(59, 130, 246, 0.2)',
															'important'
														);
													}

													if (eventType === 'blur') {
														newInput.style.setProperty(
															'border-color',
															'#ccc',
															'important'
														);
														newInput.style.setProperty(
															'box-shadow',
															'none',
															'important'
														);
													}

													if (
														eventType === 'keydown' ||
														eventType === 'input'
													) {
														console.log(
															`⌨️ Input ${index + 1} ${eventType}:`,
															(e as any).key || 'input'
														);
													}
												},
												{ passive: false }
											);
										});

										return newInput;
									};

									enhanceInput(input);
								});

								// Fix dialog buttons
								buttons.forEach((button: any) => {
									[
										['pointer-events', 'auto'],
										['cursor', 'pointer'],
										['z-index', '10002'],
										['position', 'relative'],
									].forEach(([prop, val]) => {
										button.style.setProperty(prop, val, 'important');
									});
								});
							};

							// Apply fixes with multiple strategies
							forceFixDialogs();

							// Watch for new dialogs with MutationObserver
							const dialogObserver = new MutationObserver((mutations) => {
								let shouldFix = false;
								mutations.forEach((mutation) => {
									if (mutation.type === 'childList') {
										mutation.addedNodes.forEach((node: any) => {
											if (node.nodeType === Node.ELEMENT_NODE) {
												if (
													node.classList?.contains('tox-dialog') ||
													node.classList?.contains('tox-dialog-wrap') ||
													node.querySelector?.('.tox-dialog')
												) {
													shouldFix = true;
												}
											}
										});
									}
								});

								if (shouldFix) {
									setTimeout(forceFixDialogs, 50);
								}
							});

							dialogObserver.observe(document.body, {
								childList: true,
								subtree: true,
							});

							// Also fix dialogs periodically for extra safety
							const dialogFixInterval = setInterval(forceFixDialogs, 500);

							// Clean up on editor destruction
							editor.on('remove', () => {
								dialogObserver.disconnect();
								clearInterval(dialogFixInterval);
							});
						};

						// Start dialog fixes after a brief delay
						setTimeout(setupDialogFixes, 200);
					},

					placeholder: placeholder,

					setup: (editor: any) => {
						editor.on('init', () => {
							editor.setContent(value || '');
							console.log('✅ TinyMCE loaded successfully with API key');
						});

						editor.on('Change KeyUp', () => {
							const content = editor.getContent();
							onChange(content);
						});

						// Shortcut untuk formatting cepat
						editor.addShortcut('meta+b', 'Bold', () => {
							editor.execCommand('Bold');
						});

						editor.addShortcut('meta+i', 'Italic', () => {
							editor.execCommand('Italic');
						});

						editor.addShortcut('meta+u', 'Underline', () => {
							editor.execCommand('Underline');
						});

						// Auto-formatting seperti di Google Docs (simplified)
						editor.on('keydown', (e: KeyboardEvent) => {
							if (e.key === ' ') {
								const content = editor.getContent({ format: 'text' });
								const lines = content.split('\n');
								const currentLine = lines[lines.length - 1];

								// Auto bullet list
								if (currentLine.trim() === '-' || currentLine.trim() === '*') {
									e.preventDefault();
									editor.execCommand('InsertUnorderedList');
								}

								// Auto numbered list
								if (
									currentLine.trim() === '1.' ||
									currentLine.trim() === '1)'
								) {
									e.preventDefault();
									editor.execCommand('InsertOrderedList');
								}
							}
						});
					},

					// Mobile responsive
					mobile: {
						toolbar_mode: 'sliding',
					},

					// Performance optimizations
					cache_suffix: '?v=6.8.0',

					// Prevent conflicts
					convert_urls: false,
					remove_script_host: false,

					// Fix potential issues
					browser_spellcheck: true,
					contextmenu: false,
				});
			}
		};

		loadTinyMCE();

		return () => {
			if ((window as any).tinymce && editorRef.current) {
				(window as any).tinymce.remove(editorRef.current);
			}
		};
	}, [articleId]); // Add articleId to dependency array

	// Update content when value prop changes
	useEffect(() => {
		if ((window as any).tinymce && editorRef.current) {
			const editor = (window as any).tinymce.get(editorRef.current.id);
			if (editor && editor.getContent() !== value) {
				editor.setContent(value || '');
			}
		}
	}, [value]);

	return (
		<div className="rich-text-editor">
			{/* Container dengan z-index yang tepat */}
			<div
				className="tinymce-container"
				style={{
					position: 'relative',
					zIndex: 1,
					isolation: 'isolate', // CSS containment
				}}>
				<div
					ref={editorRef}
					id={`tinymce-editor-${Math.random().toString(36).substr(2, 9)}`}
					style={{
						minHeight: `${height}px`,
						position: 'relative',
					}}
				/>
			</div>

			{/* API Key Status & Shortcuts help */}
			<div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
				<div className="mb-1">
					<strong>🔑 API Status:</strong>
					<span className="ml-1">
						{import.meta.env.VITE_TINYMCE_API_KEY ? (
							<span className="text-green-600">✅ Connected</span>
						) : (
							<span className="text-red-600">❌ No API Key</span>
						)}
					</span>
				</div>

				{/* Debug Test Button */}
				<div className="mb-2">
					<button
						onClick={() => {
							const toolbar = document.querySelector('.tox-toolbar');
							const buttons = document.querySelectorAll('.tox-tbtn');
							const dialogs = document.querySelectorAll('.tox-dialog');
							const inputs = document.querySelectorAll(
								'.tox-dialog input, .tox-textfield'
							);

							console.clear();
							console.log('🔍 TinyMCE Debug Test:');
							console.log('- Toolbar exists:', !!toolbar);
							console.log('- Button count:', buttons.length);
							console.log('- Active dialogs:', dialogs.length);
							console.log('- Dialog inputs:', inputs.length);

							if (toolbar) {
								console.log(
									'- Toolbar z-index:',
									getComputedStyle(toolbar).zIndex
								);
								console.log(
									'- Toolbar position:',
									getComputedStyle(toolbar).position
								);
							}

							buttons.forEach((btn, i) => {
								const style = getComputedStyle(btn);
								console.log(
									`- Button ${i + 1}: pointer-events=${
										style.pointerEvents
									}, cursor=${style.cursor}`
								);
							});

							// Test dialog inputs if any exist
							if (inputs.length > 0) {
								console.log('📝 Dialog Input Tests:');
								inputs.forEach((input: any, i) => {
									const style = getComputedStyle(input);
									console.log(
										`- Input ${i + 1}: pointer-events=${
											style.pointerEvents
										}, z-index=${style.zIndex}`
									);
									console.log(
										`  cursor=${style.cursor}, background=${style.background}`
									);
									console.log(
										`  readonly=${input.readOnly}, disabled=${input.disabled}`
									);

									// Try to focus the input
									try {
										input.focus();
										console.log(`  ✅ Input ${i + 1} can be focused`);
									} catch (e) {
										console.log(`  ❌ Input ${i + 1} focus failed:`, e);
									}
								});
							}

							alert(
								'Debug info logged to console! Check browser console (F12). If you see dialogs open, test the inputs now.'
							);
						}}
						className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 mr-2">
						🔍 Debug Toolbar
					</button>

					<button
						onClick={() => {
							// Comprehensive dialog fix for testing
							const dialogs = document.querySelectorAll('.tox-dialog');
							const inputs = document.querySelectorAll(`
								.tox-dialog input[type="text"],
								.tox-dialog input[type="url"],
								.tox-dialog input[type="email"],
								.tox-dialog textarea,
								.tox-textfield,
								.tox-textarea,
								.tox-dialog .tox-textfield,
								.tox-dialog .tox-textarea
							`);
							const buttons = document.querySelectorAll(
								'.tox-dialog .tox-button'
							);

							console.log('🔧 Applying comprehensive dialog fixes...');

							// Fix input fields
							inputs.forEach((input: any, index) => {
								// Remove all restrictions
								input.removeAttribute('readonly');
								input.removeAttribute('disabled');
								input.removeAttribute('aria-disabled');
								input.disabled = false;
								input.readOnly = false;

								// Apply critical styles
								const criticalStyles = [
									['pointer-events', 'auto'],
									['cursor', 'text'],
									['z-index', '10002'],
									['background-color', 'white'],
									['border', '1px solid #ccc'],
									['padding', '8px 12px'],
									['font-size', '14px'],
									['color', '#333'],
									['width', '100%'],
									['box-sizing', 'border-box'],
									['border-radius', '4px'],
									['opacity', '1'],
									['visibility', 'visible'],
								];

								criticalStyles.forEach(([prop, val]) => {
									input.style.setProperty(prop, val, 'important');
								});

								input.setAttribute('tabindex', '0');

								// Test input functionality
								input.addEventListener('click', (e: Event) => {
									e.stopPropagation();
									console.log(
										`✅ Input ${index + 1} clicked - attempting focus`
									);
									setTimeout(() => {
										input.focus();
										input.style.setProperty(
											'border-color',
											'#3b82f6',
											'important'
										);
									}, 10);
								});

								input.addEventListener('focus', () => {
									console.log(`🎯 Input ${index + 1} successfully focused!`);
									input.style.setProperty(
										'border-color',
										'#3b82f6',
										'important'
									);
									input.style.setProperty(
										'box-shadow',
										'0 0 0 2px rgba(59, 130, 246, 0.2)',
										'important'
									);
								});

								input.addEventListener('input', () => {
									console.log(
										`📝 Input ${index + 1} value changed:`,
										input.value
									);
								});
							});

							// Fix buttons
							buttons.forEach((button: any) => {
								[
									['pointer-events', 'auto'],
									['cursor', 'pointer'],
									['z-index', '10002'],
								].forEach(([prop, val]) => {
									button.style.setProperty(prop, val, 'important');
								});
							});

							// Test dialog interaction
							if (dialogs.length > 0) {
								console.log(
									`✅ Fixed ${dialogs.length} dialogs with ${inputs.length} inputs and ${buttons.length} buttons`
								);

								// Try to focus the first input for testing
								if (inputs.length > 0) {
									setTimeout(() => {
										const firstInput = inputs[0] as HTMLInputElement;
										firstInput.focus();
										console.log(
											'🔍 Attempting to focus first input for testing...'
										);
									}, 100);
								}

								alert(
									`✅ Dialog Fix Applied!\n\nFixed: ${inputs.length} input field(s) and ${buttons.length} button(s)\n\nSekarang coba:\n1. Klik input field di dialog\n2. Ketik text\n3. Lihat console (F12) untuk log interaksi\n\nJika masih tidak bisa, tutup dialog dan buka lagi.`
								);
							} else {
								alert(
									'❌ Tidak ada dialog yang terbuka!\n\nUntuk test:\n1. Klik tombol Link atau Image di toolbar\n2. Tunggu dialog muncul\n3. Klik tombol "Fix Dialogs" ini lagi\n4. Coba gunakan input field di dialog'
								);
							}
						}}
						className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">
						🔧 Fix Dialogs
					</button>
				</div>

				<strong>💡 Shortcuts:</strong>
				<span className="ml-2">
					<kbd>Ctrl+B</kbd> Bold •<kbd>Ctrl+I</kbd> Italic •<kbd>Ctrl+U</kbd>{' '}
					Underline •<kbd>-</kbd>+<kbd>Space</kbd> Bullet List •<kbd>1.</kbd>+
					<kbd>Space</kbd> Numbered List
				</span>
			</div>

			{/* Enhanced CSS Override untuk fix conflicts */}
			<style>{`
				/* TinyMCE Z-index fixes */
				.tox-tinymce {
					z-index: 1 !important;
				}

				.tox-toolbar {
					z-index: 1000 !important;
					position: relative !important;
				}

				.tox-menubar {
					z-index: 1000 !important;
					position: relative !important;
				}

				.tox-collection {
					z-index: 10000 !important;
				}

				.tox-dialog {
					z-index: 10001 !important;
				}

				.tox-dialog-wrap {
					z-index: 10001 !important;
				}

				/* CRITICAL: Maximum priority input field fixes */
				.tox-dialog input[type="text"],
				.tox-dialog input[type="url"],
				.tox-dialog input[type="email"],
				.tox-dialog textarea,
				.tox-textfield,
				.tox-textarea,
				.tox-dialog .tox-textfield,
				.tox-dialog .tox-textarea {
					pointer-events: auto !important;
					cursor: text !important;
					background-color: white !important;
					border: 1px solid #ccc !important;
					padding: 8px 12px !important;
					font-size: 14px !important;
					line-height: 1.4 !important;
					color: #333 !important;
					z-index: 10002 !important;
					position: relative !important;
					user-select: text !important;
					-webkit-user-select: text !important;
					-moz-user-select: text !important;
					width: 100% !important;
					box-sizing: border-box !important;
					display: block !important;
					visibility: visible !important;
					opacity: 1 !important;
					border-radius: 4px !important;
					transition: border-color 0.2s, box-shadow 0.2s !important;
				}

				/* Remove disabled state styling */
				.tox-dialog input[type="text"]:disabled,
				.tox-dialog input[type="url"]:disabled,
				.tox-dialog input[type="email"]:disabled,
				.tox-dialog textarea:disabled,
				.tox-textfield:disabled,
				.tox-textarea:disabled,
				.tox-dialog .tox-textfield:disabled,
				.tox-dialog .tox-textarea:disabled {
					pointer-events: auto !important;
					cursor: text !important;
					background-color: white !important;
					opacity: 1 !important;
				}

				/* Remove readonly state styling */
				.tox-dialog input[type="text"][readonly],
				.tox-dialog input[type="url"][readonly],
				.tox-dialog input[type="email"][readonly],
				.tox-dialog textarea[readonly],
				.tox-textfield[readonly],
				.tox-textarea[readonly],
				.tox-dialog .tox-textfield[readonly],
				.tox-dialog .tox-textarea[readonly] {
					pointer-events: auto !important;
					cursor: text !important;
					background-color: white !important;
				}

				/* Focus state styling */
				.tox-dialog input[type="text"]:focus,
				.tox-dialog input[type="url"]:focus,
				.tox-dialog input[type="email"]:focus,
				.tox-dialog textarea:focus,
				.tox-textfield:focus,
				.tox-textarea:focus,
				.tox-dialog .tox-textfield:focus,
				.tox-dialog .tox-textarea:focus {
					outline: none !important;
					border-color: #3b82f6 !important;
					box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
				}

				/* Prevent toolbar button conflicts */
				.tox-tbtn {
					pointer-events: auto !important;
				}

				.tox-tbtn:hover {
					background-color: #e8e8e8 !important;
				}

				/* Fix dropdown menus */
				.tox-collection__item {
					pointer-events: auto !important;
				}

				.tox-collection__item:hover {
					background-color: #e8e8e8 !important;
				}

				/* Ensure proper isolation */
				.tinymce-container {
					isolation: isolate;
				}

				/* Force remove any pointer-events: none on inputs */
				.tox-dialog input[readonly],
				.tox-dialog input[disabled] {
					pointer-events: auto !important;
					background: white !important;
					cursor: text !important;
				}
			`}</style>
		</div>
	);
}
