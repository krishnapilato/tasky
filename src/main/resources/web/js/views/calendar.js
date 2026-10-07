import { on, run } from '../actions.js';
import { addDays, addMonths, format, short, today, weekdayIndex } from '../dates.js';
import { html } from '../html.js';
import { add, isOpen, notify, save, state, urgency } from '../store.js';

const VISIBLE = 3;

const order = (first, second) => isOpen(second) - isOpen(first) || urgency(first, second);

const cell = (date, tasks) => html`
    <div class="day ${date.startsWith(state.month) ? '' : 'is-outside'} ${date === today() ? 'is-today' : ''}" data-drop="date" data-value="${date}">
        <div class="day-head">
            <span class="day-number">${Number(date.slice(8))}</span>
            <button type="button" class="icon-button" data-action="add-on" data-value="${date}" aria-label="Add a task on ${short(date)}"><i class="bi bi-plus-lg"></i></button>
        </div>
        ${tasks.slice(0, VISIBLE).map(task => html`<button type="button" class="day-task priority-${task.priority} ${isOpen(task) ? '' : 'is-done'}" draggable="true" data-task="${task.id}" data-action="open">${task.title}</button>`)}
        ${tasks.length > VISIBLE && html`<span class="day-more">${tasks.length - VISIBLE} more</span>`}
    </div>`;

export const calendar = () => {
    const first = `${state.month}-01`;
    const start = addDays(first, -weekdayIndex(first));
    const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
    const shown = days[35].startsWith(state.month) ? days : days.slice(0, 35);
    const byDay = Map.groupBy(state.tasks.filter(task => task.due !== null), task => task.due);
    return html`
        <div class="column-wide">
            <header class="page-head">
                <h1 class="page-title">${format(first, { month: 'long', year: 'numeric' })}</h1>
                <div class="page-tools">
                    <button type="button" class="btn btn-light" data-action="month" data-value="-1" aria-label="Previous month"><i class="bi bi-chevron-left"></i></button>
                    <button type="button" class="btn btn-light" data-action="month" data-value="0">This month</button>
                    <button type="button" class="btn btn-light" data-action="month" data-value="1" aria-label="Next month"><i class="bi bi-chevron-right"></i></button>
                </div>
            </header>
            <div class="calendar-weekdays">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => html`<span>${name}</span>`)}</div>
            <div class="calendar">${shown.map(date => cell(date, (byDay.get(date) ?? []).sort(order)))}</div>
        </div>`;
};

on('month', ({ element }) => {
    const step = Number(element.dataset.value);
    state.month = step === 0 ? today().slice(0, 7) : addMonths(`${state.month}-01`, step).slice(0, 7);
    notify();
});

on('add-on', async ({ element }) => {
    const task = await add({ title: 'New task', due: element.dataset.value });
    if (!task) return;
    run('open', { id: task.id, rename: true });
});

on('drop-date', ({ id, value }) => save(id, { due: value }));
