import * as v from 'valibot';

const UNREADABLE = 'The request could not be read';
const text = (fallback = '') => v.nullish(v.string(UNREADABLE), fallback);
const trimmed = (maximum, emptyMessage, lengthMessage) => v.pipe(text(), v.trim(), v.minLength(1, emptyMessage), v.maxLength(maximum, lengthMessage));
const email = v.pipe(text(), v.trim(), v.toLowerCase(), v.maxLength(254, 'Enter a valid email address.'), v.regex(/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/, 'Enter a valid email address.'));
const password = v.pipe(v.string('Enter your password.'), v.check(value => value.trim().length >= 8, 'Use at least 8 characters for the password.'), v.maxLength(1024, 'Keep the password under 1024 characters.'));
const validDate = due => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due.startsWith('0000')) return false;
    const date = new Date(due + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === due;
};
export const today = () => new Date().toLocaleDateString('sv-SE');
export const formatDate = iso => iso ? iso.split('-').toReversed().join('/') : '';
export const dateFromInput = value => {
    if (!value.trim()) return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    return match ? `${match[3]}-${match[2]}-${match[1]}` : `invalid:${value}`;
};
export const accountSchema = registering => v.strictObject({
    name: registering ? trimmed(80, 'Enter your name.', 'Keep the name under 80 characters.') : v.optional(text()),
    email,
    password
}, UNREADABLE);
export const taskSchema = (currentDue = null) => v.strictObject({
    id: v.optional(v.nullable(v.pipe(v.number(UNREADABLE), v.integer(UNREADABLE)))),
    title: trimmed(50, 'Give the task a title.', 'Keep the title under 50 characters.'),
    notes: v.pipe(text(), v.trim(), v.maxLength(150, 'Keep the notes under 150 characters.')),
    due: v.nullish(v.pipe(v.string(UNREADABLE), v.check(validDate, UNREADABLE), v.check(due => due === currentDue || due >= today(), 'Pick today or a later date.')), null),
    priority: v.pipe(v.nullish(v.string(UNREADABLE), 'none'), v.toLowerCase(), v.picklist(['none', 'low', 'medium', 'high'], UNREADABLE)),
    done: v.nullish(v.boolean(UNREADABLE), false)
}, UNREADABLE);

export const validate = (schema, value) => v.safeParse(schema, value, {abortPipeEarly: true});
export const checked = (schema, value) => {
    const result = validate(schema, value);
    if (!result.success) {
        const message = result.issues[0].message;
        throw Object.assign(new Error(message), {status: message === UNREADABLE ? 400 : 422});
    }
    return result.output;
};

// Form errors use the same schemas as the demo API, but stay beside their fields.
export const clearFormErrors = form => {
    for (const field of form.querySelectorAll('[aria-invalid]')) {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
    }
    for (const error of form.querySelectorAll('.field-error')) error.remove();
};

export const validateForm = (form, schema, value) => {
    clearFormErrors(form);
    const result = validate(schema, value);
    if (result.success) return result.output;
    let first;
    for (const issue of result.issues) {
        const field = form.elements.namedItem(issue.path?.[0]?.key);
        if (!field || field.hasAttribute('aria-invalid')) continue;
        const error = document.createElement('small');
        error.id = `${form.id}-${field.name}-error`;
        error.className = 'field-error';
        error.textContent = field.name === 'due' && issue.message === UNREADABLE ? 'Enter a valid date as dd/mm/yyyy.' : issue.message;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', error.id);
        field.insertAdjacentElement('afterend', error);
        first ??= field;
    }
    first?.focus();
    return null;
};

export const clearFieldError = event => {
    const field = event.target;
    if (!field.hasAttribute('aria-invalid')) return;
    document.getElementById(field.getAttribute('aria-describedby'))?.remove();
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
};
