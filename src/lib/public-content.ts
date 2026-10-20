// Public claims only. Do not add readiness promises, private offers or merchant data here.
export const PUBLIC_FAQS = [
  {
    q: ["What does Reload do?", "ما هو ريلود؟"],
    a: [
      "Reload helps merchants handle return requests and customer support through WhatsApp, using store information and policies approved by the merchant. The merchant follows conversations and cases in a shared workspace.",
      "يساعد ريلود التاجر على إدارة طلبات الإرجاع وخدمة العملاء عبر واتساب، بالاعتماد على معلومات المتجر وسياساته التي يعتمدها التاجر. ويتابع التاجر المحادثات والحالات من مساحة عمل واحدة.",
    ],
  },
  {
    q: ["How is Reload different from WhatsApp Business auto-replies?", "وش الفرق بين ريلود والرد الآلي في واتساب بزنس؟"],
    a: [
      "Auto-replies send the same fixed message to everyone. Reload understands the question, answers from your store’s products, orders and approved policies, verifies the customer before sharing order details, decides clear return requests by your policy and passes anything unclear to your team.",
      "الرد الآلي يرسل نفس الرسالة الثابتة للكل. أما ريلود فيفهم السؤال، ويرد من منتجات متجرك وطلباته وسياساتك المعتمدة، ويتحقق من العميل قبل مشاركة تفاصيل الطلب، ويحسم طلبات الإرجاع الواضحة حسب سياستك، واللي مو واضح يحوّله لفريقك.",
    ],
  },
  {
    q: ["Does Reload accept or reject returns by itself?", "هل ريلود يقبل أو يرفض الإرجاع بنفسه؟"],
    a: [
      "Only by the policy you approved. Clear cases get a result straight away: accepted or not eligible, with the reason. Missing information, damage or anything unusual comes to you for review, and your team handles the next action.",
      "فقط حسب السياسة اللي اعتمدتها. الحالات الواضحة تاخذ نتيجتها مباشرة: مقبول أو غير مؤهل مع السبب. والمعلومات الناقصة أو العيوب أو أي حالة استثنائية توصلك للمراجعة، وفريقك يتولّى الخطوة التالية.",
    ],
  },
  {
    q: ["Can I reply to my customers myself?", "هل أقدر أرد على عملائي بنفسي؟"],
    a: [
      "Yes. Open any conversation in your dashboard and take over; Reload steps back while you reply. WhatsApp’s messaging rules apply, so free-form replies work within the customer service window.",
      "إيه. افتح أي محادثة من لوحة التاجر واستلمها، وريلود يوقف وأنت ترد. وتنطبق قواعد واتساب للرسائل، فالرد الحر يكون خلال نافذة خدمة العملاء.",
    ],
  },
  {
    q: ["How does a customer ask for a return?", "كيف يطلب العميل الإرجاع؟"],
    a: [
      "They open your store’s WhatsApp link and say they want to return something. Reload verifies the order, asks which item and why, and the customer can add a photo if it helps. The result arrives in the same chat.",
      "يفتح رابط واتساب متجرك ويقول إنه يبي يرجّع منتج. ريلود يتحقق من الطلب، ويسأله عن المنتج والسبب، ويقدر العميل يضيف صورة إذا تفيد. والنتيجة توصله في نفس المحادثة.",
    ],
  },
  {
    q: ["Are return labels included in every plan?", "هل إصدار بوليصات الإرجاع موجود في كل الباقات؟"],
    a: [
      "Return shipping through OTO is being prepared for Premium and is not available yet. Merchants will review the courier and charge before booking. Standard covers support and return decisions; courier charges remain separate.",
      "شحن الإرجاع عبر أوتو قيد التجهيز لبريميوم وغير متاح بعد. سيراجع التاجر الشركة والتكلفة قبل الحجز. ستاندرد يشمل الدعم وقرارات الإرجاع، ورسوم الشحن منفصلة.",
    ],
  },
  /* Previous answer (Codex, 2026-10-20), kept for review:
  {
    q: [
      "How do Standard and Premium differ?",
      "ما الفرق بين ستاندرد وبريميوم؟",
    ],
    a: [
      "Both plans cover returns and customer support, including approved answers, supported product questions and links, verified tracking and tickets. Standard includes 500 delivered outgoing messages monthly; Premium includes 2,000. Premium cart/checkout creation and OTO shipping are in development, not available yet. Courier charges will be separate.",
      "تشمل الباقتان الإرجاع وخدمة العملاء والإجابات المعتمدة وأسئلة المنتجات وروابطها المدعومة والتتبّع بعد التحقّق وتذاكر الدعم. يشمل ستاندرد 500 رسالة صادرة مسلّمة شهريًا، وبريميوم 2,000. إنشاء السلة والدفع وشحن أوتو لبريميوم قيد التطوير وغير متاح بعد. رسوم الشحن ستكون منفصلة.",
    ],
  },
  */
  {
    q: [
      "How do Standard and Premium differ?",
      "ما الفرق بين ستاندرد وبريميوم؟",
    ],
    a: [
      "Both plans include customer support, returns management, product suggestions with links, your dashboard and replying yourself. Standard includes 500 delivered outgoing messages a month; Premium includes 2,000. Merchant-approved OTO shipping and cart/payment links are being prepared for Premium, not live yet. Courier charges are separate.",
      "تشمل الباقتان خدمة العملاء وإدارة المرتجعات واقتراح المنتجات وروابطها ولوحة التاجر والرد بنفسك. يشمل ستاندرد 500 رسالة صادرة مسلّمة شهريًا، وبريميوم 2,000. شحن أوتو بموافقة التاجر وإنشاء السلة وروابط الدفع قيد التجهيز لبريميوم وغير متاحة بعد. رسوم شركة الشحن منفصلة.",
    ],
  },
  {
    q: [
      "Can I prepare my store before paying?",
      "هل أستطيع تجهيز متجري قبل الدفع؟",
    ],
    a: [
      "Yes. You can sign up, connect your store and prepare policies and answers for free. Customer-facing assistant access requires a verified subscription payment or an explicitly approved pilot arrangement. Live payment activation is being prepared.",
      "نعم. يمكنك التسجيل وربط متجرك وتجهيز السياسات والإجابات مجانًا. يتطلب تفعيل مساعد العملاء دفعة اشتراك مؤكدة أو وصولًا تجريبيًا معتمدًا بشكل صريح. يجري تجهيز تفعيل الدفع الفعلي.",
    ],
  },
  {
    q: [
      "What counts toward my message allowance?",
      "ما الرسائل التي تُحتسب من الرصيد؟",
    ],
    a: [
      "Delivered outgoing messages count, rather than customers or conversations. Incoming customer messages do not. Messages awaiting delivery confirmation temporarily reserve capacity; confirmed failed sends release it. Marketing campaigns and shipping fees are excluded.",
      "تُحتسب الرسائل الصادرة التي تم تسليمها، وليس عدد العملاء أو المحادثات. لا تُحتسب رسائل العملاء الواردة. تحجز الرسائل بانتظار تأكيد التسليم جزءًا من الرصيد مؤقتًا، ويُعاد عند تأكيد فشل الإرسال. الحملات التسويقية ورسوم الشحن غير مشمولة.",
    ],
  },
  {
    q: ["How does annual billing work?", "كيف يعمل الاشتراك السنوي؟"],
    a: [
      "Annual Standard costs SAR 1,430.40 and annual Premium SAR 2,870.40, including VAT and paid upfront. This is 20% below twelve monthly payments. The allowance still refreshes monthly: 500 messages for Standard or 2,000 for Premium. Unused included messages do not carry over.",
      "يبلغ سعر ستاندرد السنوي 1,430.40 ريال وبريميوم السنوي 2,870.40 ريال، شامل الضريبة ويُدفع مقدمًا. هذا خصم 20٪ مقارنة بالدفع الشهري لمدة سنة. يتجدد الرصيد شهريًا: 500 رسالة لستاندرد أو 2,000 لبريميوم. لا ينتقل المتبقي من الرصيد المشمول.",
    ],
  },
  {
    q: [
      "What happens when I reach the limit?",
      "ماذا يحدث عند انتهاء رصيد الرسائل؟",
    ],
    a: [
      "Standard merchants can upgrade to Premium. If Premium reaches its limit, contact Reload to discuss capacity. Extra message bundles are not available yet. Your workspace and saved records remain accessible.",
      "يمكن لمشتركي ستاندرد الترقية إلى بريميوم. عند بلوغ حد بريميوم، تواصل مع ريلود لترتيب الرصيد المناسب. باقات الرسائل الإضافية غير متاحة حاليًا. تبقى مساحة العمل والسجلات المحفوظة متاحة.",
    ],
  },
  {
    q: [
      "How do customers find the right store?",
      "كيف يصل العميل إلى المتجر الصحيح؟",
    ],
    a: [
      "Each merchant shares a unique WhatsApp link or QR code. The customer opens it and sends the prepared message so Reload can identify the store. A store link routes the conversation; it does not prove ownership of an order.",
      "يشارك كل تاجر رابط واتساب أو رمز استجابة سريعة خاصًا بمتجره. يفتحه العميل ويرسل الرسالة الجاهزة ليعرف ريلود المتجر المطلوب. يوجّه الرابط المحادثة، لكنه لا يثبت ملكية الطلب.",
    ],
  },
  {
    q: ["How is order ownership checked?", "كيف يتم التحقق من صاحب الطلب؟"],
    a: [
      "Reload checks whether the WhatsApp number matches the order phone. If it does not, the customer can verify through the email saved on the order. If that is unavailable, the merchant reviews the customer’s identity in the dashboard before access to private order information continues.",
      "يتحقق ريلود من تطابق رقم واتساب مع الهاتف المسجل في الطلب. إذا لم يتطابقا، يستطيع العميل التحقق عبر البريد المسجل في الطلب. وإذا تعذّر ذلك، يراجع التاجر هوية العميل من لوحة التحكم قبل إتاحة معلومات الطلب الخاصة.",
    ],
  },
  {
    q: [
      "Does the assistant decide everything by itself?",
      "هل يتخذ المساعد جميع القرارات وحده؟",
    ],
    a: [
      "No. Merchants approve store answers and return policies before use. Return eligibility follows those published rules. Unclear cases go for review, and photo analysis is optional supporting evidence. Reload does not automatically publish new answers from conversations.",
      "لا. يعتمد التاجر إجابات المتجر وسياسات الإرجاع قبل استخدامها. تتبع أهلية الإرجاع هذه القواعد المنشورة. تُحال الحالات غير الواضحة للمراجعة، وتحليل الصور دليل مساعد اختياري. لا ينشر ريلود إجابات جديدة تلقائيًا من المحادثات.",
    ],
  },
  /* Previous answer, kept for review:
  {
    q: [
      "Does Reload issue refunds or book shipping automatically?",
      "هل ينفّذ ريلود الاسترداد أو يحجز الشحن تلقائيًا؟",
    ],
    a: [
      "Reload helps organize and assess return requests. Refund payouts and shipping bookings are not included as automatic actions today. The merchant remains responsible for operational approvals and completion.",
      "يساعد ريلود على تنظيم طلبات الإرجاع وتقييمها. لا يشمل التنفيذ الحالي تحويل مبالغ الاسترداد أو حجز الشحن تلقائيًا. يبقى التاجر مسؤولًا عن الموافقات التشغيلية وإتمامها.",
    ],
  },
  */
  {
    q: [
      "Does Reload issue refunds or book shipping?",
      "هل ينفّذ ريلود الاسترداد أو يحجز الشحن؟",
    ],
    a: [
      "Refunds stay with you: an accepted return is a decision, not a payout. On Premium, Reload issues the return label for accepted returns through OTO and keeps the shipment linked to the return case. Courier charges are paid by your store or your customer, according to your policy.",
      "الاسترداد يبقى بيدك: قبول الإرجاع قرار وليس تحويل مبلغ. وفي بريميوم يصدر ريلود بوليصة الإرجاع للطلبات المقبولة عبر أوتو، وتبقى الشحنة مرتبطة بحالة المرتجع. ورسوم شركة الشحن يدفعها متجرك أو عميلك حسب سياستك.",
    ],
  },
  {
    q: ["Can I use my store’s own WhatsApp number?", "هل أستخدم رقم واتساب متجري؟"],
    a: ["Customers currently contact a shared Reload WhatsApp number through your store’s unique link. Connecting your own number is not available yet.", "يتواصل العملاء حاليًا مع رقم واتساب موحّد لريلود عبر رابط متجرك الخاص. ربط رقم واتساب خاص بمتجرك غير متاح بعد."],
  },
  {
    q: ["Which store information does Reload use?", "ما معلومات المتجر التي تستخدمها ريلود؟"],
    a: ["Reload uses the product and order information available through your authorized connection and the answers and policies you approve. Available permissions depend on the platform. Order ownership is verified before private order information is shared.", "تستخدم ريلود معلومات المنتجات والطلبات المتاحة عبر الربط المصرّح به، والإجابات والسياسات التي تعتمدها. تختلف الصلاحيات حسب المنصة. نتحقّق من صاحب الطلب قبل مشاركة معلوماته الخاصة."],
  },
  {
    q: ["Can I upgrade or cancel?", "هل أستطيع الترقية أو الإلغاء؟"],
    a: [
      "Billing shows the proportional Standard-to-Premium upgrade charge before payment. Monthly/yearly changes take effect at the next renewal. Cancellation stops the next renewal and preserves time already paid. Refund requests are separate from cancellation and follow the applicable terms.",
      "تعرض الفوترة تكلفة الترقية النسبية من ستاندرد إلى بريميوم قبل الدفع. يبدأ تغيير الدفع الشهري أو السنوي عند التجديد التالي. يوقف الإلغاء التجديد القادم مع حفظ الفترة المدفوعة. طلب الاسترداد المالي منفصل عن الإلغاء ويخضع للشروط المطبّقة.",
    ],
  },
] as const;
export const PUBLIC_STEPS = [
  {
    title: ["Connect your store", "اربط متجرك"],
    body: [
      "Create a workspace and connect the available store integration. Check order and product access before sharing your customer link.",
      "أنشئ مساحة عمل واربط تكامل المتجر المتاح. تحقق من الوصول إلى الطلبات والمنتجات قبل مشاركة رابط العملاء.",
    ],
  },
  {
    title: ["Approve your answers and policy", "اعتمد الإجابات والسياسة"],
    body: [
      "Import a public page, paste your information or use guided questions. Imports create drafts. Review and publish the information you want the assistant to use.",
      "استورد صفحة عامة، أو أضف معلوماتك، أو استخدم الأسئلة الموجّهة. ينشئ الاستيراد مسودات. راجع المعلومات وانشر ما تريد للمساعد استخدامه.",
    ],
  },
  {
    title: ["Choose a plan and share your link", "اختر اشتراكًا وشارك الرابط"],
    body: [
      "Choose Standard for returns or Premium for returns and support. Once access is activated, share your store’s unique WhatsApp link or QR code.",
      "اختر ستاندرد للإرجاع أو بريميوم للإرجاع وخدمة العملاء. بعد تفعيل الوصول، شارك رابط واتساب أو رمز الاستجابة السريعة الخاص بمتجرك.",
    ],
  },
  {
    title: ["Help the customer, with verification", "اخدم العميل مع التحقق"],
    body: [
      "A product question uses available product information. Private order questions and returns require identity verification. The customer can optionally add a photo when useful.",
      "تستخدم أسئلة المنتجات المعلومات المتاحة عنها. تتطلب استفسارات الطلب الخاصة والإرجاع التحقق من الهوية. ويمكن للعميل إضافة صورة اختياريًا عند الحاجة.",
    ],
  },
  {
    title: [
      "Follow the case and step in when needed",
      "تابع الحالة وتدخّل عند الحاجة",
    ],
    body: [
      "View conversations, return cases and support tickets. Review exceptions and take over a conversation when needed. The merchant approves sensitive operational actions.",
      "تابع المحادثات وحالات الإرجاع وتذاكر الدعم. راجع الاستثناءات وتولَّ المحادثة عند الحاجة. يعتمد التاجر الإجراءات التشغيلية الحساسة.",
    ],
  },
] as const;
