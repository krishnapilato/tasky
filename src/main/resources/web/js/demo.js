import { addDays, dayOf, nextOccurrence, today } from './dates.js';

const STORE = 'tasky.demo';
const DAY = 86_400_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const encoder = new TextEncoder();

let database;
let opening;

const fail = (status, message) => {
    throw Object.assign(new Error(message), { status });
};

const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');

const hashPassword = async (password, salt) => {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 600_000 }, key, 256));
};

const fingerprint = async (recoveryKey, email) => {
    const key = await crypto.subtle.importKey('raw', encoder.encode(recoveryKey.toUpperCase().replace(/[^A-Z0-9]/g, '')), 'HKDF', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(email), info: encoder.encode('tasky recovery key') }, key, 256));
};

const strong = password => {
    if (password.length < 8) fail(422, 'Use at least 8 characters for the password');
    if (password.length > 128) fail(422, 'Keep the password under 128 characters');
};

const named = name => {
    const clean = name.trim();
    if (!clean || clean.length > 80) fail(422, 'Enter a name of up to 80 characters');
    return clean;
};

const clean = draft => {
    const title = (draft.title ?? '').trim();
    if (!title) fail(422, 'Give the task a title');
    if (title.length > 200) fail(422, 'Keep the title under 200 characters');
    return {
        title,
        notes: (draft.notes ?? '').trim(),
        priority: draft.priority ?? 'none',
        due: draft.due ?? null,
        repeat: draft.repeat ?? 'none',
        tags: [...new Set((draft.tags ?? []).map(tag => tag.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '')).filter(Boolean))],
        subtasks: (draft.subtasks ?? []).map(subtask => ({ title: subtask.title.trim(), done: Boolean(subtask.done) })).filter(subtask => subtask.title)
    };
};

const profile = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });

const view = ({ ownerId, ...task }) => task;

const me = () => database.users.find(user => user.id === database.session) ?? fail(401, 'Sign in to continue');

const byEmail = email => database.users.find(user => user.email === email.trim().toLowerCase());

const owned = id => database.tasks.find(task => task.id === id && task.ownerId === me().id) ?? fail(404, 'Task not found');

const enroll = async (name, email, password) => {
    const salt = crypto.randomUUID();
    const user = { id: database.sequence++, name, email, salt, password: await hashPassword(password, salt), recovery: null, createdAt: new Date().toISOString() };
    database.users.push(user);
    return user;
};

const register = async ({ name = '', email = '', password = '' }) => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) fail(422, 'Enter a valid email address');
    strong(password);
    if (byEmail(address)) fail(409, 'An account with this email already exists');
    const user = await enroll(named(name), address, password);
    database.session = user.id;
    return profile(user);
};

const login = async ({ email = '', password = '' }) => {
    const user = byEmail(email);
    if (!user || user.password !== await hashPassword(password, user.salt)) fail(401, 'Email or password is incorrect');
    database.session = user.id;
    return profile(user);
};

const recover = async ({ email = '', recoveryKey = '', password = '' }) => {
    strong(password);
    const user = byEmail(email);
    if (!user?.recovery || user.recovery !== await fingerprint(recoveryKey, user.email)) fail(401, 'Email or recovery key is incorrect');
    Object.assign(user, { password: await hashPassword(password, user.salt), recovery: null });
    database.session = user.id;
    return profile(user);
};

const changePassword = async ({ current = '', next = '' }) => {
    strong(next);
    const user = me();
    if (user.password !== await hashPassword(current, user.salt)) fail(403, 'Current password is incorrect');
    user.password = await hashPassword(next, user.salt);
    return profile(user);
};

const issueRecoveryKey = async () => {
    const user = me();
    const recoveryKey = [...crypto.getRandomValues(new Uint8Array(20))].map(byte => ALPHABET[byte % ALPHABET.length]).join('').match(/.{5}/g).join('-');
    user.recovery = await fingerprint(recoveryKey, user.email);
    return { recoveryKey };
};

const create = draft => {
    const task = { id: database.sequence++, ownerId: me().id, ...clean(draft), status: 'todo', focusMinutes: 0, createdAt: new Date().toISOString(), completedAt: null };
    database.tasks.push(task);
    return view(task);
};

const move = ({ status }, id) => {
    if (!['todo', 'doing', 'done'].includes(status)) fail(422, 'Choose a status: todo, doing or done');
    const task = owned(id);
    const due = status === 'done' && task.status !== 'done' ? nextOccurrence(task.repeat, task.due) : null;
    Object.assign(task, { status, completedAt: status === 'done' ? task.completedAt ?? new Date().toISOString() : null });
    if (!due) return { task: view(task), next: null };
    const next = { ...task, id: database.sequence++, due, status: 'todo', focusMinutes: 0, createdAt: new Date().toISOString(), completedAt: null, subtasks: task.subtasks.map(subtask => ({ ...subtask, done: false })) };
    database.tasks.push(next);
    return { task: view(task), next: view(next) };
};

const focus = ({ taskId = null, minutes }) => {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) fail(422, 'Log between 1 and 480 focused minutes');
    const task = taskId === null ? null : owned(taskId);
    database.focus.push({ ownerId: me().id, taskId, minutes, endedAt: new Date().toISOString() });
    if (!task) return null;
    task.focusMinutes += minutes;
    return view(task);
};

const insights = () => {
    const owner = me().id;
    const now = today();
    const tally = (items, day, amount) => items.reduce((totals, item) => totals.set(day(item), (totals.get(day(item)) ?? 0) + amount(item)), new Map());
    const total = (days, field) => days.reduce((sum, day) => sum + day[field], 0);
    const finished = database.tasks.filter(task => task.ownerId === owner && task.completedAt);
    const dated = finished.filter(task => task.due);
    const doneByDay = tally(finished, task => dayOf(task.completedAt), () => 1);
    const focusByDay = tally(database.focus.filter(entry => entry.ownerId === owner), entry => dayOf(entry.endedAt), entry => entry.minutes);
    const activity = Array.from({ length: 112 }, (_, index) => addDays(now, index - 111)).map(date => ({ date, done: doneByDay.get(date) ?? 0, focusMinutes: focusByDay.get(date) ?? 0 }));
    const streaks = activity.reduce((runs, day) => [...runs, day.done ? (runs.at(-1) ?? 0) + 1 : 0], []);
    const doneThisWeek = total(activity.slice(-7), 'done');
    const doneLastWeek = total(activity.slice(-14, -7), 'done');
    return {
        streak: activity.at(-1).done ? streaks.at(-1) : streaks.at(-2),
        bestStreak: Math.max(...streaks),
        doneThisWeek,
        doneLastWeek,
        momentum: doneThisWeek > doneLastWeek ? 'rising' : doneThisWeek < doneLastWeek ? 'slowing' : 'steady',
        focusMinutesThisWeek: total(activity.slice(-7), 'focusMinutes'),
        onTimePercent: dated.length ? 100 * dated.filter(task => dayOf(task.completedAt) <= task.due).length / dated.length : null,
        activity
    };
};

const routes = [
    ['GET', /^\/auth\/me$/, () => database.session === null ? null : profile(me())],
    ['PUT', /^\/auth\/me$/, ({ name = '' }) => profile(Object.assign(me(), { name: named(name) }))],
    ['POST', /^\/auth\/register$/, register],
    ['POST', /^\/auth\/login$/, login],
    ['POST', /^\/auth\/logout$/, () => void (database.session = null)],
    ['POST', /^\/auth\/recover$/, recover],
    ['POST', /^\/auth\/password$/, changePassword],
    ['POST', /^\/auth\/recovery-key$/, issueRecoveryKey],
    ['GET', /^\/tasks$/, () => database.tasks.filter(task => task.ownerId === me().id).map(view)],
    ['POST', /^\/tasks$/, create],
    ['PUT', /^\/tasks\/(\d+)$/, (draft, id) => view(Object.assign(owned(id), clean(draft)))],
    ['POST', /^\/tasks\/(\d+)\/move$/, move],
    ['DELETE', /^\/tasks\/(\d+)$/, (_, id) => void database.tasks.splice(database.tasks.indexOf(owned(id)), 1)],
    ['POST', /^\/focus$/, focus],
    ['GET', /^\/insights$/, insights]
];

const plant = async () => {
    const seed = await fetch('data/seed.json').then(response => response.json());
    const now = Date.now();
    const user = await enroll(seed.account.name, seed.account.email, seed.account.password);
    user.recovery = await fingerprint(seed.account.recoveryKey, user.email);
    for (const entry of seed.tasks) database.tasks.push({
        id: database.sequence++,
        ownerId: user.id,
        ...clean(entry),
        due: entry.dueIn == null ? null : addDays(today(), entry.dueIn),
        status: entry.doneAgo == null ? entry.status ?? 'todo' : 'done',
        focusMinutes: entry.focusMinutes ?? 0,
        createdAt: new Date(now - ((entry.doneAgo ?? 0) + 2) * DAY).toISOString(),
        completedAt: entry.doneAgo == null ? null : new Date(now - entry.doneAgo * DAY).toISOString()
    });
    for (const session of seed.focus) database.focus.push({ ownerId: user.id, taskId: null, minutes: session.minutes, endedAt: new Date(now - session.daysAgo * DAY).toISOString() });
};

const open = async () => {
    database = JSON.parse(localStorage.getItem(STORE));
    if (database) return;
    database = { sequence: 1, session: null, users: [], tasks: [], focus: [] };
    await plant();
    localStorage.setItem(STORE, JSON.stringify(database));
};

export const resetDemo = () => {
    localStorage.removeItem(STORE);
    return opening = open();
};

export const demo = async (method, path, body = {}) => {
    await (opening ??= open());
    const [, pattern, handle] = routes.find(([verb, candidate]) => verb === method && candidate.test(path)) ?? fail(404, 'No such endpoint');
    const result = await handle(body, Number(path.match(pattern)[1]));
    localStorage.setItem(STORE, JSON.stringify(database));
    return result == null ? null : structuredClone(result);
};
