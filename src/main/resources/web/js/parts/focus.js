import { on } from '../actions.js';
import { duration } from '../dates.js';
import { html, paint } from '../html.js';
import { focusLength } from '../prefs.js';
import { find, logFocus } from '../store.js';
import { toast } from '../toast.js';

const KEY = 'tasky.focus';

let session = JSON.parse(localStorage.getItem(KEY));

const persist = () => session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY);

const remaining = () => session.paused ?? Math.max(0, session.endsAt - Date.now());

const clock = milliseconds => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export const drawTimer = () => {
    const slot = document.getElementById('timer');
    document.title = session ? `${clock(remaining())} Tasky` : 'Tasky';
    if (!slot) return;
    paint(slot, session ? html`
        <div class="timer">
            <button type="button" id="timer-toggle" class="timer-ring" style="--progress: ${100 - remaining() / (session.minutes * 600)}" data-action="focus-pause" aria-label="${session.paused == null ? 'Pause focus' : 'Resume focus'}">
                <i class="bi ${session.paused == null ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
            </button>
            <span>${clock(remaining())}</span>
            <span class="timer-task d-none d-md-inline">${session.title}</span>
            <button type="button" id="timer-stop" class="icon-button" data-action="focus-stop" aria-label="Stop focus and log the time"><i class="bi bi-stop-fill"></i></button>
        </div>` : '');
};

const finish = async completed => {
    const minutes = Math.round((session.minutes * 60_000 - remaining()) / 60_000);
    const { taskId } = session;
    session = null;
    persist();
    drawTimer();
    if (minutes < 1) return toast('Focus stopped before the first minute, nothing logged');
    await logFocus(taskId !== null && find(taskId) ? taskId : null, minutes);
    toast(completed ? `Focus complete, ${duration(minutes)} logged` : `${duration(minutes)} of focus logged`);
};

on('focus', ({ id }) => {
    const task = id === null ? null : find(id);
    const minutes = focusLength();
    session = { taskId: task?.id ?? null, title: task?.title ?? 'Focus session', minutes, endsAt: Date.now() + minutes * 60_000, paused: null };
    persist();
    drawTimer();
    toast(`Focus started for ${minutes} minutes`);
});

on('focus-pause', () => {
    session = session.paused == null ? { ...session, paused: remaining() } : { ...session, endsAt: Date.now() + session.paused, paused: null };
    persist();
    drawTimer();
});

on('focus-stop', () => finish(false));

setInterval(() => session && session.paused == null && remaining() === 0 ? finish(true) : drawTimer(), 1000);
