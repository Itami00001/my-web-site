#!/usr/bin/env node
/**
 * Run after code changes to create favicon, commit, tag, and push.
 * Usage: node scripts/finalize-release.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

require('./create-favicon.js');

function run(cmd) {
    console.log(`> ${cmd}`);
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (out) process.stdout.write(out);
    return out;
}

try {
    run('node -c public/pad.js');
    run('node -c server.js');
    run('git add -A');
    run('git commit -m "fix: исправление геокодинга, добавление кнопок на карту, модальное окно маршрутов"');
    try {
        run('git tag v1.2.0');
    } catch {
        run('git tag -f v1.2.0');
    }
    run('git push origin HEAD');
    run('git push origin v1.2.0');
    console.log('Commit:', run('git rev-parse HEAD').trim());
    run('git status');
} catch (error) {
    console.error(error.stderr || error.message);
    process.exit(1);
}
