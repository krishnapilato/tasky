import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import {launch} from 'chrome-launcher';

const url = process.argv[2] ?? 'http://localhost:8091/';
const MINIMUM = {performance: 0.9, accessibility: 1, 'best-practices': 1, seo: 1};
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const browser = await launch({
    chromePath: process.env.CHROME_PATH ?? (process.platform === 'win32' ? EDGE : undefined),
    chromeFlags: ['--headless=new', '--no-sandbox'],
    port: 9333
});

const failures = [];
try {
    for (const [preset, config] of [['desktop', desktop], ['mobile', undefined]]) {
        const {lhr} = await lighthouse(url, {port: browser.port, logLevel: 'error', onlyCategories: Object.keys(MINIMUM)}, config);
        const scores = Object.entries(MINIMUM).map(([key, minimum]) => ({key, minimum, score: lhr.categories[key].score}));
        const summary = scores.map(({key, score}) => key + ' ' + Math.round(score * 100)).join(', ');
        console.log(`${preset}: ${summary}`);
        for (const {key, score, minimum} of scores) {
            if (score >= minimum) continue;
            const audits = lhr.categories[key].auditRefs.map(ref => lhr.audits[ref.id]).filter(audit => audit.score !== null && audit.score < 1).map(audit => audit.title);
            failures.push(`${preset} ${key} is ${Math.round(score * 100)}, below the minimum of ${minimum * 100}: ${audits.join('; ')}`);
        }
    }
} finally {
    await browser.kill();
}

for (const failure of failures) console.error(failure);
process.exit(failures.length > 0 ? 1 : 0);
