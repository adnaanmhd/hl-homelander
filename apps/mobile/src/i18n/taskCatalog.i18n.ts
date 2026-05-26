// Task catalog — full-body translations for the 86-task taxonomy across
// 8 BCP-47 locales (D-01 / D-15 / I18N-10). Plan 07-06 Task 2.
//
// COUNT RECONCILIATION (2026-05-24): 07-SPEC line 79 and the plan body
// both say "65-task catalog". As of commit 2fbb65e (2026-05-24
// "feat(taxonomy): add 21 US-oriented tasks") the canonical task-taxonomy.md
// + design-system/task-icons/mapping.json carry 86 tasks. The SPEC literal
// is stale by hours. Backend seeds 86 from the same canonical taxonomy
// (apps/api/scripts/parse-taxonomy.ts joinTaxonomyWithMapping). Shipping
// only 65 of 86 would silently drop the 21 new US-oriented tasks from
// non-English locale search — that's the correctness failure mode we
// rejected. See SUMMARY.md "Deviations from Plan" for the Rule-2 trail.
//
// SOURCE OF TRUTH (D-15): this file IS the source of truth for both the
// UI surfaces that render task names/descriptions in the user's locale
// AND the per-locale reverse-search maps consumed by services/tasksApi.ts
// (see reverseSearch.ts).
//
// ENGLISH ENTRIES are hand-authored verbatim from a row of
// task-taxonomy.md (Task column → name; Description column → description;
// Instructions column split on <br> → instructions[]). `examples` is []
// for every task because the source TaskDetailsSheet (Phase 6) does not
// surface per-task examples — the field is reserved for a future
// authoring pass and ships empty across all locales for parity.
//
// NON-ENGLISH ENTRIES are CURRENTLY SKELETON copies of the English body
// (verbatim, mirroring the i18n runtime placeholder pattern from
// plan 07-01). Plan 07-02-extension OR a sibling tools/i18n/generate-tasks.ts
// reads this file, calls Claude Opus 4.7 with the I18N-05 vernacular
// brief, and overwrites the 7 non-English locale objects with real
// translations. Until that regen runs, reverseSearch() Stage-1 lookups
// resolve as identity (localized name === English name), which is the
// gracefully-degraded state, not a bug. The runtime contract (TaskBody
// shape, REVERSE_BY_LOCALE shape) is unchanged across the LLM regen
// boundary — only the string VALUES change.
//
// Generated via the inline node script in plan 07-06 Task 2. Re-run that
// script after task-taxonomy.md changes; the LLM regen tool stages
// translation runs on the output.

import type { Locale } from './storage';

export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export interface ReverseMap {
  /** NFC-lowercase-trimmed localized full-string → canonical English task name. */
  fullStringMap: Record<string, string>;
  /** NFC-lowercase-trimmed localized token → English token (for Stage 2 fallback). */
  tokenMap: Record<string, string>;
}

export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
  'Cooking a meal': {
    en: {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        'Keep working — don\'t stand idle.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Preparar uma refeição',
      description: 'Faça uma refeição completa do início ao fim. Isso pode incluir lavar, cortar, cozinhar no fogão e colocar a comida nos pratos.',
      instructions: [
        'Olhe para baixo, para a sua área de trabalho.',
        'Continue trabalhando — não fique parado.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Preparar una comida',
      description: 'Prepara una comida completa de principio a fin. Esto puede incluir lavar, cortar, cocinar en la estufa y servir la comida en los platos.',
      instructions: [
        'Mira hacia abajo, a tu área de trabajo.',
        'Sigue trabajando, no te quedes quieto.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाना पकाना',
      description: 'शुरू से आख़िर तक पूरा खाना बनाएँ। इसमें धोना, काटना, गैस पर पकाना और प्लेट में परोसना शामिल हो सकता है।',
      instructions: [
        'अपने काम की जगह की ओर नीचे देखें।',
        'काम करते रहें — खाली खड़े न रहें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'রান্না করা',
      description: 'শুরু থেকে শেষ পর্যন্ত একটা পুরো খাবার বানান। এতে ধোয়া, কাটা, গ্যাসে রান্না করা আর প্লেটে খাবার সাজানো সব থাকতে পারে।',
      instructions: [
        'নিজের কাজের জায়গার দিকে তাকান।',
        'কাজ চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சாப்பாடு சமைப்பது',
      description: 'ஆரம்பம் முதல் முடிவு வரை ஒரு முழு சாப்பாடு தயாரிக்கவும். கழுவுதல், நறுக்குதல், அடுப்பில் சமைத்தல், தட்டில் பரிமாறுதல் ஆகியவற்றை உள்ளடக்கலாம்.',
      instructions: [
        'உங்கள் வேலை செய்யும் இடத்தை கீழே பாருங்கள்.',
        'வேலை செய்துகொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'భోజనం వండడం',
      description: 'మొదటి నుండి చివరి వరకు పూర్తి భోజనం తయారు చేయండి. ఇందులో కడగడం, తరగడం, పొయ్యి మీద వండడం, ఆహారాన్ని ప్లేట్లలో పెట్టడం ఉంటాయి.',
      instructions: [
        'మీ పని జాగా వైపు కిందికి చూడండి.',
        'పని చేస్తూ ఉండండి — ఖాళీగా నిలబడకండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'जेवण बनवणे',
      description: 'सुरुवातीपासून शेवटपर्यंत पूर्ण जेवण तयार करा. यात धुणे, कापणे, गॅसवर शिजवणे आणि ताटात वाढणे यांचा समावेश असू शकतो.',
      instructions: [
        'तुमच्या कामाच्या जागेकडे खाली पाहा.',
        'काम चालू ठेवा — नुसते उभे राहू नका.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  Chopping: {
    en: {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: [
        'Look down at the cutting board.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Picar',
      description: 'Use uma faca para cortar a comida em pedaços pequenos sobre uma tábua. Faça os pedaços do tamanho que você precisa.',
      instructions: [
        'Olhe para baixo, para a tábua.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Picar',
      description: 'Usa un cuchillo para cortar la comida en trozos pequeños sobre una tabla de picar. Haz los trozos del tamaño que necesites.',
      instructions: [
        'Mira hacia abajo, a la tabla de picar.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'काटना',
      description: 'चाकू से खाने को चॉपिंग बोर्ड पर छोटे-छोटे टुकड़ों में काटें। जितने बड़े टुकड़े चाहिए, उतने ही काटें।',
      instructions: [
        'चॉपिंग बोर्ड की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কুচি করা',
      description: 'ছুরি দিয়ে কাটিং বোর্ডে খাবার ছোট ছোট টুকরো করে কাটুন। যে মাপে দরকার সেই মাপে টুকরো করুন।',
      instructions: [
        'কাটিং বোর্ডের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'நறுக்குவது',
      description: 'கட்டிங் போர்டில் கத்தியை வைத்து உணவை சிறிய துண்டுகளாக நறுக்குங்கள். உங்களுக்கு தேவையான அளவில் துண்டுகளை செய்யுங்கள்.',
      instructions: [
        'கட்டிங் போர்டை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'తరగడం',
      description: 'కటింగ్ బోర్డ్ మీద ఆహారాన్ని చిన్న ముక్కలుగా కత్తితో తరగండి. మీకు కావలసిన పరిమాణంలో ముక్కలు చేయండి.',
      instructions: [
        'కటింగ్ బోర్డ్ వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कापणे',
      description: 'चॉपिंग बोर्डवर सुरीने अन्न लहान तुकड्यांत कापा. तुम्हाला हवे त्या आकाराचे तुकडे करा.',
      instructions: [
        'चॉपिंग बोर्डकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  Dicing: {
    en: {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: [
        'Look down at the cutting board.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Cortar em cubinhos',
      description: 'Use uma faca para cortar a comida em cubinhos pequenos e iguais sobre uma tábua.',
      instructions: [
        'Olhe para baixo, para a tábua.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Cortar en cubos',
      description: 'Usa un cuchillo para cortar la comida en cubitos pequeños y parejos sobre una tabla de picar.',
      instructions: [
        'Mira hacia abajo, a la tabla de picar.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बारीक चौकोर काटना',
      description: 'चाकू से खाने को चॉपिंग बोर्ड पर छोटे और एक जैसे चौकोर टुकड़ों में काटें।',
      instructions: [
        'चॉपिंग बोर्ड की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ডুমো করে কাটা',
      description: 'ছুরি দিয়ে কাটিং বোর্ডে খাবার ছোট ছোট সমান চৌকো টুকরো করে কাটুন।',
      instructions: [
        'কাটিং বোর্ডের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சதுர துண்டுகளாக நறுக்குவது',
      description: 'கட்டிங் போர்டில் கத்தியை வைத்து உணவை சிறிய, சம அளவிலான சதுர துண்டுகளாக நறுக்குங்கள்.',
      instructions: [
        'கட்டிங் போர்டை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'క్యూబ్‌లుగా తరగడం',
      description: 'కటింగ్ బోర్డ్ మీద ఆహారాన్ని చిన్న, సమానమైన చతురస్రపు ముక్కలుగా కత్తితో తరగండి.',
      instructions: [
        'కటింగ్ బోర్డ్ వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'लहान चौकोनी तुकडे करणे',
      description: 'चॉपिंग बोर्डवर सुरीने अन्न लहान, सारख्या आकाराच्या चौकोनी तुकड्यांत कापा.',
      instructions: [
        'चॉपिंग बोर्डकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  Slicing: {
    en: {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: [
        'Look down at the cutting board.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Fatiar',
      description: 'Use uma faca para cortar a comida em fatias finas sobre uma tábua.',
      instructions: [
        'Olhe para baixo, para a tábua.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Cortar en rodajas',
      description: 'Usa un cuchillo para cortar la comida en trozos finos y planos sobre una tabla de picar.',
      instructions: [
        'Mira hacia abajo, a la tabla de picar.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'स्लाइस में काटना',
      description: 'चाकू से खाने को चॉपिंग बोर्ड पर पतले, चपटे टुकड़ों में काटें।',
      instructions: [
        'चॉपिंग बोर्ड की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'স্লাইস করা',
      description: 'ছুরি দিয়ে কাটিং বোর্ডে খাবার পাতলা পাতলা চাকতির মতো কাটুন।',
      instructions: [
        'কাটিং বোর্ডের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மெல்லியதாக அறிவது',
      description: 'கட்டிங் போர்டில் கத்தியை வைத்து உணவை மெல்லிய, தட்டையான துண்டுகளாக அறியுங்கள்.',
      instructions: [
        'கட்டிங் போர்டை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పలుచగా కోయడం',
      description: 'కటింగ్ బోర్డ్ మీద ఆహారాన్ని పలుచని, చదునైన ముక్కలుగా కత్తితో కోయండి.',
      instructions: [
        'కటింగ్ బోర్డ్ వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पातळ चकत्या करणे',
      description: 'चॉपिंग बोर्डवर सुरीने अन्नाच्या पातळ, सपाट चकत्या कापा.',
      instructions: [
        'चॉपिंग बोर्डकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  Peeling: {
    en: {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: [
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Descascar',
      description: 'Tire a casca de frutas ou legumes usando um descascador ou uma faca.',
      instructions: [
        'Olhe para baixo, para as suas mãos.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Pelar',
      description: 'Quita la cáscara de frutas o verduras con un pelador o un cuchillo.',
      instructions: [
        'Mira hacia abajo, a tus manos.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'छिलका उतारना',
      description: 'पीलर या चाकू से फलों या सब्ज़ियों का ऊपरी छिलका उतारें।',
      instructions: [
        'अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খোসা ছাড়ানো',
      description: 'পিলার বা ছুরি দিয়ে ফল বা সবজির খোসা ছাড়ান।',
      instructions: [
        'নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'தோல் சீவுவது',
      description: 'பழங்கள் அல்லது காய்கறிகளின் வெளி தோலை பீலர் அல்லது கத்தியை வைத்து சீவி எடுக்கவும்.',
      instructions: [
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'తొక్క తీయడం',
      description: 'పీలర్ లేదా కత్తి ఉపయోగించి పండ్లు లేదా కూరగాయల పైతొక్కను తీయండి.',
      instructions: [
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'सालं काढणे',
      description: 'फळं किंवा भाज्यांची वरची सालं पीलर किंवा सुरीने काढा.',
      instructions: [
        'तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Kneading or rolling dough': {
    en: {
      name: 'Kneading or rolling dough',
      description: 'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: [
        'Look down at the dough.',
        'Keep your hands moving — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Sovar ou abrir massa',
      description: 'Aperte, dobre e empurre a massa com as mãos. Use um rolo para abrir a massa, se precisar.',
      instructions: [
        'Olhe para baixo, para a massa.',
        'Mantenha as mãos em movimento — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Amasar o estirar masa',
      description: 'Aprieta, dobla y empuja la masa con las manos. Usa un rodillo para aplanarla si hace falta.',
      instructions: [
        'Mira hacia abajo, a la masa.',
        'Mantén las manos en movimiento, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'आटा गूँथना या बेलना',
      description: 'हाथों से आटे को दबाएँ, मोड़ें और गूँथें। ज़रूरत हो तो बेलन से इसे चपटा करें।',
      instructions: [
        'आटे की ओर नीचे देखें।',
        'हाथ चलाते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ময়দা মাখা বা বেলা',
      description: 'হাত দিয়ে ময়দা চেপে, ভাঁজ করে, ঠেলে মাখুন। দরকার হলে বেলন দিয়ে চ্যাপ্টা করুন।',
      instructions: [
        'ময়দার দিকে তাকান।',
        'হাত চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மாவு பிசைதல் அல்லது தேய்த்தல்',
      description: 'கைகளால் மாவை அழுத்தி, மடித்து, தள்ளி பிசைந்து கொள்ளுங்கள். தேவைப்பட்டால் கிலி (உருளைக்கட்டை) வைத்து தேய்த்து தட்டையாக்குங்கள்.',
      instructions: [
        'மாவை கீழே பாருங்கள்.',
        'கைகளை அசைத்துக்கொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పిండి కలపడం లేదా చపాతీ ఒత్తడం',
      description: 'చేతులతో పిండిని నొక్కండి, మడతపెట్టండి, తోయండి. అవసరమైతే చపాతీ కర్రతో పల్చగా ఒత్తండి.',
      instructions: [
        'పిండి వైపు కిందికి చూడండి.',
        'చేతులు కదుపుతూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कणीक मळणे किंवा लाटणे',
      description: 'हातांनी कणीक दाबा, घडी करा आणि ढकला. लागल्यास लाटण्याने ती चपटी करा.',
      instructions: [
        'कणकेकडे खाली पाहा.',
        'हात सतत चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Plating or serving food/drinks': {
    en: {
      name: 'Plating or serving food/drinks',
      description: 'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: [
        'Look down at what you are serving.',
        'Move smoothly between items.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Empratar ou servir comida/bebidas',
      description: 'Passe a comida pronta ou as bebidas das panelas e frigideiras para pratos, tigelas ou copos.',
      instructions: [
        'Olhe para baixo, para o que você está servindo.',
        'Mova-se com calma entre os itens.',
      ],
      examples: [],
    },
    es: {
      name: 'Emplatar o servir comida/bebidas',
      description: 'Pasa la comida cocida o las bebidas de las ollas y sartenes a los platos, tazones o vasos para comer.',
      instructions: [
        'Mira hacia abajo, a lo que estás sirviendo.',
        'Muévete con suavidad entre los elementos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाना/पेय परोसना',
      description: 'पके हुए खाने या पेय को बर्तनों और कढ़ाई से निकालकर प्लेट, कटोरी या गिलास में डालें ताकि खाया जा सके।',
      instructions: [
        'जो परोस रहे हैं, उसकी ओर नीचे देखें।',
        'एक चीज़ से दूसरी चीज़ तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খাবার বা পানীয় পরিবেশন করা',
      description: 'রান্না করা খাবার বা পানীয় হাঁড়ি-কড়াই থেকে প্লেট, বাটি বা গ্লাসে তুলুন খাওয়ার জন্য।',
      instructions: [
        'যা পরিবেশন করছেন সেদিকে তাকান।',
        'একটার পর একটা জিনিস মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'உணவு/பானங்களை தட்டில் வைத்து பரிமாறுவது',
      description: 'சமைத்த உணவை அல்லது பானங்களை பாத்திரம், பான்களில் இருந்து தட்டு, கிண்ணம் அல்லது கிளாஸுக்கு மாற்றி உண்பதற்கு தயார் செய்யுங்கள்.',
      instructions: [
        'நீங்கள் பரிமாறுவதை கீழே பாருங்கள்.',
        'ஒன்றிலிருந்து இன்னொன்றுக்கு மெதுவாக மாறுங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆహారం/పానీయాలు వడ్డించడం',
      description: 'వండిన ఆహారం లేదా పానీయాలను గిన్నెల నుండి ప్లేట్లు, బౌల్స్ లేదా గ్లాసుల్లోకి తినడానికి సిద్ధం చేయండి.',
      instructions: [
        'మీరు వడ్డిస్తున్న దాని వైపు కిందికి చూడండి.',
        'ఒక వస్తువు నుండి మరో వస్తువుకు మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'ताटात वाढणे किंवा पेय देणे',
      description: 'शिजवलेले अन्न किंवा पेयं भांड्यांतून ताट, वाटी किंवा ग्लासात खाण्यासाठी काढा.',
      instructions: [
        'तुम्ही जे वाढत आहात त्याकडे खाली पाहा.',
        'एका वस्तूकडून दुसरीकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Reheating food': {
    en: {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: [
        'Look at the appliance and the food.',
        'Move smoothly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Esquentar comida',
      description: 'Esquente comida já pronta usando o micro-ondas, o fogão ou o forno.',
      instructions: [
        'Olhe para o aparelho e para a comida.',
        'Mova-se com calma entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Recalentar comida',
      description: 'Calienta comida que ya está cocida usando el microondas, la estufa o el horno.',
      instructions: [
        'Mira el aparato y la comida.',
        'Muévete con suavidad entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाना दोबारा गर्म करना',
      description: 'पहले से पके हुए खाने को माइक्रोवेव, गैस या ओवन से गर्म करें।',
      instructions: [
        'उपकरण और खाने की ओर देखें।',
        'हर कदम आराम से बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খাবার গরম করা',
      description: 'মাইক্রোওয়েভ, গ্যাস বা ওভেনে আগে থেকে রান্না করা খাবার গরম করুন।',
      instructions: [
        'যন্ত্র আর খাবারের দিকে তাকান।',
        'ধাপগুলোর মাঝে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'உணவை சூடாக்குவது',
      description: 'ஏற்கனவே சமைத்த உணவை மைக்ரோவேவ், அடுப்பு அல்லது ஓவனில் சூடாக்குங்கள்.',
      instructions: [
        'கருவியையும் உணவையும் பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆహారం వేడి చేయడం',
      description: 'ఇప్పటికే వండిన ఆహారాన్ని మైక్రోవేవ్, పొయ్యి లేదా ఓవెన్‌లో వేడి చేయండి.',
      instructions: [
        'పరికరం మరియు ఆహారం వైపు చూడండి.',
        'ప్రతి అడుగు మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'अन्न पुन्हा गरम करणे',
      description: 'आधीच शिजवलेले अन्न मायक्रोवेव्ह, गॅस किंवा ओव्हनवर गरम करा.',
      instructions: [
        'उपकरण आणि अन्नाकडे पाहा.',
        'एका टप्प्यातून दुसऱ्या टप्प्यात सहज जा.',
      ],
      examples: [],
    },
  },
  'Packing food': {
    en: {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: [
        'Look down at the food and container.',
        'Keep packing — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Embalar comida',
      description: 'Coloque a comida em caixas, potes ou sacolas para poder levar ou guardar.',
      instructions: [
        'Olhe para baixo, para a comida e o pote.',
        'Continue embalando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Empacar comida',
      description: 'Mete la comida en cajas, recipientes o bolsas para poder llevarla o guardarla.',
      instructions: [
        'Mira hacia abajo, a la comida y al recipiente.',
        'Sigue empacando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाना पैक करना',
      description: 'खाने को डिब्बों, कंटेनरों या थैलियों में रखें ताकि उसे ले जाया या रखा जा सके।',
      instructions: [
        'खाने और डिब्बे की ओर नीचे देखें।',
        'पैक करते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খাবার প্যাক করা',
      description: 'খাবার বাক্স, কৌটো বা ব্যাগে ভরুন যাতে নিয়ে যাওয়া বা রাখা যায়।',
      instructions: [
        'খাবার আর কৌটোর দিকে তাকান।',
        'প্যাকিং চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'உணவு பேக் செய்வது',
      description: 'உணவை டப்பாக்கள், டப்பிகள் அல்லது பைகளில் வைத்து எடுத்துச் செல்லவோ சேமிக்கவோ ஆயத்தம் செய்யுங்கள்.',
      instructions: [
        'உணவையும் டப்பாவையும் கீழே பாருங்கள்.',
        'பேக் செய்துகொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆహారం ప్యాక్ చేయడం',
      description: 'తీసుకెళ్లడానికి లేదా దాచడానికి ఆహారాన్ని డబ్బాలు, కంటైనర్లు లేదా బ్యాగ్‌లలో పెట్టండి.',
      instructions: [
        'ఆహారం మరియు డబ్బా వైపు కిందికి చూడండి.',
        'ప్యాక్ చేస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'अन्न डब्यात भरणे',
      description: 'अन्न डबे, कंटेनर किंवा पिशव्यांत भरा, जेणेकरून ते नेता किंवा साठवता येईल.',
      instructions: [
        'अन्न आणि डब्याकडे खाली पाहा.',
        'भरणे चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Brewing drip coffee': {
    en: {
      name: 'Brewing drip coffee',
      description: 'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: [
        'Look at the machine while you work.',
        'Move smoothly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Fazer café na cafeteira',
      description: 'Encha a cafeteira com água, coloque o pó no filtro e ligue a máquina para fazer uma jarra de café.',
      instructions: [
        'Olhe para a máquina enquanto trabalha.',
        'Mova-se com calma entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Hacer café de filtro',
      description: 'Llena la cafetera con agua, pon café molido en el filtro y enciende la máquina para preparar una jarra.',
      instructions: [
        'Mira la máquina mientras trabajas.',
        'Muévete con suavidad entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'ड्रिप कॉफ़ी बनाना',
      description: 'कॉफ़ी मेकर में पानी भरें, फ़िल्टर की टोकरी में पिसी कॉफ़ी डालें, और मशीन चालू करके कॉफ़ी बनाएँ।',
      instructions: [
        'काम करते समय मशीन की ओर देखें।',
        'हर कदम आराम से बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ড্রিপ কফি বানানো',
      description: 'কফি মেশিনে জল ভরুন, ফিল্টারে কফির গুঁড়ো দিন, আর মেশিন চালু করে এক পট কফি বানান।',
      instructions: [
        'কাজ করার সময় মেশিনের দিকে তাকান।',
        'ধাপগুলোর মাঝে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டிரிப் காபி போடுவது',
      description: 'காபி மெஷினில் தண்ணீர் ஊற்றி, ஃபில்டர் கூடையில் பொடி காபியை போட்டு, மெஷினை இயக்கி காபி தயார் செய்யுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது மெஷினை பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డ్రిప్ కాఫీ తయారు చేయడం',
      description: 'కాఫీ మెషీన్‌లో నీళ్లు నింపండి, ఫిల్టర్ బాస్కెట్‌లో కాఫీ పొడి వేయండి, మెషీన్ ఆన్ చేసి కాఫీ తయారు చేయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మెషీన్ వైపు చూడండి.',
        'ప్రతి అడుగు మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'ड्रिप कॉफी बनवणे',
      description: 'कॉफी मशीनमध्ये पाणी भरा, फिल्टरमध्ये कॉफी पावडर टाका आणि कॉफी तयार करण्यासाठी मशीन चालू करा.',
      instructions: [
        'काम करताना मशीनकडे पाहा.',
        'एका टप्प्यातून दुसऱ्या टप्प्यात सहज जा.',
      ],
      examples: [],
    },
  },
  'Brewing single-cup coffee (pod machine)': {
    en: {
      name: 'Brewing single-cup coffee (pod machine)',
      description: 'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: [
        'Look at the machine while you work.',
        'Move slowly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Fazer café em cápsula (máquina de cápsula)',
      description: 'Coloque uma cápsula de café na máquina, ponha uma xícara embaixo do bico e aperte o botão para tirar uma xícara.',
      instructions: [
        'Olhe para a máquina enquanto trabalha.',
        'Mova-se devagar entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Hacer café de una taza (máquina de cápsulas)',
      description: 'Coloca una cápsula de café en una cafetera de una taza, pon una taza debajo del pico y aprieta el botón para preparar una taza.',
      instructions: [
        'Mira la máquina mientras trabajas.',
        'Muévete despacio entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'एक कप कॉफ़ी बनाना (पॉड मशीन)',
      description: 'सिंगल-कप ब्रूअर में कॉफ़ी पॉड डालें, नीचे मग रखें, और बटन दबाकर एक कप कॉफ़ी बनाएँ।',
      instructions: [
        'काम करते समय मशीन की ओर देखें।',
        'हर कदम धीरे-धीरे बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'এক কাপ কফি বানানো (পড মেশিন)',
      description: 'একটা কফি পড সিঙ্গেল-কাপ মেশিনে রাখুন, নলের তলায় একটা মগ বসান, আর বোতাম টিপে এক কাপ কফি বানান।',
      instructions: [
        'কাজ করার সময় মেশিনের দিকে তাকান।',
        'ধাপগুলোর মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஒற்றை கப் காபி போடுவது (பாட் மெஷின்)',
      description: 'ஒற்றை-கப் மெஷினில் ஒரு காபி பாட் வைத்து, கீழே ஒரு கப் வைத்து, பட்டனை அழுத்தி ஒரு கப் காபி தயார் செய்யுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது மெஷினை பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఒక కప్పు కాఫీ తయారు చేయడం (పాడ్ మెషీన్)',
      description: 'ఒక కప్పు బ్రూవర్‌లో కాఫీ పాడ్ పెట్టండి, దాని కింద కప్పు పెట్టండి, బటన్ నొక్కి ఒక కప్పు కాఫీ తయారు చేయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మెషీన్ వైపు చూడండి.',
        'ప్రతి అడుగు మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'एक कप कॉफी बनवणे (पॉड मशीन)',
      description: 'सिंगल-कप मशीनमध्ये कॉफी पॉड ठेवा, खाली कप ठेवा आणि एक कप कॉफी बनवण्यासाठी बटण दाबा.',
      instructions: [
        'काम करताना मशीनकडे पाहा.',
        'टप्प्यांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Grilling on a BBQ': {
    en: {
      name: 'Grilling on a BBQ',
      description: 'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: [
        'Look at the grill while cooking.',
        'Move smoothly between flips and checks.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Assar na churrasqueira',
      description: 'Acenda a churrasqueira, coloque a comida na grelha e use o pegador ou a espátula para virar e conferir até ficar pronta.',
      instructions: [
        'Olhe para a grelha enquanto assa.',
        'Mova-se com calma para virar e conferir.',
      ],
      examples: [],
    },
    es: {
      name: 'Asar en la parrilla',
      description: 'Enciende la parrilla, coloca la comida sobre las rejillas y usa pinzas o una espátula para voltearla y revisarla hasta que esté cocida.',
      instructions: [
        'Mira la parrilla mientras cocinas.',
        'Muévete con suavidad al voltear y revisar.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बीबीक्यू पर ग्रिल करना',
      description: 'बीबीक्यू ग्रिल जलाएँ, खाने को जाली पर रखें, और चिमटे या पलटे से उसे पलटें और जाँचें जब तक वह पक न जाए।',
      instructions: [
        'पकाते समय ग्रिल की ओर देखें।',
        'पलटने और जाँचने के बीच आराम से चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বার্বিকিউতে গ্রিল করা',
      description: 'বার্বিকিউ গ্রিল জ্বালান, খাবার গ্রেটে রাখুন, আর সাঁড়াশি বা হাতা দিয়ে উল্টে-পাল্টে দেখুন যতক্ষণ না রান্না হয়।',
      instructions: [
        'রান্নার সময় গ্রিলের দিকে তাকান।',
        'উল্টানো আর দেখার সময় মসৃণভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பார்பிக்யூவில் கிரில் செய்வது',
      description: 'பார்பிக்யூ கிரில்லை பற்றவைத்து, கிரில் கம்பிகள் மேல் உணவை வையுங்கள், இடுக்கி அல்லது மேலாள் கரண்டியால் புரட்டி, சரியாக வெந்ததா என பார்த்து சமையுங்கள்.',
      instructions: [
        'சமைக்கும்போது கிரில்லை பாருங்கள்.',
        'புரட்டுதலும் சரிபார்த்தலும் மெதுவாக செய்யுங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'BBQ మీద గ్రిల్ చేయడం',
      description: 'BBQ గ్రిల్‌ను వెలిగించండి, దాని మీద ఆహారం పెట్టండి, టాంగ్స్ లేదా స్పాట్యులాతో తిప్పుతూ వండండి.',
      instructions: [
        'వంట చేస్తున్నప్పుడు గ్రిల్ వైపు చూడండి.',
        'తిప్పడం, చూడడం మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'BBQ वर ग्रिल करणे',
      description: 'BBQ ग्रिल पेटवा, अन्न जाळीवर ठेवा आणि चिमटा किंवा स्पॅच्युलाने उलटून शिजेपर्यंत बघत राहा.',
      instructions: [
        'शिजवताना ग्रिलकडे पाहा.',
        'उलटताना आणि तपासताना सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Baking on a sheet pan': {
    en: {
      name: 'Baking on a sheet pan',
      description: 'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Assar em assadeira',
      description: 'Arrume a comida na assadeira, leve ao forno e tire quando estiver pronta usando luvas de forno.',
      instructions: [
        'Olhe para baixo, para a assadeira, enquanto arruma.',
        'Mova-se devagar ao abrir e fechar o forno.',
      ],
      examples: [],
    },
    es: {
      name: 'Hornear en una bandeja',
      description: 'Acomoda la comida en una bandeja de horno, métela al horno y sácala cuando esté lista usando guantes de cocina.',
      instructions: [
        'Mira hacia abajo, a la bandeja, mientras acomodas.',
        'Muévete despacio al abrir y cerrar el horno.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'शीट पैन पर बेक करना',
      description: 'खाने को बेकिंग शीट पर सजाएँ, ओवन में रखें, और दस्ताने पहनकर बनने के बाद उसे निकालें।',
      instructions: [
        'सजाते समय शीट पैन की ओर नीचे देखें।',
        'ओवन खोलते-बंद करते समय धीरे-धीरे काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'শিট প্যানে বেক করা',
      description: 'একটা বেকিং শিটে খাবার সাজান, ওভেনে ঢোকান, আর হয়ে গেলে ওভেন মিট্ট পরে বের করুন।',
      instructions: [
        'সাজানোর সময় শিট প্যানের দিকে তাকান।',
        'ওভেন খোলা-বন্ধ করার সময় আস্তে নড়াচড়া করুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஷீட் பானில் பேக் செய்வது',
      description: 'உணவை ஒரு பேக்கிங் ஷீட் மீது அடுக்கி, ஓவனில் வையுங்கள், வெந்தபின் ஓவன் கையுறை அணிந்து எடுத்து விடுங்கள்.',
      instructions: [
        'அடுக்கும்போது ஷீட் பானை கீழே பாருங்கள்.',
        'ஓவனை திறக்கும்போதும் மூடும்போதும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'షీట్ ప్యాన్ మీద బేక్ చేయడం',
      description: 'షీట్ ప్యాన్ మీద ఆహారాన్ని పేర్చండి, ఓవెన్‌లో పెట్టండి, ఓవెన్ మిట్స్ ఉపయోగించి తీయండి.',
      instructions: [
        'పేర్చుతున్నప్పుడు షీట్ ప్యాన్ వైపు కిందికి చూడండి.',
        'ఓవెన్ తెరిచేటప్పుడు, మూసేటప్పుడు నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'शीट पॅनवर बेक करणे',
      description: 'बेकिंग शीटवर अन्न मांडा, ओव्हनमध्ये ठेवा आणि तयार झाल्यावर ओव्हन मिट्स वापरून बाहेर काढा.',
      instructions: [
        'मांडताना शीट पॅनकडे खाली पाहा.',
        'ओव्हन उघडताना आणि बंद करताना हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Washing dishes': {
    en: {
      name: 'Washing dishes',
      description: 'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: [
        'Look down at the sink.',
        'Keep working through the stack.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Lavar a louça',
      description: 'Limpe pratos, tigelas, copos e talheres usados com água e sabão. Enxágue bem e deixe de lado para secar.',
      instructions: [
        'Olhe para baixo, para a pia.',
        'Continue trabalhando até terminar a pilha.',
      ],
      examples: [],
    },
    es: {
      name: 'Lavar los platos',
      description: 'Limpia los platos, tazones, vasos y cubiertos usados con jabón y agua. Enjuágalos bien y déjalos a un lado para que se sequen.',
      instructions: [
        'Mira hacia abajo, al fregadero.',
        'Sigue trabajando con la pila de platos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बर्तन धोना',
      description: 'गंदी प्लेट, कटोरी, गिलास और चम्मच को साबुन और पानी से साफ़ करें। अच्छे से धोएँ और सूखने के लिए एक ओर रखें।',
      instructions: [
        'सिंक की ओर नीचे देखें।',
        'ढेर के सारे बर्तन धोते रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাসন মাজা',
      description: 'ব্যবহার করা প্লেট, বাটি, গ্লাস আর চামচ সাবান-জল দিয়ে ধুয়ে পরিষ্কার করুন। ভালো করে ধুয়ে শুকোতে রাখুন।',
      instructions: [
        'সিঙ্কের দিকে তাকান।',
        'একটার পর একটা বাসন মাজতে থাকুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பாத்திரம் கழுவுவது',
      description: 'பயன்படுத்திய தட்டு, கிண்ணம், கிளாஸ், கரண்டிகளை சோப்பு மற்றும் தண்ணீரால் கழுவுங்கள். நன்றாக அலசி, காய வைப்பதற்காக ஒதுக்கி வையுங்கள்.',
      instructions: [
        'சிங்கை கீழே பாருங்கள்.',
        'அடுக்கி வைத்த பாத்திரங்களை முடிக்கும் வரை வேலை செய்யுங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గిన్నెలు కడగడం',
      description: 'వాడిన ప్లేట్లు, బౌల్స్, గ్లాసులు, చెంచాలను సబ్బు, నీళ్లతో శుభ్రం చేయండి. బాగా జల్లి, ఆరడానికి పక్కన పెట్టండి.',
      instructions: [
        'సింక్ వైపు కిందికి చూడండి.',
        'గిన్నెలు అన్నీ అయ్యేవరకు పని చేస్తూ ఉండండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'भांडी घासणे',
      description: 'वापरलेली ताटं, वाट्या, ग्लास आणि चमचे साबण आणि पाण्याने स्वच्छ करा. नीट विसळा आणि वाळण्यासाठी बाजूला ठेवा.',
      instructions: [
        'सिंककडे खाली पाहा.',
        'ढीगातील भांडी संपेपर्यंत काम चालू ठेवा.',
      ],
      examples: [],
    },
  },
  'Drying or wiping dishes': {
    en: {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: [
        'Look down at your hands.',
        'Keep wiping — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Secar ou enxugar a louça',
      description: 'Use um pano limpo e seco para tirar a água da louça lavada e guarde.',
      instructions: [
        'Olhe para baixo, para as suas mãos.',
        'Continue enxugando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Secar los platos',
      description: 'Usa un paño limpio y seco para quitar el agua de los platos lavados y guardarlos.',
      instructions: [
        'Mira hacia abajo, a tus manos.',
        'Sigue secando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बर्तन सुखाना या पोंछना',
      description: 'साफ़, सूखे कपड़े से धुले बर्तनों का पानी पोंछें और उन्हें जगह पर रखें।',
      instructions: [
        'अपने हाथों की ओर नीचे देखें।',
        'पोंछते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাসন মোছা বা শুকানো',
      description: 'ধোয়া বাসন থেকে একটা পরিষ্কার, শুকনো কাপড় দিয়ে জল মুছে নিয়ে রেখে দিন।',
      instructions: [
        'নিজের হাতের দিকে তাকান।',
        'মুছতে থাকুন — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பாத்திரங்களை துடைப்பது அல்லது காய வைப்பது',
      description: 'சுத்தமான, உலர்ந்த துணியால் கழுவிய பாத்திரங்களில் உள்ள தண்ணீரை துடைத்து, ஒதுக்கி வையுங்கள்.',
      instructions: [
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'துடைத்துக்கொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గిన్నెలు తుడవడం లేదా ఆర్చడం',
      description: 'శుభ్రమైన, పొడి గుడ్డతో కడిగిన గిన్నెల మీద నీళ్లు తుడిచి వాటిని పక్కన పెట్టండి.',
      instructions: [
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'తుడుస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'भांडी पुसणे किंवा वाळवणे',
      description: 'स्वच्छ, कोरड्या फडक्याने धुतलेल्या भांड्यांवरील पाणी पुसून भांडी जागेवर ठेवा.',
      instructions: [
        'तुमच्या हातांकडे खाली पाहा.',
        'पुसणे चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Loading a dishwasher': {
    en: {
      name: 'Loading a dishwasher',
      description: 'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: [
        'Look at the rack you are loading.',
        'Move smoothly between dishes.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Carregar a lava-louças',
      description: 'Coloque pratos, copos e talheres sujos nas prateleiras da lava-louças de forma organizada. Adicione o detergente e feche a porta.',
      instructions: [
        'Olhe para a prateleira que você está carregando.',
        'Mova-se com calma entre as louças.',
      ],
      examples: [],
    },
    es: {
      name: 'Cargar el lavavajillas',
      description: 'Acomoda los platos, vasos y cubiertos sucios en las bandejas del lavavajillas de forma ordenada. Pon el detergente y cierra la puerta.',
      instructions: [
        'Mira la bandeja que estás cargando.',
        'Muévete con suavidad entre los platos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'डिशवॉशर में बर्तन लगाना',
      description: 'गंदे बर्तन, गिलास और चम्मच को डिशवॉशर की रैक में करीने से लगाएँ। डिटर्जेंट डालें और दरवाज़ा बंद करें।',
      instructions: [
        'जिस रैक में रख रहे हैं, उसकी ओर देखें।',
        'एक बर्तन से दूसरे बर्तन तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ডিশওয়াশারে বাসন ভরা',
      description: 'নোংরা বাসন, গ্লাস আর চামচ ডিশওয়াশারের র‍্যাকে গুছিয়ে রাখুন। সাবান দিয়ে দরজা বন্ধ করুন।',
      instructions: [
        'যে র‍্যাকে ভরছেন সেদিকে তাকান।',
        'একটার পর একটা বাসন মসৃণভাবে রাখুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டிஷ்வாஷரில் பாத்திரம் வைப்பது',
      description: 'அழுக்கான தட்டு, கிளாஸ், கரண்டிகளை டிஷ்வாஷர் ரேக்குகளில் ஒழுங்காக அடுக்கி வையுங்கள். சோப்பு போட்டு கதவை மூடவும்.',
      instructions: [
        'நீங்கள் வைக்கும் ரேக்கை பாருங்கள்.',
        'ஒரு பாத்திரத்திலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డిష్‌వాషర్‌లో గిన్నెలు పెట్టడం',
      description: 'మురికి ప్లేట్లు, గ్లాసులు, చెంచాలను డిష్‌వాషర్ ర్యాక్‌లలో క్రమంగా పెట్టండి. డిటర్జెంట్ వేసి తలుపు మూయండి.',
      instructions: [
        'మీరు లోడ్ చేస్తున్న ర్యాక్ వైపు చూడండి.',
        'ఒక గిన్నె నుండి మరోదానికి మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'डिशवॉशरमध्ये भांडी ठेवणे',
      description: 'घाणेरडी भांडी, ग्लास आणि चमचे डिशवॉशरच्या रॅकमध्ये नीट लावा. साबण टाका आणि दार बंद करा.',
      instructions: [
        'तुम्ही ज्या रॅकमध्ये भांडी ठेवत आहात त्याकडे पाहा.',
        'एका भांड्याकडून दुसऱ्या भांड्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Unloading a dishwasher': {
    en: {
      name: 'Unloading a dishwasher',
      description: 'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: [
        'Look at the rack you are unloading.',
        'Move smoothly between items.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Esvaziar a lava-louças',
      description: 'Tire as louças, copos e talheres limpos da lava-louças e guarde cada coisa no lugar certo nos armários ou gavetas.',
      instructions: [
        'Olhe para a prateleira que você está esvaziando.',
        'Mova-se com calma entre os itens.',
      ],
      examples: [],
    },
    es: {
      name: 'Vaciar el lavavajillas',
      description: 'Saca los platos, vasos y cubiertos limpios del lavavajillas y guarda cada cosa en su lugar, en las alacenas o los cajones.',
      instructions: [
        'Mira la bandeja que estás vaciando.',
        'Muévete con suavidad entre los elementos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'डिशवॉशर खाली करना',
      description: 'डिशवॉशर से साफ़ बर्तन, गिलास और चम्मच निकालें और हर चीज़ को उसकी सही जगह पर रखें — अलमारी या दराज़ में।',
      instructions: [
        'जिस रैक को खाली कर रहे हैं, उसकी ओर देखें।',
        'एक चीज़ से दूसरी चीज़ तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ডিশওয়াশার থেকে বাসন বের করা',
      description: 'ডিশওয়াশার থেকে পরিষ্কার বাসন, গ্লাস আর চামচ বের করে আলমারি বা ড্রয়ারে নিজ নিজ জায়গায় রাখুন।',
      instructions: [
        'যে র‍্যাক থেকে বের করছেন সেদিকে তাকান।',
        'একটার পর একটা মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டிஷ்வாஷரிலிருந்து பாத்திரம் எடுப்பது',
      description: 'சுத்தமான தட்டு, கிளாஸ், கரண்டிகளை டிஷ்வாஷரில் இருந்து எடுத்து, ஒவ்வொன்றையும் அலமாரி அல்லது இழுப்பறையில் சரியான இடத்தில் வையுங்கள்.',
      instructions: [
        'எடுக்கும் ரேக்கை பாருங்கள்.',
        'ஒன்றிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డిష్‌వాషర్ నుండి గిన్నెలు తీయడం',
      description: 'శుభ్రమైన ప్లేట్లు, గ్లాసులు, చెంచాలను డిష్‌వాషర్ నుండి తీసి, ప్రతి దాన్ని క్యాబినెట్లు లేదా అరల్లో దాని చోట పెట్టండి.',
      instructions: [
        'మీరు అన్‌లోడ్ చేస్తున్న ర్యాక్ వైపు చూడండి.',
        'వస్తువుల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'डिशवॉशरमधून भांडी काढणे',
      description: 'डिशवॉशरमधून स्वच्छ भांडी, ग्लास आणि चमचे बाहेर काढा आणि प्रत्येक वस्तू कपाटात किंवा ड्रॉवरमध्ये योग्य जागी ठेवा.',
      instructions: [
        'तुम्ही ज्या रॅकमधून काढत आहात त्याकडे पाहा.',
        'एका वस्तूकडून दुसरीकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Organizing kitchen cabinets or drawers': {
    en: {
      name: 'Organizing kitchen cabinets or drawers',
      description: 'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: [
        'Look at the cabinet or drawer.',
        'Keep moving items — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar armários ou gavetas da cozinha',
      description: 'Tire as coisas dos armários ou gavetas, separe e coloque de volta de forma organizada.',
      instructions: [
        'Olhe para o armário ou a gaveta.',
        'Continue mexendo nos itens — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar alacenas o cajones de la cocina',
      description: 'Saca las cosas de las alacenas o cajones, ordénalas y vuelve a guardarlas de forma prolija.',
      instructions: [
        'Mira la alacena o el cajón.',
        'Sigue moviendo cosas, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'रसोई की अलमारी या दराज़ व्यवस्थित करना',
      description: 'अलमारी या दराज़ से चीज़ें निकालें, उन्हें छाँटें, और करीने से वापस रखें।',
      instructions: [
        'अलमारी या दराज़ की ओर देखें।',
        'चीज़ें हटाते-रखते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'রান্নাঘরের আলমারি বা ড্রয়ার গোছানো',
      description: 'আলমারি বা ড্রয়ার থেকে জিনিস বের করুন, বাছাই করুন, আর গুছিয়ে আবার রেখে দিন।',
      instructions: [
        'আলমারি বা ড্রয়ারের দিকে তাকান।',
        'জিনিস নাড়াচাড়া চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சமையலறை அலமாரி அல்லது இழுப்பறைகளை ஒழுங்காக்குவது',
      description: 'அலமாரி அல்லது இழுப்பறையில் இருந்து பொருட்களை எடுத்து, வரிசைப்படுத்தி, ஒழுங்காக மீண்டும் வையுங்கள்.',
      instructions: [
        'அலமாரி அல்லது இழுப்பறையை பாருங்கள்.',
        'பொருட்களை அசைத்துக்கொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'వంటగది క్యాబినెట్లు లేదా అరలు సర్దడం',
      description: 'క్యాబినెట్లు లేదా అరల్లోంచి వస్తువులు తీసి, వర్గీకరించి, వాటిని తిరిగి నీట్‌గా పెట్టండి.',
      instructions: [
        'క్యాబినెట్ లేదా అర వైపు చూడండి.',
        'వస్తువులు కదుపుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'स्वयंपाकघरातील कपाट किंवा ड्रॉवर लावणे',
      description: 'कपाटातून किंवा ड्रॉवरमधून वस्तू बाहेर काढा, वेगवेगळ्या करा आणि नीट लावून परत ठेवा.',
      instructions: [
        'कपाट किंवा ड्रॉवरकडे पाहा.',
        'वस्तू हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Organizing spice rack': {
    en: {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: [
        'Look at the rack while arranging.',
        'Move smoothly between jars.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar o porta-temperos',
      description: 'Arrume os potes e vidros de tempero no suporte ou na prateleira de forma organizada.',
      instructions: [
        'Olhe para o suporte enquanto arruma.',
        'Mova-se com calma entre os potes.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar el especiero',
      description: 'Acomoda los frascos y botellas de especias en un estante o repisa de forma ordenada.',
      instructions: [
        'Mira el estante mientras acomodas.',
        'Muévete con suavidad entre los frascos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'मसालों का रैक व्यवस्थित करना',
      description: 'मसालों की डिब्बियाँ और बोतलें रैक या शेल्फ़ पर करीने से सजाएँ।',
      instructions: [
        'सजाते समय रैक की ओर देखें।',
        'एक डिब्बी से दूसरी डिब्बी तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'মশলার র‍্যাক গোছানো',
      description: 'মশলার কৌটো আর বোতল র‍্যাক বা তাকে গুছিয়ে সাজান।',
      instructions: [
        'সাজানোর সময় র‍্যাকের দিকে তাকান।',
        'একটার পর একটা কৌটো মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மசாலா ரேக்கை ஒழுங்காக்குவது',
      description: 'மசாலா டப்பாக்கள் மற்றும் பாட்டில்களை ஒரு ரேக் அல்லது அலமாரியில் ஒழுங்காக அடுக்கி வையுங்கள்.',
      instructions: [
        'அடுக்கும்போது ரேக்கை பாருங்கள்.',
        'ஒரு டப்பாவிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మసాలా ర్యాక్ సర్దడం',
      description: 'మసాలా డబ్బాలు, బాటిళ్లను ర్యాక్ లేదా షెల్ఫ్ మీద క్రమంగా అమర్చండి.',
      instructions: [
        'అమర్చుతున్నప్పుడు ర్యాక్ వైపు చూడండి.',
        'డబ్బాల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'मसाल्याचे रॅक लावणे',
      description: 'मसाल्याच्या बरण्या आणि बाटल्या रॅकवर किंवा फळीवर नीट क्रमाने लावा.',
      instructions: [
        'लावताना रॅककडे पाहा.',
        'एका बरणीकडून दुसरीकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Setting a table': {
    en: {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: [
        'Look down at the table while placing items.',
        'Move smoothly between items.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Pôr a mesa',
      description: 'Coloque pratos, copos, colheres, garfos e guardanapos na mesa para a refeição.',
      instructions: [
        'Olhe para baixo, para a mesa, enquanto coloca os itens.',
        'Mova-se com calma entre os itens.',
      ],
      examples: [],
    },
    es: {
      name: 'Poner la mesa',
      description: 'Coloca los platos, vasos, cucharas, tenedores y servilletas en la mesa para una comida.',
      instructions: [
        'Mira hacia abajo, a la mesa, mientras colocas las cosas.',
        'Muévete con suavidad entre los elementos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाने की मेज़ लगाना',
      description: 'खाने के लिए मेज़ पर प्लेट, गिलास, चम्मच, काँटे और रुमाल रखें।',
      instructions: [
        'चीज़ें रखते समय मेज़ की ओर नीचे देखें।',
        'एक चीज़ से दूसरी चीज़ तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'টেবিল সাজানো',
      description: 'খাওয়ার জন্য টেবিলে প্লেট, গ্লাস, চামচ, কাঁটা আর ন্যাপকিন সাজিয়ে রাখুন।',
      instructions: [
        'জিনিস রাখার সময় টেবিলের দিকে তাকান।',
        'একটার পর একটা জিনিস মসৃণভাবে রাখুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மேசை அமைப்பது',
      description: 'சாப்பிட தட்டு, கிளாஸ், கரண்டி, முள் கரண்டி, நாப்கின்களை மேசையில் வையுங்கள்.',
      instructions: [
        'பொருட்களை வைக்கும்போது மேசையை கீழே பாருங்கள்.',
        'ஒரு பொருளிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'టేబుల్ సర్దడం',
      description: 'భోజనం కోసం టేబుల్ మీద ప్లేట్లు, గ్లాసులు, చెంచాలు, ఫోర్క్‌లు, రుమాళ్లు పెట్టండి.',
      instructions: [
        'వస్తువులు పెడుతున్నప్పుడు టేబుల్ వైపు కిందికి చూడండి.',
        'వస్తువుల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'टेबल मांडणे',
      description: 'जेवणासाठी टेबलवर ताटं, ग्लास, चमचे, काटे आणि नॅपकिन ठेवा.',
      instructions: [
        'वस्तू ठेवताना टेबलकडे खाली पाहा.',
        'एका वस्तूकडून दुसरीकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Clearing a table': {
    en: {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        'Keep moving items — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Tirar a mesa',
      description: 'Tire pratos, copos, restos de comida e lixo da mesa depois da refeição.',
      instructions: [
        'Olhe para baixo, para a mesa, enquanto tira as coisas.',
        'Continue tirando os itens — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Recoger la mesa',
      description: 'Retira los platos, vasos, sobras y basura de la mesa después de comer.',
      instructions: [
        'Mira hacia abajo, a la mesa, mientras recoges.',
        'Sigue moviendo cosas, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाने की मेज़ साफ़ करना',
      description: 'खाने के बाद मेज़ से प्लेट, गिलास, बचा हुआ खाना और कचरा हटाएँ।',
      instructions: [
        'मेज़ साफ़ करते समय नीचे देखें।',
        'चीज़ें हटाते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'টেবিল পরিষ্কার করা',
      description: 'খাওয়ার পর টেবিল থেকে প্লেট, গ্লাস, বেঁচে যাওয়া খাবার আর আবর্জনা সরিয়ে নিন।',
      instructions: [
        'পরিষ্কার করার সময় টেবিলের দিকে তাকান।',
        'জিনিস সরাতে থাকুন — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மேசையை சுத்தம் செய்வது',
      description: 'சாப்பிட்டு முடிந்தபின் தட்டு, கிளாஸ், மீதி உணவு, குப்பைகளை மேசையில் இருந்து எடுத்து விடுங்கள்.',
      instructions: [
        'சுத்தம் செய்யும்போது மேசையை கீழே பாருங்கள்.',
        'பொருட்களை அசைத்துக்கொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'టేబుల్ ఖాళీ చేయడం',
      description: 'భోజనం అయ్యాక టేబుల్ మీద ప్లేట్లు, గ్లాసులు, మిగిలిన ఆహారం, చెత్తను తీసివేయండి.',
      instructions: [
        'ఖాళీ చేస్తున్నప్పుడు టేబుల్ వైపు కిందికి చూడండి.',
        'వస్తువులు కదుపుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'टेबल आवरणे',
      description: 'जेवण झाल्यावर टेबलवरील ताटं, ग्लास, उरलेले अन्न आणि कचरा काढा.',
      instructions: [
        'आवरताना टेबलकडे खाली पाहा.',
        'वस्तू हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Organizing or stocking fridge': {
    en: {
      name: 'Organizing or stocking fridge',
      description: 'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        'Keep moving items — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar ou abastecer a geladeira',
      description: 'Coloque comida e bebidas dentro da geladeira de forma organizada. Mexa nos itens antigos e encaixe os novos.',
      instructions: [
        'Abra a geladeira totalmente e olhe para dentro.',
        'Continue mexendo nos itens — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar o llenar el refrigerador',
      description: 'Coloca la comida y las bebidas dentro del refrigerador de forma ordenada. Mueve lo viejo y haz espacio para lo nuevo.',
      instructions: [
        'Abre bien el refrigerador y mira adentro.',
        'Sigue moviendo cosas, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'फ्रिज व्यवस्थित करना या भरना',
      description: 'खाने-पीने की चीज़ें फ्रिज में करीने से रखें। पुरानी चीज़ें हटाएँ और नई चीज़ें अंदर रखें।',
      instructions: [
        'फ्रिज पूरा खोलें और अंदर देखें।',
        'चीज़ें हटाते-रखते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ফ্রিজ গোছানো বা ভরা',
      description: 'ফ্রিজে খাবার আর পানীয় গুছিয়ে রাখুন। পুরোনো জিনিস সরিয়ে নতুনগুলো ভরে দিন।',
      instructions: [
        'ফ্রিজ পুরো খুলে ভেতরে তাকান।',
        'জিনিস নাড়াচাড়া চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஃபிரிட்ஜை ஒழுங்காக்குவது அல்லது நிரப்புவது',
      description: 'உணவு மற்றும் பானங்களை ஃபிரிட்ஜினுள் ஒழுங்காக வையுங்கள். பழைய பொருட்களை மாற்றி வைத்து, புதியதை உள்ளே அடுக்குங்கள்.',
      instructions: [
        'ஃபிரிட்ஜை முழுமையாக திறந்து உள்ளே பாருங்கள்.',
        'பொருட்களை அசைத்துக்கொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఫ్రిజ్ సర్దడం లేదా నింపడం',
      description: 'ఫ్రిజ్ లోపల ఆహారం, పానీయాలను నీట్‌గా పెట్టండి. పాత వస్తువులు సర్ది కొత్తవి అమర్చండి.',
      instructions: [
        'ఫ్రిజ్ పూర్తిగా తెరిచి లోపలికి చూడండి.',
        'వస్తువులు కదుపుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'फ्रिज लावणे किंवा भरणे',
      description: 'फ्रिजमध्ये अन्न आणि पेयं नीट लावून ठेवा. जुन्या वस्तू बाजूला करून नवीन वस्तूंना जागा करा.',
      instructions: [
        'फ्रिज पूर्ण उघडा आणि आत पाहा.',
        'वस्तू हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Unpacking or sorting groceries': {
    en: {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: [
        'Look down at the bags and items.',
        'Keep unpacking — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Desencaixotar ou separar as compras',
      description: 'Tire as compras das sacolas e separe. Coloque cada coisa no lugar certo.',
      instructions: [
        'Olhe para baixo, para as sacolas e os itens.',
        'Continue desencaixotando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Desempacar o acomodar las compras',
      description: 'Saca las compras de las bolsas y ordénalas. Pon cada cosa en su lugar.',
      instructions: [
        'Mira hacia abajo, a las bolsas y a las cosas.',
        'Sigue desempacando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'सामान खोलना या छाँटना',
      description: 'थैलियों से सामान निकालें और उन्हें छाँटें। हर चीज़ को उसकी सही जगह पर रखें।',
      instructions: [
        'थैलियों और सामान की ओर नीचे देखें।',
        'सामान निकालते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাজার থেকে আনা জিনিস বের করা বা বাছাই করা',
      description: 'ব্যাগ থেকে বাজার বের করে বাছাই করুন। প্রত্যেকটা জিনিস নিজ নিজ জায়গায় রাখুন।',
      instructions: [
        'ব্যাগ আর জিনিসের দিকে তাকান।',
        'বের করতে থাকুন — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மளிகை சாமான்களை எடுத்து வரிசைப்படுத்துவது',
      description: 'பைகளில் இருந்து மளிகை சாமான்களை எடுத்து வரிசைப்படுத்துங்கள். ஒவ்வொரு பொருளையும் சரியான இடத்தில் வையுங்கள்.',
      instructions: [
        'பைகளையும் பொருட்களையும் கீழே பாருங்கள்.',
        'எடுத்துக்கொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'సరుకులు తీయడం లేదా వర్గీకరించడం',
      description: 'బ్యాగుల్లోంచి సరుకులు తీసి వాటిని వర్గీకరించండి. ప్రతి దాన్ని దాని చోట పెట్టండి.',
      instructions: [
        'బ్యాగులు, వస్తువుల వైపు కిందికి చూడండి.',
        'తీస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'किराणा बाहेर काढणे किंवा वेगवेगळे करणे',
      description: 'पिशव्यांमधून किराणा बाहेर काढा आणि वेगवेगळा करा. प्रत्येक वस्तू योग्य जागी ठेवा.',
      instructions: [
        'पिशव्या आणि वस्तूंकडे खाली पाहा.',
        'बाहेर काढणे चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Using a garbage disposal': {
    en: {
      name: 'Using a garbage disposal',
      description: 'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: [
        'Look down at the sink.',
        'Move slowly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Usar o triturador de pia',
      description: 'Empurre os restos de comida para o ralo da pia, abra a água fria e ligue o triturador para moer os resíduos.',
      instructions: [
        'Olhe para baixo, para a pia.',
        'Mova-se devagar entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Usar el triturador de basura',
      description: 'Raspa los restos de comida hacia el desagüe del fregadero, abre el agua fría y enciende el triturador para moler los desechos.',
      instructions: [
        'Mira hacia abajo, al fregadero.',
        'Muévete despacio entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'गार्बेज डिस्पोज़ल इस्तेमाल करना',
      description: 'खाने के टुकड़े सिंक के नाली में डालें, ठंडा पानी चलाएँ, और सिंक के नीचे लगे डिस्पोज़ल को चालू करके कचरे को पीसें।',
      instructions: [
        'सिंक की ओर नीचे देखें।',
        'हर कदम धीरे-धीरे बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'গার্বেজ ডিসপোজাল ব্যবহার করা',
      description: 'খাবারের টুকরো সিঙ্কের ড্রেনে ফেলুন, ঠান্ডা জল ছাড়ুন, আর সিঙ্কের ভেতরের ডিসপোজাল চালু করে আবর্জনা গুঁড়ো করুন।',
      instructions: [
        'সিঙ্কের দিকে তাকান।',
        'ধাপগুলোর মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'கார்பேஜ் டிஸ்போஸல் பயன்படுத்துவது',
      description: 'உணவு துண்டுகளை சிங்க் வடிகாலில் தள்ளி, குளிர்ந்த தண்ணீரை விட்டு, சிங்க்-உள் டிஸ்போஸலை இயக்கி கழிவை அரைக்கவும்.',
      instructions: [
        'சிங்கை கீழே பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గార్బేజ్ డిస్పోజల్ ఉపయోగించడం',
      description: 'మిగిలిన ఆహారాన్ని సింక్ డ్రెయిన్‌లోకి తోయండి, చల్లని నీళ్లు వదలండి, సింక్‌లోని డిస్పోజల్ ఆన్ చేసి వ్యర్థాలను పిండి చేయండి.',
      instructions: [
        'సింక్ వైపు కిందికి చూడండి.',
        'ప్రతి అడుగు మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'गार्बेज डिस्पोजल वापरणे',
      description: 'अन्नाचे तुकडे सिंकच्या नाळीत टाका, थंड पाणी सोडा आणि कचरा बारीक करण्यासाठी सिंकमधील डिस्पोजल चालू करा.',
      instructions: [
        'सिंककडे खाली पाहा.',
        'टप्प्यांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Cleaning kitchen counter-top': {
    en: {
      name: 'Cleaning kitchen counter-top',
      description: 'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: [
        'Look down at the counter.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar a bancada da cozinha',
      description: 'Passe um pano com produto de limpeza na bancada da cozinha para tirar sujeira, restos de comida e manchas.',
      instructions: [
        'Olhe para baixo, para a bancada.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpiar la encimera de la cocina',
      description: 'Pasa un paño con limpiador por la encimera para quitar la suciedad, los restos de comida y las manchas.',
      instructions: [
        'Mira hacia abajo, a la encimera.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'रसोई का स्लैब साफ़ करना',
      description: 'रसोई के स्लैब को कपड़े और क्लीनर से पोंछें ताकि गंदगी, खाना और दाग हट जाएँ।',
      instructions: [
        'स्लैब की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'রান্নাঘরের কাউন্টার পরিষ্কার করা',
      description: 'কাপড় আর ক্লিনার দিয়ে রান্নাঘরের কাউন্টার মুছে ময়লা, খাবার আর দাগ তুলে ফেলুন।',
      instructions: [
        'কাউন্টারের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சமையலறை கவுண்டரை சுத்தம் செய்வது',
      description: 'சமையலறை கவுண்டரை துணி மற்றும் கிளீனர் கொண்டு துடைத்து, அழுக்கு, உணவு, கறைகளை நீக்கவும்.',
      instructions: [
        'கவுண்டரை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'వంటగది అరుగు శుభ్రం చేయడం',
      description: 'మురికి, ఆహారం, మరకలను తీయడానికి గుడ్డ, క్లీనర్‌తో వంటగది అరుగును తుడవండి.',
      instructions: [
        'అరుగు వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'स्वयंपाकघराचे ओटा साफ करणे',
      description: 'फडक्याने आणि क्लीनरने ओट्यावरील घाण, अन्न आणि डाग पुसून काढा.',
      instructions: [
        'ओट्याकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Cleaning appliances': {
    en: {
      name: 'Cleaning appliances',
      description: 'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: [
        'Look at the part you are cleaning.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar eletrodomésticos',
      description: 'Limpe aparelhos como o micro-ondas, o fogão ou a geladeira por fora e por dentro.',
      instructions: [
        'Olhe para a parte que você está limpando.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpiar los electrodomésticos',
      description: 'Limpia electrodomésticos como el microondas, la estufa o el refrigerador por fuera y por dentro.',
      instructions: [
        'Mira la parte que estás limpiando.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'उपकरण साफ़ करना',
      description: 'माइक्रोवेव, गैस या फ्रिज जैसे उपकरणों को बाहर और अंदर से पोंछकर साफ़ करें।',
      instructions: [
        'जो हिस्सा साफ़ कर रहे हैं, उसकी ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'যন্ত্রপাতি পরিষ্কার করা',
      description: 'মাইক্রোওয়েভ, গ্যাস বা ফ্রিজের মতো যন্ত্র বাইরে আর ভেতর থেকে মুছে পরিষ্কার করুন।',
      instructions: [
        'যে অংশ পরিষ্কার করছেন সেদিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வீட்டு உபகரணங்களை சுத்தம் செய்வது',
      description: 'மைக்ரோவேவ், அடுப்பு, ஃபிரிட்ஜ் போன்ற உபகரணங்களை வெளியேயும் உள்ளேயும் துடைத்து சுத்தம் செய்யுங்கள்.',
      instructions: [
        'நீங்கள் சுத்தம் செய்யும் பகுதியை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పరికరాలు శుభ్రం చేయడం',
      description: 'మైక్రోవేవ్, పొయ్యి లేదా ఫ్రిజ్ లాంటి పరికరాలను బయట, లోపల తుడిచి శుభ్రం చేయండి.',
      instructions: [
        'మీరు శుభ్రం చేస్తున్న భాగం వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'उपकरणं साफ करणे',
      description: 'मायक्रोवेव्ह, गॅस किंवा फ्रिज सारखी उपकरणं आतून-बाहेरून पुसून स्वच्छ करा.',
      instructions: [
        'तुम्ही जो भाग साफ करत आहात त्याकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  Sweeping: {
    en: {
      name: 'Sweeping',
      description: 'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: [
        'Look down at the floor.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Varrer',
      description: 'Use uma vassoura para juntar a sujeira e a poeira do chão em um canto. Depois recolha com a pá.',
      instructions: [
        'Olhe para baixo, para o chão.',
        'Ande devagar com pequenos movimentos de cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Barrer',
      description: 'Usa una escoba para juntar la suciedad y el polvo del piso en un solo lugar. Después recógelo con un recogedor.',
      instructions: [
        'Mira hacia abajo, al piso.',
        'Camina despacio con pequeños giros de cabeza.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'झाड़ू लगाना',
      description: 'झाड़ू से फ़र्श की धूल और गंदगी एक जगह करें। फिर उसे डस्टपैन में इकट्ठा करें।',
      instructions: [
        'फ़र्श की ओर नीचे देखें।',
        'धीरे-धीरे चलें और हल्के से सिर घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ঝাঁট দেওয়া',
      description: 'ঝাঁটা দিয়ে মেঝের ময়লা আর ধুলো এক জায়গায় ঠেলে আনুন। তারপর ঝুড়িতে তুলে নিন।',
      instructions: [
        'মেঝের দিকে তাকান।',
        'ছোট ছোট মাথা ঘুরিয়ে আস্তে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துடைப்பம் போடுவது',
      description: 'துடைப்பம் கொண்டு தரையில் உள்ள அழுக்கு, தூசுகளை ஒரே இடத்தில் சேர்க்கவும். பின்னர் டஸ்ட்பேனில் எடுக்கவும்.',
      instructions: [
        'தரையை கீழே பாருங்கள்.',
        'மெதுவாக நடந்து, தலையை சிறிது சிறிதாக திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఊడ్చడం',
      description: 'నేల మీద ఉన్న మురికి, దుమ్మును చీపురుతో ఒక చోటికి తోయండి. తర్వాత దాన్ని డస్ట్‌ప్యాన్‌లో ఎత్తండి.',
      instructions: [
        'నేల వైపు కిందికి చూడండి.',
        'చిన్నగా తల తిప్పుతూ నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'झाडू मारणे',
      description: 'झाडूने फरशीवरील धूळ आणि घाण एका जागी जमा करा. नंतर ती सूपात गोळा करा.',
      instructions: [
        'फरशीकडे खाली पाहा.',
        'डोके छोट्या हालचालींनी फिरवत हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  Mopping: {
    en: {
      name: 'Mopping',
      description: 'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: [
        'Look down at the floor.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Passar pano no chão',
      description: 'Use um esfregão molhado para limpar o chão. Molhe o esfregão na água com sabão, torça e passe pelo chão em partes até ficar limpo.',
      instructions: [
        'Olhe para baixo, para o chão.',
        'Ande devagar com pequenos movimentos de cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Trapear',
      description: 'Usa un trapeador mojado para limpiar el piso. Moja el trapeador en agua con jabón, escúrrelo y pasa por el piso por partes hasta que esté limpio.',
      instructions: [
        'Mira hacia abajo, al piso.',
        'Camina despacio con pequeños giros de cabeza.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पोछा लगाना',
      description: 'गीले पोछे से फ़र्श साफ़ करें। पोछे को साबुन वाले पानी में डुबोएँ, निचोड़ें, और हिस्सों में फ़र्श पोंछें जब तक वह साफ़ न हो जाए।',
      instructions: [
        'फ़र्श की ओर नीचे देखें।',
        'धीरे-धीरे चलें और हल्के से सिर घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'মেঝে মোছা',
      description: 'ভেজা ন্যাতা দিয়ে মেঝে মুছুন। সাবান-জলে ন্যাতা ডুবিয়ে নিংড়ে অংশে অংশে মুছুন যতক্ষণ না পরিষ্কার হয়।',
      instructions: [
        'মেঝের দিকে তাকান।',
        'ছোট ছোট মাথা ঘুরিয়ে আস্তে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'தரை துடைப்பது',
      description: 'ஈரமான மொப்பால் தரையை சுத்தம் செய்யுங்கள். மொப்பை சோப்பு தண்ணீரில் தோய்த்து, பிழிந்து, தரையை பகுதி பகுதியாக சுத்தமாகும் வரை துடையுங்கள்.',
      instructions: [
        'தரையை கீழே பாருங்கள்.',
        'மெதுவாக நடந்து, தலையை சிறிது சிறிதாக திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'తడిగుడ్డతో నేల తుడవడం',
      description: 'తడి మాప్‌తో నేలను శుభ్రం చేయండి. మాప్‌ను సబ్బు నీటిలో ముంచి, పిండి, నేలను భాగాలవారీగా శుభ్రం అయ్యేవరకు తుడవండి.',
      instructions: [
        'నేల వైపు కిందికి చూడండి.',
        'చిన్నగా తల తిప్పుతూ నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'फरशी पुसणे',
      description: 'ओल्या पोछ्याने फरशी पुसा. पोछा साबणाच्या पाण्यात बुडवा, पिळून घ्या आणि भाग-भाग करत फरशी स्वच्छ होईपर्यंत पुसा.',
      instructions: [
        'फरशीकडे खाली पाहा.',
        'डोके छोट्या हालचालींनी फिरवत हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  Vacuuming: {
    en: {
      name: 'Vacuuming',
      description: 'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Aspirar',
      description: 'Use um aspirador de pó para tirar a poeira e a sujeira do chão, do tapete ou dos móveis.',
      instructions: [
        'Olhe para baixo, para a área que está limpando.',
        'Ande devagar com pequenos movimentos de cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Aspirar',
      description: 'Usa una aspiradora para juntar el polvo y la suciedad del piso, la alfombra o los muebles.',
      instructions: [
        'Mira hacia abajo, al área que estás limpiando.',
        'Camina despacio con pequeños giros de cabeza.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'वैक्यूम करना',
      description: 'वैक्यूम क्लीनर से फ़र्श, क़ालीन या फर्नीचर से धूल और गंदगी खींचें।',
      instructions: [
        'जिस जगह को साफ़ कर रहे हैं, उसकी ओर नीचे देखें।',
        'धीरे-धीरे चलें और हल्के से सिर घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ভ্যাকুয়াম করা',
      description: 'ভ্যাকুয়াম ক্লিনার দিয়ে মেঝে, কার্পেট বা আসবাব থেকে ধুলো-ময়লা টেনে নিন।',
      instructions: [
        'যে জায়গা পরিষ্কার করছেন সেদিকে তাকান।',
        'ছোট ছোট মাথা ঘুরিয়ে আস্তে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வாக்யூம் செய்வது',
      description: 'வாக்யூம் கிளீனரை பயன்படுத்தி தரை, கம்பளம் அல்லது மரச்சாமான்களில் உள்ள தூசு, அழுக்கை உறிஞ்சவும்.',
      instructions: [
        'சுத்தம் செய்யும் இடத்தை கீழே பாருங்கள்.',
        'மெதுவாக நடந்து, தலையை சிறிது சிறிதாக திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'వాక్యూమ్ చేయడం',
      description: 'నేల, కార్పెట్ లేదా ఫర్నిచర్ నుండి దుమ్ము, మురికిని పీల్చడానికి వాక్యూమ్ క్లీనర్ ఉపయోగించండి.',
      instructions: [
        'మీరు శుభ్రం చేస్తున్న ప్రాంతం వైపు కిందికి చూడండి.',
        'చిన్నగా తల తిప్పుతూ నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'व्हॅक्यूम करणे',
      description: 'व्हॅक्यूम क्लीनरने फरशी, कार्पेट किंवा फर्निचरवरील धूळ आणि घाण ओढून घ्या.',
      instructions: [
        'तुम्ही जो भाग साफ करत आहात त्याकडे खाली पाहा.',
        'डोके छोट्या हालचालींनी फिरवत हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  Dusting: {
    en: {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: [
        'Look at the surface while wiping.',
        'Move smoothly between surfaces.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Tirar o pó',
      description: 'Use um pano ou espanador para tirar a poeira das prateleiras, mesas e outras superfícies.',
      instructions: [
        'Olhe para a superfície enquanto passa o pano.',
        'Mova-se com calma entre as superfícies.',
      ],
      examples: [],
    },
    es: {
      name: 'Quitar el polvo',
      description: 'Usa un paño o plumero para quitar el polvo de las repisas, mesas y otras superficies.',
      instructions: [
        'Mira la superficie mientras pasas el paño.',
        'Muévete con suavidad entre las superficies.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'धूल झाड़ना',
      description: 'कपड़े या डस्टर से शेल्फ़, मेज़ और दूसरी सतहों की धूल पोंछें।',
      instructions: [
        'पोंछते समय सतह की ओर देखें।',
        'एक सतह से दूसरी सतह तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ঝাড়পোছ করা',
      description: 'কাপড় বা ডাস্টার দিয়ে তাক, টেবিল আর অন্যান্য জায়গা থেকে ধুলো মুছুন।',
      instructions: [
        'মোছার সময় ওই জায়গার দিকে তাকান।',
        'একটার পর একটা জায়গায় মসৃণভাবে যান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'தூசு துடைப்பது',
      description: 'துணி அல்லது டஸ்டர் கொண்டு அலமாரி, மேசை மற்றும் மற்ற இடங்களில் உள்ள தூசுகளை துடைத்து விடுங்கள்.',
      instructions: [
        'துடைக்கும்போது அந்த மேற்பரப்பை பாருங்கள்.',
        'ஒன்றிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'దుమ్ము తుడవడం',
      description: 'షెల్ఫ్‌లు, టేబుల్స్, ఇతర ఉపరితలాల మీద దుమ్మును తీయడానికి గుడ్డ లేదా డస్టర్ వాడండి.',
      instructions: [
        'తుడుస్తున్నప్పుడు ఉపరితలం వైపు చూడండి.',
        'ఉపరితలాల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'धूळ झटकणे',
      description: 'फडकं किंवा डस्टरने फळ्या, टेबल आणि इतर पृष्ठभागावरील धूळ पुसा.',
      instructions: [
        'पुसताना पृष्ठभागाकडे पाहा.',
        'एका पृष्ठभागावरून दुसऱ्यावर सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Spraying and wiping surfaces': {
    en: {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: [
        'Look at the surface while wiping.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Borrifar e passar pano nas superfícies',
      description: 'Borrife o produto de limpeza na superfície e passe um pano para limpar.',
      instructions: [
        'Olhe para a superfície enquanto passa o pano.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Rociar y limpiar superficies',
      description: 'Rocía limpiador sobre una superficie y pásale un paño hasta que quede limpia.',
      instructions: [
        'Mira la superficie mientras pasas el paño.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'सतह पर स्प्रे और पोंछा करना',
      description: 'सतह पर क्लीनर छिड़कें और कपड़े से पोंछकर साफ़ करें।',
      instructions: [
        'पोंछते समय सतह की ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'স্প্রে করে জায়গা মোছা',
      description: 'কোনো জায়গায় ক্লিনার স্প্রে করে কাপড় দিয়ে মুছে পরিষ্কার করুন।',
      instructions: [
        'মোছার সময় ওই জায়গার দিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மேற்பரப்பில் தெளித்து துடைப்பது',
      description: 'மேற்பரப்பில் கிளீனரை தெளித்து, துணியால் சுத்தமாக துடையுங்கள்.',
      instructions: [
        'துடைக்கும்போது அந்த மேற்பரப்பை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఉపరితలాల మీద స్ప్రే చేసి తుడవడం',
      description: 'ఉపరితలం మీద క్లీనర్ స్ప్రే చేసి, గుడ్డతో తుడిచి శుభ్రం చేయండి.',
      instructions: [
        'తుడుస్తున్నప్పుడు ఉపరితలం వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पृष्ठभाग फवारणे आणि पुसणे',
      description: 'पृष्ठभागावर क्लीनर फवारा आणि फडक्याने पुसून स्वच्छ करा.',
      instructions: [
        'पुसताना पृष्ठभागाकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Bathroom cleaning': {
    en: {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: [
        'Look at the part you are cleaning.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar o banheiro',
      description: 'Limpe o vaso sanitário, a pia, o box e os azulejos usando produto, escova e pano.',
      instructions: [
        'Olhe para a parte que você está limpando.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpieza del baño',
      description: 'Limpia el inodoro, el lavabo, la ducha y los azulejos con limpiador, cepillo y paño.',
      instructions: [
        'Mira la parte que estás limpiando.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बाथरूम की सफ़ाई',
      description: 'क्लीनर, ब्रश और कपड़े से शौचालय, बेसिन, शॉवर और टाइलें साफ़ करें।',
      instructions: [
        'जो हिस्सा साफ़ कर रहे हैं, उसकी ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাথরুম পরিষ্কার করা',
      description: 'ক্লিনার, ব্রাশ আর কাপড় দিয়ে টয়লেট, বেসিন, শাওয়ার আর টাইলস পরিষ্কার করুন।',
      instructions: [
        'যে অংশ পরিষ্কার করছেন সেদিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'குளியலறை சுத்தம் செய்வது',
      description: 'கழிப்பறை, சிங்க், ஷவர், டைல்களை கிளீனர், பிரஷ் மற்றும் துணியால் சுத்தம் செய்யவும்.',
      instructions: [
        'சுத்தம் செய்யும் பகுதியை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బాత్రూమ్ శుభ్రం చేయడం',
      description: 'క్లీనర్, బ్రష్, గుడ్డ ఉపయోగించి టాయిలెట్, సింక్, షవర్, టైల్స్‌ను శుభ్రం చేయండి.',
      instructions: [
        'మీరు శుభ్రం చేస్తున్న భాగం వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'बाथरूम साफ करणे',
      description: 'क्लीनर, ब्रश आणि फडक्याने टॉयलेट, बेसिन, शॉवर आणि टाइल्स साफ करा.',
      instructions: [
        'तुम्ही जो भाग साफ करत आहात त्याकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Cleaning windows and mirrors': {
    en: {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: [
        'Look at the glass while wiping.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar janelas e espelhos',
      description: 'Borrife produto no vidro e passe um pano ou papel até ficar transparente.',
      instructions: [
        'Olhe para o vidro enquanto passa o pano.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpiar ventanas y espejos',
      description: 'Rocía limpiador en el vidrio y pásale un paño o papel hasta que quede transparente.',
      instructions: [
        'Mira el vidrio mientras lo limpias.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खिड़कियाँ और शीशे साफ़ करना',
      description: 'काँच पर क्लीनर छिड़कें और कपड़े या काग़ज़ से पोंछें जब तक वह साफ़ न हो जाए।',
      instructions: [
        'पोंछते समय काँच की ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'জানলা আর আয়না পরিষ্কার করা',
      description: 'কাচে ক্লিনার স্প্রে করে কাপড় বা কাগজ দিয়ে মুছুন যতক্ষণ না ঝকঝকে হয়।',
      instructions: [
        'মোছার সময় কাচের দিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஜன்னல்கள் மற்றும் கண்ணாடிகளை சுத்தம் செய்வது',
      description: 'கண்ணாடியில் கிளீனரை தெளித்து, துணி அல்லது காகிதத்தால் தெளிவாகும் வரை துடையுங்கள்.',
      instructions: [
        'துடைக்கும்போது கண்ணாடியை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'కిటికీలు, అద్దాలు శుభ్రం చేయడం',
      description: 'గాజు మీద క్లీనర్ స్ప్రే చేసి, స్పష్టంగా అయ్యేవరకు గుడ్డ లేదా కాగితంతో తుడవండి.',
      instructions: [
        'తుడుస్తున్నప్పుడు గాజు వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'खिडक्या आणि आरसे साफ करणे',
      description: 'काचेवर क्लीनर फवारा आणि कापडाने किंवा कागदाने स्वच्छ होईपर्यंत पुसा.',
      instructions: [
        'पुसताना काचेकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Emptying or replacing trash bag': {
    en: {
      name: 'Emptying or replacing trash bag',
      description: 'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: [
        'Look down at the bin while you work.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Esvaziar ou trocar o saco de lixo',
      description: 'Tire o saco de lixo cheio da lixeira, amarre e coloque um saco novo dentro da lixeira.',
      instructions: [
        'Olhe para baixo, para a lixeira, enquanto trabalha.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Vaciar o cambiar la bolsa de basura',
      description: 'Saca la bolsa de basura llena del bote, átala y coloca una bolsa nueva dentro del bote.',
      instructions: [
        'Mira hacia abajo, al bote, mientras trabajas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कचरे की थैली खाली करना या बदलना',
      description: 'भरी हुई कचरे की थैली डिब्बे से निकालें, बाँधें, और नई थैली डिब्बे में लगाएँ।',
      instructions: [
        'काम करते समय डिब्बे की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ডাস্টবিনের ব্যাগ খালি করা বা বদলানো',
      description: 'বিনের ভর্তি ব্যাগ বের করে বেঁধে নিন, আর বিনে নতুন ব্যাগ ভরে দিন।',
      instructions: [
        'কাজের সময় বিনের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'குப்பை பையை காலி செய்வது அல்லது மாற்றுவது',
      description: 'நிறைந்த குப்பை பையை தொட்டியில் இருந்து எடுத்து, கட்டி, ஒரு புதிய பையை தொட்டியில் வையுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது தொட்டியை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'చెత్త బ్యాగ్ ఖాళీ చేయడం లేదా మార్చడం',
      description: 'డబ్బా నుండి నిండిన చెత్త బ్యాగ్ తీసి, ముడివేసి, డబ్బాలో కొత్త బ్యాగ్ పెట్టండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు డబ్బా వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कचऱ्याची पिशवी रिकामी करणे किंवा बदलणे',
      description: 'कचराडब्यातून भरलेली पिशवी बाहेर काढा, बांधा आणि नवीन पिशवी डब्यात ठेवा.',
      instructions: [
        'काम करताना डब्याकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Taking out trash': {
    en: {
      name: 'Taking out trash',
      description: 'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Levar o lixo para fora',
      description: 'Leve o saco de lixo amarrado para fora de casa e coloque na lixeira externa ou no ponto de coleta.',
      instructions: [
        'Olhe para a frente e para a lixeira ao colocar o saco.',
        'Ande devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Sacar la basura',
      description: 'Lleva la bolsa de basura atada desde la casa y déjala en el bote de afuera o en el lugar de recolección.',
      instructions: [
        'Mira hacia adelante y al bote al colocar la bolsa.',
        'Camina despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कचरा बाहर ले जाना',
      description: 'बँधी हुई कचरे की थैली घर से बाहर ले जाएँ और बाहर के डिब्बे या कचरा उठाने की जगह पर रखें।',
      instructions: [
        'थैली रखते समय आगे और डिब्बे की ओर देखें।',
        'धीरे और सँभलकर चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'আবর্জনা ফেলে আসা',
      description: 'বাঁধা ব্যাগ বাড়ি থেকে নিয়ে গিয়ে বাইরের বিনে বা তোলার জায়গায় রাখুন।',
      instructions: [
        'ব্যাগ রাখার সময় সামনে আর বিনের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'குப்பையை வெளியே கொண்டு போவது',
      description: 'கட்டிய குப்பை பையை வீட்டிலிருந்து எடுத்து, வெளியே உள்ள தொட்டியில் அல்லது சேகரிக்கும் இடத்தில் வையுங்கள்.',
      instructions: [
        'பையை வைக்கும்போது முன்னேயும் தொட்டியையும் பாருங்கள்.',
        'மெதுவாக, நிலையாக நடக்கவும்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'చెత్త బయటకు తీసుకెళ్లడం',
      description: 'ముడివేసిన చెత్త బ్యాగ్‌ను ఇంటి నుండి తీసుకెళ్లి బయట డబ్బాలో లేదా పికప్ చోట పెట్టండి.',
      instructions: [
        'ముందుకు చూడండి, బ్యాగ్ పెట్టేటప్పుడు డబ్బా వైపు చూడండి.',
        'నెమ్మదిగా, స్థిరంగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कचरा बाहेर टाकणे',
      description: 'बांधलेली कचऱ्याची पिशवी घरातून बाहेर नेऊन बाहेरील डब्यात किंवा पिकअप जागी ठेवा.',
      instructions: [
        'समोर आणि पिशवी ठेवताना डब्याकडे पाहा.',
        'हळूहळू आणि स्थिरपणे चाला.',
      ],
      examples: [],
    },
  },
  'Sweeping outdoor area': {
    en: {
      name: 'Sweeping outdoor area',
      description: 'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: [
        'Look down at the floor.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Varrer área externa',
      description: 'Use uma vassoura para tirar folhas, poeira e sujeira de áreas externas como varanda ou garagem.',
      instructions: [
        'Olhe para baixo, para o chão.',
        'Ande devagar com pequenos movimentos de cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Barrer área exterior',
      description: 'Usa una escoba para quitar hojas, polvo y suciedad de pisos exteriores como un porche o una entrada de auto.',
      instructions: [
        'Mira hacia abajo, al piso.',
        'Camina despacio con pequeños giros de cabeza.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बाहर की जगह झाड़ू लगाना',
      description: 'झाड़ू से बाहर के फ़र्श जैसे बरामदे या ड्राइववे से पत्ते, धूल और गंदगी साफ़ करें।',
      instructions: [
        'फ़र्श की ओर नीचे देखें।',
        'धीरे-धीरे चलें और हल्के से सिर घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাইরের জায়গা ঝাঁট দেওয়া',
      description: 'ঝাঁটা দিয়ে বারান্দা বা গাড়ি রাখার জায়গার পাতা, ধুলো আর ময়লা পরিষ্কার করুন।',
      instructions: [
        'মেঝের দিকে তাকান।',
        'ছোট ছোট মাথা ঘুরিয়ে আস্তে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வெளி இடத்தை துடைப்பது',
      description: 'வராண்டா அல்லது வீட்டின் முற்றம் போன்ற வெளி இடங்களில் உள்ள இலைகள், தூசு, அழுக்கை துடைப்பத்தால் சுத்தம் செய்யவும்.',
      instructions: [
        'தரையை கீழே பாருங்கள்.',
        'மெதுவாக நடந்து, தலையை சிறிது சிறிதாக திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బయటి ప్రాంతం ఊడ్చడం',
      description: 'వరండా లేదా డ్రైవ్‌వే లాంటి బయటి నేలల నుండి ఆకులు, దుమ్ము, మురికిని తీయడానికి చీపురు ఉపయోగించండి.',
      instructions: [
        'నేల వైపు కిందికి చూడండి.',
        'చిన్నగా తల తిప్పుతూ నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'बाहेरचा भाग झाडणे',
      description: 'व्हरांडा किंवा गाडी ठेवायच्या जागेसारख्या बाहेरील फरशींवरून पानं, धूळ आणि घाण झाडूने काढा.',
      instructions: [
        'फरशीकडे खाली पाहा.',
        'डोके छोट्या हालचालींनी फिरवत हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  'Sorting recyclables': {
    en: {
      name: 'Sorting recyclables',
      description: 'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: [
        'Look at each item before sorting.',
        'Move smoothly between bins.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Separar recicláveis',
      description: 'Separe latas, garrafas, papel e papelão do lixo comum, colocando cada um na lixeira de reciclagem certa.',
      instructions: [
        'Olhe para cada item antes de separar.',
        'Mova-se com calma entre as lixeiras.',
      ],
      examples: [],
    },
    es: {
      name: 'Separar reciclables',
      description: 'Separa latas, botellas, papel y cartón de la basura común y ponlos en los botes de reciclaje correctos.',
      instructions: [
        'Mira cada cosa antes de separarla.',
        'Muévete con suavidad entre los botes.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'रीसाइकल वाला सामान छाँटना',
      description: 'डिब्बे, बोतलें, काग़ज़ और गत्ते को आम कचरे से अलग करके सही रीसाइक्लिंग डिब्बों में डालें।',
      instructions: [
        'छाँटने से पहले हर चीज़ की ओर देखें।',
        'एक डिब्बे से दूसरे डिब्बे तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'রিসাইকেলের জিনিস বাছাই করা',
      description: 'সাধারণ আবর্জনা থেকে ক্যান, বোতল, কাগজ আর কার্ডবোর্ড আলাদা করে ঠিক বিনে ফেলুন।',
      instructions: [
        'বাছাইয়ের আগে প্রত্যেকটা জিনিস দেখুন।',
        'একেকটা বিনে মসৃণভাবে যান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மறுசுழற்சி பொருட்களை பிரிப்பது',
      description: 'டப்பாக்கள், பாட்டில்கள், காகிதம், அட்டைப்பெட்டிகளை சாதாரண குப்பையிலிருந்து பிரித்து, சரியான மறுசுழற்சி தொட்டிகளில் போடுங்கள்.',
      instructions: [
        'வரிசைப்படுத்தும் முன் ஒவ்வொரு பொருளையும் பாருங்கள்.',
        'ஒரு தொட்டியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'రీసైకిల్ చేయదగిన వస్తువులు వేరు చేయడం',
      description: 'డబ్బాలు, బాటిళ్లు, కాగితం, కార్డ్‌బోర్డ్‌ను సాధారణ చెత్త నుండి వేరు చేసి, సరైన రీసైక్లింగ్ డబ్బాలలో పెట్టండి.',
      instructions: [
        'వర్గీకరించే ముందు ప్రతి వస్తువు వైపు చూడండి.',
        'డబ్బాల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'रिसायकल वस्तू वेगळ्या करणे',
      description: 'डबे, बाटल्या, कागद आणि पुठ्ठा सामान्य कचऱ्यापासून वेगळे करून योग्य रिसायकलिंग डब्यांत टाका.',
      instructions: [
        'वेगळे करण्यापूर्वी प्रत्येक वस्तूकडे पाहा.',
        'एका डब्याकडून दुसऱ्या डब्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Shoveling snow': {
    en: {
      name: 'Shoveling snow',
      description: 'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Tirar a neve com pá',
      description: 'Use uma pá de neve para tirar a neve da garagem, calçada ou varanda e juntar em uma pilha do lado.',
      instructions: [
        'Olhe para baixo, para a área que está limpando.',
        'Ande devagar com pequenos movimentos de cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Palear nieve',
      description: 'Usa una pala para nieve para levantar y mover la nieve de una entrada, vereda o porche, y amontónala a un lado.',
      instructions: [
        'Mira hacia abajo, al área que estás limpiando.',
        'Camina despacio con pequeños giros de cabeza.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बर्फ़ हटाना',
      description: 'बर्फ़ के फावड़े से ड्राइववे, रास्ते या बरामदे से बर्फ़ उठाकर एक तरफ़ ढेर बनाएँ।',
      instructions: [
        'जिस जगह को साफ़ कर रहे हैं, उसकी ओर नीचे देखें।',
        'धीरे-धीरे चलें और हल्के से सिर घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বরফ সরানো',
      description: 'বরফের কোদাল দিয়ে গাড়ির জায়গা, রাস্তা বা বারান্দা থেকে বরফ তুলে পাশে গাদা করুন।',
      instructions: [
        'যে জায়গা পরিষ্কার করছেন সেদিকে তাকান।',
        'ছোট ছোট মাথা ঘুরিয়ে আস্তে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பனியை அள்ளுவது',
      description: 'ஸ்னோ ஷாவலை பயன்படுத்தி, வீட்டு முற்றம், நடைபாதை அல்லது வராண்டாவில் இருந்து பனியை எடுத்து, ஒரு பக்கம் குவித்து வையுங்கள்.',
      instructions: [
        'சுத்தம் செய்யும் இடத்தை கீழே பாருங்கள்.',
        'மெதுவாக நடந்து, தலையை சிறிது சிறிதாக திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మంచు పారతో తీయడం',
      description: 'డ్రైవ్‌వే, నడిచే దారి, లేదా వరండా నుండి మంచును పారతో పక్కకు పేర్చండి.',
      instructions: [
        'మీరు శుభ్రం చేస్తున్న ప్రాంతం వైపు కిందికి చూడండి.',
        'చిన్నగా తల తిప్పుతూ నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'बर्फ काढणे',
      description: 'बर्फाच्या फावड्याने गाडीच्या जागेवरून, वाटेवरून किंवा व्हरांड्यावरून बर्फ उचलून बाजूला ढिगाऱ्यात टाका.',
      instructions: [
        'तुम्ही जो भाग साफ करत आहात त्याकडे खाली पाहा.',
        'डोके छोट्या हालचालींनी फिरवत हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  'Organizing a desk': {
    en: {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: [
        'Look down at the desk.',
        'Keep moving items — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar uma escrivaninha',
      description: 'Arrume papéis, livros, canetas e outros itens na escrivaninha de forma organizada.',
      instructions: [
        'Olhe para baixo, para a escrivaninha.',
        'Continue mexendo nos itens — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar un escritorio',
      description: 'Acomoda los papeles, libros, bolígrafos y otras cosas del escritorio de forma ordenada.',
      instructions: [
        'Mira hacia abajo, al escritorio.',
        'Sigue moviendo cosas, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'मेज़ व्यवस्थित करना',
      description: 'मेज़ पर पड़े काग़ज़, किताबें, पेन और दूसरी चीज़ें करीने से लगाएँ।',
      instructions: [
        'मेज़ की ओर नीचे देखें।',
        'चीज़ें हटाते-रखते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ডেস্ক গোছানো',
      description: 'ডেস্কে কাগজ, বই, কলম আর অন্য জিনিস গুছিয়ে সাজান।',
      instructions: [
        'ডেস্কের দিকে তাকান।',
        'জিনিস নাড়াচাড়া চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மேசையை ஒழுங்காக்குவது',
      description: 'மேசையில் உள்ள காகிதங்கள், புத்தகங்கள், பேனாக்கள் மற்றும் பிற பொருட்களை ஒழுங்காக அடுக்கி வையுங்கள்.',
      instructions: [
        'மேசையை கீழே பாருங்கள்.',
        'பொருட்களை அசைத்துக்கொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డెస్క్ సర్దడం',
      description: 'డెస్క్ మీద కాగితాలు, పుస్తకాలు, పెన్నులు, ఇతర వస్తువులను నీట్‌గా అమర్చండి.',
      instructions: [
        'డెస్క్ వైపు కిందికి చూడండి.',
        'వస్తువులు కదుపుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'टेबल लावणे',
      description: 'टेबलवरील कागद, पुस्तकं, पेन आणि इतर वस्तू नीट लावा.',
      instructions: [
        'टेबलकडे खाली पाहा.',
        'वस्तू हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Organizing a closet or drawer': {
    en: {
      name: 'Organizing a closet or drawer',
      description: 'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: [
        'Look at the closet or drawer.',
        'Keep moving items — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar um armário ou gaveta',
      description: 'Tire as roupas ou itens do armário ou gaveta, separe e coloque de volta de forma organizada.',
      instructions: [
        'Olhe para o armário ou a gaveta.',
        'Continue mexendo nos itens — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar un armario o cajón',
      description: 'Saca la ropa o las cosas del armario o cajón, ordénalas y vuelve a guardarlas de forma prolija.',
      instructions: [
        'Mira el armario o el cajón.',
        'Sigue moviendo cosas, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'अलमारी या दराज़ व्यवस्थित करना',
      description: 'अलमारी या दराज़ से कपड़े या चीज़ें निकालें, छाँटें, और करीने से वापस रखें।',
      instructions: [
        'अलमारी या दराज़ की ओर देखें।',
        'चीज़ें हटाते-रखते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'আলমারি বা ড্রয়ার গোছানো',
      description: 'আলমারি বা ড্রয়ার থেকে কাপড় বা জিনিস বের করে বাছাই করুন, আর গুছিয়ে রেখে দিন।',
      instructions: [
        'আলমারি বা ড্রয়ারের দিকে তাকান।',
        'জিনিস নাড়াচাড়া চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'அலமாரி அல்லது இழுப்பறையை ஒழுங்காக்குவது',
      description: 'அலமாரி அல்லது இழுப்பறையில் இருந்து துணிகள் அல்லது பொருட்களை எடுத்து, வரிசைப்படுத்தி, ஒழுங்காக மீண்டும் வையுங்கள்.',
      instructions: [
        'அலமாரி அல்லது இழுப்பறையை பாருங்கள்.',
        'பொருட்களை அசைத்துக்கொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బీరువా లేదా అర సర్దడం',
      description: 'బీరువా లేదా అర నుండి బట్టలు లేదా వస్తువులు తీసి, వర్గీకరించి, తిరిగి నీట్‌గా పెట్టండి.',
      instructions: [
        'బీరువా లేదా అర వైపు చూడండి.',
        'వస్తువులు కదుపుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपाट किंवा ड्रॉवर लावणे',
      description: 'कपाट किंवा ड्रॉवरमधून कपडे किंवा वस्तू बाहेर काढा, वेगवेगळ्या करा आणि नीट लावून परत ठेवा.',
      instructions: [
        'कपाट किंवा ड्रॉवरकडे पाहा.',
        'वस्तू हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Organizing a room': {
    en: {
      name: 'Organizing a room',
      description: 'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        'Keep moving — don\'t stand idle.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizar um cômodo',
      description: 'Pegue as coisas que estão pelo cômodo, coloque cada uma no lugar certo e deixe o ambiente arrumado.',
      instructions: [
        'Olhe para o que está pegando ou guardando.',
        'Continue se mexendo — não fique parado.',
      ],
      examples: [],
    },
    es: {
      name: 'Organizar una habitación',
      description: 'Recoge las cosas de una habitación, ponlas en su lugar y deja la habitación ordenada.',
      instructions: [
        'Mira lo que estás recogiendo o colocando.',
        'Sigue moviéndote, no te quedes quieto.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कमरा व्यवस्थित करना',
      description: 'कमरे में बिखरी चीज़ें उठाएँ, उनकी सही जगह पर रखें, और कमरे को साफ़-सुथरा बनाएँ।',
      instructions: [
        'जो चीज़ उठा रहे हैं या रख रहे हैं, उसकी ओर देखें।',
        'चलते रहें — खाली खड़े न रहें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ঘর গোছানো',
      description: 'ঘরের জিনিস তুলে নিজ নিজ জায়গায় রাখুন, আর ঘর পরিপাটি করুন।',
      instructions: [
        'যা তুলছেন বা রাখছেন সেদিকে তাকান।',
        'কাজ চালিয়ে যান — চুপচাপ দাঁড়িয়ে থাকবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'அறையை ஒழுங்காக்குவது',
      description: 'அறையில் உள்ள பொருட்களை எடுத்து, அவற்றை சரியான இடத்தில் வைத்து, அறையை ஒழுங்காக்குங்கள்.',
      instructions: [
        'நீங்கள் எடுக்கும் அல்லது வைக்கும் பொருளை பாருங்கள்.',
        'வேலை செய்துகொண்டே இருங்கள் — சும்மா நிற்க வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గది సర్దడం',
      description: 'గదిలోని వస్తువులు ఎత్తి, వాటి సరైన చోట పెట్టి, గదిని నీట్‌గా చేయండి.',
      instructions: [
        'మీరు ఎత్తుతున్న లేదా పెడుతున్న దాని వైపు చూడండి.',
        'కదులుతూ ఉండండి — ఖాళీగా నిలబడకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'खोली आवरणे',
      description: 'खोलीतील वस्तू उचला, त्यांच्या योग्य जागी ठेवा आणि खोली नीट करा.',
      instructions: [
        'तुम्ही जे उचलत आहात किंवा ठेवत आहात त्याकडे पाहा.',
        'हलवत राहा — नुसते उभे राहू नका.',
      ],
      examples: [],
    },
  },
  'Changing sheets or covers': {
    en: {
      name: 'Changing sheets or covers',
      description: 'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: [
        'Look down at the bed while you work.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Trocar lençóis ou capas',
      description: 'Tire os lençóis, fronhas ou cobertas velhas da cama e coloque os novos.',
      instructions: [
        'Olhe para baixo, para a cama, enquanto trabalha.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Cambiar sábanas o fundas',
      description: 'Quita las sábanas, fundas de almohada o cobijas viejas de la cama y pon unas limpias.',
      instructions: [
        'Mira hacia abajo, a la cama, mientras trabajas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'चादर या कवर बदलना',
      description: 'बिस्तर से पुरानी चादर, तकिये के कवर या कंबल हटाएँ और नए लगाएँ।',
      instructions: [
        'काम करते समय बिस्तर की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'চাদর বা ঢাকনা বদলানো',
      description: 'বিছানা থেকে পুরোনো চাদর, বালিশের ঢাকনা বা কম্বল খুলে নতুনগুলো পরান।',
      instructions: [
        'কাজের সময় বিছানার দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'படுக்கை விரிப்பு அல்லது உறைகளை மாற்றுவது',
      description: 'படுக்கையில் இருந்து பழைய விரிப்பு, தலையணை உறை, அல்லது போர்வைகளை எடுத்துவிட்டு, புதியதை போடவும்.',
      instructions: [
        'வேலை செய்யும்போது படுக்கையை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'దుప్పట్లు లేదా కవర్లు మార్చడం',
      description: 'మంచం మీద పాత దుప్పట్లు, దిండు కవర్లు లేదా రగ్గులు తీసి కొత్తవి వేయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మంచం వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'चादर किंवा कव्हर बदलणे',
      description: 'पलंगावरील जुनी चादर, उशाचे कव्हर किंवा पांघरूण काढा आणि नवीन घाला.',
      instructions: [
        'काम करताना पलंगाकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Making a bed': {
    en: {
      name: 'Making a bed',
      description: 'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: [
        'Look down at the bed while you work.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Arrumar a cama',
      description: 'Estique o lençol de baixo, espalhe o lençol de cima e o edredom ou cobertor por igual e arrume os travesseiros na cabeceira.',
      instructions: [
        'Olhe para baixo, para a cama, enquanto trabalha.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Tender la cama',
      description: 'Alisa la sábana ajustable, extiende la sábana de arriba y el edredón o cobija de forma pareja, y acomoda las almohadas en la cabecera.',
      instructions: [
        'Mira hacia abajo, a la cama, mientras trabajas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बिस्तर लगाना',
      description: 'नीचे की चादर सीधी करें, ऊपर की चादर और रज़ाई या कंबल बराबर बिछाएँ, और तकियों को सिरहाने पर सजाएँ।',
      instructions: [
        'काम करते समय बिस्तर की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বিছানা পাতা',
      description: 'ফিটেড চাদরটা মসৃণ করে পাতুন, ওপরের চাদর আর কম্বল সমানভাবে বিছান, আর বিছানার মাথার দিকে বালিশ সাজান।',
      instructions: [
        'কাজের সময় বিছানার দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'படுக்கை சீர்படுத்துவது',
      description: 'ஃபிட்டெட் ஷீட்டை சரிசெய்து, மேல் விரிப்பு மற்றும் போர்வையை சமமாக விரித்து, தலையணைகளை படுக்கையின் தலைப்பகுதியில் வையுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது படுக்கையை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మంచం సర్దడం',
      description: 'ఫిట్టెడ్ షీట్‌ను సర్దుబాటు చేయండి, టాప్ షీట్, రగ్గు లేదా దుప్పటిని సమంగా పరిచండి, మంచం తలవైపు దిండ్లు అమర్చండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మంచం వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पलंग आवरणे',
      description: 'खालची चादर सपाट करा, वरची चादर आणि पांघरूण किंवा रजई सारखी पसरवा आणि उशा पलंगाच्या डोक्याच्या बाजूला नीट लावा.',
      instructions: [
        'काम करताना पलंगाकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Loading or unloading washing machine': {
    en: {
      name: 'Loading or unloading washing machine',
      description: 'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: [
        'Look at the machine while you work.',
        'Move smoothly between clothes.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Colocar ou tirar roupa da máquina de lavar',
      description: 'Coloque roupas sujas na máquina de lavar, ou tire as roupas limpas depois de lavar.',
      instructions: [
        'Olhe para a máquina enquanto trabalha.',
        'Mova-se com calma entre as roupas.',
      ],
      examples: [],
    },
    es: {
      name: 'Cargar o vaciar la lavadora',
      description: 'Mete la ropa sucia en la lavadora o saca la ropa limpia después del lavado.',
      instructions: [
        'Mira la lavadora mientras trabajas.',
        'Muévete con suavidad entre las prendas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'वॉशिंग मशीन में कपड़े डालना या निकालना',
      description: 'गंदे कपड़े वॉशिंग मशीन में डालें, या धुलने के बाद साफ़ कपड़े निकालें।',
      instructions: [
        'काम करते समय मशीन की ओर देखें।',
        'एक कपड़े से दूसरे कपड़े तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ওয়াশিং মেশিনে কাপড় ভরা বা বের করা',
      description: 'ওয়াশিং মেশিনে ময়লা কাপড় ভরুন, অথবা ধোয়ার পর পরিষ্কার কাপড় বের করুন।',
      instructions: [
        'কাজের সময় মেশিনের দিকে তাকান।',
        'একটার পর একটা কাপড় মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சலவை இயந்திரத்தில் துணிகள் போடுவது அல்லது எடுப்பது',
      description: 'அழுக்கான துணிகளை சலவை இயந்திரத்தில் போடுங்கள், அல்லது சலவைக்குப் பிறகு சுத்தமான துணிகளை எடுக்கவும்.',
      instructions: [
        'வேலை செய்யும்போது இயந்திரத்தை பாருங்கள்.',
        'ஒரு துணியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'వాషింగ్ మెషీన్‌లో బట్టలు వేయడం లేదా తీయడం',
      description: 'మురికి బట్టలను వాషింగ్ మెషీన్‌లో వేయండి, లేదా ఉతికాక శుభ్రమైన బట్టలను తీయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మెషీన్ వైపు చూడండి.',
        'బట్టల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'वॉशिंग मशीनमध्ये कपडे टाकणे किंवा काढणे',
      description: 'घाणेरडे कपडे वॉशिंग मशीनमध्ये टाका किंवा धुतल्यानंतर स्वच्छ कपडे बाहेर काढा.',
      instructions: [
        'काम करताना मशीनकडे पाहा.',
        'एका कपड्याकडून दुसऱ्या कपड्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Hanging clothes to dry': {
    en: {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: [
        'Look at the line or rack while hanging.',
        'Move smoothly between clothes.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Pendurar roupas para secar',
      description: 'Pendure as roupas molhadas em um varal, secador ou cabide para secarem ao ar.',
      instructions: [
        'Olhe para o varal ou o secador enquanto pendura.',
        'Mova-se com calma entre as roupas.',
      ],
      examples: [],
    },
    es: {
      name: 'Colgar ropa para secar',
      description: 'Cuelga la ropa mojada en un tendedero, una rejilla o una barra para que se seque al aire.',
      instructions: [
        'Mira el tendedero o la rejilla mientras cuelgas.',
        'Muévete con suavidad entre las prendas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कपड़े सूखने के लिए लटकाना',
      description: 'गीले कपड़े तार, स्टैंड या रॉड पर लटकाएँ ताकि हवा में सूख जाएँ।',
      instructions: [
        'लटकाते समय तार या स्टैंड की ओर देखें।',
        'एक कपड़े से दूसरे कपड़े तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড় শুকোতে দেওয়া',
      description: 'ভেজা কাপড় তার, র‍্যাক বা দড়িতে মেলে দিন যাতে হাওয়ায় শুকিয়ে যায়।',
      instructions: [
        'মেলার সময় তার বা র‍্যাকের দিকে তাকান।',
        'একটার পর একটা কাপড় মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துணிகளை காய போடுவது',
      description: 'ஈரமான துணிகளை கம்பி, ரேக் அல்லது ஸ்டாண்டில் காற்றில் காய போடுங்கள்.',
      instructions: [
        'போடும்போது கம்பி அல்லது ரேக்கை பாருங்கள்.',
        'ஒரு துணியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బట్టలు ఆరేయడం',
      description: 'తడి బట్టలను తీగ, ర్యాక్ లేదా రాడ్ మీద ఆరడానికి వేయండి.',
      instructions: [
        'ఆరేస్తున్నప్పుడు తీగ లేదా ర్యాక్ వైపు చూడండి.',
        'బట్టల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपडे वाळत घालणे',
      description: 'ओले कपडे दोरीवर, रॅकवर किंवा काठीवर वाळण्यासाठी टांगा.',
      instructions: [
        'टांगताना दोरी किंवा रॅककडे पाहा.',
        'एका कपड्याकडून दुसऱ्या कपड्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Removing clothes from drying line': {
    en: {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: [
        'Look at the line while removing clothes.',
        'Move smoothly between clothes.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Tirar roupas do varal',
      description: 'Tire as roupas secas do varal ou do secador e coloque em um cesto.',
      instructions: [
        'Olhe para o varal enquanto tira as roupas.',
        'Mova-se com calma entre as roupas.',
      ],
      examples: [],
    },
    es: {
      name: 'Bajar la ropa del tendedero',
      description: 'Quita la ropa seca del tendedero o la rejilla y ponla en una canasta.',
      instructions: [
        'Mira el tendedero mientras quitas la ropa.',
        'Muévete con suavidad entre las prendas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'तार से कपड़े उतारना',
      description: 'तार या स्टैंड से सूखे कपड़े उतारें और टोकरी में रखें।',
      instructions: [
        'उतारते समय तार की ओर देखें।',
        'एक कपड़े से दूसरे कपड़े तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'শুকোতে দেওয়া কাপড় তুলে নেওয়া',
      description: 'তার বা র‍্যাক থেকে শুকনো কাপড় তুলে ঝুড়িতে রাখুন।',
      instructions: [
        'কাপড় তোলার সময় তারের দিকে তাকান।',
        'একটার পর একটা কাপড় মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'காய போட்ட துணிகளை எடுப்பது',
      description: 'காய்ந்த துணிகளை கம்பி அல்லது ரேக்கில் இருந்து எடுத்து, ஒரு கூடையில் வையுங்கள்.',
      instructions: [
        'துணிகளை எடுக்கும்போது கம்பியை பாருங்கள்.',
        'ஒரு துணியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆరిన బట్టలను తీగ నుండి తీయడం',
      description: 'ఆరిన బట్టలను తీగ లేదా ర్యాక్ నుండి తీసి బుట్టలో పెట్టండి.',
      instructions: [
        'బట్టలు తీస్తున్నప్పుడు తీగ వైపు చూడండి.',
        'బట్టల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'वाळलेले कपडे दोरीवरून काढणे',
      description: 'वाळलेले कपडे दोरीवरून किंवा रॅकवरून काढून टोपलीत ठेवा.',
      instructions: [
        'कपडे काढताना दोरीकडे पाहा.',
        'एका कपड्याकडून दुसऱ्या कपड्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Sorting clothes or fabrics': {
    en: {
      name: 'Sorting clothes or fabrics',
      description: 'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: [
        'Look down at the clothes while sorting.',
        'Keep sorting — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Separar roupas ou tecidos',
      description: 'Separe roupas e tecidos em grupos, por exemplo por cor, tipo ou dono.',
      instructions: [
        'Olhe para baixo, para as roupas, enquanto separa.',
        'Continue separando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Separar ropa o telas',
      description: 'Separa la ropa y las telas en grupos, por ejemplo por color, tipo o a quién pertenecen.',
      instructions: [
        'Mira hacia abajo, a la ropa, mientras separas.',
        'Sigue separando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कपड़े छाँटना',
      description: 'कपड़ों को रंग, तरह या किसके हैं — इस आधार पर अलग-अलग ढेर में बाँटें।',
      instructions: [
        'छाँटते समय कपड़ों की ओर नीचे देखें।',
        'छाँटते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড় বাছাই করা',
      description: 'রঙ, ধরন, বা কার সেটা — এমনভাবে কাপড়গুলোকে আলাদা আলাদা ভাগে রাখুন।',
      instructions: [
        'বাছাইয়ের সময় কাপড়ের দিকে তাকান।',
        'বাছাই চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துணிகளை பிரித்து வைப்பது',
      description: 'துணிகளை நிறம், வகை, அல்லது யாருடையது என்பதின்படி குழுவாக பிரித்து வையுங்கள்.',
      instructions: [
        'பிரிக்கும்போது துணிகளை கீழே பாருங்கள்.',
        'பிரித்துக்கொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బట్టలు లేదా వస్త్రాలు వేరు చేయడం',
      description: 'రంగు, రకం, లేదా ఎవరివి అన్న దాన్ని బట్టి బట్టలను, వస్త్రాలను గ్రూపులుగా వేరు చేయండి.',
      instructions: [
        'వేరు చేస్తున్నప్పుడు బట్టల వైపు కిందికి చూడండి.',
        'వేరు చేస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपडे किंवा कापड वेगवेगळे करणे',
      description: 'कपडे आणि कापड रंग, प्रकार किंवा कोणाचे आहेत यानुसार गटांमध्ये वेगळे करा.',
      instructions: [
        'वेगळे करताना कपड्यांकडे खाली पाहा.',
        'वेगळे करणे चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Folding clothes': {
    en: {
      name: 'Folding clothes',
      description: 'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Keep folding — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Dobrar roupas',
      description: 'Pegue as roupas limpas e secas e dobre cada uma com capricho. Faça dobras pequenas e iguais para ficar fácil de empilhar ou guardar.',
      instructions: [
        'Sente ou fique em pé em um lugar firme.',
        'Olhe para baixo, para as suas mãos.',
        'Continue dobrando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Doblar ropa',
      description: 'Toma la ropa limpia y seca y dobla cada prenda con cuidado. Haz dobleces pequeños y parejos para que sea fácil apilar o guardar.',
      instructions: [
        'Siéntate o párate en un lugar estable.',
        'Mira hacia abajo, a tus manos.',
        'Sigue doblando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कपड़े तह करना',
      description: 'साफ़, सूखे कपड़े लें और हर एक को करीने से तह करें। छोटी, बराबर तह करें ताकि कपड़े आसानी से रखे या जमाए जा सकें।',
      instructions: [
        'सीधी जगह पर बैठें या खड़े हों।',
        'अपने हाथों की ओर नीचे देखें।',
        'तह करते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড় ভাঁজ করা',
      description: 'পরিষ্কার, শুকনো কাপড় নিয়ে একটা একটা করে গুছিয়ে ভাঁজ করুন। ছোট, সমান ভাঁজ দিন যাতে কাপড় সাজিয়ে রাখা যায়।',
      instructions: [
        'একটা স্থির জায়গায় বসুন বা দাঁড়ান।',
        'নিজের হাতের দিকে তাকান।',
        'ভাঁজ করতে থাকুন — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துணிகளை மடிப்பது',
      description: 'சுத்தமான, காய்ந்த துணிகளை எடுத்து ஒவ்வொன்றையும் ஒழுங்காக மடியுங்கள். சிறிய, சம மடிப்புகளை செய்து, துணிகளை எளிதில் அடுக்கி வைக்கவோ சேமிக்கவோ வசதியாக்குங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவோ நிற்கவோ செய்யுங்கள்.',
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'மடித்துக்கொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బట్టలు మడతపెట్టడం',
      description: 'శుభ్రమైన, పొడి బట్టలను తీసి ప్రతిదాన్ని నీట్‌గా మడత పెట్టండి. స్టాక్ చేయడానికి లేదా దాచడానికి సులభంగా ఉండేలా చిన్న, సమానమైన మడతలు పెట్టండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి లేదా నిలబడండి.',
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'మడత పెడుతూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपड्यांच्या घड्या घालणे',
      description: 'स्वच्छ, वाळलेले कपडे घेऊन प्रत्येकाची नीट घडी घाला. लहान, सारख्या घड्या घाला म्हणजे कपडे रचून ठेवायला किंवा साठवायला सोपे होतील.',
      instructions: [
        'स्थिर जागी बसा किंवा उभे राहा.',
        'तुमच्या हातांकडे खाली पाहा.',
        'घड्या घालणे चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Folding towels or bedsheets': {
    en: {
      name: 'Folding towels or bedsheets',
      description: 'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Dobrar toalhas ou lençóis',
      description: 'Dobre tecidos grandes como toalhas e lençóis em quadrados ou retângulos bem arrumados.',
      instructions: [
        'Sente ou fique em pé em um lugar firme.',
        'Olhe para baixo, para as suas mãos.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Doblar toallas o sábanas',
      description: 'Dobla piezas grandes de tela como toallas y sábanas en cuadrados o rectángulos prolijos.',
      instructions: [
        'Siéntate o párate en un lugar estable.',
        'Mira hacia abajo, a tus manos.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'तौलिये या चादर तह करना',
      description: 'तौलिये और चादर जैसे बड़े कपड़ों को करीने से चौकोर या आयताकार तह करें।',
      instructions: [
        'सीधी जगह पर बैठें या खड़े हों।',
        'अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'তোয়ালে বা চাদর ভাঁজ করা',
      description: 'তোয়ালে আর চাদরের মতো বড় কাপড় ছোট চৌকো বা আয়তাকার করে ভাঁজ করুন।',
      instructions: [
        'একটা স্থির জায়গায় বসুন বা দাঁড়ান।',
        'নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டவல் அல்லது படுக்கை விரிப்புகளை மடிப்பது',
      description: 'டவல், படுக்கை விரிப்பு போன்ற பெரிய துணிகளை ஒழுங்கான சதுர அல்லது நீள்சதுர வடிவில் மடியுங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவோ நிற்கவோ செய்யுங்கள்.',
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'టవల్‌లు లేదా దుప్పట్లు మడతపెట్టడం',
      description: 'టవల్‌లు, దుప్పట్లు లాంటి పెద్ద గుడ్డలను నీట్‌గా చతురస్రాలు లేదా దీర్ఘచతురస్రాలుగా మడత పెట్టండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి లేదా నిలబడండి.',
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'टॉवेल किंवा चादरींच्या घड्या घालणे',
      description: 'टॉवेल आणि चादरींसारख्या मोठ्या कापडांच्या नीट चौरस किंवा आयताकृती घड्या घाला.',
      instructions: [
        'स्थिर जागी बसा किंवा उभे राहा.',
        'तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Ironing clothes': {
    en: {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: [
        'Look down at the cloth while ironing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Passar roupa',
      description: 'Use um ferro para passar a roupa e tirar os amassados.',
      instructions: [
        'Olhe para baixo, para o tecido, enquanto passa.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Planchar ropa',
      description: 'Usa una plancha para dejar la ropa lisa y sin arrugas.',
      instructions: [
        'Mira hacia abajo, a la tela, mientras planchas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कपड़ों पर इस्त्री करना',
      description: 'इस्त्री से कपड़े को चपटा करें और सिलवटें हटाएँ।',
      instructions: [
        'इस्त्री करते समय कपड़े की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড়ে ইস্ত্রি করা',
      description: 'ইস্ত্রি দিয়ে কাপড় চ্যাপ্টা করে কুঁচকানো ভাব সরিয়ে ফেলুন।',
      instructions: [
        'ইস্ত্রির সময় কাপড়ের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துணி அயர்ன் போடுவது',
      description: 'அயர்ன் பெட்டியை வைத்து துணிகளை தட்டையாக்கி, சுருக்கங்களை நீக்கவும்.',
      instructions: [
        'அயர்ன் போடும்போது துணியை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బట్టలు ఇస్త్రీ చేయడం',
      description: 'ఇస్త్రీపెట్టెతో బట్టలను చదునుగా చేసి ముడతలు తీయండి.',
      instructions: [
        'ఇస్త్రీ చేస్తున్నప్పుడు బట్ట వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपड्यांना इस्त्री करणे',
      description: 'इस्त्रीने कपडे सपाट करा आणि सुरकुत्या काढा.',
      instructions: [
        'इस्त्री करताना कपड्याकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Post-washing laundry (sort → fold → store)': {
    en: {
      name: 'Post-washing laundry (sort → fold → store)',
      description: 'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: [
        'Look down at the clothes while you work.',
        'Keep working — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Depois de lavar a roupa (separar → dobrar → guardar)',
      description: 'Pegue as roupas secas, separe, dobre cada uma e guarde no lugar certo, como no armário ou na gaveta.',
      instructions: [
        'Olhe para baixo, para as roupas, enquanto trabalha.',
        'Continue trabalhando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Después de lavar la ropa (separar → doblar → guardar)',
      description: 'Toma la ropa seca, sepárala, dobla cada prenda y guárdala donde corresponda, como en el armario o el cajón.',
      instructions: [
        'Mira hacia abajo, a la ropa, mientras trabajas.',
        'Sigue trabajando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'धुलाई के बाद का काम (छाँटना → तह करना → रखना)',
      description: 'सूखे कपड़े लें, छाँटें, हर एक को तह करें, और उनकी जगह पर रखें — जैसे अलमारी या दराज़ में।',
      instructions: [
        'काम करते समय कपड़ों की ओर नीचे देखें।',
        'काम करते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড় কাচার পরের কাজ (বাছাই → ভাঁজ → রাখা)',
      description: 'শুকনো কাপড় নিয়ে বাছাই করুন, একটা একটা ভাঁজ করুন, আর আলমারি বা ড্রয়ারে নিজ নিজ জায়গায় রাখুন।',
      instructions: [
        'কাজের সময় কাপড়ের দিকে তাকান।',
        'কাজ চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சலவைக்குப் பிறகான வேலை (பிரித்தல் → மடித்தல் → வைத்தல்)',
      description: 'காய்ந்த துணிகளை எடுத்து, பிரித்து, ஒவ்வொன்றையும் மடித்து, அவை சேர வேண்டிய இடத்தில் — அலமாரி அல்லது இழுப்பறையில் — வையுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது துணிகளை கீழே பாருங்கள்.',
        'வேலை செய்துகொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఉతికాక బట్టలు (వేరు చేయడం → మడత → దాచడం)',
      description: 'ఆరిన బట్టలను తీసుకొని, వేరు చేసి, ప్రతిదాన్ని మడత పెట్టి, బీరువా లేదా అరలో దాని చోట పెట్టండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు బట్టల వైపు కిందికి చూడండి.',
        'పని చేస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'धुण्यानंतरचे कपडे (वेगळे → घडी → ठेवणे)',
      description: 'वाळलेले कपडे घ्या, वेगवेगळे करा, प्रत्येकाची घडी घाला आणि कपाटात किंवा ड्रॉवरमध्ये त्यांच्या जागी ठेवा.',
      instructions: [
        'काम करताना कपड्यांकडे खाली पाहा.',
        'काम चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Loading or unloading clothes dryer': {
    en: {
      name: 'Loading or unloading clothes dryer',
      description: 'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: [
        'Look at the dryer while you work.',
        'Move smoothly between clothes.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Colocar ou tirar roupa da secadora',
      description: 'Passe as roupas molhadas da máquina de lavar para a secadora, ou tire as roupas secas da secadora para um cesto.',
      instructions: [
        'Olhe para a secadora enquanto trabalha.',
        'Mova-se com calma entre as roupas.',
      ],
      examples: [],
    },
    es: {
      name: 'Cargar o vaciar la secadora',
      description: 'Pasa la ropa mojada de la lavadora a la secadora, o saca la ropa seca de la secadora a una canasta.',
      instructions: [
        'Mira la secadora mientras trabajas.',
        'Muévete con suavidad entre las prendas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'ड्रायर में कपड़े डालना या निकालना',
      description: 'गीले कपड़े वॉशर से ड्रायर में डालें, या सूखे कपड़े ड्रायर से निकालकर टोकरी में रखें।',
      instructions: [
        'काम करते समय ड्रायर की ओर देखें।',
        'एक कपड़े से दूसरे कपड़े तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ড্রায়ারে কাপড় ভরা বা বের করা',
      description: 'ওয়াশার থেকে ভেজা কাপড় ড্রায়ারে নিন, অথবা ড্রায়ার থেকে শুকনো কাপড় ঝুড়িতে বের করুন।',
      instructions: [
        'কাজের সময় ড্রায়ারের দিকে তাকান।',
        'একটার পর একটা কাপড় মসৃণভাবে নিন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டிரையரில் துணி போடுவது அல்லது எடுப்பது',
      description: 'ஈரமான துணிகளை வாஷரில் இருந்து டிரையருக்கு மாற்றுங்கள், அல்லது காய்ந்த துணிகளை டிரையரிலிருந்து கூடைக்கு எடுத்துக் கொள்ளுங்கள்.',
      instructions: [
        'வேலை செய்யும்போது டிரையரை பாருங்கள்.',
        'ஒரு துணியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డ్రయర్‌లో బట్టలు వేయడం లేదా తీయడం',
      description: 'తడి బట్టలను వాషర్ నుండి డ్రయర్‌లోకి వేయండి, లేదా ఆరిన బట్టలను డ్రయర్ నుండి బుట్టలోకి తీయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు డ్రయర్ వైపు చూడండి.',
        'బట్టల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'ड्रायरमध्ये कपडे टाकणे किंवा काढणे',
      description: 'वॉशरमधील ओले कपडे ड्रायरमध्ये टाका, किंवा ड्रायरमधील वाळलेले कपडे टोपलीत काढा.',
      instructions: [
        'काम करताना ड्रायरकडे पाहा.',
        'एका कपड्याकडून दुसऱ्या कपड्याकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Cleaning the dryer lint trap': {
    en: {
      name: 'Cleaning the dryer lint trap',
      description: 'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: [
        'Look down at the lint screen.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar o filtro de fiapos da secadora',
      description: 'Puxe a tela do filtro de fiapos da secadora, tire a camada de fiapos com os dedos e encaixe a tela de volta.',
      instructions: [
        'Olhe para baixo, para a tela do filtro.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpiar el filtro de pelusa de la secadora',
      description: 'Saca el filtro de pelusa de la secadora, quita la capa de pelusa con los dedos y vuelve a colocar el filtro.',
      instructions: [
        'Mira hacia abajo, al filtro de pelusa.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'ड्रायर का लिंट फ़िल्टर साफ़ करना',
      description: 'ड्रायर से लिंट की जाली निकालें, उंगलियों से जमी रुई की परत हटाएँ, और जाली वापस लगाएँ।',
      instructions: [
        'लिंट की जाली की ओर नीचे देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ড্রায়ারের লিন্ট ট্র্যাপ পরিষ্কার করা',
      description: 'ড্রায়ার থেকে লিন্টের জালিটা বের করুন, আঙুল দিয়ে জমে থাকা লিন্ট তুলে ফেলুন, আর জালি আবার ঢুকিয়ে দিন।',
      instructions: [
        'লিন্টের জালির দিকে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'டிரையர் லின்ட் டிராப் சுத்தம் செய்வது',
      description: 'டிரையரில் இருந்து லின்ட் திரையை வெளியே இழுத்து, கைகளால் லின்ட் அடுக்கை எடுத்து, திரையை மீண்டும் உள்ளே நுழைக்கவும்.',
      instructions: [
        'லின்ட் திரையை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'డ్రయర్ లింట్ ట్రాప్ శుభ్రం చేయడం',
      description: 'డ్రయర్ నుండి లింట్ స్క్రీన్ తీయండి, వేళ్లతో పేరుకుపోయిన లింట్ తీసి, స్క్రీన్‌ను తిరిగి లోపలికి జారనివ్వండి.',
      instructions: [
        'లింట్ స్క్రీన్ వైపు కిందికి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'ड्रायरचा लिंट ट्रॅप साफ करणे',
      description: 'ड्रायरमधून लिंट स्क्रीन बाहेर काढा, बोटांनी त्यावरचा लिंटचा थर काढा आणि स्क्रीन पुन्हा आत सरकवा.',
      instructions: [
        'लिंट स्क्रीनकडे खाली पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Folding a fitted sheet': {
    en: {
      name: 'Folding a fitted sheet',
      description: 'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Dobrar um lençol com elástico',
      description: 'Encaixe os cantos do lençol com elástico um dentro do outro e dobre em um retângulo bem chato.',
      instructions: [
        'Sente ou fique em pé em um lugar firme.',
        'Olhe para baixo, para as suas mãos.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Doblar una sábana ajustable',
      description: 'Mete las esquinas de la sábana ajustable una dentro de la otra y dóblala en un rectángulo plano.',
      instructions: [
        'Siéntate o párate en un lugar estable.',
        'Mira hacia abajo, a tus manos.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'फ़िटेड चादर तह करना',
      description: 'फ़िटेड चादर के कोनों को एक-दूसरे में अंदर डालें और चपटे आयत में तह करें।',
      instructions: [
        'सीधी जगह पर बैठें या खड़े हों।',
        'अपने हाथों की ओर नीचे देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ফিটেড চাদর ভাঁজ করা',
      description: 'ফিটেড চাদরের কোণাগুলো একে অন্যের ভেতর গুঁজে দিয়ে চ্যাপ্টা আয়তাকার করে ভাঁজ করুন।',
      instructions: [
        'একটা স্থির জায়গায় বসুন বা দাঁড়ান।',
        'নিজের হাতের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஃபிட்டெட் ஷீட்டை மடிப்பது',
      description: 'ஃபிட்டெட் ஷீட்டின் ஓரங்களை ஒன்றில் ஒன்று உள்ளே வைத்து, தட்டையான நீள்சதுரமாக மடியுங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவோ நிற்கவோ செய்யுங்கள்.',
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఫిట్టెడ్ షీట్ మడతపెట్టడం',
      description: 'ఫిట్టెడ్ షీట్ మూలలను ఒకదానిలో ఒకటి దోపి, చదునైన దీర్ఘచతురస్రంగా మడత పెట్టండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి లేదా నిలబడండి.',
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'फिटेड चादरीची घडी घालणे',
      description: 'फिटेड चादरीचे कोपरे एकमेकांत खोचा आणि सपाट आयताकृती घडी घाला.',
      instructions: [
        'स्थिर जागी बसा किंवा उभे राहा.',
        'तुमच्या हातांकडे खाली पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Watering plants': {
    en: {
      name: 'Watering plants',
      description: 'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: [
        'Look at each plant while you water it.',
        'Walk slowly between plants.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Regar as plantas',
      description: 'Coloque água nas plantas usando um regador, mangueira ou garrafa. Dê água suficiente para cada planta para a terra ficar úmida, mas não encharcada.',
      instructions: [
        'Olhe para cada planta enquanto rega.',
        'Ande devagar entre as plantas.',
      ],
      examples: [],
    },
    es: {
      name: 'Regar las plantas',
      description: 'Echa agua a las plantas con una regadera, manguera o botella. Dale a cada planta suficiente agua para que la tierra quede húmeda pero no inundada.',
      instructions: [
        'Mira cada planta mientras la riegas.',
        'Camina despacio entre las plantas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पौधों को पानी देना',
      description: 'कैन, पाइप या बोतल से पौधों पर पानी डालें। हर पौधे को इतना पानी दें कि मिट्टी गीली हो जाए पर भर न जाए।',
      instructions: [
        'हर पौधे को पानी देते समय उसकी ओर देखें।',
        'पौधों के बीच धीरे-धीरे चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'গাছে জল দেওয়া',
      description: 'ঝাঝরি, পাইপ বা বোতল দিয়ে গাছে জল দিন। প্রত্যেকটা গাছে যথেষ্ট জল দিন যাতে মাটি ভেজা থাকে কিন্তু জলে ভেসে না যায়।',
      instructions: [
        'জল দেওয়ার সময় প্রত্যেকটা গাছের দিকে তাকান।',
        'এক গাছ থেকে অন্য গাছে আস্তে যান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'செடிகளுக்கு தண்ணீர் ஊற்றுவது',
      description: 'டப்பா, ஹோஸ் அல்லது பாட்டிலால் செடிகளுக்கு தண்ணீர் ஊற்றுங்கள். ஒவ்வொரு செடிக்கும் மண் ஈரமாக ஆனால் வெள்ளம் போல் இல்லாத அளவுக்கு தண்ணீர் கொடுங்கள்.',
      instructions: [
        'ஒவ்வொரு செடிக்கும் தண்ணீர் ஊற்றும்போது அதை பாருங்கள்.',
        'செடிகளுக்கு இடையே மெதுவாக நடக்கவும்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మొక్కలకు నీళ్లు పోయడం',
      description: 'క్యాన్, పైపు లేదా బాటిల్ ఉపయోగించి మొక్కలకు నీళ్లు పోయండి. మట్టి తడిగా అయ్యే వరకు ప్రతి మొక్కకు తగినన్ని నీళ్లు పోయండి, కానీ మరీ ఎక్కువ కాదు.',
      instructions: [
        'నీళ్లు పోస్తున్నప్పుడు ప్రతి మొక్క వైపు చూడండి.',
        'మొక్కల మధ్య నెమ్మదిగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'झाडांना पाणी घालणे',
      description: 'झारी, पाइप किंवा बाटलीने झाडांना पाणी घाला. प्रत्येक झाडाला माती ओली होईल पण साचेल नाही इतके पाणी द्या.',
      instructions: [
        'प्रत्येक झाडाला पाणी घालताना त्याकडे पाहा.',
        'झाडांमधून हळूहळू चाला.',
      ],
      examples: [],
    },
  },
  'Planting or repotting': {
    en: {
      name: 'Planting or repotting',
      description: 'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: [
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Plantar ou trocar de vaso',
      description: 'Coloque uma muda ou semente na terra de um vaso ou no chão. Aperte a terra em volta com firmeza.',
      instructions: [
        'Olhe para baixo, para as suas mãos.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Plantar o trasplantar',
      description: 'Coloca una planta o semilla en la tierra de una maceta o en el suelo. Aprieta bien la tierra a su alrededor.',
      instructions: [
        'Mira hacia abajo, a tus manos.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पौधा लगाना या गमला बदलना',
      description: 'गमले या ज़मीन की मिट्टी में पौधा या बीज लगाएँ। चारों ओर मिट्टी अच्छे से दबाएँ।',
      instructions: [
        'अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'গাছ লাগানো বা টব বদলানো',
      description: 'একটা গাছ বা বীজ টবের মাটিতে বা মাটিতে লাগান। চারপাশে শক্ত করে মাটি চেপে দিন।',
      instructions: [
        'নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'செடி நடுவது அல்லது மறு-தொட்டியில் வைப்பது',
      description: 'ஒரு செடி அல்லது விதையை தொட்டியில் அல்லது தரையில் மண்ணில் வையுங்கள். சுற்றி மண்ணை இறுக்கமாக அழுத்தி நிரப்புங்கள்.',
      instructions: [
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మొక్క నాటడం లేదా కుండీ మార్చడం',
      description: 'మొక్క లేదా విత్తనాన్ని కుండీలో లేదా నేలలో మట్టిలో పెట్టండి. చుట్టూ మట్టిని గట్టిగా నొక్కండి.',
      instructions: [
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'रोप लावणे किंवा कुंडी बदलणे',
      description: 'रोप किंवा बी कुंडीत किंवा जमिनीत मातीमध्ये लावा. भोवतीची माती घट्ट दाबा.',
      instructions: [
        'तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Pruning or trimming': {
    en: {
      name: 'Pruning or trimming',
      description: 'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: [
        'Look at the part you are cutting.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Podar ou aparar',
      description: 'Use uma tesoura ou tesourão para cortar folhas, galhos ou hastes a mais das plantas.',
      instructions: [
        'Olhe para a parte que você está cortando.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Podar o recortar',
      description: 'Usa tijeras o podadoras para cortar las hojas, tallos o ramas de más de las plantas.',
      instructions: [
        'Mira la parte que estás cortando.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पौधों की छँटाई',
      description: 'कैंची से पौधों की फालतू पत्तियाँ, डंठल या टहनियाँ काटें।',
      instructions: [
        'जिस हिस्से को काट रहे हैं, उसकी ओर देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'গাছ ছাঁটা',
      description: 'কাঁচি বা শিয়ার দিয়ে গাছের বাড়তি পাতা, ডাল বা ডালপালা ছেঁটে দিন।',
      instructions: [
        'যে অংশ কাটছেন সেদিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'செடி கத்தரித்தல்',
      description: 'கத்தரிக்கோல் அல்லது பிரூனிங் கருவியை வைத்து செடிகளில் உள்ள அதிகமான இலைகள், தண்டுகள், கிளைகளை வெட்டி எடுக்கவும்.',
      instructions: [
        'நீங்கள் வெட்டும் பகுதியை பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'మొక్కలు కత్తిరించడం',
      description: 'కత్తెర లేదా శియర్స్‌తో మొక్కల నుండి అదనపు ఆకులు, కాండాలు లేదా కొమ్మలను కత్తిరించండి.',
      instructions: [
        'మీరు కత్తిరిస్తున్న భాగం వైపు చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'छाटणी करणे',
      description: 'कात्री किंवा शिअर्सने झाडांची अतिरिक्त पानं, फांद्या किंवा देठ कापा.',
      instructions: [
        'तुम्ही जो भाग कापत आहात त्याकडे पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  Hoeing: {
    en: {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: [
        'Look down at the soil.',
        'Move smoothly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Capinar com enxada',
      description: 'Use uma enxada para revirar a terra, tirar mato ou nivelar o chão.',
      instructions: [
        'Olhe para baixo, para a terra.',
        'Mova-se com calma e firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Cavar con azada',
      description: 'Usa una azada para aflojar la tierra, quitar la maleza o darle forma al suelo.',
      instructions: [
        'Mira hacia abajo, a la tierra.',
        'Muévete con suavidad y paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कुदाल चलाना',
      description: 'कुदाल से मिट्टी तोड़ें, खरपतवार हटाएँ, या ज़मीन को आकार दें।',
      instructions: [
        'मिट्टी की ओर नीचे देखें।',
        'आराम और एक रफ़्तार से काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কোদাল দিয়ে কোপানো',
      description: 'কোদাল দিয়ে মাটি ভাঙুন, আগাছা সরান, বা জমি ঠিকঠাক করুন।',
      instructions: [
        'মাটির দিকে তাকান।',
        'মসৃণ আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மண் கொத்துவது',
      description: 'கொத்து மண்வெட்டியை வைத்து மண்ணை உடைக்கவோ, களைகளை நீக்கவோ, தரையை வடிவமைக்கவோ செய்யுங்கள்.',
      instructions: [
        'மண்ணை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గుడ్డలి తోటపని',
      description: 'గుడ్డలి ఉపయోగించి మట్టిని తెగగొట్టడం, కలుపు మొక్కలు తీయడం లేదా నేలను ఆకారం చేయడం.',
      instructions: [
        'మట్టి వైపు కిందికి చూడండి.',
        'మెల్లగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कुदळ चालवणे',
      description: 'कुदळीने माती सैल करा, तण काढा किंवा जमीन आकार द्या.',
      instructions: [
        'मातीकडे खाली पाहा.',
        'सहज आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Mowing the lawn': {
    en: {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: [
        'Look down at the grass in front of you.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Cortar a grama',
      description: 'Use um cortador de grama para deixar a grama do chão com uma altura curta e parelha.',
      instructions: [
        'Olhe para baixo, para a grama na sua frente.',
        'Ande devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Cortar el césped',
      description: 'Usa una cortadora de césped para cortar el pasto del suelo a una altura pareja y corta.',
      instructions: [
        'Mira hacia abajo, al pasto frente a ti.',
        'Camina despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'घास काटना',
      description: 'लॉन मोवर से ज़मीन की घास को एक बराबर और छोटा करें।',
      instructions: [
        'सामने की घास की ओर नीचे देखें।',
        'धीरे और एक रफ़्तार से चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'লন কাটা',
      description: 'লন মোয়ার দিয়ে মাটির ঘাস সমান আর ছোট করে কাটুন।',
      instructions: [
        'সামনের ঘাসের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'புல்வெளியை வெட்டுவது',
      description: 'லான் மோவரை பயன்படுத்தி தரையில் உள்ள புல்லை சம, குறுகிய உயரத்தில் வெட்டவும்.',
      instructions: [
        'உங்கள் முன் உள்ள புல்லை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நடக்கவும்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గడ్డి మొవ్వడం',
      description: 'నేల మీద గడ్డిని సమంగా, పొట్టిగా కత్తిరించడానికి లాన్ మోవర్ ఉపయోగించండి.',
      instructions: [
        'మీ ముందున్న గడ్డి వైపు కిందికి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'लॉन कापणे',
      description: 'लॉन मोवरने जमिनीवरील गवत सारख्या, कमी उंचीवर कापा.',
      instructions: [
        'समोरील गवताकडे खाली पाहा.',
        'हळूहळू आणि स्थिरपणे चाला.',
      ],
      examples: [],
    },
  },
  'Raking leaves': {
    en: {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: [
        'Look down at the leaves and the rake.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Juntar folhas com rastelo',
      description: 'Use um rastelo para juntar as folhas caídas no chão em uma pilha.',
      instructions: [
        'Olhe para baixo, para as folhas e o rastelo.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Rastrillar hojas',
      description: 'Usa un rastrillo para juntar las hojas caídas del suelo en un montón.',
      instructions: [
        'Mira hacia abajo, a las hojas y al rastrillo.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पत्ते बटोरना',
      description: 'रेक से ज़मीन पर गिरे पत्तों को एक ढेर में इकट्ठा करें।',
      instructions: [
        'पत्तों और रेक की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পাতা ঝাঁট দেওয়া',
      description: 'রেক দিয়ে মাটিতে পড়ে থাকা পাতা একসাথে গাদা করুন।',
      instructions: [
        'পাতা আর রেকের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'இலைகளை கூட்டுவது',
      description: 'ரேக் கருவியால் தரையில் விழுந்த இலைகளை இழுத்து ஒரு குவியலாக சேர்க்கவும்.',
      instructions: [
        'இலைகளையும் ரேக்கையும் கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆకులు చిమ్మడం',
      description: 'నేల మీద పడ్డ ఆకులను ఒక చోటికి తీయడానికి రేక్ ఉపయోగించండి.',
      instructions: [
        'ఆకులు, రేక్ వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पानं गोळा करणे',
      description: 'रेकने जमिनीवरील पडलेली पानं एका ढिगात ओढा.',
      instructions: [
        'पानं आणि रेककडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Harvesting fruits or vegetables': {
    en: {
      name: 'Harvesting fruits or vegetables',
      description: 'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Colher frutas ou legumes',
      description: 'Colha frutas ou legumes das plantas com a mão ou com uma ferramenta e coloque em um cesto ou sacola.',
      instructions: [
        'Olhe para a fruta ou o legume enquanto colhe.',
        'Mova-se com calma entre uma colheita e outra.',
      ],
      examples: [],
    },
    es: {
      name: 'Cosechar frutas o verduras',
      description: 'Recoge frutas o verduras de las plantas con la mano o con una herramienta, y ponlas en una canasta o bolsa.',
      instructions: [
        'Mira la fruta o verdura mientras la recoges.',
        'Muévete con suavidad entre cada recolección.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'फल या सब्ज़ी तोड़ना',
      description: 'हाथ से या औज़ार से पौधों से फल या सब्ज़ी तोड़ें, और टोकरी या थैले में रखें।',
      instructions: [
        'तोड़ते समय फल या सब्ज़ी की ओर देखें।',
        'एक से दूसरे तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ফল বা সবজি তোলা',
      description: 'হাতে বা যন্ত্র দিয়ে গাছ থেকে ফল বা সবজি তুলুন, আর ঝুড়ি বা ব্যাগে রাখুন।',
      instructions: [
        'তোলার সময় ফল বা সবজির দিকে তাকান।',
        'একটার পর একটা মসৃণভাবে তুলুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பழங்கள் அல்லது காய்கறிகளை அறுவடை செய்வது',
      description: 'செடிகளில் இருந்து பழங்கள் அல்லது காய்கறிகளை கையால் அல்லது கருவியால் பறித்து, ஒரு கூடை அல்லது பையில் வையுங்கள்.',
      instructions: [
        'பறிக்கும்போது அந்த பழம் அல்லது காயை பாருங்கள்.',
        'ஒரு பறிப்பிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పండ్లు లేదా కూరగాయలు కోయడం',
      description: 'చేతితో లేదా పరికరంతో మొక్కల నుండి పండ్లు లేదా కూరగాయలను కోసి బుట్ట లేదా బ్యాగులో పెట్టండి.',
      instructions: [
        'కోస్తున్నప్పుడు పండు లేదా కూరగాయ వైపు చూడండి.',
        'కోతల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'फळं किंवा भाज्या तोडणे',
      description: 'झाडांवरून हाताने किंवा हत्याराने फळं किंवा भाज्या तोडा आणि टोपलीत किंवा पिशवीत ठेवा.',
      instructions: [
        'तोडताना फळ किंवा भाजीकडे पाहा.',
        'एका तोडणीतून दुसरीकडे सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Coiling a hose': {
    en: {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: [
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Enrolar uma mangueira',
      description: 'Enrole a mangueira de jardim em círculo de forma organizada para poder guardar.',
      instructions: [
        'Olhe para baixo, para as suas mãos.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Enrollar una manguera',
      description: 'Enrolla una manguera de jardín de forma prolija en círculos para guardarla.',
      instructions: [
        'Mira hacia abajo, a tus manos.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पाइप लपेटना',
      description: 'बगीचे के पाइप को करीने से गोल लपेटें ताकि रखा जा सके।',
      instructions: [
        'अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পাইপ গুটিয়ে রাখা',
      description: 'বাগানের পাইপ গুছিয়ে গোল করে গুটিয়ে রাখুন যাতে তুলে রাখা যায়।',
      instructions: [
        'নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஹோஸை சுற்றுவது',
      description: 'தோட்ட ஹோஸை ஒரு வட்டமாக ஒழுங்காக சுற்றி, சேமிப்பதற்கு தயார் செய்யுங்கள்.',
      instructions: [
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పైపు చుట్టడం',
      description: 'తోట పైపును దాచడం కోసం నీట్‌గా వలయంగా చుట్టండి.',
      instructions: [
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पाइप गुंडाळणे',
      description: 'बागेचा पाइप वेटोळ्यात नीट गुंडाळा, म्हणजे तो साठवता येईल.',
      instructions: [
        'तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Bagging leaves': {
    en: {
      name: 'Bagging leaves',
      description: 'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: [
        'Look down at the leaves.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Ensacar folhas',
      description: 'Junte as pilhas de folhas com as mãos ou uma pá e coloque em sacos de lixo de jardim.',
      instructions: [
        'Olhe para baixo, para as folhas.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Embolsar hojas',
      description: 'Junta los montones de hojas rastrilladas con las manos o con un recogedor y mételos en bolsas para residuos de jardín.',
      instructions: [
        'Mira hacia abajo, a las hojas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पत्तों को थैले में भरना',
      description: 'बटोरे हुए पत्तों के ढेर को हाथों या स्कूप से उठाकर बगीचे के कचरे के थैलों में डालें।',
      instructions: [
        'पत्तों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পাতা ব্যাগে ভরা',
      description: 'ঝাঁট দেওয়া পাতার গাদা হাত বা ঝুড়ি দিয়ে তুলে বাগানের আবর্জনার ব্যাগে ভরুন।',
      instructions: [
        'পাতার দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'இலைகளை பையில் போடுவது',
      description: 'கூட்டிய இலை குவியல்களை கையால் அல்லது அள்ளும் கருவியால் எடுத்து, தோட்டக் கழிவு பைகளில் போடுங்கள்.',
      instructions: [
        'இலைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆకులను బ్యాగ్‌లో నింపడం',
      description: 'చిమ్మిన ఆకుల కుప్పలను చేతులతో లేదా స్కూప్‌తో ఎత్తి యార్డ్-వ్యర్థాల బ్యాగుల్లో వేయండి.',
      instructions: [
        'ఆకుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पानं पिशवीत भरणे',
      description: 'गोळा केलेल्या पानांचे ढिगारे हाताने किंवा स्कूपने उचलून यार्ड-वेस्ट पिशव्यांत भरा.',
      instructions: [
        'पानांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Pulling weeds by hand': {
    en: {
      name: 'Pulling weeds by hand',
      description: 'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: [
        'Look down at the soil.',
        'Move slowly between weeds.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Arrancar mato com a mão',
      description: 'Segure o mato pela base e puxe da terra com raiz e tudo, depois coloque em uma pilha ou saco.',
      instructions: [
        'Olhe para baixo, para a terra.',
        'Mova-se devagar entre as plantas.',
      ],
      examples: [],
    },
    es: {
      name: 'Arrancar maleza a mano',
      description: 'Agarra la maleza por la base y sácala de la tierra con todo y raíz, luego ponla en un montón o bolsa.',
      instructions: [
        'Mira hacia abajo, a la tierra.',
        'Muévete despacio entre las malezas.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'हाथ से खरपतवार उखाड़ना',
      description: 'खरपतवार को जड़ के पास से पकड़कर मिट्टी से जड़ समेत खींचें, और ढेर या थैले में डालें।',
      instructions: [
        'मिट्टी की ओर नीचे देखें।',
        'एक खरपतवार से दूसरी तक धीरे-धीरे जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'হাতে আগাছা তোলা',
      description: 'আগাছার গোড়া ধরে শিকড়সহ মাটি থেকে টেনে তুলুন, আর গাদা করে রাখুন বা ব্যাগে ফেলুন।',
      instructions: [
        'মাটির দিকে তাকান।',
        'এক আগাছা থেকে অন্যটায় আস্তে যান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'களைகளை கையால் பிடுங்குவது',
      description: 'களைகளின் அடிப்பகுதியை பிடித்து, வேருடன் சேர்த்து மண்ணில் இருந்து இழுத்து எடுங்கள், பின்னர் ஒரு குவியலில் அல்லது பையில் போடுங்கள்.',
      instructions: [
        'மண்ணை கீழே பாருங்கள்.',
        'ஒரு களையிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'చేత్తో కలుపు మొక్కలు పీకడం',
      description: 'కలుపు మొక్కలను అడుగున పట్టుకొని వేళ్లతో సహా మట్టి నుండి పీకి, కుప్ప లేదా బ్యాగులో వేయండి.',
      instructions: [
        'మట్టి వైపు కిందికి చూడండి.',
        'కలుపు మొక్కల మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'हाताने तण उपटणे',
      description: 'तणाला खालून पकडा आणि मुळासकट मातीतून बाहेर ओढा, मग ती ढिगात किंवा पिशवीत ठेवा.',
      instructions: [
        'मातीकडे खाली पाहा.',
        'एका तणाकडून दुसऱ्या तणाकडे हळूहळू जा.',
      ],
      examples: [],
    },
  },
  'Filling a feeding bowl': {
    en: {
      name: 'Filling a feeding bowl',
      description: 'Pour pet food into the pet\'s bowl and place it where the pet eats.',
      instructions: [
        'Look down at the bowl while pouring.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Encher o pote de ração',
      description: 'Coloque a ração no pote do bicho e deixe no lugar onde ele come.',
      instructions: [
        'Olhe para baixo, para o pote, enquanto serve.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Llenar el tazón de comida',
      description: 'Echa la comida en el tazón de la mascota y ponlo donde la mascota come.',
      instructions: [
        'Mira hacia abajo, al tazón, mientras echas la comida.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाने का कटोरा भरना',
      description: 'पालतू जानवर के कटोरे में खाना डालें और उसे उस जगह रखें जहाँ वह खाता है।',
      instructions: [
        'डालते समय कटोरे की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খাবারের বাটি ভরা',
      description: 'পোষ্যর বাটিতে খাবার ঢেলে যেখানে সে খায় সেখানে রেখে দিন।',
      instructions: [
        'ঢালার সময় বাটির দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'உணவு கிண்ணம் நிரப்புவது',
      description: 'வளர்ப்பு பிராணியின் கிண்ணத்தில் உணவை ஊற்றி, அது சாப்பிடும் இடத்தில் வையுங்கள்.',
      instructions: [
        'ஊற்றும்போது கிண்ணத்தை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆహారం గిన్నె నింపడం',
      description: 'పెంపుడు జంతువు ఆహారాన్ని దాని గిన్నెలో పోసి, తినే చోట పెట్టండి.',
      instructions: [
        'పోస్తున్నప్పుడు గిన్నె వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'खाण्याची वाटी भरणे',
      description: 'पाळीव प्राण्याच्या वाटीत खाणं ओता आणि ती जिथे खातो त्या जागी ठेवा.',
      instructions: [
        'ओतताना वाटीकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Emptying or cleaning feeding bowl': {
    en: {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: [
        'Look down at the bowl while you clean.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Esvaziar ou limpar o pote de ração',
      description: 'Jogue fora o que sobrou de comida e lave o pote com água e sabão.',
      instructions: [
        'Olhe para baixo, para o pote, enquanto limpa.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Vaciar o limpiar el tazón de comida',
      description: 'Tira la comida sobrante y lava el tazón con jabón y agua.',
      instructions: [
        'Mira hacia abajo, al tazón, mientras lo limpias.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'खाने का कटोरा खाली करना या साफ़ करना',
      description: 'बचा हुआ खाना फेंकें, फिर कटोरे को साबुन और पानी से धोएँ।',
      instructions: [
        'साफ़ करते समय कटोरे की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'খাবারের বাটি খালি করা বা পরিষ্কার করা',
      description: 'বেঁচে যাওয়া খাবার ফেলে দিন, তারপর সাবান-জলে বাটি ধুয়ে নিন।',
      instructions: [
        'পরিষ্কার করার সময় বাটির দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'உணவு கிண்ணத்தை காலி செய்வது அல்லது சுத்தம் செய்வது',
      description: 'மீதி உணவை எடுத்து வீசிவிட்டு, கிண்ணத்தை சோப்பு மற்றும் தண்ணீரில் கழுவவும்.',
      instructions: [
        'சுத்தம் செய்யும்போது கிண்ணத்தை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఆహారం గిన్నె ఖాళీ చేయడం లేదా శుభ్రం చేయడం',
      description: 'మిగిలిన ఆహారాన్ని పడేసి, గిన్నెను సబ్బు, నీళ్లతో కడగండి.',
      instructions: [
        'శుభ్రం చేస్తున్నప్పుడు గిన్నె వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'खाण्याची वाटी रिकामी करणे किंवा साफ करणे',
      description: 'उरलेले खाणे टाकून द्या, मग वाटी साबण आणि पाण्याने धुवा.',
      instructions: [
        'साफ करताना वाटीकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Clearing a litter box': {
    en: {
      name: 'Clearing a litter box',
      description: 'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: [
        'Look down at the box while you scoop.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Limpar a caixa de areia',
      description: 'Tire a areia usada da caixa do gato com a pá e jogue no lixo. Coloque areia nova se precisar.',
      instructions: [
        'Olhe para baixo, para a caixa, enquanto recolhe.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Limpiar la caja de arena',
      description: 'Saca con una pala la arena usada de la caja y tírala a la basura. Agrega arena nueva si hace falta.',
      instructions: [
        'Mira hacia abajo, a la caja, mientras escarbas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'लिटर बॉक्स साफ़ करना',
      description: 'लिटर बॉक्स से इस्तेमाल हुई लिटर निकालकर कचरे में डालें। ज़रूरत हो तो नई लिटर डालें।',
      instructions: [
        'स्कूप करते समय बॉक्स की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'লিটার বক্স পরিষ্কার করা',
      description: 'লিটার বক্স থেকে ব্যবহার করা লিটার তুলে আবর্জনায় ফেলুন। দরকার হলে নতুন লিটার দিন।',
      instructions: [
        'তোলার সময় বক্সের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'லிட்டர் பெட்டியை சுத்தம் செய்வது',
      description: 'லிட்டர் பெட்டியிலிருந்து உபயோகித்த லிட்டரை எடுத்து குப்பையில் போடுங்கள். தேவைப்பட்டால் புதிய லிட்டரை சேர்க்கவும்.',
      instructions: [
        'எடுக்கும்போது பெட்டியை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'లిట్టర్ బాక్స్ శుభ్రం చేయడం',
      description: 'లిట్టర్ బాక్స్ నుండి వాడిన లిట్టర్‌ను స్కూప్‌తో తీసి చెత్తలో వేయండి. అవసరమైతే తాజా లిట్టర్ వేయండి.',
      instructions: [
        'స్కూప్ చేస్తున్నప్పుడు బాక్స్ వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'लिटर बॉक्स साफ करणे',
      description: 'लिटर बॉक्समधून वापरलेले लिटर काढून कचऱ्यात टाका. लागल्यास नवीन लिटर घाला.',
      instructions: [
        'काढताना बॉक्सकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Refilling water bowl': {
    en: {
      name: 'Refilling water bowl',
      description: 'Empty old water from the pet\'s bowl and pour fresh water into it.',
      instructions: [
        'Look down at the bowl while pouring.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Trocar a água do potinho',
      description: 'Jogue fora a água velha do potinho do bicho e coloque água fresca.',
      instructions: [
        'Olhe para baixo, para o potinho, enquanto serve.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Rellenar el tazón de agua',
      description: 'Vacía el agua vieja del tazón de la mascota y echa agua fresca.',
      instructions: [
        'Mira hacia abajo, al tazón, mientras echas el agua.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पानी का कटोरा फिर से भरना',
      description: 'पालतू जानवर के कटोरे का पुराना पानी फेंकें और ताज़ा पानी डालें।',
      instructions: [
        'डालते समय कटोरे की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'জলের বাটি ভরা',
      description: 'পোষ্যর বাটির পুরোনো জল ফেলে নতুন জল ভরে দিন।',
      instructions: [
        'ঢালার সময় বাটির দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'தண்ணீர் கிண்ணம் நிரப்புவது',
      description: 'வளர்ப்பு பிராணியின் கிண்ணத்தில் உள்ள பழைய தண்ணீரை ஊற்றிவிட்டு, புதிய தண்ணீரை நிரப்புங்கள்.',
      instructions: [
        'ஊற்றும்போது கிண்ணத்தை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'నీళ్ల గిన్నె నింపడం',
      description: 'పెంపుడు జంతువు గిన్నెలోని పాత నీళ్లు పారబోసి, తాజా నీళ్లు పోయండి.',
      instructions: [
        'పోస్తున్నప్పుడు గిన్నె వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पाण्याची वाटी पुन्हा भरणे',
      description: 'पाळीव प्राण्याच्या वाटीतील जुनं पाणी ओतून टाका आणि त्यात ताजं पाणी भरा.',
      instructions: [
        'ओतताना वाटीकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Brushing or grooming a pet': {
    en: {
      name: 'Brushing or grooming a pet',
      description: 'Use a brush to comb your pet\'s fur. Move the brush gently from head to tail to remove loose hair and tangles.',
      instructions: [
        'Look at the pet while brushing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Escovar ou cuidar do pelo do bicho',
      description: 'Use uma escova para pentear o pelo do seu bicho. Passe a escova com cuidado, da cabeça até a cauda, para tirar os pelos soltos e os nós.',
      instructions: [
        'Olhe para o bicho enquanto escova.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Cepillar o asear a una mascota',
      description: 'Usa un cepillo para peinar el pelo de tu mascota. Pasa el cepillo con suavidad de la cabeza a la cola para quitar el pelo suelto y los nudos.',
      instructions: [
        'Mira a la mascota mientras la cepillas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पालतू जानवर को ब्रश करना',
      description: 'ब्रश से अपने पालतू जानवर के बालों को सँवारें। ब्रश को सिर से पूँछ तक धीरे-धीरे चलाएँ ताकि झड़े बाल और उलझनें निकल जाएँ।',
      instructions: [
        'ब्रश करते समय पालतू जानवर की ओर देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পোষ্যকে ব্রাশ করা বা পরিচর্যা করা',
      description: 'ব্রাশ দিয়ে পোষ্যর লোম আঁচড়ান। মাথা থেকে লেজ পর্যন্ত আস্তে ব্রাশ চালিয়ে আলগা লোম আর জটা ছাড়িয়ে দিন।',
      instructions: [
        'ব্রাশ করার সময় পোষ্যর দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வளர்ப்பு பிராணியை சீவுவது',
      description: 'ஒரு பிரஷ்ஷை வைத்து உங்கள் வளர்ப்பு பிராணியின் ரோமத்தை சீவுங்கள். தலை முதல் வால் வரை மெதுவாக பிரஷ்ஷை அசைத்து, உதிர்ந்த ரோமங்கள் மற்றும் சிக்கல்களை அகற்றுங்கள்.',
      instructions: [
        'சீவும்போது பிராணியை பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పెంపుడు జంతువును దువ్వడం లేదా శుభ్రపరచడం',
      description: 'మీ పెంపుడు జంతువు బొచ్చును బ్రష్‌తో దువ్వండి. తల నుండి తోక వరకు సున్నితంగా బ్రష్ కదిలించి, ఊడిన వెంట్రుకలు, చిక్కులు తీయండి.',
      instructions: [
        'దువ్వుతున్నప్పుడు పెంపుడు జంతువు వైపు చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पाळीव प्राण्याला ब्रश करणे किंवा निगा राखणे',
      description: 'तुमच्या पाळीव प्राण्याच्या केसांना ब्रशने विंचरा. डोक्यापासून शेपटीपर्यंत हळुवारपणे ब्रश फिरवा, म्हणजे सुटलेले केस आणि गुंते निघतील.',
      instructions: [
        'ब्रश करताना पाळीव प्राण्याकडे पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Bathing a pet': {
    en: {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: [
        'Look at the pet while washing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Dar banho no bicho',
      description: 'Lave seu bicho com água e shampoo próprio. Enxágue bem e seque com uma toalha.',
      instructions: [
        'Olhe para o bicho enquanto lava.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Bañar a una mascota',
      description: 'Lava a tu mascota con agua y champú para mascotas. Enjuaga bien y seca con una toalla.',
      instructions: [
        'Mira a la mascota mientras la lavas.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पालतू जानवर को नहलाना',
      description: 'अपने पालतू जानवर को पानी और पेट शैम्पू से नहलाएँ। अच्छे से धोएँ और तौलिये से पोंछें।',
      instructions: [
        'नहलाते समय पालतू जानवर की ओर देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পোষ্যকে স্নান করানো',
      description: 'জল আর পোষ্যর শ্যাম্পু দিয়ে পোষ্যকে ধুয়ে দিন। ভালো করে ধুয়ে তোয়ালে দিয়ে মুছে দিন।',
      instructions: [
        'ধোয়ার সময় পোষ্যর দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வளர்ப்பு பிராணிக்கு குளியல் கொடுப்பது',
      description: 'தண்ணீர் மற்றும் பிராணிகளுக்கான ஷாம்பு கொண்டு உங்கள் வளர்ப்பு பிராணியை குளிப்பாட்டுங்கள். நன்றாக அலசி, துண்டில் துடைத்து உலர்த்தவும்.',
      instructions: [
        'குளிப்பாட்டும்போது பிராணியை பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పెంపుడు జంతువుకు స్నానం చేయించడం',
      description: 'నీళ్లు, పెట్ షాంపూతో పెంపుడు జంతువును కడగండి. బాగా జల్లి, టవల్‌తో తుడవండి.',
      instructions: [
        'కడుగుతున్నప్పుడు పెంపుడు జంతువు వైపు చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पाळीव प्राण्याला अंघोळ घालणे',
      description: 'पाण्याने आणि पेट शॅम्पूने तुमच्या पाळीव प्राण्याला धुवा. नीट विसळा आणि टॉवेलने वाळवा.',
      instructions: [
        'धुताना पाळीव प्राण्याकडे पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Walking a pet': {
    en: {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: [
        'Look ahead and at the pet while walking.',
        'Walk at a steady pace.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Passear com o bicho',
      description: 'Leve seu bicho para passear na rua com a guia.',
      instructions: [
        'Olhe para a frente e para o bicho enquanto anda.',
        'Ande em um ritmo constante.',
      ],
      examples: [],
    },
    es: {
      name: 'Pasear a una mascota',
      description: 'Saca a tu mascota afuera con correa para pasear.',
      instructions: [
        'Mira hacia adelante y a la mascota mientras caminas.',
        'Camina a un paso constante.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'पालतू जानवर को घुमाना',
      description: 'अपने पालतू जानवर को पट्टे पर बाहर टहलाने ले जाएँ।',
      instructions: [
        'चलते समय आगे और पालतू जानवर की ओर देखें।',
        'एक रफ़्तार से चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পোষ্যকে বেড়াতে নিয়ে যাওয়া',
      description: 'পোষ্যকে দড়ি লাগিয়ে বাইরে বেড়াতে নিয়ে যান।',
      instructions: [
        'হাঁটার সময় সামনে আর পোষ্যর দিকে তাকান।',
        'একই গতিতে হাঁটুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வளர்ப்பு பிராணியை நடைக்கு அழைத்துப் போவது',
      description: 'உங்கள் வளர்ப்பு பிராணியை குத்துக் கயிறு போட்டு வெளியே நடைக்கு அழைத்துச் செல்லுங்கள்.',
      instructions: [
        'நடக்கும்போது முன்னேயும் பிராணியையும் பாருங்கள்.',
        'சீரான வேகத்தில் நடக்கவும்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పెంపుడు జంతువును నడిపించడం',
      description: 'మీ పెంపుడు జంతువును తాడుతో బయటకు తీసుకెళ్లి నడిపించండి.',
      instructions: [
        'నడుస్తున్నప్పుడు ముందుకు, పెంపుడు జంతువు వైపు చూడండి.',
        'స్థిరమైన వేగంతో నడవండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पाळीव प्राण्याला फिरायला नेणे',
      description: 'पाळीव प्राण्याला पट्ट्याला बांधून बाहेर फिरायला घेऊन जा.',
      instructions: [
        'चालताना समोर आणि पाळीव प्राण्याकडे पाहा.',
        'एकसारख्या गतीने चाला.',
      ],
      examples: [],
    },
  },
  'Filling a bird feeder': {
    en: {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: [
        'Look at the feeder while filling.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Encher o comedouro de passarinho',
      description: 'Tire o comedouro de passarinho do lugar, coloque a ração dentro e pendure de volta.',
      instructions: [
        'Olhe para o comedouro enquanto enche.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Llenar un comedero para pájaros',
      description: 'Baja el comedero, echa semillas para pájaros dentro y vuelve a colgarlo.',
      instructions: [
        'Mira el comedero mientras lo llenas.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'चिड़िया का दाना-पात्र भरना',
      description: 'बर्ड फ़ीडर को नीचे उतारें, उसमें दाना डालें, और वापस टाँग दें।',
      instructions: [
        'भरते समय फ़ीडर की ओर देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'পাখির খাবারের পাত্র ভরা',
      description: 'পাখির ফিডার নামিয়ে তাতে পাখির বীজ ভরুন, আর আবার ঝুলিয়ে দিন।',
      instructions: [
        'ভরার সময় ফিডারের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பறவை உணவுக் கூண்டை நிரப்புவது',
      description: 'பறவை உணவுக் கூண்டை கீழே இறக்கி, பறவை விதைகளை அதில் ஊற்றி, மீண்டும் தொங்கவிடுங்கள்.',
      instructions: [
        'நிரப்பும்போது உணவுக் கூண்டை பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పక్షుల ఆహార పాత్ర నింపడం',
      description: 'పక్షుల ఆహార పాత్రను దింపి, విత్తనాలు పోసి, తిరిగి వేలాడదీయండి.',
      instructions: [
        'నింపుతున్నప్పుడు పాత్ర వైపు చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'पक्ष्यांचा फीडर भरणे',
      description: 'पक्ष्यांचा फीडर खाली काढा, त्यात पक्ष्यांचे दाणे ओता आणि परत टांगा.',
      instructions: [
        'भरताना फीडरकडे पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Picking up after a dog': {
    en: {
      name: 'Picking up after a dog',
      description: 'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: [
        'Look down at the waste while picking up.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Recolher cocô de cachorro',
      description: 'Use uma sacola plástica para pegar o cocô do cachorro durante o passeio, amarre a sacola e leve até uma lixeira.',
      instructions: [
        'Olhe para baixo, para o cocô, enquanto recolhe.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Recoger los desechos del perro',
      description: 'Usa una bolsa de plástico para recoger los desechos del perro durante el paseo, ata la bolsa y llévala a un bote de basura.',
      instructions: [
        'Mira hacia abajo, a los desechos, mientras los recoges.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कुत्ते की गंदगी उठाना',
      description: 'घुमाने के दौरान प्लास्टिक की थैली से कुत्ते की गंदगी उठाएँ, थैली बाँधें, और कचरे के डिब्बे में डालें।',
      instructions: [
        'उठाते समय गंदगी की ओर नीचे देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কুকুরের মল তুলে নেওয়া',
      description: 'বেড়ানোর সময় প্লাস্টিকের ব্যাগ দিয়ে কুকুরের মল তুলুন, ব্যাগ বেঁধে আবর্জনার বিনে ফেলুন।',
      instructions: [
        'তোলার সময় মলের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'நாய் கழிவை எடுப்பது',
      description: 'நடைக்கு அழைத்துச் செல்லும்போது, ஒரு பிளாஸ்டிக் பையை வைத்து நாய் கழிவை எடுத்து, பையை கட்டி, குப்பை தொட்டிக்கு கொண்டு செல்லவும்.',
      instructions: [
        'எடுக்கும்போது கழிவை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'కుక్క మలాన్ని తీయడం',
      description: 'నడిచేటప్పుడు కుక్క మలాన్ని ప్లాస్టిక్ బ్యాగ్‌తో ఎత్తి, బ్యాగ్ ముడివేసి, చెత్త డబ్బాకు తీసుకెళ్లండి.',
      instructions: [
        'ఎత్తుతున్నప్పుడు మలం వైపు కిందికి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कुत्र्यानंतर साफ करणे',
      description: 'फिरताना कुत्र्याची शी प्लास्टिकच्या पिशवीने उचला, पिशवी बांधा आणि कचराडब्यापर्यंत घेऊन जा.',
      instructions: [
        'उचलताना शीकडे खाली पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Assembling furniture': {
    en: {
      name: 'Assembling furniture',
      description: 'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: [
        'Look down at your hands while you work.',
        'Keep working — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Montar móveis',
      description: 'Junte as peças do móvel usando parafusos, cavilhas e ferramentas, seguindo o passo a passo.',
      instructions: [
        'Olhe para baixo, para as suas mãos, enquanto trabalha.',
        'Continue trabalhando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Armar muebles',
      description: 'Une las piezas del mueble usando tornillos, pernos y herramientas, siguiendo los pasos.',
      instructions: [
        'Mira hacia abajo, a tus manos, mientras trabajas.',
        'Sigue trabajando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'फ़र्नीचर जोड़ना',
      description: 'पेंच, बोल्ट और औज़ारों से फ़र्नीचर के हिस्सों को निर्देशों के अनुसार जोड़ें।',
      instructions: [
        'काम करते समय अपने हाथों की ओर नीचे देखें।',
        'काम करते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'আসবাব জোড়া লাগানো',
      description: 'ধাপে ধাপে স্ক্রু, বল্টু আর যন্ত্রপাতি দিয়ে আসবাবের অংশগুলো জুড়ে লাগান।',
      instructions: [
        'কাজের সময় নিজের হাতের দিকে তাকান।',
        'কাজ চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'மரச்சாமான்களை பொருத்துவது',
      description: 'ஸ்க்ரூ, போல்ட் மற்றும் கருவிகளை வைத்து படிகளை பின்பற்றி மரச்சாமான் பாகங்களை இணைக்கவும்.',
      instructions: [
        'வேலை செய்யும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'வேலை செய்துகொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఫర్నిచర్ అమర్చడం',
      description: 'స్క్రూలు, బోల్ట్‌లు, పరికరాలు ఉపయోగించి ఫర్నిచర్ భాగాలను దశలవారీగా అమర్చండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'పని చేస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'फर्निचर जोडणे',
      description: 'स्क्रू, बोल्ट आणि हत्यारांनी फर्निचरचे भाग पायऱ्यांनुसार एकत्र जोडा.',
      instructions: [
        'काम करताना तुमच्या हातांकडे खाली पाहा.',
        'काम चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Using hand tools (screwdriver, hammer, etc.)': {
    en: {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description: 'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: [
        'Look down at your hands while working.',
        'Move slowly between actions.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Usar ferramentas manuais (chave de fenda, martelo, etc.)',
      description: 'Use ferramentas simples para consertar ou montar alguma coisa. Por exemplo, apertar parafusos com a chave de fenda ou bater pregos com o martelo.',
      instructions: [
        'Olhe para baixo, para as suas mãos, enquanto trabalha.',
        'Mova-se devagar entre as ações.',
      ],
      examples: [],
    },
    es: {
      name: 'Usar herramientas de mano (destornillador, martillo, etc.)',
      description: 'Usa herramientas sencillas para arreglar o construir algo. Por ejemplo, gira tornillos con un destornillador o clava clavos con un martillo.',
      instructions: [
        'Mira hacia abajo, a tus manos, mientras trabajas.',
        'Muévete despacio entre las acciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'हाथ के औज़ार इस्तेमाल करना (पेंचकस, हथौड़ा वगैरह)',
      description: 'कुछ ठीक करने या बनाने के लिए साधारण औज़ार इस्तेमाल करें। जैसे पेंचकस से पेंच कसना या हथौड़े से कील ठोकना।',
      instructions: [
        'काम करते समय अपने हाथों की ओर नीचे देखें।',
        'हर काम के बीच धीरे-धीरे चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'হাতের যন্ত্রপাতি ব্যবহার (স্ক্রুড্রাইভার, হাতুড়ি ইত্যাদি)',
      description: 'সাধারণ যন্ত্র দিয়ে কিছু সারান বা বানান। যেমন স্ক্রুড্রাইভার দিয়ে স্ক্রু ঘোরান বা হাতুড়ি দিয়ে পেরেক ঠুকুন।',
      instructions: [
        'কাজের সময় নিজের হাতের দিকে তাকান।',
        'কাজের মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'கைக் கருவிகளை பயன்படுத்துவது (ஸ்க்ரூட்ரைவர், சுத்தியல் போன்றவை)',
      description: 'ஏதேனும் ஒன்றை சரிசெய்யவோ உருவாக்கவோ எளிய கருவிகளை பயன்படுத்துங்கள். உதாரணமாக, ஸ்க்ரூட்ரைவர் வைத்து ஸ்க்ரூக்களை திருகுவது அல்லது சுத்தியலால் ஆணியை அடிப்பது.',
      instructions: [
        'வேலை செய்யும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'ஒரு செயலிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'చేతి పరికరాలు వాడడం (స్క్రూడ్రైవర్, సుత్తి, మొదలైనవి)',
      description: 'సాధారణ పరికరాలతో ఏదైనా బాగు చేయడం లేదా తయారు చేయడం. ఉదాహరణకు, స్క్రూడ్రైవర్‌తో స్క్రూలు తిప్పడం లేదా సుత్తితో మేకులు కొట్టడం.',
      instructions: [
        'పని చేస్తున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'ప్రతి చర్య మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'हत्यारं वापरणे (स्क्रूड्रायव्हर, हातोडा वगैरे)',
      description: 'साधी हत्यारं वापरून काहीतरी दुरुस्त करा किंवा बनवा. उदाहरणार्थ, स्क्रूड्रायव्हरने स्क्रू फिरवा किंवा हातोड्याने खिळे ठोका.',
      instructions: [
        'काम करताना तुमच्या हातांकडे खाली पाहा.',
        'क्रियांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Painting a wall or surface': {
    en: {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: [
        'Look at the part you are painting.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Pintar uma parede ou superfície',
      description: 'Use um pincel ou rolo para passar a tinta por igual em uma parede ou superfície.',
      instructions: [
        'Olhe para a parte que você está pintando.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Pintar una pared o superficie',
      description: 'Usa una brocha o rodillo para aplicar pintura de forma pareja en una pared o superficie.',
      instructions: [
        'Mira la parte que estás pintando.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'दीवार या सतह पर रंग करना',
      description: 'ब्रश या रोलर से दीवार या सतह पर रंग बराबर लगाएँ।',
      instructions: [
        'जिस हिस्से पर रंग कर रहे हैं, उसकी ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'দেয়ালে বা কোনো জায়গায় রং করা',
      description: 'ব্রাশ বা রোলার দিয়ে দেয়ালে বা কোনো জায়গায় সমানভাবে রং লাগান।',
      instructions: [
        'যে অংশ রং করছেন সেদিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சுவர் அல்லது மேற்பரப்பில் பெயிண்ட் அடிப்பது',
      description: 'ஒரு பிரஷ் அல்லது ரோலரை வைத்து சுவர் அல்லது மேற்பரப்பில் பெயிண்டை சமமாக பூசவும்.',
      instructions: [
        'நீங்கள் பெயிண்ட் அடிக்கும் பகுதியை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గోడ లేదా ఉపరితలానికి రంగు వేయడం',
      description: 'గోడ లేదా ఉపరితలానికి బ్రష్ లేదా రోలర్‌తో సమంగా రంగు పూయండి.',
      instructions: [
        'మీరు రంగు వేస్తున్న భాగం వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'भिंत किंवा पृष्ठभाग रंगवणे',
      description: 'ब्रश किंवा रोलरने भिंतीवर किंवा पृष्ठभागावर सारखा रंग द्या.',
      instructions: [
        'तुम्ही जो भाग रंगवत आहात त्याकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Minor plumbing repair': {
    en: {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: [
        'Look down at your hands while you work.',
        'Move slowly between actions.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Pequeno reparo de encanamento',
      description: 'Conserte problemas pequenos como uma torneira pingando ou um cano solto usando ferramentas básicas.',
      instructions: [
        'Olhe para baixo, para as suas mãos, enquanto trabalha.',
        'Mova-se devagar entre as ações.',
      ],
      examples: [],
    },
    es: {
      name: 'Reparación de plomería menor',
      description: 'Arregla problemas pequeños como una llave que gotea o un caño suelto con herramientas básicas.',
      instructions: [
        'Mira hacia abajo, a tus manos, mientras trabajas.',
        'Muévete despacio entre las acciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'छोटी प्लंबिंग ठीक करना',
      description: 'टपकता नल या ढीला पाइप जैसी छोटी दिक़्क़तें सामान्य औज़ारों से ठीक करें।',
      instructions: [
        'काम करते समय अपने हाथों की ओर नीचे देखें।',
        'हर काम के बीच धीरे-धीरे चलें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'ছোটখাটো কলের কাজ',
      description: 'বেসিক যন্ত্রপাতি দিয়ে ফুটো কল বা ঢিলে পাইপের মতো ছোট সমস্যা ঠিক করুন।',
      instructions: [
        'কাজের সময় নিজের হাতের দিকে তাকান।',
        'কাজের মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'சிறிய பிளம்பிங் வேலை',
      description: 'கசியும் குழாய் அல்லது தளர்வான பைப் போன்ற சிறிய பிரச்சினைகளை அடிப்படை கருவிகளை வைத்து சரிசெய்யவும்.',
      instructions: [
        'வேலை செய்யும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'ஒரு செயலிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'చిన్న ప్లంబింగ్ మరమ్మతు',
      description: 'లీక్ అవుతున్న కొళాయి లేదా వదులైన పైపు లాంటి చిన్న సమస్యలను సాధారణ పరికరాలతో బాగు చేయండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'ప్రతి చర్య మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'छोटी प्लंबिंगची दुरुस्ती',
      description: 'गळणारा नळ किंवा सैल पाइप यासारख्या छोट्या समस्या साध्या हत्यारांनी दुरुस्त करा.',
      instructions: [
        'काम करताना तुमच्या हातांकडे खाली पाहा.',
        'क्रियांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Washing or cleaning a vehicle': {
    en: {
      name: 'Washing or cleaning a vehicle',
      description: 'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: [
        'Look at the part you are washing.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Lavar ou limpar um veículo',
      description: 'Use água, sabão e um pano ou esponja para limpar a parte de fora de um carro, moto ou bicicleta.',
      instructions: [
        'Olhe para a parte que você está lavando.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Lavar o limpiar un vehículo',
      description: 'Usa agua, jabón y un paño o esponja para limpiar el exterior de un auto, bici o moto.',
      instructions: [
        'Mira la parte que estás lavando.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'गाड़ी धोना या साफ़ करना',
      description: 'पानी, साबुन और कपड़े या स्पंज से कार, बाइक या स्कूटर को बाहर से साफ़ करें।',
      instructions: [
        'जो हिस्सा धो रहे हैं, उसकी ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'গাড়ি ধোয়া বা পরিষ্কার করা',
      description: 'জল, সাবান আর কাপড় বা স্পঞ্জ দিয়ে গাড়ি, বাইক বা স্কুটারের বাইরের অংশ পরিষ্কার করুন।',
      instructions: [
        'যে অংশ ধুচ্ছেন সেদিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'வாகனத்தை கழுவுவது அல்லது சுத்தம் செய்வது',
      description: 'தண்ணீர், சோப்பு மற்றும் ஒரு துணி அல்லது ஸ்பாஞ்சை பயன்படுத்தி கார், பைக் அல்லது ஸ்கூட்டரின் வெளிப்பகுதியை சுத்தம் செய்யவும்.',
      instructions: [
        'நீங்கள் கழுவும் பகுதியை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'వాహనం కడగడం లేదా శుభ్రం చేయడం',
      description: 'నీళ్లు, సబ్బు, గుడ్డ లేదా స్పాంజ్‌తో కారు, బైక్ లేదా స్కూటర్ బయట భాగాన్ని శుభ్రం చేయండి.',
      instructions: [
        'మీరు కడుగుతున్న భాగం వైపు చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'वाहन धुणे किंवा साफ करणे',
      description: 'पाणी, साबण आणि कापड किंवा स्पंजने कार, बाइक किंवा स्कूटरचा बाहेरचा भाग साफ करा.',
      instructions: [
        'तुम्ही जो भाग धुत आहात त्याकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Replacing an air filter': {
    en: {
      name: 'Replacing an air filter',
      description: 'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: [
        'Look at the filter slot while you work.',
        'Move slowly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Trocar o filtro de ar',
      description: 'Abra o encaixe do filtro de ar no aquecedor ou na grade de retorno, puxe o filtro velho e encaixe um filtro novo.',
      instructions: [
        'Olhe para o encaixe do filtro enquanto trabalha.',
        'Mova-se devagar entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Cambiar un filtro de aire',
      description: 'Abre el espacio del filtro de aire en la calefacción o la rejilla de retorno, saca el filtro viejo y mete uno nuevo.',
      instructions: [
        'Mira la ranura del filtro mientras trabajas.',
        'Muévete despacio entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'एयर फ़िल्टर बदलना',
      description: 'फ़र्नेस या रिटर्न वेंट का एयर फ़िल्टर वाला ख़ाना खोलें, पुराना फ़िल्टर निकालें, और नया फ़िल्टर अंदर डालें।',
      instructions: [
        'काम करते समय फ़िल्टर के ख़ाने की ओर देखें।',
        'हर कदम धीरे-धीरे बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'এয়ার ফিল্টার বদলানো',
      description: 'ফার্নেস বা রিটার্ন ভেন্টের এয়ার ফিল্টারের খাঁজ খুলে পুরোনো ফিল্টার বের করুন, আর নতুনটা ঢুকিয়ে দিন।',
      instructions: [
        'কাজের সময় ফিল্টারের খাঁজের দিকে তাকান।',
        'ধাপগুলোর মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஏர் ஃபில்டரை மாற்றுவது',
      description: 'ஃபர்னேஸ் அல்லது ரிட்டர்ன் வெண்ட்டில் உள்ள ஏர் ஃபில்டர் இடத்தை திறந்து, பழைய ஃபில்டரை வெளியே இழுத்து, புதிய ஃபில்டரை உள்ளே நுழைக்கவும்.',
      instructions: [
        'வேலை செய்யும்போது ஃபில்டர் இடத்தை பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'ఎయిర్ ఫిల్టర్ మార్చడం',
      description: 'ఫర్నేస్ లేదా రిటర్న్ వెంట్ మీద ఎయిర్ ఫిల్టర్ స్లాట్ తెరిచి, పాత ఫిల్టర్‌ను బయటకు తీసి, తాజా ఫిల్టర్‌ను లోపలికి జారనివ్వండి.',
      instructions: [
        'పని చేస్తున్నప్పుడు ఫిల్టర్ స్లాట్ వైపు చూడండి.',
        'ప్రతి అడుగు మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'एअर फिल्टर बदलणे',
      description: 'फर्नेस किंवा रिटर्न व्हेंटमधील एअर फिल्टरचा खण उघडा, जुना फिल्टर बाहेर सरकवा आणि नवीन फिल्टर आत सरकवा.',
      instructions: [
        'काम करताना फिल्टरच्या खणाकडे पाहा.',
        'टप्प्यांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Replacing a smoke detector battery': {
    en: {
      name: 'Replacing a smoke detector battery',
      description: 'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: [
        'Look up at the detector.',
        'Move slowly between steps.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Trocar a pilha do detector de fumaça',
      description: 'Abra o detector de fumaça, tire a pilha velha, coloque uma nova e feche a tampa.',
      instructions: [
        'Olhe para cima, para o detector.',
        'Mova-se devagar entre as etapas.',
      ],
      examples: [],
    },
    es: {
      name: 'Cambiar la pila del detector de humo',
      description: 'Abre el detector de humo, saca la pila vieja, pon una nueva y cierra la tapa.',
      instructions: [
        'Mira hacia arriba, al detector.',
        'Muévete despacio entre los pasos.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'स्मोक डिटेक्टर की बैटरी बदलना',
      description: 'स्मोक डिटेक्टर खोलें, पुरानी बैटरी निकालें, नई बैटरी डालें, और कवर बंद करें।',
      instructions: [
        'डिटेक्टर की ओर ऊपर देखें।',
        'हर कदम धीरे-धीरे बढ़ाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'স্মোক ডিটেক্টরের ব্যাটারি বদলানো',
      description: 'স্মোক ডিটেক্টর খুলে পুরোনো ব্যাটারি বের করুন, নতুনটা লাগান, আর ঢাকনা বন্ধ করুন।',
      instructions: [
        'ডিটেক্টরের দিকে উপরে তাকান।',
        'ধাপগুলোর মাঝে আস্তে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'புகை கண்டறிவான் பேட்டரியை மாற்றுவது',
      description: 'புகை கண்டறிவானை திறந்து, பழைய பேட்டரியை எடுத்து, புதியதை வைத்து, மூடியை மூடவும்.',
      instructions: [
        'கண்டறிவானை மேலே பாருங்கள்.',
        'ஒவ்வொரு படியிலும் மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'స్మోక్ డిటెక్టర్ బ్యాటరీ మార్చడం',
      description: 'స్మోక్ డిటెక్టర్ తెరిచి, పాత బ్యాటరీ తీసి, తాజాది వేసి, మూత మూయండి.',
      instructions: [
        'డిటెక్టర్ వైపు పైకి చూడండి.',
        'ప్రతి అడుగు మధ్య నెమ్మదిగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'स्मोक डिटेक्टरची बॅटरी बदलणे',
      description: 'स्मोक डिटेक्टर उघडा, जुनी बॅटरी काढा, नवीन बॅटरी घाला आणि झाकण बंद करा.',
      instructions: [
        'डिटेक्टरकडे वर पाहा.',
        'टप्प्यांमध्ये हळूहळू हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Changing a light bulb': {
    en: {
      name: 'Changing a light bulb',
      description: 'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: [
        'Look up at the fixture.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Trocar uma lâmpada',
      description: 'Desligue a luz, desrosqueie a lâmpada velha do bocal e rosqueie uma lâmpada nova.',
      instructions: [
        'Olhe para cima, para o bocal.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Cambiar un foco',
      description: 'Apaga la luz, desenrosca el foco viejo y enrosca un foco nuevo.',
      instructions: [
        'Mira hacia arriba, a la lámpara.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बल्ब बदलना',
      description: 'लाइट बंद करें, फ़िक्सचर से पुराना बल्ब घुमाकर निकालें, और नया बल्ब घुमाकर लगाएँ।',
      instructions: [
        'फ़िक्सचर की ओर ऊपर देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বাল্ব বদলানো',
      description: 'লাইট বন্ধ করুন, হোল্ডার থেকে পুরোনো বাল্ব খুলুন, আর নতুন বাল্ব লাগান।',
      instructions: [
        'হোল্ডারের দিকে উপরে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'லைட் பல்பை மாற்றுவது',
      description: 'லைட்டை அணைத்துவிட்டு, பழைய பல்பை திருகி எடுத்து, புதிய பல்பை உள்ளே திருகி வையுங்கள்.',
      instructions: [
        'பல்ப் ஃபிக்ஸ்சரை மேலே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'లైట్ బల్బ్ మార్చడం',
      description: 'లైట్ ఆపేసి, ఫిక్చర్ నుండి పాత బల్బ్‌ను తిప్పి తీసి, కొత్త బల్బ్ తిప్పి బిగించండి.',
      instructions: [
        'ఫిక్చర్ వైపు పైకి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'लाइट बल्ब बदलणे',
      description: 'लाइट बंद करा, फिक्श्चरमधून जुना बल्ब फिरवून काढा आणि नवीन बल्ब बसवा.',
      instructions: [
        'फिक्श्चरकडे वर पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Sewing or mending clothes': {
    en: {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Costurar ou consertar roupas',
      description: 'Use agulha e linha para consertar rasgos ou unir pedaços de tecido.',
      instructions: [
        'Sente em um lugar firme.',
        'Olhe para baixo, para as suas mãos, enquanto costura.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Coser o remendar ropa',
      description: 'Usa una aguja e hilo para arreglar rasgaduras o coser piezas de tela.',
      instructions: [
        'Siéntate en un lugar estable.',
        'Mira hacia abajo, a tus manos, mientras coses.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'कपड़े सिलना या मरम्मत करना',
      description: 'सूई और धागे से फटे कपड़े ठीक करें या कपड़े के टुकड़े जोड़ें।',
      instructions: [
        'सीधी जगह पर बैठें।',
        'सिलते समय अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'কাপড় সেলাই করা বা সারানো',
      description: 'সুঁই-সুতো দিয়ে ছেঁড়া কাপড় সারান বা কাপড়ের টুকরো জোড়া লাগান।',
      instructions: [
        'একটা স্থির জায়গায় বসুন।',
        'সেলাইয়ের সময় নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'துணி தைப்பது அல்லது சரிசெய்வது',
      description: 'ஊசி, நூல் வைத்து கிழிசலை சரிசெய்யவோ அல்லது துணி துண்டுகளை இணைத்து தைக்கவோ செய்யுங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவும்.',
        'தைக்கும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'బట్టలు కుట్టడం లేదా మరమ్మతు చేయడం',
      description: 'సూది, దారంతో చిరుగులు బాగు చేయండి లేదా బట్ట ముక్కలను కలిపి కుట్టండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి.',
        'కుడుతున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'कपडे शिवणे किंवा दुरुस्त करणे',
      description: 'फाटलेले कपडे दुरुस्त करण्यासाठी किंवा कापडाचे तुकडे एकत्र शिवण्यासाठी सुई आणि दोरा वापरा.',
      instructions: [
        'स्थिर जागी बसा.',
        'शिवताना तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Threading a needle': {
    en: {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Passar a linha na agulha',
      description: 'Passe uma linha pelo buraquinho no topo de uma agulha.',
      instructions: [
        'Sente em um lugar firme.',
        'Olhe para baixo, para as suas mãos.',
        'Mova-se devagar e com firmeza.',
      ],
      examples: [],
    },
    es: {
      name: 'Enhebrar una aguja',
      description: 'Pasa el hilo por el agujerito de la parte de arriba de una aguja.',
      instructions: [
        'Siéntate en un lugar estable.',
        'Mira hacia abajo, a tus manos.',
        'Muévete despacio y con paso firme.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'सूई में धागा डालना',
      description: 'धागे को सूई के ऊपर के छोटे छेद में से निकालें।',
      instructions: [
        'सीधी जगह पर बैठें।',
        'अपने हाथों की ओर नीचे देखें।',
        'धीरे और सँभलकर काम करें।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'সুঁইতে সুতো পরানো',
      description: 'সুঁইয়ের মাথার ছোট ফুটো দিয়ে সুতো ঢোকান।',
      instructions: [
        'একটা স্থির জায়গায় বসুন।',
        'নিজের হাতের দিকে তাকান।',
        'আস্তে আর স্থিরভাবে নাড়ুন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'ஊசியில் நூல் கோர்ப்பது',
      description: 'ஊசியின் மேல் உள்ள சிறிய துளை வழியே நூலை செலுத்துங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவும்.',
        'உங்கள் கைகளை கீழே பாருங்கள்.',
        'மெதுவாக, நிலையாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'సూదికి దారం ఎక్కించడం',
      description: 'సూది పైభాగంలోని చిన్న రంధ్రం గుండా దారాన్ని పంపండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి.',
        'మీ చేతుల వైపు కిందికి చూడండి.',
        'నెమ్మదిగా, స్థిరంగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'सुईत दोरा ओवणे',
      description: 'सुईच्या वरच्या छोट्या भोकातून दोरा ओवा.',
      instructions: [
        'स्थिर जागी बसा.',
        'तुमच्या हातांकडे खाली पाहा.',
        'हळूहळू आणि स्थिरपणे हालचाल करा.',
      ],
      examples: [],
    },
  },
  'Knitting or crocheting': {
    en: {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        'Keep working — don\'t pause.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Tricotar ou fazer crochê',
      description: 'Use agulhas ou agulha de crochê com lã para fazer tecidos, cachecóis ou outros itens.',
      instructions: [
        'Sente em um lugar firme.',
        'Olhe para baixo, para as suas mãos, enquanto trabalha.',
        'Continue trabalhando — não pare.',
      ],
      examples: [],
    },
    es: {
      name: 'Tejer con agujas o ganchillo',
      description: 'Usa agujas o un ganchillo con hilo para hacer tela, bufandas u otras cosas.',
      instructions: [
        'Siéntate en un lugar estable.',
        'Mira hacia abajo, a tus manos, mientras trabajas.',
        'Sigue trabajando, no pares.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'बुनाई करना',
      description: 'सलाई या हुक और ऊन से कपड़ा, मफ़लर या दूसरी चीज़ें बुनें।',
      instructions: [
        'सीधी जगह पर बैठें।',
        'काम करते समय अपने हाथों की ओर नीचे देखें।',
        'काम करते रहें — रुकें नहीं।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'বুনন বা ক্রোশে করা',
      description: 'কাঁটা বা হুক আর উলের সুতো দিয়ে কাপড়, মাফলার বা অন্য জিনিস বুনুন।',
      instructions: [
        'একটা স্থির জায়গায় বসুন।',
        'কাজের সময় নিজের হাতের দিকে তাকান।',
        'কাজ চালিয়ে যান — থামবেন না।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பின்னல் வேலை செய்வது',
      description: 'ஊசி அல்லது கொக்கி வைத்து நூலால் துணி, ஸ்கார்ஃப் அல்லது மற்ற பொருட்களை பின்னுங்கள்.',
      instructions: [
        'ஒரு நிலையான இடத்தில் உட்காரவும்.',
        'வேலை செய்யும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'வேலை செய்துகொண்டே இருங்கள் — நிறுத்த வேண்டாம்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'అల్లడం లేదా క్రోషే చేయడం',
      description: 'సూదులు లేదా హుక్‌తో ఉన్ని దారం ఉపయోగించి బట్ట, మఫ్లర్‌లు లేదా ఇతర వస్తువులు తయారు చేయండి.',
      instructions: [
        'స్థిరమైన చోట కూర్చోండి.',
        'పని చేస్తున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'పని చేస్తూ ఉండండి — ఆగకండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'विणकाम किंवा क्रोशे करणे',
      description: 'सुया किंवा हुक आणि लोकर वापरून कापड, स्कार्फ किंवा इतर वस्तू विणा.',
      instructions: [
        'स्थिर जागी बसा.',
        'काम करताना तुमच्या हातांकडे खाली पाहा.',
        'काम चालू ठेवा — थांबू नका.',
      ],
      examples: [],
    },
  },
  'Gift wrapping': {
    en: {
      name: 'Gift wrapping',
      description: 'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: [
        'Look down at your hands while wrapping.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Embrulhar presente',
      description: 'Embrulhe um presente com papel, dobre as pontas com capricho e cole fita adesiva ou amarre uma fita para fechar.',
      instructions: [
        'Olhe para baixo, para as suas mãos, enquanto embrulha.',
        'Faça movimentos suaves e pequenos com a cabeça.',
      ],
      examples: [],
    },
    es: {
      name: 'Envolver regalos',
      description: 'Envuelve un regalo en papel, dobla los bordes con cuidado y pega cinta o moño para sujetarlo.',
      instructions: [
        'Mira hacia abajo, a tus manos, mientras envuelves.',
        'Haz giros de cabeza pequeños y suaves.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'उपहार लपेटना',
      description: 'उपहार को काग़ज़ में लपेटें, किनारे करीने से मोड़ें, और टेप या रिबन से बाँधें।',
      instructions: [
        'लपेटते समय अपने हाथों की ओर नीचे देखें।',
        'सिर को धीरे-धीरे और हल्के से घुमाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'উপহার মোড়ানো',
      description: 'কাগজ দিয়ে উপহার মুড়ুন, কোণাগুলো গুছিয়ে ভাঁজ করুন, আর টেপ বা ফিতে দিয়ে আটকে দিন।',
      instructions: [
        'মোড়ানোর সময় নিজের হাতের দিকে তাকান।',
        'মাথা ছোট ছোট করে আস্তে ঘোরান।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பரிசுப் பொருளை சுற்றுவது',
      description: 'பரிசுப் பொருளை காகிதத்தில் சுற்றி, ஓரங்களை ஒழுங்காக மடித்து, டேப் அல்லது ரிப்பனால் கட்டிவையுங்கள்.',
      instructions: [
        'சுற்றும்போது உங்கள் கைகளை கீழே பாருங்கள்.',
        'தலையை மெதுவாக, சிறிய அசைவுகளில் திருப்புங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'గిఫ్ట్ ర్యాపింగ్',
      description: 'గిఫ్ట్‌ను కాగితంలో చుట్టి, అంచులు నీట్‌గా మడిచి, టేప్ లేదా రిబ్బన్‌తో పట్టి ఉంచండి.',
      instructions: [
        'ర్యాప్ చేస్తున్నప్పుడు మీ చేతుల వైపు కిందికి చూడండి.',
        'చిన్నగా, మెల్లగా తల తిప్పండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'गिफ्ट गुंडाळणे',
      description: 'गिफ्टला कागदात गुंडाळा, कडा नीट दुमडा आणि टेप किंवा रिबनने बांधून ठेवा.',
      instructions: [
        'गुंडाळताना तुमच्या हातांकडे खाली पाहा.',
        'डोके हळूहळू, छोट्या हालचालींनी फिरवा.',
      ],
      examples: [],
    },
  },
  'Hanging holiday string lights': {
    en: {
      name: 'Hanging holiday string lights',
      description: 'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Pendurar pisca-pisca de festa',
      description: 'Desenrole um cordão de pisca-pisca e pendure no corrimão, no telhado ou em uma árvore.',
      instructions: [
        'Olhe para o lugar onde está pendurando o pisca-pisca.',
        'Mova-se com calma entre as áreas.',
      ],
      examples: [],
    },
    es: {
      name: 'Colgar luces navideñas',
      description: 'Desenreda una tira de luces y cuélgala a lo largo de un barandal, el borde del techo o un árbol.',
      instructions: [
        'Mira el lugar donde estás colgando las luces.',
        'Muévete con suavidad entre las secciones.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'त्यौहार की झालर लाइट टाँगना',
      description: 'लाइटों की लड़ी खोलें और रेलिंग, छत के किनारे या पेड़ पर टाँगें।',
      instructions: [
        'जहाँ लाइट टाँग रहे हैं, उसकी ओर देखें।',
        'एक हिस्से से दूसरे हिस्से तक आराम से जाएँ।',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'উৎসবের ঝিকিমিকি আলো ঝোলানো',
      description: 'ঝিকিমিকি আলোর তার খুলে রেলিং, ছাদের ধার, বা গাছে ঝুলিয়ে দিন।',
      instructions: [
        'যেখানে আলো ঝোলাচ্ছেন সেদিকে তাকান।',
        'একেকটা অংশে মসৃণভাবে এগোন।',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'பண்டிகை அலங்கார விளக்குகளை தொங்கவிடுவது',
      description: 'ஸ்ட்ரிங் விளக்குகளின் சுருளை அவிழ்த்து, கைப்பிடி, கூரை ஓரம் அல்லது மரத்தில் தொங்கவிடவும்.',
      instructions: [
        'விளக்குகளை தொங்கவிடும் இடத்தை பாருங்கள்.',
        'ஒரு பகுதியிலிருந்து இன்னொன்றுக்கு மெதுவாக நகருங்கள்.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'పండుగ సీరియల్ లైట్లు వేలాడదీయడం',
      description: 'సీరియల్ లైట్ల చుట్టను విప్పి, రెయిలింగ్, పైకప్పు అంచు లేదా చెట్టు మీద వేలాడదీయండి.',
      instructions: [
        'మీరు లైట్లు వేలాడదీస్తున్న చోటును చూడండి.',
        'సెక్షన్ల మధ్య మెల్లగా కదలండి.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'सणाच्या तोरण लाइट्स लावणे',
      description: 'स्ट्रिंग लाइट्सची लड उघडा आणि कठड्यावर, छपराच्या कडेला किंवा झाडावर लावा.',
      instructions: [
        'तुम्ही जिथे लाइट्स लावत आहात तिकडे पाहा.',
        'एका भागातून दुसऱ्या भागात सहज हालचाल करा.',
      ],
      examples: [],
    },
  },
};

/**
 * NFC-normalize + strip combining marks (accent-stripping for Latin scripts
 * per 07-RESEARCH Pitfall 7) + lowercase + trim. Used by both the
 * fullStringMap build pass below AND by reverseSearch.ts at call time —
 * the two MUST use the same normalize() to guarantee Stage-1 hits.
 */
export function normalizeForReverseSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .trim();
}

// English content-word filter for the Stage-2 token map. We skip these so a
// generic article/preposition in the localized text doesn't pollute the
// reverse table. The English side of the map is the rebuild target, so
// dropping them on the localized side too is symmetric.
const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'for',
  'with',
  'in',
  'on',
  'and',
  'or',
  'at',
  'by',
]);

/**
 * Build per-locale reverse maps from the catalog at module load (D-15 —
 * derived, not pre-built JSON). Stage-1 maps the fully-normalized localized
 * name to the canonical English name. Stage-2 maps each NORMALIZED localized
 * TOKEN to the corresponding ENGLISH token when the two name strings tokenize
 * to the same length (a fragile heuristic — English is the rebuild target,
 * so the result is "good enough" passed to the backend ts_vector index).
 */
export function buildReverseMaps(catalog: typeof TASK_CATALOG_I18N): Record<string, ReverseMap> {
  const out: Record<string, ReverseMap> = {};
  for (const loc of ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']) {
    const fullStringMap: Record<string, string> = {};
    const tokenMap: Record<string, string> = {};

    for (const [canonical, byLocale] of Object.entries(catalog)) {
      const body = byLocale[loc as Locale];
      const localized = body?.name;
      if (!localized) continue;

      const normalizedLocalized = normalizeForReverseSearch(localized);
      if (normalizedLocalized) {
        // Stage 1
        fullStringMap[normalizedLocalized] = canonical;
      }

      // Stage 2: 1:1 token alignment WHEN counts match. The skeleton phase
      // (localized === English) makes this an identity map for every task
      // until the LLM regen runs.
      const enTokens = canonical.split(/\s+/).map(normalizeForReverseSearch).filter(Boolean);
      const locTokens = localized.split(/\s+/).map(normalizeForReverseSearch).filter(Boolean);
      if (enTokens.length === locTokens.length && enTokens.length > 0) {
        for (let i = 0; i < enTokens.length; i++) {
          const enTok = enTokens[i];
          const locTok = locTokens[i];
          if (!enTok || !locTok) continue;
          if (ENGLISH_STOPWORDS.has(enTok)) continue;
          tokenMap[locTok] = enTok;
        }
      }
    }

    out[loc] = { fullStringMap, tokenMap };
  }
  return out;
}

export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);
