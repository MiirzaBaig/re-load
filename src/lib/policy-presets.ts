import type { PolicyPreset } from "@/components/return-policy-generator";

// Return-policy templates per store type. Each one has real differences
// (defaults, extra conditions/exclusions, tips); no thin copy-paste pages.
// Practical guidance only, not legal advice. Each text is [English, Arabic].

type Pair = readonly [string, string];

export type PolicyCategory = {
  slug: string;
  name: Pair;
  title: Pair;
  description: Pair;
  intro: Pair;
  tips: ReadonlyArray<Pair>;
  preset: PolicyPreset;
};

export const POLICY_CATEGORIES: ReadonlyArray<PolicyCategory> = [
  {
    slug: "fashion",
    name: ["Fashion and clothing stores", "متاجر الأزياء والملابس"],
    title: ["Return policy template for fashion and clothing stores", "نموذج سياسة الاسترجاع لمتاجر الأزياء والملابس"],
    description: [
      "A free return and exchange policy for clothing stores: size exchanges, tags, try-on condition and underwear exclusions. Ready in Arabic or English.",
      "سياسة استرجاع واستبدال مجانية لمتاجر الملابس: استبدال المقاسات، البطاقات، حالة القياس، واستثناء الملابس الداخلية. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "Most fashion returns are about size and fit, not quality. A good clothing policy makes size exchanges easy, so a wrong size becomes a second sale instead of a refund.",
      "معظم مرتجعات الأزياء سببها المقاس وليس الجودة. السياسة الجيدة لمتجر الملابس تجعل استبدال المقاس سهلًا، فيتحول المقاس الخاطئ إلى بيع ثانٍ بدل استرداد المبلغ.",
    ],
    tips: [
      ["Offer free size exchanges even if refunds have a shipping fee.", "قدّم استبدال المقاس مجانًا حتى لو كان للاسترداد رسوم شحن."],
      ["Say that items can be tried on, but must keep their tags and show no wear, perfume or washing.", "وضّح أن القياس مسموح، مع بقاء البطاقات وعدم وجود آثار استخدام أو عطر أو غسيل."],
      ["Link your size guide from the policy; it prevents the most common return.", "اربط دليل المقاسات من السياسة؛ فهو يمنع أكثر أسباب الإرجاع شيوعًا."],
    ],
    preset: {
      days: "14",
      exchangeDays: "30",
      conditions: ["unused", "tags", "packaging", "notworn"],
      exclusions: ["underwear", "custom", "sale"],
      extraConditions: [["notworn", "Not worn outside, washed or scented with perfume", "غير ملبوس خارج المنزل، وغير مغسول، وبدون رائحة عطر"]],
      shipping: "split",
    },
  },
  {
    slug: "abayas",
    name: ["Abaya stores", "متاجر العبايات"],
    title: ["Return policy template for abaya stores", "نموذج سياسة الاسترجاع لمتاجر العبايات"],
    description: [
      "A free return and exchange policy for abaya stores: tailored lengths, embroidery, size exchanges and custom orders. Ready in Arabic or English.",
      "سياسة استرجاع واستبدال مجانية لمتاجر العبايات: الأطوال المفصّلة، التطريز، استبدال المقاسات، والطلبات الخاصة. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "Abaya stores often mix ready-made pieces with tailored lengths. The policy should separate the two clearly, because a custom length usually cannot be resold.",
      "تجمع متاجر العبايات غالبًا بين القطع الجاهزة والأطوال المفصّلة. يجب أن تفصل السياسة بينهما بوضوح، لأن الطول المفصّل لا يمكن إعادة بيعه عادةً.",
    ],
    tips: [
      ["State that tailored lengths and custom embroidery are final, before the customer orders.", "وضّح قبل الطلب أن الأطوال المفصّلة والتطريز الخاص غير قابلة للإرجاع."],
      ["Allow exchanges on ready-made sizes, with tags and the original bag or box.", "اسمح باستبدال المقاسات الجاهزة مع البطاقات والكيس أو العلبة الأصلية."],
      ["Ask for a photo when a customer reports a fabric or stitching issue.", "اطلب صورة عندما تبلغ العميلة عن مشكلة في القماش أو الخياطة."],
    ],
    preset: {
      days: "7",
      exchangeDays: "14",
      conditions: ["unused", "tags", "packaging", "notworn"],
      exclusions: ["custom", "tailored", "sale"],
      extraConditions: [["notworn", "Not worn outside, washed or scented with perfume", "غير ملبوس خارج المنزل، وغير مغسول، وبدون رائحة عطر"]],
      extraExclusions: [["tailored", "Abayas tailored to a requested length", "العبايات المفصّلة حسب الطول المطلوب"]],
      shipping: "split",
    },
  },
  {
    slug: "perfumes",
    name: ["Perfume stores", "متاجر العطور"],
    title: ["Return policy template for perfume stores", "نموذج سياسة الاسترجاع لمتاجر العطور"],
    description: [
      "A free return policy for perfume and oud stores: sealed bottles, opened or tested items, samples and damaged deliveries. Ready in Arabic or English.",
      "سياسة استرجاع مجانية لمتاجر العطور والعود: العبوات المغلقة، المنتجات المفتوحة أو المجرّبة، العينات، والشحنات التالفة. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "Perfume cannot be resold once opened, so the key rule is simple: sealed and unopened can be returned; opened cannot, unless it arrived damaged or wrong.",
      "لا يمكن إعادة بيع العطر بعد فتحه، لذلك القاعدة الأساسية بسيطة: المغلق وغير المفتوح يمكن إرجاعه، والمفتوح لا يمكن، إلا إذا وصل تالفًا أو خاطئًا.",
    ],
    tips: [
      ["Make the seal or cellophane the clear line between returnable and not.", "اجعل الختم أو الغلاف البلاستيكي هو الحد الواضح بين ما يُرجع وما لا يُرجع."],
      ["Offer samples so customers can try a scent before buying a full bottle.", "قدّم عينات ليجرب العميل الرائحة قبل شراء العبوة الكاملة."],
      ["Ask for a photo within 48 hours for leaking or broken bottles.", "اطلب صورة خلال 48 ساعة للعبوات المسرّبة أو المكسورة."],
    ],
    preset: {
      days: "7",
      exchange: true,
      exchangeDays: "7",
      conditions: ["sealed", "packaging"],
      exclusions: ["opened", "samples", "sale"],
      extraConditions: [["sealed", "Sealed, with the original cellophane intact", "مغلق، والغلاف البلاستيكي الأصلي سليم"]],
      extraExclusions: [
        ["opened", "Opened or tested perfumes and oud", "العطور والعود بعد فتحها أو تجربتها"],
        ["samples", "Samples and decants", "العينات والعبوات المقسّمة"],
      ],
      shipping: "split",
    },
  },
  {
    slug: "cosmetics",
    name: ["Cosmetics and skincare stores", "متاجر مستحضرات التجميل والعناية"],
    title: ["Return policy template for cosmetics and skincare stores", "نموذج سياسة الاسترجاع لمتاجر مستحضرات التجميل والعناية بالبشرة"],
    description: [
      "A free return policy for beauty stores: sealed products, hygiene exclusions, allergic reactions and expired or damaged items. Ready in Arabic or English.",
      "سياسة استرجاع مجانية لمتاجر التجميل: المنتجات المغلقة، استثناءات النظافة، الحساسية، والمنتجات المنتهية أو التالفة. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "For hygiene reasons, opened beauty products usually cannot be returned. Customers accept this when the policy says it clearly and treats damaged or expired items fairly.",
      "لأسباب صحية، لا يمكن عادةً إرجاع منتجات التجميل بعد فتحها. ويتقبّل العملاء ذلك عندما تقوله السياسة بوضوح وتتعامل بعدل مع المنتجات التالفة أو المنتهية.",
    ],
    tips: [
      ["Say that expired or near-expiry products on arrival can always be returned.", "وضّح أن المنتج المنتهي أو القريب من الانتهاء عند الاستلام يمكن إرجاعه دائمًا."],
      ["List shade and colour clearly on product pages to avoid “wrong shade” returns.", "اعرض درجة اللون بوضوح في صفحة المنتج لتجنب المرتجعات بسبب اللون."],
      ["Explain what happens if a customer has a skin reaction; offer to review case by case.", "وضّح ما يحدث عند حدوث حساسية للعميل، مع مراجعة كل حالة على حدة."],
    ],
    preset: {
      days: "7",
      exchange: false,
      conditions: ["sealed", "packaging"],
      exclusions: ["care", "sale"],
      extraConditions: [["sealed", "Sealed and unopened", "مغلق وغير مفتوح"]],
      shipping: "split",
    },
  },
  {
    slug: "electronics",
    name: ["Electronics stores", "متاجر الإلكترونيات"],
    title: ["Return policy template for electronics stores", "نموذج سياسة الاسترجاع لمتاجر الإلكترونيات"],
    description: [
      "A free return policy for electronics stores: factory seals, serial numbers, accessories, activated devices and defects. Ready in Arabic or English.",
      "سياسة استرجاع مجانية لمتاجر الإلكترونيات: ختم المصنع، الرقم التسلسلي، الملحقات، الأجهزة المفعّلة، والعيوب المصنعية. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "Electronics returns depend on whether the device was opened and activated. A clear policy separates “changed my mind” returns from defects covered by warranty.",
      "تعتمد مرتجعات الإلكترونيات على فتح الجهاز وتفعيله. السياسة الواضحة تفصل بين الإرجاع لتغيير الرأي وبين العيوب المشمولة بالضمان.",
    ],
    tips: [
      ["Check that the serial number on the returned device matches the order.", "تحقق من تطابق الرقم التسلسلي للجهاز المُرجع مع الطلب."],
      ["Ask customers to keep all accessories, manuals and the box until the return window ends.", "اطلب من العميل الاحتفاظ بجميع الملحقات والدليل والعلبة حتى نهاية مدة الإرجاع."],
      ["Point defects after the return window to the manufacturer warranty.", "وجّه العيوب بعد انتهاء مدة الإرجاع إلى ضمان الشركة المصنعة."],
    ],
    preset: {
      days: "7",
      exchange: true,
      exchangeDays: "14",
      conditions: ["unused", "packaging", "accessories", "serial"],
      exclusions: ["activated", "digital", "sale"],
      extraConditions: [["serial", "With a serial number matching the invoice", "برقم تسلسلي مطابق للفاتورة"]],
      extraExclusions: [["activated", "Devices that were activated or linked to an account, unless defective", "الأجهزة المفعّلة أو المرتبطة بحساب، إلا في حال وجود عيب"]],
      shipping: "split",
    },
  },
  {
    slug: "kids",
    name: ["Kids and baby stores", "متاجر الأطفال والمواليد"],
    title: ["Return policy template for kids and baby stores", "نموذج سياسة الاسترجاع لمتاجر الأطفال والمواليد"],
    description: [
      "A free return policy for kids and baby stores: toys, baby clothes, feeding items, hygiene exclusions and safety recalls. Ready in Arabic or English.",
      "سياسة استرجاع مجانية لمتاجر الأطفال: الألعاب، ملابس المواليد، أدوات الرضاعة، استثناءات النظافة، وسحب المنتجات لأسباب السلامة. جاهزة بالعربية أو الإنجليزية.",
    ],
    intro: [
      "Parents buy quickly and return often, especially sizes and gifts. Keep exchanges easy for clothes and toys, and exclude feeding and hygiene items once opened.",
      "يشتري الأهل بسرعة ويُرجعون كثيرًا، خاصة المقاسات والهدايا. اجعل استبدال الملابس والألعاب سهلًا، واستثنِ أدوات الرضاعة والنظافة بعد فتحها.",
    ],
    tips: [
      ["Offer gift exchanges without a receipt using the order number.", "اسمح باستبدال الهدايا برقم الطلب دون الحاجة إلى الفاتورة."],
      ["Exclude bottles, pacifiers and teethers once opened, for hygiene.", "استثنِ الرضّاعات واللهايات والعضّاضات بعد فتحها لأسباب صحية."],
      ["Say clearly that safety-related problems are always accepted.", "وضّح أن المشاكل المتعلقة بالسلامة مقبولة دائمًا."],
    ],
    preset: {
      days: "14",
      exchangeDays: "30",
      conditions: ["unused", "packaging", "tags"],
      exclusions: ["feeding", "custom", "sale"],
      extraExclusions: [["feeding", "Bottles, pacifiers and teethers once opened", "الرضّاعات واللهايات والعضّاضات بعد فتحها"]],
      shipping: "split",
    },
  },
];

export function policyCategory(slug: string) {
  return POLICY_CATEGORIES.find((c) => c.slug === slug);
}
