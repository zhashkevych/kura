import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public/marketing');
const MAX_WIDTH = 2400;
const MAX_BYTES = 400 * 1024;

async function main() {
  const files = (await readdir(DIR)).filter((n) => n.endsWith('.png'));
  if (files.length === 0) {
    console.log('No PNGs to optimize in public/marketing/.');
    return;
  }

  for (const name of files) {
    const src = path.join(DIR, name);
    const out = src.replace(/\.png$/, '.webp');
    const { width, height } = await sharp(src)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(out);
    const { size } = await stat(out);
    if (size > MAX_BYTES) {
      throw new Error(`${name}: ${(size / 1024).toFixed(0)}KB exceeds 400KB budget`);
    }
    console.log(
      `${path.basename(out).padEnd(36)} ${width}x${height}  ${(size / 1024).toFixed(0)}KB`,
    );
    await unlink(src);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
