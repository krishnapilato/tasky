import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

const strict = {
    'no-unused-vars': ['error', {args: 'all', argsIgnorePattern: '^_$', caughtErrors: 'all', ignoreRestSiblings: false}],
    'no-unused-private-class-members': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-restricted-syntax': ['error',
        {selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]', message: 'Use textContent or a template instead of writing HTML.'},
        {selector: 'CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/]', message: 'Use DOM methods instead of writing HTML.'}
    ]
};

export default [
    {ignores: ['target/', 'node_modules/', 'playwright-report/', 'test-results/']},
    {linterOptions: {reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error'}},
    js.configs.recommended,
    sonarjs.configs.recommended,
    {
        files: ['src/main/resources/web/js/**/*.js'],
        languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser},
        rules: strict
    },
    {
        files: ['tests/**/*.js', '*.config.js'],
        languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.node, ...globals.browser}},
        rules: strict
    }
];
