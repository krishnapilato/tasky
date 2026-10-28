import {expect, test} from '@playwright/test';

const today = new Date().toLocaleDateString('sv-SE');
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE');
const newPassword = crypto.randomUUID();

// Rejected requests are part of the scenario, and Edge reports CDN storage blocking as a warning.
const EXPECTED_CONSOLE = /status of (400|401|409|422)|Tracking Prevention/;

const counts = page => Promise.all(['open', 'today', 'done'].map(filter => page.locator(`[data-filter="${filter}"] span`).textContent().then(Number)));
const titles = page => page.locator('.task-title').allTextContents();
const row = (page, title) => page.locator('.task').filter({has: page.getByRole('button', {name: title, exact: true})});

const fill = async (form, values) => {
    for (const [name, value] of Object.entries(values)) {
        const field = form.locator(`[name="${name}"]`);
        if (await field.evaluate(element => element.tagName) === 'SELECT') await field.selectOption(value);
        else await field.fill(value);
    }
    await form.evaluate(element => element.requestSubmit());
};

const openTask = async (page, title) => {
    await page.getByRole('button', {name: title, exact: true}).click();
    await expect(page.locator('#editor')).toHaveCSS('opacity', '1');
};

const callApi = (page, method, ...args) => page.evaluate(async ([name, values]) => {
    const {api} = await import(new URL('js/api.js', location.href));
    try {
        return `ok:${JSON.stringify(await api[name](...values))}`;
    } catch (error) {
        return `${error.status}:${error.message}`;
    }
}, [method, args]);

test('the whole app works from sign-in to sign-out', async ({page}) => {
    const problems = [];
    page.on('console', message => {
        if (['error', 'warning'].includes(message.type()) && !EXPECTED_CONSOLE.test(message.text())) problems.push(message.text());
    });
    page.on('pageerror', error => problems.push(error.message));

    await page.goto('./');
    const account = page.locator('#account');

    await test.step('sign-in screen, light theme and pinned CDN files', async () => {
        await expect(page.locator('#auth')).toBeVisible();
        await expect(page.locator('#app')).toBeHidden();
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
        expect(await page.locator('link[href*="cdn.jsdelivr"]').evaluateAll(links => links.every(link => link.integrity))).toBe(true);
        expect(await page.locator('script[type="importmap"]').textContent()).toContain('"integrity"');
    });

    await test.step('wrong credentials are rejected without crashing', async () => {
        await fill(account, {email: 'demo@tasky.test', password: 'wrong-password'});
        await expect(page.locator('#auth-error')).toHaveText('Email or password is incorrect.');
        await fill(account, {email: 'nobody@tasky.test', password: 'wrong-password'});
        await expect(page.locator('#auth-error')).toHaveText('Email or password is incorrect.');
    });

    await test.step('the demo account shows the seeded tasks', async () => {
        await page.locator('#try').click();
        await expect(page.locator('#hello')).toHaveText('Hello, Jamie');
        expect(await counts(page)).toEqual([9, 3, 4]);
        await expect(page.locator('#summary')).toContainText('9 open, 1 overdue');
        await expect(page.locator('.task-title').first()).toHaveText('Renew passport');
        await expect(page.locator('.task-due').first()).toHaveClass(/late/);
        await expect(page.locator('#add [name="due"]')).toHaveAttribute('min', today);
    });

    await test.step('adding, finishing and reopening tasks', async () => {
        const add = page.locator('#add');
        await fill(add, {title: 'Write the report', due: tomorrow, priority: 'high'});
        await expect(page.locator('.task')).toHaveCount(10);
        await fill(add, {title: '   '});
        await expect(page.locator('#error')).toHaveText('Give the task a title');

        await row(page, 'Morning run').locator('.check').click();
        await expect(page.locator('.task')).toHaveCount(9);
        expect(await counts(page)).toEqual([9, 2, 5]);

        await page.locator('[data-filter="done"]').click();
        await expect(page.locator('.task')).toHaveCount(5);
        await row(page, 'Morning run').locator('.check').click();
        await expect(page.locator('.task')).toHaveCount(4);
        expect(await counts(page)).toEqual([10, 3, 4]);
    });

    await test.step('the Today filter shows overdue and today', async () => {
        await page.locator('[data-filter="today"]').click();
        expect(await titles(page)).toEqual(['Renew passport', 'Reply to Priya about the design review', 'Morning run']);
        await page.locator('[data-filter="open"]').click();
    });

    await test.step('editing, cancelling and deleting in the dialog', async () => {
        const editor = page.locator('#editor');
        const form = page.locator('#edit');
        await openTask(page, 'Renew passport');
        await expect(form.locator('[name="title"]')).toHaveValue('Renew passport');
        await expect(form.locator('[name="priority"]')).toHaveValue('high');
        const due = form.locator('[name="due"]');
        expect(await due.getAttribute('min')).toBe(await due.inputValue());

        await editor.getByRole('button', {name: 'Cancel'}).click();
        await expect(editor).toBeHidden();

        await openTask(page, 'Renew passport');
        await fill(form, {title: 'Renew the passport', notes: 'Bring two photos.', due: '', priority: 'low'});
        await expect(editor).toBeHidden();
        await expect(page.locator('#summary')).toContainText('10 open');
        expect(await titles(page)).toContain('Renew the passport');

        await openTask(page, 'Sort the photos from the summer');
        await page.locator('#delete').click();
        await expect(editor).toBeHidden();
        await expect(page.locator('.task')).toHaveCount(9);
        expect(await counts(page)).toEqual([9, 2, 4]);
    });

    await test.step('the API validates dates and priorities the same way in both backends', async () => {
        expect(await callApi(page, 'create', {title: 'Old', due: '2020-01-01', priority: 'none'})).toBe('422:Pick today or a later date');
        expect(await callApi(page, 'create', {title: 'Odd', priority: 'urgent'})).toBe('400:The request could not be read');
        const late = await page.evaluate(async before => {
            const {api} = await import(new URL('js/api.js', location.href));
            return (await api.tasks()).find(task => task.due && task.due < before);
        }, today);
        expect(await callApi(page, 'update', {...late, title: `${late.title}!`})).toMatch(/^ok:/);
        expect(await callApi(page, 'update', {...late, due: '2020-01-01'})).toBe('422:Pick today or a later date');
    });

    await test.step('data and session survive a reload', async () => {
        await page.reload();
        await expect(page.locator('#app')).toBeVisible();
        expect(await counts(page)).toEqual([9, 2, 4]);
    });

    await test.step('signing out, registering and keeping accounts apart', async () => {
        await page.locator('#logout').click();
        await expect(page.locator('#auth')).toBeVisible();
        await page.locator('#switch').click();
        await fill(account, {name: 'Test Person', email: 'demo@tasky.test', password: newPassword});
        await expect(page.locator('#auth-error')).toHaveText('An account with this email already exists');
        await fill(account, {name: 'Test Person', email: 'New@Tasky.test', password: newPassword});
        await expect(page.locator('#hello')).toHaveText('Hello, Test');
        await expect(page.locator('.task')).toHaveCount(0);
        await fill(page.locator('#add'), {title: 'Only mine'});
        await expect(page.locator('.task')).toHaveCount(1);
        await page.locator('#logout').click();
        await page.locator('#try').click();
        await expect(page.locator('.task')).toHaveCount(9);
        expect(await titles(page)).not.toContain('Only mine');
    });

    await test.step('the phone layout has no horizontal scrolling', async () => {
        await page.setViewportSize({width: 390, height: 844});
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });

    expect(problems, 'console errors, CSP or integrity violations').toEqual([]);
});
