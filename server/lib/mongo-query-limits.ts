/** Batas waktu query mongoose agar slot DB tidak terikat lama saat overload (ms). */
export const MONGO_QUERY_MAX_TIME_MS = Math.min(
	60_000,
	Math.max(
		500,
		(() => {
			const v = parseInt(process.env.MONGO_QUERY_MAX_TIME_MS || '', 10);
			return Number.isFinite(v) && v > 0 ? v : 8000;
		})(),
	),
);
