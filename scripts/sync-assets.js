import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build, transform} from 'esbuild';

const digest = (algorithm, content) => `${algorithm}-${createHash(algorithm).update(content).digest('base64')}`;
const checking = process.argv.includes('--check');
const directory = 'src/main/resources/web/vendor';
await mkdir(directory, {recursive: true});
const asset = async (name, content) => {
    const path = `${directory}/${name}`;
    if (checking) {
        if (await readFile(path, 'utf8') !== content) throw new Error(`Stale ${path}. Run npm run sync:assets.`);
    } else {
        await writeFile(path, content);
    }
    return {url: `./vendor/${name}`, integrity: digest('sha384', content)};
};
const pico = await asset('pico.css', await readFile('node_modules/@picocss/pico/css/pico.min.css', 'utf8'));
let source = await readFile('node_modules/@alpinejs/csp/dist/module.esm.js', 'utf8');
// Alpine 3.17.5's global scan reads deprecated advertising API getters in Chrome.
// Skip only those two unrelated globals; retain the CSP parser and its guards.
const originalGuard = 'key === "styleMedia" || key === "sharedStorage"';
if (!source.includes(originalGuard)) throw new Error('Review the Alpine global-scan workaround after updating the package.');
source = source.replace(originalGuard, originalGuard + ' || key === "fence" || key === "FencedFrameConfig"');
const alpine = await asset('alpine.js', (await transform(source, {minify: true, format: 'esm', legalComments: 'eof'})).code);
const validation = await readFile('src/main/resources/web/js/validation.js', 'utf8');
const symbols = [...new Set([...validation.matchAll(/\bv\.(\w+)/g)].map(match => match[1]))].toSorted();
const bundled = await build({stdin: {contents: `export {${symbols.join(',')}} from 'valibot';`, resolveDir: process.cwd()}, bundle: true, write: false, minify: true, format: 'esm', legalComments: 'eof'});
const valibot = await asset('valibot.js', bundled.outputFiles[0].text);
const licenses = await Promise.all(['scripts/alpine-LICENSE.txt', 'node_modules/@vue/reactivity/LICENSE', 'node_modules/@picocss/pico/LICENSE.md', 'node_modules/valibot/LICENSE.md'].map(path => readFile(path, 'utf8')));
await asset('LICENSES.txt', licenses.join('\n\n---\n\n'));
const importMap = JSON.stringify({imports: {alpine: alpine.url, valibot: valibot.url}, integrity: {[alpine.url]: alpine.integrity, [valibot.url]: valibot.integrity}});
const path = 'src/main/resources/web/index.html';
const original = await readFile(path, 'utf8');
let html = original;
html = html.replace(/<link rel="stylesheet" data-package="pico"[^>]+>/, `<link rel="stylesheet" data-package="pico" href="${pico.url}" integrity="${pico.integrity}" crossorigin="anonymous">`)
    .replace(/<script type="importmap">.*?<\/script>/, `<script type="importmap">${importMap}</script>`)
    .replace(/'sha256-[^']+'/ , `'${digest('sha256', importMap)}'`);
if (checking) {
    if (html !== original) throw new Error('Dependency versions or integrity hashes are stale. Run npm run sync:assets.');
} else {
    await writeFile(path, html);
}
