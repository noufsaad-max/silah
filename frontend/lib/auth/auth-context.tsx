"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { ApiError } from "@/lib/api-client/client";
import { fetchMe, loginRequest, registerRequest, type MeResponse } from "@/lib/api-client/auth";

const TOKEN_KEY = "silah_token";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  phone: string | null;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  locale: string;
  industry: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
}

type AuthResult = { ok: true } | { ok: false; error: string };

interface RegisterPayload {
  workspaceName: string;
  name: string;
  email: string;
  password: string;
  locale?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (payload: RegisterPayload) => Promise<AuthResult>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function splitMeResponse(me: MeResponse) {
  const user: AuthUser = {
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    jobTitle: me.job_title,
    phone: me.phone,
  };
  const workspace: AuthWorkspace = {
    id: me.workspace.id,
    name: me.workspace.name,
    locale: me.workspace.locale,
    industry: me.workspace.industry,
    website: me.workspace.website,
    country: me.workspace.country,
    city: me.workspace.city,
    description: me.workspace.description,
  };
  return { user, workspace };
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // On load, a token in localStorage is only a *claim* -- always confirm it
  // against /me before treating the person as signed in, since it may have
  // expired or the account may no longer exist.
  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsHydrated(true);
      return;
    }
    fetchMe(stored)
      .then((me) => {
        setToken(stored);
        const split = splitMeResponse(me);
        setUser(split.user);
        setWorkspace(split.workspace);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsHydrated(true));
  }, []);

  async function applyToken(newToken: string) {
    const me = await fetchMe(newToken);
    window.localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    const split = splitMeResponse(me);
    setUser(split.user);
    setWorkspace(split.workspace);
  }

  async function login(email: string, password: string): Promise<AuthResult> {
    try {
      const { access_token } = await loginRequest(email, password);
      await applyToken(access_token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }

  async function register(payload: RegisterPayload): Promise<AuthResult> {
    try {
      const { access_token } = await registerRequest({
        workspace_name: payload.workspaceName,
        name: payload.name,
        email: payload.email,
        password: payload.password,
        locale: payload.locale ?? "en",
      });
      await applyToken(access_token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }

  async function refreshMe() {
    if (!token) return;
    const me = await fetchMe(token);
    const split = splitMeResponse(me);
    setUser(split.user);
    setWorkspace(split.workspace);
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setWorkspace(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        token,
        isAuthenticated: !!token && !!user,
        isHydrated,
        login,
        register,
        refreshMe,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
