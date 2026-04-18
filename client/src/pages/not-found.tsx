import { PageBreadcrumb } from "@/components/public/page-breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground dark:bg-slate-950 dark:text-slate-100 px-4">
      <PageBreadcrumb
        className="mb-6 self-stretch max-w-md mx-auto w-full"
        items={[{ label: "Beranda", href: "/" }, { label: "Halaman tidak ditemukan" }]}
      />
      <Card className="w-full max-w-md mx-auto bg-card text-card-foreground dark:bg-slate-900/90 dark:border-slate-700/80 shadow-lg">
        <CardContent className="pt-6 pb-5">
          <div className="flex mb-3 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-slate-50">
                404 Page Not Found
              </h1>
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                Sepertinya kamu nyasar halaman.
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm text-muted-foreground dark:text-slate-300">
            Kamu akan diarahkan otomatis ke beranda dalam{" "}
            <span className="font-semibold text-primary">{secondsLeft}</span>{" "}
            detik.
          </p>

          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 5) * 100}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-colors w-full"
          >
            Ke beranda sekarang
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
