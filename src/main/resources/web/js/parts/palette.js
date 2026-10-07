import { on, run } from '../actions.js';
import { label } from '../dates.js';
import { html, paint } from '../html.js';
import { isOpen, rank, state } from '../store.js';
import { hideDialog, showDialog } from './dialog.js';
import { destinations } from './shell.js';

let matches = [];
let active = 0;

const commands = () => [
    ...destinations.map(([name, icon, title]) => ({ icon, label: `Go to ${title}`, run: () => location.hash = `#/${name}` })),
    { icon: 'bi-gear', label: 'Go to Settings', run: () => location.hash = '#/settings' },
    { icon: 'bi-plus-lg', label: 'Add a task', run: () => document.getElementById('quick-input').focus() },
    { icon: 'bi-stopwatch', label: 'Start a focus session', run: () => run('focus', { id: null }) },
    { icon: 'bi-circle-half', label: 'Switch theme', run: () => run('theme-toggle') },
    { icon: 'bi-keyboard', label: 'Show keyboard shortcuts', run: () => run('shortcuts') },
    { icon: 'bi-download', label: 'Export tasks as JSON', run: () => run('export') },
    { icon: 'bi-box-arrow-right', label: 'Sign out', run: () => run('sign-out') },
    ...state.tasks.filter(isOpen).sort(rank).map(task => ({ icon: 'bi-circle', label: task.title, hint: task.due === null ? '' : label(task.due), run: () => run('open', { id: task.id }) }))
];

const results = () => matches.length === 0
    ? html`<li class="palette-empty">Nothing matches. Press Enter to add it as a task.</li>`
    : matches.map((match, index) => html`
        <li>
            <button type="button" class="palette-item ${index === active ? 'is-on' : ''}" data-action="palette-run" data-value="${index}">
                <i class="bi ${match.icon}"></i><span>${match.label}</span>${match.hint && html`<small>${match.hint}</small>`}
            </button>
        </li>`);

const draw = () => paint(document.getElementById('palette-list'), html`${results()}`);

const search = query => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    matches = commands().filter(command => words.every(word => command.label.toLowerCase().includes(word))).slice(0, 9);
    active = 0;
    draw();
};

const choose = index => {
    const query = document.getElementById('palette-input').value;
    hideDialog();
    if (matches[index]) return matches[index].run();
    document.getElementById('quick-input').value = query;
    return document.getElementById('quick-input').closest('form').requestSubmit();
};

export const paletteKey = event => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step && event.key !== 'Enter') return;
    event.preventDefault();
    if (!step) return choose(active);
    active = (active + step + matches.length) % Math.max(1, matches.length);
    return draw();
};

on('palette', () => {
    showDialog(html`
        <input class="palette-input" id="palette-input" type="text" placeholder="Search tasks, or jump to a view" autocomplete="off" aria-label="Search tasks and commands" data-input="palette-search" data-autofocus>
        <ul class="palette-list" id="palette-list"></ul>`, { centered: false });
    search('');
});

on('palette-search', ({ element }) => search(element.value));

on('palette-run', ({ element }) => choose(Number(element.dataset.value)));
