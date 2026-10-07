import { demo, resetDemo } from './demo.js';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const http = async (method, path, body) => {
    const response = await fetch(`api${path}`, {
        method,
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-Time-Zone': zone },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 204) return null;
    if (response.status === 401) dispatchEvent(new Event('tasky:unauthorized'));
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.message), { status: response.status });
    return payload;
};

export const about = await fetch('api/meta').then(response => response.json()).catch(() => ({ java: null }));

export const live = about.java !== null;

const request = live ? http : demo;

export const seed = () => fetch('data/seed.json').then(response => response.json());

export const api = {
    me: () => request('GET', '/auth/me'),
    register: registration => request('POST', '/auth/register', registration),
    login: credentials => request('POST', '/auth/login', credentials),
    logout: () => request('POST', '/auth/logout'),
    recover: recovery => request('POST', '/auth/recover', recovery),
    rename: name => request('PUT', '/auth/me', { name }),
    changePassword: change => request('POST', '/auth/password', change),
    issueRecoveryKey: () => request('POST', '/auth/recovery-key'),
    tasks: () => request('GET', '/tasks'),
    create: draft => request('POST', '/tasks', draft),
    edit: (id, draft) => request('PUT', `/tasks/${id}`, draft),
    move: (id, status) => request('POST', `/tasks/${id}/move`, { status }),
    remove: id => request('DELETE', `/tasks/${id}`),
    focus: entry => request('POST', '/focus', entry),
    insights: () => request('GET', '/insights'),
    reset: resetDemo
};
