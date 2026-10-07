import { run } from './actions.js';

let dragged = null;

const zoneOf = event => dragged === null ? null : event.target.closest?.('[data-drop]');

const clearTargets = except => document.querySelectorAll('.is-target').forEach(zone => zone !== except && zone.classList.remove('is-target'));

document.addEventListener('dragstart', event => {
    const source = event.target.closest?.('[draggable][data-task]');
    if (!source) return;
    dragged = Number(source.dataset.task);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', source.dataset.task);
    source.classList.add('is-dragging');
});

document.addEventListener('dragover', event => {
    const zone = zoneOf(event);
    if (!zone) return;
    event.preventDefault();
    clearTargets(zone);
    zone.classList.add('is-target');
});

document.addEventListener('drop', event => {
    const zone = zoneOf(event);
    if (!zone) return;
    event.preventDefault();
    run(`drop-${zone.dataset.drop}`, { id: dragged, value: zone.dataset.value });
});

document.addEventListener('dragend', event => {
    dragged = null;
    event.target.classList?.remove('is-dragging');
    clearTargets(null);
});
