type T = (en: string, ar: string) => string;
export const knowledgeStarters = (t: T) => [
  {
    category: "DELIVERY",
    title: t("How long does delivery take?", "كم يستغرق التوصيل؟"),
    hint: t(
      "Include the areas you deliver to and any exceptions.",
      "وضّح مناطق التوصيل وأي استثناءات.",
    ),
  },
  {
    category: "WARRANTY",
    title: t("What does the warranty cover?", "ماذا يشمل الضمان؟"),
    hint: t(
      "If you do not offer a warranty, say so in your own words.",
      "إذا ما تقدم ضمانًا، وضّح ذلك بكلماتك.",
    ),
  },
  {
    category: "SUPPORT",
    title: t("How can I reach your team?", "كيف أتواصل مع فريقكم؟"),
    hint: t(
      "Share your contact method and working hours.",
      "اذكر طريقة التواصل وأوقات العمل.",
    ),
  },
  {
    category: "PAYMENTS",
    title: t("Which payment methods do you accept?", "ما طرق الدفع المتاحة؟"),
    hint: t(
      "Only list payment methods your store accepts.",
      "اذكر طرق الدفع التي يقبلها متجرك فقط.",
    ),
  },
  {
    category: "CANCELLATION",
    title: t(
      "Can I change or cancel my order?",
      "هل أقدر أعدّل طلبي أو ألغيه؟",
    ),
    hint: t(
      "Explain when a change is possible and who to contact.",
      "وضّح متى يمكن التعديل وكيف يتواصل العميل معكم.",
    ),
  },
];
