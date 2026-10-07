import { paint } from '../html.js';

const element = document.getElementById('dialog');
const frame = element.querySelector('.modal-dialog');
const content = document.getElementById('dialog-content');

const modal = () => bootstrap.Modal.getOrCreateInstance(element);

export const showDialog = (markup, { centered = true } = {}) => {
    frame.classList.toggle('modal-dialog-centered', centered);
    paint(content, markup);
    modal().show();
};

export const hideDialog = () => modal().hide();

element.addEventListener('shown.bs.modal', () => content.querySelector('[data-autofocus]')?.focus());
