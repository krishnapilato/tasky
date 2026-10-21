import {Dialog} from 'https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/js/bootstrap.bundle.min.js';
import seed from '../data/seed.json' with {type: 'json'};
import {api, demo} from './api.js';
import {reset} from './demo.js';

const RANK = {high: 0, medium: 1, low: 2, none: 3};

const FILTERS = {
    open: task => !task.done,
    today: task => !task.done && task.due !== null && task.due <= today(),
    done: task => task.done
};

const EMPTY = {
    open: 'Nothing left to do. Add a task above.',
    today: 'Nothing is due today.',
    done: 'Finished tasks will show up here.'
};

const relativeDay = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});
const shortDate = new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric'});
const longDate = new Intl.DateTimeFormat('en', {weekday: 'long', month: 'long', day: 'numeric'});

let user = null;
let tasks = [];
let filter = 'open';
let registering = false;
let editing = null;

const $ = selector => document.querySelector(selector);

const editor = Dialog.getOrCreateInstance($('#editor'));

const today = () => new Date().toLocaleDateString('sv-SE');

const isLate = task => FILTERS.today(task) && task.due < today();

const dueLabel = due => {
    const days = Math.round((Date.parse(due) - Date.parse(today())) / 86_400_000);
    return Math.abs(days) > 1 ? shortDate.format(new Date(`${due}T00:00`)) : relativeDay.format(days, 'day');
};

const byDueThenPriority = (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || RANK[a.priority] - RANK[b.priority] || a.id - b.id;

const row = task => {
    const item = $('#row').content.firstElementChild.cloneNode(true);
    const due = item.querySelector('.task-due');
    item.dataset.id = task.id;
    item.classList.toggle('done', task.done);
    item.querySelector('.check').checked = task.done;
    item.querySelector('.task-title').textContent = task.title;
    item.querySelector('.task-notes').hidden = !task.notes;
    item.querySelector('.task-flag').classList.add(task.priority);
    due.textContent = task.due ? dueLabel(task.due) : '';
    due.classList.toggle('late', isLate(task));
    return item;
};

const render = () => {
    const shown = tasks.filter(FILTERS[filter]).toSorted(byDueThenPriority);
    const open = tasks.filter(FILTERS.open).length;
    const late = tasks.filter(isLate).length;
    $('#summary').textContent = `${longDate.format(new Date())} · ${open} open${late ? `, ${late} overdue` : ''}`;
    $('#tasks').replaceChildren(...shown.map(row));
    $('#empty').textContent = EMPTY[filter];
    $('#empty').hidden = shown.length > 0;
    for (const tab of document.querySelectorAll('[data-filter]')) {
        tab.classList.toggle('active', tab.dataset.filter === filter);
        tab.querySelector('span').textContent = tasks.filter(FILTERS[tab.dataset.filter]).length;
    }
};

const show = async account => {
    user = account;
    if (user) {
        tasks = await api.tasks();
        $('#hello').textContent = `Hello, ${user.name.split(' ')[0]}`;
        $('#who').textContent = user.email;
        render();
    }
    $('#auth').hidden = user !== null;
    $('#app').hidden = user === null;
};

const report = error => {
    if (error.status === 401 && user) return show(null);
    const box = $(user ? '#error' : '#auth-error');
    box.textContent = error.message;
    box.hidden = false;
    render();
};

const on = (selector, type, handler) => $(selector).addEventListener(type, async event => {
    if (type === 'submit') event.preventDefault();
    $('#error').hidden = $('#auth-error').hidden = true;
    try {
        await handler(event);
    } catch (error) {
        report(error);
    }
});

const taskFrom = form => {
    const {title, notes, due, priority} = Object.fromEntries(new FormData(form));
    return {title, notes, due: due || null, priority};
};

const taskOf = element => tasks.find(task => task.id === Number(element.closest('.task').dataset.id));

const save = async task => {
    const saved = await api.update(task);
    tasks = tasks.map(old => old.id === saved.id ? saved : old);
    render();
};

on('#account', 'submit', async event => {
    const form = Object.fromEntries(new FormData(event.target));
    await show(await (registering ? api.register(form) : api.login(form)));
    event.target.reset();
});

on('#switch', 'click', () => {
    registering = !registering;
    $('#name-field').hidden = !registering;
    $('#auth h1').textContent = registering ? 'Create your account' : 'Sign in to Tasky';
    $('#submit').textContent = registering ? 'Create account' : 'Sign in';
    $('#switch').textContent = registering ? 'I already have an account' : 'Create an account';
});

on('#try', 'click', async () => show(await api.login(seed.account)));

on('#logout', 'click', async () => {
    await api.logout();
    await show(null);
});

on('#add', 'submit', async event => {
    tasks.push(await api.create(taskFrom(event.target)));
    event.target.reset();
    render();
});

on('#filters', 'click', event => {
    const tab = event.target.closest('[data-filter]');
    if (tab) filter = tab.dataset.filter;
    render();
});

on('#tasks', 'change', event => save({...taskOf(event.target), done: event.target.checked}));

on('#tasks', 'click', event => {
    if (!event.target.closest('.task-title')) return;
    editing = taskOf(event.target);
    for (const field of ['title', 'notes', 'due', 'priority']) $('#edit').elements[field].value = editing[field] ?? '';
    editor.show();
});

on('#edit', 'submit', async event => {
    await save({...editing, ...taskFrom(event.target)});
    await editor.hide();
});

on('#delete', 'click', async () => {
    await api.remove(editing.id);
    tasks = tasks.filter(task => task.id !== editing.id);
    render();
    await editor.hide();
});

on('#reset', 'click', reset);

$('#demo-note').hidden = !demo;
await show((await api.account()).user);