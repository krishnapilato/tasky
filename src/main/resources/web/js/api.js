import {local} from './demo.js';

export let demo = false;
let opening;

const read = async response => {
    if (response.status === 204) return null;
    const data = await response.json().catch(() => { throw new Error('The server returned an unreadable response. Please try again.'); });
    if (!response.ok) throw Object.assign(new Error(data.message ?? 'The request failed. Please try again.'), {status: response.status});
    return data;
};

const request = async (method, path, body) => {
    try {
        opening ??= fetch('api/account').then(read).then(data => { demo = data.demo === true; }).catch(error => { opening = undefined; throw error; });
        await opening;
        if (demo) return await local(method, path, body);
        return await read(await fetch(`api${path}`, {
            method,
            headers: {'Content-Type': 'application/json', 'X-Tasky-Request': '1', 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone},
            body: body && JSON.stringify(body)
        }));
    } catch (error) {
        if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.', {cause: error});
        throw error;
    }
};

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
