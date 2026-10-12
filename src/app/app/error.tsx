"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { recordWorkspaceIssue } from "@/lib/workspace-issues";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  const { workspace } = useAuth();
  const { t } = useLanguage();
  useEffect(() => {
    if (workspace)
      recordWorkspaceIssue(workspace.storeId, "workspace", "screen_failed");
  }, [workspace]);
  return (
    <section className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">
        {t("This page could not load", "تعذّر تحميل الصفحة")}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {t(
          "Try loading it again. This error does not mean your saved work was deleted.",
          "حاول تحميلها مجددًا. هذا الخطأ لا يعني حذف عملك المحفوظ.",
        )}
      </p>
      <Button onClick={reset} className="rounded-xl active:scale-[.98]">
        {t("Try again", "حاول مجددًا")}
      </Button>
    </section>
  );
}
