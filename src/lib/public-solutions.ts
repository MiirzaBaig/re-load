/** Public capability descriptions. Planned actions must remain labelled everywhere. */
export const SOLUTIONS = [
  {
    slug: "customer-support", title: ["Customer support", "خدمة العملاء"],
    headline: ["An answer that belongs to your store.", "إجابة من متجرك، وبأسلوبك."],
    description: ["Help customers with approved store answers, product information and verified order enquiries. Bring unclear questions to your team.", "ساعد عملاءك بإجابات متجرك المعتمدة ومعلومات المنتجات واستفسارات الطلبات بعد التحقّق. والأسئلة غير الواضحة تصل لفريقك."],
    steps: [["Prepare your answers", "جهّز إجاباتك"], ["Review and publish", "راجع واعتمد"], ["Follow conversations", "تابع المحادثات"]],
    detail: ["Import a public help page, paste text or answer guided questions. Imported content stays a draft until you approve it. The assistant uses approved sources, and merchant takeover pauses automated replies.", "استورد صفحة مساعدة عامة، أو الصق نصًا، أو أجب عن أسئلة موجّهة. تبقى المعلومات مسودة حتى تعتمدها. يعتمد المساعد على المصادر المعتمدة، وتتوقف الردود الآلية عند تولّي التاجر المحادثة."],
    boundary: ["Store data depends on your connected platform and permissions. Unknown answers need your team; the assistant must not invent a policy or promise.", "تعتمد بيانات المتجر على المنصة المرتبطة والصلاحيات. الإجابات غير المعروفة تحتاج فريقك، دون اختراع سياسة أو وعد للعميل."],
  },
  {
    slug: "returns", title: ["Return requests", "إدارة المرتجعات"],
    headline: ["A clear next step for every return.", "كل طلب إرجاع، وخطوته واضحة."],
    description: ["Verify the order, collect the return details and check them against the policy you approve. Keep exceptions with your team.", "تحقّق من الطلب، واجمع تفاصيل الإرجاع، وراجعها وفق السياسة التي تعتمدها. والحالات الاستثنائية تبقى بيد فريقك."],
    steps: [["Verify the order", "تحقّق من الطلب"], ["Check your policy", "راجع سياستك"], ["Resolve or review", "نتيجة أو مراجعة"]],
    detail: ["Customers enter through your store’s own WhatsApp link. A matching order phone, registered-order email code or merchant identity review protects private order details. Photos are optional supporting evidence, not proof of ownership.", "يدخل العميل عبر رابط واتساب الخاص بمتجرك. نحمي تفاصيل الطلب بمطابقة الهاتف، أو رمز للبريد المسجّل بالطلب، أو مراجعة التاجر للهوية. الصور دليل مساعد اختياري، وليست إثباتًا للملكية."],
    boundary: ["Published policy rules determine eligibility. Missing facts go to review. A return decision does not issue a refund or book a courier.", "تحدّد قواعد السياسة المنشورة أهلية الإرجاع. تُحال البيانات الناقصة للمراجعة. نتيجة الإرجاع لا تعني تنفيذ استرداد أو حجز شركة شحن."],
  },
  {
    slug: "sales", title: ["Product assistance", "مساعدة العملاء على الشراء"],
    headline: ["From a question to the right product.", "من سؤال، إلى المنتج المناسب."],
    description: ["Answer product questions and share real store links using available catalog information. Premium checkout assistance is in development.", "أجب عن أسئلة المنتجات وشارك روابطها الفعلية من معلومات الكتالوج المتاحة. مساعدة إتمام الشراء لبريميوم قيد التطوير."],
    steps: [["Understand the request", "افهم الطلب"], ["Check product facts", "تحقّق من المنتج"], ["Share the store link", "شارك رابط المتجر"]],
    detail: ["Product lookup can supply price, availability and options when the connection provides them. Exact size or color availability needs explicit variant data. Broader recommendations and saved shopping selections are being improved.", "يوفّر البحث سعر المنتج وتوفّره وخياراته عندما يتيحها الربط. توفّر مقاس أو لون معيّن يحتاج بيانات واضحة للخيار نفسه. نعمل على تحسين التوصيات وحفظ اختيارات العميل."],
    boundary: ["Recommendations and product links are planned for both subscriptions. Premium cart and checkout creation is not live yet. Customers will confirm their selection and pay through the merchant’s checkout; no automatic purchases or unapproved discounts.", "التوصيات وروابط المنتجات ضمن اتجاه الباقتين. إنشاء السلة ورابط الدفع لبريميوم غير متاح بعد. سيؤكّد العميل اختياره ويدفع عبر متجر التاجر، دون شراء تلقائي أو خصومات غير معتمدة."],
  },
  {
    slug: "shipping", title: ["Shipping with OTO", "الشحن عبر أوتو"],
    headline: ["The next step, after the decision.", "الخطوة التالية، بعد القرار."],
    description: ["Planned for Premium: merchant-approved return shipping and delivery for purchases completed through Reload’s WhatsApp agent.", "قريبًا لبريميوم: شحن المرتجعات بموافقة التاجر، وتوصيل المشتريات المكتملة عبر مساعد ريلود على واتساب."],
    steps: [["Review the quote", "راجع السعر"], ["Approve the booking", "وافق على الحجز"], ["Follow the shipment", "تابع الشحنة"]],
    detail: ["The planned flow uses a merchant warehouse, available courier quotes and explicit booking approval. Outbound shipping covers Reload-assisted purchases only, not all store orders. Courier availability depends on the route and service.", "يعتمد المسار المخطّط على مستودع التاجر وأسعار شركات الشحن المتاحة وموافقة واضحة على الحجز. يخص توصيل المشتريات طلبات ريلود فقط، وليس جميع طلبات المتجر. تختلف الشركات حسب المسار والخدمة."],
    boundary: ["Not available yet. Shipping fees are separate from subscriptions; funding arrangements remain under review. OTO requires customers to print return labels before collection. Courier delivery does not automatically trigger a refund.", "غير متاح حاليًا. رسوم الشحن منفصلة عن الاشتراك، وآلية التمويل قيد المراجعة. تتطلّب أوتو طباعة ملصق الإرجاع قبل الاستلام. تسليم الشحنة لا ينفّذ استرداد المبلغ تلقائيًا."],
  },
] as const;
export type Solution = typeof SOLUTIONS[number];
