// The timetable read from the user's Shkolo PDF (7 А, week of 05.10.2026).
// Labels, teachers, rooms and times follow the PDF so imports stay faithful;
// everything can be edited afterwards in the app.
//
// day: 1 = Monday ... 5 = Friday ; period: 0 = "нулев час", 1..7 = regular.

export const sample7a = {
  name: '7 А',
  note: 'Георги И. Гърдев, 7А - бб · класен: Галина К. Големанова-Перфанова',
  slots: [
    // Понделник
    { day: 1, period: 1, subject: 'КМИТ / Група 1', teacher: 'Павлина П. Дончева', room: 'к-т 16/16а (Етаж 2)', start: '13:30', end: '14:10' },
    { day: 1, period: 2, subject: 'КМИТ / Група 1', teacher: 'Павлина П. Дончева', room: 'к-т 16/16а (Етаж 2)', start: '14:20', end: '15:00' },
    { day: 1, period: 3, subject: 'Геогр', teacher: 'Лилия Н. Боярова-Недялкова', room: 'к-т 28 (Сутерен)', start: '15:10', end: '15:50' },
    { day: 1, period: 4, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 1, period: 5, subject: 'БЕЛ (ИУЧ - РП/УП-А)', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 27 (мултимедиен кабинет) (Сутерен)', start: '17:00', end: '17:40' },
    { day: 1, period: 6, subject: 'Техн и предпр', teacher: 'Светлана Д. Динева', room: 'к-т 25 (Етаж 3)', start: '17:50', end: '18:30' },

    // Вторник
    { day: 2, period: 0, subject: 'БЕЛ (ФУЧ - ДП/ДРУП)', teacher: 'Веселин П. Кюмюрджиев', room: '', start: '12:40', end: '13:20' },
    { day: 2, period: 1, subject: 'Физика и астр', teacher: 'Кети П. Маринова', room: 'к-т 22 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 2, period: 2, subject: 'Музика', teacher: 'Яна Й. Тодорова', room: 'к-т 13 (Етаж 1)', start: '14:20', end: '15:00' },
    { day: 2, period: 3, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 2, period: 4, subject: 'История', teacher: 'Лилия Н. Боярова-Недялкова', room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 2, period: 5, subject: 'Англ', teacher: 'Галина К. Големанова-Перфанова', room: 'к-т 24 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 2, period: 6, subject: 'Англ', teacher: 'Галина К. Големанова-Перфанова', room: 'к-т 24 (Етаж 3)', start: '17:50', end: '18:30' },

    // Сряда
    { day: 3, period: 0, subject: 'Волейбол', teacher: 'Красимира Д. Иванова', room: '', start: '12:40', end: '13:20' },
    { day: 3, period: 1, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 3, period: 2, subject: 'Физика и астр', teacher: 'Кети П. Маринова', room: 'к-т 22 (Етаж 3)', start: '14:20', end: '15:00' },
    { day: 3, period: 3, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 3, period: 4, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 13 (Етаж 1)', start: '16:10', end: '16:50' },
    { day: 3, period: 5, subject: 'Англ', teacher: 'Галина К. Големанова-Перфанова', room: 'к-т 24 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 3, period: 6, subject: 'История', teacher: 'Лилия Н. Боярова-Недялкова', room: 'к-т 24 (Етаж 3)', start: '17:50', end: '18:30' },
    { day: 3, period: 7, subject: 'ФВС', teacher: 'Красимира Д. Иванова', room: '', start: '18:40', end: '19:20' },

    // Четвъртък
    { day: 4, period: 1, subject: 'ФВС (ЗАМ.)', teacher: 'Цветан Р. Иванов', room: '', start: '13:30', end: '14:10' },
    { day: 4, period: 2, subject: 'Химия', teacher: 'Станимира Р. Колева', room: 'к-т 29 (Руски център) (Сутерен)', start: '14:20', end: '15:00' },
    { day: 4, period: 3, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '15:10', end: '15:50' },
    { day: 4, period: 4, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '16:10', end: '16:50' },
    { day: 4, period: 5, subject: 'Биол', teacher: 'Росица В. Делчева', room: 'к-т 21 (Етаж 2)', start: '17:00', end: '17:40' },
    { day: 4, period: 6, subject: 'Геогр', teacher: 'Лилия Н. Боярова-Недялкова', room: 'к-т 29 (Руски център) (Сутерен)', start: '17:50', end: '18:30' },
    { day: 4, period: 7, subject: 'Безоп на движ', teacher: 'Галина К. Големанова-Перфанова', room: 'к-т 24 (Етаж 3)', start: '18:40', end: '19:20' },

    // Петък
    { day: 5, period: 0, subject: 'Мат (ФУЧ - ДП/ДРУП)', teacher: 'Венета Т. Кюркова', room: '', start: '12:40', end: '13:20' },
    { day: 5, period: 1, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '13:30', end: '14:10' },
    { day: 5, period: 2, subject: 'Мат (ИУЧ - РП/УП-А)', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: '14:20', end: '15:00' },
    { day: 5, period: 3, subject: 'Музика', teacher: 'Яна Й. Тодорова', room: 'к-т 13 (Етаж 1)', start: '15:10', end: '15:50' },
    { day: 5, period: 4, subject: 'Биол', teacher: 'Росица В. Делчева', room: 'к-т 20 (Етаж 2)', start: '16:10', end: '16:50' },
    { day: 5, period: 5, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 23 (Етаж 3)', start: '17:00', end: '17:40' },
    { day: 5, period: 6, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 23 (Етаж 3)', start: '17:50', end: '18:30' },
    { day: 5, period: 7, subject: 'ИИ', teacher: 'Йоан И. Попов', room: 'к-т 28 (Сутерен)', start: '18:40', end: '19:20' },
  ],
};
