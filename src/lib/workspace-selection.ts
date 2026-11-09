export interface Workspace {
  storeId: string;
  storeName: string;
  role: "owner" | "admin" | "member";
}

export function workspacePreferenceKey(userId: string) {
  return `reload:workspace:${userId}`;
}

/** Browser preferences never grant access: only current membership rows count. */
export function preferredWorkspace(workspaces: Workspace[], preference: string | null) {
  return workspaces.find((workspace) => workspace.storeId === preference) ?? workspaces[0] ?? null;
}
