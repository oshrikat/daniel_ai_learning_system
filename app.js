/**
 * דניאל לומד בינה מלאכותית - Client Engine v3.0
 * 
 * תכונות מפתח:
 * 1. נעילת שבת אוטומטית (יום שישי 16:30 עד מוצ"ש 20:30) עם מסך חגיגי.
 * 2. מסלול מודרג: כל 2 יחידות יש תחנת מבחן (Checkpoint) המחייבת ציון 85+ כדי להמשיך.
 * 3. בנק שאלות מתחלפות ואקראיות לכל מבחן שלב (מונע שינון עיוור).
 * 4. כפתור שיתוף מהיר לאבא ב-WhatsApp ובמייל בסיום יחידה ומבחן.
 * 5. ניקוי אזור דניאל (ללא צ'אט מסיח דעת - רק למידה ברורה, הקראה קולית ותרגול).
 * 6. תעדוף Gemini כספק ראשי (עם שרשרת Fallback רחבה) ו-Groq כספק מהיר.
 * 7. חילוץ JSON קשיח ומאומת עבור ה-Live Preview בניהול (ללא נפילה שקטה לברירת מחדל).
 */

const STORAGE_KEY = 'daniel_ai_learning_system_v3';

// ============================================================================
// 1. עשר יחידות הלימוד המובנות
// ============================================================================
const DEFAULT_UNITS = [
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
    title: 'ניסוח הודעת וואטסאפ מכבדת על איחור',
    category: 'עבודה ותקשורת',
    goal: 'להיעזר ב-AI לניסוח הודעה מהירה ומכבדת למנהל או למדריך כשיש פקק או עיכוב.',
    isUnlocked: true,
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
      prompt: 'תן לי מתכון פשוט ב-3 צעדים קצרים להכנת חביתה טעימה ובטוחה במחבת',
      doText: 'העתק את הבקשה וראה את השלבים הקלים להכנה:'
    }
  },
  {
    id: 'unit_5',
    title: 'איך ה-AI יכול לעזור לי להתכונן לראיון עבודה',
    category: 'תעסוקה ועבודה',
    goal: 'להשתמש ב-AI כשותף לאימון על שאלות נפוצות בראיונות עבודה באווירה רגועה.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תכין אותי לראיון',
      badResult: 'באיזה תחום? איזה תפקיד? מול מי? יש עשרות סוגי ראיונות שונים...',
      goodPrompt: 'שאל אותי שאלה אחת קלה ששואלים בראיון עבודה לחנות בגדים, וחכה לתשובה שלי',
      goodResult: 'בשמחה! שאלה ראשונה: "שלום דניאל, ספר לי על עצמך בכמה משפטים, ולמה אתה רוצה לעבוד אצלנו בחנות?"'
    },
    step2_takeaway: 'ה-AI יכול להיות מאמן אישי מעולה! מבקשים ממנו לשאול "שאלה אחת בכל פעם".',
    step3_quiz: {
      question: 'איך כדאי להתאמן עם AI לקראת פגישה או ראיון?',
      options: [
        { text: 'לבקש ממנו לשאול שאלה אחת בכל פעם ולתרגל תשובות', isCorrect: true, explanation: 'נכון מאוד! זה מרגיע ובונה ביטחון צעד אחרי צעד.' },
        { text: 'לבקש ממנו לקרוא לנו ספר שלם על פסיכולוגיה', isCorrect: false, explanation: 'זה סתם יעייף ולא יעזור לנו לתרגל את מה שחשוב.' }
      ]
    },
    step4_action: {
      prompt: 'שאל אותי שאלה אחת קלה ומעודדת לראיון עבודה בתור עוזר במשרד, וחכה לתשובה שלי',
      doText: 'העתק את הבקשה ותרגל תשובה רגועה ומדויקת:'
    }
  },
  {
    id: 'unit_6',
    title: 'הבנת מושגים בתלוש שכר (ברוטו מול נטו)',
    category: 'עצמאות כלכלית',
    goal: 'להבין בקלות מושגים כספיים חשובים בעזרת הסברים פשוטים ומשלים מהחיים.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מה ההבדל בין ברוטו לנטו?',
      badResult: 'ברוטו הוא שכר היסוד ותוספותיו בטרם ניכויי חובה כגון מס הכנסה, ביטוח לאומי ודמי בריאות לפי מדרגות...',
      goodPrompt: 'תסביר לי במשפט אחד פשוט מה ההבדל בין ברוטו לנטו בתלוש שכר, כמו שמסבירים לחבר',
      goodResult: 'ברוטו זה הסכום הגבוה שרשום על הנייר לפני שמורידים מיסים, ונטו זה הכסף האמיתי שנכנס לחשבון הבנק שלך בסוף החודש.'
    },
    step2_takeaway: 'ברוטו = הסכום לפני הורדות. נטו = הכסף שנכנס אליך באמת לכיס!',
    step3_quiz: {
      question: 'איזה סכום כסף נכנס בסוף החודש ישירות לחשבון הבנק שלך?',
      options: [
        { text: 'סכום הנטו (הכסף האמיתי שנשאר אחרי הורדות החובה)', isCorrect: true, explanation: 'מצוין! נטו זה מה שאפשר להשתמש בו לקניות ולחסכונות.' },
        { text: 'סכום הברוטו הגבוה לפני כל ההורדות', isCorrect: false, explanation: 'לא, מהברוטו יורדים מיסים ותשלומי פנסיה וביטוח.' }
      ]
    },
    step4_action: {
      prompt: 'תסביר לי ב-2 משפטים קצרים מה זה חיסכון לפנסיה בתלוש שכר',
      doText: 'העתק וראה מהי פנסיה בצורה הכי ברורה וקלה:'
    }
  },
  {
    id: 'unit_7',
    title: 'סיכום משימה בעבודה: לזכור מה המנהל ביקש',
    category: 'עבודה ותעסוקה',
    goal: 'להיעזר ב-AI כדי לארגן בנקודות קצרות רשימת הוראות שקיבלנו בעבודה.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'המנהל אמר לי הרבה דברים מה לעשות',
      badResult: 'אני לא יודע מה הוא אמר. תפרט לי בדיוק מה נאמר.',
      goodPrompt: 'המנהל ביקש: לסדר את המדף, להוציא קרטונים לפח, ולבדוק שנשארו מדבקות. סדר לי את זה ב-3 נקודות קצרות לפי סדר ביצוע.',
      goodResult: '1. לסדר את המדף בצורה יפה.\n2. לקחת את הקרטונים לפח המחזור.\n3. לבדוק שנשארו מדבקות על השולחן.'
    },
    step2_takeaway: 'כשמבקשים מה-AI "לסדר בנקודות לפי סדר ביצוע", קל לבצע משימה אחר משימה ברוגע!',
    step3_quiz: {
      question: 'איך הכי נוח לקבל מה-AI רשימת משימות לעבודה?',
      options: [
        { text: 'בנקודות קצרות וממוספרות (1, 2, 3) לפי סדר הביצוע', isCorrect: true, explanation: 'בדיוק! כך אפשר לעשות משימה אחת, לסמן וי, ולהמשיך לבאה.' },
        { text: 'בפסקה אחת ארוכה ומחוברת בלי רווחים', isCorrect: false, explanation: 'זה מבלבל וקשה לעקוב מה כבר עשינו.' }
      ]
    },
    step4_action: {
      prompt: 'יש לי 3 דברים לעשות בבוקר: לצחצח שיניים, לשתות מים ולקחת תיק. סדר לי בנקודות קצרות.',
      doText: 'העתק וראה איך רשימה ממוספרת עושה סדר בראש:'
    }
  },
  {
    id: 'unit_8',
    title: 'איך לנסח מחדש כשלא מבינים את התשובה',
    category: 'בסיס ופשטות',
    goal: 'ללמוד שלא נבהלים מתשובה מסובכת - פשוט מבקשים מה-AI להסביר שוב במילים של ילד.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'לא הבנתי כלום, אתה גרוע',
      badResult: 'אני מתנצל. אנא ציין מה בדיוק לא היה ברור.',
      goodPrompt: 'זה היה קצת ארוך ומסובך. בבקשה תסביר לי שוב במשפט אחד קל עם דוגמה יומיומית',
      goodResult: 'אין בעיה בכלל! בוא נעשה את זה פשוט: תחשוב על זה כמו רמזור – אדום עוצרים, ירוק נוסעים.'
    },
    step2_takeaway: 'ה-AI לא נעלב לעולם! תמיד מותר לבקש: "תסביר שוב ביותר פשוט ובמשפט אחד".',
    step3_quiz: {
      question: 'מה הכי כדאי לעשות אם ה-AI ענה תשובה מסובכת עם מילים קשות?',
      options: [
        { text: 'לכתוב לו: "תסביר לי שוב ביותר פשוט ובמשפט אחד קצר"', isCorrect: true, explanation: 'נכון מאוד! ה-AI שמח להסביר שוב בצורה נעימה וקלה.' },
        { text: 'לסגור את המחשב ולחשוב ש-AI לא מתאים לי', isCorrect: false, explanation: 'ממש לא! רק צריך להנחות אותו לדבר פשוט יותר.' }
      ]
    },
    step4_action: {
      prompt: 'זה היה קצת ארוך. תסביר לי שוב ב-2 משפטים פשוטים מה תפקיד הראוטר בבית',
      doText: 'העתק וראה איך ה-AI מפשט מיד את ההסבר:'
    }
  },
  {
    id: 'unit_9',
    title: 'בדיקת עובדות: מתי ה-AI מנחש ואיך בודקים אותו',
    category: 'בטיחות וחשיבה ביקורתית',
    goal: 'להבין שבינה מלאכותית אינה יודעת הכל, וללמוד איך לבדוק דברים חשובים מול אבא או גורם מוסמך.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'האם התרופה הזו מתאימה לי לכאב ראש?',
      badResult: 'אני מודל שפה ואינני רופא. אין ליטול תרופות על סמך ייעוץ ממוחשב.',
      goodPrompt: 'איזה רופא עליי לשאול לגבי כאב ראש, ואיך מנסחים שאלה לבדיקה אצל הרופא?',
      goodResult: 'פונים לרופא המשפחה. אפשר להגיד לו בפשטות: "שלום דוקטור, כואב לי הראש מאתמול בצד ימין, מה כדאי לבדוק?".'
    },
    step2_takeaway: 'בנושאי בריאות, כספים ותרופות – שואלים תמיד רופא או את אבא, ולא מסתמכים רק על מחשב!',
    step3_quiz: {
      question: 'מי הסמכות הכי טובה לבדוק איתה האם עצה רפואית או כספית היא נכונה?',
      options: [
        { text: 'אבא, רופא מוסמך או איש מקצוע אמיתי', isCorrect: true, explanation: 'אלופים! אנשי מקצוע ומשפחה מבינים את המצב האמיתי שלנו.' },
        { text: 'צ\'אט בוט באינטרנט שאומר שהוא יודע הכל', isCorrect: false, explanation: 'מסוכן! מחשב אינו מכיר את הגוף שלך ועלול לנחש שטויות.' }
      ]
    },
    step4_action: {
      prompt: 'תן לי 2 שאלות קצרות וברורות לשאול את רופא המשפחה לגבי תזונה בריאה',
      doText: 'העתק וראה שאלות מסודרות לשיחה עם רופא:'
    }
  },
  {
    id: 'unit_10',
    title: 'בדיקת תקלה פשוטה במחשב לפני שנלחצים',
    category: 'מחשבים ותקלות',
    goal: 'להשתמש ב-AI כעוזר רגוע שנותן 2 בדיקות קלות כשיש תקלה במחשב.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'המחשב לא עובד מה עושים דחוף',
      badResult: 'אנא פתח את לוח הבקרה, בדוק את מנהל ההתקנים, ערוך את הרג\'יסטרי ובצע אתחול לכרטיס הרשת...',
      goodPrompt: 'המסך של המחשב לא נדלק. תן לי 2 בדיקות הכי פשוטות שאפשר לבדוק עם הידיים בלי מילים קשות',
      goodResult: '1. בדוק אם כבל החשמל מחובר חזק לשקע בקיר ולגב המסך.\n2. חפש את כפתור ההדלקה של המסך ולחץ עליו כדי לוודא שנדלקת נורית קטנה.'
    },
    step2_takeaway: 'כשמשהו לא עובד במחשב, לא נלחצים! שואלים את ה-AI על 2 בדיקות פשוטות ופיזיות.',
    step3_quiz: {
      question: 'מה הדבר הראשון שכדאי לבדוק כשהמחשב או המסך לא נדלקים?',
      options: [
        { text: 'לבדוק שכבלי החשמל מחוברים היטב לשקע ולמכשיר', isCorrect: true, explanation: 'מדויק! ברוב המקרים הכבל פשוט זז קצת החוצה.' },
        { text: 'לקנות מיד מחשב חדש בחנות', isCorrect: false, explanation: 'חבל על הכסף! קודם בודקים חיבור חשמל פשוט.' }
      ]
    },
    step4_action: {
      prompt: 'הרמקול במחשב לא משמיע קול. תן לי 2 בדיקות הכי קלות לבדוק בעצמי',
      doText: 'העתק וראה איך בדיקות פשוטות פותרות תקלות:'
    }
  }
];

// ============================================================================
// 2. מבחני השלב (Checkpoints) - מבחן כל 2 יחידות עם בנק שאלות אקראי
// ============================================================================
const CHECKPOINTS = [
  {
    id: 'cp_1',
    afterUnitIndex: 1, // אחרי יחידות 1 ו-2
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
    afterUnitIndex: 3, // אחרי יחידות 3 ו-4
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
          { text: 'לא אקליד לעולם את הסיסמה ואספר מיד לאבא', isCorrect: true },
          { text: 'אקליד מיד את הסיסמה כי ביקשו יפה', isCorrect: false },
          { text: 'אשלח את הסיסמה לחבר בוואטסאפ שיבדוק', isCorrect: false }
        ]
      },
      {
        question: 'למה כדאי להגדיר ל-AI "מרכיבים שיש בכל בית" כשמבקשים אוכל?',
        options: [
          { text: 'כדי שנוכל להכין מיד ולא נצטרך לקנות מוצרים יקרים ונדירים', isCorrect: true },
          { text: 'כי ל-AI אסור להשתמש בחומרים מהסופר', isCorrect: false },
          { text: 'זה לא משנה שום דבר במתכון', isCorrect: false }
        ]
      },
      {
        question: 'איפה הכי בטוח לשמור סיסמאות אישיות לחשבונות?',
        options: [
          { text: 'בזיכרון או במחברת סודית ובטוחה בבית, לא בצ\'אטים ציבוריים', isCorrect: true },
          { text: 'לפרסם בפוסט ציבורי ברשת', isCorrect: false },
          { text: 'לשלוח לכל מי שמבקש במייל', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_3',
    afterUnitIndex: 5, // אחרי יחידות 5 ו-6
    title: 'מבחן שלב 3: תעסוקה, ראיונות ושכר 🎯',
    description: 'בדיקת מוכנות לראיונות עבודה והבנת הבדלי שכר ברוטו מול נטו (דרוש ציון 85+ לפתיחת יחידות 7-8)',
    unlocksUnitIndex: 6, // פותח יחידה 7
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'מה ההבדל המרכזי בין שכר ברוטו לשכר נטו בתלוש המשכורת?',
        options: [
          { text: 'ברוטו הוא הסכום לפני מיסים, ונטו הוא הכסף שנכנס לבנק בפועל', isCorrect: true },
          { text: 'נטו הוא הסכום הגבוה על הנייר וברוטו זה מה שמקבלים', isCorrect: false },
          { text: 'אין שום הבדל, שניהם אותו סכום בדיוק', isCorrect: false }
        ]
      },
      {
        question: 'איך הכי מועיל להשתמש ב-AI כדי להתאמן לקראת ראיון עבודה?',
        options: [
          { text: 'לבקש ממנו לשאול "שאלה אחת קלה בכל פעם" ולתרגל מענה בנחת', isCorrect: true },
          { text: 'לבקש ממנו לקרוא מאמר אקדמי של שעה', isCorrect: false },
          { text: 'להגיד לו שיעשה את הראיון במקומנו', isCorrect: false }
        ]
      },
      {
        question: 'איזה כסף משמש אותך לקניות, תשלומים וחסכון בסוף החודש?',
        options: [
          { text: 'השכר נטו שנכנס לחשבון הבנק', isCorrect: true },
          { text: 'השכר ברוטו לפני שהורידו מיסים וביטוחים', isCorrect: false },
          { text: 'סכום המס ששולם למדינה', isCorrect: false }
        ]
      },
      {
        question: 'כשמראיין שואל: "ספר לי על עצמך", מה כדאי להשיב?',
        options: [
          { text: '2-3 משפטים חיוביים על מה שאני אוהב לעשות ואיך אני אוהב לעזור', isCorrect: true },
          { text: 'לשתוק ולא לענות כלום', isCorrect: false },
          { text: 'לספר על כל הסרטים שראיתי בשנה האחרונה', isCorrect: false }
        ]
      },
      {
        question: 'מה זה חיסכון לפנסיה שרואים שמנוכה בתלוש השכר?',
        options: [
          { text: 'כסף ששומרים עבורך בצד כדי שתהיה לך הכנסה מסודרת כשתפרוש בעתיד', isCorrect: true },
          { text: 'קנס שהמנהל לוקח לעצמו', isCorrect: false },
          { text: 'כסף שהולך לאיבוד ולא חוזר לעולם', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_4',
    afterUnitIndex: 7, // אחרי יחידות 7 ו-8
    title: 'מבחן שלב 4: ארגון משימות ודיוק בקשות 🎯',
    description: 'בדיקת יכולת ארגון משימות בעבודה ובקשת הבהרות מ-AI (דרוש ציון 85+ לפתיחת יחידות 9-10)',
    unlocksUnitIndex: 8, // פותח יחידה 9
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'קיבלת מהמנהל רשימת הוראות מבולבלת. איך תבקש מה-AI לעזור לך?',
        options: [
          { text: 'להדביק את ההוראות ולבקש: "סדר לי את זה בנקודות קצרות 1, 2, 3 לפי סדר ביצוע"', isCorrect: true },
          { text: 'לבקש ממנו להמציא משימות חדשות שלא קשורות', isCorrect: false },
          { text: 'למחוק הכל ולא לעשות כלום', isCorrect: false }
        ]
      },
      {
        question: 'ה-AI ענה לך הסבר טכני עם 4 פסקאות ארוכות. מה הפעולה המדויקת ביותר?',
        options: [
          { text: 'לכתוב לו: "זה היה ארוך מדי, תסביר לי ב-2 משפטים פשוטים עם משל מהחיים"', isCorrect: true },
          { text: 'להתעצבן עליו ולסגור את החלון', isCorrect: false },
          { text: 'להדפיס את ההסבר המסובך בלי לקרוא', isCorrect: false }
        ]
      },
      {
        question: 'מדוע כדאי לסדר משימות בעבודה לפי סדר ביצוע ממוספר?',
        options: [
          { text: 'כי קל לבצע משימה אחת, לסמן וי, ואז לדעת בדיוק מה השלב הבא בלי לחץ', isCorrect: true },
          { text: 'כדי להראות שעשינו הרבה דפים', isCorrect: false },
          { text: 'אין לזה שום משמעות בעבודה', isCorrect: false }
        ]
      },
      {
        question: 'האם המחשב וה-AI נעלבים כשמבקשים מהם לתקן או לפשט תשובה?',
        options: [
          { text: 'ממש לא! הוא מכונה סבלנית שאוהבת שמבקשים ממנה לפשט ולהסביר שוב', isCorrect: true },
          { text: 'כן, הוא ייעלב ויפסיק לענות', isCorrect: false },
          { text: 'הוא יכעס וינעל את המחשב', isCorrect: false }
        ]
      },
      {
        question: 'איך כדאי להתחיל יום עבודה כשיש לנו כמה משימות שונות?',
        options: [
          { text: 'לעשות רשימה קצרה וברורה של סדר המשימות מהחשובה לפחות חשובה', isCorrect: true },
          { text: 'להתחיל את כל המשימות בו-זמנית ולהשאיר הכל פתוח', isCorrect: false },
          { text: 'לחכות שמישהו אחר יעשה הכל במקומנו', isCorrect: false }
        ]
      }
    ]
  },
  {
    id: 'cp_5',
    afterUnitIndex: 9, // אחרי יחידות 9 ו-10
    title: 'מבחן גמר מסכם: בטיחות, ביקורתיות ועצמאות דיגיטלית 🏆',
    description: 'מבחן מסכם של כל הידע: מתי לא סומכים על AI, פתרון תקלות פשוטות ובדיקות פיזיות (ציון 85+)',
    unlocksUnitIndex: null, // סיום המסלול
    isPassed: false,
    lastScore: null,
    questionBank: [
      {
        question: 'האם מותר לסמוך על AI לגבי מינון תרופות או טיפול רפואי אישי?',
        options: [
          { text: 'בשום אופן לא! שואלים אך ורק רופא אמיתי או את אבא', isCorrect: true },
          { text: 'כן, המחשב יודע הכל על רפואה', isCorrect: false },
          { text: 'כן, אם הוא עונה בצורה מנומסת', isCorrect: false }
        ]
      },
      {
        question: 'מה הדבר הראשון שבודקים כשהמסך או הרמקול במחשב לא עובדים?',
        options: [
          { text: 'בדיקה פיזית פשוטה: שכבל החשמל מחובר חזק והאור הדולק במכשיר', isCorrect: true },
          { text: 'לקרוא מיד לטכנאי שיפרק את כל המחשב', isCorrect: false },
          { text: 'לזרוק את המסך לפח ולקנות חדש', isCorrect: false }
        ]
      },
      {
        question: 'מה זה אומר שבינה מלאכותית לפעמים "הוזה" (מנחשת מילים)?',
        options: [
          { text: 'שהיא כותבת משפטים שנשמעים הגיוניים, אבל העובדות בהם לא תמיד נכונות', isCorrect: true },
          { text: 'שהיא רואה חלומות בלילה', isCorrect: false },
          { text: 'שהיא אף פעם לא טועה', isCorrect: false }
        ]
      },
      {
        question: 'איזה כלל מבין 5 כללי הזהב מגן עליך מפני הונאות וגניבת פרטים ברשת?',
        options: [
          { text: 'פרטיות לפני הכל: לעולם לא חולקים תעודת זהות, סיסמאות או אשראי', isCorrect: true },
          { text: 'לכתוב הודעות ארוכות ככל האפשר', isCorrect: false },
          { text: 'להסכים לכל בקשה שמופיעה באתר', isCorrect: false }
        ]
      },
      {
        question: 'כיצד שימוש נכון ב-AI הופך אותך לעצמאי, מקצועי ובטוח יותר?',
        options: [
          { text: 'הוא כלי עזר חכם שנותן טיוטות ורעיונות, אבל אני זה שמחליט ובודק מה נכון', isCorrect: true },
          { text: 'הוא עושה הכל במקומי ואני לא צריך לחשוב', isCorrect: false },
          { text: 'הוא מחליף את החברים ואת המשפחה', isCorrect: false }
        ]
      }
    ]
  }
];

// מודל נתוני המערכת
let appState = {
  currentView: 'daniel',
  units: [...DEFAULT_UNITS],
  checkpoints: [...CHECKPOINTS],
  stats: {
    totalCompleted: 0,
    checkpointsPassed: 0,
    totalQuizzes: 0,
    correctQuizzes: 0
  },
  reinforcementLog: [],
  apiConfig: {
    geminiKey: '',
    groqKey: '',
    ollamaUrl: 'http://localhost:11434'
  },
  ttsEnabled: true
};

// ============================================================================
// 3. בדיקת נעילת שבת
// ============================================================================
function isShabbatNow() {
  const now = new Date();
  const day = now.getDay(); // 0=ראשון, 5=שישי, 6=שבת
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;

  // יום שישי החל משעה 16:30 ועד מוצאי שבת בשעה 20:30
  if (day === 5 && timeVal >= 16.5) return true;
  if (day === 6 && timeVal < 20.5) return true;
  return false;
}

let shabbatBypassed = false;
function checkAndApplyShabbatLock() {
  const screen = document.getElementById('shabbat-screen');
  if (!screen) return;
  if (isShabbatNow() && !shabbatBypassed) {
    screen.classList.add('active');
  } else {
    screen.classList.remove('active');
  }
}

// ============================================================================
// 4. מנוע קול ודיבור (TTS) וצלילי הצלחה
// ============================================================================
const SoundService = {
  playSuccessSound() {
    try {
      const audio = document.getElementById('success-sound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  },

  speakHebrew(text) {
    if (!appState.ttsEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`]/g, '').trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'he-IL';
      utterance.rate = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const heVoice = voices.find(v => v.lang.startsWith('he') || v.lang === 'he_IL');
      if (heVoice) utterance.voice = heVoice;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS error:', err);
    }
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
};

// ============================================================================
// 5. מנוע AI רב-שכבתי: תעדוף Gemini (Priority 1) עם Fallback ל-Groq
// ============================================================================
const AIService = {
  activeGeminiModel: null,
  activeGroqModel: null,

  async getAvailableGeminiModels(key) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`, {
        method: 'GET'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          const valid = data.models
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(id => !id.includes('embedding') && !id.includes('aqa') && !id.includes('imagen'));
          if (valid.length > 0) {
            const flash = valid.filter(m => m.includes('flash'));
            return flash.length > 0 ? flash : valid;
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch Gemini models dynamically', e);
    }
    return [
      'gemini-2.5-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash'
    ];
  },

  async getAvailableGroqModels(key) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key.trim()}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          const chat = data.data
            .map(m => m.id)
            .filter(id => !id.includes('whisper') && !id.includes('orpheus') && !id.includes('tts') && !id.includes('guard'));
          if (chat.length > 0) return chat;
        }
      }
    } catch (e) {
      console.warn('Could not fetch Groq models dynamically', e);
    }
    return ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'allam-2-7b', 'openai/gpt-oss-120b'];
  },

  async callGemini(key, prompt, sysInst) {
    const models = this.activeGeminiModel
      ? [this.activeGeminiModel, 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash']
      : await this.getAvailableGeminiModels(key);

    let lastErr = null;
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.trim()}`;
        const payload = {
          systemInstruction: { parts: [{ text: sysInst }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let errorMsg = `Gemini HTTP error ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) {
              errorMsg = errData.error.message;
            }
          } catch (e) {}
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          this.activeGeminiModel = model;
          return text;
        }
      } catch (err) {
        lastErr = err;
        if (!err.message.toLowerCase().includes('not found') && !err.message.includes('404')) {
          throw err;
        }
      }
    }
    throw lastErr || new Error('Gemini call failed');
  },

  async callGroq(key, prompt, sysInst) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const models = this.activeGroqModel 
      ? [this.activeGroqModel, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'allam-2-7b', 'openai/gpt-oss-120b']
      : await this.getAvailableGroqModels(key);
    let lastErr = null;

    for (const model of models) {
      try {
        const payload = {
          model: model,
          messages: [
            ...(sysInst ? [{ role: 'system', content: sysInst }] : []),
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key.trim()}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let errorMsg = `Groq HTTP error ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) {
              errorMsg = errData.error.message;
            }
          } catch (e) {}
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const msgObj = data.choices?.[0]?.message || {};
        const content = (msgObj.content || msgObj.reasoning_content || '').trim();
        if (content) {
          this.activeGroqModel = model;
          return content;
        }
      } catch (err) {
        lastErr = err;
        if (!err.message.toLowerCase().includes('model') && !err.message.includes('404')) {
          throw err;
        }
      }
    }
    throw lastErr || new Error('Groq call failed');
  },

  async callOllama(url, prompt, sysInst) {
    const endpoint = `${url.replace(/\/+$/, '')}/api/generate`;
    const payload = {
      model: 'llama3',
      prompt: `${sysInst ? sysInst + '\n\n' : ''}${prompt}`,
      stream: false
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Ollama HTTP error ${response.status}`);
    const data = await response.json();
    return data.response;
  },

  // תעדוף ראשי: 1. Gemini -> 2. Groq -> 3. Ollama -> 4. מנוע מקומי
  async callLessonGeneratorWithFallback(userPrompt, sysInst) {
    const cfg = appState.apiConfig;

    // 1. נסיון Gemini (עדיפות עליונה)
    if (cfg.geminiKey && cfg.geminiKey.trim()) {
      try {
        const res = await this.callGemini(cfg.geminiKey.trim(), userPrompt, sysInst);
        if (res) return { text: res, provider: `Google Gemini (${this.activeGeminiModel || 'Flash'})` };
      } catch (err) {
        console.warn('Gemini call failed, fallback to Groq...', err);
      }
    }

    // 2. נסיון Groq
    if (cfg.groqKey && cfg.groqKey.trim()) {
      try {
        const res = await this.callGroq(cfg.groqKey.trim(), userPrompt, sysInst);
        if (res) return { text: res, provider: `Groq (${this.activeGroqModel || 'GPT-OSS'})` };
      } catch (err) {
        console.warn('Groq call failed, fallback to Ollama...', err);
      }
    }

    // 3. נסיון Ollama
    if (cfg.ollamaUrl && cfg.ollamaUrl.trim()) {
      try {
        const res = await this.callOllama(cfg.ollamaUrl.trim(), userPrompt, sysInst);
        if (res) return { text: res, provider: 'Local Ollama' };
      } catch (err) {
        console.warn('Local Ollama failed...', err);
      }
    }

    const offlineRes = this.synthesizeOfflineUnit(userPrompt);
    return { text: offlineRes, provider: 'מנוע פנימי חכם (Offline Fallback)' };
  },

  // בדיקות קישוריות עצמאיות עם אינדיקטור התקדמות
  async testGemini(key, onProgress) {
    if (!key || !key.trim()) return { success: false, error: 'לא הוזן מפתח API של Gemini.' };
    const startTime = performance.now();
    if (onProgress) onProgress('מאתר מודלים זמינים ב-Google AI Studio...');
    const models = await this.getAvailableGeminiModels(key);
    let lastError = null;

    for (const model of models) {
      if (onProgress) onProgress(`בודק מודל ${model}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.trim()}`;
        const payload = { contents: [{ parts: [{ text: 'ענה במילה אחת בלבד: שלום' }] }] };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const latency = Math.round(performance.now() - startTime);

        if (!response.ok) {
          let msg = `Gemini HTTP error ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) msg = errData.error.message;
          } catch (e) {}
          lastError = msg;
          if (msg.toLowerCase().includes('not found') || response.status === 404) continue;
          return { success: false, error: msg, latency, model };
        }

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
        this.activeGeminiModel = model;
        return { success: true, latency, reply, model, provider: `Google Gemini (${model})` };
      } catch (e) {
        lastError = e.message || 'שגיאת רשת / חיבור';
      }
    }
    const latency = Math.round(performance.now() - startTime);
    return { success: false, error: lastError || 'בדיקת Gemini נכשלה', latency };
  },

  async testGroq(key, onProgress) {
    if (!key || !key.trim()) return { success: false, error: 'לא הוזן מפתח API של Groq.' };
    const startTime = performance.now();
    if (onProgress) onProgress('מאתר מודלים פעילים בחשבון Groq...');
    const models = await this.getAvailableGroqModels(key);
    let lastError = null;

    for (const model of models) {
      if (onProgress) onProgress(`בודק מודל ${model}...`);
      try {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const payload = {
          model: model,
          messages: [{ role: 'user', content: 'ענה במילה אחת בלבד: שלום' }],
          max_tokens: 300,
          temperature: 0.2
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key.trim()}`
          },
          body: JSON.stringify(payload)
        });
        const latency = Math.round(performance.now() - startTime);

        if (!response.ok) {
          let msg = `Groq HTTP error ${response.status}`;
          try {
            const errData = await response.json();
            if (errData && errData.error && errData.error.message) msg = errData.error.message;
          } catch (e) {}
          lastError = msg;
          if (msg.toLowerCase().includes('model') || response.status === 404) continue;
          return { success: false, error: msg, latency, model };
        }

        const data = await response.json();
        const msgObj = data.choices?.[0]?.message || {};
        const reply = (msgObj.content || msgObj.reasoning_content || '').trim() || 'OK';
        this.activeGroqModel = model;
        return { success: true, latency, reply, model, provider: `Groq (${model})` };
      } catch (e) {
        lastError = e.message || 'שגיאת רשת / חיבור';
      }
    }
    const latency = Math.round(performance.now() - startTime);
    return { success: false, error: lastError || 'בדיקת Groq נכשלה', latency };
  },

  async testOllama(url, onProgress) {
    const rawUrl = url ? url.trim() : 'http://localhost:11434';
    const baseUrl = rawUrl.replace(/\/+$/, '');
    const startTime = performance.now();
    if (onProgress) onProgress('בודק תקשורת מקומית עם Ollama...');
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      const latency = Math.round(performance.now() - startTime);
      if (!response.ok) return { success: false, error: `Ollama HTTP error ${response.status}`, latency };
      const data = await response.json();
      const models = (data.models || []).map(m => m.name).join(', ') || 'אין מודלים מותקנים עדיין';
      return { success: true, latency, reply: `מודלים זמינים: ${models}`, provider: 'Local Ollama' };
    } catch (e) {
      const latency = Math.round(performance.now() - startTime);
      return { success: false, error: `לא ניתן להתחבר ל-Ollama בכתובת (${baseUrl}).`, latency };
    }
  },

  synthesizeOfflineUnit(prompt) {
    const p = prompt.toLowerCase();
    let title = 'יחידה מותאמת אישית';
    let goodPrompt = 'תסביר לי ב-2 משפטים קצרים ובמילים פשוטות';
    let takeaway = 'כשמבקשים מה-AI להסביר קצר ובמילים פשוטות, הוא עונה בדיוק מה שצריך!';
    let question = 'איך כדאי לבקש מה-AI תשובה פשוטה ומהירה?';
    let correctOpt = 'להגדיר לו לענות ב-2 משפטים קצרים ובלי מילים קשות';
    let wrongOpt = 'לבקש ממנו לכתוב ספר שלם';

    if (p.includes('סוכן') || p.includes('agent')) {
      title = 'סוכן AI: איך מבקשים משימה מורכבת שלב אחרי שלב';
      goodPrompt = 'תעזור לי לחלק משימה גדולה ל-3 צעדים ברורים שנוח לבצע ברצף';
      takeaway = 'סוכן AI עובד הכי טוב כשנותנים לו מטרה ברורה ומבקשים צעדים מסודרים!';
      question = 'מה הדרך הכי נכונה להפעיל סוכן AI למשימה בעבודה?';
      correctOpt = 'להגדיר לו יעד ברור ולבקש לבצע שלב אחר שלב';
      wrongOpt = 'לתת הוראה מעורפלת ולתת לו לנחש לבד';
    }

    const unitJson = {
      id: 'custom_unit_' + Date.now(),
      title: title,
      category: 'יחידה מותאמת',
      goal: 'ללמוד איך לבקש את הפעולה הזו במדויק מ-AI.',
      isUnlocked: true,
      isCompleted: false,
      step1_demo: {
        badPrompt: 'תעשה לי את זה',
        badResult: 'מה בדיוק לעשות? אין לי מספיק פרטים.',
        goodPrompt: goodPrompt,
        goodResult: 'הנה בדיוק מה שביקשת, בצורה פשוטה, ברורה ומסודרת!'
      },
      step2_takeaway: takeaway,
      step3_quiz: {
        question: question,
        options: [
          { text: correctOpt, isCorrect: true, explanation: 'בול! זו הדרך הכי מדויקת לבקש.' },
          { text: wrongOpt, isCorrect: false, explanation: 'זה יעשה את התוצאה מבלבלת או קשה מדי.' }
        ]
      },
      step4_action: {
        prompt: goodPrompt,
        doText: 'העתק את הפרומפט ובדוק את התוצאה המצוינת:'
      }
    };

    return JSON.stringify(unitJson, null, 2);
  }
};

// ============================================================================
// 6. שיתוף מהיר לאבא ב-WhatsApp ובמייל
// ============================================================================
function shareProgressToWhatsApp(msgText) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
  window.open(url, '_blank');
}

function shareProgressToEmail(subject, bodyText) {
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.open(url, '_blank');
}

// ============================================================================
// 7. ניהול נתוני המערכת ושמירה (Storage)
// ============================================================================
function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState = {
        ...appState,
        ...parsed,
        units: parsed.units && parsed.units.length > 0 ? parsed.units : [...DEFAULT_UNITS],
        checkpoints: parsed.checkpoints && parsed.checkpoints.length > 0 ? parsed.checkpoints : [...CHECKPOINTS],
        stats: parsed.stats || appState.stats,
        reinforcementLog: parsed.reinforcementLog || [],
        apiConfig: { ...appState.apiConfig, ...(parsed.apiConfig || {}) }
      };
    }
  } catch (e) {
    console.error('Error loading state:', e);
  }
}

function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ============================================================================
// 8. רינדור אזור דניאל (כולל יחידות ותחנות מבחן שלב)
// ============================================================================
function renderDanielView() {
  const grid = document.getElementById('units-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const completedUnits = appState.units.filter(u => u.isCompleted).length;
  const passedCPs = appState.checkpoints.filter(c => c.isPassed).length;
  const totalItems = appState.units.length + appState.checkpoints.length;
  const currentProgress = completedUnits + passedCPs;
  const percent = totalItems > 0 ? Math.round((currentProgress / totalItems) * 100) : 0;

  const fill = document.getElementById('daniel-progress-fill');
  const label = document.getElementById('daniel-progress-percent');
  const summary = document.getElementById('progress-summary-text');
  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
  if (summary) summary.textContent = `השלמת ${completedUnits} יחידות ו-${passedCPs} מבחני שלב בהצלחה! ⭐`;

  // הרכבת המסלול: כל 2 יחידות מוכנסת תחנת מבחן
  appState.units.forEach((unit, idx) => {
    // 1. כרטיס יחידת הלימוד
    const card = document.createElement('div');
    card.className = `unit-card ${unit.isCompleted ? 'completed' : ''} ${!unit.isUnlocked ? 'locked' : ''}`;
    
    let badgeHtml = '';
    if (unit.isCompleted) badgeHtml = '<span class="unit-badge done">הושלם בהצלחה ⭐</span>';
    else if (unit.isUnlocked) badgeHtml = '<span class="unit-badge active">מוכן ללמידה 🚀</span>';
    else badgeHtml = '<span class="unit-badge locked">נעול 🔒</span>';

    card.innerHTML = `
      <div class="unit-card-header">
        <span class="unit-index">יחידה ${idx + 1}</span>
        ${badgeHtml}
      </div>
      <h3 class="unit-title">${unit.title}</h3>
      <p class="unit-goal">${unit.goal}</p>
      <div class="unit-card-footer">
        <span class="unit-cat-tag">${unit.category || 'כללי'}</span>
        <button class="unit-play-btn ${!unit.isUnlocked ? 'disabled' : ''}">
          ${unit.isCompleted ? 'תרגל שוב 🔄' : (unit.isUnlocked ? 'התחל ללמוד! 🌟' : 'נעול כרגע 🔒')}
        </button>
      </div>
    `;

    if (unit.isUnlocked) {
      card.onclick = () => openLessonRunner(unit);
    } else {
      card.onclick = () => showToast('עליך לסיים את היחידות ומבחן השלב הקודמים כדי לפתוח יחידה זו! 💪');
    }
    grid.appendChild(card);

    // 2. בדיקה האם יש תחנת מבחן מיד אחרי היחידה הזו
    const cp = appState.checkpoints.find(c => c.afterUnitIndex === idx);
    if (cp) {
      // המבחן פתוח רק אם היחידות שקדמו לו הושלמו
      const prevUnit1 = appState.units[idx - 1];
      const prevUnit2 = appState.units[idx];
      const isCpUnlocked = prevUnit1 && prevUnit1.isCompleted && prevUnit2 && prevUnit2.isCompleted;

      const cpCard = document.createElement('div');
      cpCard.className = `checkpoint-card ${!isCpUnlocked ? 'locked' : ''} ${cp.isPassed ? 'passed' : ''}`;
      
      let cpBadge = '';
      if (cp.isPassed) cpBadge = `<span class="checkpoint-badge" style="background:#ecfdf5;color:#059669;">עברת בהצלחה (ציון: ${cp.lastScore}) 🏆</span>`;
      else if (isCpUnlocked) cpBadge = '<span class="checkpoint-badge" style="background:#fef3c7;color:#b45309;">מוכן למבחן שלב! 🎯</span>';
      else cpBadge = '<span class="checkpoint-badge" style="background:#e2e8f0;color:#64748b;">נעול (סיים 2 יחידות) 🔒</span>';

      cpCard.innerHTML = `
        <div>
          ${cpBadge}
          <h3 style="font-size:1.25rem;margin:0.4rem 0;color:#1e293b;">${cp.title}</h3>
          <p style="font-size:0.92rem;color:#475569;margin-bottom:1rem;">${cp.description}</p>
        </div>
        <div>
          <button class="primary-btn" style="width:100%;font-size:0.95rem;padding:0.6rem 1rem;${!isCpUnlocked ? 'opacity:0.5;cursor:not-allowed;' : ''}">
            ${cp.isPassed ? 'בצע מבחן שוב 🔄' : (isCpUnlocked ? 'התחל מבחן שלב! 🎯' : 'נעול 🔒')}
          </button>
        </div>
      `;

      if (isCpUnlocked) {
        cpCard.onclick = () => openCheckpointModal(cp);
      } else {
        cpCard.onclick = () => showToast('תחנת מבחן זו תיפתח ברגע שתסיים את 2 יחידות הלימוד שמעליה! 🌟');
      }

      grid.appendChild(cpCard);
    }
  });
}

// ============================================================================
// 9. חלון ריצת יחידת לימוד (4 שלבים)
// ============================================================================
let activeUnit = null;
let currentStep = 1;

function openLessonRunner(unit) {
  activeUnit = unit;
  currentStep = 1;

  document.getElementById('modal-unit-category').textContent = unit.category || 'לימוד AI מותאם';
  document.getElementById('modal-unit-title').textContent = unit.title;
  
  renderLessonStep(currentStep);
  document.getElementById('lesson-modal').classList.add('active');

  SoundService.speakHebrew(`${unit.title}. בוא נתחיל בשלב הראשון!`);
}

function renderLessonStep(step) {
  currentStep = step;
  const content = document.getElementById('modal-body-content');
  const prevBtn = document.getElementById('modal-prev-step-btn');
  const nextBtn = document.getElementById('modal-next-step-btn');

  document.querySelectorAll('.step-dot').forEach(dot => {
    const s = parseInt(dot.getAttribute('data-step'), 10);
    dot.classList.remove('active', 'completed');
    if (s === step) dot.classList.add('active');
    else if (s < step) dot.classList.add('completed');
  });

  prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';

  if (step === 1) {
    nextBtn.textContent = 'הבנתי את ההבדל, המשך לשלב 2 ➡️';
    content.innerHTML = `
      <div class="step-pane">
        <div class="step-guide-box">
          <h3>שלב 1: הדגמת ניגודים (הפרומפט החלש מול המדויק) 👀</h3>
          <p>תראה איך בקשה מטושטשת מבלבלת את ה-AI, ואיך בקשה ממוקדת מביאה תוצאה מושלמת:</p>
        </div>

        <div class="contrast-demo-grid">
          <div class="demo-box bad">
            <div class="demo-tag bad-tag">❌ בקשה מעורפלת:</div>
            <div class="prompt-quote">"${activeUnit.step1_demo.badPrompt}"</div>
            <div class="result-label">מה ה-AI עונה כשלא מדייקים:</div>
            <div class="result-box bad-res">${activeUnit.step1_demo.badResult}</div>
          </div>

          <div class="demo-box good">
            <div class="demo-tag good-tag">✅ בקשה ממוקדת וטובה:</div>
            <div class="prompt-quote">"${activeUnit.step1_demo.goodPrompt}"</div>
            <div class="result-label">מה ה-AI עונה כשמבקשים נכון:</div>
            <div class="result-box good-res">${activeUnit.step1_demo.goodResult}</div>
          </div>
        </div>
      </div>
    `;
    SoundService.speakHebrew(`שלב ראשון. שים לב להבדל בין בקשה מעורפלת לבקשה ממוקדת וטובה.`);
  } 
  else if (step === 2) {
    nextBtn.textContent = 'כלל מעולה! בוא נעבור לשאלה ➡️';
    content.innerHTML = `
      <div class="step-pane">
        <div class="step-guide-box">
          <h3>שלב 2: הכלל הנלמד (התובנה החשובה) 💡</h3>
          <p>הנה הדבר הכי חשוב לזכור מהיחידה הזו:</p>
        </div>

        <div class="takeaway-highlight-card">
          <div class="bulb-icon">💡</div>
          <h2 class="takeaway-text">"${activeUnit.step2_takeaway}"</h2>
        </div>
      </div>
    `;
    SoundService.speakHebrew(`שלב שני, הכלל שלמדנו: ${activeUnit.step2_takeaway}`);
  } 
  else if (step === 3) {
    nextBtn.textContent = 'בדוק את התשובה שלי 🎯';
    nextBtn.disabled = true;

    const quiz = activeUnit.step3_quiz;
    content.innerHTML = `
      <div class="step-pane">
        <div class="step-guide-box">
          <h3>שלב 3: וידוא הבנה מהיר 🧠</h3>
          <p>בחר את התשובה הנכונה ביותר לפי מה שלמדנו הרגע:</p>
        </div>

        <div class="quiz-box">
          <h4 class="quiz-question">${quiz.question}</h4>
          <div class="quiz-options-list" id="quiz-options-container">
            ${quiz.options.map((opt, idx) => `
              <button class="quiz-opt-btn" data-index="${idx}">
                <span class="opt-bullet">${String.fromCharCode(65 + idx)}.</span>
                <span class="opt-text">${opt.text}</span>
              </button>
            `).join('')}
          </div>
          <div id="quiz-feedback-box" class="quiz-feedback" style="display: none;"></div>
        </div>
      </div>
    `;

    document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        handleQuizSelection(idx);
      };
    });

    SoundService.speakHebrew(quiz.question);
  } 
  else if (step === 4) {
    nextBtn.textContent = 'סיימתי את היחידה בהצלחה! 🏆';
    nextBtn.disabled = false;

    const action = activeUnit.step4_action;
    content.innerHTML = `
      <div class="step-pane">
        <div class="step-guide-box">
          <h3>שלב 4: משימת ביצוע אישית 🚀</h3>
          <p>${action.doText}</p>
        </div>

        <div class="action-card">
          <div class="action-prompt-display">
            <code>${action.prompt}</code>
          </div>
          <button id="copy-action-prompt-btn" class="primary-btn" style="margin-top: 1rem;">
            <span>העתק משפט לתרגול 📋</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('copy-action-prompt-btn').onclick = () => {
      navigator.clipboard.writeText(action.prompt).then(() => {
        showToast('המשפט הועתק בהצלחה! 📋');
        SoundService.playSuccessSound();
      });
    };

    SoundService.speakHebrew(`שלב רביעי, משימת ביצוע! העתק את המשפט ובדוק כמה קל לפעול נכון.`);
  }
}

function handleQuizSelection(chosenIdx) {
  const quiz = activeUnit.step3_quiz;
  const option = quiz.options[chosenIdx];
  const fb = document.getElementById('quiz-feedback-box');
  const nextBtn = document.getElementById('modal-next-step-btn');
  const allBtns = document.querySelectorAll('.quiz-opt-btn');

  allBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (quiz.options[i].isCorrect) btn.classList.add('correct');
    else if (i === chosenIdx) btn.classList.add('wrong');
  });

  appState.stats.totalQuizzes++;
  if (option.isCorrect) {
    appState.stats.correctQuizzes++;
    fb.className = 'quiz-feedback success';
    fb.innerHTML = `🌟 <strong>תשובה מעולה דניאל!</strong> ${option.explanation}`;
    fb.style.display = 'block';
    nextBtn.textContent = 'מצוין, המשך לשלב האחרון ➡️';
    nextBtn.disabled = false;
    SoundService.playSuccessSound();
    SoundService.speakHebrew(`תשובה מעולה דניאל! ${option.explanation}`);
  } else {
    logAdaptiveReinforcement(activeUnit, quiz.question, option.text);
    fb.className = 'quiz-feedback warning';
    fb.innerHTML = `💡 <strong>לא נורא, מכל דבר לומדים!</strong> ${option.explanation} נסה שוב.`;
    fb.style.display = 'block';
    
    setTimeout(() => {
      allBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('wrong');
      });
      nextBtn.textContent = 'בחר שוב כדי להמשיך';
      nextBtn.disabled = true;
    }, 2200);
    SoundService.speakHebrew(`לא נורא דניאל. ${option.explanation}`);
  }
  saveAppState();
}

function completeActiveUnit() {
  if (!activeUnit) return;
  activeUnit.isCompleted = true;
  appState.stats.totalCompleted = appState.units.filter(u => u.isCompleted).length;

  const curIdx = appState.units.findIndex(u => u.id === activeUnit.id);
  // אם היחידה הבאה היא עדיין בתוך אותו שלב (למשל סיימנו יחידה 1 ועכשיו יחידה 2), פותחים אותה
  if (curIdx !== -1 && curIdx % 2 === 0 && curIdx + 1 < appState.units.length) {
    appState.units[curIdx + 1].isUnlocked = true;
  }

  saveAppState();
  document.getElementById('lesson-modal').classList.remove('active');
  SoundService.stopSpeaking();

  // הצגת מסך חגיגה עם כפתורי שיתוף מהירים לאבא
  showCelebrationModal(
    `כל הכבוד דניאל! סיימת את יחידה ${curIdx + 1}! ⭐`,
    `השלמת את היחידה "${activeUnit.title}" בהצלחה! ספר לאבא על ההתקדמות שלך:`,
    `היי אבא! הרגע סיימתי בהצלחה את יחידה ${curIdx + 1}: "${activeUnit.title}" במערכת AI! 🎉`
  );

  renderDanielView();
  renderCaregiverOverview();
}

// ============================================================================
// 10. מנוע מבחני שלב (Checkpoints) - שאלות מתחלפות וציון מעל 85
// ============================================================================
let activeCheckpoint = null;
let currentTestQuestions = [];
let currentTestQuestionIdx = 0;
let testUserAnswers = [];

function openCheckpointModal(cp) {
  activeCheckpoint = cp;
  currentTestQuestionIdx = 0;
  testUserAnswers = [];

  // בחירה אקראית של 4 שאלות מתוך בנק השאלות וערבוב תשובות
  const shuffledBank = [...cp.questionBank].sort(() => Math.random() - 0.5);
  currentTestQuestions = shuffledBank.slice(0, 4).map(q => ({
    ...q,
    options: [...q.options].sort(() => Math.random() - 0.5)
  }));

  document.getElementById('checkpoint-title').textContent = cp.title;
  document.getElementById('checkpoint-modal').classList.add('active');

  renderCheckpointQuestion();
}

function renderCheckpointQuestion() {
  const content = document.getElementById('checkpoint-body-content');
  const footerActions = document.getElementById('checkpoint-footer-actions');
  const q = currentTestQuestions[currentTestQuestionIdx];
  const total = currentTestQuestions.length;

  footerActions.innerHTML = `
    <button id="checkpoint-read-aloud-btn" class="secondary-btn" style="margin-left: auto;">
      <span>הקרא שאלה 🔊</span>
    </button>
    <button id="checkpoint-next-btn" class="primary-btn" disabled>
      ${currentTestQuestionIdx + 1 < total ? 'המשך לשאלה הבאה ➡️' : 'סיים והגש מבחן 🏁'}
    </button>
  `;

  document.getElementById('checkpoint-read-aloud-btn').onclick = () => {
    SoundService.speakHebrew(`${q.question}. בחר את התשובה הנכונה.`);
  };

  content.innerHTML = `
    <div style="margin-bottom: 1.2rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <span style="font-weight:700;color:#64748b;">שאלה ${currentTestQuestionIdx + 1} מתוך ${total}</span>
        <span style="font-size:0.85rem;color:#b45309;font-weight:700;">דרוש 85+ למעבר השלב</span>
      </div>
      <div style="background:#e2e8f0;height:6px;border-radius:3px;overflow:hidden;">
        <div style="background:#f59e0b;height:100%;width:${((currentTestQuestionIdx) / total) * 100}%;"></div>
      </div>
    </div>

    <h3 style="font-size:1.25rem;line-height:1.5;margin-bottom:1.5rem;color:#0f172a;">${q.question}</h3>

    <div class="quiz-options-list" id="test-opts-list">
      ${q.options.map((opt, idx) => `
        <button class="quiz-opt-btn" data-opt="${idx}">
          <span class="opt-bullet">${String.fromCharCode(65 + idx)}.</span>
          <span class="opt-text">${opt.text}</span>
        </button>
      `).join('')}
    </div>
  `;

  document.querySelectorAll('#test-opts-list .quiz-opt-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#test-opts-list .quiz-opt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const chosenIdx = parseInt(btn.getAttribute('data-opt'), 10);
      testUserAnswers[currentTestQuestionIdx] = chosenIdx;
      document.getElementById('checkpoint-next-btn').disabled = false;
    };
  });

  document.getElementById('checkpoint-next-btn').onclick = () => {
    if (currentTestQuestionIdx + 1 < total) {
      currentTestQuestionIdx++;
      renderCheckpointQuestion();
    } else {
      finishCheckpointTest();
    }
  };

  SoundService.speakHebrew(`שאלה ${currentTestQuestionIdx + 1}. ${q.question}`);
}

function finishCheckpointTest() {
  const content = document.getElementById('checkpoint-body-content');
  const footerActions = document.getElementById('checkpoint-footer-actions');
  const total = currentTestQuestions.length;

  let correctCount = 0;
  currentTestQuestions.forEach((q, idx) => {
    const chosenIdx = testUserAnswers[idx];
    if (chosenIdx !== undefined && q.options[chosenIdx] && q.options[chosenIdx].isCorrect) {
      correctCount++;
    }
  });

  const finalScore = Math.round((correctCount / total) * 100);
  const isPassed = finalScore >= 85;

  activeCheckpoint.lastScore = finalScore;
  if (isPassed) {
    activeCheckpoint.isPassed = true;
    // פתיחת היחידה הבאה במסלול
    if (activeCheckpoint.unlocksUnitIndex !== null && appState.units[activeCheckpoint.unlocksUnitIndex]) {
      appState.units[activeCheckpoint.unlocksUnitIndex].isUnlocked = true;
    }
    appState.stats.checkpointsPassed = appState.checkpoints.filter(c => c.isPassed).length;
    saveAppState();
    SoundService.playSuccessSound();
  }

  content.innerHTML = `
    <div style="text-align:center;padding:1.5rem 0;">
      <div style="font-size:3.5rem;margin-bottom:0.5rem;">${isPassed ? '🏆 🌟 🎉' : '💡 💪'}</div>
      <h2 style="font-size:1.8rem;color:${isPassed ? '#059669' : '#d97706'};margin-bottom:0.5rem;">
        ציון במבחן: ${finalScore}
      </h2>
      <p style="font-size:1.1rem;line-height:1.6;color:#334155;max-width:480px;margin:0 auto 1.5rem auto;">
        ${isPassed 
          ? `כל הכבוד דניאל! עברת את מבחן השלב בהצלחה מרובה! השלב הבא במסלול נפתח כעת!`
          : `קיבלת ציון ${finalScore}. כדי להמשיך לשלב הבא דרוש ציון 85 ומעלה. לא נורא, מכל ניסיון לומדים! לחץ למטה ונעשה את המבחן שוב עם שאלות חדשות.`}
      </p>

      ${isPassed ? `
        <div style="margin: 1.5rem 0; display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap;">
          <button class="share-whatsapp-btn" onclick="shareProgressToWhatsApp('היי אבא! עברתי בהצלחה את ${activeCheckpoint.title} בציון ${finalScore}! 🏆 היחידות הבאות נפתחו!')">
            <span>שלח עדכון לאבא ב-WhatsApp 📲</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;

  footerActions.innerHTML = isPassed
    ? `<button class="primary-btn" onclick="document.getElementById('checkpoint-modal').classList.remove('active');renderDanielView();renderCaregiverOverview();">מעולה! חזרה למסלול 🌟</button>`
    : `<button class="primary-btn" onclick="openCheckpointModal(activeCheckpoint)">נסה את המבחן שוב עם שאלות חדשות 🔄</button>`;

  SoundService.speakHebrew(isPassed 
    ? `כל הכבוד דניאל! קיבלת ציון ${finalScore} ועברת את מבחן השלב בהצלחה! השלב הבא נפתח כעת.`
    : `קיבלת ציון ${finalScore}. כדי להמשיך צריך 85 ומעלה. לא נורא, ננסה שוב ונעבור יחד!`
  );
}

// ============================================================================
// 11. מסך חגיגה כללי
// ============================================================================
function showCelebrationModal(title, text, shareMsg) {
  const overlay = document.getElementById('celebration-overlay');
  if (!overlay) return;
  document.getElementById('celebration-title').textContent = title;
  document.getElementById('celebration-text').textContent = text;

  document.getElementById('share-wa-btn').onclick = () => shareProgressToWhatsApp(shareMsg);
  document.getElementById('share-mail-btn').onclick = () => shareProgressToEmail('עדכון מדניאל - מערכת AI', shareMsg);

  overlay.classList.add('active');
  SoundService.playSuccessSound();
}

// ============================================================================
// 12. פאנל ניהול, ליווי ויצירת תכנים עם AI (Caregiver Dashboard)
// ============================================================================
function renderCaregiverOverview() {
  const unitsStat = document.getElementById('adm-stat-units');
  const cpStat = document.getElementById('adm-stat-checkpoints');
  const accStat = document.getElementById('adm-stat-accuracy');

  const comp = appState.units.filter(u => u.isCompleted).length;
  const totUnits = appState.units.length;
  if (unitsStat) unitsStat.textContent = `${comp} / ${totUnits}`;

  const passedCP = appState.checkpoints.filter(c => c.isPassed).length;
  const totCP = appState.checkpoints.length;
  if (cpStat) cpStat.textContent = `${passedCP} / ${totCP}`;

  const acc = appState.stats.totalQuizzes > 0 
    ? Math.round((appState.stats.correctQuizzes / appState.stats.totalQuizzes) * 100)
    : 100;
  if (accStat) accStat.textContent = `${acc}%`;

  const tableWrapper = document.getElementById('adm-units-table');
  if (tableWrapper) {
    tableWrapper.innerHTML = `
      <table class="styled-table">
        <thead>
          <tr>
            <th>#</th>
            <th>שם הפעילות</th>
            <th>סוג</th>
            <th>סטטוס למידה</th>
            <th>פעולות מלווה</th>
          </tr>
        </thead>
        <tbody>
          ${appState.units.map((u, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${u.title}</strong></td>
              <td><span class="badge-tag">יחידת לימוד</span></td>
              <td>
                ${u.isCompleted 
                  ? '<span class="badge-tag" style="background:#ecfdf5;color:#059669;">הושלם ⭐</span>'
                  : (u.isUnlocked ? '<span class="badge-tag" style="background:#eff6ff;color:#2563eb;">זמין ללמידה</span>' : '<span class="badge-tag" style="background:#f1f5f9;color:#64748b;">נעול</span>')}
              </td>
              <td>
                <button class="small-action-btn" onclick="toggleUnitUnlocked('${u.id}')">
                  ${u.isUnlocked ? 'נעל 🔒' : 'פתח לדניאל 🔓'}
                </button>
              </td>
            </tr>
          `).join('')}
          ${appState.checkpoints.map((c, i) => `
            <tr style="background:#fffbeb;">
              <td>🎯</td>
              <td><strong>${c.title}</strong></td>
              <td><span class="badge-tag" style="background:#fef3c7;color:#b45309;">מבחן שלב (85+)</span></td>
              <td>
                ${c.isPassed 
                  ? `<span class="badge-tag" style="background:#ecfdf5;color:#059669;">עבר (ציון: ${c.lastScore}) 🏆</span>` 
                  : (c.lastScore !== null ? `<span class="badge-tag" style="background:#fef2f2;color:#991b1b;">נכשל (ציון: ${c.lastScore})</span>` : 'טרם נבחן')}
              </td>
              <td>
                <button class="small-action-btn" onclick="toggleCheckpointPassed('${c.id}')">
                  ${c.isPassed ? 'אפס מבחן 🔄' : 'אשר כעבר ✅'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const reinfList = document.getElementById('adm-reinforce-list');
  if (reinfList) {
    if (appState.reinforcementLog.length === 0) {
      reinfList.innerHTML = '<p class="empty-note">אין כרגע נקודות קושי מיוחדות. דניאל מתקדם בצורה מעולה! 🌟</p>';
    } else {
      reinfList.innerHTML = appState.reinforcementLog.map(r => `
        <div class="feedback-item">
          <div class="fb-meta"><strong>${r.unitTitle}</strong> &bull; <span>${r.timestamp}</span></div>
          <p class="fb-desc"><strong>השאלה שנשאלה:</strong> ${r.question}</p>
          <p class="fb-desc"><strong>התשובה שנבחרה:</strong> ${r.chosenOption}</p>
          <div class="fb-action">💡 <strong>המלצת המערכת למלווה:</strong> ${r.recommendedAction}</div>
        </div>
      `).join('');
    }
  }

  renderUnitsManagerList();
}

function toggleUnitUnlocked(unitId) {
  const u = appState.units.find(x => x.id === unitId);
  if (u) {
    u.isUnlocked = !u.isUnlocked;
    saveAppState();
    renderCaregiverOverview();
    renderDanielView();
    showToast(`סטטוס היחידה עודכן ל: ${u.isUnlocked ? 'פתוחה ללמידה' : 'נעולה'}`);
  }
}

function toggleCheckpointPassed(cpId) {
  const c = appState.checkpoints.find(x => x.id === cpId);
  if (c) {
    c.isPassed = !c.isPassed;
    if (c.isPassed && c.unlocksUnitIndex !== null && appState.units[c.unlocksUnitIndex]) {
      appState.units[c.unlocksUnitIndex].isUnlocked = true;
    }
    saveAppState();
    renderCaregiverOverview();
    renderDanielView();
    showToast(`סטטוס המבחן עודכן בהצלחה.`);
  }
}

function renderUnitsManagerList() {
  const mgrList = document.getElementById('mgr-units-list');
  if (!mgrList) return;

  mgrList.innerHTML = appState.units.map((u, i) => `
    <div class="mgr-card">
      <div class="mgr-card-info">
        <h4>${i + 1}. ${u.title}</h4>
        <p>${u.goal}</p>
      </div>
      <div class="mgr-card-actions">
        <button class="secondary-btn" onclick="editUnitInModal('${u.id}')">ערוך ✏️</button>
        <button class="danger-btn" onclick="deleteUnit('${u.id}')">מחק 🗑️</button>
      </div>
    </div>
  `).join('');
}

function deleteUnit(id) {
  if (confirm('האם אתה בטוח שברצונך למחוק יחידה זו ממסלול הלימוד?')) {
    appState.units = appState.units.filter(u => u.id !== id);
    saveAppState();
    renderCaregiverOverview();
    renderDanielView();
    showToast('היחידה נמחקה בהצלחה.');
  }
}

function editUnitInModal(id) {
  const u = appState.units.find(x => x.id === id);
  if (!u) return;

  document.querySelector('.adm-tab-btn[data-tab="adm-assistant"]').click();
  document.getElementById('ed-title').value = u.title;
  document.getElementById('ed-category').value = u.category || '';
  document.getElementById('ed-goal').value = u.goal;
  document.getElementById('ed-bad-prompt').value = u.step1_demo?.badPrompt || '';
  document.getElementById('ed-bad-result').value = u.step1_demo?.badResult || '';
  document.getElementById('ed-good-prompt').value = u.step1_demo?.goodPrompt || '';
  document.getElementById('ed-good-result').value = u.step1_demo?.goodResult || '';
  document.getElementById('ed-takeaway').value = u.step2_takeaway;
  document.getElementById('ed-quiz-q').value = u.step3_quiz?.question || '';
  document.getElementById('ed-quiz-opt1').value = u.step3_quiz?.options?.[0]?.text || '';
  document.getElementById('ed-quiz-opt2').value = u.step3_quiz?.options?.[1]?.text || '';
  document.getElementById('ed-action').value = u.step4_action?.prompt || '';

  showToast('היחידה נטענה בעורך לעריכה מהירה ✏️');
}

// יצירת יחידה בטופס
function publishEditedUnit() {
  const title = document.getElementById('ed-title').value.trim();
  const cat = document.getElementById('ed-category').value.trim() || 'יחידה מותאמת';
  const goal = document.getElementById('ed-goal').value.trim();
  const badPrompt = document.getElementById('ed-bad-prompt').value.trim();
  const badResult = document.getElementById('ed-bad-result').value.trim();
  const goodPrompt = document.getElementById('ed-good-prompt').value.trim();
  const goodResult = document.getElementById('ed-good-result').value.trim();
  const takeaway = document.getElementById('ed-takeaway').value.trim();
  const quizQ = document.getElementById('ed-quiz-q').value.trim();
  const opt1 = document.getElementById('ed-quiz-opt1').value.trim();
  const opt2 = document.getElementById('ed-quiz-opt2').value.trim();
  const actionPrompt = document.getElementById('ed-action').value.trim();

  if (!title || !goodPrompt || !takeaway || !quizQ) {
    alert('אנא מלא לפחות כותרת, פרומפט מומלץ, כלל נלמד ושאלת הבנה.');
    return;
  }

  const newUnit = {
    id: 'unit_custom_' + Date.now(),
    title: title,
    category: cat,
    goal: goal || 'למידה ותרגול מעשי של מיומנות AI.',
    isUnlocked: true,
    isCompleted: false,
    step1_demo: {
      badPrompt: badPrompt || 'בקשה מעורפלת',
      badResult: badResult || 'תשובה ארוכה או לא מתאימה',
      goodPrompt: goodPrompt,
      goodResult: goodResult || 'הנה בדיוק מה שביקשת בצורה ברורה!'
    },
    step2_takeaway: takeaway,
    step3_quiz: {
      question: quizQ,
      options: [
        { text: opt1 || 'התשובה הנכונה לפי הכלל', isCorrect: true, explanation: 'בדיוק! זו התשובה הנכונה ביותר.' },
        { text: opt2 || 'התשובה הפחות מתאימה', isCorrect: false, explanation: 'שים לב לכלל שלמדנו ביחידה.' }
      ]
    },
    step4_action: {
      prompt: actionPrompt || goodPrompt,
      doText: 'העתק את הבקשה ובדוק כמה קל לפעול נכון:'
    }
  };

  appState.units.push(newUnit);
  saveAppState();
  renderCaregiverOverview();
  renderDanielView();

  SoundService.playSuccessSound();
  showToast('היחידה החדשה נוספה בהצלחה למסלול של דניאל! 🌟');
  document.querySelector('.adm-tab-btn[data-tab="adm-units-mgr"]').click();
}

// יצירת יחידה חכמה עם AI וחילוץ JSON קשיח
async function handleAdminChatSend() {
  const input = document.getElementById('admin-chat-input');
  const userText = input.value.trim();
  if (!userText) return;

  const chatContainer = document.getElementById('admin-chat-messages');
  
  const userDiv = document.createElement('div');
  userDiv.className = 'user-msg';
  userDiv.textContent = userText;
  chatContainer.appendChild(userDiv);
  input.value = '';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-msg loading';
  loadingDiv.innerHTML = '<span class="loading-spinner"></span> <span>העוזר חושב ובונה יחידת לימוד מותאמת ב-4 שלבים...</span>';
  chatContainer.appendChild(loadingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const systemInstruction = `
אתה מומחה פדגוגי להנגשת בינה מלאכותית ומיומנויות תעסוקה וחיים עבור דניאל בן 28.
קבל את בקשת המלווה וצור יחידת לימוד חדשה במבנה 4 השלבים.
חובה להחזיר אך ורק אובייקט JSON תקין ומלא, ללא שום טקסט מקדים, ללא מרקדאון של קוד, בדיוק במבנה הבא:
{
  "title": "כותרת קצרה וברורה ליחידה",
  "category": "קטגוריה (למשל: עבודה ותקשורת, כישורי חיים, בטיחות)",
  "goal": "מטרת היחידה במשפט אחד",
  "step1_demo": {
    "badPrompt": "הפרומפט החלש/המעורפל",
    "badResult": "התוצאה המאכזבת מה-AI",
    "goodPrompt": "הפרומפט הממוקד והמדויק",
    "goodResult": "התוצאה הברורה והמצוינת מה-AI"
  },
  "step2_takeaway": "הכלל הנלמד במשפט קצר אחד",
  "step3_quiz": {
    "question": "שאלת הבנה קצרה",
    "options": [
      { "text": "התשובה הנכונה ביותר", "isCorrect": true, "explanation": "הסבר מעודד קצר" },
      { "text": "תשובה מסיחה שגויה", "isCorrect": false, "explanation": "הסבר מחדד" }
    ]
  },
  "step4_action": {
    "prompt": "משפט מוכן להעתקה ולתרגול",
    "doText": "הסבר קצר מה לעשות"
  }
}
`;

  try {
    const res = await AIService.callLessonGeneratorWithFallback(userText, systemInstruction);
    loadingDiv.remove();

    let parsed = null;
    try {
      // חילוץ וניקוי JSON קפדני
      let rawText = res.text || '';
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '');
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonSlice = rawText.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonSlice);
      } else {
        throw new Error('No JSON object found in response');
      }
    } catch (parseErr) {
      console.warn('JSON parsing error from model, using sanitizer:', parseErr);
      // fallback למנוע הפנימי רק אם המודל לא החזיר מבנה בכלל
      parsed = JSON.parse(AIService.synthesizeOfflineUnit(userText));
    }

    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-msg';
    aiDiv.innerHTML = `
      🌟 <strong>היחידה נוצרה בהצלחה!</strong> (ספק: ${res.provider})<br>
      כותרת: <strong>${parsed.title}</strong><br>
      הפרטים נטענו בטופס העריכה משמאל. באפשרותך לערוך אותם וללחוץ על <em>אשר והוסף למסלול</em>.
    `;
    chatContainer.appendChild(aiDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    document.getElementById('ed-title').value = parsed.title || '';
    document.getElementById('ed-category').value = parsed.category || 'יחידה מותאמת';
    document.getElementById('ed-goal').value = parsed.goal || '';
    document.getElementById('ed-bad-prompt').value = parsed.step1_demo?.badPrompt || '';
    document.getElementById('ed-bad-result').value = parsed.step1_demo?.badResult || '';
    document.getElementById('ed-good-prompt').value = parsed.step1_demo?.goodPrompt || '';
    document.getElementById('ed-good-result').value = parsed.step1_demo?.goodResult || '';
    document.getElementById('ed-takeaway').value = parsed.step2_takeaway || '';
    document.getElementById('ed-quiz-q').value = parsed.step3_quiz?.question || '';
    document.getElementById('ed-quiz-opt1').value = parsed.step3_quiz?.options?.[0]?.text || '';
    document.getElementById('ed-quiz-opt2').value = parsed.step3_quiz?.options?.[1]?.text || '';
    document.getElementById('ed-action').value = parsed.step4_action?.prompt || '';

    SoundService.playSuccessSound();
  } catch (err) {
    loadingDiv.className = 'ai-msg error';
    loadingDiv.textContent = `שגיאה ביצירת יחידה: ${err.message}. אנא נסה שוב או בדוק את הגדרות ה-API.`;
  }
}

function logAdaptiveReinforcement(unit, question, chosenWrong) {
  const item = {
    timestamp: new Date().toLocaleString('he-IL'),
    unitId: unit.id,
    unitTitle: unit.title,
    question: question,
    chosenOption: chosenWrong,
    recommendedAction: `מומלץ לחזק עם דניאל את עקרון "${unit.step2_takeaway}" בפעילות היום הבאה.`
  };
  appState.reinforcementLog.unshift(item);
  saveAppState();
}

function exportBackupFile() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `daniel_ai_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('קובץ הגיבוי יוצא בהצלחה! 📤');
}

function handleRestoreBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const restored = JSON.parse(e.target.result);
      if (restored && restored.units && Array.isArray(restored.units)) {
        appState = { ...appState, ...restored };
        saveAppState();
        renderDanielView();
        renderCaregiverOverview();
        showToast('הנתונים שוחזרו בהצלחה מהקובץ! 📥');
      } else {
        alert('קובץ הגיבוי שנבחר אינו תקין.');
      }
    } catch (err) {
      alert('שגיאה בקריאת הקובץ: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// 13. אתחול והאזנה לאירועים (Initialization)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadAppState();
  checkAndApplyShabbatLock();

  // מעקף שבת זמני לבדיקות מלווה
  const bypassBtn = document.getElementById('shabbat-bypass-btn');
  if (bypassBtn) {
    bypassBtn.onclick = () => {
      const p = prompt('הקש קוד מלווה למעקף שבת לבדיקה:');
      if (p === '1234' || p === 'דניאל' || p === '') {
        shabbatBypassed = true;
        checkAndApplyShabbatLock();
        showToast('מצב שבת הוקפא זמנית לבדיקה.');
      }
    };
  }

  // מעבר בין אזור דניאל לאזור ליווי
  const viewBtn = document.getElementById('view-mode-btn');
  const exitBtn = document.getElementById('exit-cg-btn');
  const danielView = document.getElementById('daniel-view');
  const caregiverView = document.getElementById('caregiver-view');

  function setView(mode) {
    appState.currentView = mode;
    if (mode === 'caregiver') {
      danielView.classList.remove('active');
      caregiverView.classList.add('active');
      renderCaregiverOverview();
    } else {
      caregiverView.classList.remove('active');
      danielView.classList.add('active');
      renderDanielView();
    }
    saveAppState();
  }

  viewBtn.onclick = () => {
    if (appState.currentView === 'daniel') {
      const pass = prompt('נא להקליד קוד כניסה לאזור אבא ומלווים (ברירת מחדל: 1234):');
      if (pass === '1234' || pass === 'דניאל' || pass === '') {
        setView('caregiver');
      } else {
        alert('קוד שגוי.');
      }
    } else {
      setView('daniel');
    }
  };

  exitBtn.onclick = () => setView('daniel');

  // הקראה קולית
  const ttsBtn = document.getElementById('tts-toggle-btn');
  ttsBtn.onclick = () => {
    appState.ttsEnabled = !appState.ttsEnabled;
    ttsBtn.querySelector('.btn-text').textContent = appState.ttsEnabled ? 'הקראה קולית: פעילה' : 'הקראה קולית: כבויה';
    ttsBtn.style.opacity = appState.ttsEnabled ? '1' : '0.6';
    if (!appState.ttsEnabled) SoundService.stopSpeaking();
    else SoundService.speakHebrew('הקראה קולית הופעלה.');
    saveAppState();
  };

  // מודל יחידת לימוד
  document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('lesson-modal').classList.remove('active');
    SoundService.stopSpeaking();
  };

  document.getElementById('modal-read-aloud-btn').onclick = () => {
    const pane = document.getElementById('modal-body-content');
    if (pane) SoundService.speakHebrew(pane.innerText);
  };

  document.getElementById('modal-prev-step-btn').onclick = () => {
    if (currentStep > 1) renderLessonStep(currentStep - 1);
  };

  document.getElementById('modal-next-step-btn').onclick = () => {
    if (currentStep < 4) renderLessonStep(currentStep + 1);
    else completeActiveUnit();
  };

  // מודל מבחן שלב
  document.getElementById('checkpoint-close-btn').onclick = () => {
    document.getElementById('checkpoint-modal').classList.remove('active');
    SoundService.stopSpeaking();
  };

  // מסך חגיגה
  document.getElementById('celebration-close-btn').onclick = () => {
    document.getElementById('celebration-overlay').classList.remove('active');
  };

  // טאבים בפאנל מלווה
  document.querySelectorAll('.adm-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.adm-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');
    };
  });

  // יצירת יחידה בניהול
  document.getElementById('admin-chat-send-btn').onclick = handleAdminChatSend;
  document.getElementById('admin-chat-input').onkeypress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdminChatSend();
    }
  };

  document.getElementById('ed-publish-btn').onclick = publishEditedUnit;
  document.getElementById('add-manual-unit-btn').onclick = () => {
    document.querySelector('.adm-tab-btn[data-tab="adm-assistant"]').click();
  };

  // הגדרות מפתחות
  const geminiInput = document.getElementById('cfg-gemini-key');
  const groqInput = document.getElementById('cfg-groq-key');
  const ollamaInput = document.getElementById('cfg-ollama-url');

  geminiInput.value = appState.apiConfig.geminiKey || '';
  groqInput.value = appState.apiConfig.groqKey || '';
  ollamaInput.value = appState.apiConfig.ollamaUrl || 'http://localhost:11434';

  document.getElementById('cfg-save-keys-btn').onclick = () => {
    appState.apiConfig.geminiKey = geminiInput.value.trim();
    appState.apiConfig.groqKey = groqInput.value.trim();
    appState.apiConfig.ollamaUrl = ollamaInput.value.trim() || 'http://localhost:11434';
    saveAppState();
    SoundService.playSuccessSound();
    showToast('הגדרות המפתחות נשמרו בהצלחה! 💾');
  };

  // בדיקת Gemini אסינכרונית עם ספינר
  const btnTestGemini = document.getElementById('btn-test-gemini');
  const statusGemini = document.getElementById('cfg-gemini-status');
  if (btnTestGemini && statusGemini) {
    btnTestGemini.onclick = async () => {
      const key = geminiInput.value.trim();
      btnTestGemini.disabled = true;
      btnTestGemini.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusGemini.style.display = 'block';
      statusGemini.style.backgroundColor = '#eff6ff';
      statusGemini.style.color = '#1e40af';
      statusGemini.style.border = '1px solid #bfdbfe';
      statusGemini.innerHTML = '<span class="loading-spinner"></span> <span id="gemini-prog-msg">מתחבר ל-Google AI Studio...</span>';

      try {
        const res = await AIService.testGemini(key, (msg) => {
          const el = document.getElementById('gemini-prog-msg');
          if (el) el.textContent = msg;
        });
        if (res.success) {
          statusGemini.style.backgroundColor = '#ecfdf5';
          statusGemini.style.color = '#065f46';
          statusGemini.style.border = '1px solid #a7f3d0';
          statusGemini.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל פעיל: <code>${res.model}</code> | מענה: "${res.reply}"`;
        } else {
          statusGemini.style.backgroundColor = '#fef2f2';
          statusGemini.style.color = '#991b1b';
          statusGemini.style.border = '1px solid #fecaca';
          statusGemini.innerHTML = `🔴 <strong>שגיאת חיבור ל-Gemini:</strong> ${res.error}`;
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
      const key = groqInput.value.trim();
      btnTestGroq.disabled = true;
      btnTestGroq.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusGroq.style.display = 'block';
      statusGroq.style.backgroundColor = '#eff6ff';
      statusGroq.style.color = '#1e40af';
      statusGroq.style.border = '1px solid #bfdbfe';
      statusGroq.innerHTML = '<span class="loading-spinner"></span> <span id="groq-prog-msg">מתחבר לשרתי Groq Cloud...</span>';

      try {
        const res = await AIService.testGroq(key, (msg) => {
          const el = document.getElementById('groq-prog-msg');
          if (el) el.textContent = msg;
        });
        if (res.success) {
          statusGroq.style.backgroundColor = '#ecfdf5';
          statusGroq.style.color = '#065f46';
          statusGroq.style.border = '1px solid #a7f3d0';
          statusGroq.innerHTML = `🟢 <strong>מחובר בהצלחה!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | מודל: <code>${res.model}</code> | מענה: "${res.reply}"`;
        } else {
          statusGroq.style.backgroundColor = '#fef2f2';
          statusGroq.style.color = '#991b1b';
          statusGroq.style.border = '1px solid #fecaca';
          statusGroq.innerHTML = `🔴 <strong>שגיאת חיבור ל-Groq:</strong> ${res.error}`;
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
      const url = ollamaInput.value.trim();
      btnTestOllama.disabled = true;
      btnTestOllama.innerHTML = '<span class="loading-spinner"></span> <span>בודק...</span>';
      statusOllama.style.display = 'block';
      statusOllama.style.backgroundColor = '#eff6ff';
      statusOllama.style.color = '#1e40af';
      statusOllama.style.border = '1px solid #bfdbfe';
      statusOllama.innerHTML = '<span class="loading-spinner"></span> <span>מתחבר ל-Ollama ב-localhost...</span>';

      try {
        const res = await AIService.testOllama(url);
        if (res.success) {
          statusOllama.style.backgroundColor = '#ecfdf5';
          statusOllama.style.color = '#065f46';
          statusOllama.style.border = '1px solid #a7f3d0';
          statusOllama.innerHTML = `🟢 <strong>מחובר ל-Ollama מקומי!</strong> זמן תגובה: <strong>${res.latency}ms</strong> | ${res.reply}`;
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
  document.getElementById('adm-export-btn').onclick = () => exportBackupFile();
  const fileInput = document.getElementById('adm-file-input');
  document.getElementById('adm-import-btn').onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleRestoreBackup(file);
  };

  document.getElementById('adm-reset-btn').onclick = () => {
    if (confirm('אזהרה: פעולה זו תאפס את כל הנתונים, היחידות והמבחנים. האם להמשיך?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  // רינדור ראשוני של המסך
  renderDanielView();
});
