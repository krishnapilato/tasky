import { on } from '../actions.js';
import { about, api, live } from '../api.js';
import { html } from '../html.js';
import { hideDialog, showDialog } from '../parts/dialog.js';
import { focusLength, setFocusLength, setTheme, theme } from '../prefs.js';
import { notify, state } from '../store.js';
import { toast } from '../toast.js';
import { exportTasks, importTasks } from '../transfer.js';

const THEMES = { system: 'Match my device', light: 'Light', dark: 'Dark' };
const FOCUS_LENGTHS = { 15: '15 min', 25: '25 min', 50: '50 min' };

const choices = (action, options, current) => html`
    <div class="segmented">
        ${Object.entries(options).map(([value, name]) => html`<button type="button" class="${value === String(current) ? 'is-on' : ''}" data-action="${action}" data-value="${value}">${name}</button>`)}
    </div>`;

export const settings = () => html`
    <div class="column settings">
        <header class="page-head">
            <h1 class="page-title">Settings</h1>
            <p class="page-note">${state.user.email}</p>
        </header>
        <section>
            <h2>Profile</h2>
            <form data-submit="rename">
                <div><label class="form-label" for="profile-name">Name</label><input class="form-control" id="profile-name" name="name" maxlength="80" value="${state.user.name}" required></div>
                <div><button type="submit" class="btn btn-light">Save name</button></div>
            </form>
        </section>
        <section>
            <h2>Appearance</h2>
            <p>Pick a theme, or follow the device setting.</p>
            ${choices('theme', THEMES, theme())}
        </section>
        <section>
            <h2>Focus sessions</h2>
            <p>How long a focus session runs when you start one from a task.</p>
            ${choices('focus-length', FOCUS_LENGTHS, focusLength())}
        </section>
        <section>
            <h2>Password</h2>
            <form data-submit="change-password">
                <div><label class="form-label" for="password-current">Current password</label><input class="form-control" id="password-current" name="current" type="password" autocomplete="current-password" required></div>
                <div><label class="form-label" for="password-next">New password</label><input class="form-control" id="password-next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
                <div><button type="submit" class="btn btn-light">Change password</button></div>
            </form>
        </section>
        <section>
            <h2>Recovery key</h2>
            <p>The recovery key resets your password if you forget it. Creating a new key replaces the old one.</p>
            <button type="button" class="btn btn-light" data-action="recovery-key">Create a new recovery key</button>
        </section>
        <section>
            <h2>Your data</h2>
            <p>Export everything as a JSON file, or bring the open tasks from an earlier export back in.</p>
            <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-light" data-action="export"><i class="bi bi-download me-2"></i>Export tasks</button>
                <label class="btn btn-light mb-0"><i class="bi bi-upload me-2"></i>Import tasks<input class="d-none" type="file" accept="application/json" data-change="import"></label>
                ${!live && html`<button type="button" class="btn btn-danger" data-action="reset-demo">Reset the demo</button>`}
            </div>
        </section>
        <section>
            <h2>About</h2>
            <p>${live ? `Tasky ${about.version}, running on Java ${about.java} with ${about.storage} storage.` : 'Tasky demo. No server is involved, your data stays in this browser.'}</p>
        </section>
    </div>`;

export const showRecoveryKey = async () => {
    const { recoveryKey } = await api.issueRecoveryKey();
    showDialog(html`
        <div class="dialog-pad">
            <h2>Save your recovery key</h2>
            <p>It is the only way to reset a forgotten password, and it is shown only once. Keep it in a password manager or on paper.</p>
            <div class="key-box" id="recovery-key">${recoveryKey}</div>
            <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-light" data-action="copy-key">Copy</button>
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal" data-autofocus>I saved it</button>
            </div>
        </div>`);
};

const guarded = async work => {
    try {
        await work();
    } catch (problem) {
        toast(problem.message);
    }
};

on('rename', ({ element }) => guarded(async () => {
    state.user = await api.rename(new FormData(element).get('name'));
    notify();
    toast('Name saved');
}));

on('change-password', ({ element }) => guarded(async () => {
    await api.changePassword(Object.fromEntries(new FormData(element)));
    element.reset();
    toast('Password changed');
}));

on('recovery-key', () => guarded(showRecoveryKey));

on('copy-key', async () => {
    await navigator.clipboard.writeText(document.getElementById('recovery-key').textContent);
    toast('Recovery key copied');
});

on('theme', ({ element }) => {
    setTheme(element.dataset.value);
    notify();
});

on('theme-toggle', () => {
    setTheme(document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark');
    notify();
});

on('focus-length', ({ element }) => {
    setFocusLength(element.dataset.value);
    notify();
});

on('export', exportTasks);

on('import', ({ element }) => importTasks(element.files[0]));

on('reset-demo', () => guarded(async () => {
    await api.reset();
    hideDialog();
    state.user = null;
    location.hash = '#/sign-in';
    location.reload();
}));
