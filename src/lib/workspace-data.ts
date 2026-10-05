"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { CaseStatus, PolicyRule, ReturnCase } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

/*
 * The merchant workspace's live data (cases, latest policy, drafts, Salla),
 * read from Supabase once and shared by the sidebar badges, Overview and the
 * case list. Before this, Overview and the badges read the old browser-only
 * demo store, so a real store could publish a policy and still be told its
 * setup was incomplete.
 */

export const CASE_SELECT =
  "id, order_id, status, customer_snapshot, item_snapshot, created_at, updated_at, eligibility_decisions(outcome, reason_codes, order_facts_snapshot, policy_snapshot, evaluated_at, policy_versions(version_label))";

/** One `return_cases` row (with its decision) as the app's ReturnCase. */
export function mapCaseRow(row: Record<string, any>): ReturnCase {
  const decision = row.eligibility_decisions ?? {};
  const customer = row.customer_snapshot ?? {};
  const item = row.item_snapshot ?? {};
  const policy = decision.policy_versions ?? {};
  return {
    id: String(row.id), orderId: String(row.order_id), customerName: String(customer.name ?? "Customer"), customerEmail: String(customer.email ?? ""),
    itemId: String(item.id ?? ""), itemName: String(item.name ?? "Item"), quantity: Number(item.quantity ?? 1), reason: item.reason ?? "defective", condition: item.condition ?? "new_unopened",
    outcome: decision.outcome, caseStatus: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    decision: { outcome: decision.outcome, reasonCodes: decision.reason_codes ?? [], explanation: "", appliedRules: decision.policy_snapshot?.rules_snapshot?.map((rule: any) => ({ rule, passed: true, evaluatedValue: "", reasonCode: "" })) ?? [], policyVersionId: "", policyVersionLabel: policy.version_label ?? "—", evaluatedAt: decision.evaluated_at, relevantFacts: [] },
    events: [], notes: [],
  } as ReturnCase;
}

export type LatestPolicy = { versionLabel: string; publishedAt: string; ruleCount: number };
export type SallaState = { status: string; storeName: string | null; connectedAt: string | null } | null;

export type WorkspaceData = {
  ready: boolean;
  storeId: string | null;
  cases: ReturnCase[];
  policy: LatestPolicy | null;
  draftCount: number;
  salla: SallaState;
};

const EMPTY: WorkspaceData = { ready: false, storeId: null, cases: [], policy: null, draftCount: 0, salla: null };

let state: WorkspaceData = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const set = (next: WorkspaceData) => { state = next; emit(); };

async function load(storeId: string) {
  if (!supabase) { set({ ...EMPTY, ready: true, storeId }); return; }
  const [cases, policies, drafts, salla] = await Promise.all([
    supabase.from("return_cases").select(CASE_SELECT).eq("store_id", storeId).order("created_at", { ascending: false }),
    supabase.from("policy_versions").select("version_label, published_at, rules_snapshot").eq("store_id", storeId).order("published_at", { ascending: false }).limit(1),
    supabase.from("policy_drafts").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("commerce_connections").select("status, external_store_name, connected_at").eq("store_id", storeId).eq("platform", "salla").maybeSingle(),
  ]);
  const latest = (policies.data ?? [])[0] as Record<string, unknown> | undefined;
  set({
    ready: true,
    storeId,
    cases: ((cases.data ?? []) as Array<Record<string, any>>).map(mapCaseRow),
    policy: latest ? { versionLabel: String(latest.version_label), publishedAt: String(latest.published_at), ruleCount: ((latest.rules_snapshot ?? []) as PolicyRule[]).length } : null,
    draftCount: drafts.count ?? 0,
    salla: salla.data ? { status: String(salla.data.status), storeName: (salla.data.external_store_name as string | null) ?? null, connectedAt: (salla.data.connected_at as string | null) ?? null } : null,
  });
}

/** Re-read everything (e.g. after returning to the tab). */
export function refreshWorkspace() {
  if (!state.storeId) return Promise.resolve();
  inflight = load(state.storeId).finally(() => { inflight = null; });
  return inflight;
}

/** Reflect a case status change everywhere at once, without a refetch. */
export function setCaseStatus(caseId: string, status: CaseStatus) {
  set({ ...state, cases: state.cases.map((c) => (c.id === caseId ? { ...c, caseStatus: status, updatedAt: new Date().toISOString() } : c)) });
}

const NO_STORE: WorkspaceData = { ...EMPTY, ready: true, storeId: "none" };

/** Which store to load: "local" without Supabase, null while auth is still
 *  resolving, "none" for a signed-out user or one without a store yet. */
export function workspaceKey(auth: { loading: boolean; workspace: { storeId: string } | null }) {
  if (!supabase) return "local";
  if (auth.loading) return null;
  return auth.workspace?.storeId ?? "none";
}

export function useWorkspaceData(storeId: string | null | undefined): WorkspaceData {
  const snapshot = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    if (!storeId || storeId === "none") return;
    if ((state.storeId === storeId && state.ready) || inflight) return;
    if (state.storeId !== storeId) set({ ...EMPTY, storeId });
    inflight = load(storeId).finally(() => { inflight = null; });
  }, [storeId]);
  if (storeId === "none") return NO_STORE;
  return snapshot.storeId === storeId ? snapshot : EMPTY;
}

/** Cases that need the merchant to act: manual reviews first, then open
 *  cases oldest first, then items received but not closed. */
export function needsDecision(cases: ReturnCase[]) {
  const rank = (c: ReturnCase) =>
    c.caseStatus === "OPEN" && c.outcome === "MANUAL_REVIEW" ? 0 : c.caseStatus === "OPEN" ? 1 : c.caseStatus === "RECEIVED" ? 2 : 9;
  return cases
    .filter((c) => rank(c) < 9)
    .sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
}
