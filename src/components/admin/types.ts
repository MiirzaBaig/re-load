export type Lead = {
  id: string;
  store_name: string;
  contact_name: string;
  /** Free text from the website form; one of PLATFORMS from the event form
   *  and the desk. Read it through platformOf(). */
  store_platform: string | null;
  interest: string | null;
  status: string;
  source_type: string;
  source_label: string;
  created_at: string;
  next_follow_up_at: string | null;
  owner_user_id: string | null;
  store_id: string | null;
};
export type StoreRow = { id: string; name: string; created_at: string };
export type Membership = { store_id: string; user_id: string; role: string };
export type Policy = { store_id: string; published_at: string };
export type Commerce = { store_id: string; platform: string; status: string; external_store_name: string | null; last_synced_at: string | null; last_error_code: string | null; connected_at: string | null };
export type WhatsApp = { store_id: string; status: string; last_webhook_at: string | null; connected_at: string | null };
export type Decision = { store_id: string; outcome: string; reason_codes: string[]; evaluated_at: string };
export type Case = { store_id: string; status: string; created_at: string };
export type FailedMessage = { store_id: string; status: string; failure_code: string | null; occurred_at: string };
export type FailedEvent = { store_id: string | null; provider: string; event_type: string; status: string; last_error: string | null; received_at: string };
export type Report = { id: string; store_id: string | null; report_type: string; status: string; message: string; source_channel: string; created_at: string };
export type Audit = { id: string; store_id: string; event_type: string; entity_type: string; created_at: string };
export type AdminAudit = { id: string; actor_user_id: string; event_type: string; entity_type: string; created_at: string };
export type LeadNote = { id: string; body: string; created_at: string; author_user_id: string };
export type LeadDetail = Lead & {
  email: string | null;
  phone: string | null;
  website: string | null;
  preferred_contact: string | null;
  contact_consent: boolean;
  marketing_consent: boolean;
  partner_sharing_consent: boolean;
  financing_requests: Record<string, unknown> | null;
  lead_notes: LeadNote[];
};

export type TeamMember = { user_id: string; email: string; full_name: string | null; role: "owner" | "sales" | "viewer"; joined_at: string; last_sign_in_at: string | null };

export type AdminData = {
  role: string;
  currentUserId: string;
  leads: Lead[];
  stores: StoreRow[];
  memberships: Membership[];
  policies: Policy[];
  commerce: Commerce[];
  whatsapp: WhatsApp[];
  decisions: Decision[];
  cases: Case[];
  failedMessages: FailedMessage[];
  failedEvents: FailedEvent[];
  reports: Report[];
  merchantAudit: Audit[];
  adminAudit: AdminAudit[];
  team: TeamMember[];
};

/** Pipeline order. "not_interested" sits last and starts collapsed on the board. */
export const STATUSES = ["new", "contacted", "interested", "demo_booked", "customer", "not_interested"] as const;
export type Status = (typeof STATUSES)[number];

export type LeadChanges = { status?: string; next_follow_up_at?: string | null; owner_user_id?: string | null; store_platform?: string | null };

export type Merchant = StoreRow & {
  account: boolean;
  commerce?: Commerce;
  policy: boolean;
  policyAt?: string;
  whatsapp?: WhatsApp;
  firstDecision: boolean;
  firstDecisionAt?: string;
  caseCount: number;
};
