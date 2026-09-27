import process from 'node:process'
import cp from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {promisify} from 'node:util'
import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import {toVFile} from 'to-vfile'
import {processor} from './processor.js'

const exec = promisify(cp.exec)

const range = process.env.TRAVIS_COMMIT_RANGE
const sha = process.env.GITHUB_SHA
const base = process.env.GITHUB_BASE_REF
const head = process.env.GITHUB_HEAD_REF

// Remove potential variables that we’re testing on CIs.
delete process.env.TRAVIS_COMMIT_RANGE
delete process.env.GITHUB_SHA
delete process.env.GITHUB_BASE_REF
delete process.env.GITHUB_HEAD_REF

const current = process.cwd()

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-unified-upstream-'))
process.chdir(fixture)

after(() => {
  for (const [key, value] of Object.entries({TRAVIS_COMMIT_RANGE: range, GITHUB_SHA: sha, GITHUB_BASE_REF: base, GITHUB_HEAD_REF: head})) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  process.chdir(current)
  fs.rmSync(fixture, {recursive: true, force: true})
})

test('diff() (travis)', async () => {
  const stepOne = [
    'Lorem ipsum dolor sit amet.',
    '',
    'Lorem ipsum. Dolor sit amet.',
    ''
  ].join('\n')
  const stepTwo = stepOne + '\nLorem ipsum.'
  const stepThree = 'Lorem.\n' + stepOne + '\nLorem.'
  const other = 'Lorem ipsum.'


  await exec('git init')
  await exec('git config user.email test@example.invalid')
  await exec('git config user.name Test')

  // Add initial file.
  const fileOne = await processor().process(
    toVFile({path: 'example.txt', value: stepOne})
  )

  assert.deepEqual(
    fileOne.messages.map((m) => String(m)),
    ['example.txt:1:1-1:6: No lorem!', 'example.txt:3:1-3:6: No lorem!'],
    'should set messages'
  )

  await toVFile.write(fileOne)

  await exec('git add example.txt')
  await exec('git commit -m one')
  const resultInitial = await exec('git rev-parse HEAD')
  const initial = resultInitial.stdout.trim()

  // Change files.
  await toVFile.write({path: 'example.txt', value: stepTwo})
  await exec('git add example.txt')
  await exec('git commit -m two')
  const resultFinal = await exec('git rev-parse HEAD')

  const final = resultFinal.stdout.trim()
  process.env.TRAVIS_COMMIT_RANGE = [initial, final].join('...')
  const fileTwo = await processor().process(
    toVFile({path: 'example.txt', value: stepTwo})
  )

  assert.deepEqual(
    fileTwo.messages.map((m) => String(m)),
    ['example.txt:5:1-5:6: No lorem!'],
    'should show only messages for changed lines'
  )

  // Again!
  const fileAgain = await processor().process(
    toVFile({path: 'example.txt', value: stepTwo})
  )

  assert.deepEqual(
    fileAgain.messages.map((m) => String(m)),
    ['example.txt:5:1-5:6: No lorem!'],
    'should not recheck (coverage for optimisations)'
  )

  // Unstaged files.
  const fileMissing = await processor().process(
    toVFile({path: 'missing.txt', value: other})
  )

  assert.deepEqual(
    fileMissing.messages.map((m) => String(m)),
    [],
    'should ignore unstaged files'
  )

  // New file.
  await toVFile.write({path: 'example.txt', value: stepThree})
  await toVFile.write({path: 'new.txt', value: other})
  await exec('git add example.txt new.txt')
  await exec('git commit -m three')
  const resultNew = await exec('git rev-parse HEAD')

  process.env.TRAVIS_COMMIT_RANGE = initial + '...' + resultNew.stdout.trim()

  const fileNew = await processor().process(
    toVFile({path: 'example.txt', value: stepThree})
  )

  assert.deepEqual(
    fileNew.messages.map((m) => String(m)),
    ['example.txt:1:1-1:6: No lorem!', 'example.txt:6:1-6:6: No lorem!'],
    'should deal with multiple patches'
  )

  const fileNewTwo = await processor().process(
    toVFile({path: 'new.txt', value: other})
  )

  assert.deepEqual(
    fileNewTwo.messages.map((m) => String(m)),
    ['new.txt:1:1-1:6: No lorem!'],
    'should deal with new files'
  )

  assert.ok(true, 'should pass')

  delete process.env.TRAVIS_COMMIT_RANGE
  fs.rmSync('.git', {recursive: true, force: true})
  fs.rmSync('new.txt', {force: true})
  fs.rmSync('example.txt', {force: true})
})

test('diff() (GitHub Actions)', async () => {
  const stepOne = [
    'Lorem ipsum dolor sit amet.',
    '',
    'Lorem ipsum. Dolor sit amet.',
    ''
  ].join('\n')
  const stepTwo = stepOne + '\nLorem ipsum.\n'
  const stepThree = 'Lorem.\n\n' + stepOne + '\nAlpha bravo.\n'
  const stepFour = stepThree + '\nIpsum lorem.\n'


  await exec('git init')
  await exec('git config user.email test@example.invalid')
  await exec('git config user.name Test')
  // Add initial file.
  await toVFile.write({path: 'example.txt', value: stepOne})
  await exec('git add example.txt')
  await exec('git commit -m one')

  // Change file.
  await toVFile.write({path: 'example.txt', value: stepTwo})
  await exec('git add example.txt')
  await exec('git commit -m two')
  const resultInitial = await exec('git rev-parse HEAD')

  process.env.GITHUB_SHA = resultInitial.stdout.trim()

  const fileInitial = await processor().process(
    toVFile({path: 'example.txt', value: stepTwo})
  )

  assert.deepEqual(
    fileInitial.messages.map((m) => String(m)),
    ['example.txt:5:1-5:6: No lorem!'],
    'should show only messages for this commit'
  )

  // A PR.
  const resultCurrent = await exec('git branch --show-current')
  const main = resultCurrent.stdout.trim()

  await exec('git checkout -b other-branch')

  // Change file.
  await toVFile.write({path: 'example.txt', value: stepThree})
  await exec('git add example.txt')
  await exec('git commit -m three')
  await toVFile.write({path: 'example.txt', value: stepFour})
  await exec('git add example.txt')
  await exec('git commit -m four')
  const final = await exec('git rev-parse HEAD')

  process.env.GITHUB_SHA = final.stdout.trim()
  process.env.GITHUB_BASE_REF = 'refs/heads/' + main
  process.env.GITHUB_HEAD_REF = 'refs/heads/other-branch'

  const fileFour = await processor().process(
    toVFile({path: 'example.txt', value: stepFour})
  )

  assert.deepEqual(
    fileFour.messages.map((m) => String(m)),
    ['example.txt:1:1-1:6: No lorem!', 'example.txt:9:7-9:12: No lorem!'],
    'should deal with PRs'
  )

  assert.ok(true, 'should pass')

  delete process.env.GITHUB_SHA
  delete process.env.GITHUB_BASE_REF
  delete process.env.GITHUB_HEAD_REF
  fs.rmSync('.git', {recursive: true, force: true})
  fs.rmSync('example.txt', {force: true})
})
