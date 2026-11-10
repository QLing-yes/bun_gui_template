// 全端图标圆角后处理：tauri icon 重生成后运行；半径=尺寸×7/32（32px 档恰 7px）
// 覆盖主图 app-icon.png、icons/ 桌面族与 ico/icns、android mipmap、ios AppIcon、src-bun/public/icon.png
// 依赖 sharp（行业标准图像处理）+ png-to-ico（在更）；ICNS 无在更 npm 包 → 按 Apple 稳定规格手写容器
// 运行：bun scripts/round_icons.ts

import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"
import pngToIco from "png-to-ico"

const ROOT = join(import.meta.dirname, "..")
/** 圆角半径比例：32px 档恰 7px */
const RATIO = 7 / 32

/** 圆角 PNG：矢量圆角掩膜 dest-in（矢量抗锯齿） @param src 源 PNG buffer @param size 目标边长 @returns 圆角 PNG buffer */
async function rounded(src: Buffer, size: number): Promise<Buffer> {
  const r = (size * RATIO).toFixed(3)
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  )
  return sharp(src)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer()
}

/** ICNS 容器（Apple 规格）："icns"+总长 + 序列(type+ chunk 长+PNG) @param entries type 与 PNG 对 @returns icns buffer */
function icns(entries: [string, Buffer][]): Buffer {
  const chunks = entries.map(([type, png]) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, "ascii")
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(8)
  header.write("icns", 0, "ascii")
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

/** 主流程：主图自身圆角后作为各档源（dest-in 整份替换 alpha，重跑幂等） */
async function main(): Promise<void> {
  const icons = join(ROOT, "src-tauri/icons")
  const masterPath = join(ROOT, "src-tauri/app-icon.png")
  const masterSrc = await readFile(masterPath)
  const masterSize = (await sharp(masterSrc).metadata()).width ?? 1024
  const master = await rounded(masterSrc, masterSize)
  await writeFile(masterPath, master)
  /** 按尺寸取圆角档 @param size 边长 @returns PNG buffer */
  const at = (size: number) => rounded(master, size)

  const fixed: Record<string, number> = {
    "icon.png": 512,
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
  }
  for (const [name, size] of Object.entries(fixed))
    await writeFile(join(icons, name), await at(size))
  for (const name of await readdir(icons)) {
    if (!/^Square.*\.png$/.test(name) && name !== "StoreLogo.png") continue
    const size =
      (await sharp(await readFile(join(icons, name))).metadata()).width ?? 128
    await writeFile(join(icons, name), await at(size))
  }
  // android（仅 ic_launcher 族）/ ios 全量：按现存文件尺寸就地重裁
  for (const dir of ["android", "ios"]) {
    /** 递归重裁目录下 PNG @param d 目录路径 */
    const walk = async (d: string): Promise<void> => {
      for (const e of await readdir(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) {
          await walk(p)
          continue
        }
        if (!e.name.endsWith(".png")) continue
        if (dir === "android" && !e.name.startsWith("ic_launcher")) continue
        const size = (await sharp(await readFile(p)).metadata()).width ?? 128
        await writeFile(p, await at(size))
      }
    }
    await walk(join(icons, dir))
  }
  // ico 走在更包；icns 手写容器（type↔尺寸映射为 Apple 规格）
  const icoBufs = await Promise.all(
    [16, 24, 32, 48, 64, 128, 256].map(at)
  )
  await writeFile(join(icons, "icon.ico"), await pngToIco(icoBufs))
  const icnsMap: [string, number][] = [
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
    ["ic11", 32],
    ["ic12", 64],
    ["ic13", 256],
    ["ic14", 512],
  ]
  const entries: [string, Buffer][] = []
  for (const [type, size] of icnsMap) entries.push([type, await at(size)])
  await writeFile(join(icons, "icon.icns"), icns(entries))
  await writeFile(join(ROOT, "src-bun/public/icon.png"), await at(128))
  console.log("rounded icons written (ratio 7/32, all platforms)")
}

await main()