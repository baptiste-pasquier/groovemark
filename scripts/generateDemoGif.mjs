import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'

const { GIFEncoder, applyPalette, quantize } = gifenc

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const frameDir = path.join(rootDir, 'test-results', 'demo-frames')
const outputPath = path.join(rootDir, 'docs', 'demo.gif')
const defaultFrameDelay = 1200
const finalFrameDelay = 1800
const paletteFormat = 'rgb565'

async function main() {
  await rm(frameDir, { force: true, recursive: true })

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(command, ['playwright', 'test', 'e2e/demo.spec.ts', '--project=demo'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PLAYWRIGHT_DEMO_FRAME_DIR: frameDir,
    },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  const frameNames = (await readdir(frameDir))
    .filter((fileName) => fileName.endsWith('.png'))
    .sort((left, right) => left.localeCompare(right))

  if (frameNames.length === 0) {
    throw new Error(`No demo frames were generated in ${frameDir}`)
  }

  const gif = GIFEncoder()

  for (const [index, frameName] of frameNames.entries()) {
    const framePath = path.join(frameDir, frameName)
    const frame = PNG.sync.read(await readFile(framePath))
    const palette = quantize(frame.data, 256, { format: paletteFormat })
    const indexedFrame = applyPalette(frame.data, palette, paletteFormat)

    gif.writeFrame(indexedFrame, frame.width, frame.height, {
      delay: index === frameNames.length - 1 ? finalFrameDelay : defaultFrameDelay,
      palette,
      repeat: 0,
    })
  }

  gif.finish()

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(gif.bytes()))
}

main().catch((error) => {
  console.error('Failed to generate the demo GIF:', error)
  process.exit(1)
})
