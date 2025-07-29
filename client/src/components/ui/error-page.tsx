import {
	AlertTriangle,
	ArrowLeft,
	Ban,
	Clock,
	Home,
	RefreshCw,
	Shield,
	Wifi,
	WifiOff,
	XCircle,
	Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface ErrorPageProps {
	error: {
		code: number;
		title: string;
		message: string;
		timestamp: string;
		details?: {
			reason?: string;
			path?: string;
			method?: string;
			ip?: string;
			deviceId?: string;
			retryAfter?: number;
			limit?: number;
			window?: string;
			maxConnections?: number;
			maxAttempts?: number;
			maxUploads?: number;
		};
		help?: string;
	};
	onRetry?: () => void;
}

export function ErrorPage({ error, onRetry }: ErrorPageProps) {
	const [, navigate] = useLocation();
	const [timeLeft, setTimeLeft] = useState<number>(
		error.details?.retryAfter || 0
	);

	// Countdown timer untuk rate limit - PERBAIKAN: Real-time countdown
	useEffect(() => {
		if (error.details?.retryAfter && error.details.retryAfter > 0) {
			// Set initial time
			setTimeLeft(error.details.retryAfter);

			const timer = setInterval(() => {
				setTimeLeft((prev) => {
					if (prev <= 1) {
						clearInterval(timer);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => clearInterval(timer);
		}
	}, [error.details?.retryAfter]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const getErrorIcon = () => {
		switch (error.code) {
			case 403:
				return (
					<div className="relative">
						<Ban className="h-20 w-20 text-red-500 animate-pulse" />
						<Shield className="h-8 w-8 text-red-600 absolute -top-2 -right-2 animate-bounce" />
					</div>
				);
			case 429:
				return (
					<div className="relative">
						<Clock className="h-20 w-20 text-orange-500 animate-bounce" />
						<Zap className="h-8 w-8 text-orange-600 absolute -top-2 -right-2 animate-pulse" />
					</div>
				);
			case 503:
				return (
					<div className="relative">
						<WifiOff className="h-20 w-20 text-blue-500 animate-spin" />
						<Wifi className="h-8 w-8 text-blue-600 absolute -top-2 -right-2 animate-ping" />
					</div>
				);
			default:
				return (
					<div className="relative">
						<AlertTriangle className="h-20 w-20 text-yellow-500 animate-pulse" />
						<XCircle className="h-8 w-8 text-yellow-600 absolute -top-2 -right-2 animate-bounce" />
					</div>
				);
		}
	};

	const getErrorColor = () => {
		switch (error.code) {
			case 403:
				return 'border-red-200 bg-gradient-to-br from-red-50 to-red-100';
			case 429:
				return 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100';
			case 503:
				return 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100';
			default:
				return 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100';
		}
	};

	const getBadgeColor = () => {
		switch (error.code) {
			case 403:
				return 'bg-red-100 text-red-800 border-red-300';
			case 429:
				return 'bg-orange-100 text-orange-800 border-orange-300';
			case 503:
				return 'bg-blue-100 text-blue-800 border-blue-300';
			default:
				return 'bg-yellow-100 text-yellow-800 border-yellow-300';
		}
	};

	const getWarningMessage = () => {
		switch (error.code) {
			case 403:
				return '🚨 SUSPICIOUS ACTIVITY DETECTED! 🚨';
			case 429:
				return '⏰ TOO MANY REQUESTS! ⏰';
			case 503:
				return '🔄 SERVICE TEMPORARILY UNAVAILABLE! 🔄';
			default:
				return '⚠️ AN ERROR OCCURRED! ⚠️';
		}
	};

	const getSubWarningMessage = () => {
		switch (error.code) {
			case 403:
				return 'Our security system detected suspicious activity from your device.';
			case 429:
				return 'You have exceeded the maximum allowed request limit.';
			case 503:
				return 'The server is experiencing high load. Please try again later.';
			default:
				return 'An unexpected error occurred. Please try again.';
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-4">
			<Card
				className={`w-full max-w-3xl shadow-2xl ${getErrorColor()} border-2`}>
				<CardHeader className="text-center pb-6">
					<div className="flex justify-center mb-6">{getErrorIcon()}</div>

					{/* Warning Message dengan animasi */}
					<div className="mb-6 p-4 bg-white/80 rounded-xl border-2 border-dashed border-orange-400 shadow-lg animate-pulse">
						<p className="text-xl font-bold text-orange-800 mb-2">
							{getWarningMessage()}
						</p>
						<p className="text-sm text-orange-700">{getSubWarningMessage()}</p>
					</div>

					<div className="flex items-center justify-center gap-3 mb-3">
						<Badge
							className={`${getBadgeColor()} border-2 px-4 py-2 text-lg font-bold`}>
							Error {error.code}
						</Badge>
						{error.details?.retryAfter && timeLeft > 0 && (
							<Badge
								variant="outline"
								className="border-orange-400 text-orange-800 bg-orange-50 px-4 py-2 text-lg font-bold animate-pulse">
								⏱️ {formatTime(timeLeft)} remaining
							</Badge>
						)}
					</div>
					<CardTitle className="text-3xl font-bold text-gray-900 mb-3">
						{error.title}
					</CardTitle>
					<p className="text-gray-600 text-lg">{error.message}</p>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Error Details dengan styling yang lebih menarik */}
					{error.details && (
						<div className="bg-white/70 rounded-xl p-6 border-2 border-gray-300 shadow-lg">
							<h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
								<AlertTriangle className="h-5 w-5 text-orange-500" />
								📋 Error Details
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
								{error.details.reason && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											🔍 Reason:
										</span>
										<p className="text-gray-600 break-words mt-1">
											{error.details.reason}
										</p>
									</div>
								)}
								{error.details.path && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											📍 Path:
										</span>
										<p className="text-gray-600 font-mono mt-1">
											{error.details.path}
										</p>
									</div>
								)}
								{error.details.method && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											⚡ Method:
										</span>
										<p className="text-gray-600 mt-1">{error.details.method}</p>
									</div>
								)}
								{error.details.limit && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											📊 Limit:
										</span>
										<p className="text-gray-600 mt-1">
											{error.details.limit} requests per {error.details.window}
										</p>
									</div>
								)}
								{error.details.maxAttempts && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											🔐 Max Attempts:
										</span>
										<p className="text-gray-600 mt-1">
											{error.details.maxAttempts} attempts per minute
										</p>
									</div>
								)}
								{error.details.maxConnections && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											🌐 Max Connections:
										</span>
										<p className="text-gray-600 mt-1">
											{error.details.maxConnections} concurrent connections
										</p>
									</div>
								)}
								{error.details.ip && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											🌍 IP Address:
										</span>
										<p className="text-gray-600 font-mono mt-1">
											{error.details.ip}
										</p>
									</div>
								)}
								{error.details.deviceId && (
									<div className="bg-gray-50 p-3 rounded-lg border">
										<span className="font-semibold text-gray-700">
											📱 Device ID:
										</span>
										<p className="text-gray-600 font-mono text-xs mt-1">
											{error.details.deviceId}
										</p>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Help Text dengan styling yang lebih menarik */}
					{error.help && (
						<div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-4 shadow-lg">
							<p className="text-blue-800 text-sm font-medium">
								💡 {error.help}
							</p>
						</div>
					)}

					{/* Action Buttons dengan styling yang lebih menarik */}
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						{onRetry && timeLeft === 0 && (
							<Button
								onClick={onRetry}
								className="flex items-center gap-2 px-6 py-3 text-lg font-bold"
								variant="default">
								<RefreshCw className="h-5 w-5" />
								🔄 Try Again
							</Button>
						)}

						<Button
							onClick={() => navigate('/')}
							variant="outline"
							className="flex items-center gap-2 px-6 py-3 text-lg font-bold border-2">
							<Home className="h-5 w-5" />
							🏠 Go Home
						</Button>

						<Button
							onClick={() => window.history.back()}
							variant="ghost"
							className="flex items-center gap-2 px-6 py-3 text-lg font-bold">
							<ArrowLeft className="h-5 w-5" />
							⬅️ Go Back
						</Button>
					</div>

					{/* Rate Limit Countdown dengan animasi yang lebih menarik */}
					{error.details?.retryAfter && timeLeft > 0 && (
						<div className="text-center">
							<div className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 px-8 py-4 rounded-full border-2 border-orange-400 shadow-lg animate-pulse">
								<Clock className="h-6 w-6 animate-spin" />
								<span className="text-xl font-bold">
									⏰ You can try again in {formatTime(timeLeft)}
								</span>
								<Clock className="h-6 w-6 animate-spin" />
							</div>
						</div>
					)}

					{/* Timestamp dengan styling yang lebih menarik */}
					<div className="text-center text-sm text-gray-500 bg-gray-100 p-3 rounded-lg">
						🕐 Error occurred at:{' '}
						{new Date(error.timestamp).toLocaleString('en-US')}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
