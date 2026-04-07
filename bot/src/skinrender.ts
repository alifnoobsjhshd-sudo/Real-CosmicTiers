import Jimp from 'jimp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKIN_PATH = join(__dir, '..', 'default-skin.png');

const SCALE = 8;

function px(n: number): number { return n * SCALE; }

type SkinRegion = { x: number; y: number; w: number; h: number };

const REGIONS = {
  headFront: { x: 8,  y: 8,  w: 8, h: 8  },
  hatFront:  { x: 40, y: 8,  w: 8, h: 8  },
  bodyFront: { x: 20, y: 20, w: 8, h: 12 },
  bodyOver:  { x: 20, y: 36, w: 8, h: 12 },
  rArmFront: { x: 44, y: 20, w: 4, h: 12 },
  rArmOver:  { x: 44, y: 36, w: 4, h: 12 },
  lArmFront: { x: 36, y: 52, w: 4, h: 12 },
  lArmOver:  { x: 52, y: 52, w: 4, h: 12 },
} satisfies Record<string, SkinRegion>;

function extract(skin: Jimp, r: SkinRegion): Jimp {
  return skin.clone().crop(r.x, r.y, r.w, r.h)
    .resize(px(r.w), px(r.h), Jimp.RESIZE_NEAREST_NEIGHBOR);
}

function hasPixels(img: Jimp): boolean {
  let found = false;
  img.scan(0, 0, img.getWidth(), img.getHeight(), (_x, _y, idx) => {
    if (!found && img.bitmap.data[idx + 3] > 10) found = true;
  });
  return found;
}

async function loadSkin(input: Buffer | string | null): Promise<Jimp> {
  if (input === null) return Jimp.read(DEFAULT_SKIN_PATH);
  try {
    if (Buffer.isBuffer(input)) return Jimp.read(input);
    return Jimp.read(input as string);
  } catch {
    return Jimp.read(DEFAULT_SKIN_PATH);
  }
}

function normalizeTo64(skin: Jimp): Jimp {
  if (skin.getHeight() >= 64) return skin;
  const expanded = new Jimp(64, 64, 0x00000000);
  expanded.blit(skin, 0, 0);
  const rArm = skin.clone().crop(44, 20, 4, 12).flip(true, false);
  expanded.blit(rArm, 36, 52);
  return expanded;
}

export type RenderType = 'head' | 'bust' | 'body';

export async function renderMinecraftSkin(
  skinInput: Buffer | string | null,
  type: RenderType = 'head',
): Promise<Buffer> {
  let skin: Jimp;
  try {
    skin = await loadSkin(skinInput);
  } catch {
    try {
      skin = await Jimp.read(DEFAULT_SKIN_PATH);
    } catch {
      throw new Error('Could not load skin or default skin file');
    }
  }
  skin = normalizeTo64(skin);
  return buildHead(skin);
}

async function buildHead(skin: Jimp): Promise<Buffer> {
  const head = extract(skin, REGIONS.headFront);
  const hat  = extract(skin, REGIONS.hatFront);

  const W = px(8);
  const H = px(8);
  const out = new Jimp(W, H, 0x00000000);

  out.blit(head, 0, 0);
  if (hasPixels(hat)) out.blit(hat, 0, 0);

  return out.getBufferAsync(Jimp.MIME_PNG);
}
