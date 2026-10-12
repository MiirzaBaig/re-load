"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PolicyListSkeleton } from "@/components/merchant-skeletons";
import { useDelayedLoad } from "@/hooks/use-delayed-load";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Key, PageHeader } from "@/components/desk/page-header";
import { formatDate, type PolicyDraft, type PolicyRule, type PolicyVersion } from "@/lib/domain";
import { Plus, FileText, CheckCircle2, Clock, ChevronDown, ArrowRight, ShieldCheck, History, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

export function PolicyListPage() {
  const router = useRouter();
  const { t, isArabic } = useLanguage();
  const { workspace } = useAuth();
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [drafts, setDrafts] = useState<PolicyDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const loaded = useDelayedLoad(300);
  const policy = versions[0];

  useEffect(() => {
    let active = true;
    if (!supabase || !workspace) return;
    void Promise.all([
      supabase.from("policy_versions").select("id, version_label, source_text, rules_snapshot, published_at, published_by").eq("store_id", workspace.storeId).order("published_at", { ascending: false }),
      supabase.from("policy_drafts").select("id, name, source_text, rules, extraction_state, created_at, updated_at").eq("store_id", workspace.storeId).order("updated_at", { ascending: false }),
    ]).then(([versionResult, draftResult]) => {
      if (!active) return;
      setVersions((versionResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id), versionLabel: String(row.version_label), publishedAt: String(row.published_at),
        publishedBy: String(row.published_by), rules: (row.rules_snapshot ?? []) as PolicyRule[],
        sourceText: String(row.source_text), frozenSnapshot: String(row.source_text),
      })));
      setDrafts((draftResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id), name: String(row.name), sourceText: String(row.source_text),
        rules: (row.rules ?? []) as PolicyRule[], extractionState: row.extraction_state === "failed" ? "error" : String(row.extraction_state) as PolicyDraft["extractionState"],
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      })));
    });
    return () => { active = false; };
  }, [workspace]);

  const totalRules = policy?.rules.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={FileText} title={t("Return policy", "سياسة الإرجاع")} helpId="policies"
        actions={<Button onClick={() => router.push("/app/policies/new")} className="group h-10 rounded-xl"><Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" />{t("New policy", "سياسة جديدة")}</Button>}
        help={t("Your return policy is the set of rules Reload follows: how many days, which reasons, which items. You paste it once, approve the rules, and publish. Changing it later creates a new version, and old decisions keep the version they were made with.", "سياسة الإرجاع هي القواعد التي يتبعها ريلود: عدد الأيام، والأسباب، والمنتجات. تلصقها مرة واحدة، تعتمد القواعد، ثم تنشرها. أي تعديل لاحق ينشئ إصدارًا جديدًا، والقرارات السابقة تحتفظ بإصدارها.")}>
        <Key>{t("Your rules, written once.", "قواعدك، تُكتب مرة واحدة.")}</Key> {t("Reload applies them the same way to every return.", "يطبّقها ريلود بالطريقة نفسها على كل إرجاع.")}
      </PageHeader>

      {/* Draft-to-published timeline */}
      <ScrollReveal delay={50}>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-review-muted text-review">
              <FileText className="size-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">{t("Draft", "مسودة")}</div>
              <div className="text-[11px] text-muted-foreground">{t(`${drafts.length} pending`, `${drafts.length} بانتظار المراجعة`)}</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <div className="h-px flex-1 bg-border" />
              <GitBranch className="size-3 text-muted-foreground" />
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-saffron-muted text-saffron">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">{t("Review", "المراجعة")}</div>
              <div className="text-[11px] text-muted-foreground">{t("Approve rules", "اعتماد القواعد")}</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <div className="h-px flex-1 bg-border" />
              <ArrowRight className={cn("size-3 text-muted-foreground", isArabic && "rotate-180")} />
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-eligible-muted text-eligible">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">{t("Published", "منشورة")}</div>
              <div className="text-[11px] text-muted-foreground">{t(`${versions.length} version${versions.length !== 1 ? "s" : ""}`, `${versions.length} إصدار`)}</div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {!loaded ? (
        <PolicyListSkeleton />
      ) : (
        <>
          {policy && (
            <ScrollReveal delay={100}>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-eligible" />
                  <h2 className="text-sm font-semibold text-foreground">{t("Current version", "الإصدار الحالي")}</h2>
                </div>
                <Card className="group interactive-card">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-eligible-muted text-eligible transition-transform group-hover:scale-110">
                        <ShieldCheck className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-foreground">{policy.versionLabel}</span>
                          <Badge variant="secondary" className="text-[11px]">{t("Active", "نشط")}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t(`Published ${formatDate(policy.publishedAt)} · ${totalRules} rules · by ${policy.publishedBy}`, `نُشرت في ${formatDate(policy.publishedAt)} · ${totalRules} قاعدة · بواسطة ${policy.publishedBy}`)}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => router.push("/app/policies/new")} className="group/btn">
                      {t("New version", "إصدار جديد")}
                      <ArrowRight className={cn("size-3.5 transition-transform group-hover/btn:translate-x-0.5", isArabic && "rotate-180")} />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollReveal>
          )}

          {/* Version history */}
          {versions.length > 1 && (
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardContent className="flex items-center justify-between py-4 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <History className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{t("Version history", "سجل الإصدارات")}</span>
                      <Badge variant="outline" className="text-[10px]">{versions.length}</Badge>
                    </div>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showHistory && "rotate-180")} />
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border px-6 py-4">
                    <div className="flex flex-col gap-3">
                      {versions.map((v, i) => (
                        <div key={v.id} className="flex items-center gap-3">
                          <div className={cn(
                            "flex size-7 items-center justify-center rounded-full text-[10px] font-bold",
                            i === 0 ? "bg-eligible text-eligible-foreground" : "bg-muted text-muted-foreground",
                          )}>
                            {i === 0 ? <CheckCircle2 className="size-3.5" /> : versions.length - i}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">{v.versionLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {t(`${formatDate(v.publishedAt)} · ${v.rules.length} rules · by ${v.publishedBy}`, `${formatDate(v.publishedAt)} · ${v.rules.length} قاعدة · بواسطة ${v.publishedBy}`)}
                            </div>
                          </div>
                          {i === 0 && <Badge variant="secondary" className="text-[10px]">{t("Active", "نشط")}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {drafts.length > 0 && (
            <ScrollReveal delay={200}>
              <div>
                <button
                  onClick={() => setShowDrafts(!showDrafts)}
                  className="group mb-3 flex items-center gap-2"
                >
                  <Clock className="size-4 text-review" />
                  <h2 className="text-sm font-semibold text-foreground">{t("Drafts", "المسودات")}</h2>
                  <Badge variant="outline" className="text-[11px]">{drafts.length}</Badge>
                  <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", !showDrafts && "-rotate-90")} />
                </button>
                {showDrafts && (
                  <div className="flex flex-col gap-2">
                    {drafts.map((draft, i) => (
                      <Card
                        key={draft.id}
                        className="group interactive-card"
                        style={{
                          opacity: loaded ? 1 : 0,
                          transform: loaded ? "translateY(0)" : "translateY(8px)",
                          transition: "opacity 0.4s ease-out, transform 0.4s ease-out, box-shadow 0.2s",
                          transitionDelay: `${i * 60}ms`,
                        }}
                      >
                        <CardContent className="flex items-center justify-between p-5">
                          <div className="flex items-center gap-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-review-muted text-review transition-transform group-hover:scale-110">
                              <FileText className="size-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-foreground">{draft.name}</span>
                                <Badge variant="outline" className="text-[11px]">{t("Draft", "مسودة")}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t(`${draft.rules.length} rules · Updated ${formatDate(draft.updatedAt)}`, `${draft.rules.length} قاعدة · آخر تحديث ${formatDate(draft.updatedAt)}`)}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/app/policies/review/${draft.id}`)}
                            className="group/btn"
                          >
                            {t("Review", "مراجعة")}
                            <ArrowRight className={cn("size-3.5 transition-transform group-hover/btn:translate-x-0.5", isArabic && "rotate-180")} />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollReveal>
          )}

          {!policy && drafts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t("No policies yet", "لا توجد سياسات بعد")}</p>
                  <p className="text-xs text-muted-foreground">{t("Create your first return policy to get started.", "أنشئ أول سياسة إرجاع للبدء.")}</p>
                </div>
                <Button onClick={() => router.push("/app/policies/new")} className="group">
                  <Plus className="size-4 transition-transform group-hover:rotate-90" />
                  {t("Create policy", "إنشاء سياسة")}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
