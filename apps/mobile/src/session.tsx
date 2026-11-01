import type { LoginInput, MeDto, RegisterInput } from '@kleps/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, getRefreshToken, loadStoredTokens, setSignedOutHandler, storeTokens } from './api';

interface Session {
  user: MeDto | null;
  ready: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: MeDto | null) => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      if (await loadStoredTokens()) {
        setUser(await api.auth.me().catch(() => null));
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const auth = await api.auth.login(input);
    await storeTokens(auth);
    setUser(auth.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const auth = await api.auth.register(input);
    await storeTokens(auth);
    setUser(auth.user);
  }, []);

  const logout = useCallback(async () => {
    const token = await getRefreshToken();
    if (token) await api.auth.logout(token).catch(() => undefined);
    await clearTokens();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
