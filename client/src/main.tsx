import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/error-boundary";
import { installGlobalErrorMonitor } from "./lib/error-monitor";
import { installStaleChunkReload } from "./lib/stale-chunk-reload";

// Pasang pemantau error global (window.onerror + unhandledrejection).
installGlobalErrorMonitor();
// Versi lama setelah deploy → muat ulang sekali (bukan error 500)
installStaleChunkReload();

createRoot(document.getElementById("root")!).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
