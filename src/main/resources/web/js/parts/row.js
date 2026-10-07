import { duration, label, today } from '../dates.js';
import { html } from '../html.js';
import { isLate, isOpen, REPEATS, state } from '../store.js';

const TINTS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const tint = name => TINTS[[...name].reduce((sum, character) => sum + character.codePointAt(0), 0) % TINTS.length];

export const tag = name => html`<span class="tag tint-${tint(name)}">${name}</span>`;

export const check = task => html`
    <button type="button" class="check priority-${task.priority}" data-action="toggle" aria-label="${isOpen(task) ? 'Mark as done' : 'Mark as not done'}">
        <i class="bi bi-check-lg"></i>
    </button>`;

export const meta = (task, dated = true) => html`
    ${task.subtasks.length > 0 && html`<span class="meta"><i class="bi bi-check2-square"></i>${task.subtasks.filter(subtask => subtask.done).length}/${task.subtasks.length}</span>`}
    ${task.repeat !== 'none' && html`<span class="meta" title="${REPEATS[task.repeat]}"><i class="bi bi-arrow-repeat"></i></span>`}
    ${task.focusMinutes > 0 && html`<span class="meta" title="Focus time logged"><i class="bi bi-stopwatch"></i>${duration(task.focusMinutes)}</span>`}
    ${task.notes !== '' && html`<span class="meta" title="Has notes"><i class="bi bi-text-left"></i></span>`}
    ${task.tags.map(tag)}
    ${dated && task.due !== null && html`<span class="due ${isLate(task) ? 'is-late' : isOpen(task) && task.due === today() ? 'is-today' : ''}">${label(task.due)}</span>`}`;

export const row = (task, dated = true) => html`
    <li class="task ${isOpen(task) ? '' : 'is-done'} ${state.selected === task.id ? 'is-selected' : ''}" data-task="${task.id}">
        ${check(task)}
        <button type="button" class="task-open" data-action="open">
            <span class="task-title">${task.title}</span>
            <span class="task-meta">${meta(task, dated)}</span>
        </button>
    </li>`;

export const section = (title, tasks, { late = false, dated = true, note = tasks.length } = {}) => tasks.length > 0 && html`
    <section class="section">
        <h2 class="section-title ${late ? 'is-late' : ''}">${title}<span>${note}</span></h2>
        <ul class="tasks">${tasks.map(task => row(task, dated))}</ul>
    </section>`;
