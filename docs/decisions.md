# Decisions

Why Tasky is built the way it is. Each entry states the decision, the reason, and what it costs.

## Product

### A small scope

Tasky does one job: sign up, sign in, and keep one task list with due dates, priorities and three filters. Boards, calendars, insights, a focus timer and a command palette were removed on purpose, so that one person can read and explain the whole project.

**Cost:** fewer features than a typical task manager.

### A public demo that needs no server

The app must also work on GitHub Pages, which only serves files. Two backends share one contract: the Javalin routes in `Routes.java`, and `demo.js`, which runs in the browser and stores data in `localStorage`.

The page asks for `api/account` when it loads. The Java server answers that itself, while on Pages the same address is a static file that says `"demo": true`.

**Cost:** any change to API behaviour or validation messages must be made in both backends. The UI tests run against both to catch differences.

### Data lives in memory

The H2 database is in memory and is filled from `seed.json` on every start. There is nothing to install or configure, and both backends use the same sample data.

**Cost:** a restart loses all data, so this is not ready to store real tasks as it stands.

## Stack

### Javalin, JDBI and H2 instead of Spring

The API has only a few routes, so a small stack fits, starts quickly and is easy to follow. Javalin runs on Jetty with virtual threads. JDBI keeps the SQL visible in `Store.java`.

### Pico CSS, Alpine CSP and Valibot

Pico supplies basic form styles. Alpine owns the reactive UI state, so filters, counts and task rows do not need manual DOM synchronization. Native HTML dialogs provide modal focus and Escape handling. Valibot schemas are shared by frontend forms and the browser demo; the server validates independently. Titles are limited to 50 characters and notes to 150.

Dependencies are pinned in npm and generated into committed local assets by `npm run sync:assets`. Esbuild only prepares these dependency files; deployment still copies a folder. Lint checks generated content and integrity hashes. Third-party licenses ship with the assets.

The generator contains a small, guarded workaround for Alpine 3.17.5: its CSP parser scans browser globals and touches deprecated advertising API getters. Skipping only `fence` and `FencedFrameConfig` avoids that warning while retaining the CSP parser and its guards. Recheck this workaround when upgrading Alpine; the script fails if its expected source guard changes.

**Cost:** one asset-generation command when dependencies change. Google Fonts remains an external request. Alpine's `x-html` must never be used; Trusted Types remains enforced with no policies allowed.

### Java 27 without preview features

The project uses a current Java version, but only stable features, so it needs no special compiler or runtime flags.

## Security

- **Passwords** are stored as Argon2id hashes with OWASP settings, through password4j.
- **Sign-in attempts** are blocked for ten minutes after eight failures on the same email.
- **Sessions** use a `SameSite=Strict` cookie, and the session id changes at sign-in.
- **Request bodies** are limited to 16 KB. Unknown JSON fields, trailing content and scalar type coercions are rejected. Mutations require a custom header and reject foreign origins; POST/PUT require JSON. API responses are not cached.
- **Date validation** uses the browser IANA time zone supplied in a header, with UTC as the default for API clients. Existing overdue tasks can retain their date.
- **Sessions** expire after 30 minutes without activity.
- **UI restrictions** disable right-click and selection outside editable fields. They do not protect the API.
- **The Content Security Policy** enforces Trusted Types, so the browser refuses HTML inserted from strings. It is a meta tag because GitHub Pages cannot set headers. Its hash must be recomputed whenever the import map changes.
- **Frontend dependencies** are local and pinned with Subresource Integrity hashes. The only third-party runtime requests are fonts.
- **The Docker image** runs as an unprivileged user.

## Quality

### Warnings and unused code are errors

A stray variable or an unused import fails the build. Java goes through `-Xlint:all`, PMD and Maven Enforcer. JavaScript goes through ESLint with SonarJS rules, CSS through Stylelint, and workflows through actionlint.

### One workflow per check

Each check has its own workflow, so a failure is easy to find. GitHub Pages deploys only after Build, Lint, UI tests and Lighthouse pass.

### Browser tests instead of unit tests

Playwright drives the whole app on both backends, and fails on any console error or CSP violation. This covers what users actually do with little test code.

**Cost:** there are no unit tests, so a failure points to a scenario rather than to a single method.
