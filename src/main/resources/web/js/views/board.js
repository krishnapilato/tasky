import { on } from '../actions.js';
import { addDays, dayOf, today } from '../dates.js';
import { html } from '../html.js';
import { check, meta } from '../parts/row.js';
import { complete, find, isOpen, move, rank, state, STATUSES } from '../store.js';

const DONE_LIMIT = 12;

const card = task => html`
    <article class="card-task ${isOpen(task) ? '' : 'is-done'}" draggable="true" data-task="${task.id}">
        ${check(task)}
        <button type="button" class="task-open" data-action="open">
            <span class="task-title">${task.title}</span>
            <span class="task-meta">${meta(task)}</span>
        </button>
    </article>`;

export const board = () => {
    const since = addDays(today(), -7);
    const finished = state.tasks.filter(task => !isOpen(task) && dayOf(task.completedAt) >= since).sort((first, second) => second.completedAt.localeCompare(first.completedAt));
    const lanes = {
        todo: state.tasks.filter(task => task.status === 'todo').sort(rank),
        doing: state.tasks.filter(task => task.status === 'doing').sort(rank),
        done: finished.slice(0, DONE_LIMIT)
    };
    return html`
        <div class="column-wide">
            <header class="page-head">
                <h1 class="page-title">Board</h1>
                <p class="page-note">Drag a card to change its status.</p>
            </header>
            <div class="board">
                ${Object.entries(lanes).map(([status, tasks]) => html`
                    <section class="lane" data-drop="status" data-value="${status}" aria-label="${STATUSES[status]}">
                        <h2 class="lane-head">${STATUSES[status]}<span>${status === 'done' ? finished.length : tasks.length}</span></h2>
                        ${tasks.map(card)}
                        ${tasks.length === 0 && html`<p class="lane-empty">Drop a task here</p>`}
                        ${status === 'done' && finished.length > DONE_LIMIT && html`<a class="lane-empty" href="#/all">${finished.length - DONE_LIMIT} more this week in All tasks</a>`}
                    </section>`)}
            </div>
        </div>`;
};

on('drop-status', ({ id, value }) => {
    if (find(id).status === value) return null;
    return value === 'done' ? complete(id) : move(id, value);
});
