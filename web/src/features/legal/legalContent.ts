// Terms of Service + Privacy Policy content (Bulgarian + English).
//
// Written in plain language. GDPR structure: who is responsible, what data,
// why (legal basis), sharing, retention, rights, children, contact.
//
// `{contact}` is replaced at render time with the operator's contact email
// (LEGAL_CONTACT_EMAIL) or a generic fallback. This app is self-hosted, so
// every installation has its own data controller — the person running it.

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDoc {
  updated: string;
  intro: string[];
  sections: LegalSection[];
  outro: string[];
}

const CONTACT = '{contact}';

export const legal: Record<'bg' | 'en', { terms: LegalDoc; privacy: LegalDoc }> = {
  bg: {
    terms: {
      updated: 'октомври 2026 г.',
      intro: [
        'Домашно е приложение за училищно разписание и домашни работи: класът вижда програмата си, а учениците и учителите публикуват домашни с текст и файлове.',
        'Създавайки акаунт или влизайки, вие приемате тези условия. Ако не сте съгласни, моля не използвайте приложението.',
      ],
      sections: [
        {
          heading: 'Кой управлява услугата',
          paragraphs: [
            'Домашно е софтуер, който всеки може да инсталира на свой сървър. Отговорен за тази конкретна инсталация (вашите данни, регистрации, изтриване) е човекът, който я поддържа — обикновено учител или училищен администратор.',
            `За въпроси и искания пишете на ${CONTACT}.`,
          ],
        },
        {
          heading: 'Акаунтът ви',
          paragraphs: [
            'Влиза се с имейл код, или чрез [Google](https://www.google.com) / [GitHub](https://github.com), ако са включени. Давайте истинско име, за да ви разпознават съучениците.',
            'Вие отговаряте за всичко, направено с вашия акаунт. Не давайте кода за вход на класа на външни хора — той е само за вашия клас.',
          ],
        },
        {
          heading: 'Какво е позволено',
          paragraphs: ['Приложението е за училищна работа. Забранени са:'],
          bullets: [
            'незаконно, обидно или неприлично съдържание;',
            'спам, опити за разбиване, заобикаляне на лимити или чужди акаунти;',
            'качване на чужди лични данни (например снимки на хора) без тяхното съгласие.',
          ],
        },
        {
          heading: 'Вашето съдържание',
          paragraphs: [
            'Домашните, файловете и коментарите си остават ваши. С публикуването им позволявате да се съхраняват и показват на членовете на класа — иначе приложението не може да работи.',
            'Създателят на класа и администраторите могат да премахват неподходящо съдържание и да ограничават нарушители.',
          ],
        },
        {
          heading: 'Ученици',
          paragraphs: [
            'Класовете са училищни, затова тук има и непълнолетни. Ученици под 14 години използват приложението със знанието на родител или учител, а кодовете за присъединяване се споделят отговорно само в класа.',
          ],
        },
        {
          heading: 'Наличност',
          paragraphs: [
            'Услугата се предоставя „както е“, с най-добри усилия — без гаранция за непрекъсната работа. Възможни са прекъсвания за поддръжка, а изтрито домашно, файл или клас не може да се върне.',
          ],
        },
        {
          heading: 'Прекратяване и изтриване',
          paragraphs: [
            'Можете да напуснете клас по всяко време. За пълно изтриване на акаунта и данните пишете на оператора — вижте раздела „Вашите права“ в Политиката за поверителност.',
            'При нарушаване на тези условия достъпът ви може да бъде ограничен.',
          ],
        },
        {
          heading: 'Промени в условията',
          paragraphs: [
            'При съществени промени ще ви уведомим в приложението. Продължаването на използването след това означава, че ги приемате.',
          ],
        },
      ],
      outro: [`Въпроси? Пишете на ${CONTACT}.`],
    },
    privacy: {
      updated: 'октомври 2026 г.',
      intro: [
        'Накратко: пазим само данните, нужни за работата на приложението (акаунт, домашни, технически логове). Не продаваме данни и нямаме реклами или следящи бисквитки.',
        `Отговорен за данните в тази инсталация („администратор на лични данни“) е човекът, който я поддържа. Връзка: ${CONTACT}.`,
      ],
      sections: [
        {
          heading: 'Какви данни събираме',
          paragraphs: ['Събираме само това, без което приложението не работи:'],
          bullets: [
            'Акаунт: име, имейл адрес (потвърден с код), профилна снимка — само ако влизате чрез [Google](https://www.google.com) или [GitHub](https://github.com).',
            'Съдържание: домашни, файлове, разписания, класове и членства в тях.',
            'Технически данни за сигурност: IP адрес, браузър и устройство, час на влизане.',
            'Бисквитки: сесия за вход и защита от фалшиви заявки (строго необходими), тема и език (запазени във вашия браузър). Рекламни бисквитки няма.',
            'Проверка за бот при вход ([Cloudflare](https://www.cloudflare.com) Turnstile): Cloudflare получава IP адреса и технически данни за браузъра, за да различи човек от бот.',
          ],
        },
        {
          heading: 'Защо ги обработваме (основания по GDPR)',
          paragraphs: ['Всяка цел има правно основание по чл. 6 от GDPR:'],
          bullets: [
            'предоставяне на услугата (разписание, домашни, класове) — изпълнение на договор (чл. 6, пар. 1, б. „б“);',
            'кодове за вход по имейл — също част от влизането (договор);',
            'сигурност и защита от злоупотреби (логове, лимити, проверка за бот) — легитимен интерес (чл. 6, пар. 1, б. „е“);',
            'запис кога сте приели условията — ваше съгласие (чл. 6, пар. 1, б. „а“), което можете да оттеглите, като спрете да използвате услугата и поискате изтриване.',
          ],
        },
        {
          heading: 'С кого се споделят',
          paragraphs: [
            'Данните не се продават и не се дават за реклама. Достъп имат само услугите, без които приложението не работи (обработващи лични данни):',
          ],
          bullets: [
            'сървърът, на който е инсталирано приложението;',
            '[Cloudflare](https://www.cloudflare.com) — DNS, защита и проверка за бот (Turnstile);',
            '[Google](https://www.google.com) или [GitHub](https://github.com) — само ако влизате чрез тях (те потвърждават самоличността ви);',
            'доставчикът на имейли ([Resend](https://resend.com) или SMTP сървър) — само за изпращане на кодове за вход.',
          ],
        },
        {
          heading: 'Предаване извън ЕС',
          paragraphs: [
            'Някои доставчици (например Cloudflare, Google, GitHub, Resend) обработват данни и в САЩ. Те прилагат стандартните защитни мерки (стандартни договорни клаузи и вътрешни правила за защита на данните).',
          ],
        },
        {
          heading: 'Колко дълго се пазят',
          paragraphs: ['Данните се пазят не по-дълго от необходимото:'],
          bullets: [
            'акаунт и съдържание — докато имате акаунт; изтрито домашно, файл или клас се трие окончателно;',
            'сесии за вход — до 60 дни; кодовете за вход изтичат за 10 минути;',
            'записи за влизания (IP, устройство) — докато съществува акаунтът, след това се трият с него.',
          ],
        },
        {
          heading: 'Вашите права',
          paragraphs: [
            'По GDPR имате право на достъп, поправка, изтриване („право да бъдеш забравен“), преносимост, ограничаване и възражение срещу обработването.',
            `За да ги упражните, пишете на ${CONTACT} — отговаряме до един месец.`,
            'Ако смятате, че правата ви са нарушени, можете да подадете жалба до [Комисията за защита на личните данни](https://www.cpdp.bg) (България) или до надзорния орган във вашата държава.',
          ],
        },
        {
          heading: 'Деца',
          paragraphs: [
            'Ученици под 14 години използват приложението със съгласието на родител или учител. Учителят (създател на класа) кани учениците и отговаря за кодовете за присъединяване.',
          ],
        },
        {
          heading: 'Промени в политиката',
          paragraphs: [
            'При съществени промени ще ви уведомим в приложението. Датата на последна актуализация е посочена най-отгоре.',
          ],
        },
      ],
      outro: [`Въпроси за данните ви? Пишете на ${CONTACT}.`],
    },
  },
  en: {
    terms: {
      updated: 'October 2026',
      intro: [
        'Domashno is an app for class timetables and homework: the class sees its schedule, and pupils and teachers post homework with text and files.',
        'By creating an account or signing in, you accept these terms. If you disagree, please do not use the app.',
      ],
      sections: [
        {
          heading: 'Who runs this service',
          paragraphs: [
            'Domashno is software anyone can install on their own server. Responsible for this particular installation (your data, accounts, deletion) is the person who runs it — usually a teacher or school administrator.',
            `For questions and requests, contact ${CONTACT}.`,
          ],
        },
        {
          heading: 'Your account',
          paragraphs: [
            'You sign in with an email code, or via [Google](https://www.google.com) / [GitHub](https://github.com) where enabled. Please use your real name so classmates recognise you.',
            'You are responsible for everything done with your account. Do not share your class invite code with outsiders — it is for your class only.',
          ],
        },
        {
          heading: 'What is allowed',
          paragraphs: ['The app is for schoolwork. Forbidden:'],
          bullets: [
            'illegal, abusive or inappropriate content;',
            'spam, hacking attempts, bypassing limits, or accessing other people’s accounts;',
            'uploading other people\u2019s personal data (e.g. photos of people) without their permission.',
          ],
        },
        {
          heading: 'Your content',
          paragraphs: [
            'Your homework, files and comments stay yours. By posting them you allow them to be stored and shown to class members — otherwise the app cannot work.',
            'The class owner and administrators may remove inappropriate content and restrict violators.',
          ],
        },
        {
          heading: 'Pupils',
          paragraphs: [
            'Classes are school classes, so minors use this app too. Pupils under 14 use it with a parent\u2019s or teacher\u2019s knowledge, and invite codes are shared responsibly within the class only.',
          ],
        },
        {
          heading: 'Availability',
          paragraphs: [
            'The service is provided “as is”, on a best-effort basis — with no uptime guarantee. Maintenance downtime is possible, and deleted homework, files or classes cannot be restored.',
          ],
        },
        {
          heading: 'Termination and deletion',
          paragraphs: [
            'You can leave a class at any time. To fully delete your account and data, contact the operator — see “Your rights” in the Privacy Policy.',
            'Access may be restricted if you violate these terms.',
          ],
        },
        {
          heading: 'Changes to the terms',
          paragraphs: [
            'We will announce material changes in the app. Continuing to use it afterwards means you accept them.',
          ],
        },
      ],
      outro: [`Questions? Contact ${CONTACT}.`],
    },
    privacy: {
      updated: 'October 2026',
      intro: [
        'In short: we keep only the data the app needs to work (account, homework, technical logs). We do not sell data, and there is no advertising or tracking.',
        `The data controller for this installation is the person who runs it. Contact: ${CONTACT}.`,
      ],
      sections: [
        {
          heading: 'What data we collect',
          paragraphs: ['We collect only what the app cannot work without:'],
          bullets: [
            'Account: name, email address (verified with a code), profile picture — only when you sign in via [Google](https://www.google.com) or [GitHub](https://github.com).',
            'Content: homework, files, timetables, classes and memberships.',
            'Technical security data: IP address, browser and device, sign-in time.',
            'Cookies: sign-in session and anti-forgery protection (strictly necessary), theme and language (stored in your browser). No advertising cookies.',
            'Bot check at sign-in ([Cloudflare](https://www.cloudflare.com) Turnstile): Cloudflare receives the IP address and technical browser data to tell humans from bots.',
          ],
        },
        {
          heading: 'Why we process it (GDPR legal bases)',
          paragraphs: ['Every purpose has a legal basis under Art. 6 GDPR:'],
          bullets: [
            'providing the service (timetable, homework, classes) — performance of a contract (Art. 6(1)(b));',
            'email sign-in codes — also part of signing in (contract);',
            'security and abuse prevention (logs, rate limits, bot check) — legitimate interest (Art. 6(1)(f));',
            'a record of when you accepted the terms — your consent (Art. 6(1)(a)), which you can withdraw by stopping use and requesting deletion.',
          ],
        },
        {
          heading: 'Who we share it with',
          paragraphs: [
            'Data is never sold or shared for advertising. Only the services the app needs (data processors) have access:',
          ],
          bullets: [
            'the server this app is installed on;',
            '[Cloudflare](https://www.cloudflare.com) — DNS, protection and the bot check (Turnstile);',
            '[Google](https://www.google.com) or [GitHub](https://github.com) — only if you sign in through them (they confirm your identity);',
            'the email provider ([Resend](https://resend.com) or an SMTP server) — only for sending sign-in codes.',
          ],
        },
        {
          heading: 'Transfers outside the EU',
          paragraphs: [
            'Some providers (e.g. Cloudflare, Google, GitHub, Resend) also process data in the US. They apply standard safeguards (standard contractual clauses and internal data-protection rules).',
          ],
        },
        {
          heading: 'How long we keep it',
          paragraphs: ['Data is kept no longer than necessary:'],
          bullets: [
            'account and content — while you have an account; deleted homework, files or classes are gone for good;',
            'sign-in sessions — up to 60 days; sign-in codes expire after 10 minutes;',
            'sign-in records (IP, device) — while the account exists, then deleted with it.',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'Under the GDPR you have the right to access, rectify, erase (“right to be forgotten”), portability, restriction and objection.',
            `To exercise them, write to ${CONTACT} — we reply within one month.`,
            'If you believe your rights were violated, you can complain to the [Commission for Personal Data Protection](https://www.cpdp.bg) (Bulgaria) or your national supervisory authority.',
          ],
        },
        {
          heading: 'Children',
          paragraphs: [
            'Pupils under 14 use the app with a parent\u2019s or teacher\u2019s consent. The teacher (class owner) invites pupils and is responsible for the invite codes.',
          ],
        },
        {
          heading: 'Changes to this policy',
          paragraphs: [
            'We will announce material changes in the app. The last-updated date is shown at the top.',
          ],
        },
      ],
      outro: [`Questions about your data? Contact ${CONTACT}.`],
    },
  },
};
