/** Public Reload information only: no AI calls, merchant reads or order access. */
export type PublicLanguage = "ar" | "en";
type PublicTopic = "menu" | "explore" | "pricing" | "start" | "order" | "team" | "knowledge";
const topics: PublicTopic[] = ["explore", "pricing", "start", "order", "team", "menu", "knowledge"];
export const publicActions = ["reload", "public_language_ar", "public_language_en", "public_change_language",
  ...topics.flatMap(action => [`public_${action}_ar`, `public_${action}_en`])];
export function isPublicEntry(input: string) { return publicActions.includes(input.trim().toLowerCase()); }

function languageChoice(input: string): PublicLanguage | undefined {
  const text = input.replace(/[!?.،؟]+$/g, "").trim();
  if (/^(please )?(can we |can you |could you )?(speak|reply|respond|continue|switch|use)( to| in)? english( please)?$/.test(text)) return "en";
  if (/^(please )?(can we |can you |could you )?(speak|reply|respond|continue|switch|use)( to| in)? arabic( please)?$/.test(text)) return "ar";
  if (/^(باللغة العربية|رد بالعربي|خلنا بالعربي|خلنا عربي)$/.test(text)) return "ar";
  if (/^(باللغة الانجليزية|باللغة الإنجليزية|رد بالانجليزي|رد بالإنجليزي)$/.test(text)) return "en";
  if (/^(public_language_en|english|english please|en|بالانجليزي|بالإنجليزي|انجليزي|إنجليزي)$/i.test(text)) return "en";
  if (/^(public_language_ar|arabic|arabic please|ar|عربي|العربية|بالعربي لو سمحت|العربية لو سمحت|بالعربي|بالعربية)$/i.test(text)) return "ar";
}

function topicOf(text: string): PublicTopic | "unknown" {
  const action = /^public_(explore|pricing|start|order|team|menu|knowledge)_(ar|en)$/.exec(text);
  if (action) return action[1] as PublicTopic;
  // Explicit navigation wins over broad keyword matching.
  if (/^(menu|back|home|main menu|القائمة|قائمة|رجوع|الرئيسية|البداية|ابدأ من جديد)$/.test(text)) return "menu";
  if (/\b(price|prices|pricing|cost|much|annual|annually|yearly|monthly|plans?|free|trial)\b|سعر|أسعار|اسعار|بكم|كم سعر|كم تكلفة|باق|اشتراك|مجاني|تجريبي/.test(text)) return "pricing";
  if (/\blearn more\b/.test(text)) return "explore";
  if (/\b(learn|learns|learning|train|training|knowledge|faqs?|policies)\b|يتعلم|يتعلّم|تدريب|معرفة|معلومات متجري|سياسات|اسئلتي|أسئلتي/.test(text)) return "knowledge";
  if (/\b(human|person|someone|team|contact|human agent|live agent|support agent)\b|موظف|فريق|بشري|تواصل/.test(text)) return "team";
  if (/\b(about reload|what.*reload|reload.*do|features?|included)\b|عن ريلود|ريلود.*(يسوي|يقدم|يساعد)|وش.*ريلود|ايش.*ريلود/.test(text)) return "explore";
  if (/\b(order|parcel|tracking|refund|return|missing|delivery|store link|store code)\b|طلب|طلبي|شحن|إرجاع|ارجاع|استرجاع/.test(text)
    || /^(language_(ar|en)|shop:|item:|reason:|quantity:|start_return|track_order|shop_products|ask_question|send_ticket)/.test(text)) return "order";
  if (/\b(signup|sign up|start|join|connect|setup|set up|zid|salla|shopify|i.*(run|own|have).*store)\b|ابدأ|ابدا|سجل|تسجيل|ربط|زد|سلة|شوبيفاي|عندي متجر|صاحب متجر/.test(text)) return "start";
  if (/\b(store|merchant|shop|business|reload|ai|assistant)\b|متجر|تاجر|ريلود/.test(text)) return "explore";
  if (/^(hi|hello|hey|thanks|thank you|مرحبا|مرحباً|هلا|السلام عليكم|شكرا|شكرًا)[! .،؟?]*$/.test(text)) return "menu";
  return "unknown";
}

export function publicReply(input: string, previous?: PublicLanguage | null, invalidRoute = false) {
  const text = input.trim().toLowerCase();
  const chosen = languageChoice(text);
  const actionLanguage = isPublicEntry(text) ? /_(ar|en)$/.exec(text)?.[1] as PublicLanguage | undefined : undefined;
  const language = chosen ?? actionLanguage ?? previous ?? undefined;
  const changeLanguage = /^(reload|public_change_language|language|change language|اللغة|تغيير اللغة|غير اللغة)$/.test(text);
  if (changeLanguage || !language) {
    const note = invalidRoute ? "ما قدرنا نفتح رابط المتجر. نساعدك تلقى الخطوة المناسبة بعد اختيار اللغة.\nWe couldn’t open that store link. Choose a language and we’ll help you continue.\n\n" : "";
    return {
      language: undefined,
      body: `${note}حيّاك في ريلود 👋\nيسعدنا نساعدك! اختر اللغة اللي تناسبك.\n\nWelcome to Reload! Choose your preferred language.`,
      buttons: [{ id: "public_language_ar", title: "العربية" }, { id: "public_language_en", title: "English" }],
    };
  }
  const ar = language === "ar";
  const button = (topic: PublicTopic, title: string) => ({ id: `public_${topic}_${language}`, title });
  const back = button("menu", ar ? "القائمة الرئيسية" : "Main menu");
  const change = { id: "public_change_language", title: ar ? "تغيير اللغة" : "Change language" };
  const team = button("team", ar ? "تواصل مع فريقنا" : "Contact our team");
  const order = button("order", ar ? "مساعدة بخصوص طلب" : "Help with an order");
  const start = button("start", ar ? "عندي متجر" : "I run a store");
  const pricing = button("pricing", ar ? "شوف الباقات" : "See the plans");
  const topic = invalidRoute ? "order" : chosen ? "menu" : topicOf(text);
  let body: string;
  let buttons = [button("explore", ar ? "تعرّف على ريلود" : "Explore Reload"), start, order];
  switch (topic) {
    case "order":
      body = ar
        ? `${invalidRoute ? "ما قدرنا نفتح رابط المتجر هذا. " : "أكيد، نساعدك بكل سرور. "}افتح رابط واتساب اللي شاركه معك المتجر، وأرسل الرسالة الجاهزة. تقدر أيضًا ترسل رمز المتجر هنا.\n\nما عندك الرابط أو الرمز؟ اطلبه من المتجر اللي اشتريت منه. بعدها نقدر نوجّهك لخدمة المتجر ونتحقق من طلبك بأمان.\n\nلا ترسل بيانات الدفع أو رمز التحقق في هذه الخطوة.`
        : `${invalidRoute ? "We couldn’t open that store link. " : "Of course, happy to help. "}Open the WhatsApp link your store shared and send its ready-made message. You can also send the store code here.\n\nDon’t have the link or code? Ask the store you bought from. We can then connect you to its support and verify your order safely.\n\nPlease don’t send payment details or verification codes at this step.`;
      buttons = [back, team, change];
      break;
    case "pricing":
      body = ar
        ? "هذه باقات ريلود:\n\nستاندرد — 149 ر.س شهريًا\n500 رسالة صادرة كل شهر.\n\nبريميوم — 299 ر.س شهريًا\n2,000 رسالة صادرة كل شهر.\n\nالباقتان تشملان خدمة العملاء والإرجاع والمساعدة في اختيار المنتجات. جميع الأسعار شاملة الضريبة.\n\nالتجهيز مجاني، وتفعيل المساعد يحتاج اشتراكًا مدفوعًا.\n\nالدفع السنوي يوفر 20٪: ستاندرد 1,430.40 ر.س، وبريميوم 2,870.40 ر.س. رصيد الرسائل يتجدد شهريًا، حتى مع الدفع السنوي.\n\nالتفاصيل: https://www.reload.sa/ar/pricing"
        : "Here are Reload’s plans:\n\nStandard — SAR 149/month\n500 outgoing messages each month.\n\nPremium — SAR 299/month\n2,000 outgoing messages each month.\n\nBoth include customer support, returns and product assistance. All prices include VAT.\n\nSetup is free; activating the assistant needs a paid plan.\n\nAnnual billing saves 20%: Standard SAR 1,430.40/year or Premium SAR 2,870.40/year. Message allowances refresh monthly, including on annual plans.\n\nDetails: https://www.reload.sa/en/pricing";
      buttons = [start, back, change];
      break;
    case "team":
      body = ar
        ? "حاضرين لك! تقدر تترك سؤالك وبيانات التواصل هنا:\nhttps://www.reload.sa/interest\n\nأو تراسلنا على:\ninfo@reload.sa\n\nهذه طرق التواصل مع فريق ريلود. إذا سؤالك عن عملية شراء، اختر «مساعدة بخصوص طلب» عشان نوجّهك لخدمة المتجر."
        : "We’d be happy to hear from you! Leave your question and contact details here:\nhttps://www.reload.sa/interest\n\nOr email us at:\ninfo@reload.sa\n\nThis contacts the Reload team. For help with a purchase, choose ‘Help with an order’ so we can guide you to the store’s support.";
      buttons = [back, order, change];
      break;
    case "start":
      body = ar
        ? "يا هلا بمتجرك! 👋\nتقدر تبدأ التجهيز مجانًا:\nhttps://www.reload.sa/auth\n\n1. أنشئ حسابك وجهّز اتصال المتجر.\n2. أضف إجاباتك وسياسة الإرجاع واعتمدها.\n3. اختر باقتك لتفعيل المساعد بعد جاهزية الاتصال.\n\nالربط المتاح يختلف حسب منصة متجرك، وبتلقى الخيارات في صفحة التكاملات. تحتاج مساعدة في التجهيز؟ فريقنا حاضر."
        : "Welcome to you and your store! 👋\nYou can set up for free:\nhttps://www.reload.sa/auth\n\n1. Create your account and prepare your store connection.\n2. Add and approve your answers and return policy.\n3. Choose a paid plan to activate the assistant once the connection is ready.\n\nAvailable connections depend on your store platform. You’ll find the options in Integrations. Need a hand getting started? Contact our team.";
      buttons = [pricing, team, back];
      break;
    case "explore":
      body = ar
        ? "ريلود يسهّل التواصل بين المتاجر وعملائها على واتساب 👋\n\nيساعد في أسئلة المنتجات، متابعة الطلبات وطلبات الإرجاع. الإجابات تعتمد على معلومات وسياسات يوافق عليها المتجر، مع التحقق قبل عرض تفاصيل الطلب.\n\nتحب تشوف الباقات أو تسأل فريقنا عن شيء معيّن؟"
        : "Reload makes it easier for stores and customers to connect on WhatsApp 👋\n\nIt helps with product questions, order enquiries and return requests. Answers use information and policies approved by the store, with verification before private order details are shared.\n\nWould you like to see the plans or ask our team a question?";
      buttons = [pricing, team, back];
      break;
    case "knowledge":
      body = ar
        ? "أنت تعرف متجرك أكثر، وريلود يساعدك توصل المعلومة لعملائك بوضوح.\n\nأضف إجاباتك وسياساتك، أو استورد صفحة عامة وراجع المسودة. المساعد يستخدم المعلومات بعد اعتمادك لها، ويرجع لبيانات المنتجات المتاحة من اتصال متجرك.\n\nإذا ما عنده جواب مؤكّد، يطلب توضيحًا أو يقترح إرسال السؤال لفريق المتجر. محادثات العملاء ما تغيّر إجاباتك أو سياساتك تلقائيًا."
        : "You know your store best. Reload helps share that knowledge clearly with customers.\n\nAdd your answers and policies, or import a public page and review the draft. The assistant uses information after you approve it, along with available product facts from your store connection.\n\nIf it can’t confirm an answer, it asks for clarification or offers to send the question to the store team. Customer chats don’t automatically change your answers or policies.";
      buttons = [start, team, back];
      break;
    case "menu":
      body = ar
        ? "يا هلا فيك! 👋\nريلود يساعد المتاجر في خدمة العملاء، أسئلة المنتجات، ومتابعة الطلبات والإرجاع على واتساب.\n\nكيف نقدر نساعدك اليوم؟ اختر من الخيارات، أو اكتب سؤالك.\nلتغيير اللغة، اكتب «اللغة»."
        : "Welcome! 👋\nReload helps online stores answer customer questions, assist with products, and handle order enquiries and returns on WhatsApp.\n\nHow can we help you today? Choose below, or type your question.\nTo switch languages, type ‘language’.";
      break;
    default:
      body = ar
        ? "يسعدنا نساعدك. أقدر أوضح لك خدمة ريلود وباقاتها، أو أساعدك تبدأ بمتجرك وتلقى طريقة التواصل مع المتجر اللي اشتريت منه.\n\nاختر الأقرب لك، أو تواصل مع فريقنا لو عندك سؤال مختلف.\nلتغيير اللغة، اكتب «اللغة»."
        : "Happy to help. I can explain Reload and its plans, help you get started with a store, or guide you to support for a purchase.\n\nChoose what fits below, or contact our team if your question is different.\nTo switch languages, type ‘language’.";
      buttons = [button("explore", ar ? "تعرّف على ريلود" : "Explore Reload"), team, back];
  }
  return { language, body, buttons };
}
