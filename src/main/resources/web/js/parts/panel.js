import { on } from '../actions.js';
import { addDays, dayOf, duration, short, today } from '../dates.js';
import { html } from '../html.js';
import { focusLength } from '../prefs.js';
import { complete, find, isOpen, move, notify, PRIORITIES, remove, REPEATS, save, state, STATUSES } from '../store.js';
import { check, tint } from './row.js';

const element = document.getElementById('panel');

const drawer = () => bootstrap.Offcanvas.getOrCreateInstance(element);

const capital = word => word[0].toUpperCase() + word.slice(1);

const selectTitle = () => {
    const title = document.getElementById('panel-title');
    title.focus();
    title.select();
};

const choices = (action, options, current) => html`
    <div class="segmented">
        ${Object.entries(options).map(([value, name]) => html`<button type="button" class="${value === current ? 'is-on' : ''}" data-action="${action}" data-value="${value}">${name}</button>`)}
    </div>`;

export const panel = () => {
    const task = find(state.open);
    if (!task) return '';
    const finished = task.subtasks.filter(subtask => subtask.done).length;
    return html`
        <div class="panel-head" data-task="${task.id}">
            ${check(task)}
            <button type="button" class="icon-button" data-action="focus" title="Start a ${focusLength()} minute focus session" aria-label="Start a focus session"><i class="bi bi-stopwatch"></i></button>
            <button type="button" class="icon-button" data-action="delete" title="Delete task" aria-label="Delete task"><i class="bi bi-trash3"></i></button>
            <button type="button" class="icon-button" data-bs-dismiss="offcanvas" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="panel-body" data-task="${task.id}" data-scroll="panel">
            <textarea class="panel-title" id="panel-title" rows="1" maxlength="200" aria-label="Title" data-change="title">${task.title}</textarea>
            <dl class="props">
                <dt><i class="bi bi-circle-half"></i>Status</dt>
                <dd>${choices('status', STATUSES, task.status)}</dd>
                <dt><i class="bi bi-calendar3"></i>Due</dt>
                <dd>
                    <input class="form-control" id="panel-due" type="date" value="${task.due ?? ''}" aria-label="Due date" data-change="due">
                    <button type="button" class="quiet" data-action="due-in" data-value="0">Today</button>
                    <button type="button" class="quiet" data-action="due-in" data-value="1">Tomorrow</button>
                    <button type="button" class="quiet" data-action="due-in" data-value="7">In a week</button>
                </dd>
                <dt><i class="bi bi-flag"></i>Priority</dt>
                <dd>${choices('priority', Object.fromEntries(PRIORITIES.map(priority => [priority, capital(priority)])), task.priority)}</dd>
                <dt><i class="bi bi-arrow-repeat"></i>Repeat</dt>
                <dd>
                    <select class="form-select" id="panel-repeat" aria-label="Repeat" data-change="repeat">
                        ${Object.entries(REPEATS).map(([value, name]) => html`<option value="${value}" ${value === task.repeat ? 'selected' : ''}>${name}</option>`)}
                    </select>
                </dd>
                <dt><i class="bi bi-hash"></i>Tags</dt>
                <dd>
                    ${task.tags.map(name => html`
                        <span class="tag tint-${tint(name)}">
                            ${name}<button type="button" data-action="tag-remove" data-value="${name}" aria-label="Remove tag ${name}"><i class="bi bi-x"></i></button>
                        </span>`)}
                    <input class="tag-input" id="panel-tag" type="text" maxlength="30" placeholder="Add a tag" aria-label="Add a tag" data-change="tag-add">
                </dd>
                <dt><i class="bi bi-stopwatch"></i>Focus</dt>
                <dd>${task.focusMinutes > 0 ? `${duration(task.focusMinutes)} logged` : 'No focus time yet'}</dd>
            </dl>
            <section class="panel-section">
                <h2 class="panel-heading">Subtasks${task.subtasks.length > 0 && html`<span>${finished} of ${task.subtasks.length}</span>`}</h2>
                <ul class="subtasks">
                    ${task.subtasks.map((subtask, index) => html`
                        <li class="${subtask.done ? 'is-done' : ''}">
                            <button type="button" class="check ${subtask.done ? 'is-on' : ''}" data-action="subtask-toggle" data-value="${index}" aria-label="Toggle subtask ${subtask.title}">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <span>${subtask.title}</span>
                            <button type="button" class="icon-button" data-action="subtask-remove" data-value="${index}" aria-label="Remove subtask"><i class="bi bi-x-lg"></i></button>
                        </li>`)}
                </ul>
                <input class="bare" id="panel-subtask" type="text" maxlength="200" placeholder="Add a subtask and press Enter" aria-label="Add a subtask" data-change="subtask-add">
            </section>
            <section class="panel-section">
                <h2 class="panel-heading">Notes</h2>
                <textarea class="bare notes" id="panel-notes" maxlength="4000" placeholder="Anything worth remembering" aria-label="Notes" data-change="notes">${task.notes}</textarea>
            </section>
            <p class="panel-foot">Created ${short(dayOf(task.createdAt))}${task.completedAt !== null && `, finished ${short(dayOf(task.completedAt))}`}</p>
        </div>`;
};

on('open', ({ id, rename = false }) => {
    state.open = id;
    notify();
    if (rename) element.addEventListener('shown.bs.offcanvas', selectTitle, { once: true });
    drawer().show();
});

on('toggle', async ({ id }) => {
    if (!isOpen(find(id))) return move(id, 'todo');
    for (const mark of document.querySelectorAll(`[data-task="${id}"]`)) mark.classList.add('is-completing');
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320));
    return complete(id);
});

on('delete', ({ id }) => remove(id));

on('status', ({ id, element }) => element.dataset.value === 'done' ? complete(id) : move(id, element.dataset.value));

on('title', ({ id, element }) => save(id, { title: element.value.trim() || find(id).title }));

on('notes', ({ id, element }) => save(id, { notes: element.value.trim() }));

on('due', ({ id, element }) => save(id, { due: element.value || null }));

on('due-in', ({ id, element }) => save(id, { due: addDays(today(), Number(element.dataset.value)) }));

on('priority', ({ id, element }) => save(id, { priority: element.dataset.value }));

on('repeat', ({ id, element }) => save(id, { repeat: element.value }));

on('tag-remove', ({ id, element }) => save(id, { tags: find(id).tags.filter(name => name !== element.dataset.value) }));

on('tag-add', ({ id, element }) => {
    const name = element.value.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '');
    element.value = '';
    if (name && !find(id).tags.includes(name)) save(id, { tags: [...find(id).tags, name] });
});

on('subtask-add', ({ id, element }) => {
    const title = element.value.trim();
    element.value = '';
    if (title) save(id, { subtasks: [...find(id).subtasks, { title, done: false }] });
});

on('subtask-toggle', ({ id, element }) => save(id, { subtasks: find(id).subtasks.map((subtask, index) => index === Number(element.dataset.value) ? { ...subtask, done: !subtask.done } : subtask) }));

on('subtask-remove', ({ id, element }) => save(id, { subtasks: find(id).subtasks.filter((_, index) => index !== Number(element.dataset.value)) }));

element.addEventListener('hidden.bs.offcanvas', () => {
    state.open = null;
    notify();
});
