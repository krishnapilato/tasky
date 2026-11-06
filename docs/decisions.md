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

### Bootstrap 6 alpha from a CDN, without a build step

The frontend is plain JavaScript modules and a stylesheet, so deploying means copying a folder. Bootstrap's JavaScript is imported through an import map, and the design is light theme only.

**Cost:** Bootstrap 6 is an alpha and may change. Bootstrap and its icons load from jsDelivr, and fonts load from Google Fonts, so those services can see visitors' IP addresses.

### Java 27 without preview features

The project uses a current Java version, but only stable features, so it needs no special compiler or runtime flags.

## Security

- **Passwords** are stored as Argon2id hashes with OWASP settings, through password4j.
- **Sign-in attempts** are blocked for ten minutes after eight failures on the same email.
- **Sessions** use a `SameSite=Strict` cookie, and the session id changes at sign-in.
- **Request bodies** are limited to 16 KB.
- **The Content Security Policy** enforces Trusted Types, so the browser refuses HTML inserted from strings. It is a meta tag because GitHub Pages cannot set headers. Its hash must be recomputed whenever the import map changes.
- **CDN files** are pinned with Subresource Integrity hashes, so a changed file does not load.
- **The Docker image** runs as an unprivileged user.

## Quality

### Warnings and unused code are errors

A stray variable or an unused import fails the build. Java goes through `-Xlint:all`, PMD and Maven Enforcer. JavaScript goes through ESLint with SonarJS rules, CSS through Stylelint, and workflows through actionlint.

### One workflow per check

Each check has its own workflow, so a failure is easy to find. GitHub Pages deploys only after Build, Lint, UI tests and Lighthouse pass.

### Browser tests instead of unit tests

Playwright drives the whole app on both backends, and fails on any console error or CSP violation. This covers what users actually do with little test code.

**Cost:** there are no unit tests, so a failure points to a scenario rather than to a single method.
