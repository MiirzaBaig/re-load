"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, Copy, Eye, Loader2, MailPlus, Shield, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EmptyState, Panel, QUICK, Segmented } from "@/components/desk/primitives";
import type { TeamMember } from "@/components/admin/types";
import type { Labels } from "@/components/admin/use-labels";
import { cn } from "@/lib/utils";

type Role = TeamMember["role"];
type Invite = { email: string; role: Role; created_at: string };

export function memberName(member: Pick<TeamMember, "full_name" | "email">) {
  return member.full_name || member.email.split("@")[0];
}

export function TeamView({ team: initial, currentUserId, isOwner, labels }: { team: TeamMember[]; currentUserId: string; isOwner: boolean; labels: Labels }) {
  const { t } = labels;
  const [team, setTeam] = useState(initial);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const roleInfo: Record<Role, { label: string; detail: string; icon: typeof Shield }> = {
    owner: { label: t("Owner", "مالك"), detail: t("Everything, including the team", "كل شيء، بما فيه الفريق"), icon: ShieldCheck },
    sales: { label: t("Sales", "مبيعات"), detail: t("Works leads and follow-ups", "يتابع العملاء المحتملين"), icon: Shield },
    viewer: { label: t("Viewer", "مشاهد"), detail: t("Can look, can't change", "يشاهد دون تعديل"), icon: Eye },
  };

  useEffect(() => {
    if (!isOwner) return;
    void fetch("/api/admin/team", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((result) => { if (result) setInvites(result.invites); });
  }, [isOwner]);

  const call = async (method: "POST" | "PATCH" | "DELETE", body: object) => {
    const response = await fetch("/api/admin/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy("invite");
    try {
      await call("POST", { email: address, role });
      setInvites((current) => [{ email: address, role, created_at: new Date().toISOString() }, ...current.filter((i) => i.email !== address)]);
      setEmail("");
      toast.success(t(`Invited ${address}.`, `تمت دعوة ${address}.`), { description: t("They sign in at /admin with Google or their email.", "يدخلون من ‎/admin عبر Google أو بريدهم."), action: { label: t("Copy link", "نسخ الرابط"), onClick: () => void copyLink() } });
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Could not invite.", "تعذّرت الدعوة.")); }
    finally { setBusy(null); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/admin/login`); toast.success(t("Sign-in link copied.", "تم نسخ رابط الدخول.")); }
    catch { toast.error(t("Couldn't copy.", "تعذّر النسخ.")); }
  };

  const changeRole = async (member: TeamMember, next: Role) => {
    if (member.role === next) return;
    const before = member.role;
    setTeam((current) => current.map((m) => (m.user_id === member.user_id ? { ...m, role: next } : m)));
    try {
      await call("PATCH", { userId: member.user_id, role: next });
      toast.success(t(`${memberName(member)} is now ${roleInfo[next].label}.`, `${memberName(member)} أصبح ${roleInfo[next].label}.`));
    } catch (error) {
      setTeam((current) => current.map((m) => (m.user_id === member.user_id ? { ...m, role: before } : m)));
      toast.error(error instanceof Error ? error.message : t("Could not change the role.", "تعذّر تغيير الدور."));
    }
  };

  const remove = async (member: TeamMember) => {
    setRemoving(null);
    setBusy(member.user_id);
    try {
      await call("DELETE", { userId: member.user_id });
      setTeam((current) => current.filter((m) => m.user_id !== member.user_id));
      toast.success(t(`${memberName(member)} no longer has access.`, `أُزيل وصول ${memberName(member)}.`));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Could not remove access.", "تعذّر إزالة الوصول.")); }
    finally { setBusy(null); }
  };

  const cancelInvite = async (address: string) => {
    setBusy(address);
    try {
      await call("DELETE", { email: address });
      setInvites((current) => current.filter((i) => i.email !== address));
      toast.success(t("Invite cancelled.", "أُلغيت الدعوة."));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Could not cancel.", "تعذّر الإلغاء.")); }
    finally { setBusy(null); }
  };

  return <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <div className="desk-stagger space-y-6">
      <Panel title={t("Members", "الأعضاء")} subtitle={t(`${team.length} ${team.length === 1 ? "person" : "people"} can open the team desk.`, `${team.length} يمكنهم فتح مساحة الفريق.`)} bodyClassName="px-2 pb-2 pt-3 sm:px-3">
        <ul>
          <AnimatePresence initial={false}>
            {team.map((member) => {
              const self = member.user_id === currentUserId;
              const info = roleInfo[member.role];
              return <motion.li key={member.user_id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden">
                <div className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-muted/40">
                  <Avatar name={memberName(member)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold" dir="auto">{memberName(member)}{self && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t("You", "أنت")}</span>}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{member.email}</p>
                  </div>
                  <span className="hidden w-28 shrink-0 text-end text-[11px] text-muted-foreground sm:block">{member.last_sign_in_at ? t(`Active ${labels.age(member.last_sign_in_at)}`, `نشط ${labels.age(member.last_sign_in_at)}`) : t("Not signed in yet", "لم يدخل بعد")}</span>
                  {isOwner && !self ? <DropdownMenu>
                    <DropdownMenuTrigger asChild><button type="button" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:border-foreground/25 data-[state=open]:bg-muted"><info.icon className="size-3.5" />{info.label}</button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      {(Object.keys(roleInfo) as Role[]).map((option) => <DropdownMenuItem key={option} onSelect={() => void changeRole(member, option)} className="items-start gap-2.5 py-2">
                        {(() => { const Icon = roleInfo[option].icon; return <Icon className="mt-0.5 size-4" />; })()}
                        <span className="flex-1"><span className="block text-sm font-medium">{roleInfo[option].label}</span><span className="block text-xs text-muted-foreground">{roleInfo[option].detail}</span></span>
                        {member.role === option && <Check className="mt-0.5 size-4" />}
                      </DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu> : <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground"><info.icon className="size-3.5" />{info.label}</span>}
                  {isOwner && !self && <button type="button" onClick={() => setRemoving(member)} disabled={busy === member.user_id} aria-label={t(`Remove ${memberName(member)}`, `إزالة ${memberName(member)}`)} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-100 transition-[opacity,background-color,color] duration-150 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                    {busy === member.user_id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>}
                </div>
              </motion.li>;
            })}
          </AnimatePresence>
        </ul>
      </Panel>

      {isOwner && <Panel title={t("Pending invites", "دعوات معلّقة")} subtitle={t("They get access the first time they sign in with this email.", "يحصلون على الوصول عند أول دخول بهذا البريد.")} bodyClassName="px-2 pb-2 pt-3 sm:px-3">
        {invites.length ? <ul>
          <AnimatePresence initial={false}>
            {invites.map((item) => <motion.li key={item.email} layout="position" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={QUICK} className="overflow-hidden">
              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground"><Clock3 className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" dir="ltr">{item.email}</p><p className="text-xs text-muted-foreground">{roleInfo[item.role].label} · {t(`invited ${labels.age(item.created_at)}`, `دُعي ${labels.age(item.created_at)}`)}</p></div>
                <button type="button" onClick={() => void cancelInvite(item.email)} disabled={busy === item.email} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{busy === item.email ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}{t("Cancel", "إلغاء")}</button>
              </div>
            </motion.li>)}
          </AnimatePresence>
        </ul> : <EmptyState icon={MailPlus} title={t("No pending invites", "لا دعوات معلّقة")} className="py-7" />}
      </Panel>}
    </div>

    <div className="desk-stagger space-y-6 xl:sticky xl:top-20" style={{ ["--desk-base" as string]: "120ms" }}>
      {isOwner ? <Panel title={t("Invite someone", "دعوة شخص")} subtitle={t("No passwords. They sign in with Google or an email code.", "بلا كلمات مرور. يدخلون عبر Google أو رمز البريد.")}>
        <form onSubmit={(event) => void invite(event)} className="space-y-4">
          <label className="block text-sm font-medium">{t("Email", "البريد الإلكتروني")}
            <Input className="mt-2 h-11 rounded-xl" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
          </label>
          <div>
            <p className="text-sm font-medium">{t("Role", "الدور")}</p>
            <Segmented className="mt-2 flex w-full [&>button]:flex-1 [&>button]:justify-center" label={t("Role", "الدور")} value={role} onChange={setRole}
              options={(Object.keys(roleInfo) as Role[]).map((option) => ({ value: option, label: roleInfo[option].label, icon: roleInfo[option].icon }))} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={role} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={QUICK} className="mt-2 text-xs text-muted-foreground">{roleInfo[role].detail}</motion.p>
            </AnimatePresence>
          </div>
          <Button type="submit" disabled={busy === "invite" || !email.trim()} className="h-11 w-full rounded-xl">{busy === "invite" ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}{t("Send invite", "إرسال الدعوة")}</Button>
          <button type="button" onClick={() => void copyLink()} className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><Copy className="size-3.5" />{t("Copy the team sign-in link to share", "انسخ رابط دخول الفريق لمشاركته")}</button>
        </form>
      </Panel> : <Panel title={t("Team access", "وصول الفريق")} subtitle={t("Only owners can invite people or change roles.", "المالكون فقط يمكنهم الدعوة أو تغيير الأدوار.")}><div className="flex items-center gap-2 text-sm text-muted-foreground"><UserRound className="size-4" />{t("Ask an owner if someone needs access.", "اطلب من المالك إن احتاج أحدهم وصولًا.")}</div></Panel>}
      <div className="rounded-2xl border border-border bg-muted/30 p-5 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">{t("How sign-in works", "كيف يعمل الدخول")}</p>
        <p className="mt-1">{t("Each person uses their own Google account or email. Sessions last on each device, and removing someone here ends their access straight away.", "يستخدم كل شخص حساب Google أو بريده. تبقى الجلسة على كل جهاز، وإزالة الشخص هنا تنهي وصوله فورًا.")}</p>
      </div>
    </div>

    <AlertDialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`Remove ${removing ? memberName(removing) : ""}?`, `إزالة ${removing ? memberName(removing) : ""}؟`)}</AlertDialogTitle>
          <AlertDialogDescription>{t("They'll lose access to the team desk right away. Their notes and history stay.", "سيفقدون الوصول فورًا. تبقى ملاحظاتهم وسجلهم.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep", "إبقاء")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => removing && void remove(removing)} className={cn("bg-destructive text-white hover:bg-destructive/90")}>{t("Remove access", "إزالة الوصول")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

/** Initials on a tint derived from the name, so people are easy to tell apart. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "·";
  const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold", className)} style={{ background: `oklch(0.92 0.04 ${hue})`, color: `oklch(0.35 0.08 ${hue})` }}>{initials}</span>;
}
