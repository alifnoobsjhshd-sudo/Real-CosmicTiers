import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { setAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/components/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:    "You cancelled the Discord login. Try again whenever you're ready.",
  token_exchange:  "Couldn't complete the login with Discord. Please try again.",
  user_fetch:      "Couldn't retrieve your Discord profile. Please try again.",
  not_in_server:   "You need to be a member of the CosmicTiers Discord server to register.",
  server_error:    "Something went wrong on our end. Please try again in a moment.",
};

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { refetch } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    const token = params.get("token");
    const needsRegistration = params.get("needs_registration") === "1";

    if (error) {
      setErrorMsg(ERROR_MESSAGES[error] ?? "An unexpected error occurred. Please try again.");
      return;
    }

    if (token) {
      setAuthToken(token);
      refetch().then(() => {
        if (needsRegistration) {
          navigate("/?register=1", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      });
    } else {
      navigate("/", { replace: true });
    }
  }, []);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <h2 className="text-white font-bold text-lg">Login Failed</h2>
          <p className="text-white/60 text-sm">{errorMsg}</p>
          <Button
            onClick={() => navigate("/", { replace: true })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white mt-2"
            data-testid="button-back-home"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-white/70">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
