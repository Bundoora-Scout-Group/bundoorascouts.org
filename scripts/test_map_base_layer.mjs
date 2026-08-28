import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(scriptDir, '../assets/js/map-base-layer.js'), 'utf8');

function createHarness({ webGL2, vectorFailure = false }) {
  const calls = [];
  const canvas = {
    addEventListener() {},
    removeEventListener() {}
  };
  const maplibreMap = { getCanvas: () => canvas };
  const vectorLayer = {
    addTo(map) {
      calls.push(['vector:add', map._loaded]);
      if (vectorFailure) throw new Error('Vector setup failed');
      return this;
    },
    getMaplibreMap: () => maplibreMap,
    remove() {}
  };
  const map = {
    _loaded: false,
    setMinZoom(value) { calls.push(['map:min', value]); },
    setMaxZoom(value) { calls.push(['map:max', value]); },
    setView(center, zoom) {
      this._loaded = true;
      calls.push(['map:view', center, zoom]);
      return this;
    },
    fire(name, detail) { calls.push(['map:fire', name, detail.kind]); },
    on() {},
    removeLayer() {}
  };

  const window = {
    BundooraMapConfig: {
      vectorStyleUrl: '/assets/map/style.json',
      rasterTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      rasterMaxZoom: 19,
      mapMaxZoom: 20,
      attribution: 'OpenStreetMap contributors'
    },
    location: { href: 'https://bundoorascouts.org/trip/uluru-2026' },
    setTimeout,
    clearTimeout
  };
  const document = {
    hidden: false,
    createElement() {
      return { getContext: () => webGL2 ? {} : null };
    },
    addEventListener() {},
    removeEventListener() {}
  };
  const L = {
    maplibreGL() {
      calls.push(['vector:create']);
      return vectorLayer;
    },
    tileLayer(url, options) {
      calls.push(['raster:create', url, options]);
      return {
        addTo() {
          calls.push(['raster:add']);
          return this;
        }
      };
    }
  };
  const context = vm.createContext({
    Array,
    Boolean,
    Error,
    L,
    Object,
    Promise,
    URL,
    console: { warn() {} },
    document,
    fetch: async () => ({ ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) }),
    window
  });

  vm.runInContext(source, context, { filename: 'map-base-layer.js' });
  return { calls, map, maps: window.BundooraMaps };
}

test('initialises an unloaded Leaflet map before attaching MapLibre', async () => {
  const harness = createHarness({ webGL2: true });
  await harness.maps.addBaseLayer(harness.map);

  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls.slice(0, 5))), [
    ['map:min', 1],
    ['map:max', 20],
    ['map:view', [0, 0], 1],
    ['vector:create'],
    ['vector:add', true]
  ]);
  assert.equal(harness.calls.some((call) => call[0] === 'raster:create'), false);
});

test('overzooms native zoom-19 raster tiles through map zoom 20', async () => {
  const harness = createHarness({ webGL2: false });
  await harness.maps.addBaseLayer(harness.map);

  const rasterCall = harness.calls.find((call) => call[0] === 'raster:create');
  assert.equal(rasterCall[2].maxNativeZoom, 19);
  assert.equal(rasterCall[2].maxZoom, 20);
});

test('uses the same raster overzoom settings when vector setup fails', async () => {
  const harness = createHarness({ webGL2: true, vectorFailure: true });
  await harness.maps.addBaseLayer(harness.map);

  const rasterCall = harness.calls.find((call) => call[0] === 'raster:create');
  assert.equal(rasterCall[2].maxNativeZoom, 19);
  assert.equal(rasterCall[2].maxZoom, 20);
});
