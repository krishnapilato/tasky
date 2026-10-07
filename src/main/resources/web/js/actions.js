const handlers = new Map();

export const on = (name, handler) => handlers.set(name, handler);

export const run = (name, context = {}) => handlers.get(name)?.(context);

for (const type of ['click', 'submit', 'change', 'input']) document.addEventListener(type, event => {
    const attribute = type === 'click' ? 'action' : type;
    const element = event.target.closest?.(`[data-${attribute}]`);
    if (!element) return;
    if (type === 'submit') event.preventDefault();
    const task = element.closest('[data-task]');
    run(element.dataset[attribute], { element, event, id: task ? Number(task.dataset.task) : null });
});
