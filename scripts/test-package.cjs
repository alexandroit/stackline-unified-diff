'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-packed-'));
function npm(args, cwd) {
  const result = cp.spawnSync('npm', args, {cwd, encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  assert.doesNotMatch(result.stderr + result.stdout, /npm\s+warn\s+deprecated/i);
  return result.stdout;
}
try {
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root));
  const artifact = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
  const dependencies = {[pkg.name]: 'file:' + path.join(temp, artifact.filename)};
  if (pkg.name === '@stackline/unified-diff' && process.env.STACKLINE_GIT_DIFF_TREE_TARBALL) {
    dependencies['@stackline/git-diff-tree'] = 'file:' + path.resolve(process.env.STACKLINE_GIT_DIFF_TREE_TARBALL);
  }
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({name: 'packed-consumer', private: true, dependencies}));
  npm(['install', '--ignore-scripts', '--no-fund'], temp);
  const audit = JSON.parse(npm(['audit', '--json'], temp));
  assert.equal(audit.metadata.vulnerabilities.total, 0);
  const code = pkg.name === '@stackline/git-diff-tree'
    ? "const assert=require('node:assert/strict');assert.equal(typeof require('@stackline/git-diff-tree'),'function')"
    : "const {default:diff}=await import('@stackline/unified-diff');if(typeof diff!=='function')throw Error('missing plugin');await new Promise((resolve,reject)=>diff()({}, {}, error=>error?reject(error):resolve()))";
  cp.execFileSync(process.execPath, ['--input-type=' + (pkg.type === 'module' ? 'module' : 'commonjs'), '-e', code], {cwd: temp, stdio: 'inherit'});
  console.log('Packed consumer install/import and audit passed:', artifact.integrity);
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
