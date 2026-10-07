const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

class Markup {
    constructor(text) {
        this.text = text;
    }

    toString() {
        return this.text;
    }
}

const render = value => {
    if (value == null || value === false) return '';
    if (Array.isArray(value)) return value.map(render).join('');
    if (value instanceof Markup) return value.text;
    return String(value).replace(/[&<>"']/g, character => entities[character]);
};

export const html = (strings, ...values) => new Markup(strings.reduce((markup, string, index) => markup + render(values[index - 1]) + string));

export const paint = (element, markup) => {
    const active = document.activeElement;
    const kept = active?.id && element.contains(active) ? { id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
    const scrolled = [...element.querySelectorAll('[data-scroll]')].map(node => [node.dataset.scroll, node.scrollTop]);
    element.innerHTML = markup;
    for (const [name, top] of scrolled) element.querySelector(`[data-scroll="${name}"]`)?.scrollTo({ top });
    const restored = kept && document.getElementById(kept.id);
    if (!restored) return;
    if (typeof kept.value === 'string' && restored.type !== 'checkbox') restored.value = kept.value;
    restored.focus({ preventScroll: true });
    if (typeof kept.start === 'number') restored.setSelectionRange(kept.start, kept.end);
};
