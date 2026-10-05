/* Shared by the server page (first paint) and the client desk. No "use client":
   the server calls parseDeskState directly. */

export const VIEWS = ["today", "leads", "merchants", "returns", "health", "feedback", "activity", "team"] as const;
export type View = (typeof VIEWS)[number];
export type LeadsLayout = "board" | "table";

export type DeskState = {
  view: View;
  lead: string | null;
  merchant: string | null;
  layout: LeadsLayout;
  /** Status filter for the leads table, e.g. from the pipeline strip on Today. */
  status: string | null;
};

export type DeskQuery = Partial<Record<"view" | "lead" | "merchant" | "layout" | "status", string>>;

/** Parse the URL. Also used on the server, so the first paint shows the
 *  right view with no flash. */
export function parseDeskState(query: DeskQuery): DeskState {
  const view = VIEWS.includes(query.view as View) ? (query.view as View) : "today";
  return {
    view,
    lead: query.lead ?? null,
    merchant: query.merchant ?? null,
    layout: query.layout === "table" ? "table" : "board",
    status: query.status ?? null,
  };
}
