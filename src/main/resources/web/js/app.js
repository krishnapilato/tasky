import Alpine from 'alpine';
import seed from '../data/seed.json' with {type: 'json'};
import {api, demo} from './api.js';
import {reset} from './demo.js';
import {today, formatDate, dateFromInput, taskSchema, accountSchema, validateForm, clearFieldError, clearFormErrors} from './validation.js';

const RANK = {high: 0, medium: 1, low: 2, none: 3};
const FILTERS = {
    open: task => !task.done,
    today: task => !task.done && task.due !== null && task.due <= today(),
    done: task => task.done
};
const EMPTY = {open: 'Nothing left to do. Add a task above.', today: 'Nothing is due today.', done: 'Finished tasks will show up here.'};
const taskFrom = form => {
    const {title, notes, due, priority} = Object.fromEntries(new FormData(form));
    return {title, notes, due: dateFromInput(due), priority};
};

Alpine.data('tasky', () => ({
    user: null, tasks: [], filter: 'open', registering: false, editing: null,
    busy: false, ready: false, error: '', demo: false, confirmingDelete: false,
    get deleteLabel() { return this.confirmingDelete ? 'Confirm delete' : 'Delete'; },
    get shown() {
        return this.tasks.filter(FILTERS[this.filter]).toSorted((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || RANK[a.priority] - RANK[b.priority] || a.id - b.id);
    },
    get summary() {
        const late = this.tasks.filter(task => this.isLate(task)).length;
        const overdue = late ? `, ${late} overdue` : '';
        return `${formatDate(today())} · ${this.count('open')} open${overdue}`;
    },
    get empty() { return EMPTY[this.filter]; },
    get hello() { return this.user ? `Hello, ${this.user.name.split(' ')[0]}` : 'Hello'; },
    get email() { return this.user?.email ?? ''; },
    get authTitle() { return this.registering ? 'Create your account' : 'Sign in to Tasky'; },
    get authSubmit() { return this.registering ? 'Create account' : 'Sign in'; },
    get authSwitch() { return this.registering ? 'I already have an account' : 'Create an account'; },
    today, clearFieldError,
    count(filter) { return this.tasks.filter(FILTERS[filter]).length; },
    isLate(task) { return !task.done && task.due !== null && task.due < today(); },
    dueLabel: formatDate,
    async run(action) {
        if (this.busy) return;
        this.busy = true;
        this.error = '';
        try {
            await action();
        } catch (error) {
            if (error.status === 401 && this.user) {
                this.$refs.editor.close();
                this.user = null;
                this.tasks = [];
            }
            this.error = error.message;
        } finally {
            this.busy = false;
        }
    },
    async show(account) {
        const tasks = account ? await api.tasks() : [];
        this.tasks = tasks;
        this.user = account;
        this.filter = 'open';
    },
    async init() { await this.start(); },
    async start() {
        await this.run(async () => {
            await this.show((await api.account()).user);
            this.demo = demo;
            this.ready = true;
        });
    },
    async authenticate(event) {
        const form = validateForm(event.target, accountSchema(this.registering), Object.fromEntries(new FormData(event.target)));
        if (!form) return;
        await this.run(async () => {
            await this.show(await (this.registering ? api.register(form) : api.login(form)));
            event.target.reset();
        });
    },
    switchAuth() {
        this.registering = !this.registering;
        this.error = '';
        for (const field of this.$refs.account.querySelectorAll('[aria-invalid]')) clearFieldError({target: field});
        this.$nextTick(() => this.$refs.account.elements[this.registering ? 'name' : 'email'].focus());
    },
    async tryDemo() { await this.run(async () => this.show(await api.login(seed.account))); },
    async logout() { await this.run(async () => { await api.logout(); await this.show(null); }); },
    async add(event) {
        const task = validateForm(event.target, taskSchema(), taskFrom(event.target));
        if (!task) return;
        await this.run(async () => {
            this.tasks.push(await api.create(task));
            event.target.reset();
            this.filter = 'open';
        });
        await this.$nextTick();
        this.$refs.newTitle.focus();
    },
    selectFilter(filter) { this.filter = filter; },
    async toggle(task, event) {
        await this.run(async () => {
            const saved = await api.update({...task, done: event.target.checked});
            this.tasks = this.tasks.map(old => old.id === saved.id ? saved : old);
        });
        event.target.checked = this.tasks.find(old => old.id === task.id)?.done ?? task.done;
    },
    edit(task) {
        clearFormErrors(this.$refs.edit);
        this.editing = task;
        this.confirmingDelete = false;
        this.error = '';
        for (const field of ['title', 'notes', 'due', 'priority']) this.$refs.edit.elements[field].value = task[field] ?? '';
        this.$refs.edit.elements.due.value = formatDate(task.due);
        this.$refs.editor.showModal();
    },
    cancel() { if (!this.busy) this.$refs.editor.close(); },
    async save(event) {
        const task = validateForm(event.target, taskSchema(this.editing.due), {...this.editing, ...taskFrom(event.target)});
        if (!task) return;
        await this.run(async () => {
            const saved = await api.update(task);
            this.tasks = this.tasks.map(old => old.id === saved.id ? saved : old);
            this.$refs.editor.close();
        });
    },
    async remove() {
        if (!this.confirmingDelete) { this.confirmingDelete = true; return; }
        await this.run(async () => {
            await api.remove(this.editing.id);
            this.tasks = this.tasks.filter(task => task.id !== this.editing.id);
            this.$refs.editor.close();
        });
        await this.$nextTick();
        if (!this.tasks.some(task => task.id === this.editing.id)) this.$refs.newTitle.focus();
    },
    reset
}));

Alpine.start();
