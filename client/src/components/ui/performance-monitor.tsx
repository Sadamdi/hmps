import { useEffect, useState } from "react";

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  memoryUsage?: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  useEffect(() => {
    const measurePerformance = () => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType("paint");

      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      const domContentLoaded =
        navigation.domContentLoadedEventEnd -
        navigation.domContentLoadedEventStart;

      const fcp = paint.find(
        (entry) => entry.name === "first-contentful-paint"
      );
      const firstContentfulPaint = fcp ? fcp.startTime : 0;

      // Get LCP if available
      let largestContentfulPaint = 0;
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          largestContentfulPaint = lastEntry.startTime;
        });
        observer.observe({ entryTypes: ["largest-contentful-paint"] });
      }

      // Get memory usage if available
      const memoryUsage = (performance as any).memory?.usedJSHeapSize;

      setMetrics({
        loadTime,
        domContentLoaded,
        firstContentfulPaint,
        largestContentfulPaint,
        memoryUsage,
      });
    };

    // Wait for page to fully load
    if (document.readyState === "complete") {
      measurePerformance();
    } else {
      window.addEventListener("load", measurePerformance);
      return () => window.removeEventListener("load", measurePerformance);
    }
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowMetrics(!showMetrics)}
        className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-blue-600 transition-colors"
      >
        📊 Performance
      </button>

      {showMetrics && (
        <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-[300px] text-sm">
          <h3 className="font-semibold mb-3 text-gray-800">
            Performance Metrics
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Load Time:</span>
              <span
                className={`font-medium ${
                  metrics.loadTime > 3000
                    ? "text-red-600"
                    : metrics.loadTime > 1000
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {metrics.loadTime.toFixed(0)}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">DOM Content Loaded:</span>
              <span
                className={`font-medium ${
                  metrics.domContentLoaded > 2000
                    ? "text-red-600"
                    : metrics.domContentLoaded > 800
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {metrics.domContentLoaded.toFixed(0)}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">First Contentful Paint:</span>
              <span
                className={`font-medium ${
                  metrics.firstContentfulPaint > 2500
                    ? "text-red-600"
                    : metrics.firstContentfulPaint > 1500
                    ? "text-yellow-600"
                    : "text-green-600"
                }`}
              >
                {metrics.firstContentfulPaint.toFixed(0)}ms
              </span>
            </div>

            {metrics.largestContentfulPaint > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Largest Contentful Paint:</span>
                <span
                  className={`font-medium ${
                    metrics.largestContentfulPaint > 4000
                      ? "text-red-600"
                      : metrics.largestContentfulPaint > 2500
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {metrics.largestContentfulPaint.toFixed(0)}ms
                </span>
              </div>
            )}

            {metrics.memoryUsage && (
              <div className="flex justify-between">
                <span className="text-gray-600">Memory Usage:</span>
                <span className="font-medium text-blue-600">
                  {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div className="mb-1">
                <span className="text-green-600">●</span> Good
                <span className="text-yellow-600 ml-2">●</span> Needs
                Improvement
                <span className="text-red-600 ml-2">●</span> Poor
              </div>
              <div>Refresh page to update metrics</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
