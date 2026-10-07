import { api } from './api.js';
import { dayOf, phrase, today } from './dates.js';
import { toast } from './toast.js';

export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];
export const STATUSES = { todo: 'To do', doing: 'In progress', done: 'Done' };
export const REPEATS = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', monthly: 'Every month' };

export const state = {
    user: null,
    tasks: [],
    insights: null,
    fresh: false,
    view: 'today',
    open: null,
    selected: null,
    filter: { show: 'open', tag: null, query: '' },
    month: today().slice(0, 7)
};

const listeners = new Set();
const revisions = new Map();

export const subscribe = listener => listeners.add(listener);

export const notify = () => listeners.forEach(listener => listener());

export const find = id => state.tasks.find(task => task.id === id);

export const isOpen = task => task.status !== 'done';

export const isLate = task => isOpen(task) && task.due !== null && task.due < today();

export const doneOn = (task, day) => task.completedAt !== null && dayOf(task.completedAt) === day;

export const rank = (first, second) =>
    (first.due ?? '9999').localeCompare(second.due ?? '9999')
    || PRIORITIES.indexOf(second.priority) - PRIORITIES.indexOf(first.priority)
    || first.createdAt.localeCompare(second.createdAt);

export const urgency = (first, second) =>
    PRIORITIES.indexOf(second.priority) - PRIORITIES.indexOf(first.priority) || rank(first, second);

export const tags = () => {
    const counts = new Map();
    for (const task of state.tasks.filter(isOpen)) for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort(([first, firstCount], [second, secondCount]) => secondCount - firstCount || first.localeCompare(second));
};

const draftOf = ({ title, notes, priority, due, repeat, tags, subtasks }) => ({ title, notes, priority, due, repeat, tags, subtasks });

const put = task => {
    const index = state.tasks.findIndex(existing => existing.id === task.id);
    if (index < 0) state.tasks.push(task);
    else state.tasks[index] = task;
};

const settle = () => {
    state.fresh = false;
    notify();
};

export const load = async () => {
    state.tasks = await api.tasks();
    settle();
};

export const add = async draft => {
    try {
        const task = await api.create(draft);
        put(task);
        settle();
        return task;
    } catch (problem) {
        toast(problem.message);
        return null;
    }
};

export const save = async (id, changes) => {
    const before = find(id);
    if (!before) return;
    const after = { ...before, ...changes };
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    put(after);
    notify();
    try {
        const saved = await api.edit(id, draftOf(after));
        if (revisions.get(id) === revision && find(id)) put({ ...find(id), ...draftOf(saved) });
    } catch (problem) {
        if (revisions.get(id) === revision) put(before);
        toast(problem.message);
    }
    settle();
};

export const move = async (id, status) => {
    const before = find(id);
    if (!before) return null;
    put({ ...before, status, completedAt: status === 'done' ? before.completedAt ?? new Date().toISOString() : null });
    notify();
    try {
        const moved = await api.move(id, status);
        if (find(id)) put({ ...find(id), status: moved.task.status, completedAt: moved.task.completedAt });
        if (moved.next) put(moved.next);
        settle();
        return moved;
    } catch (problem) {
        put(before);
        toast(problem.message);
        settle();
        return null;
    }
};

export const erase = async id => {
    state.tasks = state.tasks.filter(task => task.id !== id);
    notify();
    await api.remove(id).catch(problem => toast(problem.message));
    settle();
};

export const complete = async id => {
    const before = find(id).status;
    const moved = await move(id, 'done');
    if (!moved) return;
    toast(moved.next ? `Done. It comes back ${phrase(moved.next.due)}.` : 'Marked as done', {
        label: 'Undo',
        run: async () => {
            if (moved.next) await erase(moved.next.id);
            await move(id, before);
        }
    });
};

export const remove = id => {
    const task = find(id);
    state.tasks = state.tasks.filter(existing => existing.id !== id);
    if (state.open === id) state.open = null;
    notify();
    const restore = () => {
        put(task);
        settle();
    };
    toast('Task deleted', { label: 'Undo', run: restore }, () => api.remove(id).catch(problem => toast(problem.message)).finally(settle));
};

export const logFocus = async (taskId, minutes) => {
    try {
        const task = await api.focus({ taskId, minutes });
        if (task && find(task.id)) put({ ...find(task.id), focusMinutes: task.focusMinutes });
        settle();
    } catch (problem) {
        toast(problem.message);
    }
};
