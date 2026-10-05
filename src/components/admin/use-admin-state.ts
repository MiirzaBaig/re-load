"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { parseDeskState, type DeskState } from "@/components/admin/desk-state";

export { parseDeskState, VIEWS, type DeskQuery, type DeskState, type LeadsLayout, type View } from "@/components/admin/desk-state";

function toSearch(state: DeskState) {
  const params = new URLSearchParams();
  if (state.view !== "today") params.set("view", state.view);
  if (state.view === "leads" && state.layout === "table") params.set("layout", "table");
  if (state.view === "leads" && state.status) params.set("status", state.status);
  if (state.lead) params.set("lead", state.lead);
  if (state.merchant) params.set("merchant", state.merchant);
  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

/**
 * The desk's view and open record live in the URL, so refresh, back/forward
 * and shared links all land in the same place. History is written directly
 * rather than through the router: nothing here needs a server round-trip.
 */
export function useDeskState(initial: DeskState) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);

  useEffect(() => {
    const onPop = () => {
      const next = parseDeskState(Object.fromEntries(new URLSearchParams(window.location.search)));
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Change view or record. `push` adds a history entry (view changes,
   *  opening a record); otherwise the current entry is replaced. */
  const go = useCallback((changes: Partial<DeskState>, { push = true } = {}) => {
    // History is written outside the state updater: updaters run twice in
    // development, which would push every entry twice.
    const current = stateRef.current;
    const next = { ...current, ...changes };
    // Leaving a view closes whatever was open in it.
    if (changes.view && changes.view !== current.view) {
      if (!("lead" in changes)) next.lead = null;
      if (!("merchant" in changes)) next.merchant = null;
      if (!("status" in changes)) next.status = null;
    }
    stateRef.current = next;
    const url = toSearch(next);
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setState(next);
  }, []);

  return [state, go] as const;
}
