// Practical merchant guides. Public claims only: no invented statistics,
// customer counts or legal advice. Each entry is [English, Arabic].
// Keep both languages saying the same thing; update SEO.md when adding one.

type Pair = readonly [string, string];

export type Guide = {
  slug: string;
  published: string;
  keyword: Pair;
  title: Pair;
  description: Pair;
  intro: Pair;
  sections: ReadonlyArray<{ heading: Pair; body: ReadonlyArray<Pair>; list?: ReadonlyArray<Pair> }>;
  related: ReadonlyArray<"pricing" | "faq" | "how-it-works" | "return-policy-template">;
};

export const GUIDES: ReadonlyArray<Guide> = [
  {
    slug: "return-policy",
    published: "2026-10-18",
    keyword: ["return and exchange policy for online stores", "سياسة الاسترجاع والاستبدال للمتجر الإلكتروني"],
    title: [
      "How to write a clear return and exchange policy for your online store",
      "كيف تكتب سياسة استرجاع واستبدال واضحة لمتجرك الإلكتروني",
    ],
    description: [
      "A practical checklist for Saudi online stores: return window, item condition, exclusions, refund method, shipping costs and how customers start a return.",
      "قائمة عملية للمتاجر الإلكترونية في السعودية: مدة الإرجاع، حالة المنتج، الاستثناءات، طريقة الاسترداد، تكلفة الشحن، وكيف يبدأ العميل طلب الإرجاع.",
    ],
    intro: [
      "A return policy is one of the first things a hesitant customer reads before paying. When it is short, specific and easy to find, customers buy with more confidence and your team answers fewer repeated questions. When it is vague, every return turns into a negotiation.",
      "سياسة الاسترجاع من أول ما يقرأه العميل المتردد قبل الدفع. عندما تكون قصيرة وواضحة وسهلة الوصول، يشتري العميل بثقة أكبر ويتلقى فريقك أسئلة متكررة أقل. وعندما تكون غامضة، يتحول كل طلب إرجاع إلى نقاش طويل.",
    ],
    sections: [
      {
        heading: ["1. State the return window in days, and from when", "1. حدّد مدة الإرجاع بالأيام، ومن متى تبدأ"],
        body: [
          [
            "Write a number, not a feeling: “within 14 days of delivery” is clear; “a reasonable period” is not. Say whether the count starts from the order date or the delivery date. Delivery date is fairer to the customer and avoids disputes when shipping is slow.",
            "اكتب رقمًا لا وصفًا: «خلال 14 يومًا من تاريخ الاستلام» واضحة، أما «خلال فترة مناسبة» فليست كذلك. وضّح هل تبدأ المدة من تاريخ الطلب أم تاريخ الاستلام. تاريخ الاستلام أعدل للعميل ويمنع الخلاف عند تأخر الشحن.",
          ],
          [
            "Saudi consumer and e-commerce rules give customers specific rights, and they change over time. Check the current requirements on the Ministry of Commerce website and make sure your window is never shorter than what the rules require.",
            "تمنح أنظمة حماية المستهلك والتجارة الإلكترونية في السعودية العميل حقوقًا محددة، وقد تتغير مع الوقت. راجع المتطلبات الحالية على موقع وزارة التجارة، وتأكد ألا تكون مدتك أقصر مما يتطلبه النظام.",
          ],
        ],
      },
      {
        heading: ["2. Describe the condition you accept", "2. صِف حالة المنتج المقبولة"],
        body: [
          [
            "Customers should know before they open the box. Be specific about tags, original packaging, signs of use and accessories. If you accept opened items for some categories but not others, say so per category.",
            "يجب أن يعرف العميل ذلك قبل أن يفتح الطرد. كن محددًا بشأن البطاقات، والتغليف الأصلي، وآثار الاستخدام، والملحقات. وإذا كنت تقبل المنتجات المفتوحة في فئات دون أخرى، فاذكر ذلك لكل فئة.",
          ],
        ],
      },
      {
        heading: ["3. List exclusions clearly", "3. اذكر الاستثناءات بوضوح"],
        body: [
          [
            "Some items usually cannot be returned for hygiene or practical reasons. List them by name instead of hiding them in general wording, so the answer is the same whoever reads it.",
            "بعض المنتجات لا يمكن إرجاعها عادةً لأسباب صحية أو عملية. اذكرها بالاسم بدل إخفائها في عبارات عامة، حتى تكون الإجابة واحدة أيًّا كان القارئ.",
          ],
        ],
        list: [
          ["Personal care and cosmetics once opened", "منتجات العناية الشخصية ومستحضرات التجميل بعد فتحها"],
          ["Underwear and swimwear", "الملابس الداخلية وملابس السباحة"],
          ["Custom-made or personalised items", "المنتجات المصنوعة حسب الطلب أو المخصصة"],
          ["Perishable goods", "المنتجات سريعة التلف"],
          ["Digital codes and gift cards once delivered", "الأكواد الرقمية وبطاقات الهدايا بعد تسليمها"],
        ],
      },
      {
        heading: ["4. Explain the refund: method and timing", "4. اشرح الاسترداد: الطريقة والمدة"],
        body: [
          [
            "Say how the money comes back (original payment method, store credit or exchange) and roughly how long it takes after you receive and inspect the item. If the customer can choose, say that too.",
            "وضّح كيف يعود المبلغ (وسيلة الدفع الأصلية، أو رصيد في المتجر، أو استبدال) وكم يستغرق تقريبًا بعد استلام المنتج وفحصه. وإذا كان للعميل حرية الاختيار فاذكر ذلك أيضًا.",
          ],
        ],
      },
      {
        heading: ["5. Decide who pays return shipping", "5. حدّد من يتحمل تكلفة شحن الإرجاع"],
        body: [
          [
            "The most common approach: the store pays when the item is wrong or damaged, and the customer pays when they changed their mind. Whatever you choose, write it in one sentence.",
            "الأسلوب الأكثر شيوعًا: يتحمل المتجر التكلفة إذا كان المنتج خاطئًا أو تالفًا، ويتحملها العميل إذا غيّر رأيه. أيًّا كان اختيارك، اكتبه في جملة واحدة.",
          ],
        ],
      },
      {
        heading: ["6. Tell customers exactly how to start", "6. أخبر العميل بالضبط كيف يبدأ"],
        body: [
          [
            "The policy should end with one clear first step: where to write, what to send (order number, photo if relevant) and what happens next. A single WhatsApp link with a ready message works well because customers already use it every day.",
            "يجب أن تنتهي السياسة بخطوة أولى واضحة: أين يكتب العميل، وماذا يرسل (رقم الطلب وصورة عند الحاجة)، وماذا يحدث بعد ذلك. رابط واتساب واحد برسالة جاهزة يعمل جيدًا لأن العملاء يستخدمونه يوميًا.",
          ],
          [
            "With Reload, the published policy is what the WhatsApp assistant checks each request against, so writing it clearly once means every customer gets the same answer.",
            "مع ريلود، السياسة المنشورة هي ما يراجع مساعد واتساب كل طلب على أساسه، فكتابتها بوضوح مرة واحدة تعني أن كل عميل يحصل على الإجابة نفسها.",
          ],
        ],
      },
    ],
    related: ["return-policy-template", "how-it-works", "pricing"],
  },
  {
    slug: "whatsapp-returns",
    published: "2026-10-18",
    keyword: ["handle returns on WhatsApp", "إدارة طلبات الإرجاع عبر واتساب"],
    title: [
      "How to handle return requests on WhatsApp without the chaos",
      "كيف تدير طلبات الإرجاع عبر واتساب بدون فوضى",
    ],
    description: [
      "Why WhatsApp works for returns in Saudi Arabia, where it breaks down at scale, and a simple process to verify orders, apply your policy and track every case.",
      "لماذا يناسب واتساب طلبات الإرجاع في السعودية، وأين تبدأ المشكلة مع زيادة الطلبات، وخطوات بسيطة للتحقق من الطلب وتطبيق السياسة ومتابعة كل حالة.",
    ],
    intro: [
      "Most customers in Saudi Arabia would rather send a WhatsApp message than fill in a form or wait for an email. That is why many stores already handle returns there. The problem is not the channel; it is doing it by hand once orders grow.",
      "يفضّل معظم العملاء في السعودية إرسال رسالة واتساب على تعبئة نموذج أو انتظار بريد إلكتروني، ولهذا تدير متاجر كثيرة الإرجاع هناك أصلًا. المشكلة ليست في القناة، بل في إدارتها يدويًا عندما تكبر الطلبات.",
    ],
    sections: [
      {
        heading: ["Where manual WhatsApp returns break down", "أين تتعثر إدارة الإرجاع اليدوية عبر واتساب"],
        body: [
          [
            "The same questions repeat all day. Answers depend on who replies. Order numbers get lost in long chats. Nobody can say how many returns are open, and a customer who writes at night waits until morning.",
            "الأسئلة نفسها تتكرر طوال اليوم، والإجابة تختلف حسب من يرد، وأرقام الطلبات تضيع في المحادثات الطويلة. لا أحد يعرف كم طلب إرجاع مفتوح، والعميل الذي يكتب ليلًا ينتظر حتى الصباح.",
          ],
        ],
      },
      {
        heading: ["A simple process that scales", "خطوات بسيطة تكبر مع متجرك"],
        body: [
          [
            "Whether you use a tool or not, the same five steps keep returns calm and consistent:",
            "سواء استخدمت أداة أم لا، هذه الخطوات الخمس تجعل الإرجاع هادئًا ومتسقًا:",
          ],
        ],
        list: [
          ["Publish one WhatsApp link for returns and share it on order pages and receipts.", "انشر رابط واتساب واحدًا للإرجاع وشاركه في صفحات الطلب والفواتير."],
          ["Verify the customer owns the order before discussing details.", "تحقق من أن العميل صاحب الطلب قبل مناقشة التفاصيل."],
          ["Ask which item and why, and request a photo only when it helps.", "اسأل عن المنتج والسبب، واطلب صورة فقط عندما تفيد."],
          ["Check the request against your written policy, the same way every time.", "قارن الطلب بسياستك المكتوبة، بالطريقة نفسها في كل مرة."],
          ["Record the outcome as a case so your team can follow it to the end.", "سجّل النتيجة كحالة يتابعها فريقك حتى النهاية."],
        ],
      },
      {
        heading: ["Keep the merchant in control", "اجعل القرار بيد التاجر"],
        body: [
          [
            "Automation should handle the clear cases and hand over the unclear ones. A return decision is not a refund: the payout, and anything sensitive, should stay with your team.",
            "يجب أن تتعامل الأتمتة مع الحالات الواضحة وتحيل غير الواضحة. وقرار الإرجاع لا يعني الاسترداد: تحويل المبلغ وكل ما هو حساس يبقى بيد فريقك.",
          ],
          [
            "This is how Reload works: it verifies the order, applies the policy you published and records the case, while unclear requests go to you for review.",
            "هكذا يعمل ريلود: يتحقق من الطلب، ويطبّق السياسة التي نشرتها، ويسجّل الحالة، بينما تُحال الطلبات غير الواضحة إليك للمراجعة.",
          ],
        ],
      },
    ],
    related: ["how-it-works", "faq", "pricing"],
  },
  {
    slug: "reduce-returns",
    published: "2026-10-18",
    keyword: ["reduce returns in an online store", "تقليل المرتجعات في المتجر الإلكتروني"],
    title: [
      "7 practical ways to reduce returns in your online store",
      "7 طرق عملية لتقليل المرتجعات في متجرك الإلكتروني",
    ],
    description: [
      "Returns cost shipping, time and stock. Seven practical changes to product pages, sizing, packaging and customer support that prevent avoidable returns.",
      "المرتجعات تكلّف شحنًا ووقتًا ومخزونًا. سبع تغييرات عملية في صفحات المنتجات والمقاسات والتغليف وخدمة العملاء تمنع المرتجعات التي يمكن تجنبها.",
    ],
    intro: [
      "Some returns are part of selling online. Many are avoidable: the customer expected something different, chose the wrong size, or could not get a quick answer before buying. Each fix below targets one of those causes.",
      "بعض المرتجعات جزء طبيعي من البيع عبر الإنترنت، لكن كثيرًا منها يمكن تجنبه: توقّع العميل شيئًا مختلفًا، أو اختار مقاسًا خاطئًا، أو لم يجد إجابة سريعة قبل الشراء. كل خطوة أدناه تعالج سببًا من هذه الأسباب.",
    ],
    sections: [
      {
        heading: ["Fix the causes before the purchase", "عالج الأسباب قبل الشراء"],
        body: [],
        list: [
          ["Show real photos from several angles, including scale next to a familiar object.", "اعرض صورًا حقيقية من عدة زوايا، مع مقارنة الحجم بشيء مألوف."],
          ["Add a size guide with measurements in centimetres, not only S, M and L.", "أضف دليل مقاسات بالسنتيمتر، وليس فقط S وM وL."],
          ["Write honest descriptions: material, colour accuracy and what is in the box.", "اكتب أوصافًا صادقة: الخامة، ودقة اللون، ومحتويات العلبة."],
          ["Answer product questions quickly, including outside working hours.", "أجب عن أسئلة المنتجات بسرعة، حتى خارج أوقات العمل."],
        ],
      },
      {
        heading: ["Fix the causes after the purchase", "عالج الأسباب بعد الشراء"],
        body: [],
        list: [
          ["Package fragile items properly to avoid damage returns.", "غلّف المنتجات الحساسة جيدًا لتجنب المرتجعات بسبب التلف."],
          ["Send clear delivery updates so customers do not cancel out of uncertainty.", "أرسل تحديثات توصيل واضحة حتى لا يلغي العميل بسبب القلق."],
          ["Track return reasons by product and fix the top three first.", "تابع أسباب الإرجاع لكل منتج وابدأ بمعالجة أكثر ثلاثة أسباب تكرارًا."],
        ],
      },
      {
        heading: ["Measure, then improve", "قِس أولًا ثم حسّن"],
        body: [
          [
            "You cannot reduce what you do not record. Reload keeps every return as a case with its reason and outcome, so you can see which products and reasons repeat, and answers customer product questions on WhatsApp using information you approved.",
            "لا يمكنك تقليل ما لا تسجّله. يحفظ ريلود كل طلب إرجاع كحالة مع سببه ونتيجته، لترى المنتجات والأسباب المتكررة، ويجيب عن أسئلة العملاء حول المنتجات عبر واتساب بالمعلومات التي اعتمدتها.",
          ],
        ],
      },
    ],
    related: ["faq", "return-policy-template", "pricing"],
  },
];

export const GUIDES_COPY = {
  ar: {
    title: "أدلة التاجر | الإرجاع وخدمة العملاء عبر واتساب | ريلود",
    description:
      "أدلة عملية للمتاجر الإلكترونية في السعودية: كتابة سياسة الاسترجاع والاستبدال، وإدارة الإرجاع عبر واتساب، وتقليل المرتجعات.",
    heading: "أدلة عملية لإدارة المرتجعات وخدمة العملاء",
  },
  en: {
    title: "Merchant guides | Returns and WhatsApp support | Reload",
    description:
      "Practical guides for Saudi online stores: writing a return and exchange policy, handling returns on WhatsApp and reducing returns.",
    heading: "Practical guides to returns and customer support",
  },
} as const;

export const TOOL_COPY = {
  ar: {
    title: "نموذج سياسة الاسترجاع والاستبدال مجانًا | ريلود",
    description:
      "أنشئ سياسة استرجاع واستبدال واضحة لمتجرك الإلكتروني خلال دقيقة: مدة الإرجاع، حالة المنتج، الاستثناءات، الاسترداد وتكلفة الشحن. انسخها مجانًا.",
    heading: "نموذج سياسة الاسترجاع والاستبدال لمتجرك",
  },
  en: {
    title: "Free return and exchange policy template | Reload",
    description:
      "Create a clear return and exchange policy for your online store in a minute: return window, item condition, exclusions, refunds and shipping. Copy it free.",
    heading: "Return and exchange policy template for your store",
  },
} as const;

export function guideBySlug(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
