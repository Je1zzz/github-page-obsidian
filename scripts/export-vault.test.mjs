import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-bearblog-test-'))
const run = (...args) => execFileSync(process.execPath, ['scripts/export-vault.mjs', ...args], { stdio: 'pipe' })
try {
  await fs.writeFile(path.join(fixture, 'index.md'), '---\npublish: true\n---\n[[public]] [[private]] ![[image.png]]\n')
  await fs.writeFile(path.join(fixture, 'public.md'), '---\npublish: true\ntags: [测试]\n---\nPublic article\n')
  await fs.writeFile(path.join(fixture, 'private.md'), '---\npublish: false\n---\nPRIVATE_SENTINEL\n')
  await fs.writeFile(path.join(fixture, 'draft.md'), '---\npublish: true\ndraft: true\n---\nDRAFT_SENTINEL\n')
  await fs.writeFile(path.join(fixture, 'image.png'), 'test attachment')
  await fs.writeFile(path.join(fixture, 'unused.png'), 'not published')
  run(fixture)
  let manifest = JSON.parse(await fs.readFile('.publish-manifest.json', 'utf8'))
  assert.deepEqual(manifest, ['content/_index.md', 'content/blog/public.md', 'static/media/image.png'])
  const home = await fs.readFile('content/_index.md', 'utf8')
  assert.match(home, /ref "blog\/public.md"/)
  assert.match(home, /siteurl "media\/image.png"/)
  assert.ok(!home.includes('PRIVATE_SENTINEL'))
  // Cancel publication and remove the attachment reference.
  await fs.writeFile(path.join(fixture, 'public.md'), '---\npublish: false\n---\nRemoved\n')
  await fs.writeFile(path.join(fixture, 'index.md'), '---\npublish: true\n---\nHome\n')
  run(fixture)
  manifest = JSON.parse(await fs.readFile('.publish-manifest.json', 'utf8'))
  assert.deepEqual(manifest, ['content/_index.md'])
  assert.equal(await fs.access('content/blog/public.md').then(() => true, () => false), false)
  assert.equal(await fs.access('static/media/image.png').then(() => true, () => false), false)
  console.log('PASS: public/private/draft selection, link conversion, referenced assets and unpublishing.')
} finally {
  run()
  // Remove only the known fixture files from the system temporary directory.
  for (const name of ['index.md', 'public.md', 'private.md', 'draft.md', 'image.png', 'unused.png']) await fs.rm(path.join(fixture, name), { force: true })
  await fs.rmdir(fixture)
}
