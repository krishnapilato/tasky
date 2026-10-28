import {defineConfig} from '@playwright/test';

const JAVA_PORT = 8091;
const PAGES_PORT = 8092;

export default defineConfig({
    testDir: 'tests',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
    use: {
        channel: process.platform === 'win32' ? 'msedge' : 'chrome',
        colorScheme: 'dark',
        trace: 'retain-on-failure'
    },
    projects: [
        {name: 'java', use: {baseURL: `http://localhost:${JAVA_PORT}/`}},
        {name: 'pages', use: {baseURL: `http://localhost:${PAGES_PORT}/tasky/`}}
    ],
    webServer: [
        {
            command: 'java -jar target/tasky.jar',
            env: {PORT: String(JAVA_PORT)},
            url: `http://localhost:${JAVA_PORT}/api/account`,
            timeout: 60_000
        },
        {
            command: `node tests/pages-server.js ${PAGES_PORT}`,
            url: `http://localhost:${PAGES_PORT}/tasky/`
        }
    ]
});
