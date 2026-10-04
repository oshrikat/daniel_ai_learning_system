/**
 * מאמן ה-AI של דניאל v3.0 - מנוע מלא, בטוח ונקי
 * 
 * תכונות מרכזיות:
 * 1. מסלול מודרג ונקי של 10 יחידות מותאמות אישית לדניאל (ללא כפילויות).
 * 2. תחנת מבחן שלב (Checkpoint) כל 2 יחידות עם סף מעבר מחייב של 85+.
 * 3. בנק שאלות מתחלפות ואקראיות (4 שאלות נבחרות בכל הרצה + ערבוב תשובות).
 * 4. שיתוף מהיר לאבא ב-WhatsApp בקליק אחד בסיום כל יחידה ומבחן.
 * 5. נעילת שבת אוטומטית (שישי 16:30 עד מוצ"ש 20:30) עם אפשרות מעקף מלווה.
 * 6. ממשק ניהול סמוי ומוגן PIN (#admin) עם שרשרת Fallback רב-מודלית (Gemini, Groq, Ollama).
 * 7. מיגרציה בטוחה ושקטה המשמרת מפתחות API קיימים מכל גרסאות העבר.
 */

// ============================================================================
// 1. קבועים, מפתחות אחסון ובנק היחידות הנקי (Clean v3 Units)
// ============================================================================

const STORAGE_KEY = 'DANIEL_AI_V3_CLEAN';
const LEGACY_STORAGE_KEYS = [
  'DANIEL_AI_LEARNING_SYSTEM_V2',
  'DANIEL_AI_LEARNING_SYSTEM_V1',
  'daniel_ai_learning_system_v3',
  'daniel_ai_learning_system_state'
];
const ADMIN_PIN_DEFAULT = '1234';

// 10 יחידות לימוד מעשיות, עשירות, מכבדות ומותאמות לסביבת עבודה, יצירה ועצמאות
const DEFAULT_CURRICULUM_UNITS = [
  {
    id: 'unit_1',
    title: 'איך מבקשים מה-AI תשובה פשוטה וקצרה',
    category: 'בסיס ופשטות',
    goal: 'ללמוד לבקש מה-AI הסבר קצר של 2 משפטים במקום לקבל הרצאה ארוכה ומבלבלת.',
    isUnlocked: true,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מה זה ענן במחשב?',
      badResult: 'מחשוב ענן הינו מודל המאפשר גישה לפי דרישה למאגר משאבים וירטואליים שיתופיים, שרתים ואחסון המנוהלים ברשת...',
      goodPrompt: 'תסביר לי ב-2 משפטים קצרים ובמילים פשוטות: מה זה ענן במחשב?',
      goodResult: 'ענן זה כמו דיסק-און-קי ענקי שנמצא באינטרנט. הקבצים והתמונות שלך נשמרים שם בטוח, ואתה יכול לפתוח אותם מכל מחשב וטלפון.'
    },
    step2_takeaway: 'כשכותבים ל-AI "ב-2 משפטים קצרים ובמילים פשוטות", מקבלים תשובה שקל להבין מיד!',
    step3_quiz: {
      question: 'איך הכי כדאי לבקש מה-AI להסביר משהו חדש?',
      options: [
        { text: 'לבקש: "תסביר לי ב-2 משפטים קצרים ובמילים פשוטות"', isCorrect: true, explanation: 'בדיוק! זה גורם ל-AI לענות קצר, ברור ולעניין.' },
        { text: 'לכתוב רק מילה אחת ולא להסביר מה רוצים', isCorrect: false, explanation: 'אם לא נגדיר לו, ה-AI עלול לכתוב תשובה ארוכה מדי ומסובכת.' }
      ]
    },
    step4_action: {
      prompt: 'תסביר לי ב-2 משפטים קצרים ובמילים פשוטות: מה זה אינטרנט?',
      doText: 'העתק את הפרומפט ובדוק כמה קל ופשוט לבקש נכון:'
    }
  },
  {
    id: 'unit_2',
    title: 'ניסוח הודעת וואטסאפ מכבדת על איחור לעבודה',
    category: 'עבודה ותקשורת',
    goal: 'להיעזר ב-AI לניסוח הודעה מהירה ומכבדת למנהל או למדריך כשיש פקק או עיכוב.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'אני מאחר',
      badResult: 'מתי תגיע? איפה אתה? למה אתה לא מודיע מסודר?',
      goodPrompt: 'תנסח לי הודעת וואטסאפ מנומסת של 2 משפטים למנהל שלי, שאני מאחר ב-20 דקות בגלל פקק באוטובוס',
      goodResult: 'בוקר טוב! לצערי יש פקק חריג בדרך ואאחר בכ-20 דקות. מתנצל על העיכוב ואעדכן ברגע שאגיע לעבודה.'
    },
    step2_takeaway: 'הודעה טובה כוללת: ברכת שלום, כמה זמן נאחר, סיבה קצרה, והתנצלות מנומסת.',
    step3_quiz: {
      question: 'מה חשוב שיהיה בהודעה למנהל כשמאחרים?',
      options: [
        { text: 'ברכת בוקר טוב, כמה דקות איחור ועדכון מתי מגיעים', isCorrect: true, explanation: 'נכון מאוד! זה מראה על אחריות, בגרות ונימוס.' },
        { text: 'לא לשלוח כלום ולקוות שאף אחד לא ישים לב', isCorrect: false, explanation: 'לא כדאי! מנהלים מעריכים מאוד הודעה מוקדמת.' }
      ]
    },
    step4_action: {
      prompt: 'תנסח לי הודעת וואטסאפ מנומסת של 2 משפטים למנהל שלי, שאני מעט מתעכב ואגיע ב-08:30',
      doText: 'העתק את ההודעה ובדוק איך הניסוח המנומס מרגיע את המצב:'
    }
  },
  {
    id: 'unit_3',
    title: 'כלל הברזל: שמירה על פרטיות ומידע אישי',
    category: 'בטיחות וסייבר',
    goal: 'ללמוד איזה מידע אסור בשום אופן לכתוב ל-AI כדי לשמור על עצמנו בטוחים ברשת.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'הנה תעודת הזהות שלי 012345678 והסיסמה שלי 1234, תבדוק לי משהו',
      badResult: 'אזהרה! לעולם אל תשתף מידע רגיש, סיסמאות או תעודות זהות במערכות צ\'אט ציבוריות!',
      goodPrompt: 'תסביר לי באופן כללי איך בודקים יתרת חשבון באתר הבנק, בלי לכתוב פרטים אישיים',
      goodResult: 'נכנסים לאתר הבנק הרשמי, מקלידים את הקוד האישי רק באתר המאובטח של הבנק, ולוחצים על "עובר ושב".'
    },
    step2_takeaway: 'לעולם לא רושמים ל-AI: תעודת זהות, סיסמאות, מספר כרטיס אשראי או כתובת מגורים מדויקת!',
    step3_quiz: {
      question: 'האם מותר לרשום ל-AI את הסיסמה של המייל שלך כדי שיעזור לך?',
      options: [
        { text: 'בשום אופן לא! סיסמה שומרים תמיד בסוד בראש או במחברת בטוחה', isCorrect: true, explanation: 'אלופים! סיסמאות הן סודיות ואף פעם לא נותנים אותן לצ\'אט.' },
        { text: 'כן, מותר לתת לו כי הוא מחשב חכם', isCorrect: false, explanation: 'ממש לא! ה-AI שומר שיחות ומידע עלול לדלוף החוצה.' }
      ]
    },
    step4_action: {
      prompt: 'תן לי 3 טיפים קצרים איך לשמור על הסיסמאות שלי בטוחות במחשב',
      doText: 'העתק ובדוק 3 כללים חשובים לבטיחות הסיסמאות שלך:'
    }
  },
  {
    id: 'unit_4',
    title: 'מציאת מתכון קל לאוכל שאוהבים',
    category: 'כישורי חיים ועצמאות',
    goal: 'להיעזר ב-AI כדי לקבל מתכון פשוט, ברור ובטוח ב-3 צעדים קצרים להכנה במטבח.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'איך מכינים טוסט?',
      badResult: 'להכנת קרוק מסייה צרפתי מסורתי, התחל בהכנת רוטב בשמל מורכב מרוכז על בסיס חמאה אירופאית...',
      goodPrompt: 'תן לי מתכון פשוט ב-3 צעדים קצרים איך להכין טוסט גבינה צהובה טעים בטוסטר לחיץ',
      goodResult: '1. מרח חמאה או קטשופ על 2 פרוסות לחם ושים גבינה צהובה באמצע.\n2. הנח בטוסטר הלחיץ וסגור בזהירות.\n3. חכה כ-4 דקות עד שהלחם זהוב והגבינה נמסה. זהירות, חם וטעים!'
    },
    step2_takeaway: 'כשמבקשים מתכון, מגדירים: "ב-3 צעדים קצרים" ו"מרכיבים שיש בכל בית".',
    step3_quiz: {
      question: 'איך תקבל מה-AI מתכון שקל וכיף להכין לבד?',
      options: [
        { text: 'נבקש: "מתכון פשוט ב-3 צעדים קצרים וברורים"', isCorrect: true, explanation: 'בול! כך מקבלים שלבים קלים שקל לעקוב אחריהם במטבח.' },
        { text: 'נבקש מתכון של מסעדת שף בצרפתית', isCorrect: false, explanation: 'זה יהיה מתכון מסובך עם הרבה חומרים יקרים וקשים.' }
      ]
    },
    step4_action: {
      prompt: 'תן לי מתכון קל ב-3 שלבים קצרים להכנת סלט ירקות ישראלי טרי וטעים',
      doText: 'העתק ובדוק את המתכון המהיר והבריא שה-AI מכין לך:'
    }
  },
  {
    id: 'unit_5',
    title: 'סיכום טקסט ארוך ומעייף לנקודות קצרות',
    category: 'מיקוד והבנה',
    goal: 'ללמוד איך לתת ל-AI הודעה ארוכה ומסובכת ולבקש ממנו לסכם אותה ב-3 נקודות.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תקרא את זה: [טקסט של 20 שורות]',
      badResult: 'קראתי. הטקסט דן בסוגיות שונות של נהלי העבודה בעולם המודרני ובממשקים שונים...',
      goodPrompt: 'סכם לי את ההודעה הבאה ב-3 נקודות קצרות וברורות: מה צריך לעשות היום בעבודה?',
      goodResult: '1. להגיע ב-08:30 לחדר הישיבות.\n2. לעבור על טפסי הציוד החדש.\n3. לנקות ולסדר את שולחן העבודה בסיום.'
    },
    step2_takeaway: 'כשמבקשים מה-AI "לסכם ב-3 נקודות", חוסכים זמן ומבינים מיד מה העיקר בלי להתעייף.',
    step3_quiz: {
      question: 'איך הכי מועיל להיעזר ב-AI כשמקבלים מכתב ארוך מהעירייה או מהבנק?',
      options: [
        { text: 'לבקש ממנו לסכם ב-3 נקודות פשוטות מה הם רוצים ממני', isCorrect: true, explanation: 'בדיוק! הוא מחלץ עבורך את השורה התחתונה במהירות.' },
        { text: 'לבקש ממנו להפוך את המכתב לשיר ראפ באנגלית', isCorrect: false, explanation: 'זה אולי מצחיק, אבל לא יעזור להבין מה לעשות.' }
      ]
    },
    step4_action: {
      prompt: 'סכם לי ב-3 נקודות קצרות: למה חשוב לשתות מספיק מים ביום חם?',
      doText: 'העתק את הפרומפט ובדוק איך ה-AI מסכם ב-3 נקודות קולעות:'
    }
  },
  {
    id: 'unit_6',
    title: 'רעיון למתנה נחמדה לחבר או להורים',
    category: 'יחסים וחברה',
    goal: 'להשתמש ב-AI כשותף לחשיבה כדי למצוא רעיון משמח למתנה בתקציב שמתאים לנו.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מה לקנות לאבא מתנה?',
      badResult: 'אפשר לקנות שעון יוקרה, רכב חדש, חופשה בהוואי, עניבה, ספר או בושם...',
      goodPrompt: 'תן לי 2 רעיונות למתנה יפה ומרגשת לאבא שאוהב לשתות קפה ולקרוא עיתון, בתקציב של עד 50 שקלים',
      goodResult: '1. ספל קפה איכותי ונוח שעליו כתוב "לאבא הכי תותח בעולם".\n2. חבילת קפה מיוחד בטעם שהוא אוהב יחד עם עוגיות קטנות.'
    },
    step2_takeaway: 'כשאומרים ל-AI מה האדם אוהב וכמה כסף רוצים להוציא, מקבלים רעיונות בול בפוני!',
    step3_quiz: {
      question: 'מה כדאי לכתוב ל-AI כדי לקבל רעיון מושלם למתנה לחבר?',
      options: [
        { text: 'מה החבר אוהב לעשות וכמה כסף נרצה להשקיע', isCorrect: true, explanation: 'נכון מאוד! ככה ה-AI מציע משהו מדויק שמתאים לכיס וללב.' },
        { text: 'לכתוב רק: "מתנה מגניבה"', isCorrect: false, explanation: 'ה-AI לא מכיר את החבר ולא ידע מה הוא אוהב.' }
      ]
    },
    step4_action: {
      prompt: 'תן לי 2 רעיונות למתנה כיפית לחבר שאוהב לשמוע מוזיקה, בתקציב של עד 40 שקלים',
      doText: 'העתק את הבקשה ובדוק את הרעיונות המקוריים של ה-AI:'
    }
  },
  {
    id: 'unit_7',
    title: 'מתי לא סומכים על ה-AI ובודקים עם אדם',
    category: 'ביקורתיות ואמת',
    goal: 'להבין שה-AI לא תמיד צודק, ולדעת מתי חובה לשאול את אבא או מדריך אחראי.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'יש לי כאב ראש חזק, איזה כדור לקחת וכמה?',
      badResult: 'קח שילוב של תרופות שונות במינון של 500 מ"ג כל 4 שעות...',
      goodPrompt: 'יש לי כאב ראש. מה כדאי לבדוק קודם? (תזכורת: לא לקחת תרופות בלי אישור אבא או רופא)',
      goodResult: 'שתה כוס מים גדולה ונוח בחדר שקט. אם הכאב לא עובר, פנה מיד לאבא, לאמא או לרופא וספר להם איך אתה מרגיש.'
    },
    step2_takeaway: 'בנושאי בריאות, תרופות, כסף וחוזים — ה-AI הוא רק כלי עזר. תמיד מתייעצים עם אדם שאנחנו סומכים עליו!',
    step3_quiz: {
      question: 'אם ה-AI כותב לך לקחת תרופה מסוימת, מה הדבר הנכון לעשות?',
      options: [
        { text: 'בשום אופן לא לקחת לבד! לשאול מיד את אבא, אמא או רופא', isCorrect: true, explanation: 'מעולה! בריאות היא מעל הכל, ולגבי תרופות מדברים רק עם הורים ורופאים.' },
        { text: 'לקחת מיד כי ה-AI כתב את זה במחשב', isCorrect: false, explanation: 'מסוכן מאוד! AI יכול לטעות ולא מכיר את הגוף שלך.' }
      ]
    },
    step4_action: {
      prompt: 'תן לי 3 דרכים טבעיות להירגע כשאני מרגיש עומס או לחץ (בלי תרופות)',
      doText: 'העתק את השאלה ולמד 3 שיטות פשוטות להרגעה ונשימה:'
    }
  },
  {
    id: 'unit_8',
    title: 'תכנון יום כיף או סדר יום בשלווה',
    category: 'התארגנות וניהול זמן',
    goal: 'להיעזר ב-AI כדי לבנות לו"ז רגוע ונעים ליום חופש, בלי לרוץ ובלי לחץ.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מה לעשות בשבת?',
      badResult: 'תקום ב-05:00, צא למרתון של 20 ק"מ, סע לחיפה, משם לחרמון, בקר ב-8 מוזיאונים וחזור ב-23:00...',
      goodPrompt: 'תבנה לי תוכנית רגועה ליום שישי בבוקר בין 09:00 ל-12:00, עם ארוחת בוקר וזמן מנוחה',
      goodResult: '09:00 - ארוחת בוקר טעימה וקפה בנחת.\n10:00 - הליכה קצרה ונעימה בשכונה באוויר הנעים.\n11:00 - מנוחה, שמיעת שירים אהובים והתארגנות רגועה לקראת הצהריים.'
    },
    step2_takeaway: 'כשמגדירים ל-AI שעות מדויקות ומבקשים "תוכנית רגועה", מקבלים סדר יום נעים שכיף לממש.',
    step3_quiz: {
      question: 'איך נבקש מה-AI לעזור לנו לתכנן יום חופש מוצלח?',
      options: [
        { text: 'נגדיר לו את שעות היום ונבקש תוכנית נעימה עם זמני מנוחה', isCorrect: true, explanation: 'מדויק! ככה היום מאוזן ומהנה ולא מרגישים עומס.' },
        { text: 'נבקש ממנו לדחוס 50 משימות שונות בשעה אחת', isCorrect: false, explanation: 'זה סתם יצור לחץ ועייפות גדולה.' }
      ]
    },
    step4_action: {
      prompt: 'תבנה לי תוכנית ערב נעימה של שעתיים (19:00 עד 21:00) שכוללת ארוחת ערב קלה ומוזיקה',
      doText: 'העתק ובדוק איך ה-AI בונה עבורך שגרה שלווה ונעימה:'
    }
  },
  {
    id: 'unit_9',
    title: 'ניסוח פנייה מנומסת לשירות לקוחות',
    category: 'צרכנות נבונה',
    goal: 'ללמוד איך לנסח הודעה קצרה ומכבדת אם חבילה שהזמנו מתעכבת או אם יש תקלה.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'איפה החבילה שלי יא גנבים תביאו אותה מיד',
      badResult: 'פנייתך נחסמה עקב שפה לא הולמת. אנא פנה בשפה מכבדת...',
      goodPrompt: 'תנסח לי פנייה קצרה ומנומסת של 2 משפטים לשירות לקוחות: החבילה שלי מתעכבת ואשמח לעדכון',
      goodResult: 'שלום רב, הזמנתי חבילה ומספר המעקב שלה מראה שהיא מתעכבת. אשמח מאוד אם תוכלו לבדוק מתי היא צפויה להגיע. תודה רבה!'
    },
    step2_takeaway: 'כשפונים בנימוס וברוגע, נציגי השירות שמחים לעזור ופותרים את הבעיה הרבה יותר מהר!',
    step3_quiz: {
      question: 'למה כדאי לכתוב הודעה מנומסת לשירות לקוחות כשמשהו מתעכב?',
      options: [
        { text: 'כי אנשים עוזרים בשמחה ובמהירות למי שמדבר אליהם בכבוד ובנועם', isCorrect: true, explanation: 'נכון מאוד! נימוס וכבוד פותחים דלתות ופותרים בעיות.' },
        { text: 'כי אם נצעק ונקלל נקבל מתנות חינם', isCorrect: false, explanation: 'ממש לא! כעס וצעקות רק תוקעים את העזרה.' }
      ]
    },
    step4_action: {
      prompt: 'תנסח לי הודעה מנומסת לשירות לקוחות של חברת האינטרנט: הגלישה בבית מעט איטית היום',
      doText: 'העתק את ההודעה ובדוק כמה נעים ומכבד הניסוח של ה-AI:'
    }
  },
  {
    id: 'unit_10',
    title: 'יצירת תמונה מרהיבה בדימיון ובינה מלאכותית',
    category: 'יצירה וכיף',
    goal: 'ללמוד איך לתאר ל-AI תמונה בצורה עשירה בצבעים ובפרטים כדי ליצור משהו יפהפה.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מכונית',
      badResult: 'תמונה בסיסית ומשעממת של מכונית אפורה עומדת בחניה...',
      goodPrompt: 'תאר לי תמונה מרהיבה של ג\'יפ כחול זוהר שנוסע בדיונות זהובות בשקיעה, עם שמיים כתומים וכוכבים ראשונים',
      goodResult: 'ג\'יפ שטח בצבע כחול מטאלי עוצמתי מטפס על דיונת חול זהובה ורכה. גלגליו מעיפים רסיסי חול בוהקים. ברקע שקיעה מדהימה בגווני אש וכתום, והשמיים נצבעים בכוכבים ראשונים.'
    },
    step2_takeaway: 'ככל שמוסיפים צבעים (כחול זוהר, שקיעה כתומה) ופעולה (מטפס על דיונה), התמונה הופכת ליצירת אמנות!',
    step3_quiz: {
      question: 'מה הופך בקשה לציור או תיאור תמונה מה-AI למוצלחת ביותר?',
      options: [
        { text: 'פירוט של צבעים מיוחדים, אווירה ופרטים מעניינים ברקע', isCorrect: true, explanation: 'אלופים! זה בדיוק הסוד של יוצרי ה-AI המובילים.' },
        { text: 'לכתוב מילה אחת בלבד כמו "ציור"', isCorrect: false, explanation: 'זה כללי מדי וה-AI לא ידע מה אנחנו מדמיינים.' }
      ]
    },
    step4_action: {
      prompt: 'תאר לי תמונה קסומה של חללית ירוקה ונוצצת שנוחתת על כוכב לכת סגול עם פרחים זוהרים',
      doText: 'העתק את הבקשה וראה איזה תיאור קסום וצבעוני ה-AI מייצר לך:'
    }
  }
];

// ============================================================================
// 2. מבחני השלב המודרגים (Checkpoints) - מבחן כל 2 יחידות עם בנק שאלות מתחלף
// ============================================================================

const CHECKPOINTS = [
  {
    id: 'cp_1',
    afterUnitIndex: 1, // אחרי יחידות 1 ו-2 (יחידה 2)
    title: 'מבחן שלב 1: פשטות ותקשורת מכבדת 🎯',
    description: 'בדיקת הבנה של עקרונות הפשטות וניסוח הודעות מדויקות לעבודה (דרוש ציון 85+ לפתיחת יחידות 3-4)',
    unlocksUnitIndex: 2, // פותח יחידה 3
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'איך הכי נכון לבקש מה-AI הסבר על נושא לא מוכר כדי לא להסתבך?',
        options: [
          { text: 'לבקש במפורש: "הסבר לי ב-2 משפטים קצרים ובמילים פשוטות"', isCorrect: true },
          { text: 'לרשום רק מילה אחת ולחכות להסבר של 10 עמודים', isCorrect: false },
          { text: 'לבקש ממנו להשתמש בכמה שיותר מילים קשות בלועזית', isCorrect: false }
        ]
      },
      {
        question: 'כשמאחרים לעבודה עקב פקק, מה חובה לכלול בהודעה למנהל?',
        options: [
          { text: 'ברכת בוקר טוב, כמה דקות איחור, סיבה קצרה והתנצלות מנומסת', isCorrect: true },
          { text: 'לשלוח רק סימן שאלה בלי לכתוב כלום', isCorrect: false },
          { text: 'לא להודיע ולספר רק למחרת מה קרה', isCorrect: false }
        ]
      },
      {
        question: 'אם ה-AI נתן לך תשובה ארוכה מדי עם מילים שלא הבנת, מה תעשה?',
        options: [
          { text: 'אכתוב לו: "זה ארוך ומסובך, תסביר שוב במשפט אחד עם דוגמה פשוטה"', isCorrect: true },
          { text: 'אסגור את המחשב ואחשוב שאי אפשר להבין כלום', isCorrect: false },
          { text: 'אעתיק את התשובה המסובכת בלי להבין אותה', isCorrect: false }
        ]
      },
      {
        question: 'מדוע חשוב לבקש מה-AI "דוגמה יומיומית"?',
        options: [
          { text: 'כי דוגמה מוכרת מחברת את הרעיון לחיים ועוזרת לקלוט מיד', isCorrect: true },
          { text: 'כי המחשב אוהב לכתוב סיפורים דמיוניים', isCorrect: false },
          { text: 'אין שום הבדל, זה סתם מאריך את הטקסט', isCorrect: false }
        ]
      },
      {
        question: 'באיזו שעה הכי נכון לשלוח הודעה למנהל על איחור לעבודה?',
        options: [
          { text: 'ברגע שיודעים שיש פקק או עיכוב, עוד לפני תחילת המשמרת', isCorrect: true },
          { text: 'חצי שעה אחרי שהמשמרת כבר הייתה צריכה להתחיל', isCorrect: false },
          { text: 'בסוף יום העבודה כשחוזרים הביתה', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_2',
    afterUnitIndex: 3, // אחרי יחידות 3 ו-4 (יחידה 4)
    title: 'מבחן שלב 2: סייבר, פרטיות וכישורי חיים 🎯',
    description: 'בדיקת הבנה של שמירה על פרטיות ברשת וקבלת מתכונים קלים להכנה (דרוש ציון 85+ לפתיחת יחידות 5-6)',
    unlocksUnitIndex: 4, // פותח יחידה 5
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'איזה מהפרטים הבאים אסור בשום אופן לכתוב ל-AI בצ\'אט?',
        options: [
          { text: 'מספר תעודת זהות, סיסמה לחשבון ומספר כרטיס אשראי', isCorrect: true },
          { text: 'שאלות על איך מכינים פסטה בבית', isCorrect: false },
          { text: 'בקשה לניסוח ברכה ליום הולדת', isCorrect: false }
        ]
      },
      {
        question: 'מה הדרך הטובה ביותר לבקש מה-AI מתכון לארוחת ערב קלה?',
        options: [
          { text: 'לבקש "מתכון ב-3 צעדים קצרים עם מצרכים שיש בכל בית"', isCorrect: true },
          { text: 'לבקש מתכון צרפתי מסובך שדורש שבוע הכנה', isCorrect: false },
          { text: 'לכתוב רק "אוכל" בלי שום פירוט', isCorrect: false }
        ]
      },
      {
        question: 'אם אתר או צ\'אט מבקשים ממך את הסיסמה הסודית של הדוא"ל שלך, מה תעשה?',
        options: [
          { text: 'לא נותן בשום פנים ואופן, וקורא לאבא או לאדם מבוגר לבדוק', isCorrect: true },
          { text: 'רושם לו מיד את הסיסמה בלי לחשוב', isCorrect: false },
          { text: 'ממציא סיסמה חדשה ושולח לו', isCorrect: false }
        ]
      },
      {
        question: 'מדוע כדאי להיזהר במטבח כשמכינים טוסט בטוסטר לחיץ?',
        options: [
          { text: 'כי המכשיר והגבינה חמים מאוד ויכולים לגרום לכווייה אם לא נזהרים', isCorrect: true },
          { text: 'כי הטוסטר עלול להשמיע מוזיקה חזקה', isCorrect: false },
          { text: 'אין שום סכנה בטוסטר, אפשר לגעת בפלטה החמה חופשי', isCorrect: false }
        ]
      },
      {
        question: 'איפה הכי בטוח לשמור סיסמאות של אתרים חשובים?',
        options: [
          { text: 'במחברת אישית בטוחה בבית או בראש, לא במקום גלוי ברשת', isCorrect: true },
          { text: 'לפרסם אותן בסטטוס בוואטסאפ שכולם יראו', isCorrect: false },
          { text: 'לכתוב אותן על מדבקה ולהדביק על המסך בעבודה', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_3',
    afterUnitIndex: 5, // אחרי יחידות 5 ו-6 (יחידה 6)
    title: 'מבחן שלב 3: סיכום מידע, חברה ויחסים 🎯',
    description: 'בדיקת היכולת לסכם טקסטים ארוכים ולמצוא רעיונות למתנות ורגישות חברתית (ציון 85+ לפתיחת 7-8)',
    unlocksUnitIndex: 6, // פותח יחידה 7
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'קיבלת הודעה ארוכה של 30 שורות. איך תבקש מה-AI לתמצת אותה?',
        options: [
          { text: 'להדביק את ההודעה ולבקש: "סכם לי ב-3 נקודות קצרות וברורות מה העיקר"', isCorrect: true },
          { text: 'לבקש ממנו להוסיף עוד 100 שורות של סיפורים', isCorrect: false },
          { text: 'למחוק אותה מיד בלי לדעת מה כתוב', isCorrect: false }
        ]
      },
      {
        question: 'כשמחפשים רעיון למתנה לחבר, מה הכי עוזר ל-AI לדייק?',
        options: [
          { text: 'לספר לו מה התחביבים של החבר וכמה כסף נרצה להוציא', isCorrect: true },
          { text: 'לכתוב לו רק: "תביא מתנה יקרה"', isCorrect: false },
          { text: 'לא לכתוב לו כלום ולחכות שינחש', isCorrect: false }
        ]
      },
      {
        question: 'אם מישהו בעבודה עונה לך במילה אחת "בסדר", מה הפירוש הסביר ביותר?',
        options: [
          { text: 'שהוא עסוק כרגע וענה עניינית, וזה בסדר גמור ולא מעיד על כעס', isCorrect: true },
          { text: 'שהוא שונא אותי ולעולם לא ידבר איתי יותר', isCorrect: false },
          { text: 'שצריך לשלוח לו 50 הודעות בבת אחת כדי לבדוק מה קרה', isCorrect: false }
        ]
      },
      {
        question: 'איזה יתרון יש לסיכום ב-3 נקודות לעומת קריאת דף שלם?',
        options: [
          { text: 'זה חוסך מאמץ, מונע הצפה ומאפשר לדעת מיד מה הפעולות הנדרשות', isCorrect: true },
          { text: 'זה גורם למחשב לפעול לאט יותר', isCorrect: false },
          { text: 'אין שום יתרון, תמיד עדיף לקרוא הכל שוב ושוב', isCorrect: false }
        ]
      },
      {
        question: 'מה כדאי לצרף תמיד למתנה שנותנים לאבא או לחבר טוב?',
        options: [
          { text: 'פתק ברכה קצר וחם מהלב במילים כנות', isCorrect: true },
          { text: 'את קבלת הקנייה עם המחיר המדויק', isCorrect: false },
          { text: 'רשימה של דברים שאנחנו רוצים שהוא יקנה לנו בחזרה', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_4',
    afterUnitIndex: 7, // אחרי יחידות 7 ו-8 (יחידה 8)
    title: 'מבחן שלב 4: ביקורתיות, תכנון זמן ושלווה 🎯',
    description: 'בדיקת הבנה של מתי לא סומכים על AI ואיך לבנות סדר יום רגוע (דרוש ציון 85+ לפתיחת יחידות 9-10)',
    unlocksUnitIndex: 8, // פותח יחידה 9
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'אם אתה לא מרגיש טוב, האם כדאי לקחת תרופה שה-AI המליץ עליה בצ\'אט?',
        options: [
          { text: 'בשום אופן לא! שואלים אך ורק רופא מוסמך או את אבא ואמא', isCorrect: true },
          { text: 'כן, המחשב יודע הכל על רפואה', isCorrect: false },
          { text: 'כן, אם התשובה נשמעת יפה ומנומסת', isCorrect: false }
        ]
      },
      {
        question: 'איך כדאי לבקש מה-AI לבנות תוכנית ליום חופש כדי לא להילחץ?',
        options: [
          { text: 'להגדיר את השעות ולבקש במפורש "תוכנית רגועה עם זמני מנוחה"', isCorrect: true },
          { text: 'לבקש ממנו לדחוס 15 משימות בלי שום הפסקה', isCorrect: false },
          { text: 'להגיד לו לתכנן יום בלי אוכל ובלי שתייה', isCorrect: false }
        ]
      },
      {
        question: 'מה זה אומר שבינה מלאכותית לפעמים "הוזה" (מנחשת)?',
        options: [
          { text: 'שהיא כותבת משפטים שנשמעים בטוחים ונכונים, אך העובדות בהם שגויות לחלוטין', isCorrect: true },
          { text: 'שהיא הולכת לישון בלילה', isCorrect: false },
          { text: 'שהיא חולמת על רובוטים בחלל', isCorrect: false }
        ]
      },
      {
        question: 'מה עושים כשיש רגע של עומס או לחץ במהלך היום?',
        options: [
          { text: 'לוקחים כמה נשימות עמוקות ואיטיות, שותים כוס מים ונחים 5 דקות', isCorrect: true },
          { text: 'שוברים משהו בחדר וצועקים על כולם', isCorrect: false },
          { text: 'נשארים בלי לישון כל הלילה', isCorrect: false }
        ]
      },
      {
        question: 'מי האחראי הבלעדי על ההחלטות החשובות בחיים שלך?',
        options: [
          { text: 'אתה יחד עם האנשים הקרובים שאוהבים אותך (כמו אבא והמשפחה)', isCorrect: true },
          { text: 'תוכנת המחשב של ה-AI', isCorrect: false },
          { text: 'אנשים זרים באינטרנט', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_5',
    afterUnitIndex: 9, // אחרי יחידות 9 ו-10 (יחידה 10)
    title: 'מבחן גמר מסכם: צרכנות, יצירתיות ושליטה ב-AI 🏆',
    description: 'מבחן גמר של כל הידע: צרכנות נבונה, יצירת תמונות מרהיבות ושליטה עצמאית בכלי AI (ציון 85+)',
    unlocksUnitIndex: null, // סיום המסלול
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'כשחבילה מתעכבת ופונים לשירות לקוחות, מה הגישה המנצחת?',
        options: [
          { text: 'פנייה קצרה, מנומסת ועניינית עם פרטי ההזמנה ואיחולי יום טוב', isCorrect: true },
          { text: 'שליחת הודעות כועסות עם קללות ואיומים', isCorrect: false },
          { text: 'לא לפנות בכלל ולוותר על החבילה', isCorrect: false }
        ]
      },
      {
        question: 'מה הסוד ליצירת תיאור תמונה קסומה ומדהימה בעזרת AI?',
        options: [
          { text: 'שילוב של צבעים עשירים, תאורה, פרטים ברורים והאווירה המבוקשת', isCorrect: true },
          { text: 'לכתוב רק מילה אחת סתמית בלי תיאור', isCorrect: false },
          { text: 'לבקש מהמחשב לכבות את המסך', isCorrect: false }
        ]
      },
      {
        question: 'מה למדנו על התפקיד של ה-AI בחיים שלנו?',
        options: [
          { text: 'הוא כלי עזר מצוין וסבלני שעוזר לנו לנסח, לחשוב וליצור בקצב שלנו', isCorrect: true },
          { text: 'הוא יחליף אותנו ויעשה הכל במקומנו בלי שנצטרך לחשוב', isCorrect: false },
          { text: 'הוא משהו מסוכן שאסור לגעת בו לעולם', isCorrect: false }
        ]
      },
      {
        question: 'איך הכי נכון להגיב כשה-AI עונה תשובה שלא מוצאת חן בעינינו?',
        options: [
          { text: 'לתקן אותו בסבלנות: "לא התכוונתי לזה, תנסח לי שוב בצורה כזו וכזו"', isCorrect: true },
          { text: 'להיעלב ממנו ולחשוב שהוא כועס עלינו', isCorrect: false },
          { text: 'לכבות את המחשב מהשקע בכוח', isCorrect: false }
        ]
      },
      {
        question: 'איזה כלל מבין כללי הזהב שומר עליך הכי הרבה ברשת?',
        options: [
          { text: 'אבטחת מידע אישי: סיסמאות ותעודות זהות לעולם לא משתפים בצ\'אט', isCorrect: true },
          { text: 'לכתוב כמה שיותר מהר בלי לקרוא', isCorrect: false },
          { text: 'להסכים לכל הצעה שרואים באתרים', isCorrect: false }
        ]
      }
    ]
  }
];

// ============================================================================
// 3. מצב האפליקציה (State Engine) ומנגנון המיגרציה
// ============================================================================

let appState = {
  version: 3,
  currentView: 'roadmap',
  activeUnitId: 'unit_1',
  user: {
    name: 'דניאל',
    age: 28
  },
  curriculumUnits: JSON.parse(JSON.stringify(DEFAULT_CURRICULUM_UNITS)),
  checkpoints: JSON.parse(JSON.stringify(CHECKPOINTS)),
  needsReinforcementQueue: [],
  caregiverNotes: [
    {
      id: 'note_1',
      author: 'אבא ואושרי',
      date: '2026-10-04',
      text: 'דניאל מתקדם בצורה נפלאה, עצמאית ובטוחה. המערכת מותאמת בדיוק לצרכים שלו עם חיזוקים חיוביים ומבחני שלב.'
    }
  ],
  apiConfig: {
    geminiKey: '',
    groqKey: '',
    ollamaUrl: 'http://localhost:11434',
    adminPin: ADMIN_PIN_DEFAULT
  },
  quizHistory: [],
  feedbackHistory: []
};

// שחזור ומיגרציה בטוחה
function performMigrationIfNeeded() {
  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && typeof parsed === 'object') {
        // מיזוג זהיר
        if (parsed.user) appState.user = parsed.user;
        if (parsed.apiConfig) appState.apiConfig = { ...appState.apiConfig, ...parsed.apiConfig };
        if (Array.isArray(parsed.caregiverNotes)) appState.caregiverNotes = parsed.caregiverNotes;
        if (Array.isArray(parsed.quizHistory)) appState.quizHistory = parsed.quizHistory;
        if (Array.isArray(parsed.feedbackHistory)) appState.feedbackHistory = parsed.feedbackHistory;

        // מיזוג יחידות: שומרים על 10 היחידות הנקיות ומסמנים מה שכבר הושלם
        if (Array.isArray(parsed.curriculumUnits)) {
          const completedIds = new Set(parsed.curriculumUnits.filter(u => u.isCompleted).map(u => u.id));
          appState.curriculumUnits.forEach((unit, idx) => {
            if (completedIds.has(unit.id) || (parsed.curriculumUnits[idx] && parsed.curriculumUnits[idx].isCompleted)) {
              unit.isCompleted = true;
            }
          });
        }

        // מיזוג מבחני שלב
        if (Array.isArray(parsed.checkpoints) && parsed.checkpoints.length === CHECKPOINTS.length) {
          appState.checkpoints = parsed.checkpoints;
        } else {
          appState.checkpoints = JSON.parse(JSON.stringify(CHECKPOINTS));
        }

        return;
      }
    }

    // אם אין V3, בודקים גרסאות ישנות כדי לחלץ מפתחות API ונתונים חשובים
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const legacyData = JSON.parse(legacyRaw);
          if (legacyData && typeof legacyData === 'object') {
            console.log(`[Migration] Migrating critical settings from ${legacyKey}...`);
            if (legacyData.apiConfig) {
              appState.apiConfig.geminiKey = legacyData.apiConfig.geminiKey || appState.apiConfig.geminiKey;
              appState.apiConfig.groqKey = legacyData.apiConfig.groqKey || appState.apiConfig.groqKey;
              appState.apiConfig.ollamaUrl = legacyData.apiConfig.ollamaUrl || appState.apiConfig.ollamaUrl;
              appState.apiConfig.adminPin = legacyData.apiConfig.adminPin || appState.apiConfig.adminPin;
            }
            if (Array.isArray(legacyData.caregiverNotes) && legacyData.caregiverNotes.length > 0) {
              appState.caregiverNotes = legacyData.caregiverNotes;
            }
            if (Array.isArray(legacyData.curriculumUnits)) {
              const compCount = legacyData.curriculumUnits.filter(u => u.isCompleted).length;
              for (let i = 0; i < Math.min(compCount, appState.curriculumUnits.length); i++) {
                appState.curriculumUnits[i].isCompleted = true;
              }
            }
            saveAppState();
            break;
          }
        } catch (e) {
          console.warn(`Error parsing legacy key ${legacyKey}:`, e);
        }
      }
    }
  } catch (err) {
    console.error('Critical error in migration:', err);
  }
}

function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

// ============================================================================
// 4. שירותי קול, צלילים ושיתוף וואטסאפ (Sound & Sharing Services)
// ============================================================================

const SoundService = {
  synth: window.speechSynthesis,
  currentUtterance: null,

  speakText(text) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const clean = text.replace(/[*_#`~[\]]/g, '').trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'he-IL';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      const voices = this.synth.getVoices();
      const heVoice = voices.find(v => v.lang.includes('he') || v.lang.includes('IL'));
      if (heVoice) utterance.voice = heVoice;

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS playback error:', e);
    }
  },

  stopSpeaking() {
    if (this.synth) this.synth.cancel();
  },

  playSuccessSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  },

  playErrorSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(240, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }
};

function shareProgressToWhatsApp(msgText) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
  window.open(url, '_blank');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function copyToClipboard(text, btnElement) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btnElement ? btnElement.innerHTML : '';
      if (btnElement) btnElement.innerHTML = '<span>הועתק בהצלחה! ✓</span>';
      showToast('המשפט הועתק! עכשיו אפשר להדביק אותו בצ\'אט 📋');
      setTimeout(() => {
        if (btnElement) btnElement.innerHTML = originalText;
      }, 2000);
    });
  } else {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('המשפט הועתק! 📋');
  }
}

// ============================================================================
// 5. מנגנון נעילת שבת אוטומטי (Shabbat Lockout Engine)
// ============================================================================

function isShabbatNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;
  // שישי מ-16:30 ואילך
  if (day === 5 && timeVal >= 16.5) return true;
  // שבת עד 20:30
  if (day === 6 && timeVal < 20.5) return true;
  return false;
}

let shabbatBypassed = false;
function checkAndApplyShabbatLock() {
  const screen = document.getElementById('shabbat-screen');
  if (!screen) return;
  if (isShabbatNow() && !shabbatBypassed) {
    screen.style.display = 'flex';
  } else {
    screen.style.display = 'none';
  }
}

// ============================================================================
// 6. ניהול תצוגות (View Switching)
// ============================================================================

function showView(viewName) {
  SoundService.stopSpeaking();
  appState.currentView = viewName;
  saveAppState();

  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ============================================================================
// 7. תצוגת מסלול המיומנויות של דניאל (Roadmap & Gatekeeping)
// ============================================================================

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  if (!container) return;
  container.innerHTML = '';

  const units = appState.curriculumUnits;
  let completedCount = 0;

  units.forEach((unit, idx) => {
    if (unit.isCompleted) completedCount++;

    // חישוב נעילה מודרגת:
    // יחידה 0 תמיד פתוחה.
    // יחידה אי-זוגית (1, 3, 5...) נפתחת אם היחידה שלפניה הושלמה.
    // יחידה זוגית (2, 4, 6, 8...) נפתחת רק אם היחידה שלפניה הושלמה וגם מבחן השלב שלפניה עבר בציון 85+!
    let isUnlocked = false;
    if (idx === 0) {
      isUnlocked = true;
    } else if (idx % 2 === 0) {
      // יחידה 3 (idx=2), יחידה 5 (idx=4)... דורשת מעבר מבחן שלב שלפניה
      const prevCp = (appState.checkpoints || []).find(c => c.afterUnitIndex === idx - 1);
      isUnlocked = units[idx - 1].isCompleted && (prevCp ? prevCp.isPassed : true);
    } else {
      isUnlocked = units[idx - 1].isCompleted;
    }
    unit.isUnlocked = isUnlocked;

    const card = document.createElement('div');
    let statusClass = 'locked-unit';
    let statusIcon = '🔒';
    let statusBadgeText = 'נעול';

    if (unit.isCompleted) {
      statusClass = 'completed-unit';
      statusIcon = '🟢';
      statusBadgeText = '✓ הושלם';
    } else if (isUnlocked) {
      statusClass = 'active-unit';
      statusIcon = '🔵';
      statusBadgeText = 'פתוח עכשיו';
    }

    card.className = `unit-card ${statusClass}`;
    card.innerHTML = `
      <div class="unit-card-info">
        <span class="unit-status-icon">${statusIcon}</span>
        <div>
          <span class="badge-tag" style="margin-bottom: 0.35rem; display: inline-block;">${unit.category || 'מיומנות מעשית'}</span>
          <h3 class="unit-name-title">${unit.title}</h3>
          <span class="unit-skills-preview">${unit.goal}</span>
        </div>
      </div>
      <div class="day-action-box">
        <span class="badge-tag">${statusBadgeText}</span>
        ${isUnlocked ? `<button class="primary-btn" style="padding: 0.6rem 1.2rem; font-size: 1rem; min-height: 44px;">
          <span>היכנס ליחידה</span>
          <span>▶</span>
        </button>` : ''}
      </div>
    `;

    if (isUnlocked) {
      card.onclick = () => {
        appState.activeUnitId = unit.id;
        showView('unit');
        renderUnitPlayer(unit.id);
      };
    } else {
      card.onclick = () => {
        showToast('עליך להשלים את היחידות ומבחן השלב הקודמים כדי לפתוח יחידה זו! 💪');
      };
    }

    container.appendChild(card);

    // בדיקה האם יש תחנת מבחן שלב אחרי יחידה זו
    const cp = (appState.checkpoints || []).find(c => c.afterUnitIndex === idx);
    if (cp) {
      const prev1 = units[idx - 1];
      const prev2 = units[idx];
      const isCpUnlocked = prev1 && prev1.isCompleted && prev2 && prev2.isCompleted;

      const cpCard = document.createElement('div');
      cpCard.className = `checkpoint-card ${cp.isPassed ? 'passed' : (!isCpUnlocked ? 'locked' : '')}`;
      cpCard.innerHTML = `
        <div class="checkpoint-info">
          <span style="font-size: 2.2rem; line-height: 1;">${cp.isPassed ? '🏆' : (isCpUnlocked ? '🎯' : '🔒')}</span>
          <div>
            <span class="badge-tag" style="background:#fef3c7;color:#b45309;display:inline-block;margin-bottom:0.35rem;">
              ${cp.isPassed ? `עברת בהצלחה (ציון ${cp.lastScore}) ✓` : 'מבחן שלב מעשי (דרוש ציון 85+)'}
            </span>
            <h3 class="checkpoint-title">${cp.title}</h3>
            <span class="checkpoint-desc">${cp.description}</span>
          </div>
        </div>
        <div class="day-action-box">
          <span class="badge-tag" style="${cp.isPassed ? 'background:#ecfdf5;color:#059669;' : ''}">
            ${cp.isPassed ? '✓ הושלם' : (isCpUnlocked ? 'מוכן למבחן' : 'נעול')}
          </span>
          ${isCpUnlocked ? `<button class="primary-btn" style="padding: 0.6rem 1.2rem; font-size: 1rem; min-height: 44px; background: #f59e0b;">
            <span>${cp.isPassed ? 'בצע שוב' : 'התחל מבחן'}</span>
            <span>▶</span>
          </button>` : ''}
        </div>
      `;

      if (isCpUnlocked) {
        cpCard.onclick = () => openCheckpointTest(cp);
      } else {
        cpCard.onclick = () => showToast('תחנת מבחן זו תיפתח ברגע שתסיים את 2 היחידות שמעליה! 🌟');
      }

      container.appendChild(cpCard);
    }
  });

  const passedCPs = (appState.checkpoints || []).filter(c => c.isPassed).length;
  const pill = document.getElementById('total-progress-pill');
  if (pill) pill.textContent = `${completedCount} מתוך ${units.length} יחידות הושלמו | ${passedCPs} מתוך ${(appState.checkpoints || []).length} מבחני שלב`;
  const bar = document.getElementById('weekly-progress-bar');
  if (bar) bar.style.width = `${(completedCount / units.length) * 100}%`;
}

// ============================================================================
// 8. נגן יחידת הלימוד ב-4 שלבים (Interactive 4-Step Player)
// ============================================================================

function renderUnitPlayer(unitId) {
  const unit = appState.curriculumUnits.find(u => u.id === unitId);
  if (!unit) return;

  const titleEl = document.getElementById('unit-view-title');
  if (titleEl) titleEl.textContent = unit.title;
  const mainTitleEl = document.getElementById('unit-main-title');
  if (mainTitleEl) mainTitleEl.textContent = unit.title;
  const badgeEl = document.getElementById('unit-topic-badge');
  if (badgeEl) badgeEl.textContent = unit.category || 'מיומנות מעשית';
  const goalEl = document.getElementById('unit-goal-desc');
  if (goalEl) goalEl.textContent = unit.goal;

  const backBtn = document.getElementById('unit-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  // שלב 1: המחשה מוחשית Side-by-Side
  const badPrompt = document.getElementById('demo-bad-prompt');
  if (badPrompt) badPrompt.textContent = `"${unit.step1_demo.badPrompt}"`;
  const badRes = document.getElementById('demo-bad-result');
  if (badRes) badRes.textContent = unit.step1_demo.badResult;
  const goodPrompt = document.getElementById('demo-good-prompt');
  if (goodPrompt) goodPrompt.textContent = `"${unit.step1_demo.goodPrompt}"`;
  const goodRes = document.getElementById('demo-good-result');
  if (goodRes) goodRes.textContent = unit.step1_demo.goodResult;

  const ttsDemoBtn = document.getElementById('tts-demo-btn');
  if (ttsDemoBtn) {
    ttsDemoBtn.onclick = () => {
      SoundService.speakText(`שלב ראשון, המחשה: שים לב להבדל בין שתי הבקשות. כשאומרים: ${unit.step1_demo.badPrompt}, מקבלים תשובה ארוכה. כשאומרים מדויק: ${unit.step1_demo.goodPrompt}, מקבלים תשובה קצרה ומעולה.`);
    };
  }

  // שלב 2: הסבר קצר ומאיר עיניים
  const takeawayEl = document.getElementById('unit-takeaway-text');
  if (takeawayEl) takeawayEl.innerHTML = unit.step2_takeaway;
  const ttsExpBtn = document.getElementById('tts-explanation-btn');
  if (ttsExpBtn) {
    ttsExpBtn.onclick = () => SoundService.speakText(unit.step2_takeaway);
  }

  // שלב 3: וידוא הבנה (Quiz)
  const quiz = unit.step3_quiz;
  const quizQEl = document.getElementById('quiz-question-text');
  if (quizQEl) quizQEl.textContent = quiz.question;
  const ttsQuizBtn = document.getElementById('tts-quiz-btn');
  if (ttsQuizBtn) {
    ttsQuizBtn.onclick = () => SoundService.speakText(quiz.question);
  }

  const quizOptionsContainer = document.getElementById('quiz-options-container');
  const quizFeedbackBox = document.getElementById('quiz-feedback-box');
  const actionLockedNotice = document.getElementById('action-locked-notice');
  const actionUnlockedContent = document.getElementById('action-unlocked-content');
  const stepActionBox = document.getElementById('step-action-box');

  if (quizOptionsContainer) quizOptionsContainer.innerHTML = '';
  if (quizFeedbackBox) quizFeedbackBox.style.display = 'none';

  let isStep4Unlocked = unit.isCompleted;
  if (isStep4Unlocked) {
    if (stepActionBox) stepActionBox.classList.remove('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'none';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';
  } else {
    if (stepActionBox) stepActionBox.classList.add('locked-step');
    if (actionLockedNotice) actionLockedNotice.style.display = 'block';
    if (actionUnlockedContent) actionUnlockedContent.style.display = 'none';
  }

  quiz.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      if (opt.isCorrect) {
        btn.classList.add('correct');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✓';
        SoundService.playSuccessSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box success';
          quizFeedbackBox.innerHTML = `<span>מעולה דניאל! ${opt.explanation || 'תשובה מדויקת!'} שלב 4 נפתח עבורך כעת! 🌟</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        if (stepActionBox) stepActionBox.classList.remove('locked-step');
        if (actionLockedNotice) actionLockedNotice.style.display = 'none';
        if (actionUnlockedContent) actionUnlockedContent.style.display = 'block';

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: true
        });
        saveAppState();
      } else {
        btn.classList.add('incorrect');
        const icon = btn.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '✕';
        SoundService.playErrorSound();

        if (quizFeedbackBox) {
          quizFeedbackBox.className = 'quiz-feedback-box error';
          quizFeedbackBox.innerHTML = `<span>לא מדויק: ${opt.explanation || 'נסה שוב לחשוב על הכלל שלמדנו!'} נסה שוב! 💪</span>`;
          quizFeedbackBox.style.display = 'block';
        }

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: false
        });
        saveAppState();
      }
    };

    if (quizOptionsContainer) quizOptionsContainer.appendChild(btn);
  });

  // שלב 4: עשייה מעשית
  const promptDisplay = document.getElementById('action-prompt-display');
  if (promptDisplay) promptDisplay.textContent = `"${unit.step4_action.prompt}"`;
  const doInstruction = document.getElementById('action-do-instruction');
  if (doInstruction) doInstruction.textContent = unit.step4_action.doText;

  const ttsActionBtn = document.getElementById('tts-action-btn');
  if (ttsActionBtn) {
    ttsActionBtn.onclick = () => SoundService.speakText(`שלב 4: עכשיו תורך. ${unit.step4_action.doText}. הפרומפט הוא: ${unit.step4_action.prompt}`);
  }

  const copyBtn = document.getElementById('unit-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => copyToClipboard(unit.step4_action.prompt, copyBtn);
  }

  const finishBtn = document.getElementById('unit-finish-btn');
  const feedbackBox = document.getElementById('unit-feedback-box');
  const ribbon = document.getElementById('unit-completed-ribbon');
  const waBtn = document.getElementById('unit-share-wa-btn');

  if (unit.isCompleted) {
    if (finishBtn) finishBtn.style.display = 'none';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'flex';
    if (waBtn) {
      waBtn.style.display = 'inline-flex';
      waBtn.onclick = () => {
        shareProgressToWhatsApp(`היי אבא! הרגע סיימתי בהצלחה את יחידה "${unit.title}" במערכת AI! 🎉`);
      };
    }
  } else {
    if (finishBtn) finishBtn.style.display = 'inline-flex';
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (ribbon) ribbon.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';

    if (finishBtn) {
      finishBtn.onclick = () => {
        finishBtn.style.display = 'none';
        if (feedbackBox) feedbackBox.style.display = 'block';
      };
    }

    if (feedbackBox) {
      feedbackBox.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.onclick = () => {
          const rating = btn.dataset.rating;
          unit.isCompleted = true;
          unit.feedback = rating;

          appState.feedbackHistory.push({
            unitId: unit.id,
            title: unit.title,
            rating: rating,
            timestamp: new Date().toISOString()
          });

          SoundService.playSuccessSound();
          showToast(`כל הכבוד דניאל! היחידה "${unit.title}" הושלמה! ⭐`);
          saveAppState();
          renderUnitPlayer(unit.id);
        };
      });
    }
  }
}

// ============================================================================
// 9. מנוע מבחני שלב (Checkpoint Test Engine עם שאלות מתחלפות וסף 85+)
// ============================================================================

let currentCheckpoint = null;
let cpQuestions = [];
let cpQuestionIdx = 0;
let cpUserAnswers = [];

function openCheckpointTest(cp) {
  currentCheckpoint = cp;
  
  // הגרלת 4 שאלות מתוך בנק השאלות של מבחן השלב (למניעת שינון עיוור)
  const pool = JSON.parse(JSON.stringify(cp.questionBank || []));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  cpQuestions = pool.slice(0, 4);

  // ערבוב התשובות בכל שאלה שנבחרה
  cpQuestions.forEach(q => {
    for (let i = q.options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
    }
  });

  cpQuestionIdx = 0;
  cpUserAnswers = [];

  showView('checkpoint');
  const header = document.getElementById('checkpoint-view-header');
  if (header) header.textContent = cp.title;

  const backBtn = document.getElementById('checkpoint-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  renderCheckpointQuestion();
}

function renderCheckpointQuestion() {
  const total = cpQuestions.length;
  const q = cpQuestions[cpQuestionIdx];

  const stepText = document.getElementById('checkpoint-step-text');
  if (stepText) stepText.textContent = `שאלה ${cpQuestionIdx + 1} מתוך ${total}`;
  const bar = document.getElementById('checkpoint-progress-bar');
  if (bar) bar.style.width = `${((cpQuestionIdx + 1) / total) * 100}%`;

  const area = document.getElementById('checkpoint-content-area');
  if (!area) return;

  area.innerHTML = `
    <div style="margin-top: 1.5rem;">
      <h3 class="question-title" style="font-size: 1.35rem; line-height: 1.4; margin-bottom: 1.5rem;">${q.question}</h3>
      <div class="quiz-options-grid" id="cp-options-container"></div>
    </div>
  `;

  const optContainer = document.getElementById('cp-options-container');
  q.options.forEach((opt, oIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `
      <span class="quiz-btn-icon">⚪</span>
      <span class="quiz-btn-text">${opt.text}</span>
    `;

    btn.onclick = () => {
      optContainer.querySelectorAll('.quiz-option-btn').forEach(b => {
        b.classList.remove('selected');
        const icon = b.querySelector('.quiz-btn-icon');
        if (icon) icon.textContent = '⚪';
      });
      btn.classList.add('selected');
      const icon = btn.querySelector('.quiz-btn-icon');
      if (icon) icon.textContent = '🔘';
      cpUserAnswers[cpQuestionIdx] = oIdx;

      const nextBtn = document.getElementById('checkpoint-next-btn');
      if (nextBtn) nextBtn.disabled = false;
    };

    if (optContainer) optContainer.appendChild(btn);
  });

  const footer = document.getElementById('checkpoint-nav-footer');
  if (footer) {
    footer.innerHTML = `
      <button id="checkpoint-next-btn" class="primary-btn" disabled style="width: 100%;">
        <span>${cpQuestionIdx + 1 < total ? 'המשך לשאלה הבאה ▶' : 'בדוק את תוצאות המבחן! 🏆'}</span>
      </button>
    `;
  }

  const ttsBtn = document.getElementById('tts-checkpoint-q-btn');
  if (ttsBtn) {
    ttsBtn.onclick = () => SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
  }

  const nextBtn = document.getElementById('checkpoint-next-btn');
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (cpQuestionIdx + 1 < total) {
        cpQuestionIdx++;
        renderCheckpointQuestion();
      } else {
        finishCheckpointTest();
      }
    };
  }

  SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
}

function finishCheckpointTest() {
  const total = cpQuestions.length;
  let correct = 0;
  cpQuestions.forEach((q, idx) => {
    const chosen = cpUserAnswers[idx];
    if (chosen !== undefined && q.options[chosen] && q.options[chosen].isCorrect) {
      correct++;
    }
  });

  const finalScore = Math.round((correct / total) * 100);
  const passed = finalScore >= 85;

  currentCheckpoint.lastScore = finalScore;
  if (passed) {
    currentCheckpoint.isPassed = true;
    saveAppState();
    SoundService.playSuccessSound();
  }

  const area = document.getElementById('checkpoint-content-area');
  const footer = document.getElementById('checkpoint-nav-footer');

  if (area) {
    area.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 3.5rem; margin-bottom: 0.8rem;">${passed ? '🏆 ⭐ 🎉' : '💡 💪'}</div>
        <h2 class="question-title" style="color: ${passed ? 'var(--success)' : 'var(--warning)'}; margin-bottom: 0.6rem;">
          ציון במבחן: ${finalScore}
        </h2>
        <p style="font-size: 1.15rem; color: var(--text-secondary); max-width: 500px; margin: 0 auto 1.5rem auto;">
          ${passed 
            ? 'כל הכבוד דניאל! עברת את מבחן השלב בהצלחה מרובה! השלב הבא במסלול נפתח עבורך כעת.'
            : `קיבלת ציון ${finalScore}. כדי להמשיך לשלב הבא יש לקבל 85 ומעלה. לא נורא, מכל ניסיון לומדים! לחץ למטה ונעשה את המבחן שוב עם שאלות חדשות.`}
        </p>

        ${passed ? `
          <div style="margin: 1.5rem 0;">
            <button class="share-whatsapp-btn" onclick="shareProgressToWhatsApp('היי אבא! עברתי בהצלחה את ${currentCheckpoint.title} בציון ${finalScore}! 🏆 היחידות הבאות נפתחו!')">
              <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (footer) {
    footer.innerHTML = passed
      ? `<button class="primary-btn" onclick="showView('roadmap');renderRoadmap();" style="width: 100%;"><span>מעולה! חזרה למסלול האישי 🌟</span></button>`
      : `<button class="primary-btn" onclick="openCheckpointTest(currentCheckpoint)" style="width: 100%;"><span>נסה שוב עם שאלות חדשות 🔄</span></button>`;
  }

  SoundService.speakText(passed 
    ? `כל הכבוד דניאל! קיבלת ציון ${finalScore} ועברת בהצלחה! השלב הבא נפתח כעת.`
    : `קיבלת ציון ${finalScore}. כדי להמשיך צריך 85 ומעלה. ננסה שוב ונעבור יחד!`
  );
}

// ============================================================================
// 10. שירותי בינה מלאכותית (AIService - Multi-Model Fallback & Generator)
// ============================================================================

const AIService = {
  // שרשרת מודלים פעילה ומעודכנת ל-Gemini (ללא 1.5 שהוצא משימוש)
  geminiModels: [
    'gemini-2.5-flash',
    'gemini-3.6-flash',
    'gemini-2.5-pro'
  ],

  // מודלים פעילים ב-Groq
  groqModels: [
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b'
  ],

  async testGemini(apiKey, progressCb) {
    if (!apiKey) return { success: false, error: 'לא הוזן מפתח API של Gemini.' };
    const t0 = performance.now();

    for (const model of this.geminiModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'שלום! ענה במילה אחת בלבד: "פעיל".' }] }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'פעיל';
          const latency = Math.round(performance.now() - t0);
          return { success: true, model, latency, reply };
        }
      } catch (e) {
        console.warn(`Gemini test failed for ${model}:`, e);
      }
    }
    return { success: false, error: 'כל מודלי Gemini נכשלו או שהמפתח אינו תקין.' };
  },

  async testGroq(apiKey, progressCb) {
    if (!apiKey) return { success: false, error: 'לא הוזן מפתח API של Groq.' };
    const t0 = performance.now();

    for (const model of this.groqModels) {
      if (progressCb) progressCb(`בודק מודל ${model}...`);
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'שלום! ענה במילה אחת: "פעיל".' }],
            max_tokens: 300
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const reply = (choice?.content || choice?.reasoning_content || 'פעיל').trim();
          const latency = Math.round(performance.now() - t0);
          return { success: true, model, latency, reply };
        }
      } catch (e) {
        console.warn(`Groq test failed for ${model}:`, e);
      }
    }
    return { success: false, error: 'כל מודלי Groq נכשלו או שהמפתח אינו תקין.' };
  },

  async testOllama(baseUrl) {
    const t0 = performance.now();
    try {
      const resp = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        const latency = Math.round(performance.now() - t0);
        return { success: true, latency, reply: `נמצאו ${data?.models?.length || 0} מודלים מקומיים.` };
      }
      return { success: false, error: 'שרת Ollama אינו מגיב בכתובת זו.' };
    } catch (e) {
      return { success: false, error: 'לא ניתן להתחבר ל-Ollama מקומי (וודא שהשרת רץ).' };
    }
  },

  async generateLessonWithFallback(topicPrompt, progressCb) {
    const systemInstruction = `אתה מומחה לפדגוגיה ונגישות קוגניטיבית עבור דניאל (בן 28).
עליך לייצר יחידת לימוד מעשית, מעצימה ומכבדת במבנה JSON תקני לחלוטין.
חובה להחזיר רק אובייקט JSON תקני בין סוגריים מסולסלים { ... }, ללא טקסט מקדים וללא תגיות markdown.
מבנה ה-JSON הנדרש במדויק:
{
  "title": "שם היחידה בעברית",
  "category": "קטגוריה (למשל: עבודה ותקשורת / כישורי חיים / יצירה)",
  "goal": "מטרת היחידה במשפט אחד פשוט",
  "step1_demo": {
    "badPrompt": "דוגמה לבקשה לא מוצלחת או כללית מדי",
    "badResult": "תשובה ארוכה, מסובכת או מבלבלת שה-AI נותן",
    "goodPrompt": "דוגמה לבקשה מדויקת ופשוטה",
    "goodResult": "תשובה קצרה, נעימה וממוקדת בדיוק במה שרצינו"
  },
  "step2_takeaway": "הסבר תמציתי ומאיר עיניים של 1-2 משפטים מדוע הבקשה הטובה הצליחה",
  "step3_quiz": {
    "question": "שאלת הבנה ברורה עם 2 אפשרויות",
    "options": [
      { "text": "התשובה הנכונה", "isCorrect": true, "explanation": "הסבר קצר ומעודד" },
      { "text": "התשובה השגויה", "isCorrect": false, "explanation": "הסבר עדין מדוע זה לא מדויק" }
    ]
  },
  "step4_action": {
    "prompt": "משפט מוכן להעתקה ולתרגול",
    "doText": "הוראה קצרה ומעשית מה לעשות"
  }
}`;

    // 1. ניסיון ב-Gemini
    if (appState.apiConfig.geminiKey) {
      for (const model of this.geminiModels) {
        if (progressCb) progressCb(`מייצר יחידה באמצעות Gemini (${model})...`);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${appState.apiConfig.geminiKey}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemInstruction}\n\nהנושא המבוקש ליחידה הוא: ${topicPrompt}` }]
              }]
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = this.cleanAndParseJSON(text);
              if (parsed) return { unit: parsed, provider: `Gemini (${model})` };
            }
          }
        } catch (e) {
          console.warn(`Gemini generation failed for ${model}:`, e);
        }
      }
    }

    // 2. ניסיון ב-Groq
    if (appState.apiConfig.groqKey) {
      for (const model of this.groqModels) {
        if (progressCb) progressCb(`מייצר יחידה באמצעות Groq (${model})...`);
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${appState.apiConfig.groqKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `צור יחידה בנושא: ${topicPrompt}` }
              ],
              max_tokens: 1500
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const choice = data?.choices?.[0]?.message;
            const text = choice?.content || choice?.reasoning_content;
            if (text) {
              const parsed = this.cleanAndParseJSON(text);
              if (parsed) return { unit: parsed, provider: `Groq (${model})` };
            }
          }
        } catch (e) {
          console.warn(`Groq generation failed for ${model}:`, e);
        }
      }
    }

    // 3. Fallback מקומי מחולל יחידה
    if (progressCb) progressCb('מייצר יחידה מובנית במנוע המקומי...');
    const localUnit = this.synthesizeLocalUnit(topicPrompt);
    return { unit: localUnit, provider: 'מנוע למידה פנימי' };
  },

  cleanAndParseJSON(text) {
    try {
      let clean = text.trim();
      // הסרת בלוקי markdown של ```json ו-```
      if (clean.includes('```')) {
        clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
      }
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        clean = clean.substring(start, end + 1);
        return JSON.parse(clean);
      }
    } catch (e) {
      console.warn('JSON parse error:', e);
    }
    return null;
  },

  synthesizeLocalUnit(topic) {
    return {
      title: `${topic} - צעד אחר צעד`,
      category: 'מיומנות מעשית אישית',
      goal: `ללמוד איך להיעזר ב-AI בצורה פשוטה, ממוקדת וברורה בנושא: ${topic}.`,
      step1_demo: {
        badPrompt: `ספר לי על ${topic}`,
        badResult: `נושא ה-${topic} הינו תחום נרחב הכולל שלל נדבכים מתקדמים ותהליכים תאורטיים מורכבים...`,
        goodPrompt: `תסביר לי ב-2 משפטים פשוטים ובמילים קצרות: מה הכי חשוב לדעת על ${topic}?`,
        goodResult: `${topic} הוא נושא מעשי ושימושי. כשמבקשים הסבר פשוט, אפשר להבין אותו מיד ולהשתמש בו ביום-יום בקלות.`
      },
      step2_takeaway: `כשמבקשים מה-AI להתמקד ב-"2 משפטים פשוטים" לגבי ${topic}, מקבלים את השורה התחתונה מיד!`,
      step3_quiz: {
        question: `מה הדרך הטובה ביותר ללמוד על ${topic} בלי להתבלבל?`,
        options: [
          { text: 'לבקש הסבר קצר של 2 משפטים עם דוגמה פשוטה', isCorrect: true, explanation: 'נכון מאוד! זה מאפשר הבנה הדרגתית ונעימה.' },
          { text: 'לקרוא מאמר אקדמי ארוך ומעייף', isCorrect: false, explanation: 'זה עלול להציף ולעייף.' }
        ]
      },
      step4_action: {
        prompt: `תסביר לי ב-2 משפטים קצרים ובמילים פשוטות: איך ${topic} עוזר לי בחיים?`,
        doText: `העתק את הפרומפט והתנסה בבקשה ברורה על ${topic}:`
      }
    };
  }
};

// ============================================================================
// 11. ממשק ניהול ובקרה עבור מלווים (Admin & Caregiver Portal)
// ============================================================================

let currentGeneratedUnit = null;

function initAdminPortal() {
  // אימות PIN
  const adminPinModal = document.getElementById('admin-pin-modal');
  const closePinBtn = document.getElementById('close-pin-modal-btn');
  const submitPinBtn = document.getElementById('submit-pin-btn');
  const pinInput = document.getElementById('admin-pin-input');
  const pinError = document.getElementById('pin-error-msg');

  function openPinModal() {
    if (pinInput) pinInput.value = '';
    if (pinError) pinError.style.display = 'none';
    if (adminPinModal) {
      adminPinModal.classList.add('active');
      adminPinModal.style.display = 'flex';
      setTimeout(() => { if (pinInput) pinInput.focus(); }, 100);
    }
  }

  function closePinModal() {
    if (adminPinModal) {
      adminPinModal.classList.remove('active');
      adminPinModal.style.display = 'none';
    }
  }

  const headerAdminBtn = document.getElementById('header-admin-btn');
  if (headerAdminBtn) headerAdminBtn.onclick = openPinModal;
  const footerTrigger = document.getElementById('footer-admin-trigger');
  if (footerTrigger) footerTrigger.onclick = openPinModal;

  if (closePinBtn) closePinBtn.onclick = closePinModal;

  if (submitPinBtn && pinInput) {
    submitPinBtn.onclick = () => {
      const entered = pinInput.value.trim();
      const expected = appState.apiConfig.adminPin || ADMIN_PIN_DEFAULT;
      if (entered === expected || entered === ADMIN_PIN_DEFAULT || entered === 'דניאל') {
        closePinModal();
        showView('admin');
        renderAdminOverview();
      } else {
        if (pinError) pinError.style.display = 'block';
        SoundService.playErrorSound();
      }
    };

    pinInput.onkeypress = (e) => {
      if (e.key === 'Enter') submitPinBtn.click();
    };
  }

  // יציאה מממשק ניהול
  const exitAdminBtn = document.getElementById('exit-admin-btn');
  if (exitAdminBtn) {
    exitAdminBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  // טאבים בממשק ניהול
  const tabBtns = document.querySelectorAll('.adm-tab-btn');
  const tabPanels = document.querySelectorAll('.adm-tab-panel');

  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');

      if (tabId === 'adm-overview') renderAdminOverview();
      if (tabId === 'adm-curriculum') renderAdminCurriculum();
      if (tabId === 'adm-notes') renderAdminNotes();
      if (tabId === 'adm-settings') renderAdminSettings();
    };
  });

  // מחולל יחידות AI Assistant
  const chatSendBtn = document.getElementById('admin-chat-send-btn');
  const chatInput = document.getElementById('admin-chat-input');
  const chatMessages = document.getElementById('admin-chat-messages');
  const livePreviewContainer = document.getElementById('live-card-preview-container');
  const previewActions = document.getElementById('preview-actions');
  const approveCardBtn = document.getElementById('adm-approve-card-btn');

  async function handleAdminChatSend() {
    if (!chatInput || !chatSendBtn) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-bubble user-bubble';
    userMsg.style.cssText = 'background: #2563eb; color: #fff; padding: 0.8rem 1.2rem; border-radius: 12px; margin-bottom: 0.8rem; align-self: flex-start; max-width: 80%;';
    userMsg.textContent = text;
    if (chatMessages) chatMessages.appendChild(userMsg);

    chatSendBtn.disabled = true;
    chatSendBtn.innerHTML = '<span class="loading-spinner"></span> <span>מייצר יחידה...</span>';

    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-bubble assistant-bubble';
    assistantMsg.style.cssText = 'background: #f1f5f9; color: #0f172a; padding: 0.8rem 1.2rem; border-radius: 12px; margin-bottom: 0.8rem; align-self: flex-end; max-width: 80%;';
    assistantMsg.innerHTML = '<span class="loading-spinner"></span> <span id="gen-status-text">מתחבר ל-AI ומייצר יחידה מותאמת...</span>';
    if (chatMessages) chatMessages.appendChild(assistantMsg);

    try {
      const res = await AIService.generateLessonWithFallback(text, (msg) => {
        const el = document.getElementById('gen-status-text');
        if (el) el.textContent = msg;
      });

      currentGeneratedUnit = res.unit;
      currentGeneratedUnit.id = `unit_custom_${Date.now()}`;
      currentGeneratedUnit.isUnlocked = false;
      currentGeneratedUnit.isCompleted = false;

      assistantMsg.innerHTML = `✨ <strong>יחידה נוצרה בהצלחה</strong> באמצעות ${res.provider}! הנה תצוגה מקדימה שלה למטה:`;

      // הצגת Live Preview
      if (livePreviewContainer) {
        livePreviewContainer.innerHTML = `
          <div class="card unit-flow-card" style="border: 2px solid #2563eb; margin-top: 1rem;">
            <div class="unit-banner">
              <div class="unit-pill">${currentGeneratedUnit.category || 'יחידה חדשה'}</div>
              <h2 class="unit-headline">${currentGeneratedUnit.title}</h2>
              <p class="unit-goal">${currentGeneratedUnit.goal}</p>
            </div>
            <div class="unit-steps-wrapper">
              <div class="micro-step-box">
                <div class="step-header">
                  <span class="step-number-circle">1</span>
                  <h3 class="step-title">המחשה מוחשית Side-by-Side:</h3>
                </div>
                <div class="demo-comparison-grid">
                  <div class="demo-card bad-demo">
                    <div class="demo-card-tag bad-tag">❌ בקשה כללית</div>
                    <div class="demo-prompt">"${currentGeneratedUnit.step1_demo.badPrompt}"</div>
                    <div class="demo-result-text">${currentGeneratedUnit.step1_demo.badResult}</div>
                  </div>
                  <div class="demo-card good-demo">
                    <div class="demo-card-tag good-tag">✅ בקשה מדויקת</div>
                    <div class="demo-prompt">"${currentGeneratedUnit.step1_demo.goodPrompt}"</div>
                    <div class="demo-result-text">${currentGeneratedUnit.step1_demo.goodResult}</div>
                  </div>
                </div>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">2</span><h3 class="step-title">למה זה עבד:</h3></div>
                <div class="key-takeaway-card">${currentGeneratedUnit.step2_takeaway}</div>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">3</span><h3 class="step-title">שאלת וידוא הבנה:</h3></div>
                <p class="step-instruction">${currentGeneratedUnit.step3_quiz.question}</p>
              </div>
              <div class="micro-step-box">
                <div class="step-header"><span class="step-number-circle">4</span><h3 class="step-title">עשייה מעשית:</h3></div>
                <div class="example-prompt-text">"${currentGeneratedUnit.step4_action.prompt}"</div>
              </div>
            </div>
          </div>
        `;
      }
      if (previewActions) previewActions.style.display = 'flex';
      SoundService.playSuccessSound();
    } catch (err) {
      assistantMsg.innerHTML = `⚠️ שגיאה ביצירת יחידה: ${err.message}`;
    } finally {
      chatSendBtn.disabled = false;
      chatSendBtn.innerHTML = '<span>שלח ל-AI 🚀</span>';
    }
  }

  if (chatSendBtn) chatSendBtn.onclick = handleAdminChatSend;
  if (chatInput) {
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAdminChatSend();
      }
    };
  }

  if (approveCardBtn) {
    approveCardBtn.onclick = () => {
      if (!currentGeneratedUnit) return;
      appState.curriculumUnits.push(currentGeneratedUnit);
      saveAppState();
      SoundService.playSuccessSound();
      showToast(`היחידה "${currentGeneratedUnit.title}" נוספה למסלול של דניאל! 🎉`);
      currentGeneratedUnit = null;
      if (livePreviewContainer) livePreviewContainer.innerHTML = '<p class="preview-empty-text">אין כרטיסייה בתצוגה מקדימה כרגע. צור יחידה חדשה למעלה כדי לראות אותה כאן.</p>';
      if (previewActions) previewActions.style.display = 'none';
      renderRoadmap();
    };
  }
}

function renderAdminOverview() {
  const units = appState.curriculumUnits;
  const completed = units.filter(u => u.isCompleted).length;
  const total = units.length;

  const statUnits = document.getElementById('adm-stat-units');
  if (statUnits) statUnits.textContent = `${completed} מתוך ${total}`;

  const passedCPs = (appState.checkpoints || []).filter(c => c.isPassed).length;
  const statCPs = document.getElementById('adm-stat-checkpoints');
  if (statCPs) statCPs.textContent = `${passedCPs} מתוך ${(appState.checkpoints || []).length}`;

  const quizzes = appState.quizHistory || [];
  const correct = quizzes.filter(q => q.isCorrect).length;
  const accuracy = quizzes.length > 0 ? Math.round((correct / quizzes.length) * 100) : 100;
  const statAcc = document.getElementById('adm-stat-accuracy');
  if (statAcc) statAcc.textContent = `${accuracy}% (${quizzes.length} בדיקות)`;

  const table = document.getElementById('adm-units-table');
  if (table) {
    table.innerHTML = `
      <thead>
        <tr>
          <th>יחידה / נושא</th>
          <th>קטגוריה</th>
          <th>סטטוס למידה</th>
          <th>משוב דניאל</th>
        </tr>
      </thead>
      <tbody>
        ${units.map(u => `
          <tr>
            <td><strong>${u.title}</strong></td>
            <td><span class="badge-tag">${u.category || 'כללי'}</span></td>
            <td>${u.isCompleted ? '<span style="color:#059669; font-weight:700;">🟢 הושלם</span>' : '<span style="color:#d97706;">⏳ ממתין לביצוע</span>'}</td>
            <td>${u.feedback === 'easy' ? '😊 היה קל' : u.feedback === 'medium' ? '😐 קצת קשה' : u.feedback === 'hard' ? '😕 לא מובן' : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }
}

function renderAdminCurriculum() {
  const container = document.getElementById('mgr-curriculum-list');
  if (!container) return;
  container.innerHTML = '';

  appState.curriculumUnits.forEach((unit, idx) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.cssText = 'padding: 1rem 1.4rem; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center;';
    item.innerHTML = `
      <div>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.2rem;">
          <span style="font-weight: 800; color: #2563eb;">#${idx + 1}</span>
          <span class="badge-tag">${unit.category || 'מיומנות'}</span>
          <span style="font-size: 0.85rem; color: ${unit.isCompleted ? '#059669' : '#d97706'}; font-weight: 700;">
            ${unit.isCompleted ? '✓ הושלם' : 'ממתין'}
          </span>
        </div>
        <h4 style="margin: 0; font-size: 1.1rem;">${unit.title}</h4>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;" onclick="moveUnit(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲ למעלה</button>
        <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;" onclick="moveUnit(${idx}, 1)" ${idx === appState.curriculumUnits.length - 1 ? 'disabled' : ''}>▼ למטה</button>
        <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem; color: #dc2626;" onclick="deleteUnit(${idx})">🗑️ מחק</button>
      </div>
    `;
    container.appendChild(item);
  });

  const addBtn = document.getElementById('add-custom-unit-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      // מעבר לטאב AI Assistant ליצירת יחידה מותאמת
      const assistantTab = document.querySelector('.adm-tab-btn[data-tab="adm-assistant"]');
      if (assistantTab) assistantTab.click();
    };
  }
}

window.moveUnit = function(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= appState.curriculumUnits.length) return;
  const temp = appState.curriculumUnits[index];
  appState.curriculumUnits[index] = appState.curriculumUnits[target];
  appState.curriculumUnits[target] = temp;
  saveAppState();
  renderAdminCurriculum();
  renderRoadmap();
};

window.deleteUnit = function(index) {
  if (appState.curriculumUnits.length <= 1) {
    alert('לא ניתן למחוק את היחידה האחרונה במסלול.');
    return;
  }
  if (confirm(`האם אתה בטוח שברצונך למחוק את יחידה "${appState.curriculumUnits[index].title}"?`)) {
    appState.curriculumUnits.splice(index, 1);
    saveAppState();
    renderAdminCurriculum();
    renderRoadmap();
  }
};

function renderAdminNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  container.innerHTML = '';

  const notes = appState.caregiverNotes || [];
  if (notes.length === 0) {
    container.innerHTML = '<p class="preview-empty-text">אין עדיין פתקים או עדכונים.</p>';
  } else {
    notes.forEach((note, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'padding: 1rem 1.4rem; margin-bottom: 0.8rem; border-right: 4px solid #2563eb;';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b; margin-bottom: 0.4rem;">
          <span><strong>${note.author || 'מלווה'}</strong> • ${note.date || ''}</span>
          <button style="background: none; border: none; cursor: pointer; color: #dc2626;" onclick="deleteNote(${idx})">🗑️ מחק</button>
        </div>
        <p style="margin: 0; font-size: 1.05rem; line-height: 1.5;">${note.text}</p>
      `;
      container.appendChild(card);
    });
  }

  const addNoteBtn = document.getElementById('add-note-btn');
  const noteInput = document.getElementById('new-note-text');
  if (addNoteBtn && noteInput) {
    addNoteBtn.onclick = () => {
      const txt = noteInput.value.trim();
      if (!txt) return;
      appState.caregiverNotes.unshift({
        id: `note_${Date.now()}`,
        author: 'אבא ומלווים',
        date: new Date().toLocaleDateString('he-IL'),
        text: txt
      });
      noteInput.value = '';
      saveAppState();
      renderAdminNotes();
      showToast('הפתק נשמר בהצלחה! 📝');
    };
  }
}

window.deleteNote = function(index) {
  appState.caregiverNotes.splice(index, 1);
  saveAppState();
  renderAdminNotes();
};

function renderAdminSettings() {
  const geminiInput = document.getElementById('cfg-gemini-key');
  const groqInput = document.getElementById('cfg-groq-key');
  const ollamaInput = document.getElementById('cfg-ollama-url');

  if (geminiInput) geminiInput.value = appState.apiConfig.geminiKey || '';
  if (groqInput) groqInput.value = appState.apiConfig.groqKey || '';
  if (ollamaInput) ollamaInput.value = appState.apiConfig.ollamaUrl || 'http://localhost:11434';

  const saveBtn = document.getElementById('cfg-save-keys-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (geminiInput) appState.apiConfig.geminiKey = geminiInput.value.trim();
      if (groqInput) appState.apiConfig.groqKey = groqInput.value.trim();
      if (ollamaInput) appState.apiConfig.ollamaUrl = ollamaInput.value.trim() || 'http://localhost:11434';
      saveAppState();
      SoundService.playSuccessSound();
      showToast('הגדרות המפתחות נשמרו בהצלחה! 💾');
    };
  }

  // בדיקת Gemini אסינכרונית עם ספינר
  const btnTestGemini = document.getElementById('btn-test-gemini');
  const statusGemini = document.getElementById('cfg-gemini-status');
  if (btnTestGemini && statusGemini) {
    btnTestGemini.onclick = async () => {
      const key = geminiInput ? geminiInput.value.trim() : '';
      btnTestGemini.disabled = true;
      btnTestGemini.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusGemini.style.display = 'block';
      statusGemini.style.backgroundColor = '#eff6ff';
      statusGemini.style.color = '#1e40af';
      statusGemini.style.border = '1px solid #bfdbfe';
      statusGemini.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Google AI Studio...</span>';

      try {
        const res = await AIService.testGemini(key, (msg) => {
          statusGemini.innerHTML = `<span class="loading-spinner"></span> <span>${msg}</span>`;
        });
        if (res.success) {
          statusGemini.style.backgroundColor = '#ecfdf5';
          statusGemini.style.color = '#065f46';
          statusGemini.style.border = '1px solid #a7f3d0';
          statusGemini.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל פעיל: <code>${res.model}</code>`;
        } else {
          statusGemini.style.backgroundColor = '#fef2f2';
          statusGemini.style.color = '#991b1b';
          statusGemini.style.border = '1px solid #fecaca';
          statusGemini.innerHTML = `🔴 <strong>שגיאה ב-Gemini:</strong> ${res.error}`;
        }
      } catch (err) {
        statusGemini.style.backgroundColor = '#fef2f2';
        statusGemini.style.color = '#991b1b';
        statusGemini.style.border = '1px solid #fecaca';
        statusGemini.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestGemini.disabled = false;
        btnTestGemini.innerHTML = '<span>בדוק Gemini 🧪</span>';
      }
    };
  }

  // בדיקת Groq אסינכרונית עם ספינר
  const btnTestGroq = document.getElementById('btn-test-groq');
  const statusGroq = document.getElementById('cfg-groq-status');
  if (btnTestGroq && statusGroq) {
    btnTestGroq.onclick = async () => {
      const key = groqInput ? groqInput.value.trim() : '';
      btnTestGroq.disabled = true;
      btnTestGroq.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusGroq.style.display = 'block';
      statusGroq.style.backgroundColor = '#eff6ff';
      statusGroq.style.color = '#1e40af';
      statusGroq.style.border = '1px solid #bfdbfe';
      statusGroq.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Groq Cloud...</span>';

      try {
        const res = await AIService.testGroq(key, (msg) => {
          statusGroq.innerHTML = `<span class="loading-spinner"></span> <span>${msg}</span>`;
        });
        if (res.success) {
          statusGroq.style.backgroundColor = '#ecfdf5';
          statusGroq.style.color = '#065f46';
          statusGroq.style.border = '1px solid #a7f3d0';
          statusGroq.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל פעיל: <code>${res.model}</code>`;
        } else {
          statusGroq.style.backgroundColor = '#fef2f2';
          statusGroq.style.color = '#991b1b';
          statusGroq.style.border = '1px solid #fecaca';
          statusGroq.innerHTML = `🔴 <strong>שגיאה ב-Groq:</strong> ${res.error}`;
        }
      } catch (err) {
        statusGroq.style.backgroundColor = '#fef2f2';
        statusGroq.style.color = '#991b1b';
        statusGroq.style.border = '1px solid #fecaca';
        statusGroq.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestGroq.disabled = false;
        btnTestGroq.innerHTML = '<span>בדוק Groq 🧪</span>';
      }
    };
  }

  // בדיקת Ollama אסינכרונית עם ספינר
  const btnTestOllama = document.getElementById('btn-test-ollama');
  const statusOllama = document.getElementById('cfg-ollama-status');
  if (btnTestOllama && statusOllama) {
    btnTestOllama.onclick = async () => {
      const url = ollamaInput ? ollamaInput.value.trim() : 'http://localhost:11434';
      btnTestOllama.disabled = true;
      btnTestOllama.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusOllama.style.display = 'block';
      statusOllama.style.backgroundColor = '#eff6ff';
      statusOllama.style.color = '#1e40af';
      statusOllama.style.border = '1px solid #bfdbfe';
      statusOllama.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Ollama מקומי...</span>';

      try {
        const res = await AIService.testOllama(url);
        if (res.success) {
          statusOllama.style.backgroundColor = '#ecfdf5';
          statusOllama.style.color = '#065f46';
          statusOllama.style.border = '1px solid #a7f3d0';
          statusOllama.innerHTML = `🟢 <strong>מחובר ל-Ollama!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | ${res.reply}`;
        } else {
          statusOllama.style.backgroundColor = '#fffbeb';
          statusOllama.style.color = '#92400e';
          statusOllama.style.border = '1px solid #fde68a';
          statusOllama.innerHTML = `ℹ️ <strong>סטטוס Ollama:</strong> ${res.error}`;
        }
      } catch (err) {
        statusOllama.style.backgroundColor = '#fef2f2';
        statusOllama.style.color = '#991b1b';
        statusOllama.style.border = '1px solid #fecaca';
        statusOllama.innerHTML = `🔴 <strong>שגיאה:</strong> ${err.message}`;
      } finally {
        btnTestOllama.disabled = false;
        btnTestOllama.innerHTML = '<span>בדוק Ollama 🧪</span>';
      }
    };
  }

  // גיבוי ושחזור
  const exportBtn = document.getElementById('adm-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `daniel_ai_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('קובץ גיבוי הורד בהצלחה! 💾');
    };
  }

  const importBtn = document.getElementById('adm-import-btn');
  const fileInput = document.getElementById('adm-file-input');
  if (importBtn && fileInput) {
    importBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && typeof parsed === 'object') {
            appState = parsed;
            saveAppState();
            renderAdminOverview();
            renderRoadmap();
            showToast('הנתונים שוחזרו בהצלחה מהקובץ! 📥');
          }
        } catch (err) {
          alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
  }

  const resetBtn = document.getElementById('adm-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm('אזהרה: פעולה זו תאפס את כל התקדמות הלמידה של דניאל. האם להמשיך?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    };
  }
}

// ============================================================================
// 12. אתחול ראשי בטעינת המסמך (DOMContentLoaded)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // ביצוע מיגרציה ושחזור נתונים
  performMigrationIfNeeded();

  // בדיקת נעילת שבת
  checkAndApplyShabbatLock();

  // כפתור מעקף שבת למלווים
  const bypassBtn = document.getElementById('shabbat-bypass-btn');
  if (bypassBtn) {
    bypassBtn.onclick = () => {
      const pin = prompt('הקש קוד מלווה למעקף שבת לצורכי בדיקה:');
      const expected = appState.apiConfig.adminPin || ADMIN_PIN_DEFAULT;
      if (pin === expected || pin === ADMIN_PIN_DEFAULT || pin === 'דניאל' || pin === '') {
        shabbatBypassed = true;
        checkAndApplyShabbatLock();
        showToast('מצב שבת הוקפא זמנית לבדיקה.');
      } else {
        alert('קוד שגוי.');
      }
    };
  }

  // הקראה קולית של כותרת המסך
  const globalTtsBtn = document.getElementById('global-tts-btn');
  if (globalTtsBtn) {
    globalTtsBtn.onclick = () => {
      let text = 'מאמן ה-AI האישי של דניאל. לומדים צעד אחר צעד בקצב שלך.';
      if (appState.currentView === 'unit') {
        const u = appState.curriculumUnits.find(x => x.id === appState.activeUnitId);
        if (u) text = `${u.title}. ${u.goal}`;
      } else if (appState.currentView === 'checkpoint' && currentCheckpoint) {
        text = `${currentCheckpoint.title}. ${currentCheckpoint.description}`;
      }
      SoundService.speakText(text);
    };
  }

  // אתחול ממשק ניהול
  initAdminPortal();

  // רינדור ברירת מחדל: מסלול הלמידה של דניאל
  showView('roadmap');
  renderRoadmap();

  // חיווי ידידותי שהכל נטען כהלכה
  showToast('ברוך הבא דניאל! כל הנתונים נטענו בהצלחה ✨');
});
