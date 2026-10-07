import { on, run } from '../actions.js';
import { label, today } from '../dates.js';
import { html } from '../html.js';
import { parse } from '../quickadd.js';
import { add, REPEATS, state } from '../store.js';
import { toast } from '../toast.js';
import { tag } from './row.js';

const PRIORITY_NAMES = { low: 'Low priority', medium: 'Medium priority', high: 'High priority', urgent: 'Urgent' };

const read = text => {
    const parsed = parse(text);
    const implied = state.view === 'today' && parsed.due === null ? today() : parsed.due;
    return { ...parsed, due: implied, tags: state.view === 'all' && state.filter.tag && !parsed.tags.includes(state.filter.tag) ? [...parsed.tags, state.filter.tag] : parsed.tags };
};

const visible = task => ({
    today: task.due !== null && task.due <= today(),
    upcoming: task.due === null || task.due > today(),
    calendar: task.due?.startsWith(state.month) ?? false,
    all: true,
    board: true
})[state.view] ?? false;

const highlight = (text, tokens) => {
    const pieces = [];
    let cursor = 0;
    for (const token of tokens) {
        pieces.push(text.slice(cursor, token.start), html`<mark class="token token-${token.kind}">${text.slice(token.start, token.end)}</mark>`);
        cursor = token.end;
    }
    return html`${pieces}${text.slice(cursor)}`;
};

const preview = () => {
    const input = document.getElementById('quick-input');
    const draft = read(input.value);
    document.getElementById('quick-backdrop').innerHTML = highlight(input.value, draft.tokens);
    document.getElementById('quick-backdrop').scrollLeft = input.scrollLeft;
    document.getElementById('quick-preview').innerHTML = input.value.trim() === '' ? '' : html`
        ${draft.due !== null && html`<span class="chip tint-blue"><i class="bi bi-calendar3"></i>${label(draft.due)}</span>`}
        ${draft.priority !== 'none' && html`<span class="chip tint-orange"><i class="bi bi-flag"></i>${PRIORITY_NAMES[draft.priority]}</span>`}
        ${draft.repeat !== 'none' && html`<span class="chip tint-purple"><i class="bi bi-arrow-repeat"></i>${REPEATS[draft.repeat]}</span>`}
        ${draft.tags.map(tag)}
        <span>Press Enter to add</span>`;
};

on('quick-preview', preview);

on('quick-add', async ({ element }) => {
    const input = element.querySelector('input');
    const { tokens, ...draft } = read(input.value);
    if (draft.title === '') return toast('Give the task a title');
    const task = await add(draft);
    if (!task) return;
    input.value = '';
    preview();
    if (!visible(task)) toast(`Added “${task.title}”`, { label: 'Open', run: () => run('open', { id: task.id }) });
});

document.addEventListener('scroll', event => event.target.id === 'quick-input' && preview(), true);
