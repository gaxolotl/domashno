// Sample timetable used by the "Sample 7A" import button.
//
// The structure mirrors a real Shkolo export (day, period, subject, teacher,
// room, times), but all names are FICTIONAL — no real people or schools.
//
// day: 1 = Monday ... 5 = Friday ; period: 0 = "нулев час", 1..7 = regular.

const T = {
  math: 'Елена Т. Димитрова',
  lit: 'Стефан П. Йорданов',
  geo: 'Ирина Н. Костова',
  physics: 'Габриела П. Стоянова',
  chem: 'Виолета Р. Маринова',
  bio: 'Светла В. Павлова',
  music: 'Десислава Й. Христова',
  en: 'Надежда К. Василева',
  it: 'Мария П. Ангелова',
  tech: 'Радостина Д. Петрова',
  pe: 'Петя Д. Николова',
  pe2: 'Борис Р. Георгиев',
  cs: 'Мартин И. Тодоров',
};

export const sample7a = {
  name: '7 А',
  note: 'Демонстрационен клас · класен ръководител: Надежда К. Василева',
  slots: [
    // Понеделник
    { day: 1, period: 1, subject: 'КМИТ / Група 1', teacher: T.it, room: 'к-т 16/16а (Етаж 2)', start: '13:30', end: '14:10' },
    { day: 1, period: 2, subject: 'КМИТ / Група 1', teacher: T.it, room: 'к-т 16/16а (Етаж 2)', start: '14:20', end: '15:00' },
    { day: 1, period: 3, subject: 'Геогр', teacher: T.geo, room: 'к-т 28 (Сутерен)', start: '15:10', end: '15:50' },
    { day: 1, period: 4, subject: 'Мат', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 1, period: 5, subject: 'БЕЛ (ИУЧ - РП/УП-А)', teacher: T.lit, room: 'к-т 27 (мултимедиен кабинет) (Сутерен)', start: '17:00', end: '17:40' },
    { day: 1, period: 6, subject: 'Техн и предпр', teacher: T.tech, room: 'к-т 25 (Етаж 3)', start: '17:50', end: '18:30' },

    // Вторник
    { day: 2, period: 0, subject: 'БЕЛ (ФУЧ - ДП/ДРУП)', teacher: T.lit, room: '', start: '12:40', end: '13:20' },
    { day: 2, period: 1, subject: 'Физика и астр', teacher: T.physics, room: 'к-т 22 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 2, period: 2, subject: 'Музика', teacher: T.music, room: 'к-т 13 (Етаж 1)', start: '14:20', end: '15:00' },
    { day: 2, period: 3, subject: 'БЕЛ', teacher: T.lit, room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 2, period: 4, subject: 'История', teacher: T.geo, room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 2, period: 5, subject: 'Англ', teacher: T.en, room: 'к-т 24 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 2, period: 6, subject: 'Англ', teacher: T.en, room: 'к-т 24 (Етаж 3)', start: '17:50', end: '18:30' },

    // Сряда
    { day: 3, period: 0, subject: 'Волейбол', teacher: T.pe, room: '', start: '12:40', end: '13:20' },
    { day: 3, period: 1, subject: 'Мат', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 3, period: 2, subject: 'Физика и астр', teacher: T.physics, room: 'к-т 22 (Етаж 3)', start: '14:20', end: '15:00' },
    { day: 3, period: 3, subject: 'БЕЛ', teacher: T.lit, room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 3, period: 4, subject: 'БЕЛ', teacher: T.lit, room: 'к-т 13 (Етаж 1)', start: '16:10', end: '16:50' },
    { day: 3, period: 5, subject: 'Англ', teacher: T.en, room: 'к-т 24 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 3, period: 6, subject: 'История', teacher: T.geo, room: 'к-т 24 (Етаж 3)', start: '17:50', end: '18:30' },
    { day: 3, period: 7, subject: 'ФВС', teacher: T.pe, room: '', start: '18:40', end: '19:20' },

    // Четвъртък
    { day: 4, period: 1, subject: 'ФВС (ЗАМ.)', teacher: T.pe2, room: '', start: '13:30', end: '14:10' },
    { day: 4, period: 2, subject: 'Химия', teacher: T.chem, room: 'к-т 29 (Руски център) (Сутерен)', start: '14:20', end: '15:00' },
    { day: 4, period: 3, subject: 'Мат', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '15:10', end: '15:50' },
    { day: 4, period: 4, subject: 'Мат', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 4, period: 5, subject: 'Биол', teacher: T.bio, room: 'к-т 21 (Етаж 2)', start: '17:00', end: '17:40' },
    { day: 4, period: 6, subject: 'Геогр', teacher: T.geo, room: 'к-т 29 (Руски център) (Сутерен)', start: '17:50', end: '18:30' },
    { day: 4, period: 7, subject: 'Безоп на движ', teacher: T.en, room: 'к-т 24 (Етаж 3)', start: '18:40', end: '19:20' },

    // Петък
    { day: 5, period: 0, subject: 'Мат (ФУЧ - ДП/ДРУП)', teacher: T.math, room: '', start: '12:40', end: '13:20' },
    { day: 5, period: 1, subject: 'Мат', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 5, period: 2, subject: 'Мат (ИУЧ - РП/УП-А)', teacher: T.math, room: 'к-т 23 (Етаж 3)', start: '14:20', end: '15:00' },
    { day: 5, period: 3, subject: 'Музика', teacher: T.music, room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 5, period: 4, subject: 'Биол', teacher: T.bio, room: 'к-т 20 (Етаж 2)', start: '16:10', end: '16:50' },
    { day: 5, period: 5, subject: 'БЕЛ', teacher: T.lit, room: 'к-т 23 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 5, period: 6, subject: 'БЕЛ', teacher: T.lit, room: 'к-т 23 (Етаж 3)', start: '17:50', end: '18:30' },
    { day: 5, period: 7, subject: 'ИИ', teacher: T.cs, room: 'к-т 28 (Сутерен)', start: '18:40', end: '19:20' },
  ],
};
