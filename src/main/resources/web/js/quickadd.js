import { addDays, addMonths, iso, parse as parseDate, today, weekdayIndex } from './dates.js';

const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const SHORT_DAYS = 'mon|tue|wed|thu|fri|sat|sun';
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';
const LEAD = '(?:(?:on|by|due|at)\\s+)?';
const PRIORITIES = { urgent: 'urgent', high: 'high', medium: 'medium', med: 'medium', low: 'low', p1: 'urgent', p2: 'high', p3: 'medium', p4: 'low' };
const REPEATS = { daily: 'daily', 'every day': 'daily', weekdays: 'weekdays', 'every weekday': 'weekdays', weekly: 'weekly', 'every week': 'weekly', monthly: 'monthly', 'every month': 'monthly' };

const dayNumber = name => SHORT_DAYS.split('|').indexOf(name.toLowerCase().slice(0, 3));

const monthNumber = name => MONTHS.split('|').slice(0, 12).findIndex(month => month.startsWith(name.toLowerCase().slice(0, 3)));

const upcoming = (now, day, todayCounts) => addDays(now, (day - weekdayIndex(now) + 7) % 7 || (todayCounts ? 0 : 7));

const nextWeek = now => addDays(now, 7 - weekdayIndex(now));

const calendarDate = (now, month, day) => {
    const year = Number(now.slice(0, 4));
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) return null;
    return iso(date) < now ? iso(new Date(year + 1, month, day)) : iso(date);
};

const relative = (now, phrase) => {
    if (/^week$/i.test(phrase)) return nextWeek(now);
    if (/^month$/i.test(phrase)) return addMonths(`${now.slice(0, 8)}01`, 1);
    return addDays(nextWeek(now), dayNumber(phrase));
};

const offset = (now, amount, unit) => unit.toLowerCase() === 'month' ? addMonths(now, amount) : addDays(now, amount * (unit.toLowerCase() === 'week' ? 7 : 1));

const rules = [
    { kind: 'tag', pattern: /(?<=^|\s)#([\p{L}\p{N}_-]+)/gu, read: match => match[1].toLowerCase() },
    { kind: 'priority', pattern: /(?<=^|\s)(?:!(urgent|high|medium|med|low)|(p[1-4]))(?=\s|$)/gi, read: match => PRIORITIES[(match[1] ?? match[2]).toLowerCase()] },
    { kind: 'repeat', pattern: new RegExp(`\\bevery\\s+(${DAYS}|${SHORT_DAYS})\\b`, 'gi'), read: (match, now) => ({ repeat: 'weekly', due: upcoming(now, dayNumber(match[1]), true) }) },
    { kind: 'repeat', pattern: /\b(every\s+(?:day|weekday|week|month)|daily|weekdays|weekly|monthly)\b/gi, read: match => ({ repeat: REPEATS[match[1].toLowerCase().replace(/\s+/g, ' ')] }) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}(today|tonight|tomorrow|tmrw|tmr)\\b`, 'gi'), read: (match, now) => addDays(now, /^to(day|night)$/i.test(match[1]) ? 0 : 1) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}next\\s+(week|month|${DAYS}|${SHORT_DAYS})\\b`, 'gi'), read: (match, now) => relative(now, match[1]) },
    { kind: 'due', pattern: /\bin\s+(\d{1,3})\s+(day|week|month)s?\b/gi, read: (match, now) => offset(now, Number(match[1]), match[2]) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'), read: (match, now) => calendarDate(now, monthNumber(match[1]), Number(match[2])) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\b`, 'gi'), read: (match, now) => calendarDate(now, monthNumber(match[2]), Number(match[1])) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}(\\d{4}-\\d{2}-\\d{2})\\b`, 'g'), read: match => Number.isNaN(parseDate(match[1]).getTime()) ? null : iso(parseDate(match[1])) },
    { kind: 'due', pattern: new RegExp(`\\b${LEAD}(${DAYS})\\b`, 'gi'), read: (match, now) => upcoming(now, dayNumber(match[1]), false) },
    { kind: 'due', pattern: new RegExp(`\\b(?:on|by|due)\\s+(${SHORT_DAYS})\\b`, 'gi'), read: (match, now) => upcoming(now, dayNumber(match[1]), false) }
];

const settled = {
    tag: () => false,
    priority: draft => draft.priority !== 'none',
    repeat: draft => draft.repeat !== 'none',
    due: draft => draft.due !== null
};

const assign = {
    tag: (draft, tag) => draft.tags.includes(tag) || draft.tags.push(tag),
    priority: (draft, priority) => draft.priority = priority,
    repeat: (draft, found) => Object.assign(draft, found),
    due: (draft, due) => draft.due = due
};

export const parse = (text, now = today()) => {
    const draft = { title: '', due: null, priority: 'none', repeat: 'none', tags: [] };
    const tokens = [];
    for (const rule of rules) for (const match of text.matchAll(rule.pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        if (settled[rule.kind](draft) || tokens.some(token => start < token.end && end > token.start)) continue;
        const found = rule.read(match, now);
        if (found == null) continue;
        assign[rule.kind](draft, found);
        tokens.push({ start, end, kind: rule.kind });
    }
    tokens.sort((first, second) => first.start - second.start);
    draft.title = tokens.reduceRight((rest, token) => rest.slice(0, token.start) + rest.slice(token.end), text).replace(/\s+/g, ' ').trim();
    return { ...draft, tokens };
};
