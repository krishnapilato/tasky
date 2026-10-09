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

let user = null;
let tasks = [];
let filter = 'open';
let registering = false;
let editing = null;

const $ = selector => document.querySelector(selector);

const today = () => new Date().toLocaleDateString('sv-SE');

const isLate = task => FILTERS.today(task) && task.due < today();

const dueLabel = due => {
    const days = Math.round((new Date(due) - new Date(today())) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    return new Date(`${due}T00:00`).toLocaleDateString('en', {month: 'short', day: 'numeric'});
};

const byDueThenPriority = (a, b) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') || RANK[a.priority] - RANK[b.priority] || a.id - b.id;

const row = task => {
    const item = $('#row').content.firstElementChild.cloneNode(true);
    const due = item.querySelector('.task-due');
    item.dataset.id = task.id;
    item.classList.toggle('done', task.done);
    item.querySelector('input').checked = task.done;
    item.querySelector('.task-title').textContent = task.title;
    item.querySelector('.task-notes').hidden = !task.notes;
    item.querySelector('.task-flag').classList.add(task.priority);
    due.textContent = task.due ? dueLabel(task.due) : '';
    due.classList.toggle('late', isLate(task));
    return item;
};

const render = () => {
    const shown = tasks.filter(FILTERS[filter]).sort(byDueThenPriority);
    const open = tasks.filter(FILTERS.open).length;
    const late = tasks.filter(isLate).length;
    const date = new Date().toLocaleDateString('en', {weekday: 'long', month: 'long', day: 'numeric'});
    $('#summary').textContent = `${date} · ${open} open${late ? `, ${late} overdue` : ''}`;
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

const editor = () => bootstrap.Modal.getOrCreateInstance($('#editor'));

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

on('#try', 'click', async () => {
    const {account} = await fetch('data/seed.json').then(response => response.json());
    await show(await api.login(account));
});

on('#logout', 'click', async () => {
    await api.logout();
    await show(null);
});

on('#theme', 'click', () => {
    const next = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.bsTheme = next;
    localStorage.setItem('tasky.theme', next);
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
    editor().show();
});

on('#edit', 'submit', async event => {
    await save({...editing, ...taskFrom(event.target)});
    editor().hide();
});

on('#delete', 'click', async () => {
    await api.remove(editing.id);
    tasks = tasks.filter(task => task.id !== editing.id);
    render();
    editor().hide();
});

on('#reset', 'click', reset);

$('#demo-note').hidden = !demo;
await show((await api.account()).user);
