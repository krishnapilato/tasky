import { html } from './html.js';

const region = document.getElementById('toasts');
const pending = new Set();

export const toast = (message, action, expired) => {
    const note = document.createElement('div');
    note.className = 'toast-note';
    note.innerHTML = html`<span>${message}</span>${action && html`<button type="button">${action.label}</button>`}`;
    const expire = () => {
        if (!pending.delete(expire)) return;
        note.remove();
        expired?.();
    };
    note.querySelector('button')?.addEventListener('click', () => {
        pending.delete(expire);
        note.remove();
        action.run();
    });
    pending.add(expire);
    region.append(note);
    setTimeout(expire, action ? 6000 : 3200);
};

export const flushToasts = () => pending.forEach(expire => expire());

addEventListener('pagehide', flushToasts);
