import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate("/");
    }, 5000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground dark:bg-slate-950 dark:text-slate-100">
      <Card className="w-full max-w-md mx-4 bg-card text-card-foreground dark:bg-slate-900 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground dark:text-slate-50">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground dark:text-slate-300">
            Halaman yang kamu cari tidak ditemukan.
          </p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">
            Kamu akan diarahkan ke beranda dalam 5 detik.
          </p>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-colors"
          >
            Kembali ke Beranda sekarang
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
