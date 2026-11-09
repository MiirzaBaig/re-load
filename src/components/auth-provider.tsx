"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { preferredWorkspace, workspacePreferenceKey, type Workspace } from "@/lib/workspace-selection";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (storeId: string) => void;
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
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
        .order("created_at", { ascending: true })
        .order("store_id", { ascending: true })
        .limit(100);
      if (version !== requestVersion.current) return;
      if (error) throw error;
      const available = (data ?? []).map((row: { store_id: string; role: string; stores: unknown }) => {
        const relation = row.stores as unknown as { name?: string } | null;
        return { storeId: row.store_id as string, storeName: relation?.name ?? "My Store", role: row.role as Workspace["role"] };
      });
      let preference: string | null = null;
      try { preference = localStorage.getItem(workspacePreferenceKey(userId)); } catch { /* Browser storage can be disabled. */ }
      setWorkspaces(available);
      setWorkspace(preferredWorkspace(available, preference));
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
      setWorkspaces([]);
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
    workspaces,
    switchWorkspace: (storeId) => {
      if (!session || loading || !workspaces.some((item) => item.storeId === storeId)) throw Error("workspace_unavailable");
      if (workspace?.storeId === storeId) return;
      localStorage.setItem(workspacePreferenceKey(session.user.id), storeId);
      // A full reload drops all tenant-bound forms, requests and singleton caches.
      // Never keep a case/detail route belonging to the previous workspace.
      window.location.assign("/app/integrations");
    },
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
  }), [loading, session, workspace, workspaces, workspaceError, loadWorkspace]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
