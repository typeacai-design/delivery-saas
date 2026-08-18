import fs from 'node:fs'
import path from 'node:path'

const roots = ['src']
const extensions = new Set(['.ts', '.tsx', '.css'])
const cp1252 = new Map([
  ['€', 0x80], ['‚', 0x82], ['ƒ', 0x83], ['„', 0x84], ['…', 0x85], ['†', 0x86], ['‡', 0x87],
  ['ˆ', 0x88], ['‰', 0x89], ['Š', 0x8a], ['‹', 0x8b], ['Œ', 0x8c], ['Ž', 0x8e], ['‘', 0x91],
  ['’', 0x92], ['“', 0x93], ['”', 0x94], ['•', 0x95], ['–', 0x96], ['—', 0x97], ['˜', 0x98],
  ['™', 0x99], ['š', 0x9a], ['›', 0x9b], ['œ', 0x9c], ['ž', 0x9e], ['Ÿ', 0x9f],
])

function repairRun(run) {
  const bytes = []
  for (const char of run) {
    const code = char.codePointAt(0)
    const byte = cp1252.get(char) ?? (code <= 0xff ? code : undefined)
    if (byte === undefined) return run
    bytes.push(byte)
  }
  const decoded = Buffer.from(bytes).toString('utf8')
  return decoded.includes('\uFFFD') ? run : decoded
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filename)
    else if (extensions.has(path.extname(entry.name))) {
      const source = fs.readFileSync(filename, 'utf8')
      let repaired = source
      for (let pass = 0; pass < 2; pass += 1) {
        repaired = repaired.replace(/[\u0080-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]{2,}/g, repairRun)
      }
      if (repaired !== source) fs.writeFileSync(filename, repaired, 'utf8')
    }
  }
}

for (const root of roots) walk(root)
