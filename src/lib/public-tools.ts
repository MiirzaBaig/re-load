// Free merchant tools. Each runs in the browser; nothing typed is sent or
// stored. Copy is [English, Arabic]. Keep SEO.md's keyword table in sync.

type Pair = readonly [string, string];

export type ToolSlug = "policy-checker" | "whatsapp-link" | "returns-cost-calculator";

export const TOOLS: ReadonlyArray<{
  slug: ToolSlug;
  title: Pair;
  heading: Pair;
  description: Pair;
  intro: Pair;
}> = [
  {
    slug: "policy-checker",
    title: ["Free return policy checker | Reload", "فاحص سياسة الاسترجاع مجانًا | ريلود"],
    heading: ["Return policy checker", "فاحص سياسة الاسترجاع والاستبدال"],
    description: [
      "Paste your store's return policy and see what's clear, what's missing and how to fix it: return window, conditions, exclusions, refunds and shipping.",
      "الصق سياسة الاسترجاع في متجرك واعرف الواضح والناقص وكيف تصلحه: مدة الإرجاع، الشروط، الاستثناءات، الاسترداد، والشحن.",
    ],
    intro: [
      "Paste your current return and exchange policy. The checker looks for the ten things customers ask about most and shows what to add. It runs in your browser; nothing is sent.",
      "الصق سياسة الاسترجاع والاستبدال الحالية. يبحث الفاحص عن عشرة أمور يسأل عنها العملاء غالبًا ويوضح ما يجب إضافته. يعمل في متصفحك ولا يُرسل أي شيء.",
    ],
  },
  {
    slug: "whatsapp-link",
    title: ["Free WhatsApp link and QR code generator for stores | Reload", "إنشاء رابط واتساب ورمز QR لمتجرك مجانًا | ريلود"],
    heading: ["WhatsApp link and QR code for your store", "رابط واتساب ورمز QR لمتجرك"],
    description: [
      "Create a WhatsApp chat link with a ready message, plus a QR code to print on packaging and receipts. Free, works with Saudi numbers.",
      "أنشئ رابط محادثة واتساب برسالة جاهزة، مع رمز QR تطبعه على التغليف والفواتير. مجاني ويعمل مع الأرقام السعودية.",
    ],
    intro: [
      "Type your store's WhatsApp number and a first message. You get a link customers can tap and a QR code they can scan from a box or receipt.",
      "اكتب رقم واتساب متجرك ورسالة أولى. تحصل على رابط يضغطه العميل، ورمز QR يمسحه من العلبة أو الفاتورة.",
    ],
  },
  {
    slug: "returns-cost-calculator",
    title: ["Returns cost calculator for online stores | Reload", "حاسبة تكلفة المرتجعات للمتاجر الإلكترونية | ريلود"],
    heading: ["Returns cost calculator", "حاسبة تكلفة المرتجعات"],
    description: [
      "Estimate how much cash and team time your store's returns cost each month, from return volume, order value and handling time.",
      "احسب كم تكلّف المرتجعات متجرك شهريًا من سيولة ووقت فريق، بناءً على عدد المرتجعات وقيمة الطلب ووقت المعالجة.",
    ],
    intro: [
      "Enter your monthly returns, average order value and how long each return takes. See the cash waiting in returns and the hours your team spends on them.",
      "أدخل عدد المرتجعات الشهرية، ومتوسط قيمة الطلب، والوقت الذي يستغرقه كل طلب. شاهد السيولة العالقة في المرتجعات والساعات التي يقضيها فريقك عليها.",
    ],
  },
];

export const TOOLS_INDEX_COPY = {
  ar: {
    title: "أدوات مجانية للمتاجر الإلكترونية | ريلود",
    description:
      "أدوات مجانية للتجار في السعودية: نموذج سياسة الاسترجاع، فاحص السياسة، رابط واتساب ورمز QR، وحاسبة تكلفة المرتجعات.",
    heading: "أدوات مجانية لمتجرك",
  },
  en: {
    title: "Free tools for online stores | Reload",
    description:
      "Free tools for Saudi merchants: return policy template, policy checker, WhatsApp link and QR code, and a returns cost calculator.",
    heading: "Free tools for your store",
  },
} as const;

export function toolBySlug(slug: string) {
  return TOOLS.find((tool) => tool.slug === slug);
}
