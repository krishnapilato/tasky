const pad = number => String(number).padStart(2, '0');

export const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parse = text => {
    const [year, month, day] = text.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const today = () => iso(new Date());

export const dayOf = instant => iso(new Date(instant));

export const addDays = (text, days) => {
    const date = parse(text);
    date.setDate(date.getDate() + days);
    return iso(date);
};

export const addMonths = (text, months) => {
    const date = parse(text);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    return iso(date);
};

export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86_400_000);

export const weekdayIndex = text => (parse(text).getDay() + 6) % 7;

export const format = (text, options) => parse(text).toLocaleDateString('en-US', options);

export const short = text => format(text, { month: 'short', day: 'numeric', ...(text.startsWith(today().slice(0, 4)) ? {} : { year: 'numeric' }) });

export const label = text => {
    const distance = daysBetween(today(), text);
    if (distance === 0) return 'Today';
    if (distance === 1) return 'Tomorrow';
    if (distance === -1) return 'Yesterday';
    if (distance > 1 && distance < 7) return format(text, { weekday: 'long' });
    return short(text);
};

export const phrase = text => {
    const distance = daysBetween(today(), text);
    if (distance === 0) return 'today';
    if (distance === 1) return 'tomorrow';
    return `on ${label(text)}`;
};

export const duration = minutes => {
    const hours = Math.floor(minutes / 60);
    if (!hours) return `${minutes}m`;
    return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
};

export const nextOccurrence = (repeat, due, now = today()) => {
    if (repeat === 'none') return null;
    const step = {
        daily: date => addDays(date, 1),
        weekly: date => addDays(date, 7),
        monthly: date => addMonths(date, 1),
        weekdays: date => addDays(date, [1, 1, 1, 1, 3, 2, 1][weekdayIndex(date)])
    }[repeat];
    let date = due ?? now;
    do date = step(date); while (date <= now);
    return date;
};
