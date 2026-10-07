import { api } from '../api.js';
import { duration, format, short, weekdayIndex } from '../dates.js';
import { html } from '../html.js';
import { isOpen, notify, PRIORITIES, state, subscribe } from '../store.js';
import { toast } from '../toast.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let loading = false;

const heat = done => done === 0 ? 0 : done < 3 ? done : done < 5 ? 3 : 4;

const comparison = ({ momentum, doneThisWeek, doneLastWeek }) => ({
    rising: `${doneThisWeek - doneLastWeek} more than the week before`,
    slowing: `${doneLastWeek - doneThisWeek} fewer than the week before`,
    steady: 'Same as the week before'
})[momentum];

const bars = (values, labels) => {
    const top = Math.max(...values, 1);
    return html`
        <div class="bars">
            ${values.map((value, index) => html`
                <div class="bar ${value === top ? 'is-top' : ''}" title="${value}">
                    <i style="height: ${100 * value / top}%"></i>${labels[index]}
                </div>`)}
        </div>`;
};

export const insights = () => {
    const data = state.insights;
    if (!data) return html`<div class="column-wide"><header class="page-head"><h1 class="page-title">Insights</h1><p class="page-note">Adding things up.</p></header></div>`;
    const byWeekday = WEEKDAYS.map((_, index) => data.activity.filter(day => weekdayIndex(day.date) === index).reduce((sum, day) => sum + day.done, 0));
    const fortnight = data.activity.slice(-14);
    const open = PRIORITIES.toReversed().map(priority => [priority, state.tasks.filter(task => isOpen(task) && task.priority === priority).length]).filter(([, count]) => count > 0);
    return html`
        <div class="column-wide">
            <header class="page-head">
                <h1 class="page-title">Insights</h1>
                <p class="page-note">The last sixteen weeks, counted in your time zone.</p>
            </header>
            <div class="figures">
                <div class="figure">
                    <div class="figure-value">${data.streak}<small>${data.streak === 1 ? 'day' : 'days'}</small></div>
                    <div class="figure-label">Current streak, best is ${data.bestStreak}</div>
                </div>
                <div class="figure">
                    <div class="figure-value">${data.doneThisWeek}<small>done</small></div>
                    <div class="figure-label">Last 7 days. ${comparison(data)}</div>
                </div>
                <div class="figure">
                    <div class="figure-value">${duration(data.focusMinutesThisWeek)}</div>
                    <div class="figure-label">Focused in the last 7 days</div>
                </div>
                <div class="figure">
                    <div class="figure-value">${data.onTimePercent === null ? 'n/a' : `${Math.round(data.onTimePercent)}%`}</div>
                    <div class="figure-label">${data.onTimePercent === null ? 'Finish a task with a due date to see this' : 'Finished on or before the due date'}</div>
                </div>
            </div>
            <div class="insight-grid">
                <section>
                    <h2 class="block-title">Tasks finished per day</h2>
                    <p class="block-note">Each square is a day, stronger means more done.</p>
                    <div class="heatmap" style="--offset: ${weekdayIndex(data.activity[0].date) + 1}">
                        ${data.activity.map(day => html`<span class="heat heat-${heat(day.done)}" title="${day.done} done on ${short(day.date)}"></span>`)}
                    </div>
                    <div class="heat-scale">Less ${[0, 1, 2, 3, 4].map(level => html`<span class="heat heat-${level}"></span>`)} More</div>
                </section>
                <section>
                    <h2 class="block-title">Best days of the week</h2>
                    <p class="block-note">Tasks finished on each weekday.</p>
                    ${bars(byWeekday, WEEKDAYS)}
                </section>
                <section>
                    <h2 class="block-title">Focus time</h2>
                    <p class="block-note">Minutes per day over the last two weeks.</p>
                    ${bars(fortnight.map(day => day.focusMinutes), fortnight.map(day => format(day.date, { day: 'numeric' })))}
                </section>
                <section>
                    <h2 class="block-title">Open tasks by priority</h2>
                    <p class="block-note">${open.reduce((sum, [, count]) => sum + count, 0)} tasks are waiting.</p>
                    <div class="split">${open.map(([priority, count]) => html`<i class="priority-${priority}" style="flex: ${count}"></i>`)}</div>
                    <ul class="legend">${open.map(([priority, count]) => html`<li class="priority-${priority}"><i></i>${priority[0].toUpperCase()}${priority.slice(1)} ${count}</li>`)}</ul>
                </section>
            </div>
        </div>`;
};

subscribe(async () => {
    if (state.view !== 'insights' || state.fresh || loading || !state.user) return;
    loading = true;
    state.insights = await api.insights().catch(problem => (toast(problem.message), state.insights));
    state.fresh = true;
    loading = false;
    notify();
});
