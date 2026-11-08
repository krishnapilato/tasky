import {expect, test} from '@playwright/test';

const call = (page, method, ...args) => page.evaluate(async ([name, values]) => {
    const {api} = await import(new URL('js/api.js', location.href));
    try { return {status: 200, data: await api[name](...values)}; }
    catch (error) { return {status: error.status, message: error.message}; }
}, [method, args]);

test('validation boundaries, injection strings and ownership', async ({page}) => {
    await page.goto('./');
    await page.locator('#try').click();
    await expect(page.locator('#app')).toBeVisible();
    await call(page, 'logout');
    await call(page, 'register', {name: 'Validation', email: `${crypto.randomUUID()}@tasky.test`, password: crypto.randomUUID()});
    const title = 'A'.repeat(50), notes = 'N'.repeat(150);
    const created = await call(page, 'create', {title, notes});
    expect(created.status).toBe(200);
    expect((await call(page, 'create', {title: title + 'A'})).status).toBe(422);
    expect((await call(page, 'create', {title: 'Notes', notes: notes + 'N'})).status).toBe(422);
    for (const task of [{title: 123}, {title: 'Flag', done: 'false'}, {title: 'Owner', owner: 1}]) {
        expect((await call(page, 'create', task)).status).toBe(400);
    }
    for (const due of ['2027-02-30', '2027-13-01', '0000-01-01', 'not-a-date']) {
        expect((await call(page, 'create', {title: 'Date', due})).status, due).toBe(400);
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect((await call(page, 'create', {title: 'Yesterday', due: yesterday.toLocaleDateString('sv-SE')})).status).toBe(422);
    const injection = '<img src=x onerror=alert(1)>\' OR 1=1 --';
    const injected = await call(page, 'create', {title: injection, notes: '<script>alert(1)</script>'});
    expect(injected.status).toBe(200);
    await page.reload();
    await expect(page.getByRole('button', {name: injection, exact: true})).toBeVisible();
    await expect(page.locator('#tasks img, #tasks script')).toHaveCount(0);
    await call(page, 'logout');
    const stranger = await call(page, 'register', {name: 'Other', email: `${crypto.randomUUID()}@tasky.test`, password: crypto.randomUUID()});
    expect(stranger.status).toBe(200);
    expect((await call(page, 'update', {...created.data, title: 'Stolen'})).status).toBe(404);
    expect((await call(page, 'remove', created.data.id)).status).toBe(404);
    expect((await call(page, 'tasks')).data).toEqual([]);
    await call(page, 'logout');
    expect((await call(page, 'tasks')).status).toBe(401);
});

test('startup can retry and editor errors stay visible', async ({page}) => {
    await page.route('**/api/account', route => route.abort(), {times: 1});
    await page.goto('./');
    await expect(page.locator('#auth-error')).toContainText('Could not connect');
    await page.locator('#retry').click();
    await expect(page.locator('#try')).toBeEnabled();
    await page.locator('#try').click();
    await expect(page.locator('#app')).toBeVisible();
    await call(page, 'logout');
    await call(page, 'register', {name: 'Keyboard', email: `${crypto.randomUUID()}@tasky.test`, password: crypto.randomUUID()});
    await call(page, 'create', {title: 'Renew passport'});
    await page.reload();
    await page.getByRole('button', {name: 'Renew passport', exact: true}).click();
    await page.locator('#edit [name="title"]').fill('   ');
    await page.locator('#edit').evaluate(form => form.requestSubmit());
    await expect(page.locator('#edit-title-error')).toHaveText('Give the task a title.');
    await expect(page.locator('#editor')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#editor')).toBeHidden();
    await page.locator('#add [name="title"]').fill('Keyboard task');
    await page.locator('#add [name="title"]').press('Enter');
    await expect(page.getByRole('button', {name: 'Keyboard task', exact: true})).toBeVisible();
    await expect(page.locator('#add [name="title"]')).toBeFocused();
    expect(await page.locator('body').evaluate(element => getComputedStyle(element).userSelect)).toBe('none');
    expect(await page.locator('#add [name="title"]').evaluate(element => getComputedStyle(element).userSelect)).toBe('text');
    expect(await page.locator('body').evaluate(element => !element.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true})))).toBe(true);
});

test('server rejects forged requests, malformed inputs and manipulated URLs', async ({request}, testInfo) => {
    test.skip(testInfo.project.name !== 'java', 'HTTP protections belong to the Java server.');
    const headers = {'X-Tasky-Request': '1', 'Content-Type': 'application/json'};
    const credentials = {email: 'demo@tasky.test', password: 'anything'};
    expect((await request.post('api/account/login', {data: credentials})).status()).toBe(403);
    expect((await request.post('api/account/login', {headers: {...headers, Origin: 'https://evil.example'}, data: credentials})).status()).toBe(403);
    expect((await request.post('api/account/login', {headers: {...headers, 'Sec-Fetch-Site': 'cross-site'}, data: credentials})).status()).toBe(403);
    expect((await request.post('api/account/login', {headers: {...headers, 'Content-Type': 'text/plain'}, data: JSON.stringify(credentials)})).status()).toBe(415);
    for (const data of ['not json', 'null', '{} {}', '{"email":123,"password":true}', '{"email":"demo@tasky.test","admin":true}']) {
        expect((await request.post('api/account/login', {headers, data})).status(), data).toBe(400);
    }
    expect((await request.post('api/account/login', {headers, data: JSON.stringify({password: 'A'.repeat(20_000)})})).status()).toBe(413);
    for (const path of ['api/tasks/-1', 'api/tasks/99999999999999999999999999999', 'api/tasks/1%27%20OR%201=1', 'api/tasks/1']) {
        expect((await request.delete(path, {headers})).status()).toBe(401);
    }
    for (const path of ['../pom.xml', '%2e%2e%2fpom.xml', 'js/%2e%2e/%2e%2e/pom.xml']) {
        const response = await request.get(path);
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect(await response.text()).not.toContain('<artifactId>tasky</artifactId>');
    }
    expect((await request.get('api/account')).headers()['cache-control']).toBe('no-store');
    const email = `${crypto.randomUUID()}@tasky.test`;
    const failures = await Promise.all(Array.from({length: 8}, () => request.post('api/account/login', {headers, data: {email, password: 'wrong-password'}})));
    expect(failures.map(response => response.status())).toEqual(Array(8).fill(401));
    expect((await request.post('api/account/login', {headers, data: {email, password: 'wrong-password'}})).status()).toBe(429);
    const account = {name: 'URL checks', email: `${crypto.randomUUID()}@tasky.test`, password: crypto.randomUUID()};
    expect((await request.post('api/account/register', {headers, data: account})).status()).toBe(200);
    for (const id of ['-1', '99999999999999999999999999999', '1%27%20OR%201=1']) {
        expect((await request.delete(`api/tasks/${id}`, {headers})).status()).toBe(404);
    }
});

for (const timezoneId of ['Pacific/Kiritimati', 'America/Adak']) {
    test.describe(timezoneId, () => {
        test.use({timezoneId});
        test('calendar validation uses the browser time zone', async ({page}) => {
            await page.goto('./');
            await expect(page.locator('#try')).toBeEnabled();
            await call(page, 'register', {name: 'Time zone', email: `${crypto.randomUUID()}@tasky.test`, password: crypto.randomUUID()});
            const {today, yesterday} = await page.evaluate(() => {
                const date = new Date();
                const today = date.toLocaleDateString('sv-SE');
                date.setDate(date.getDate() - 1);
                return {today, yesterday: date.toLocaleDateString('sv-SE')};
            });
            expect((await call(page, 'create', {title: 'Today', due: today})).status).toBe(200);
            expect((await call(page, 'create', {title: 'Yesterday', due: yesterday})).status).toBe(422);
            await page.reload();
            await expect(page.locator('#add [name="due"]')).toHaveAttribute('placeholder', 'dd/mm/yyyy');
            await page.setViewportSize({width: 320, height: 700});
            await page.getByRole('button', {name: 'Today', exact: true}).click();
            await page.locator('#delete').click();
            expect(await page.locator('#editor article').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        });
    });
}

test('frontend blocks invalid forms before calling either API', async ({page}) => {
    await page.goto('./');
    await expect(page.locator('#try')).toBeEnabled();
    await page.evaluate(async () => {
        const {api} = await import(new URL('js/api.js', location.href));
        window.formRequests = [];
        for (const name of ['login', 'register', 'create', 'update']) {
            const original = api[name];
            api[name] = (...args) => { window.formRequests.push(name); return original(...args); };
        }
    });
    await page.locator('#email').fill('invalid');
    await page.locator('#password').fill('short');
    await page.locator('#account').evaluate(form => form.requestSubmit());
    await expect(page.locator('#account-email-error')).toHaveText('Enter a valid email address.');
    await expect(page.locator('#account-password-error')).toHaveText('Use at least 8 characters for the password.');
    await expect(page.locator('#email')).toBeFocused();
    expect(await page.evaluate(() => window.formRequests)).toEqual([]);
    await page.locator('#switch').click();
    await page.locator('#name').fill('   ');
    await page.locator('#account').evaluate(form => form.requestSubmit());
    await expect(page.locator('#account-name-error')).toHaveText('Enter your name.');
    expect(await page.evaluate(() => window.formRequests)).toEqual([]);
    await page.locator('#name').fill('Frontend');
    await page.locator('#email').fill(`${crypto.randomUUID()}@tasky.test`);
    await page.locator('#password').fill(crypto.randomUUID());
    await page.locator('#account').evaluate(form => form.requestSubmit());
    await expect(page.locator('#app')).toBeVisible();
    await page.locator('#add [name="title"]').fill('Renew passport');
    await page.locator('#add').evaluate(form => form.requestSubmit());
    await expect(page.getByRole('button', {name: 'Renew passport', exact: true})).toBeVisible();
    await page.locator('#add [name="title"]').fill('   ');
    await page.locator('#add').evaluate(form => form.requestSubmit());
    await expect(page.locator('#add-title-error')).toHaveText('Give the task a title.');
    const before = await page.evaluate(() => window.formRequests.length);
    await page.locator('#add [name="title"]').fill('Date check');
    await expect(page.locator('#add-title-error')).toHaveCount(0);
    await page.locator('#add [name="due"]').fill('01/01/2020');
    await page.locator('#add').evaluate(form => form.requestSubmit());
    await expect(page.locator('#add-due-error')).toHaveText('Pick today or a later date.');
    for (const invalid of ['31/02/2027', '2027-02-28', '1/2/2027']) {
        await page.locator('#add [name="due"]').fill(invalid);
        await page.locator('#add').evaluate(form => form.requestSubmit());
        await expect(page.locator('#add-due-error')).toHaveText('Enter a valid date as dd/mm/yyyy.');
    }
    await page.getByRole('button', {name: 'Renew passport', exact: true}).click();
    await page.locator('#edit [name="title"]').fill('   ');
    await page.locator('#edit [name="notes"]').evaluate(field => { field.value = 'N'.repeat(151); });
    await page.locator('#edit').evaluate(form => form.requestSubmit());
    await expect(page.locator('#edit-title-error')).toBeVisible();
    await expect(page.locator('#edit-notes-error')).toHaveText('Keep the notes under 150 characters.');
    expect(await page.evaluate(() => window.formRequests.length)).toBe(before);
});
