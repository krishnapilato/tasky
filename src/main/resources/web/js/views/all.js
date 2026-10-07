import { on } from '../actions.js';
import { html } from '../html.js';
import { row, tint } from '../parts/row.js';
import { isOpen, notify, rank, state, tags } from '../store.js';

const SHOW = { open: 'Open', done: 'Done', all: 'Everything' };

const order = (first, second) =>
    isOpen(second) - isOpen(first) || (isOpen(first) ? rank(first, second) : second.completedAt.localeCompare(first.completedAt));

export const all = () => {
    const { show, tag, query } = state.filter;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = state.tasks
        .filter(task => show === 'all' || isOpen(task) === (show === 'open'))
        .filter(task => tag === null || task.tags.includes(tag))
        .filter(task => words.every(word => `${task.title} ${task.notes} ${task.tags.join(' ')}`.toLowerCase().includes(word)))
        .sort(order);
    return html`
        <div class="column">
            <header class="page-head">
                <h1 class="page-title">${tag === null ? 'All tasks' : `#${tag}`}</h1>
                <p class="page-note">${shown.length} ${shown.length === 1 ? 'task' : 'tasks'}</p>
                <div class="page-tools">
                    <div class="segmented" role="group" aria-label="Which tasks to show">
                        ${Object.entries(SHOW).map(([value, name]) => html`<button type="button" class="${value === show ? 'is-on' : ''}" data-action="show" data-value="${value}">${name}</button>`)}
                    </div>
                    <input class="form-control search" id="filter-query" type="search" value="${query}" placeholder="Filter by text" aria-label="Filter tasks by text" data-input="filter">
                </div>
                <div class="page-tools">
                    ${tags().map(([name]) => html`<a class="tag filter-tag tint-${tint(name)} ${name === tag ? 'is-on' : ''}" href="${name === tag ? '#/all' : `#/all?tag=${encodeURIComponent(name)}`}">${name}</a>`)}
                </div>
            </header>
            ${shown.length === 0
                ? html`<div class="empty"><strong>No tasks match.</strong>Change the filters, or add a task above.</div>`
                : html`<ul class="tasks">${shown.map(task => row(task))}</ul>`}
        </div>`;
};

on('show', ({ element }) => {
    state.filter.show = element.dataset.value;
    notify();
});

on('filter', ({ element }) => {
    state.filter.query = element.value;
    notify();
});
