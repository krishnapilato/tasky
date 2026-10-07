import { run } from './actions.js';
import { paletteKey } from './parts/palette.js';
import { notify, state } from './store.js';

const VIEWS = { t: 'today', u: 'upcoming', a: 'all', b: 'board', c: 'calendar', i: 'insights', s: 'settings' };

let leaderPressed = 0;

const select = step => {
    const ids = [...new Set([...document.querySelectorAll('#view .task')].map(element => Number(element.dataset.task)))];
    if (ids.length === 0) return;
    const index = ids.indexOf(state.selected);
    state.selected = ids[index < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, index + step))];
    notify();
    document.querySelector(`#view .task[data-task="${state.selected}"]`)?.scrollIntoView({ block: 'nearest' });
};

const onSelected = action => () => state.selected !== null && run(action, { id: state.selected });

const shortcuts = {
    g: () => leaderPressed = Date.now(),
    n: () => document.getElementById('quick-input')?.focus(),
    '/': () => run('palette'),
    '?': () => run('shortcuts'),
    j: () => select(1),
    k: () => select(-1),
    arrowdown: () => select(1),
    arrowup: () => select(-1),
    enter: onSelected('open'),
    x: onSelected('toggle'),
    f: onSelected('focus'),
    delete: onSelected('delete')
};

document.addEventListener('keydown', event => {
    const field = event.target.closest('input, textarea, select');
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        return run('palette');
    }
    if (field?.id === 'palette-input') return paletteKey(event);
    if (field && key === 'escape') return field.blur();
    if (field?.id === 'panel-title' && key === 'enter') {
        event.preventDefault();
        return field.blur();
    }
    if (field || event.ctrlKey || event.metaKey || event.altKey || !state.user || document.querySelector('.modal.show')) return;
    const destination = Date.now() - leaderPressed < 1200 && VIEWS[key];
    leaderPressed = 0;
    if (destination) return location.hash = `#/${destination}`;
    if (!shortcuts[key] || (key === 'enter' && event.target.closest('button, a'))) return;
    event.preventDefault();
    return shortcuts[key]();
});
