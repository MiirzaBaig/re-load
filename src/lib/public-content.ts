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
    q: [
      "How do Standard and Premium differ?",
      "ما الفرق بين ستاندرد وبريميوم؟",
    ],
    a: [
      "Standard covers return requests and policy checks, with 500 delivered outgoing messages each month. Premium adds customer support, approved store answers, supported product questions, verified order tracking and support tickets, with 2,000 messages each month.",
      "يشمل ستاندرد طلبات الإرجاع والتحقق من السياسة، مع 500 رسالة صادرة مسلّمة شهريًا. يضيف بريميوم خدمة العملاء وإجابات المتجر المعتمدة واستفسارات المنتجات المدعومة وتتبع الطلبات بعد التحقق وتذاكر الدعم، مع 2,000 رسالة شهريًا.",
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
