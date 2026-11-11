/**
 * AuthContext — provides login/register/logout state to the whole app.
 * JWT token is persisted in localStorage under "audit_v_token".
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGetMe, apiLogin, apiRegister, type UserOut } from "../services/authApi";

const TOKEN_KEY = "audit_v_token";

interface AuthContextValue {
  user: UserOut | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    email: string;
    full_name?: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount (or when token changes), fetch the current user profile or auto-authenticate
  useEffect(() => {
    if (!token) {
      const isExplicitLogout = sessionStorage.getItem("audit_v_logged_out");
      if (isExplicitLogout) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      apiLogin("testuser1", "PassWord123@")
        .then((data) => {
          localStorage.setItem(TOKEN_KEY, data.access_token);
          setToken(data.access_token);
        })
        .catch(() => {
          setUser(null);
          setIsLoading(false);
        });
      return;
    }
    setIsLoading(true);
    apiGetMe()
      .then(setUser)
      .catch(() => {
        // Token invalid/expired — clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    sessionStorage.removeItem("audit_v_logged_out");
    const data = await apiLogin(username, password);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
  }, []);

  const register = useCallback(
    async (payload: { username: string; email: string; full_name?: string; password: string }) => {
      sessionStorage.removeItem("audit_v_logged_out");
      const data = await apiRegister(payload);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
    },
    []
  );

  const logout = useCallback(() => {
    sessionStorage.setItem("audit_v_logged_out", "true");
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
