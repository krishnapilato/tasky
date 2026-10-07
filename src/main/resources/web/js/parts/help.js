import { on } from '../actions.js';
import { html } from '../html.js';
import { showDialog } from './dialog.js';

const SHORTCUTS = [
    [['N'], 'Add a task'],
    [['Ctrl', 'K'], 'Search tasks and commands'],
    [['G', 'T'], 'Go to Today. U, A, B, C, I and S open the other views'],
    [['J'], 'Select the next task'],
    [['K'], 'Select the previous task'],
    [['Enter'], 'Open the selected task'],
    [['X'], 'Finish or reopen the selected task'],
    [['F'], 'Start a focus session on the selected task'],
    [['Delete'], 'Delete the selected task'],
    [['?'], 'Show this list']
];

on('shortcuts', () => showDialog(html`
    <div class="dialog-pad">
        <h2>Keyboard shortcuts</h2>
        <dl class="shortcuts">
            ${SHORTCUTS.map(([keys, effect]) => html`<dt>${keys.map(key => html`<kbd>${key}</kbd>`)}</dt><dd>${effect}</dd>`)}
        </dl>
    </div>`));
