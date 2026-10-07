import { daysBetween, format, today as currentDay } from '../dates.js';
import { html } from '../html.js';
import { section } from '../parts/row.js';
import { focusLength } from '../prefs.js';
import { doneOn, isLate, isOpen, rank, state, urgency } from '../store.js';

const reason = (task, now) => {
    const importance = { urgent: 'Urgent', high: 'High priority' }[task.priority];
    const days = daysBetween(task.due, now);
    const timing = days === 0 ? 'due today' : `${days} ${days === 1 ? 'day' : 'days'} overdue`;
    return importance ? `${importance} and ${timing}` : `${timing[0].toUpperCase()}${timing.slice(1)}`;
};

export const today = () => {
    const now = currentDay();
    const late = state.tasks.filter(isLate).sort(rank);
    const due = state.tasks.filter(task => isOpen(task) && task.due === now).sort(urgency);
    const done = state.tasks.filter(task => doneOn(task, now));
    const total = late.length + due.length + done.length;
    const first = [...late, ...due].sort(urgency)[0];
    return html`
        <div class="column">
            <header class="page-head">
                <h1 class="page-title">${format(now, { weekday: 'long' })}</h1>
                <p class="page-note">${format(now, { month: 'long', day: 'numeric' })}${total > 0 && `, ${done.length} of ${total} done`}</p>
                <div class="progress-line" role="progressbar" aria-label="Progress for today" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done.length}">
                    <span style="width: ${total === 0 ? 0 : 100 * done.length / total}%"></span>
                </div>
            </header>
            ${first && html`
                <div class="start" data-task="${first.id}">
                    <i class="bi bi-bullseye"></i>
                    <div class="start-text">
                        <button type="button" class="start-title" data-action="open">${first.title}</button>
                        <span class="start-why">Start here. ${reason(first, now)}.</span>
                    </div>
                    <button type="button" class="btn btn-primary" data-action="focus">Focus for ${focusLength()} min</button>
                </div>`}
            ${section('Overdue', late, { late: true })}
            ${section('Today', due, { dated: false })}
            ${late.length + due.length === 0 && html`
                <div class="empty">
                    <strong>${done.length > 0 ? 'Everything for today is done.' : 'Nothing is due today.'}</strong>
                    Add a task above, or pull one in from Upcoming.
                </div>`}
            ${section('Done today', done)}
        </div>`;
};
