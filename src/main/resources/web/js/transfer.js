import { api } from './api.js';
import { today } from './dates.js';
import { isOpen, load, state } from './store.js';
import { toast } from './toast.js';

export const exportTasks = () => {
    const backup = { app: 'tasky', version: 1, exportedAt: new Date().toISOString(), tasks: state.tasks };
    const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })),
        download: `tasky-${today()}.json`
    });
    link.click();
    URL.revokeObjectURL(link.href);
};

export const importTasks = async file => {
    try {
        const { tasks } = JSON.parse(await file.text());
        const created = await Promise.all(tasks.filter(isOpen).map(async task => {
            const copy = await api.create(task);
            return task.status === 'doing' ? api.move(copy.id, 'doing') : copy;
        }));
        await load();
        toast(`${created.length} open ${created.length === 1 ? 'task' : 'tasks'} imported`);
    } catch {
        toast('That file is not a Tasky export');
    }
};
