import seed from '../data/seed.json' with {type: 'json'};

const KEY = 'tasky';

let db;
let opening;

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };

const text = value => (value ?? '').trim();

// The Swedish locale formats dates as YYYY-MM-DD, the same format date inputs use.
const day = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('sv-SE');
};

const hash = async (password, salt) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 600_000}, key, 256);
    return new Uint8Array(bits).toBase64();
};

const view = ({id, name, email}) => ({id, name, email});

const current = () => db.users.find(user => user.id === db.session) ?? fail(401, 'Sign in to continue');

const mine = id => db.tasks.find(task => task.id === id && task.owner === current().id) ?? fail(404, 'Task not found');

const data = ({id, title, notes, due, priority, done}) => ({id, title, notes, due, priority, done});

const PRIORITIES = ['none', 'low', 'medium', 'high'];

const checked = (task, currentDue = null) => {
    const title = text(task.title);
    const notes = text(task.notes);
    const due = task.due || null;
    const priority = (task.priority ?? 'none').toLowerCase();
    if (!PRIORITIES.includes(priority) || (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due))) fail(400, 'The request could not be read');
    if (!title) fail(422, 'Give the task a title');
    if (title.length > 200) fail(422, 'Keep the title under 200 characters');
    if (notes.length > 2000) fail(422, 'Keep the notes under 2000 characters');
    if (due !== null && due !== currentDue && due < day(0)) fail(422, 'Pick today or a later date');
    return {title, notes, due, priority, done: Boolean(task.done)};
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
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email)) fail(422, 'Enter a valid email address');
    if (text(form.password).length < 8) fail(422, 'Use at least 8 characters for the password');
    if (db.users.some(user => user.email === email)) fail(409, 'An account with this email already exists');
    return signIn(await addUser(name, email, form.password));
};

const login = async form => {
    const user = db.users.find(candidate => candidate.email === text(form.email).toLowerCase());
    if (user?.password !== await hash(form.password ?? '', user?.salt)) fail(401, 'Email or password is incorrect.');
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
    'POST /account/logout': () => {
        db.session = null;
    },
    'GET /tasks': () => db.tasks.filter(task => task.owner === current().id).map(data),
    'POST /tasks': create,
    'PUT /tasks/id': (task, id) => data(Object.assign(mine(id), checked(task, mine(id).due))),
    'DELETE /tasks/id': (_, id) => {
        db.tasks.splice(db.tasks.indexOf(mine(id)), 1);
    }
};

const open = async () => {
    db = JSON.parse(localStorage.getItem(KEY));
    if (db) return;
    db = {nextId: 1, session: null, users: [], tasks: []};
    const {account, tasks} = seed;
    const user = await addUser(account.name, account.email, account.password);
    for (const {dueIn, ...task} of tasks) db.tasks.push({id: db.nextId++, owner: user.id, ...checked(task), due: dueIn === undefined ? null : day(dueIn)});
};

export const local = async (method, path, body) => {
    opening ??= open();
    await opening;
    const [, id] = path.match(/^\/tasks\/(\d+)$/) ?? [];
    const result = await routes[`${method} ${id ? '/tasks/id' : path}`](body, Number(id));
    localStorage.setItem(KEY, JSON.stringify(db));
    return result ?? null;
};

export const reset = () => {
    localStorage.removeItem(KEY);
    location.reload();
};
