import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {toVFile} from 'to-vfile'
import diff from '../index.js'

test('empty, binary and mode-only diffs complete without text messages; invalid revisions fail once', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-unified-regression-'))
  const keys = ['TRAVIS_COMMIT_RANGE', 'GITHUB_SHA', 'GITHUB_BASE_REF', 'GITHUB_HEAD_REF']
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  t.after(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    fs.rmSync(root, {recursive: true, force: true})
  })
  for (const key of keys) delete process.env[key]
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim()
  git('init', '-q')
  git('config', 'core.filemode', 'true')
  fs.writeFileSync(path.join(root, 'text.txt'), 'line\n')
  git('add', '.')
  git('commit', '-qm', 'initial')
  const initial = git('rev-parse', 'HEAD')
  const transform = diff()
  async function run(filename, range) {
    process.env.TRAVIS_COMMIT_RANGE = range
    const file = toVFile({cwd: root, path: path.join(root, filename), value: 'line\n'})
    file.message('diagnostic', {line: 1, column: 1})
    let callbacks = 0
    try {
      await new Promise((resolve, reject) => {
      transform({type: 'root', children: []}, file, (error) => {
        callbacks++
        if (error) reject(error)
        else resolve()
      })
      })
    } finally {
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(callbacks, 1)
    }
    assert.deepEqual(file.messages, [])
  }
  await run('text.txt', initial + '...' + initial)
  fs.writeFileSync(path.join(root, 'image.bin'), Buffer.from([0, 1, 2, 3]))
  git('add', '.')
  git('commit', '-qm', 'binary')
  const binary = git('rev-parse', 'HEAD')
  await run('image.bin', initial + '...' + binary)
  fs.chmodSync(path.join(root, 'text.txt'), 0o755)
  git('add', '.')
  git('commit', '-qm', 'mode')
  await run('text.txt', binary + '...' + git('rev-parse', 'HEAD'))
  await assert.rejects(run('text.txt', initial + '...missing-revision'), /non-zero exit code/)
})
