const KEY = 'tasky';

let db;
let opening;

const fail = (status, message) => {
    throw Object.assign(new Error(message), {status});
};

const text = value => (value ?? '').trim();

const day = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('sv-SE');
};

const hash = async (password, salt) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode(salt),
        iterations: 600_000
    }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
};

const view = ({id, name, email}) => ({id, name, email});

const current = () => db.users.find(user => user.id === db.session) ?? fail(401, 'Sign in to continue');

const mine = id => db.tasks.find(task => task.id === id && task.owner === current().id) ?? fail(404, 'Task not found');

const data = ({owner, ...task}) => task;

const checked = task => {
    const title = text(task.title);
    const notes = text(task.notes);
    if (!title) fail(422, 'Give the task a title');
    if (title.length > 200) fail(422, 'Keep the title under 200 characters');
    if (notes.length > 2000) fail(422, 'Keep the notes under 2000 characters');
    return {title, notes, due: task.due ?? null, priority: task.priority ?? 'none', done: Boolean(task.done)};
};

const addUser = async (name, email, password) => {
    const salt = crypto.randomUUID();
    const user = {id: db.nextId++, name, email, salt, password: await hash(password, salt)};
    db.users.push(user);
    return user;
};

const signIn = user => {
    db.session = user.id;
    return view(user);
};

const register = async form => {
    const name = text(form.name);
    const email = text(form.email).toLowerCase();
    if (!name || name.length > 80) fail(422, 'Enter your name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(422, 'Enter a valid email address');
    if (text(form.password).length < 8) fail(422, 'Use at least 8 characters for the password');
    if (db.users.some(user => user.email === email)) fail(409, 'An account with this email already exists');
    return signIn(await addUser(name, email, form.password));
};

const login = async form => {
    const user = db.users.find(candidate => candidate.email === text(form.email).toLowerCase());
    if (!user || user.password !== await hash(form.password ?? '', user.salt)) fail(401, 'Email or password is incorrect');
    return signIn(user);
};

const create = task => {
    const created = {id: db.nextId++, owner: current().id, ...checked(task)};
    db.tasks.push(created);
    return data(created);
};

const routes = {
    'GET /account': () => ({demo: true, user: db.session ? view(current()) : null}),
    'POST /account/register': register,
    'POST /account/login': login,
    'POST /account/logout': () => void (db.session = null),
    'GET /tasks': () => db.tasks.filter(task => task.owner === current().id).map(data),
    'POST /tasks': create,
    'PUT /tasks/id': (task, id) => data(Object.assign(mine(id), checked(task))),
    'DELETE /tasks/id': (_, id) => void db.tasks.splice(db.tasks.indexOf(mine(id)), 1)
};

const open = async () => {
    db = JSON.parse(localStorage.getItem(KEY));
    if (db) return;
    const seed = await fetch('data/seed.json').then(response => response.json());
    db = {nextId: 1, session: null, users: [], tasks: []};
    const user = await addUser(seed.account.name, seed.account.email, seed.account.password);
    for (const {dueIn, ...task} of seed.tasks)
        db.tasks.push({
            id: db.nextId++,
            owner: user.id, ...checked(task),
            due: dueIn === undefined ? null : day(dueIn)
        });
};

export const local = async (method, path, body) => {
    await (opening ??= open());
    const [, id] = path.match(/^\/tasks\/(\d+)$/) ?? [];
    const result = await routes[`${method} ${id ? '/tasks/id' : path}`](body, Number(id));
    localStorage.setItem(KEY, JSON.stringify(db));
    return result ?? null;
};

export const reset = () => {
    localStorage.removeItem(KEY);
    location.reload();
};
