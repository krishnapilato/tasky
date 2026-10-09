import {local} from './demo.js';

const http = async (method, path, body) => {
    const response = await fetch(`api${path}`, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: body && JSON.stringify(body)
    });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message), {status: response.status});
    return data;
};

export const {demo} = await fetch('api/account').then(response => response.json());

const request = demo ? local : http;

export const api = {
    account: () => request('GET', '/account'),
    register: form => request('POST', '/account/register', form),
    login: form => request('POST', '/account/login', form),
    logout: () => request('POST', '/account/logout'),
    tasks: () => request('GET', '/tasks'),
    create: task => request('POST', '/tasks', task),
    update: task => request('PUT', `/tasks/${task.id}`, task),
    remove: id => request('DELETE', `/tasks/${id}`)
};
