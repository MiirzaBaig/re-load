"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface Workspace {
  storeId: string;
  storeName: string;
  role: "owner" | "admin" | "member";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;
  configured: boolean;
  workspaceError: boolean;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const [workspaceError, setWorkspaceError] = useState(false);
  const currentUser = useRef<string | null | undefined>(undefined);
  const requestVersion = useRef(0);

  const loadWorkspace = useCallback(async (userId: string) => {
    if (!supabase || currentUser.current !== userId) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setWorkspaceError(false);
    try {
      const { data, error } = await supabase
        .from("memberships")
        .select("store_id, role, stores(name)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) throw error;
      const relation = data?.stores as unknown as { name?: string } | null;
      setWorkspace(data ? {
        storeId: data.store_id as string,
        storeName: relation?.name ?? "My Store",
        role: data.role as Workspace["role"],
      } : null);
    } catch {
      if (version === requestVersion.current) setWorkspaceError(true);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      const userId = nextSession?.user.id ?? null;
      // Token refreshes and tab focus must not restart an ongoing store lookup.
      if (currentUser.current === userId) return;
      currentUser.current = userId;
      ++requestVersion.current;
      setWorkspace(null);
      setWorkspaceError(false);
      setLoading(Boolean(userId));
      if (userId) {
        // Keep database calls outside Supabase's auth callback lock.
        setTimeout(() => {
          if (active && currentUser.current === userId) void loadWorkspace(userId);
        }, 0);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data, error }: { data: { session: Session | null }; error: unknown }) => {
      // A newer auth event takes precedence over the initial session snapshot.
      if (!active || receivedAuthEvent) return;
      if (error) {
        setWorkspaceError(true);
        setLoading(false);
      } else applySession(data.session);
    }).catch(() => {
      if (active && !receivedAuthEvent) {
        setWorkspaceError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      ++requestVersion.current;
      currentUser.current = undefined;
      subscription.unsubscribe();
    };
  }, [loadWorkspace]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    workspace,
    loading,
    workspaceError,
    configured: isSupabaseConfigured,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
    refreshWorkspace: async () => {
      if (session) await loadWorkspace(session.user.id);
      else if (supabase) {
        const version = ++requestVersion.current;
        setLoading(true);
        setWorkspaceError(false);
        try {
          const { data, error } = await supabase.auth.getSession();
          if (version !== requestVersion.current) return;
          if (error) throw error;
          setSession(data.session);
          currentUser.current = data.session?.user.id ?? null;
          if (data.session) await loadWorkspace(data.session.user.id);
        } catch {
          if (version === requestVersion.current) setWorkspaceError(true);
        } finally {
          if (version === requestVersion.current) setLoading(false);
        }
      }
    },
  }), [loading, session, workspace, workspaceError, loadWorkspace]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
