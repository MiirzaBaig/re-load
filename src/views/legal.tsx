import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const UPDATED = "18 September 2026";

type Section = { heading: string; body: string[] };

function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
}) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-16 md:py-24">
      <Link
        href="/"
        className="nav-ghost -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>

      <p className="mt-10 text-sm font-semibold text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-foreground md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
        {intro}
      </p>
      <p className="mt-6 border-t border-border pt-6 text-xs text-muted-foreground">
        Last updated {UPDATED}
      </p>

      <div className="mt-10 flex flex-col gap-9">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-border bg-muted/40 p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Questions about this page?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Write to{" "}
          <a
            href="mailto:info@reload.sa"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            info@reload.sa
          </a>{" "}
          and we will respond.
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How Reload handles merchant and customer data when evaluating return requests."
      sections={[
        {
          heading: "1. Information we process",
          body: [
            "For merchants, we process account details (name, email, store name) and the return policy text you supply so it can be turned into reviewable rules.",
            "For customers of a connected store, we process the order details needed to evaluate a return request: order reference, contact information used to verify it, item, quantity, stated reason, item condition, and any product photo sent with the request.",
          ],
        },
        {
          heading: "2. How we use it",
          body: [
            "Merchant data is used to operate your workspace: storing policy drafts and published versions, evaluating return requests, and keeping a record of each decision.",
            "Customer data is used to verify the order, assess the request against the store's approved policy, and show the merchant the photo and decision record. Photo analysis may be performed by our AI service to flag unclear evidence for human review; it does not issue a refund or decide eligibility on its own. We do not use customer data to build advertising profiles, and we do not sell it.",
          ],
        },
        {
          heading: "3. Decision records",
          body: [
            "When a return is evaluated, Reload stores a record of that decision: the policy version applied, the rules that fired, the relevant order facts, and the time of evaluation. This record is what makes a decision explainable and auditable later.",
            "Editing a policy creates a new version. Past decisions keep the evidence they were made with.",
          ],
        },
        {
          heading: "4. Store isolation",
          body: [
            "Each merchant's data is scoped to their own store. One merchant cannot read another merchant's policies, decisions, or cases.",
          ],
        },
        {
          heading: "5. Retention",
          body: [
            "Merchants can delete policy drafts at any time. Decision records are retained while your account is active so that past outcomes remain explainable, and are deleted when you close your account and ask us to remove them.",
          ],
        },
        {
          heading: "6. Your rights",
          body: [
            "You may request access to, correction of, or deletion of your personal data. Customers of a connected store should contact that store first, since the store is the controller of its own order data.",
          ],
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="The agreement between Reload and merchants using the service."
      sections={[
        {
          heading: "1. What Reload does",
          body: [
            "Reload turns a merchant's written return policy into structured rules, and applies those rules to individual return requests to produce an eligibility decision with supporting evidence.",
            "Reload is a decision and explanation layer. It does not issue refunds, move money, create shipping labels, or change inventory.",
          ],
        },
        {
          heading: "2. Merchant approval is required",
          body: [
            "AI proposes rules; it does not approve them. No proposed rule becomes active until a merchant reviews and publishes it. You are responsible for the content of the rules you publish and for checking that they reflect your actual policy.",
          ],
        },
        {
          heading: "3. Decisions and responsibility",
          body: [
            "Reload applies your published rules to the facts of an order and returns Eligible, Not eligible, or Manual review. The merchant remains responsible for honouring, overriding, or declining any individual return, and for compliance with applicable consumer protection law.",
            "Where required facts are missing, Reload returns Manual review rather than guessing.",
          ],
        },
        {
          heading: "4. Acceptable use",
          body: [
            "Do not use Reload to evaluate data you have no right to process, to attempt to access another merchant's store data, or to probe the service for vulnerabilities without prior written permission.",
          ],
        },
        {
          heading: "5. Availability",
          body: [
            "We aim to keep the service available and will give reasonable notice of planned maintenance. The service is provided without warranty of uninterrupted availability.",
          ],
        },
        {
          heading: "6. Changes to these terms",
          body: [
            "We may update these terms as the product develops. Material changes will be communicated to the email on your account before they take effect.",
          ],
        },
      ]}
    />
  );
}
