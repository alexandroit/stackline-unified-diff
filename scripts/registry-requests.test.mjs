import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {fetchExpectedAttestation, publishedArtifactExists, retryRegistryInstall, retryAttestationAudit} from './registry-requests.mjs'

const name = '@stackline/example'
const version = '1.0.0'
const absent = {status: 1, stderr: `npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@stackline%2fexample - Not found`}
const okay = {status: 0, stdout: 'installed'}
const attestationUrl = `https://registry.npmjs.org/-/npm/v1/attestations/@stackline%2fexample@${version}`
test('only the exact expected attestation endpoint receives propagation retries', async () => {
  let calls = 0
  const response = await fetchExpectedAttestation(attestationUrl, `${name}@${version}`, {
    fetcher: async (url, options) => {
      assert.equal(String(url), attestationUrl)
      assert.equal(options.redirect, 'error')
      return ++calls === 1 ? new Response('', {status: 404}) : Response.json({attestations: []})
    },
    wait: async () => {}
  })
  assert.equal(calls, 2)
  assert.deepEqual(await response.json(), {attestations: []})
})
test('wrong attestation identities, registry routes and query strings never fetch', async () => {
  for (const url of [
    attestationUrl.replace('example', 'other'),
    attestationUrl.replace('@1.0.0', '@2.0.0'),
    attestationUrl.replace('registry.npmjs.org', 'example.invalid'),
    attestationUrl.replace('/-/npm/v1/attestations/', '/'),
    attestationUrl + '?version=other'
  ]) {
    let calls = 0
    await assert.rejects(fetchExpectedAttestation(url, `${name}@${version}`, {
      fetcher: async () => { calls++; return new Response('') }, wait: async () => {}
    }))
    assert.equal(calls, 0)
  }
})
test('expected attestation retries are bounded and never hide other HTTP errors', async () => {
  for (const status of [404, 401, 403, 429, 500]) {
    let calls = 0
    await assert.rejects(fetchExpectedAttestation(attestationUrl, `${name}@${version}`, {
      fetcher: async () => { calls++; return new Response('', {status}) },
      attempts: 3, wait: async () => {}
    }), new RegExp(`HTTP ${status}:`))
    assert.equal(calls, status === 404 ? 3 : 1)
  }
  for (const attempts of [0, -1, 121, Infinity]) {
    let calls = 0
    await assert.rejects(fetchExpectedAttestation(attestationUrl, `${name}@${version}`, {
      fetcher: async () => { calls++; return new Response('') }, attempts
    }))
    assert.equal(calls, 0)
  }
})
test('retries only metadata propagation for the expected package and version', async () => {
  for (const pending of [absent, {status:1,stderr:`npm error code ETARGET\nnpm error notarget No matching version found for ${name}@${version}.`}]) {
    let calls=0
    const result=await retryRegistryInstall(()=>++calls===1 ? pending : okay,{packageName:name,version,wait:async()=>{}})
    assert.equal(result,okay)
    assert.equal(calls,2)
  }
})
test('unrelated packages, versions, authorization and audit errors fail immediately', async () => {
  for (const stderr of [
    'npm error code E404\nnpm error GET https://registry.npmjs.org/unrelated',
    'npm error code ETARGET\nnpm error notarget No matching version found for @stackline/example@2.0.0.',
    'npm error code E403\nforbidden @stackline/example@1.0.0',
    'npm error code EAUDIT\nvulnerability'
  ]) {
    let calls=0
    const failure={status:1,stderr}
    assert.equal(await retryRegistryInstall(()=>{calls++;return failure},{packageName:name,version,wait:async()=>{}}),failure)
    assert.equal(calls,1)
  }
})
test('propagation retries remain bounded', async () => {
  let calls=0
  assert.equal(await retryRegistryInstall(()=>{calls++;return absent},{packageName:name,version,attempts:3,wait:async()=>{}}),absent)
  assert.equal(calls,3)
})
test('attestation retry never swallows a signature verification failure', async () => {
  const error=Object.assign(new Error('invalid signature'),{stderr:'npm error EINTEGRITY'})
  let calls=0
  await assert.rejects(retryAttestationAudit(()=>{calls++;throw error},{wait:async()=>{}}),error)
  assert.equal(calls,1)
})
test('an existing version must match both integrity and actual registry bytes', async () => {
  const bytes=Buffer.from('reviewed tarball')
  const metadata={name,version}
  const official={...metadata,dist:{integrity:`sha512-${createHash('sha512').update(bytes).digest('base64')}`,tarball:'https://registry.npmjs.org/example.tgz'}}
  const fetcher=async url=>String(url).endsWith('.tgz') ? new Response(bytes) : Response.json(official)
  assert.equal(await publishedArtifactExists(metadata,bytes,fetcher),true)
  await assert.rejects(publishedArtifactExists(metadata,Buffer.from('different'),fetcher),/differs from the CI artifact/)
  await assert.rejects(publishedArtifactExists(metadata,bytes,async url=>String(url).endsWith('.tgz') ? new Response('corrupt') : Response.json(official)),/tarball bytes differ/)
})
