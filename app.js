/**
 * מאמן ה-AI של דניאל v2.0 - מתוקן ומאומת
 * פדגוגיית 4 השלבים, בדיקת הבנה חד-משמעית, שחזור סשן מלא בריפרש,
 * סימולטור שיחה טבעי (ללא JSON), ביטול שגיאות 405 ב-GitHub Pages,
 * וממשק ניהול סמוי (#admin) עם שרשרת Fallback רב-שכבתית.
 */

// ============================================================================
// 1. קבועים, מפתחות אחסון ומבנה יחידות ברירת מחדל (Default v2 Units)
// ============================================================================

const STORAGE_KEY = 'DANIEL_AI_LEARNING_SYSTEM_V2';
const LEGACY_V1_KEY = 'DANIEL_AI_LEARNING_SYSTEM_V1';
const ADMIN_PIN_DEFAULT = '1234';

// 10 יחידות לימוד מעשיות, עשירות, מכבדות ומותאמות לסביבת עבודה, יצירה ומדיה
const DEFAULT_V2_UNITS = [
  {
    id: 'unit_1_short_prompt',
    title: 'יסודות: איך לקבל מה-AI תשובה קצרה ולא מגילה',
    category: 'יסודות ותקשורת',
    goal: 'ללמוד להגדיר ל-AI לענות בקצרה, בלי להציף בהסברים ארוכים.',
    isUnlocked: true,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'הסבר לי על מחשבים',
      badResult: 'מחשב הוא מערכת מורכבת הכוללת יחידת עיבוד מרכזית (CPU), לוח אם, זיכרון גישה אקראית (RAM), התקני קלט ופלט, ארכיטקטורת x86 ומערכות הפעלה מגוונות...',
      goodPrompt: 'הסבר לי מה זה עכבר מחשב ב-2 משפטים פשוטים',
      goodResult: 'עכבר מחשב הוא מכשיר ידני שמזיז את החץ שעל המסך. בלחיצה עליו אפשר לפתוח תוכניות ולבחור דברים בקלות.'
    },
    step2_takeaway: 'כשביקשנו מה-AI במפורש: "ב-2 משפטים פשוטים", הוא לא הציף אותנו בטקסט ארוך וענה בדיוק מה שרצינו!',
    step3_quiz: {
      question: 'אם קיבלת מה-AI תשובה ארוכה מדי ומעייפת, מה הכי נכון לכתוב לו?',
      options: [
        { text: 'תסביר לי שוב ב-3 נקודות קצרות ובמילים פשוטות', isCorrect: true, explanation: 'בול! זה גורם ל-AI לתמצת מיד.' },
        { text: 'תכתוב לי מאמר של 10 עמודים על הנושא', isCorrect: false, explanation: 'זה יעשה את התשובה עוד יותר ארוכה!' },
        { text: 'תספר לי את כל ההיסטוריה מההתחלה', isCorrect: false, explanation: 'זה יוסיף המון מידע מיותר.' }
      ]
    },
    step4_action: {
      prompt: 'תסביר לי מה זה "גיבוי במחשב" ב-2 משפטים קצרים ובמילים פשוטות.',
      doText: 'העתק את המשפט ובדוק איך ה-AI עונה לך בדיוק ב-2 משפטים:'
    }
  },
  {
    id: 'unit_2_work_message',
    title: 'עבודה: ניסוח הודעה מנומסת למנהל או לעמית',
    category: 'עבודה ותקשורת',
    goal: 'איך לבקש מ-AI לנסח הודעה מכבדת ונעימה (למשל על איחור או בקשת חופש).',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תכתוב הודעה שאני מאחר',
      badResult: 'אני מאחר היום.',
      goodPrompt: 'תנסח לי הודעת וואטסאפ מנומסת וקצרה למנהל שלי בעבודה, שאני מאחר ב-20 דקות בגלל פקקים',
      goodResult: 'בוקר טוב! לצערי יש פקקים חריגים בדרך ואאחר בכ-20 דקות. מתנצל על העיכוב ואעדכן ברגע שאגיע למשרד. יום טוב!'
    },
    step2_takeaway: 'כשמסבירים ל-AI למי ההודעה (למנהל) ומה הסיבה (פקקים), הוא מנסח הודעה מנומסת ומקצועית שנעים לקבל!',
    step3_quiz: {
      question: 'מה כדאי להסביר ל-AI כשמבקשים ממנו לנסח הודעה לעבודה?',
      options: [
        { text: 'למי שולחים את ההודעה ומה הסיבה בקצרה', isCorrect: true, explanation: 'מדויק! ככה ה-AI יודע באיזה נימוס לכתוב.' },
        { text: 'לכתוב לו רק מילה אחת בלי פרטים', isCorrect: false, explanation: 'אם לא נסביר לו, הוא לא ידע מה לנסח.' }
      ]
    },
    step4_action: {
      prompt: 'תנסח לי הודעת וואטסאפ מנומסת וקצרה לעמית לעבודה, לשאול אם הוא פנוי לשיחה קצרה של 5 דקות.',
      doText: 'העתק את הבקשה ובדוק איזו הודעה יפה ה-AI מנסח לך:'
    }
  },
  {
    id: 'unit_3_social_decode',
    title: 'חברה ותקשורת: פענוח טון של הודעות ומיילים',
    category: 'סיטואציות חברתיות',
    goal: 'איך להיעזר ב-AI כדי להבין אם הודעה קצרה היא בסדר ולא מעידה על כעס.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'מה הוא רוצה ממני?',
      badResult: 'אין לי מספיק מידע. במי מדובר ומה נכתב?',
      goodPrompt: 'מישהו בעבודה שלח לי הודעה של מילה אחת: "בסדר". האם זה אומר שהוא כועס, או שזה רגיל בעבודה? תסביר לי ב-2 משפטים.',
      goodResult: 'בעבודה אנשים עסוקים מאוד ולעיתים קרובות עונים "בסדר" או "קיבלתי" רק כדי לאשר שהבינו. זה לא אומר שהוא כועס כלל, אלא פשוט תגובה עניינית ומהירה.'
    },
    step2_takeaway: 'AI יכול להיות עוזר מצוין להבנת סיטואציות חברתיות — אפשר לשאול אותו ישירות על הודעה שקיבלנו ולהירגע!',
    step3_quiz: {
      question: 'אם קיבלת הודעה קצרה בעבודה ואתה לא בטוח מה הכוונה, מה ה-AI יכול לעשות?',
      options: [
        { text: 'להסביר את הכוונה במילים פשוטות ולהציע איך להגיב בנועם', isCorrect: true, explanation: 'בדיוק! הוא עוזר להבין סיטואציות בצורה רגועה.' },
        { text: 'למחוק את ההודעה מהטלפון שלי בעצמו', isCorrect: false, explanation: 'ה-AI לא יכול לגעת בטלפון שלך, הוא רק מייעץ.' }
      ]
    },
    step4_action: {
      prompt: 'מישהו בעבודה כתב לי: "נשוחח מחר". תסביר לי במילים פשוטות האם זה מקובל בעבודה ומה זה אומר.',
      doText: 'שאל את ה-AI ובדוק את ההסבר המרגיע והברור שלו:'
    }
  },
  {
    id: 'unit_4_create_image',
    title: 'יצירה: איך לתאר ל-AI תמונה בדימיון',
    category: 'יצירת מדיה',
    goal: 'ללמוד איך לבקש מ-AI לתאר או ליצור תמונה צבעונית ויפה.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תמונה יפה',
      badResult: 'של מה התמונה? נוף? אדם? רכב? באיזה סגנון?',
      goodPrompt: 'תאר לי תמונה צבעונית של גיטרה חשמלית זוהרת על במה, עם אורות סגולים וכחולים וקהל שמח ברקע',
      goodResult: 'תמונה מרהיבה: במרכז עומדת גיטרה חשמלית מבריקה שמחזירה ניצוצות של אור. ברקע אלומות תאורה סגולות וכחולות, וצלליות של קהל מריע בהופעה חיה.'
    },
    step2_takeaway: 'כשמוסיפים צבעים (סגול וכחול) ופרטים מוחשיים (במה, קהל), ה-AI יודע בדיוק איזו תמונה לתאר או לצייר!',
    step3_quiz: {
      question: 'מה הופך בקשת תמונה מה-AI להרבה יותר מוצלחת ויפה?',
      options: [
        { text: 'תיאור של צבעים, פרטים מרכזיים והאווירה שרוצים לראות', isCorrect: true, explanation: 'בול! ככל שהפרטים ברורים, התמונה מדהימה יותר.' },
        { text: 'לכתוב רק "תעשה תמונה יפה וזהו"', isCorrect: false, explanation: 'זה כללי מדי וה-AI לא ידע מה לצייר.' }
      ]
    },
    step4_action: {
      prompt: 'תאר לי תמונה צבעונית ויפה של מכונית ספורט אדומה שנוסעת בכביש שקט ליד הים בשקיעה.',
      doText: 'העתק את הפרומפט ובדוק איזה תיאור מרהיב ה-AI מייצר לך:'
    }
  },
  {
    id: 'unit_5_refine_media',
    title: 'מדיה מתקדמת: איך לבקש תיקון מדויק לתמונה',
    category: 'יצירת מדיה',
    goal: 'מיומנות קריטית: איך להגיד ל-AI לשנות פרט אחד ספציפי בלי לקלקל את השאר.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'לא אהבתי, תעשה משהו אחר לגמרי',
      badResult: 'ה-AI מתחיל הכל מאפס ויוצר משהו שלא קשור בכלל.',
      goodPrompt: 'בתמונה שתיארת קודם, תשמור את הכל בדיוק אותו דבר, אבל תשנה רק את צבע המכונית לכחול כהה ותוסיף שחפים בשמיים',
      goodResult: 'עודכן בהצלחה: אותה מכונית ספורט נוסעת ליד הים בשקיעה, אך כעת צבעה כחול מטאלי כהה ובשמיים מעליה מעופפים שחפים לבנים.'
    },
    step2_takeaway: 'כדי לתקן תמונה או טקסט, אומרים ל-AI: "תשמור את הכל אותו דבר, ורק תשנה את..."!',
    step3_quiz: {
      question: 'איך הכי נכון לבקש מה-AI לשנות פרט בתמונה בלי שיימחק מה שכבר אהבנו?',
      options: [
        { text: 'להגיד לו לשמור את הקיים ורק להחליף את הפרט הספציפי', isCorrect: true, explanation: 'מעולה! זו מיומנות מקצועית של שיפור מדיה.' },
        { text: 'להגיד לו "תמחק הכל ותתחיל מחדש"', isCorrect: false, explanation: 'ככה נאבד את כל מה שהיה יפה קודם.' }
      ]
    },
    step4_action: {
      prompt: 'בהמשך לתיאור הקודם של המכונית ליד הים, תשמור הכל כפי שהוא, ורק תוסיף מוזיקה שבוקעת מהרכב ושמיים מלאים בכוכבים.',
      doText: 'בקש מה-AI את השינוי ובדוק איך הוא מעדכן בדיוק את הפרטים שביקשת:'
    }
  },
  {
    id: 'unit_6_salary_concepts',
    title: 'כספים ועבודה: פענוח מושגים בתלוש שכר',
    category: 'כספים וזכויות',
    goal: 'איך להיעזר ב-AI כדי להבין מושגים חשובים בעבודה כמו "ברוטו" מול "נטו" ו"פנסיה".',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תסביר לי חוקי עבודה',
      badResult: 'פקודת מס הכנסה סעיף 2(2), חוק שכר מינימום התשמ"ז, צו הרחבה לביטוח פנסיוני מקיף במשק...',
      goodPrompt: 'תסביר לי מה ההבדל בין שכר "ברוטו" לשכר "נטו" בתלוש שכר, עם דוגמה של מספרים פשוטים וב-2 משפטים',
      goodResult: 'שכר "ברוטו" הוא הסכום שסוכם עליך לפני שמורידים מיסים (למשל 6,000 ש"ח). שכר "נטו" הוא הכסף האמיתי שנכנס אליך לחשבון הבנק בסוף החודש (למשל 5,500 ש"ח).'
    },
    step2_takeaway: 'כשמבקשים מה-AI "עם דוגמה של מספרים פשוטים", מושגים מסובכים של עבודה הופכים לפשוטים להבנה מיד!',
    step3_quiz: {
      question: 'מהו שכר "נטו" לפי ההסבר שראינו?',
      options: [
        { text: 'הכסף האמיתי שנכנס לחשבון הבנק שלי בסוף החודש', isCorrect: true, explanation: 'נכון מאוד! "נטו ביד" זה מה שנכנס לחשבון.' },
        { text: 'המספר הגבוה לפני שמורידים ביטוח לאומי ומיסים', isCorrect: false, explanation: 'זה נקרא שכר ברוטו.' }
      ]
    },
    step4_action: {
      prompt: 'תסביר לי מה זה "חיסכון פנסיוני" במילים פשוטות ובשני משפטים, ולמה זה חשוב לכל עובד.',
      doText: 'העתק את הבקשה ובדוק את ההסבר הפשוט של ה-AI:'
    }
  },
  {
    id: 'unit_7_interview_simulation',
    title: 'סימולציה: אימון לראיון עבודה צעד-אחר-צעד',
    category: 'עבודה ותקשורת',
    goal: 'להפוך את ה-AI למראיין עבודה סבלני ששואל שאלה אחת בכל פעם ועוזר להתאמן.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תראיין אותי',
      badResult: 'שלום! הנה 10 שאלות לראיון עבודה: 1. ספר על עצמך 2. מה החולשות שלך... (רשימה ארוכה ומלחיצה)',
      goodPrompt: 'תהיה מראיין עבודה סבלני ונחמד. שאל אותי רק שאלה אחת קלה בכל פעם. חכה לתשובה שלי ואז תן לי טיפ קצר ומעודד.',
      goodResult: 'שלום וברוך הבא! אני שמח לפגוש אותך. נתחיל בשאלה ראשונה וקלה: מה אתה הכי אוהב לעשות ביום עבודה מוצלח?'
    },
    step2_takeaway: 'ההוראה: "שאל רק שאלה אחת בכל פעם וחכה לתשובה שלי" מונעת הצפה והופכת את ה-AI למאמן אישי מושלם!',
    step3_quiz: {
      question: 'למה כדאי להגיד ל-AI "שאל אותי רק שאלה אחת בכל פעם"?',
      options: [
        { text: 'כדי שנוכל לענות בנחת וברוגע על כל שאלה בלי להילחץ מרשימה ארוכה', isCorrect: true, explanation: 'בול! זה מאפשר תרגול רגוע וממוקד.' },
        { text: 'כי ה-AI לא יודע יותר משאלה אחת', isCorrect: false, explanation: 'הוא יודע המון, אבל אנחנו רוצים קצב נעים.' }
      ]
    },
    step4_action: {
      prompt: 'תהיה מראיין עבודה סבלני וידידותי. שאל אותי רק שאלה אחת קלה לפתיחה, וחכה שאענה לך.',
      doText: 'העתק את המשפט, פתח את ChatGPT וענה לו על השאלה הראשונה:'
    }
  },
  {
    id: 'unit_8_organize_table',
    title: 'סדר ומסמכים: ארגון מידע בטבלה מסודרת',
    category: 'מסמכים ומחשב',
    goal: 'איך להגיד ל-AI לקחת רשימה מבולגנת ולהפוך אותה לטבלה נקייה בעין.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'סדר לי את המשימות',
      badResult: 'משימות: כביסה, פגישה ב-10, קניות, לנקות שולחן... (סתם רשימה רגילה)',
      goodPrompt: 'קח את המשימות שלי וסדר אותן בטבלה עם 3 עמודות: משימה, שעה, ורמת דחיפות (גבוהה/רגילה)',
      goodResult: 'טבלה מסודרת:\n| משימה | שעה | דחיפות |\n| פגישת צוות | 10:00 | גבוהה |\n| קניות מצרכים | 16:00 | רגילה |'
    },
    step2_takeaway: 'לבקש מה-AI "סדר בטבלה עם עמודות" הופך כל בלגן לרשימה יפה ומאורגנת שכיף לקרוא!',
    step3_quiz: {
      question: 'איך מבקשים מה-AI להציג מידע בצורה הכי ברורה ומסודרת לעין?',
      options: [
        { text: 'לבקש ממנו להציג את הנתונים בטבלה מסודרת עם כותרות', isCorrect: true, explanation: 'מדויק! טבלה מארגנת הכל בצורה מושלמת.' },
        { text: 'לבקש ממנו לכתוב פסקה אחת ארוכה ומחוברת', isCorrect: false, explanation: 'זה יוצר גוש טקסט שקשה לקרוא.' }
      ]
    },
    step4_action: {
      prompt: 'סדר לי בטבלה נקייה עם 2 עמודות (יום ופעילות) 3 רעיונות פשוטים לפעילות נעימה לשבוע הקרוב.',
      doText: 'בקש מה-AI ובדוק איך הוא מציג לך טבלה מסודרת ונקייה:'
    }
  },
  {
    id: 'unit_9_tech_troubleshoot',
    title: 'פתרון בעיות: כשמשהו נתקע במחשב',
    category: 'מחשבים ותקלות',
    goal: 'איך לתאר ל-AI תקלה במחשב ולקבל פתרון ב-3 צעדים פשוטים.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'המחשב לא עובד',
      badResult: 'תבדוק את ספק הכוח, כרטיס המסך, הביוס, לוח האם ומנהלי ההתקנים של הווינדוס...',
      goodPrompt: 'המדפסת שלי במחשב לא מדפיסה. תן לי 3 בדיקות הכי פשוטות שאני יכול לעשות לבד, בלי מילים טכניות מסובכות.',
      goodResult: '1. ודא שכבל החשמל של המדפסת מחובר והאור דולק.\n2. בדוק שיש דפים במגש ושאין נייר תקוע בפנים.\n3. כבה את המדפסת ל-10 שניות והדלק שוב.'
    },
    step2_takeaway: 'כשמסבירים בדיוק מה התקלה ומבקשים "3 בדיקות פשוטות בלי מילים מסובכות", מקבלים פתרון מהיר שכל אחד יכול לעשות!',
    step3_quiz: {
      question: 'כשפונים ל-AI לעזרה עם בעיה במחשב, מה חשוב לכתוב לו?',
      options: [
        { text: 'בדיוק מה המכשיר שעושה בעיה ולבקש בדיקות פשוטות צעד-אחר-צעד', isCorrect: true, explanation: 'בדיוק! זה נותן פתרון מעשי מיידי.' },
        { text: 'לכתוב רק "הכל מקולקל" בלי לפרט', isCorrect: false, explanation: 'ה-AI לא יוכל לנחש מה התקלקל.' }
      ]
    },
    step4_action: {
      prompt: 'קובץ וורד (Word) לא נפתח לי במחשב. תן לי ב-3 צעדים קצרים ופשוטים מה כדאי לבדוק.',
      doText: 'העתק את הפרומפט וראה איזה פתרון מסודר ה-AI מחזיר לך:'
    }
  },
  {
    id: 'unit_10_mastery_challenge',
    title: 'אתגר המאסטר: אתה מנהל את ה-AI בעצמך!',
    category: 'עצמאות ומאסטר',
    goal: 'יישום עצמאי של כל המיומנויות: הגדרת אורך, דיוק ודוגמה לנושא אישי שמעניין אותך.',
    isUnlocked: false,
    isCompleted: false,
    step1_demo: {
      badPrompt: 'תספר לי על מוזיקה',
      badResult: 'מוזיקה קיימת משחר האנושות וכוללת מקצבים, סולמות, תווים ותזמורות...',
      goodPrompt: 'תספר לי על 2 זמרים ישראליים מוכרים, ובמשפט אחד על כל אחד מה הם שרים',
      goodResult: '1. שלמה ארצי – זמר ישראלי אהוב ששר שירי רוק ופופ מרגשים.\n2. אייל גולן – זמר מוביל ששר שירים ים-תיכוניים שמחים וקצביים.'
    },
    step2_takeaway: 'הוכחת שאתה שולט ב-AI: הגדרת נושא, הגדרת כמות (2 זמרים) והגדרת אורך (במשפט אחד)!',
    step3_quiz: {
      question: 'מהם 3 הדברים שלמדנו שהופכים אותך למומחה בשימוש ב-AI?',
      options: [
        { text: 'להסביר בדיוק מה רוצים, להגדיר אורך קצר (משפט או 2), ולבקש דוגמה מהחיים', isCorrect: true, explanation: 'מושלם! אלו 3 כללי הזהב של AI.' },
        { text: 'לכתוב מילים באנגלית מסובכת', isCorrect: false, explanation: 'ממש לא צריך! עברית פשוטה עובדת מעולה.' }
      ]
    },
    step4_action: {
      prompt: 'תבחר בעצמך כל נושא שמעניין אותך בעבודה או בחיים, ובקש מה-AI הסבר קצר ב-2 משפטים!',
      doText: 'כתוב ל-AI בעצמך שאלה לפי כללי הזהב ובדוק את התוצאה המצוינת:'
    }
  }
];

// ============================================================================

// ============================================================================
// 1.5 מבחני שלב מודרגים (Checkpoints) - מבחן כל 2 יחידות עם בנק שאלות מתחלף
// ============================================================================
const CHECKPOINTS = [
  {
    id: 'cp_1',
    afterUnitIndex: 1, // אחרי יחידה 2
    title: 'מבחן שלב 1: פשטות ותקשורת מכבדת 🎯',
    description: 'בדיקת הבנה של עקרונות הפשטות וניסוח הודעות מדויקות לעבודה (דרוש ציון 85+ לפתיחת יחידות 3-4)',
    unlocksUnitIndex: 2,
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
    afterUnitIndex: 3, // אחרי יחידה 4
    title: 'מבחן שלב 2: סייבר, פרטיות וכישורי חיים 🎯',
    description: 'בדיקת הבנה של שמירה על פרטיות ברשת וקבלת מתכונים קלים להכנה (דרוש ציון 85+ לפתיחת יחידות 5-6)',
    unlocksUnitIndex: 4,
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
    afterUnitIndex: 5, // אחרי יחידה 6
    title: 'מבחן שלב 3: תעסוקה, ראיונות ושכר 🎯',
    description: 'בדיקת מוכנות לראיונות עבודה והבנת הבדלי שכר ברוטו מול נטו (דרוש ציון 85+ לפתיחת יחידות 7-8)',
    unlocksUnitIndex: 6,
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
      }
    ]
  },
  {
    id: 'cp_4',
    afterUnitIndex: 7, // אחרי יחידה 8
    title: 'מבחן שלב 4: ארגון משימות ודיוק בקשות 🎯',
    description: 'בדיקת יכולת ארגון משימות בעבודה ובקשת הבהרות מ-AI (דרוש ציון 85+ לפתיחת יחידות 9-10)',
    unlocksUnitIndex: 8,
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
      }
    ]
  },
  {
    id: 'cp_5',
    afterUnitIndex: 9, // אחרי יחידה 10
    title: 'מבחן גמר מסכם: בטיחות, ביקורתיות ועצמאות דיגיטלית 🏆',
    description: 'מבחן מסכם של כל הידע: מתי לא סומכים על AI, פתרון תקלות פשוטות ובדיקות פיזיות (ציון 85+)',
    unlocksUnitIndex: null,
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
        question: 'איזה כלל מבין 5 כללי הזהב מגן עליך מפני הונאות וגניבת פרטים ברשת?',
        options: [
          { text: 'פרטיות לפני הכל: לעולם לא חולקים תעודת זהות, סיסמאות או אשראי', isCorrect: true },
          { text: 'לכתוב הודעות ארוכות ככל האפשר', isCorrect: false },
          { text: 'להסכים לכל בקשה שמופיעה באתר', isCorrect: false }
        ]
      }
    ]
  }
];

function isShabbatNow() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;
  if (day === 5 && timeVal >= 16.5) return true;
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

function shareProgressToWhatsApp(msgText) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}`;
  window.open(url, '_blank');
}

// ============================================================================
// 2. מבנה נתוני המצב (State v2) ומנגנון מיגרציה שקט מ-v1
// ============================================================================

let appState = {
  version: 2,
  currentView: 'welcome',
  currentAssessmentIndex: 0,
  currentCalibrationIndex: 0,
  activeUnitId: 'unit_1_short_prompt',

  user: {
    name: 'דניאל',
    age: 28
  },

  answers: {},
  calibrationChoices: [],
  profile: null,

  curriculumUnits: JSON.parse(JSON.stringify(DEFAULT_V2_UNITS)),
  needsReinforcementQueue: [],

  caregiverNotes: [
    {
      id: 'note_1',
      author: 'אושרי',
      date: '2026-09-28',
      text: 'דניאל מתקדם יפה מאוד בעבודה ומשתף פעולה. נמשיך לעודד אותו בחיזוקים חיוביים.'
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

// מיגרציה שקטה מ-v1 ושחזור מלא
function performMigrationIfNeeded() {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      appState = { ...appState, ...parsed };
      return;
    }

    const rawV1 = localStorage.getItem(LEGACY_V1_KEY);
    if (rawV1) {
      const v1Data = JSON.parse(rawV1);
      console.log('Migrating data from v1 to v2...');

      if (v1Data.user) appState.user = v1Data.user;
      if (v1Data.answers) appState.answers = v1Data.answers;
      if (v1Data.calibrationChoices) appState.calibrationChoices = v1Data.calibrationChoices;
      if (v1Data.profile) appState.profile = v1Data.profile;
      if (v1Data.feedbackHistory) appState.feedbackHistory = v1Data.feedbackHistory;

      if (Array.isArray(v1Data.weekPlan)) {
        let completedV1TasksCount = 0;
        v1Data.weekPlan.forEach(day => {
          day.tasks.forEach(t => { if (t.isCompleted) completedV1TasksCount++; });
        });

        const unitsToComplete = Math.min(Math.floor(completedV1TasksCount / 2), appState.curriculumUnits.length);
        for (let i = 0; i < unitsToComplete; i++) {
          appState.curriculumUnits[i].isCompleted = true;
          appState.curriculumUnits[i].isUnlocked = true;
        }
        if (unitsToComplete < appState.curriculumUnits.length) {
          appState.curriculumUnits[unitsToComplete].isUnlocked = true;
          appState.activeUnitId = appState.curriculumUnits[unitsToComplete].id;
        }
      }

      appState.version = 2;
      saveAppState();
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// שמירת מצב - מתוקנת: ללא שגיאות 405 ב-GitHub Pages!
function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }

  // שולח בקשת POST אך ורק אם מריצים שרת מקומי ב-localhost!
  // ב-GitHub Pages (או שרת סטטי) - לעולם לא שולח POST כדי למנוע שגיאות 405.
  const isLocalServer = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalServer) {
    try {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appState)
      }).catch(() => {});
    } catch (e) {}
  }
}

// ============================================================================
// 3. מנוע שרשרת גיבוי לספקי AI (Multi-Tier Fallback LLM Client)
// ============================================================================

const AIService = {
  activeGeminiModel: null,
  activeGroqModel: null,

  async getAvailableGeminiModels(key) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`, { method: 'GET' });
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
            if (errData && errData.error && errData.error.message) errorMsg = errData.error.message;
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
            if (errData && errData.error && errData.error.message) errorMsg = errData.error.message;
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

  async callLessonGeneratorWithFallback(userPrompt, sysInst) {
    const cfg = appState.apiConfig;

    if (cfg.geminiKey && cfg.geminiKey.trim()) {
      try {
        const res = await this.callGemini(cfg.geminiKey.trim(), userPrompt, sysInst);
        if (res) return { text: res, provider: `Google Gemini (${this.activeGeminiModel || 'Flash'})` };
      } catch (err) {
        console.warn('Gemini call failed, fallback to Groq...', err);
      }
    }

    if (cfg.groqKey && cfg.groqKey.trim()) {
      try {
        const res = await this.callGroq(cfg.groqKey.trim(), userPrompt, sysInst);
        if (res) return { text: res, provider: `Groq (${this.activeGroqModel || 'GPT-OSS'})` };
      } catch (err) {
        console.warn('Groq call failed, fallback to Ollama...', err);
      }
    }

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
// 4. שירות קול וצלילים (Web Speech API & Web Audio API)
// ============================================================================

const SoundService = {
  playSuccessSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.24);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch (e) {}
  },

  playErrorSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.2);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (e) {}
  },

  speakText(text) {
    if (!('speechSynthesis' in window)) {
      showToast('הקראה קולית אינה נתמכת בדפדפן זה');
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/["'“”]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'he-IL';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find(v => v.lang.startsWith('he') || v.lang.includes('IL'));
    if (heVoice) utterance.voice = heVoice;

    window.speechSynthesis.speak(utterance);
  }
};

// ============================================================================
// 5. ניווט ותצוגות (View Controller)
// ============================================================================

function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById('view-' + viewId);
  if (target) {
    target.classList.add('active');
    appState.currentView = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    saveAppState();
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ============================================================================
// 6. תצוגת מסלול המיומנויות של דניאל (Roadmap / Quest Path)
// ============================================================================

function renderRoadmap() {
  const container = document.getElementById('units-grid');
  container.innerHTML = '';

  const units = appState.curriculumUnits;
  let completedCount = 0;

  units.forEach((unit, idx) => {
    if (unit.isCompleted) completedCount++;

    let isUnlocked = false;
    if (idx === 0) {
      isUnlocked = true;
    } else if (idx % 2 === 0) {
      const prevCp = (appState.checkpoints || []).find(c => c.afterUnitIndex === idx - 1);
      isUnlocked = units[idx - 1].isCompleted && (!prevCp || prevCp.isPassed);
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

    if (unit.id.startsWith('reinforce_')) {
      statusClass += ' reinforcement-unit';
      statusBadgeText = '⭐ חיזוק אישי';
    }

    card.className = `unit-card ${statusClass}`;
    card.innerHTML = `
      <div class="unit-card-info">
        <span class="unit-status-icon">${statusIcon}</span>
        <div>
          <span class="badge-tag" style="margin-bottom: 0.35rem; display: inline-block;">${unit.category || 'מיומנות AI'}</span>
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
        showToast('עליך לעבור את היחידות ומבחן השלב הקודמים כדי לפתוח יחידה זו! 💪');
      };
    }

    container.appendChild(card);

    // תוספת: תחנת מבחן שלב מעוצבת כל 2 יחידות
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
          <span class="badge-tag" style="${cp.isPassed ? 'background:#ecfdf5;color:#059669;' : ''}">${cp.isPassed ? '✓ הושלם' : (isCpUnlocked ? 'מוכן למבחן' : 'נעול')}</span>
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
  document.getElementById('total-progress-pill').textContent = `${completedCount} מתוך ${units.length} יחידות | ${passedCPs} מבחני שלב`;
  document.getElementById('weekly-progress-bar').style.width = `${(completedCount / units.length) * 100}%`;
}

// ============================================================================

// ============================================================================
// 6.5 מנוע הרצת מבחני שלב (Checkpoints) עם שאלות מתחלפות וסף מעבר 85+
// ============================================================================
let currentCheckpoint = null;
let cpQuestions = [];
let cpQuestionIdx = 0;
let cpUserAnswers = [];

function openCheckpointTest(cp) {
  currentCheckpoint = cp;
  cpQuestionIdx = 0;
  cpUserAnswers = [];

  const shuffledBank = [...cp.questionBank].sort(() => Math.random() - 0.5);
  cpQuestions = shuffledBank.slice(0, 4).map(q => ({
    ...q,
    options: [...q.options].sort(() => Math.random() - 0.5)
  }));

  showView('checkpoint');
  document.getElementById('checkpoint-view-header').textContent = cp.title;
  renderCheckpointQuestion();
}

function renderCheckpointQuestion() {
  const q = cpQuestions[cpQuestionIdx];
  const total = cpQuestions.length;

  document.getElementById('checkpoint-step-text').textContent = `שאלה ${cpQuestionIdx + 1} מתוך ${total} (סף מעבר: 85%)`;
  document.getElementById('checkpoint-progress-bar').style.width = `${((cpQuestionIdx + 1) / total) * 100}%`;

  const area = document.getElementById('checkpoint-content-area');
  area.innerHTML = `
    <h2 class="question-title" style="margin-bottom: 1.5rem;">${q.question}</h2>
    <div class="options-grid" id="cp-opts-grid">
      ${q.options.map((opt, idx) => `
        <button class="option-card" data-idx="${idx}" style="text-align: right; padding: 1.2rem 1.4rem;">
          <div class="option-card-header">
            <span class="selection-indicator">${String.fromCharCode(65 + idx)}</span>
            <span style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${opt.text}</span>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  const footer = document.getElementById('checkpoint-nav-footer');
  footer.innerHTML = `
    <button id="checkpoint-next-btn" class="primary-btn" disabled style="width: 100%;">
      <span>${cpQuestionIdx + 1 < total ? 'המשך לשאלה הבאה ▶' : 'סיים והגש מבחן 🏁'}</span>
    </button>
  `;

  document.querySelectorAll('#cp-opts-grid .option-card').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#cp-opts-grid .option-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      cpUserAnswers[cpQuestionIdx] = parseInt(btn.getAttribute('data-idx'), 10);
      document.getElementById('checkpoint-next-btn').disabled = false;
    };
  });

  document.getElementById('tts-checkpoint-q-btn').onclick = () => {
    SoundService.speakText(`שאלה ${cpQuestionIdx + 1}. ${q.question}`);
  };

  document.getElementById('checkpoint-next-btn').onclick = () => {
    if (cpQuestionIdx + 1 < total) {
      cpQuestionIdx++;
      renderCheckpointQuestion();
    } else {
      finishCheckpointTest();
    }
  };

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

  footer.innerHTML = passed
    ? `<button class="primary-btn" onclick="showView('roadmap');renderRoadmap();" style="width: 100%;"><span>מעולה! חזרה למסלול האישי 🌟</span></button>`
    : `<button class="primary-btn" onclick="openCheckpointTest(currentCheckpoint)" style="width: 100%;"><span>נסה שוב עם שאלות חדשות 🔄</span></button>`;

  SoundService.speakText(passed 
    ? `כל הכבוד דניאל! קיבלת ציון ${finalScore} ועברת בהצלחה! השלב הבא נפתח כעת.`
    : `קיבלת ציון ${finalScore}. כדי להמשיך צריך 85 ומעלה. ננסה שוב ונעבור יחד!`
  );
}

// ============================================================================
// 7. נגן יחידת הלימוד האינטראקטיבי (4-Step Unit Player)
// ============================================================================

function renderUnitPlayer(unitId) {
  const unit = appState.curriculumUnits.find(u => u.id === unitId);
  if (!unit) return;

  document.getElementById('unit-view-title').textContent = unit.title;
  document.getElementById('unit-main-title').textContent = unit.title;
  document.getElementById('unit-topic-badge').textContent = unit.category || 'מיומנות מעשית';
  document.getElementById('unit-goal-desc').textContent = unit.goal;

  document.getElementById('unit-back-btn').onclick = () => {
    showView('roadmap');
    renderRoadmap();
  };

  // שלב 1: המחשה מוחשית Side-by-Side
  document.getElementById('demo-bad-prompt').textContent = `"${unit.step1_demo.badPrompt}"`;
  document.getElementById('demo-bad-result').textContent = unit.step1_demo.badResult;
  document.getElementById('demo-good-prompt').textContent = `"${unit.step1_demo.goodPrompt}"`;
  document.getElementById('demo-good-result').textContent = unit.step1_demo.goodResult;

  document.getElementById('tts-demo-btn').onclick = () => {
    SoundService.speakText(`המחשה: שים לב להבדל. כששואלים לא ברור: ${unit.step1_demo.badPrompt}, מקבלים תשובה ארוכה ומבלבלת. כששואלים מדויק: ${unit.step1_demo.goodPrompt}, מקבלים תשובה קצרה ומעולה.`);
  };

  // שלב 2: הסבר קצר ומאיר עיניים
  document.getElementById('unit-takeaway-text').innerHTML = unit.step2_takeaway;
  document.getElementById('tts-explanation-btn').onclick = () => {
    SoundService.speakText(unit.step2_takeaway);
  };

  // שלב 3: וידוא הבנה (Comprehension Quiz)
  const quiz = unit.step3_quiz;
  document.getElementById('quiz-question-text').textContent = quiz.question;
  document.getElementById('tts-quiz-btn').onclick = () => SoundService.speakText(quiz.question);

  const quizOptionsContainer = document.getElementById('quiz-options-container');
  const quizFeedbackBox = document.getElementById('quiz-feedback-box');
  const actionLockedNotice = document.getElementById('action-locked-notice');
  const actionUnlockedContent = document.getElementById('action-unlocked-content');
  const stepActionBox = document.getElementById('step-action-box');

  quizOptionsContainer.innerHTML = '';
  quizFeedbackBox.style.display = 'none';

  let hasAnsweredCorrectly = unit.isCompleted;

  if (hasAnsweredCorrectly) {
    stepActionBox.classList.remove('locked-step');
    actionLockedNotice.style.display = 'none';
    actionUnlockedContent.style.display = 'block';
  } else {
    stepActionBox.classList.add('locked-step');
    actionLockedNotice.style.display = 'block';
    actionUnlockedContent.style.display = 'none';
  }

  quiz.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiz-option-btn';
    btn.innerHTML = `<span>${opt.text}</span><span class="quiz-btn-icon">🔘</span>`;

    btn.onclick = () => {
      quizOptionsContainer.querySelectorAll('.quiz-option-btn').forEach(b => {
        b.classList.remove('correct', 'incorrect');
        b.querySelector('.quiz-btn-icon').textContent = '🔘';
      });

      if (opt.isCorrect) {
        btn.classList.add('correct');
        btn.querySelector('.quiz-btn-icon').textContent = '✓';
        SoundService.playSuccessSound();

        quizFeedbackBox.className = 'quiz-feedback-box success';
        quizFeedbackBox.innerHTML = `<span>⭐ מצוין! ${opt.explanation}</span>`;
        quizFeedbackBox.style.display = 'block';

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: true
        });

        stepActionBox.classList.remove('locked-step');
        actionLockedNotice.style.display = 'none';
        actionUnlockedContent.style.display = 'block';
        saveAppState();
      } else {
        btn.classList.add('incorrect');
        btn.querySelector('.quiz-btn-icon').textContent = '✕';
        SoundService.playErrorSound();

        quizFeedbackBox.className = 'quiz-feedback-box error';
        quizFeedbackBox.innerHTML = `<span>לא מדויק: ${opt.explanation} נסה שוב!</span>`;
        quizFeedbackBox.style.display = 'block';

        appState.quizHistory.push({
          unitId: unit.id,
          timestamp: new Date().toISOString(),
          isCorrect: false
        });
        saveAppState();

        triggerAsyncReinforcement(unit, opt.text);
      }
    };

    quizOptionsContainer.appendChild(btn);
  });

  // שלב 4: עשייה מעשית
  document.getElementById('action-prompt-display').textContent = `"${unit.step4_action.prompt}"`;
  document.getElementById('action-do-instruction').textContent = unit.step4_action.doText;

  const copyBtn = document.getElementById('unit-copy-btn');
  copyBtn.onclick = () => copyToClipboard(unit.step4_action.prompt, copyBtn);

  document.getElementById('unit-test-here-btn').onclick = () => {
    openPlaygroundModal(unit.step4_action.prompt);
  };

  const finishBtn = document.getElementById('unit-finish-btn');
  const feedbackBox = document.getElementById('unit-feedback-box');
  const ribbon = document.getElementById('unit-completed-ribbon');

  const waBtn = document.getElementById('unit-share-wa-btn');
  if (unit.isCompleted) {
    finishBtn.parentElement.style.display = 'none';
    feedbackBox.style.display = 'none';
    ribbon.style.display = 'flex';
    if (waBtn) {
      waBtn.style.display = 'inline-flex';
      waBtn.onclick = () => {
        shareProgressToWhatsApp(`היי אבא! הרגע סיימתי בהצלחה את יחידה "${unit.title}" במערכת AI! 🎉`);
      };
    }
  } else {
    if (waBtn) waBtn.style.display = 'none';
    finishBtn.parentElement.style.display = 'block';
    feedbackBox.style.display = 'none';
    ribbon.style.display = 'none';

    finishBtn.onclick = () => {
      finishBtn.parentElement.style.display = 'none';
      feedbackBox.style.display = 'block';
    };

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
        showToast(`כל הכבוד! היחידה "${unit.title}" הושלמה! ⭐`);
        saveAppState();
        renderUnitPlayer(unit.id);
      };
    });
  }
}

// ============================================================================
// 8. תהליך אדפטיבי אסינכרוני ברקע (Async Adaptive Reinforcement)
// ============================================================================

async function triggerAsyncReinforcement(failedUnit, userChoice) {
  setTimeout(async () => {
    try {
      console.log(`[Async Engine] Generating reinforcement for unit: ${failedUnit.id}`);
      
      const prompt = `דניאל התקשה ביחידה "${failedUnit.title}". שאלת הווידוא הייתה: "${failedUnit.step3_quiz.question}". הוא בחר בטעות בתשובה: "${userChoice}".
צור יחידת תגבור קצרה וקלה יותר, שתסביר את אותו עקרון בדיוק בצורה פשוטה, מוחשית ועדינה יותר. החזר אובייקט JSON תואם למבנה המערכת.`;

      const res = await AIService.callLessonGeneratorWithFallback(prompt);
      let parsed = null;

      try {
        const clean = res.text.substring(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1);
        parsed = JSON.parse(clean);
      } catch (e) {
        parsed = JSON.parse(AIService.synthesizeOfflineUnit(failedUnit.title));
      }

      if (parsed) {
        parsed.id = `reinforce_${Date.now()}`;
        parsed.title = `⭐ תגבור מותאם: ${parsed.title}`;
        parsed.isUnlocked = false;
        parsed.isCompleted = false;

        appState.needsReinforcementQueue.push({
          originalUnitId: failedUnit.id,
          createdUnitId: parsed.id,
          timestamp: new Date().toISOString(),
          reason: userChoice
        });

        const curIndex = appState.curriculumUnits.findIndex(u => u.id === failedUnit.id);
        const insertAt = Math.min(curIndex + 2, appState.curriculumUnits.length);
        appState.curriculumUnits.splice(insertAt, 0, parsed);

        saveAppState();
        console.log(`[Async Engine] Injected reinforcement unit: ${parsed.id}`);
      }
    } catch (err) {
      console.error('[Async Engine] Failed to generate reinforcement unit:', err);
    }
  }, 100);
}

// ============================================================================
// 9. ממשק הניהול והבקרה הסמוי (#admin)
// ============================================================================

let currentDraftUnit = null;

function checkAdminRoute() {
  if (window.location.hash === '#admin') {
    openAdminModal();
  }
}

function openAdminModal() {
  const pinModal = document.getElementById('admin-pin-modal');
  pinModal.style.display = 'flex';
  const pinInput = document.getElementById('admin-pin-input');
  const errorMsg = document.getElementById('pin-error-msg');
  pinInput.value = '';
  errorMsg.style.display = 'none';

  document.getElementById('close-pin-modal-btn').onclick = () => {
    pinModal.style.display = 'none';
    window.location.hash = '';
  };

  document.getElementById('submit-pin-btn').onclick = () => {
    const entered = pinInput.value.trim();
    const correctPin = appState.apiConfig.adminPin || ADMIN_PIN_DEFAULT;
    if (entered === correctPin) {
      pinModal.style.display = 'none';
      showView('admin');
      initAdminPanel();
    } else {
      errorMsg.style.display = 'block';
      SoundService.playErrorSound();
    }
  };
}

function initAdminPanel() {
  document.getElementById('exit-admin-btn').onclick = () => {
    window.location.hash = '';
    showView('roadmap');
    renderRoadmap();
  };

  const tabBtns = document.querySelectorAll('.adm-tab-btn');
  const tabPanels = document.querySelectorAll('.adm-tab-panel');

  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    };
  });

  renderAdminOverview();
  initAdminAssistant();
  renderCurriculumManager();
  renderNotesBoard();
  initAdminSettings();
}

function renderAdminOverview() {
  const completed = appState.curriculumUnits.filter(u => u.isCompleted).length;
  const total = appState.curriculumUnits.length;
  document.getElementById('adm-stat-units').textContent = `${completed} / ${total}`;

  const correctQuizzes = appState.quizHistory.filter(q => q.isCorrect).length;
  const totalQuizzes = appState.quizHistory.length;
  const accuracy = totalQuizzes > 0 ? Math.round((correctQuizzes / totalQuizzes) * 100) : 100;
  document.getElementById('adm-stat-accuracy').textContent = `${accuracy}%`;

  document.getElementById('adm-stat-reinforce').textContent = appState.needsReinforcementQueue.length;

  const table = document.getElementById('adm-units-table');
  table.innerHTML = '';
  appState.curriculumUnits.forEach((u, i) => {
    const row = document.createElement('div');
    row.className = 'cg-table-row';
    row.innerHTML = `
      <div><strong>#${i + 1} ${u.title}</strong></div>
      <div><span>${u.isCompleted ? '🟢 הושלם' : u.isUnlocked ? '🔵 פתוח' : '🔒 נעול'}</span></div>
    `;
    table.appendChild(row);
  });

  const reinforceList = document.getElementById('adm-reinforce-list');
  reinforceList.innerHTML = '';
  if (appState.needsReinforcementQueue.length === 0) {
    reinforceList.innerHTML = '<p style="color:var(--text-muted);">לא נרשמו תגבורים כרגע. דניאל מתקדם היטב!</p>';
  } else {
    appState.needsReinforcementQueue.forEach(r => {
      const item = document.createElement('div');
      item.className = 'cg-feedback-item';
      item.innerHTML = `
        <div>
          <strong>תגבור ליחידה: ${r.originalUnitId}</strong>
          <span style="font-size:0.85rem;color:var(--text-muted);display:block;">נבחרה תשובה שגויה: "${r.reason}"</span>
        </div>
        <span class="badge-tag" style="background:#fef3c7;color:#92400e;">הוזרק בהצלחה</span>
      `;
      reinforceList.appendChild(item);
    });
  }
}

// ============================================================================
// 10. עוזר ה-AI למלווה (Conversational Assistant & Live Preview)
// ============================================================================

function initAdminAssistant() {
  const chatMessages = document.getElementById('admin-chat-messages');
  const chatInput = document.getElementById('admin-chat-input');
  const sendBtn = document.getElementById('admin-chat-send-btn');
  const previewBox = document.getElementById('live-card-preview-container');
  const previewActions = document.getElementById('preview-actions');
  const approveBtn = document.getElementById('adm-approve-card-btn');

  sendBtn.onclick = async () => {
    const query = chatInput.value.trim();
    if (!query) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'user-msg';
    userMsg.textContent = query;
    chatMessages.appendChild(userMsg);
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const aiLoading = document.createElement('div');
    aiLoading.className = 'ai-msg';
    aiLoading.textContent = 'מנתח ומכין יחידת לימוד במבנה 4 השלבים עם שרשרת Fallback...';
    chatMessages.appendChild(aiLoading);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const sysInstruction = `אתה עוזר פדגוגי מומחה שבונה יחידות לימוד ב-AI עבור דניאל בן 28.
בנה יחידת לימוד מקיפה אך פשוטה ב-JSON תקני במבנה המדויק הבא בלבד:
{
  "title": "כותרת קצרה",
  "category": "קטגוריה",
  "goal": "מטרת הלימוד",
  "step1_demo": {
    "badPrompt": "בקשה כללית",
    "badResult": "תשובה ארוכה ומבלבלת",
    "goodPrompt": "בקשה מדויקת ופשוטה",
    "goodResult": "תשובה קצרה וברורה"
  },
  "step2_takeaway": "למה זה עבד במשפט אחד",
  "step3_quiz": {
    "question": "שאלת וידוא הבנה",
    "options": [
      { "text": "תשובה נכונה", "isCorrect": true, "explanation": "הסבר קצר" },
      { "text": "תשובה שגויה", "isCorrect": false, "explanation": "הסבר קצר" }
    ]
  },
  "step4_action": {
    "prompt": "משפט מוכן להעתקה",
    "doText": "הוראת ביצוע"
  }
}`;

      const aiRes = await AIService.callLessonGeneratorWithFallback(query, sysInstruction);
      document.getElementById('active-llm-label').textContent = `${aiRes.provider} (פעיל)`;

      let unitObj = null;
      try {
        let raw = aiRes.text || '';
        raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
        const first = raw.indexOf('{');
        const last = raw.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
          unitObj = JSON.parse(raw.substring(first, last + 1));
        } else {
          throw new Error('No JSON object found');
        }
      } catch (err) {
        console.warn('JSON parsing error, falling back:', err);
        unitObj = JSON.parse(AIService.synthesizeOfflineUnit(query));
      }

      unitObj.id = `custom_${Date.now()}`;
      unitObj.isUnlocked = true;
      unitObj.isCompleted = false;
      currentDraftUnit = unitObj;

      aiLoading.textContent = `היחידה נוצרה בהצלחה באמצעות ${aiRes.provider}! הכרטיסייה מוצגת כעת ב-Live Preview מימין. באפשרותך ללחוץ על הטקסטים ולערוך אותם, או לאשר אותה.`;

      renderLivePreview(unitObj);
      previewActions.style.display = 'block';

    } catch (err) {
      aiLoading.textContent = `שגיאה ביצירת היחידה: ${err.message}. נעשה שימוש במנוע הפנימי.`;
      const fallbackUnit = JSON.parse(AIService.synthesizeOfflineUnit(query));
      currentDraftUnit = fallbackUnit;
      renderLivePreview(fallbackUnit);
      previewActions.style.display = 'block';
    }
  };

  approveBtn.onclick = () => {
    if (!currentDraftUnit) return;
    appState.curriculumUnits.push(currentDraftUnit);
    saveAppState();
    SoundService.playSuccessSound();
    showToast(`היחידה "${currentDraftUnit.title}" נוספה בהצלחה למסלול של דניאל! ⭐`);
    currentDraftUnit = null;
    previewBox.innerHTML = '<p style="color:var(--success);text-align:center;padding:2rem;">היחידה אושרה ונוספה למסלול! אפשר ליצור יחידה נוספת.</p>';
    previewActions.style.display = 'none';
    renderAdminOverview();
    renderCurriculumManager();
  };
}

function renderLivePreview(unit) {
  const box = document.getElementById('live-card-preview-container');
  box.innerHTML = `
    <div style="border:2px solid var(--primary);border-radius:12px;padding:1rem;background:#fff;">
      <h3 contenteditable="true" class="editable-field" id="edit-unit-title" style="color:var(--primary);margin-bottom:0.5rem;">${unit.title}</h3>
      <p contenteditable="true" class="editable-field" id="edit-unit-goal" style="color:var(--text-muted);margin-bottom:1rem;">${unit.goal}</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
        <div style="background:#fff5f5;border:1px solid #fca5a5;padding:0.75rem;border-radius:8px;">
          <strong>❌ בקשה כללית:</strong>
          <div contenteditable="true" class="editable-field" id="edit-bad-prompt">${unit.step1_demo.badPrompt}</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;padding:0.75rem;border-radius:8px;">
          <strong>✅ בקשה מדויקת:</strong>
          <div contenteditable="true" class="editable-field" id="edit-good-prompt">${unit.step1_demo.goodPrompt}</div>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;padding:0.75rem;border-radius:8px;margin-bottom:1rem;">
        <strong>💡 למה זה עבד:</strong>
        <div contenteditable="true" class="editable-field" id="edit-takeaway">${unit.step2_takeaway}</div>
      </div>

      <div style="border:1.5px solid #cbd5e1;padding:0.75rem;border-radius:8px;margin-bottom:1rem;">
        <strong>❓ שאלת וידוא הבנה:</strong>
        <div contenteditable="true" class="editable-field" id="edit-quiz-q">${unit.step3_quiz.question}</div>
        <div style="margin-top:0.5rem;">
          <small>תשובה נכונה: </small>
          <div contenteditable="true" class="editable-field" id="edit-quiz-opt-0" style="color:var(--success);font-weight:bold;">${unit.step3_quiz.options[0].text}</div>
        </div>
      </div>

      <div style="background:#eff6ff;border:1.5px dashed var(--primary);padding:0.75rem;border-radius:8px;">
        <strong>🚀 פרומפט מעשי לדניאל:</strong>
        <div contenteditable="true" class="editable-field" id="edit-action-prompt">${unit.step4_action.prompt}</div>
      </div>
    </div>
  `;

  box.querySelectorAll('.editable-field').forEach(el => {
    el.oninput = () => {
      unit.title = document.getElementById('edit-unit-title').textContent;
      unit.goal = document.getElementById('edit-unit-goal').textContent;
      unit.step1_demo.badPrompt = document.getElementById('edit-bad-prompt').textContent;
      unit.step1_demo.goodPrompt = document.getElementById('edit-good-prompt').textContent;
      unit.step2_takeaway = document.getElementById('edit-takeaway').textContent;
      unit.step3_quiz.question = document.getElementById('edit-quiz-q').textContent;
      unit.step3_quiz.options[0].text = document.getElementById('edit-quiz-opt-0').textContent;
      unit.step4_action.prompt = document.getElementById('edit-action-prompt').textContent;
    };
  });
}

// ============================================================================
// 11. ניהול יחידות לימוד ומסלול (Curriculum Management)
// ============================================================================

function renderCurriculumManager() {
  const container = document.getElementById('adm-curriculum-list');
  container.innerHTML = '';

  appState.curriculumUnits.forEach((unit, idx) => {
    const row = document.createElement('div');
    row.className = 'curriculum-item-row';
    row.innerHTML = `
      <div>
        <span class="badge-tag">#${idx + 1}</span>
        <strong>${unit.title}</strong>
        <span style="font-size:0.85rem;color:var(--text-muted);display:block;">${unit.goal}</span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <button class="secondary-btn edit-unit-btn" style="padding:0.4rem 0.8rem;min-height:38px;">✏️ ערוך</button>
        <button class="danger-btn delete-unit-btn" style="padding:0.4rem 0.8rem;">🗑️ מחק</button>
      </div>
    `;

    row.querySelector('.edit-unit-btn').onclick = () => {
      currentDraftUnit = unit;
      renderLivePreview(unit);
      document.querySelector('[data-tab="adm-assistant"]').click();
      document.getElementById('preview-actions').style.display = 'block';
      showToast('היחידה נטענה ל-Live Preview לעריכה');
    };

    row.querySelector('.delete-unit-btn').onclick = () => {
      if (confirm(`האם למחוק את היחידה "${unit.title}" ממסלול הלימוד?`)) {
        appState.curriculumUnits.splice(idx, 1);
        saveAppState();
        renderCurriculumManager();
        renderAdminOverview();
        showToast('היחידה נמחקה בהצלחה.');
      }
    };

    container.appendChild(row);
  });

  document.getElementById('adm-add-blank-unit-btn').onclick = () => {
    const newUnit = JSON.parse(AIService.synthesizeOfflineUnit('יחידה חדשה'));
    newUnit.id = `unit_manual_${Date.now()}`;
    currentDraftUnit = newUnit;
    renderLivePreview(newUnit);
    document.querySelector('[data-tab="adm-assistant"]').click();
    document.getElementById('preview-actions').style.display = 'block';
  };
}

// ============================================================================
// 12. לוח פתקים והארות משותף לאושרי ולאבא (Shared Notes Board)
// ============================================================================

function renderNotesBoard() {
  const container = document.getElementById('notes-stream-container');
  container.innerHTML = '';

  const addNoteBtn = document.getElementById('add-note-btn');
  const authorSelect = document.getElementById('note-author-select');
  const textInput = document.getElementById('note-text-input');

  addNoteBtn.onclick = () => {
    const text = textInput.value.trim();
    if (!text) return;

    appState.caregiverNotes.unshift({
      id: `note_${Date.now()}`,
      author: authorSelect.value,
      date: new Date().toISOString().split('T')[0],
      text: text
    });

    textInput.value = '';
    saveAppState();
    SoundService.playSuccessSound();
    renderNotesBoard();
    showToast('הפתק נשמר בהצלחה! 📌');
  };

  appState.caregiverNotes.forEach((n, idx) => {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.innerHTML = `
      <div>
        <div>
          <span class="note-author-tag">${n.author}</span>
          <span class="note-date-text">${n.date}</span>
        </div>
        <div class="note-content-text">${n.text}</div>
      </div>
      <button class="modal-close-btn delete-note-btn" style="width:32px;height:32px;font-size:1rem;" title="מחק פתק">✕</button>
    `;

    item.querySelector('.delete-note-btn').onclick = () => {
      appState.caregiverNotes.splice(idx, 1);
      saveAppState();
      renderNotesBoard();
    };

    container.appendChild(item);
  });
}

// ============================================================================
// 13. הגדרות API וחיבורים (Admin API & Backup Settings)
// ============================================================================

function initAdminSettings() {
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
      localStorage.removeItem(LEGACY_V1_KEY);
      location.reload();
    }
  };
}

// ============================================================================

function openPlaygroundModal(initialPrompt) {
  const modal = document.getElementById('ai-playground-modal');
  const textarea = document.getElementById('playground-prompt-input');
  const respBox = document.getElementById('playground-response-box');
  const respText = document.getElementById('playground-response-text');

  textarea.value = initialPrompt;
  respBox.style.display = 'none';
  modal.style.display = 'flex';

  document.getElementById('close-playground-btn').onclick = () => modal.style.display = 'none';
  document.getElementById('playground-done-btn').onclick = () => modal.style.display = 'none';

  document.getElementById('playground-send-btn').onclick = async () => {
    const prompt = textarea.value.trim();
    if (!prompt) return;

    respBox.style.display = 'block';
    respText.textContent = 'ה-AI מכין עבורך תשובה קצרה ופשוטה...';

    try {
      // קורא לפונקציית השיחה הייעודית - שמחזירה תמיד טקסט קצר ולא JSON!
      const answer = await AIService.callChatWithFallback(prompt);
      respText.textContent = answer;
      SoundService.playSuccessSound();
    } catch (err) {
      respText.textContent = AIService.simulateSimpleChatAnswer(prompt);
      SoundService.playSuccessSound();
    }
  };

  document.getElementById('tts-playground-resp').onclick = () => {
    SoundService.speakText(respText.textContent);
  };
}

// ============================================================================
// 15. עזרי גיבוי והעתקה
// ============================================================================

function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    SoundService.playSuccessSound();
    btnElement.classList.add('copied');
    const orig = btnElement.querySelector('.btn-text').textContent;
    btnElement.querySelector('.btn-text').textContent = '✓ הועתק בהצלחה!';
    showToast('המשפט הועתק! עכשיו אפשר להדביק ב-ChatGPT');
    setTimeout(() => {
      btnElement.classList.remove('copied');
      btnElement.querySelector('.btn-text').textContent = orig;
    }, 2500);
  }).catch(() => {
    showToast('בחר והעתק את הטקסט באופן ידני.');
  });
}

function exportBackupFile() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'daniel-ai-learning-v2-backup.json');
  document.body.appendChild(a);
  a.click();
  a.remove();
  SoundService.playSuccessSound();
  showToast('קובץ הגיבוי הורד בהצלחה! 💾');
}

function handleRestoreBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && typeof data === 'object') {
        appState = data;
        saveAppState();
        SoundService.playSuccessSound();
        showToast('הנתונים שוחזרו בהצלחה! ⭐');
        setTimeout(() => location.reload(), 1200);
      }
    } catch (err) {
      alert('שגיאה בטעינת קובץ: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// 16. שאלון וכיול (Assessment & Calibration)
// ============================================================================

const ASSESSMENT_QUESTIONS = [
  { id: 1, title: 'איך אתה רוצה שנקרא לך?', helper: 'בחר או כתוב שם:', type: 'single_or_text', options: ['דניאל', 'דני', 'אחר'] },
  { id: 2, title: 'מה אתה עושה ביום-יום?', helper: 'בחר מה מתאים:', type: 'single', options: ['לומד', 'עובד', 'גם לומד וגם עובד', 'משהו אחר'] },
  { id: 3, title: 'מה אתה אוהב לעשות בזמנך הפנוי?', helper: 'סמן מה שכיף לך:', type: 'multi', options: ['לשמוע מוזיקה 🎵', 'לראות טלוויזיה 📺', 'חדשות 📰', 'ספורט ⚽', 'אינטרנט ו-YouTube ▶', 'משחקים 🎮', 'משהו אחר'] },
  { id: 4, title: 'איזה מוזיקה אתה אוהב?', helper: 'סמן סגנונות:', type: 'multi', options: ['ישראלית 🇮🇱', 'פופ 🎶', 'מזרחית 🎸', 'רוק ⚡', 'שקטה ומרגיעה 🎹'] },
  { id: 5, title: 'איזה תוכניות או ערוצים אתה אוהב?', helper: 'תוכניות או סדרות אהובות:', type: 'single', options: ['חדשות ועדכונים', 'סדרות וסרטים', 'ספורט', 'מוזיקה'] },
  { id: 6, title: 'אנשים מוכרים שאתה מעריך?', helper: 'זמרים או אנשי ציבור:', type: 'single', options: ['זמרים ישראליים', 'שחקנים', 'ספורטאים', 'מנחי טלוויזיה'] },
  { id: 7, title: 'במה אתה מרגיש שאתה טוב?', helper: 'חוזקות שלך:', type: 'multi', options: ['זוכר דברים טוב 🧠', 'מוזיקה 🎵', 'מחשבים 💻', 'חשבון ומספרים 🔢', 'דברים אחרים'] },
  { id: 8, title: 'מה לפעמים קשה ומעייף אותך?', helper: 'כדי שנתאים את הלמידה בדיוק:', type: 'multi', options: ['לקרוא טקסט ארוך 📄', 'שאלות מורכבות ❓', 'לזכור רצף פעולות 🧠', 'לנסח משפטים בעצמי ✍️'] },
  { id: 9, title: 'במה תרצה ש-AI יעזור לך בחיים?', helper: 'מטרות עיקריות:', type: 'multi', options: ['להבין דברים במילים פשוטות 💡', 'לנסח הודעות בעבודה ✍️', 'להכין תמונות מעניינות 🎨', 'להבין תלוש שכר וחשבונות 💰'] },
  { id: 10, title: 'איך הכי נוח לך ללמוד?', helper: 'הדרך הכי נעימה לך:', type: 'single', options: ['לראות דוגמה מוכנה מול העיניים 👀', 'הסבר קצר של שורה אחת 📝', 'לנסות בעצמי מיד ✋', 'שילוב של דוגמה ותרגול 🎯'] }
];

const CALIBRATION_ROUNDS = [
  { id: 1, title: 'סבב 1: פשטות וציטוט ישיר', optionA: { text: 'בקש מ-AI להסביר לך מה זה חשבון בנק.' }, optionB: { text: 'כתוב ל-AI:\n"מה זה חשבון בנק? תסביר לי פשוט."' } },
  { id: 2, title: 'סבב 2: שלבים ממוספרים מול משפט רציף', optionA: { text: 'צעד 1: פתח את ה-AI.\nצעד 2: העתק את המשפט.\nצעד 3: שלח.' }, optionB: { text: 'היכנס ל-AI והעתק לשם את המשפט המוכן כדי לקבל תשובה.' } },
  { id: 3, title: 'סבב 3: אורך ההסבר', optionA: { text: 'כתוב: "מי הזמר של השיר הזה?"' }, optionB: { text: 'כדי לדעת מי שר שיר שאתה אוהב, שאל את ה-AI: "מי הזמר של השיר הזה?" והוא יסביר לך.' } },
  { id: 4, title: 'סבב 4: דוגמה מוחשית', optionA: { text: 'בקש מ-AI רעיון לשיר על מוזיקה שאתה אוהב.' }, optionB: { text: 'בקש מ-AI ליצור טקסט יצירתי בנושא לבחירתך.' } },
  { id: 5, title: 'סבב 5: שפת דיבור יומיומית', optionA: { text: 'תגיד ל-AI:\n"לא הבנתי, תסביר לי שוב יותר ברור."' }, optionB: { text: 'הזן במערכת:\n"אנא נסח מחדש את התשובה בצורה מפושטת."' } }
];

function renderAssessmentQuestion(index) {
  appState.currentAssessmentIndex = index;
  const q = ASSESSMENT_QUESTIONS[index];
  const total = ASSESSMENT_QUESTIONS.length;

  document.getElementById('assessment-step-text').textContent = `שאלה ${index + 1} מתוך ${total}`;
  document.getElementById('assessment-progress-bar').style.width = `${((index + 1) / total) * 100}%`;
  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-helper').textContent = q.helper;

  const contentBox = document.getElementById('question-content');
  contentBox.innerHTML = '';

  const prevBtn = document.getElementById('assessment-prev-btn');
  const nextBtn = document.getElementById('assessment-next-btn');
  prevBtn.style.visibility = index > 0 ? 'visible' : 'hidden';
  prevBtn.onclick = () => renderAssessmentQuestion(index - 1);

  if (q.type === 'multi') {
    const selected = appState.answers[q.id] || [];
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `choice-btn ${selected.includes(opt) ? 'selected' : ''}`;
      btn.innerHTML = `<span>${opt}</span><span class="choice-check">✓</span>`;
      btn.onclick = () => {
        let sel = appState.answers[q.id] || [];
        sel = sel.includes(opt) ? sel.filter(x => x !== opt) : [...sel, opt];
        appState.answers[q.id] = sel;
        btn.classList.toggle('selected');
        saveAppState();
      };
      grid.appendChild(btn);
    });
    contentBox.appendChild(grid);
  } else {
    const currentVal = appState.answers[q.id] || (q.options ? q.options[0] : '');
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `choice-btn ${currentVal === opt ? 'selected' : ''}`;
      btn.innerHTML = `<span>${opt}</span><span class="choice-check">✓</span>`;
      btn.onclick = () => {
        appState.answers[q.id] = opt;
        grid.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        saveAppState();
      };
      grid.appendChild(btn);
    });
    contentBox.appendChild(grid);
  }

  document.getElementById('tts-question-btn').onclick = () => SoundService.speakText(`${q.title}. ${q.helper}`);
  nextBtn.onclick = () => {
    if (index + 1 < total) {
      renderAssessmentQuestion(index + 1);
    } else {
      showView('calibration');
      renderCalibrationRound(0);
    }
  };
}

function renderCalibrationRound(index) {
  appState.currentCalibrationIndex = index;
  const round = CALIBRATION_ROUNDS[index];
  const total = CALIBRATION_ROUNDS.length;

  document.getElementById('calibration-step-text').textContent = `סבב ${index + 1} מתוך ${total}: ${round.title}`;
  document.getElementById('calibration-progress-bar').style.width = `${((index + 1) / total) * 100}%`;

  const cardA = document.getElementById('option-card-a');
  const cardB = document.getElementById('option-card-b');
  const textA = document.getElementById('option-text-a');
  const textB = document.getElementById('option-text-b');
  const nextBtn = document.getElementById('calibration-next-btn');

  textA.textContent = round.optionA.text;
  textB.textContent = round.optionB.text;

  document.getElementById('tts-opt-a').onclick = (e) => { e.stopPropagation(); SoundService.speakText(round.optionA.text); };
  document.getElementById('tts-opt-b').onclick = (e) => { e.stopPropagation(); SoundService.speakText(round.optionB.text); };

  cardA.classList.remove('selected');
  cardB.classList.remove('selected');
  nextBtn.disabled = true;

  let currentSelected = null;
  const select = (choice) => {
    currentSelected = choice;
    if (choice === 'A') { cardA.classList.add('selected'); cardB.classList.remove('selected'); }
    else { cardB.classList.add('selected'); cardA.classList.remove('selected'); }
    nextBtn.disabled = false;
  };

  cardA.onclick = () => select('A');
  cardB.onclick = () => select('B');

  nextBtn.onclick = () => {
    if (!currentSelected) return;
    appState.calibrationChoices[index] = { roundId: round.id, choice: currentSelected };
    saveAppState();
    if (index + 1 < total) {
      renderCalibrationRound(index + 1);
    } else {
      // יצירת פרופיל
      appState.profile = {
        name: appState.user.name || 'דניאל',
        completedAt: new Date().toISOString()
      };
      saveAppState();

      showView('transition');
      setTimeout(() => {
        document.getElementById('calm-status-text').textContent = 'המסלול מוכן בשבילך!';
      }, 1500);
      document.getElementById('continue-to-roadmap-btn').onclick = () => {
        showView('roadmap');
        renderRoadmap();
      };
    }
  };
}

// ============================================================================
// 17. אתחול ראשי - שחזור סשן מלא בריפרש!
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  performMigrationIfNeeded();

  checkAndApplyShabbatLock();
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

  const cpBackBtn = document.getElementById('checkpoint-back-btn');
  if (cpBackBtn) {
    cpBackBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };
  }

  showToast('המערכת נטענה בהצלחה! ברוך הבא 🌟');

  checkAdminRoute();
  window.addEventListener('hashchange', checkAdminRoute);

  let footerClicks = 0;
  const trigger = document.getElementById('footer-admin-trigger');
  if (trigger) {
    trigger.onclick = () => {
      footerClicks++;
      if (footerClicks >= 3) {
        footerClicks = 0;
        openAdminModal();
      }
    };
  }

  document.getElementById('global-tts-btn').onclick = () => {
    let text = 'מאמן ה-אי-איי האישי של דניאל. לומדים צעד אחר צעד בקצב שלך.';
    if (appState.currentView === 'unit') {
      const u = appState.curriculumUnits.find(x => x.id === appState.activeUnitId);
      if (u) text = `${u.title}. ${u.goal}`;
    }
    SoundService.speakText(text);
  };

  const startBtn = document.getElementById('start-btn');
  const restoreBtn = document.getElementById('restore-link-btn');
  const backupInput = document.getElementById('backup-file-input');

  if (restoreBtn && backupInput) {
    restoreBtn.onclick = () => backupInput.click();
    backupInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleRestoreBackup(file);
    };
  }

  // --- שחזור מצב חכם ומדויק בריפרש ---
  const hasProfile = Boolean(appState.profile && Object.keys(appState.profile).length > 0);
  const hasCompletedUnits = appState.curriculumUnits.some(u => u.isCompleted);
  const hasActiveSession = hasProfile || hasCompletedUnits;

  if (hasActiveSession) {
    document.getElementById('welcome-title').textContent = `שלום ${appState.user.name || 'דניאל'}`;
    document.getElementById('start-btn-text').textContent = 'המשך במסלול שלי ▶';
    startBtn.onclick = () => {
      showView('roadmap');
      renderRoadmap();
    };

    // משחזר את המסך שבו דניאל עצר (בתוך יחידה או במסלול)
    if (appState.currentView === 'unit' && appState.activeUnitId) {
      showView('unit');
      renderUnitPlayer(appState.activeUnitId);
    } else {
      showView('roadmap');
      renderRoadmap();
    }
  } else {
    // משתמש חדש לגמרי שעוד לא סיים שאלון
    document.getElementById('welcome-title').textContent = 'שלום דניאל';
    document.getElementById('start-btn-text').textContent = 'בוא נתחיל ▶';
    startBtn.onclick = () => {
      showView('assessment');
      renderAssessmentQuestion(appState.currentAssessmentIndex || 0);
    };

    // אם המשתמש ריפרש באמצע השאלון או הכיול - השאר אותו בדיוק שם!
    if (appState.currentView === 'assessment') {
      showView('assessment');
      renderAssessmentQuestion(appState.currentAssessmentIndex || 0);
    } else if (appState.currentView === 'calibration') {
      showView('calibration');
      renderCalibrationRound(appState.currentCalibrationIndex || 0);
    } else {
      showView('welcome');
    }
  }
});
