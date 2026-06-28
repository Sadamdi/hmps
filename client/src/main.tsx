import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/error-boundary";
import { installGlobalErrorMonitor } from "./lib/error-monitor";

// Pasang pemantau error global (window.onerror + unhandledrejection).
installGlobalErrorMonitor();

createRoot(document.getElementById("root")!).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
