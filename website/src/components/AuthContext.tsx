import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@shared/schema";
import { getAuthToken, clearAuthToken } from "@/lib/queryClient";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refetch: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = getAuthToken();
    if (!token) { setUser(null); setIsLoading(false); return; }
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string) ?? "";
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { clearAuthToken(); setUser(null); }
      else if (res.ok) setUser(await res.json());
    } catch { /* ignore network errors */ }
    setIsLoading(false);
  }, []);

  useEffect(() => { void fetchMe(); }, [fetchMe]);

  const logout = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      const apiBase = (import.meta.env.VITE_API_URL as string) ?? "";
      try {
        await fetch(`${apiBase}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    clearAuthToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch: fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
