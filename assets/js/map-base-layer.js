(function () {
  'use strict';

  var CONTEXT_RESTORE_GRACE_MS = 2000;
  var webGL2Supported;

  function supportsWebGL2() {
    if (webGL2Supported !== undefined) return webGL2Supported;

    try {
      webGL2Supported = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch (error) {
      webGL2Supported = false;
    }

    return webGL2Supported;
  }

  function getConfig(options) {
    return Object.assign({}, window.BundooraMapConfig || {}, options || {});
  }

  function loadVectorStyle(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) {
        throw new Error('Map style request failed with status ' + response.status);
      }
      return response.json();
    }).then(function (style) {
      if (typeof style.sprite === 'string') {
        style.sprite = new URL(style.sprite, window.location.href).href;
      } else if (Array.isArray(style.sprite)) {
        style.sprite = style.sprite.map(function (sprite) {
          return Object.assign({}, sprite, {
            url: new URL(sprite.url, window.location.href).href
          });
        });
      }
      return style;
    });
  }

  function createRasterLayer(map, config) {
    var layer = L.tileLayer(config.rasterTileUrl, {
      attribution: config.attribution,
      maxZoom: config.mapMaxZoom,
      maxNativeZoom: config.rasterMaxZoom
    }).addTo(map);

    map._bundooraBaseLayer = layer;
    map.fire('baselayerready', { kind: 'raster', layer: layer });
    return layer;
  }

  function monitorWebGLContext(map, layer, config) {
    var maplibreMap = layer.getMaplibreMap();
    var canvas = maplibreMap.getCanvas();
    var fallbackTimer;
    var contextLost = false;
    var usingVector = true;

    function clearFallbackTimer() {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }

    function swapToRaster() {
      clearFallbackTimer();
      if (!usingVector || !map._loaded) return;

      usingVector = false;
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      try {
        map.removeLayer(layer);
      } catch (error) {
        // The failed WebGL layer may already have detached itself.
      }

      createRasterLayer(map, config);
    }

    function scheduleFallback() {
      clearFallbackTimer();
      if (!usingVector || document.hidden) return;
      fallbackTimer = window.setTimeout(swapToRaster, CONTEXT_RESTORE_GRACE_MS);
    }

    function handleContextLost(event) {
      event.preventDefault();
      contextLost = true;
      scheduleFallback();
    }

    function handleContextRestored() {
      contextLost = false;
      clearFallbackTimer();
    }

    function handleVisibilityChange() {
      if (contextLost) {
        scheduleFallback();
      } else {
        clearFallbackTimer();
      }
    }

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    map.on('unload', function () {
      usingVector = false;
      clearFallbackTimer();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  }

  function createVectorLayer(map, config) {
    return loadVectorStyle(config.vectorStyleUrl).then(function (style) {
      var layer = L.maplibreGL({
        style: style,
        localIdeographFontFamily: 'sans-serif'
      });

      try {
        layer.addTo(map);
        monitorWebGLContext(map, layer, config);
      } catch (error) {
        try {
          layer.remove();
        } catch (removeError) {
          // The layer may not have finished attaching to the map.
        }
        throw error;
      }

      map._bundooraBaseLayer = layer;
      map.fire('baselayerready', { kind: 'vector', layer: layer });
      return layer;
    });
  }

  function addBaseLayer(map, options) {
    var config = getConfig(options);

    if (!map || typeof L === 'undefined') {
      return Promise.reject(new Error('Leaflet is not available'));
    }

    map.setMinZoom(1);
    map.setMaxZoom(config.mapMaxZoom);
    if (!map._loaded) {
      map.setView([0, 0], 1, { animate: false });
    }

    if (!supportsWebGL2() || typeof L.maplibreGL !== 'function') {
      return Promise.resolve(createRasterLayer(map, config));
    }

    return createVectorLayer(map, config).catch(function (error) {
      console.warn('Vector base map unavailable; using the raster fallback.', error);
      return createRasterLayer(map, config);
    });
  }

  window.BundooraMaps = Object.freeze({
    addBaseLayer: addBaseLayer,
    supportsWebGL2: supportsWebGL2
  });
})();
