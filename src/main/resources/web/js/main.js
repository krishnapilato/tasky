import './drag.js';
import './keys.js';
import './parts/help.js';
import './parts/quick.js';
import { run } from './actions.js';
import { api } from './api.js';
import { paint } from './html.js';
import { drawTimer } from './parts/focus.js';
import { panel } from './parts/panel.js';
import { account, navigation, shell } from './parts/shell.js';
import { find, load, notify, state, subscribe } from './store.js';
import { toast } from './toast.js';
import { all } from './views/all.js';
import { auth } from './views/auth.js';
import { board } from './views/board.js';
import { calendar } from './views/calendar.js';
import { insights } from './views/insights.js';
import { settings } from './views/settings.js';
import { today } from './views/today.js';
import { upcoming } from './views/upcoming.js';

const VIEWS = { today, upcoming, all, board, calendar, insights, settings };
const AUTH_PAGES = ['sign-in', 'sign-up', 'recover'];

const app = document.getElementById('app');
const drawer = document.getElementById('panel');

let page = 'sign-in';

const render = () => {
    if (!state.user) {
        if (app.dataset.page !== page) app.innerHTML = auth(page);
        app.dataset.page = page;
        bootstrap.Offcanvas.getInstance(drawer)?.hide();
        return;
    }
    if (app.dataset.page !== 'shell') app.innerHTML = shell();
    app.dataset.page = 'shell';
    paint(document.getElementById('navigation'), navigation());
    if (!document.querySelector('#account .show')) paint(document.getElementById('account'), account());
    paint(document.getElementById('view'), VIEWS[state.view]());
    paint(drawer, panel());
    if (!find(state.open)) bootstrap.Offcanvas.getInstance(drawer)?.hide();
    drawTimer();
};

const navigate = () => {
    const [name, query] = location.hash.replace(/^#\/?/, '').split('?');
    if (!state.user) {
        page = AUTH_PAGES.includes(name) ? name : 'sign-in';
        render();
        if (name === 'demo') run('demo');
        return;
    }
    state.view = Object.hasOwn(VIEWS, name) ? name : 'today';
    state.filter.tag = state.view === 'all' ? new URLSearchParams(query).get('tag') : null;
    state.selected = null;
    bootstrap.Offcanvas.getInstance('#sidebar')?.hide();
    notify();
    scrollTo(0, 0);
};

addEventListener('hashchange', navigate);

addEventListener('tasky:unauthorized', () => {
    if (!state.user) return;
    Object.assign(state, { user: null, tasks: [], open: null });
    location.hash = '#/sign-in';
    toast('Your session ended. Sign in again.');
});

subscribe(render);
state.user = await api.me().catch(() => null);
if (state.user) await load();
navigate();
