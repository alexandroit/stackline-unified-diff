'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
function check(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) check(file);
    else if (/\.(?:cjs|js)$/.test(file)) cp.execFileSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  }
}
check(path.resolve(__dirname, '..'));
console.log('JavaScript syntax checks passed');
