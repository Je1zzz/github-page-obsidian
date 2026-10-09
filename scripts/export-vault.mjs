import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vault = path.resolve(process.argv[2] || path.join(site, '..', 'github_page_obsidian'))
const manifest = path.join(site, '.publish-manifest.json')
const files = []
async function walk(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.isSymbolicLink()) continue
    const full = path.join(dir, item.name)
    if (item.isDirectory()) await walk(full)
    else if (item.isFile()) files.push(path.relative(vault, full).replaceAll('\\', '/'))
  }
}
await walk(vault)
const published = new Map()
const outputs = new Map()
const notes = files.filter(f => f.endsWith('.md'))
for (const file of notes) {
  const text = await fs.readFile(path.join(vault, file), 'utf8')
  const match = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const meta = match ? YAML.parse(match[1]) : {}
  if (meta?.publish === true && meta?.draft !== true) {
    const dest = file === 'index.md' ? '_index.md' : 'blog/' + file
    published.set(file, { meta, body: text.slice(match[0].length), dest })
  }
}
if (!published.has('index.md')) throw new Error('首页 index.md 需要设置 publish: true。')

function resolve(ref, from, pool) {
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(from), ref))
  for (const exact of [relative, ref]) if (pool.includes(exact)) return exact
  const suffix = pool.filter(f => f.endsWith('/' + ref))
  if (suffix.length === 1) return suffix[0]
  if (suffix.length > 1) throw new Error(`链接目标不唯一：${from} -> ${ref}`)
  return null
}
function link(raw, label, embed, from) {
  const [refPart, anchor] = raw.split('#', 2)
  const ref = decodeURIComponent(refPart)
  const escapedLabel = label.replaceAll('[', '\\[').replaceAll(']', '\\]')
  if (ref === 'tags' || ref.startsWith('tags/')) {
    return `[${escapedLabel}]({{< siteurl ${JSON.stringify(ref + '/')} >}})`
  }
  const note = resolve(ref.endsWith('.md') ? ref : ref + '.md', from, notes)
  if (note) {
    if (!published.has(note)) return escapedLabel
    if (embed) throw new Error(`暂不支持嵌入笔记正文，请改为普通链接：${from} -> ${raw}`)
    const fragment = anchor ? '#' + anchor.toLowerCase().replaceAll(' ', '-') : ''
    return `[${escapedLabel}]({{< ref ${JSON.stringify(published.get(note).dest + fragment)} >}})`
  }
  const attachment = resolve(ref, from, files.filter(f => !f.endsWith('.md')))
  if (!attachment) throw new Error(`找不到本地链接目标：${from} -> ${raw}`)
  outputs.set('static/media/' + attachment, { source: attachment })
  const prefix = embed && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(attachment) ? '!' : ''
  return `${prefix}[${escapedLabel}]({{< siteurl ${JSON.stringify('media/' + attachment)} >}})`
}

for (const [file, { meta, body, dest }] of published) {
  if (file !== 'index.md') meta.type = 'blog'
  if (!meta.title) meta.title = path.posix.basename(file, '.md')
  if (file !== 'index.md' && !meta.date) {
    const stat = await fs.stat(path.join(vault, file))
    meta.date = stat.birthtime.toISOString()
  }
  // Keep code samples unchanged; convert links only in prose.
  const rewritten = body.split(/(```[^\n]*\n[\s\S]*?\n```|~~~[^\n]*\n[\s\S]*?\n~~~|`[^`\n]+`)/g).map((part, i) => {
    if (i % 2) return part
    const markdown = part.replace(/(!?)\[([^\]\n]*)\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g, (all, bang, label, ref) => {
      if (/^[a-z]+:|^#|^\/\//i.test(ref)) return all
      return link(ref.replace(/^\//, ''), label, bang === '!', file)
    })
    return markdown.replace(/(!?)\[\[([^\]\n]+)\]\]/g, (_all, bang, value) => {
      const [ref, alias] = value.split('|', 2)
      const label = alias && !/^\d+(?:x\d+)?$/.test(alias) ? alias : path.posix.basename(ref.replace(/\.md$/, ''))
      return link(ref, label, bang === '!', file)
    })
  }).join('')
  outputs.set('content/' + dest, { text: '---\n' + YAML.stringify(meta) + '---\n' + rewritten })
}
function target(file) {
  const full = path.resolve(site, file)
  if (!full.startsWith(path.join(site, 'content') + path.sep) && !full.startsWith(path.join(site, 'static', 'media') + path.sep)) throw new Error('无效的发布路径：' + file)
  return full
}
const previous = JSON.parse(await fs.readFile(manifest, 'utf8').catch(() => '[]'))
for (const file of previous) if (!outputs.has(file)) await fs.rm(target(file), { force: true })
for (const [file, value] of outputs) {
  const output = target(file)
  await fs.mkdir(path.dirname(output), { recursive: true })
  if (value.source) await fs.copyFile(path.join(vault, value.source), output)
  else await fs.writeFile(output, value.text)
}
await fs.writeFile(manifest, JSON.stringify([...outputs.keys()].sort(), null, 2) + '\n')
console.log(`已导出 ${published.size} 篇公开笔记、${outputs.size - published.size} 个引用附件。`)
