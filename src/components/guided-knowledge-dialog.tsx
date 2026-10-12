"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Check, ChevronRight, Loader2, MessageSquare } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { ProgressRing } from "@/components/desk/progress-ring";
import { QUICK, Segmented } from "@/components/desk/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { knowledgeStarters } from "@/lib/knowledge-starters";
export function GuidedKnowledgeDialog({
  storeId,
  onSaved,
}: {
  storeId: string;
  onSaved: () => Promise<void>;
}) {
  const { t, isArabic } = useLanguage();
  const questions = knowledgeStarters(t);
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [language, setLanguage] = useState(isArabic ? "ar" : "en");
  const [saved, setSaved] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  const q = questions[index];
  function close() {
    if (busy) return;
    if (answer.trim()) setDiscard(true);
    else setOpen(false);
  }
  async function next() {
    if (!supabase || !q || !answer.trim() || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      // Language of the question follows the answer, independently of the UI locale.
      const question = knowledgeStarters((en, ar) =>
        language === "ar" ? ar : en,
      )[index];
      const { error } = await supabase.functions.invoke("customer-service", {
        body: {
          action: "knowledge_save",
          storeId,
          title: question.title,
          content: answer.trim(),
          category: q.category,
          language,
          published: false,
        },
      });
      if (error) throw error;
      setSaved((v) => v + 1);
      setAnswer("");
      setIndex((v) => v + 1);
      await onSaved();
    } catch {
      setError(
        t(
          "Your answer could not be saved. It is still here—please try again.",
          "تعذّر حفظ إجابتك. ما زالت هنا، حاول مجددًا.",
        ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <Button
        variant="outline"
        className="rounded-xl active:scale-[.98]"
        onClick={() => {
          setOpen(true);
          setIndex(0);
          setSaved(0);
          setAnswer("");
          setError("");
        }}
      >
        <MessageSquare className="size-4" />
        {t("Set up with questions", "إعداد خطوة بخطوة")}
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader className="text-start">
            <DialogTitle>
              {t("Your store, in your words", "متجرك، بكلماتك")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "No help page needed. Save what you know, skip what you don’t. You approve each draft later.",
                "ما تحتاج صفحة مساعدة. احفظ ما تعرفه وتجاوز الباقي. تعتمد كل مسودة لاحقًا.",
              )}
            </DialogDescription>
          </DialogHeader>
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={QUICK}
              className="min-w-0 space-y-5"
            >
              {q ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <ProgressRing
                      done={index}
                      total={questions.length}
                      label={t("Questions completed", "الأسئلة المكتملة")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t(
                        `Question ${index + 1} of ${questions.length}`,
                        `السؤال ${index + 1} من ${questions.length}`,
                      )}
                    </p>
                    <span className="text-xs text-eligible">
                      {t(`${saved} drafts saved`, `${saved} مسودات محفوظة`)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold leading-relaxed">
                    {q.title}
                  </h2>
                  <label htmlFor="guided-answer" className="sr-only">
                    {t("Your answer", "إجابتك")}
                  </label>
                  <Textarea
                    id="guided-answer"
                    dir="auto"
                    className="min-h-40 rounded-xl"
                    maxLength={6000}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={busy}
                    placeholder={t(
                      "Write the answer your customers should receive.",
                      "اكتب الإجابة التي تريد أن تصل لعملائك.",
                    )}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {q.hint}
                  </p>
                  <Segmented
                    label={t("Answer language", "لغة الإجابة")}
                    value={language}
                    onChange={(v) => {
                      if (!busy) setLanguage(v);
                    }}
                    options={[
                      { value: "ar", label: "العربية" },
                      { value: "en", label: "English" },
                    ]}
                  />
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || !answer.trim()}
                      onClick={() => void next()}
                      className="rounded-xl active:scale-[.98]"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {t("Save draft and continue", "حفظ المسودة والمتابعة")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || !!answer.trim()}
                      onClick={() => {
                        setIndex((v) => v + 1);
                        setError("");
                      }}
                    >
                      {t("Skip for now", "تجاوز الآن")}
                      <ChevronRight className="size-4 rtl:rotate-180" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 py-4">
                  <Check className="size-9 text-eligible" />
                  <h2 className="text-xl font-semibold">
                    {saved
                      ? t(
                          "Your drafts are ready to review",
                          "مسوداتك جاهزة للمراجعة",
                        )
                      : t(
                          "You can add answers whenever you’re ready",
                          "تقدر تضيف إجابات وقت ما تكون جاهز",
                        )}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(
                      "Open each draft, check the facts, then approve it. Unsaved or unapproved answers are never used with customers.",
                      "افتح كل مسودة، راجع التفاصيل، ثم اعتمدها. لا تُستخدم إجابات غير محفوظة أو غير معتمدة مع العملاء.",
                    )}
                  </p>
                  <Button onClick={() => setOpen(false)}>
                    {t("Back to my answers", "العودة لإجاباتي")}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Leave this answer unsaved?", "ترك الإجابة دون حفظ؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Your saved drafts will stay. Only the answer you are typing will be discarded.",
                "مسوداتك المحفوظة تبقى. ستُحذف فقط الإجابة التي تكتبها الآن.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("Keep writing", "متابعة الكتابة")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setAnswer("");
                setDiscard(false);
                setOpen(false);
              }}
            >
              {t("Discard answer", "تجاهل الإجابة")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionConfig>
  );
}
