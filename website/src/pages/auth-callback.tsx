import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { setAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/components/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { refetch } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (token) {
      setAuthToken(token);
      refetch().then(() => navigate("/", { replace: true }));
    } else {
      navigate("/", { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-white/70">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
