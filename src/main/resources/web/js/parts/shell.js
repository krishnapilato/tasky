import { live } from '../api.js';
import { today } from '../dates.js';
import { html } from '../html.js';
import { isLate, isOpen, state, tags } from '../store.js';

const VIEWS = [
    ['today', 'bi-sun', 'Today'],
    ['upcoming', 'bi-calendar-week', 'Upcoming'],
    ['all', 'bi-list-check', 'All tasks'],
    ['board', 'bi-kanban', 'Board'],
    ['calendar', 'bi-calendar3', 'Calendar'],
    ['insights', 'bi-bar-chart', 'Insights']
];

const counts = () => {
    const open = state.tasks.filter(isOpen);
    return { today: open.filter(task => task.due !== null && task.due <= today()).length, upcoming: open.filter(task => task.due > today()).length, all: open.length };
};

export const destinations = VIEWS;

export const shell = () => html`
    <div class="shell">
        <aside class="sidebar offcanvas-lg offcanvas-start" id="sidebar" tabindex="-1" aria-label="Navigation">
            <a class="brand" href="#/today"><img src="icon.svg" width="22" height="22" alt=""><span>Tasky</span></a>
            <button type="button" class="jump" data-action="palette"><i class="bi bi-search"></i><span>Search or jump to</span><kbd>Ctrl K</kbd></button>
            <nav id="navigation" aria-label="Views and tags"></nav>
            <div class="side-foot" id="account"></div>
        </aside>
        <main class="main">
            <div class="topbar">
                <div class="topbar-row">
                    <button type="button" class="icon-button d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#sidebar" aria-label="Open navigation"><i class="bi bi-list"></i></button>
                    <form class="quick" data-submit="quick-add" autocomplete="off">
                        <i class="bi bi-plus-lg"></i>
                        <div class="quick-field">
                            <div class="quick-backdrop" id="quick-backdrop" aria-hidden="true"></div>
                            <input class="quick-input" id="quick-input" type="text" maxlength="300" placeholder="Add a task, like “Pay rent friday !high #home”" aria-label="Add a task" data-input="quick-preview">
                        </div>
                        <kbd class="d-none d-md-inline">N</kbd>
                    </form>
                    <div id="timer"></div>
                </div>
                <div class="quick-preview" id="quick-preview" aria-live="polite"></div>
            </div>
            <div class="view" id="view"></div>
        </main>
    </div>`;

export const navigation = () => {
    const totals = counts();
    const late = state.tasks.some(isLate);
    return html`
        <ul class="side-list">
            ${VIEWS.map(([name, icon, title]) => html`
                <li>
                    <a class="side-link ${state.view === name && !(name === 'all' && state.filter.tag) ? 'is-active' : ''}" href="#/${name}">
                        <i class="bi ${icon}"></i><span>${title}</span>
                        ${totals[name] > 0 && html`<span class="count ${name === 'today' && late ? 'is-late' : ''}">${totals[name]}</span>`}
                    </a>
                </li>`)}
        </ul>
        ${tags().length > 0 && html`<p class="side-heading">Tags</p>`}
        <ul class="side-list">
            ${tags().map(([name, count]) => html`
                <li>
                    <a class="side-link ${state.view === 'all' && state.filter.tag === name ? 'is-active' : ''}" href="#/all?tag=${encodeURIComponent(name)}">
                        <i class="bi bi-hash"></i><span>${name}</span><span class="count">${count}</span>
                    </a>
                </li>`)}
        </ul>`;
};

export const account = () => html`
    <div class="dropup">
        <button type="button" class="account" data-bs-toggle="dropdown" aria-expanded="false">
            <span class="avatar">${state.user.name.split(/\s+/).slice(0, 2).map(part => part[0].toUpperCase()).join('')}</span>
            <span class="account-name">${state.user.name}</span>
            <i class="bi bi-chevron-expand"></i>
        </button>
        <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="#/settings"><i class="bi bi-gear"></i>Settings</a></li>
            <li><button type="button" class="dropdown-item" data-action="theme-toggle"><i class="bi bi-circle-half"></i>Switch theme</button></li>
            <li><button type="button" class="dropdown-item" data-action="shortcuts"><i class="bi bi-keyboard"></i>Keyboard shortcuts</button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button type="button" class="dropdown-item" data-action="sign-out"><i class="bi bi-box-arrow-right"></i>Sign out</button></li>
        </ul>
    </div>
    ${!live && html`<p class="demo-note">Demo mode: everything is stored in this browser. <button type="button" class="link-button" data-action="reset-demo">Reset the demo</button></p>`}`;
