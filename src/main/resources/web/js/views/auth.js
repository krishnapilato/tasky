import { on } from '../actions.js';
import { api, seed } from '../api.js';
import { label } from '../dates.js';
import { html } from '../html.js';
import { tag } from '../parts/row.js';
import { parse } from '../quickadd.js';
import { load, notify, state } from '../store.js';
import { flushToasts, toast } from '../toast.js';
import { showRecoveryKey } from './settings.js';

const SPECIMEN = 'Pay rent friday !high #home every month';
const TINTS = { due: 'blue', priority: 'orange', tag: 'green', repeat: 'purple' };

const field = (name, title, type, autocomplete, minimum = 0) => html`
    <div>
        <label class="form-label" for="auth-${name}">${title}</label>
        <input class="form-control" id="auth-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${minimum > 0 && html`minlength="${minimum}"`} required>
    </div>`;

const PAGES = {
    'sign-in': {
        title: 'Sign in',
        submit: 'Sign in',
        fields: [field('email', 'Email', 'email', 'username'), field('password', 'Password', 'password', 'current-password')],
        links: html`<a href="#/sign-up">Create an account</a><a href="#/recover">Forgot your password?</a>`
    },
    'sign-up': {
        title: 'Create your account',
        submit: 'Create account',
        fields: [field('name', 'Name', 'text', 'name'), field('email', 'Email', 'email', 'username'), field('password', 'Password, at least 8 characters', 'password', 'new-password', 8)],
        links: html`<a href="#/sign-in">I already have an account</a>`
    },
    recover: {
        title: 'Reset your password',
        submit: 'Reset password',
        fields: [field('email', 'Email', 'email', 'username'), field('recoveryKey', 'Recovery key', 'text', 'off'), field('password', 'New password, at least 8 characters', 'password', 'new-password', 8)],
        links: html`<a href="#/sign-in">Back to sign in</a>`
    }
};

const specimen = () => {
    const draft = parse(SPECIMEN);
    const pieces = draft.tokens.map((token, index) => html`${SPECIMEN.slice(draft.tokens[index - 1]?.end ?? 0, token.start)}<mark class="tint-${TINTS[token.kind]}">${SPECIMEN.slice(token.start, token.end)}</mark>`);
    return html`
        <p class="specimen">${pieces}</p>
        <div class="specimen-result">
            <span class="check priority-${draft.priority}"></span>
            <span>${draft.title}</span>
            <span class="task-meta"><span class="meta"><i class="bi bi-arrow-repeat"></i>Monthly</span>${draft.tags.map(tag)}<span class="due">${label(draft.due)}</span></span>
        </div>`;
};

export const auth = name => html`
    <div class="auth">
        <main class="auth-form">
            <a class="brand p-0" href="#/sign-in"><img src="icon.svg" width="28" height="28" alt=""><span>Tasky</span></a>
            <h1>${PAGES[name].title}</h1>
            <form data-submit="${name}">
                ${PAGES[name].fields}
                <p class="auth-error" id="auth-error" role="alert"></p>
                <button type="submit" class="btn btn-primary">${PAGES[name].submit}</button>
                ${name === 'sign-in' && html`<button type="button" class="btn btn-light" data-action="demo">Explore with the demo account</button>`}
            </form>
            <p class="auth-links">${PAGES[name].links}</p>
        </main>
        <aside class="auth-aside">
            ${specimen()}
            <p>Type a task the way you would say it. Tasky reads the date, priority, tags and repeat, then files it on the right day.</p>
        </aside>
    </div>`;

const enter = async user => {
    state.user = user;
    await load();
    location.hash = '#/today';
    notify();
};

const attempt = async (form, work) => {
    const button = form.querySelector('[type="submit"]');
    const error = document.getElementById('auth-error');
    button.disabled = true;
    error.textContent = '';
    try {
        await work(Object.fromEntries(new FormData(form)));
    } catch (problem) {
        error.textContent = problem.message;
        button.disabled = false;
    }
};

on('sign-in', ({ element }) => attempt(element, async credentials => enter(await api.login(credentials))));

on('sign-up', ({ element }) => attempt(element, async registration => {
    await enter(await api.register(registration));
    await showRecoveryKey();
}));

on('recover', ({ element }) => attempt(element, async recovery => {
    await enter(await api.recover(recovery));
    await showRecoveryKey();
}));

on('demo', async () => {
    try {
        await enter(await api.login((await seed()).account));
    } catch (problem) {
        toast(problem.message);
    }
});

on('sign-out', async () => {
    flushToasts();
    await api.logout().catch(() => null);
    Object.assign(state, { user: null, tasks: [], insights: null, open: null, selected: null });
    location.hash = '#/sign-in';
    notify();
});
