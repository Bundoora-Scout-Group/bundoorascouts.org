import { createHash } from 'node:crypto';
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { colorful } from '@versatiles/style';
import { extract } from 'tar';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const assetRoot = path.join(rootDir, 'assets');
const mapOutputDir = path.join(assetRoot, 'map');
const vendorOutputDir = path.join(assetRoot, 'vendor');
const cacheDir = path.join(rootDir, '.map-assets');

const tileJsonUrl = 'https://vector.openstreetmap.org/shortbread_v1/tilejson.json';
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const mapAssetPath = '/assets/map';
const archives = {
  fonts: {
    url: 'https://github.com/versatiles-org/versatiles-fonts/releases/download/v2.2.0/noto_sans.tar.gz',
    sha256: 'a2dac39f4096722bc420367ffd4a36687cce7229e8aa760bc12cf657072eea6b'
  },
  sprites: {
    url: 'https://github.com/versatiles-org/versatiles-style/releases/download/v5.13.1/sprites.tar.gz',
    sha256: 'efffd0ee4cb9591bd52f16ff5b269d9618c7dd1db159cd6511943965560ddea5'
  }
};

const localIdeographBlocks = [
  [0x2e80, 0x9fff],
  [0xac00, 0xd7ff],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f]
];
const boldFont = 'noto_sans_bold';
const boldMaxCodepoint = 0x04ff;
const boldTextField = '{ref}';
const tileJsonFields = [
  'tiles',
  'attribution',
  'bounds',
  'minzoom',
  'maxzoom',
  'scheme'
];

function assertGeneratedTarget(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(assetRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to replace generated assets outside ${assetRoot}: ${resolved}`);
  }
}

async function resetGeneratedDirectory(target) {
  assertGeneratedTarget(target);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function cachedArchive(name, details) {
  await mkdir(cacheDir, { recursive: true });
  const destination = path.join(cacheDir, `${name}.tar.gz`);

  try {
    const cached = await readFile(destination);
    if (sha256(cached) === details.sha256) return destination;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(details.url);
  if (!response.ok) {
    throw new Error(`Unable to download ${name} map assets: ${response.status} ${response.statusText}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const digest = sha256(body);
  if (digest !== details.sha256) {
    throw new Error(`Digest mismatch for ${name} map assets: expected ${details.sha256}, got ${digest}`);
  }

  const temporary = `${destination}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, destination);
  return destination;
}

function glyphRange(entryPath) {
  const normalized = entryPath.replaceAll('\\', '/').replace(/^\.\//, '');
  const match = /^(?<font>[^/]+)\/(?<start>\d+)-(?<end>\d+)\.pbf$/.exec(normalized);
  if (!match) return undefined;

  return {
    font: match.groups.font,
    start: Number(match.groups.start),
    end: Number(match.groups.end)
  };
}

function keepGlyph(entryPath) {
  const range = glyphRange(entryPath);
  if (!range) return false;

  if (range.font === boldFont && range.start > boldMaxCodepoint) return false;

  return !localIdeographBlocks.some(function (block) {
    return range.start >= block[0] && range.end <= block[1];
  });
}

function keepSprite(entryPath) {
  return /^basics\/sprites(@2x)?\.(json|png)$/.test(entryPath.replaceAll('\\', '/'));
}

function assertBoldStaysOnRoadReferences(style) {
  const offenders = style.layers.filter(function (layer) {
    const fonts = layer.layout?.['text-font'];
    const textField = layer.layout?.['text-field'];
    return Array.isArray(fonts) && fonts.includes(boldFont) && textField !== boldTextField;
  });

  if (offenders.length) {
    throw new Error(`Bold glyph pruning is unsafe for layers: ${offenders.map((layer) => layer.id).join(', ')}`);
  }
}

function useTileJson(style) {
  const sources = Object.values(style.sources);
  if (sources.length !== 1) {
    throw new Error(`Expected exactly one vector source in the map style, found ${sources.length}`);
  }

  const source = sources[0];
  tileJsonFields.forEach(function (field) {
    delete source[field];
  });
  source.url = tileJsonUrl;
  source.attribution = osmAttribution;
  return style;
}

async function copyBrowserScript(source, destination) {
  const script = await readFile(source, 'utf8');
  await writeFile(destination, script.replace(/\n\/\/# sourceMappingURL=[^\n]+\s*$/, '\n'));
}

async function copyVendorAssets() {
  const leafletOutput = path.join(vendorOutputDir, 'leaflet');
  const maplibreOutput = path.join(vendorOutputDir, 'maplibre');
  await Promise.all([
    resetGeneratedDirectory(leafletOutput),
    resetGeneratedDirectory(maplibreOutput)
  ]);

  await Promise.all([
    copyBrowserScript(path.join(rootDir, 'node_modules/leaflet/dist/leaflet.js'), path.join(leafletOutput, 'leaflet.js')),
    copyFile(path.join(rootDir, 'node_modules/leaflet/dist/leaflet.css'), path.join(leafletOutput, 'leaflet.css')),
    cp(path.join(rootDir, 'node_modules/leaflet/dist/images'), path.join(leafletOutput, 'images'), { recursive: true }),
    copyFile(path.join(rootDir, 'node_modules/leaflet/LICENSE'), path.join(leafletOutput, 'LICENSE.txt')),
    copyBrowserScript(path.join(rootDir, 'node_modules/maplibre-gl/dist/maplibre-gl.js'), path.join(maplibreOutput, 'maplibre-gl.js')),
    copyFile(path.join(rootDir, 'node_modules/maplibre-gl/dist/maplibre-gl.css'), path.join(maplibreOutput, 'maplibre-gl.css')),
    copyFile(path.join(rootDir, 'node_modules/maplibre-gl/dist/LICENSE.txt'), path.join(maplibreOutput, 'MAPLIBRE-LICENSE.txt')),
    copyFile(path.join(rootDir, 'node_modules/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js'), path.join(maplibreOutput, 'leaflet-maplibre-gl.js')),
    copyFile(path.join(rootDir, 'node_modules/@maplibre/maplibre-gl-leaflet/LICENSE'), path.join(maplibreOutput, 'LEAFLET-ADAPTER-LICENSE.txt'))
  ]);
}

async function buildMapAssets() {
  const [fontArchive, spriteArchive] = await Promise.all([
    cachedArchive('fonts', archives.fonts),
    cachedArchive('sprites', archives.sprites)
  ]);

  await resetGeneratedDirectory(mapOutputDir);
  await Promise.all([
    mkdir(path.join(mapOutputDir, 'fonts'), { recursive: true }),
    mkdir(path.join(mapOutputDir, 'sprites'), { recursive: true })
  ]);

  await Promise.all([
    extract({ file: fontArchive, cwd: path.join(mapOutputDir, 'fonts'), filter: keepGlyph }),
    extract({ file: spriteArchive, cwd: path.join(mapOutputDir, 'sprites'), filter: keepSprite })
  ]);

  const style = useTileJson(colorful({
    baseUrl: '',
    glyphs: `${mapAssetPath}/fonts/{fontstack}/{range}.pbf`,
    sprite: [{ id: 'basics', url: `${mapAssetPath}/sprites/basics/sprites` }]
  }));
  assertBoldStaysOnRoadReferences(style);

  await Promise.all([
    writeFile(path.join(mapOutputDir, 'style.json'), `${JSON.stringify(style)}\n`),
    copyFile(path.join(rootDir, 'scripts/licenses/Noto-Sans-OFL.txt'), path.join(mapOutputDir, 'NOTO-SANS-OFL.txt')),
    copyFile(path.join(rootDir, 'node_modules/@versatiles/style/LICENSE.md'), path.join(mapOutputDir, 'VERSATILES-STYLE-LICENSE.md')),
    writeFile(path.join(mapOutputDir, 'README.txt'), [
      'Generated by npm run build:maps.',
      'Cartography and sprites: VersaTiles style v5.13.1.',
      'Glyphs: Noto Sans v2.2.0 (SIL Open Font License 1.1).',
      'Vector tiles: OpenStreetMap Shortbread via its TileJSON endpoint.',
      'Map data: (c) OpenStreetMap contributors.',
      ''
    ].join('\n')),
    copyVendorAssets()
  ]);
}

await buildMapAssets();
console.log('Built self-hosted map renderer and style assets.');
