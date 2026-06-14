// One-off art generation for DearMama onboarding screens.
// Reads OPENAI_API_KEY from .env (never printed) and writes PNGs to assets/images/onboarding.
// Usage: node scripts/gen-images.mjs [key1 key2 ...]   (no args = generate all)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'images', 'onboarding');
mkdirSync(outDir, { recursive: true });

function readKey() {
  const env = readFileSync(join(root, '.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('OPENAI_API_KEY='));
  if (!line) throw new Error('OPENAI_API_KEY not found in .env');
  return line.slice('OPENAI_API_KEY='.length).trim();
}

// Shared art direction so every image feels like one set.
const STYLE =
  'Soft, calm, modern flat illustration in an "organic biophilic" wellness style. ' +
  'Muted sage green (#6B9080) as the hero color with warm cream (#FBF7F2) background, ' +
  'gentle dusty-rose and soft clay accents. Smooth rounded organic shapes, subtle grain, ' +
  'soft gradients, no harsh lines, no text, no words, no letters, generous negative space, ' +
  'centered composition, tender and reassuring mood for an expecting mother. ' +
  'Editorial vector look, not 3D, not photographic.';

const PROMPTS = {
  welcome:
    'A serene abstract scene symbolizing the start of a pregnancy journey: a softly glowing ' +
    'crescent/womb-like organic shape cradling a small sprouting leaf, surrounded by floating ' +
    'rounded petals and gentle light. Warm and hopeful. ' + STYLE,
  profile:
    'A gentle abstract portrait motif: a simple rounded silhouette of a woman in profile made of ' +
    'overlapping organic shapes and leaves, calm and welcoming. ' + STYLE,
  pregnancy:
    'A tender abstract motif of a pregnant belly formed by smooth concentric organic curves with a ' +
    'tiny seed/sprout glowing at the center, soft radiating lines suggesting weeks of growth. ' + STYLE,
  medical:
    'A calm abstract wellness motif: a soft heart shape merged with a leaf and a gentle pulse line ' +
    'flowing into foliage, suggesting health and care, no medical clutter. ' + STYLE,
  contacts:
    'A warm abstract motif of two overlapping rounded organic shapes holding/supporting each other, ' +
    'like a circle of care and connection, with small leaves. ' + STYLE,
  review:
    'A peaceful abstract motif of a softly glowing organic orb/seed resting in cupped leaf-like hands, ' +
    'symbolizing a completed, cherished journey ready to begin. ' + STYLE,

  // Reward / milestone art — a single delicate flowering plant shown at progressive
  // bloom stages, so completing each step visibly "grows" the journey. Celebratory glow.
  reward1:
    'A celebratory abstract motif of a tiny sprouting seedling with two small tender leaves ' +
    'emerging from a soft mound, a gentle glow and a few floating sparkles and petals around it, ' +
    'joyful and encouraging, the very first stage of growth. ' + STYLE,
  reward2:
    'A celebratory abstract motif of a young plant with a single closed flower bud on a slender stem ' +
    'with a couple of leaves, soft radiant glow and a few floating petals and sparkles, ' +
    'hopeful and encouraging, an early bloom stage. ' + STYLE,
  reward3:
    'A celebratory abstract motif of a plant with one half-open blossom beginning to unfurl its petals ' +
    'on a slender stem with leaves, warm radiant glow with floating petals and sparkles, ' +
    'uplifting and rewarding, a mid bloom stage. ' + STYLE,
  reward4:
    'A celebratory abstract motif of a single fully open, beautiful blossom on a slender stem with leaves, ' +
    'glowing warmly with floating petals and gentle sparkles around it, ' +
    'proud and rewarding, full bloom stage. ' + STYLE,
  rewardFinale:
    'A joyful celebratory abstract motif of a lush, radiant flower in full bloom haloed by soft light, ' +
    'surrounded by gently floating petals, leaves and twinkling sparkles like a quiet celebration, ' +
    'warm, triumphant and tender, the journey beautifully complete. ' + STYLE,
  rewardBaby:
    'A tender, loving motif of a peaceful swaddled sleeping newborn baby with eyes gently closed, ' +
    'cradled in soft, cupped leaf-like hands, surrounded by a gentle warm glow and a few floating ' +
    'hearts and sparkles, deeply soothing and celebratory. Cute simple rounded baby face, no text. ' + STYLE,
};

async function gen(key, name, prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
      background: 'transparent',
      n: 1,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error?.message ?? text; } catch {}
    throw new Error(`[${name}] HTTP ${res.status}: ${msg.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`[${name}] no image data in response`);
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`ok ${name} -> ${file}`);
}

const key = readKey();
const which = process.argv.slice(2);
const names = which.length ? which : Object.keys(PROMPTS);
for (const name of names) {
  if (!PROMPTS[name]) { console.error(`unknown: ${name}`); continue; }
  try {
    await gen(key, name, PROMPTS[name]);
  } catch (e) {
    console.error(String(e.message || e));
    process.exitCode = 1;
  }
}
