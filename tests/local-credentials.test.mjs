import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { storeSupabaseCredentials, localSupabaseValue, credentialPath } = require('../scripts/lib/local-credentials')
const { required } = require('../scripts/lib/supabase-management')

test('DPAPI local credentials roundtrip without plaintext and environment retains precedence', { skip: process.platform !== 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'we-delivery-credential-test-'))
  const env = { WE_DELIVERY_CREDENTIALS_PROJECT: root }
  const token = 'sbp_synthetic_testing_only_1234567890'
  const projectRef = 'iqacuakyyzhrsrjzlnai'
  const original = { local: process.env.WE_DELIVERY_CREDENTIALS_PROJECT, token: process.env.SUPABASE_ACCESS_TOKEN, ref: process.env.SUPABASE_PROJECT_REF }
  try {
    assert.equal(localSupabaseValue('SUPABASE_ACCESS_TOKEN', env), undefined)
    storeSupabaseCredentials(token, projectRef, env)
    const stored = fs.readFileSync(credentialPath(env), 'utf8')
    assert.equal(stored.includes(token), false)
    assert.equal(localSupabaseValue('SUPABASE_ACCESS_TOKEN', env), token)
    assert.equal(localSupabaseValue('SUPABASE_PROJECT_REF', env), projectRef)
    process.env.WE_DELIVERY_CREDENTIALS_PROJECT = root
    process.env.SUPABASE_ACCESS_TOKEN = ' explicit-environment-token '
    process.env.SUPABASE_PROJECT_REF = 'explicit-project'
    assert.equal(required('SUPABASE_ACCESS_TOKEN'), 'explicit-environment-token')
    assert.equal(required('SUPABASE_PROJECT_REF'), 'explicit-project')
    delete process.env.SUPABASE_ACCESS_TOKEN
    delete process.env.SUPABASE_PROJECT_REF
    assert.equal(required('SUPABASE_ACCESS_TOKEN'), token)
    assert.equal(required('SUPABASE_PROJECT_REF'), projectRef)
    storeSupabaseCredentials(token + 'renewed', projectRef, env)
    assert.equal(localSupabaseValue('SUPABASE_ACCESS_TOKEN', env), token + 'renewed')
  } finally {
    for (const [name, value] of Object.entries({WE_DELIVERY_CREDENTIALS_PROJECT:original.local,SUPABASE_ACCESS_TOKEN:original.token,SUPABASE_PROJECT_REF:original.ref})) {
      if(value === undefined) delete process.env[name]; else process.env[name] = value
    }
    const file = credentialPath(env)
    if(fs.existsSync(file)) fs.unlinkSync(file)
    for(const dir of [path.dirname(file),path.dirname(path.dirname(file)),root]) if(fs.existsSync(dir)) fs.rmdirSync(dir)
  }
})

test('unsupported keys do not read local credential files', () => {
  assert.equal(localSupabaseValue('UNRELATED_KEY', {LOCALAPPDATA:'nonexistent'}), undefined)
})

test('credential CLI accepts UTF-8 BOM from a real PowerShell pipeline', { skip: process.platform !== 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'we-delivery-credential-pipeline-'))
  const env = { ...process.env, WE_DELIVERY_CREDENTIALS_PROJECT: root }
  const token = 'sbp_synthetic_pipeline_only_1234567890'
  const payload = JSON.stringify({accessToken:token,projectRef:'iqacuakyyzhrsrjzlnai'})
  const quote = value => "'" + value.replaceAll("'", "''") + "'"
  const command = "$OutputEncoding = [System.Text.UTF8Encoding]::new($false); ([char]0xFEFF + " + quote(payload) + ") | & " + quote(process.execPath) + " " + quote(path.resolve('scripts/store-supabase-credentials.js')) + "; exit $LASTEXITCODE"
  try {
    const { spawnSync } = require('node:child_process')
    const result = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{env,encoding:'utf8',windowsHide:true})
    assert.equal(result.status,0,'PowerShell pipeline should succeed')
    const output = JSON.parse(result.stdout.replace(/^\uFEFF/,'').trim())
    assert.equal(output.stored,true)
    assert.equal(result.stdout.includes(token),false)
    assert.equal(localSupabaseValue('SUPABASE_ACCESS_TOKEN',env),token)
    assert.equal(fs.readFileSync(credentialPath(env),'utf8').includes(token),false)
  } finally {
    const file = credentialPath(env)
    if(fs.existsSync(file))fs.unlinkSync(file)
    for(const dir of [path.dirname(file),path.dirname(path.dirname(file)),root])if(fs.existsSync(dir))fs.rmdirSync(dir)
  }
})
