import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {toVFile} from 'to-vfile'
import diff from '../index.js'

async function changedLines(t, before, after, expected, {provider = 'github', hunks} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-unified-lines-'))
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
  const filename = path.join(root, 'fixture.txt')
  git('init', '-q')
  if (before !== null) fs.writeFileSync(filename, before)
  git('add', '-A')
  git('commit', '--allow-empty', '-qm', 'before')
  const initial = git('rev-parse', 'HEAD')
  if (after === null) fs.rmSync(filename)
  else fs.writeFileSync(filename, after)
  git('add', '-A')
  git('commit', '-qm', 'after')
  const final = git('rev-parse', 'HEAD')
  const patch = git('diff', initial, final, '--', 'fixture.txt')
  if (hunks !== undefined) assert.equal((patch.match(/^@@ /gm) || []).length, hunks, patch)
  if (provider === 'travis') process.env.TRAVIS_COMMIT_RANGE = initial + '...' + final
  else process.env.GITHUB_SHA = final

  const value = after === null ? '' : after
  const file = toVFile({cwd: root, path: filename, value})
  // Warn on every new-file line, so unchanged/context lines must all disappear.
  const count = Math.max(1, value.replace(/\n$/, '').split('\n').length)
  for (let line = 1; line <= count; line++) file.message('diagnostic', {line, column: 1})
  await new Promise((resolve, reject) => diff()({type: 'root', children: []}, file, (error) => error ? reject(error) : resolve()))
  assert.deepEqual(file.messages.map((message) => message.line), expected, patch)
}

for (const provider of ['github', 'travis']) {
  test('replacement retains only the changed line on ' + provider, async (t) => {
    await changedLines(t, 'His document.\n\nA useful document.\n', 'His document.\n\nHis new document.\n', [3], {provider})
  })
}

test('mixed removals, adjacent additions and context use new-file line positions', async (t) => {
  const before = Array.from({length: 9}, (_, index) => 'context' + (index + 1))
  const after = [before[0], 'new line one', 'new line two', ...before.slice(2), 'new end']
  await changedLines(t, before.join('\n') + '\n', after.join('\n') + '\n', [2, 3, 11])
})

test('later hunk resets its position after a deletion in an earlier hunk', async (t) => {
  const before = Array.from({length: 20}, (_, index) => 'line' + (index + 1))
  const after = before.filter((line) => line !== 'line2')
  after.splice(16, 0, 'added in later hunk')
  await changedLines(t, before.join('\n') + '\n', after.join('\n') + '\n', [17], {hunks: 2})
})

test('no-newline markers do not consume new-file lines', async (t) => {
  await changedLines(t, 'context\nold', 'context\nnew', [2])
})

test('blank added and context lines are counted', async (t) => {
  await changedLines(t, 'first\n\nlast\n', 'first\n\n\nlast\n', [3])
})

test('deletion-only changes do not retain diagnostics from context lines', async (t) => {
  await changedLines(t, 'first\nremoved\nlast\n', 'first\nlast\n', [])
})

test('a newly added file starts at line one', async (t) => {
  await changedLines(t, null, 'first\nsecond\n', [1, 2])
})

test('a deleted file contributes no changed new-file lines', async (t) => {
  await changedLines(t, 'first\nsecond\n', null, [])
})
