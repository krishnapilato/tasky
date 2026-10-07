import { addDays, format, label, today } from '../dates.js';
import { html } from '../html.js';
import { section } from '../parts/row.js';
import { isOpen, rank, state, urgency } from '../store.js';

export const upcoming = () => {
    const now = today();
    const horizon = addDays(now, 7);
    const open = state.tasks.filter(isOpen);
    const days = Array.from({ length: 7 }, (_, index) => addDays(now, index + 1));
    const later = open.filter(task => task.due > horizon).sort(rank);
    const undated = open.filter(task => task.due === null).sort(urgency);
    const scheduled = open.filter(task => task.due > now).length;
    return html`
        <div class="column">
            <header class="page-head">
                <h1 class="page-title">Upcoming</h1>
                <p class="page-note">${scheduled} scheduled, ${undated.length} without a date</p>
            </header>
            ${days.map(day => section(label(day), open.filter(task => task.due === day).sort(urgency), { dated: false, note: format(day, { month: 'short', day: 'numeric' }) }))}
            ${section('Later', later)}
            ${section('No date', undated)}
            ${scheduled + undated.length === 0 && html`<div class="empty"><strong>Nothing is planned yet.</strong>Add a task with a date, like “Book flights next friday”.</div>`}
        </div>`;
};
