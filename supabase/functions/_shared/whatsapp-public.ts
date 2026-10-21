/** Public Reload information only: no AI calls, merchant reads or order access. */
export type PublicLanguage = "ar" | "en";
export const publicActions = ["reload", "public_language_ar", "public_language_en", ...["explore", "pricing", "start", "order", "team", "menu"].flatMap(action => [`public_${action}_ar`, `public_${action}_en`])];
export function isPublicEntry(input: string) { return publicActions.includes(input.trim().toLowerCase()); }
export function publicReply(input: string, previous: PublicLanguage = "ar", invalidRoute = false) {
  const text = input.trim().toLowerCase();
  const language: PublicLanguage = /(?:_en)$/.test(text) || /^(english|en)$/i.test(text) ? "en"
    : /(?:_ar)$/.test(text) || /[\u0600-\u06ff]/.test(text) ? "ar"
    : /[a-z]/i.test(text) && text !== "reload" ? "en" : previous;
  const ar = language === "ar";
  const button = (action: string, title: string) => ({ id: `public_${action}_${language}`, title });
  const menu = [button("explore", ar ? "تعرّف على ريلود" : "Explore Reload"), button("order", ar ? "مساعدة بخصوص طلب" : "Help with an order"), button("team", ar ? "تواصل مع فريقنا" : "Contact our team")];
  let body: string;
  let buttons = menu;
  if (invalidRoute || /public_order_|\b(order|parcel|tracking|refund|return|missing|delivery)\b|طلب|طلبي|شحن|إرجاع|ارجاع|استرجاع/.test(text)) {
    body = ar
      ? `${invalidRoute ? "ما قدرنا نفتح رابط المتجر هذا. " : "أكيد، نساعدك! "}افتح رابط واتساب اللي شاركه معك المتجر وأرسل الرسالة الجاهزة، أو أرسل رمز المتجر هنا مثل RL-XXXXXXXXXX.\n\nما عندك الرابط؟ اطلبه من المتجر. لا ترسل بيانات الدفع أو رمز التحقق هنا؛ نحدد المتجر أولًا، وبعدها نتحقق من طلبك بأمان.`
      : `${invalidRoute ? "We couldn’t open that store link. " : "Of course! "}Open the WhatsApp link your store shared and send its prefilled message, or send its store code here, like RL-XXXXXXXXXX.\n\nDon’t have the link? Ask your store for it. Please don’t send payment details or verification codes here; we’ll identify your store first, then verify your order securely.`;
  } else if (/public_pricing_|\b(price|prices|pricing|cost|much|annual|yearly|monthly|plans?)\b|سعر|أسعار|اسعار|بكم|كم سعر|كم تكلفة|باق|اشتراك/.test(text)) {
    body = ar
      ? "بكل وضوح 👋\nستاندرد: 149 ر.س شهريًا، وتشمل 500 رسالة صادرة.\nبريميوم: 299 ر.س شهريًا، وتشمل 2,000 رسالة صادرة.\n\nالباقتان تشملان خدمة العملاء والإرجاع والمساعدة في اختيار المنتجات. الأسعار شاملة الضريبة. الدفع السنوي يوفر 20٪: ستاندرد 1,430.40 ر.س، وبريميوم 2,870.40 ر.س، مع تجدد رصيد الرسائل شهريًا.\n\nشوف التفاصيل: https://www.reload.sa/ar/pricing"
      : "Here’s the pricing 👋\nStandard: SAR 149/month, including 500 outgoing messages.\nPremium: SAR 299/month, including 2,000 outgoing messages.\n\nBoth include customer support, returns and product assistance. Prices include VAT. Annual billing saves 20%: Standard SAR 1,430.40/year and Premium SAR 2,870.40/year, with message allowances refreshed monthly.\n\nCompare plans: https://www.reload.sa/en/pricing";
    buttons = [button("start", ar ? "ابدأ تجهيز متجرك" : "Set up my store"), button("team", ar ? "عندي سؤال" : "Ask our team"), {id: ar ? "public_language_en" : "public_language_ar", title: ar ? "English" : "العربية"}];
  } else if (/public_team_|\b(human|person|team|contact|agent)\b|موظف|فريق|بشري|تواصل/.test(text)) {
    body = ar ? "حاضرين! تقدر تترك سؤالك وبيانات التواصل في النموذج، أو تراسلنا بالإيميل:\nhttps://www.reload.sa/interest\ninfo@reload.sa\n\nهذا رابط للتواصل مع فريق ريلود، وليس فريق المتجر اللي اشتريت منه."
      : "Happy to help! Leave your question and contact details in our form, or email us:\nhttps://www.reload.sa/interest\ninfo@reload.sa\n\nThis reaches the Reload team. For help with a purchase, choose ‘Help with an order’ to reach the right store.";
  } else if (/public_start_|\b(signup|sign up|start|join|connect|setup|set up|zid|salla|shopify)\b|ابدأ|ابدا|سجل|تسجيل|ربط|زد|سلة|شوبيفاي/.test(text)) {
    body = ar ? "يا هلا بمتجرك! 👋\nابدأ هنا: https://www.reload.sa/auth\n\nأنشئ حسابك، وجهّز اتصال المتجر، وأضف إجاباتك وسياسة الإرجاع واعتمدها. التجهيز مجاني؛ تفعيل مساعد العملاء يحتاج اشتراكًا مدفوعًا واتصال متجر جاهزًا. توفّر الربط يختلف حسب المنصة، وبتشوف الخيارات في صفحة التكاملات.\n\nتقدر تراجع الباقات قبل ما تقرر."
      : "Welcome aboard! 👋\nStart here: https://www.reload.sa/auth\n\nCreate your account, prepare your store connection, then add and approve your answers and return policy. Setup is free; activating the customer assistant needs a paid subscription and a ready store connection. Connection availability depends on your platform; check Integrations for the available options.\n\nYou can review the plans before deciding.";
    buttons = [button("pricing", ar ? "شوف الباقات" : "See the plans"), button("team", ar ? "تواصل مع فريقنا" : "Contact our team"), button("menu", ar ? "رجوع" : "Back")];
  } else if (/public_explore_|\b(store|merchant|shop|business|reload|features?|what|how)\b|متجر|تاجر|ريلود|وش|ايش|ماذا|كيف/.test(text) && text !== "reload") {
    body = ar ? "ريلود يساعد متجرك يخدم عملاءه على واتساب 👋\n\nنرد من معلومات متجرك المعتمدة، نساعد في أسئلة المنتجات، ونتابع الطلبات وطلبات الإرجاع بعد التحقق. أنت تعتمد الإجابات والسياسات، والقرارات اللي تحتاج موافقتك تبقى لك.\n\nتبغى تشوف الباقات أو تبدأ تجهيز متجرك؟"
      : "Reload helps your store look after customers on WhatsApp 👋\n\nIt answers from your approved store information, helps with product questions, and handles order enquiries and return requests after verification. You approve the answers and policies, and decisions that need your approval stay with you.\n\nWant to see the plans or set up your store?";
    buttons = [button("pricing", ar ? "شوف الباقات" : "See the plans"), button("start", ar ? "عندي متجر" : "I run a store"), button("team", ar ? "تواصل مع فريقنا" : "Contact our team")];
  } else {
    body = ar ? "هلا، حيّاك في ريلود! 👋\nنساعد المتاجر تخدم عملاءها على واتساب، من أسئلة المنتجات إلى الطلبات والإرجاع.\n\nوش حاب تعرف؟ اختر من الخيارات أو اكتب سؤالك.\nFor English, type English."
      : "Hey, welcome to Reload! 👋\nWe help online stores support customers on WhatsApp, from product questions to orders and returns.\n\nWhat brings you here? Choose below, or type your question.\nللعربية، اكتب عربي.";
  }
  return { language, body, buttons };
}
