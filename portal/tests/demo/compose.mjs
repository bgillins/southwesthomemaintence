// ------- Turn the raw screen recording into a captioned mp4 -------
// Left: the phone screen, exactly as recorded. Right: the caption for each step,
// timed from timeline.json. Needs ffmpeg on the PATH.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const textDir = join(out, 'captions');
mkdirSync(textDir, { recursive: true });

// ------- Find the newest raw recording -------
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const video = walk(join(out, 'raw')).filter((file) => file.endsWith('.webm')).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!video) throw new Error('No recording found. Run: npx playwright test -c playwright.demo.config.ts');
const { length, captions } = JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8'));

// ------- Fonts -------
const fontDirs = ['/usr/share/fonts/truetype/liberation', '/usr/share/fonts/liberation', '/System/Library/Fonts/Supplemental', '/Library/Fonts'];
const findFont = (names) => fontDirs.flatMap((dir) => names.map((name) => join(dir, name))).find(existsSync);
const regular = findFont(['LiberationSans-Regular.ttf', 'Arial.ttf']);
const bold = findFont(['LiberationSans-Bold.ttf', 'Arial Bold.ttf']);
if (!regular || !bold) throw new Error('Could not find a font for the captions (Liberation Sans or Arial).');

// ------- Layout (1920 x 1080) -------
const NAVY = '0x06243a';
const CREAM = '0xf7f3e8';
const OLIVE = '0x47640a';
const MUTED = '0x3f5566';
// The page on the phone is 390 x 664. Shown at 1.5x, which fills the frame's height.
const PAGE = { width: 390, height: 664 };
const phone = { x: 110, y: 42, width: 584, height: 996 };
const panelX = 800;

const wrap = (text, width) => {
  const lines = [''];
  for (const word of text.split(' ')) {
    if ((lines[lines.length - 1] + ' ' + word).trim().length > width) lines.push(word);
    else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + word).trim();
  }
  return lines.join('\n');
};
// The recording starts a moment before the script's clock does.
const LEAD = 0.35;
const file = (name, text) => {
  const path = join(textDir, name);
  writeFileSync(path, text);
  return path;
};
const draw = (path, font, size, color, x, y, from, to, extra = '') =>
  `drawtext=fontfile='${font}':textfile='${path}':fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}:line_spacing=${Math.round(size * 0.35)}${extra}:enable='between(t,${from.toFixed(2)},${to.toFixed(2)})'`;

const filters = [];
captions.forEach((caption, index) => {
  const from = index === 0 ? 0 : caption.at + LEAD;
  const to = index === captions.length - 1 ? length + 5 : captions[index + 1].at + LEAD;
  const title = wrap(caption.title, 28);
  const titleLines = title.split('\n').length;
  filters.push(draw(file(`step-${index}.txt`, `STEP ${index + 1} OF ${captions.length}`), bold, 26, OLIVE, panelX, 330, from, to));
  filters.push(draw(file(`title-${index}.txt`, title), bold, 62, NAVY, panelX, 380, from, to));
  filters.push(draw(file(`body-${index}.txt`, wrap(caption.body, 48)), regular, 38, MUTED, panelX, 380 + titleLines * 84 + 30, from, to));
});
filters.push(draw(file('footer.txt', 'Recorded from the running app, on a phone-sized screen.\nAll names, addresses and photos are test data.'), regular, 26, MUTED, panelX, 950, 0, length + 5));

const graph = [
  `color=c=${CREAM}:s=1920x1080:r=30[bg]`,
  // crop is a no-op when the recording is already exactly the page size.
  `[0:v]fps=30,crop=${PAGE.width}:${PAGE.height}:0:0,scale=${phone.width}:${phone.height}:flags=lanczos[phone]`,
  `[1:v]scale=420:-1[logo]`,
  // A dark frame behind the recording, like a phone bezel.
  `[bg]drawbox=x=${phone.x - 14}:y=${phone.y - 14}:w=${phone.width + 28}:h=${phone.height + 28}:color=${NAVY}:t=fill[framed]`,
  `[framed][phone]overlay=${phone.x}:${phone.y}:shortest=1[withphone]`,
  `[withphone][logo]overlay=${panelX}:90[withlogo]`,
  `[withlogo]${filters.join(',')}[final]`,
].join(';');

const target = join(out, 'southwest-portal-walkthrough.mp4');
const result = spawnSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-i', video, '-i', join(here, '..', '..', 'public', 'logo.png'), '-filter_complex', graph, '-map', '[final]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target],
  { stdio: 'inherit' },
);
if (result.status !== 0) throw new Error('ffmpeg failed');
console.log(`Wrote ${target} (${(statSync(target).size / 1e6).toFixed(1)} MB, ${Math.round(length)} seconds, ${captions.length} captioned steps)`);
