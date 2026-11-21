import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const shirtModelUrl = '/assets/models/polo-shirt.glb';
const cameraViews = {
  front: { position: [0, 0.62, 3.0], target: [0, 0.46, 0] },
  left_sleeve: { position: [2.35, 0.42, 0.68], target: [0.78, 0.26, 0.02] },
  right_sleeve: { position: [-2.35, 0.42, 0.68], target: [-0.78, 0.26, 0.02] }
};

const shirtBase = '#161b32';
const darkTrim = '#172554';
const badgeForward = new THREE.Vector3(0, 0, 1);
const worldUp = new THREE.Vector3(0, 1, 0);
const raycaster = new THREE.Raycaster();
const textureLoader = new THREE.TextureLoader();
const debugQueryMode = new URLSearchParams(window.location.search).has('badgeDebug');
const badgeOffsetMin = 0.018;
const badgeOffsetScale = 0.14;
const badgeOffsetMax = 0.06;
const placementSurfaceOffset = 0.024;
const placementBadgeOffset = 0.006;
const svgTextureSize = 256;

document.querySelectorAll('[data-uniform-viewer]').forEach((viewer) => {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      initViewer(viewer);
    }
  }, { rootMargin: '240px' });

  observer.observe(viewer);
});

async function initViewer(root) {
  const canvas = root.querySelector('[data-uniform-canvas]');
  const status = root.querySelector('[data-uniform-status]');
  const configNode = root.querySelector('[data-uniform-config]');

  if (!canvas || !configNode || !hasWebGL()) {
    root.classList.add('uniform-viewer--unavailable');
    if (status) status.textContent = '3D viewer unavailable. The written placement guide remains below.';
    return;
  }

  let config;
  try {
    config = JSON.parse(configNode.textContent);
  } catch (error) {
    root.classList.add('uniform-viewer--unavailable');
    if (status) status.textContent = '3D viewer configuration could not be loaded.';
    return;
  }

  const state = {
    section: config.sections[0]?.slug || 'joeys',
    view: 'front',
    groups: getGroupsForView(config.badgePlacement, 'front'),
    badgeMeshes: [],
    badgeMeshById: new Map(),
    textureCache: new Map(),
    icons: config.badgeIcons || {},
    oas: config.oas || {},
    sections: config.sections || [],
    debug: null,
    info: null,
    badges: [],
    pinnedBadgeId: null,
    hoveredBadgeId: null,
    targetCamera: cameraViews.front
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const lookTarget = new THREE.Vector3();
  const viewTarget = new THREE.Vector3();

  const uniform = await buildUniform(status, config.badgePlacement);
  scene.add(uniform.group);
  if (uniform.placementSurfaceGroup) scene.add(uniform.placementSurfaceGroup);

  const badgeLayer = new THREE.Group();
  scene.add(badgeLayer);
  const debugLayer = new THREE.Group();
  scene.add(debugLayer);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(2.2, 3.4, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x9ad4ff, 1.1);
  rimLight.position.set(-3, 1.8, -2);
  scene.add(rimLight);

  applySectionColour(uniform, config.sections, state.section);
  await renderBadges(config.badgePlacement, state, badgeLayer, uniform);

  setCamera(camera, lookTarget, state.targetCamera);
  state.info = initBadgeInteractions(root, canvas, camera, state, config.badgePlacement);
  state.info.refresh();
  bindControls(root, state, config, uniform, badgeLayer);
  if (debugQueryMode && config.debugEnabled) {
    initDebugTools(root, canvas, camera, state, config.badgePlacement, uniform, badgeLayer, debugLayer);
  }
  resize();
  status?.classList.add('is-hidden');
  root.classList.add('is-ready');

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root.querySelector('.uniform-viewer__stage'));

  function animate() {
    requestAnimationFrame(animate);

    if (!prefersReducedMotion) {
      uniform.group.rotation.y += (0.025 * Math.sin(performance.now() / 3200) - uniform.group.rotation.y) * 0.015;
    }

    const targetPosition = vectorFromArray(state.targetCamera.position);
    viewTarget.copy(vectorFromArray(state.targetCamera.target));

    if (prefersReducedMotion) {
      camera.position.copy(targetPosition);
      lookTarget.copy(viewTarget);
    } else {
      camera.position.lerp(targetPosition, 0.08);
      lookTarget.lerp(viewTarget, 0.08);
    }

    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
  }

  animate();

  function resize() {
    const stage = root.querySelector('.uniform-viewer__stage');
    const rect = stage.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(420, Math.floor(rect.height));

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function bindControls(root, state, config, uniform, badgeLayer) {
  root.querySelectorAll('[data-uniform-section]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.section = button.dataset.uniformSection;
      setActiveButton(root, '[data-uniform-section]', button);
      applySectionColour(uniform, config.sections, state.section);
      await renderBadges(config.badgePlacement, state, badgeLayer, uniform);
      state.info?.refresh();
      state.debug?.refresh?.();
    });
  });

  root.querySelectorAll('[data-uniform-view]').forEach((button) => {
    button.addEventListener('click', async () => {
      state.view = button.dataset.uniformView;
      state.targetCamera = cameraViews[state.view] || cameraViews.front;
      state.groups = getGroupsForView(config.badgePlacement, state.view);
      setActiveButton(root, '[data-uniform-view]', button);
      await renderBadges(config.badgePlacement, state, badgeLayer, uniform);
      state.info?.refresh();
      state.debug?.refresh?.();
    });
  });
}

function setActiveButton(root, selector, activeButton) {
  root.querySelectorAll(selector).forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-checked', String(isActive));
  });
}

function initBadgeInteractions(root, canvas, camera, state, data) {
  const stage = root.querySelector('.uniform-viewer__stage');
  const status = root.querySelector('[data-uniform-badge-status]');
  const statusText = root.querySelector('[data-uniform-badge-status-text]');
  const statusLink = root.querySelector('[data-uniform-badge-link]');
  const closeButton = root.querySelector('[data-uniform-badge-close]');
  let pointerStart = null;
  let keyboardIndex = -1;
  let statusBadgeId = null;

  if (!stage || !status || !statusText || !statusLink) return { refresh() {} };

  function refresh() {
    keyboardIndex = -1;
    clearStatus();
  }

  function clearStatus() {
    state.pinnedBadgeId = null;
    state.hoveredBadgeId = null;
    statusBadgeId = null;
    status.hidden = true;
    status.classList.remove('is-pinned');
    canvas.style.cursor = '';
    updateBadgeHighlights(state);
  }

  function showStatus(badge, pinned = false) {
    const info = getBadgeStatus(badge, state, data);
    statusText.textContent = info.text;
    setBadgeLink(statusLink, info.url, 'Learn more', info.external);
    statusBadgeId = badge.id;
    status.classList.toggle('is-pinned', pinned);
    status.hidden = false;
  }

  closeButton?.addEventListener('click', () => {
    clearStatus();
    canvas.focus();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const mesh = pickBadgeAtPointer(event, canvas, camera, state.badgeMeshes);
    if (mesh?.userData?.badge) {
      state.hoveredBadgeId = mesh.userData.badgeId;
      canvas.style.cursor = 'pointer';
      if (!state.pinnedBadgeId) showStatus(mesh.userData.badge, false);
      updateBadgeHighlights(state);
    } else {
      state.hoveredBadgeId = null;
      if (!state.pinnedBadgeId) {
        statusBadgeId = null;
        status.hidden = true;
      }
      canvas.style.cursor = '';
      updateBadgeHighlights(state);
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointercancel', () => {
    pointerStart = null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (distance > 10) return;

    const mesh = pickBadgeAtPointer(event, canvas, camera, state.badgeMeshes);
    if (!mesh?.userData?.badgeId) {
      if (state.pinnedBadgeId) clearStatus();
      return;
    }

    if (state.pinnedBadgeId === mesh.userData.badgeId) {
      clearStatus();
      return;
    }

    state.pinnedBadgeId = mesh.userData.badgeId;
    state.hoveredBadgeId = null;
    canvas.style.cursor = '';
    showStatus(mesh.userData.badge, true);
    updateBadgeHighlights(state);
  });

  status.addEventListener('pointerenter', () => {
    state.hoveredBadgeId = null;
    updateBadgeHighlights(state);
  });
  status.addEventListener('pointerleave', () => {
    if (!state.pinnedBadgeId) {
      statusBadgeId = null;
      status.hidden = true;
    }
  });
  stage.addEventListener('pointerleave', () => {
    if (!state.pinnedBadgeId) clearStatus();
  });

  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearStatus();
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (!state.badges.length) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      keyboardIndex = (keyboardIndex + direction + state.badges.length) % state.badges.length;
      const badge = state.badges[keyboardIndex];
      state.pinnedBadgeId = null;
      state.hoveredBadgeId = null;
      showStatus(badge, false);
      updateBadgeHighlights(state);
      return;
    }

    if (event.key === 'Enter' && statusBadgeId) {
      state.pinnedBadgeId = statusBadgeId;
      state.hoveredBadgeId = null;
      status.classList.add('is-pinned');
      updateBadgeHighlights(state);
    }
  });

  return { refresh, clearStatus };
}

function getBadgeStatus(badge, state, data) {
  const links = data.information_links || {};
  const defaultInfo = { text: badge.label, url: null, external: false };

  const oasSkill = getOasSkill(badge, state);
  if (oasSkill) {
    return {
      text: `Outdoor Adventure Skills · ${oasSkill.name}`,
      url: `/sections/${state.section}/outdoor-skills#${slugifyBadgeName(oasSkill.name)}`,
      external: false
    };
  }

  if (/^milestone-[1-3]$/.test(badge.id)) {
    return {
      text: `Program Essentials · ${badge.label}`,
      url: `/sections/${state.section}/milestones`,
      external: false
    };
  }

  if (badge.id === 'sia-cluster') {
    return {
      text: 'Special Interest Areas',
      url: `/sections/${state.section}/special-interests`,
      external: false
    };
  }

  if (badge.id.startsWith('peak-award-')) {
    const awardSectionSlug = badge.id.replace('peak-award-', '');
    const awardSection = state.sections.find((item) => item.slug === awardSectionSlug);
    const awardSectionName = awardSection?.shortname || awardSection?.name || awardSectionSlug;
    return {
      text: `Peak Award · ${badge.label}`,
      url: `/sections/${awardSectionSlug}/peak-award`,
      external: false
    };
  }

  if (badge.id.startsWith('intro-')) {
    return {
      text: `Program Essentials · ${badge.label}`,
      url: links.program_essentials,
      external: true
    };
  }

  if (badge.id.startsWith('years-service-')) {
    return { ...defaultInfo, text: `Years of Service · ${badge.label.replace(' Years of Service', '')}` };
  }

  if (badge.id === 'event-badge') {
    return {
      text: 'Event Badge',
      url: links.event_badges,
      external: true
    };
  }

  return defaultInfo;
}

function setBadgeLink(anchor, url, label, external = false) {
  if (!anchor || !isUsefulBadgeLink(url)) {
    if (anchor) anchor.hidden = true;
    return false;
  }

  anchor.href = url;
  anchor.textContent = external ? `${label} ↗` : label;
  anchor.hidden = false;
  if (external) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  } else {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
  return true;
}

function isUsefulBadgeLink(url) {
  if (!url) return false;

  try {
    const target = new URL(url, window.location.href);
    const current = new URL(window.location.href);
    if (target.origin !== current.origin) return true;
    return normalizePath(target.pathname) !== normalizePath(current.pathname);
  } catch {
    return false;
  }
}

function normalizePath(pathname) {
  const normalized = pathname
    .replace(/\/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\/+$/, '');
  return normalized || '/';
}

function pickBadgeAtPointer(event, canvas, camera, meshes) {
  if (!meshes.length) return null;

  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const directHit = raycaster.intersectObjects(meshes, false)[0];
  if (directHit?.object) return directHit.object;

  const targetRadius = event.pointerType === 'touch' ? 28 : 22;
  let nearest = null;
  let nearestDistance = targetRadius;
  const worldPosition = new THREE.Vector3();

  meshes.forEach((mesh) => {
    mesh.getWorldPosition(worldPosition);
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;

    const x = (projected.x * 0.5 + 0.5) * rect.width;
    const y = (-projected.y * 0.5 + 0.5) * rect.height;
    const distance = Math.hypot(event.clientX - rect.left - x, event.clientY - rect.top - y);
    if (distance < nearestDistance) {
      nearest = mesh;
      nearestDistance = distance;
    }
  });

  return nearest;
}

function updateBadgeHighlights(state) {
  state.badgeMeshes.forEach((mesh) => {
    const isHovered = mesh.userData.badgeId === state.hoveredBadgeId;
    mesh.scale.setScalar(isHovered ? 1.08 : 1);
    mesh.renderOrder = isHovered ? 2 : 1;
  });
}

function slugifyBadgeName(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function buildUniform(status, placementData) {
  try {
    const uniform = await buildModelUniform(placementData);
    if (status) status.textContent = 'Placing badges...';
    return uniform;
  } catch (error) {
    console.warn('Could not load shirt GLB, using procedural fallback.', error);
    if (status) status.textContent = 'Loading fallback uniform...';
    return buildProceduralUniform(placementData);
  }
}

async function buildModelUniform(placementData) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(shirtModelUrl);
  const group = new THREE.Group();
  const model = gltf.scene;
  const sectionColour = new THREE.Color(darkTrim);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.55 / Math.max(size.y, 0.001);

  model.position.sub(center);
  model.scale.setScalar(scale);
  model.rotation.y = 0;

  model.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = true;
    child.geometry.computeBoundingSphere();
    child.geometry.computeBoundingBox();

    child.material = Array.isArray(child.material)
      ? child.material.map((material) => colourShirtMaterial(material, sectionColour))
      : colourShirtMaterial(child.material, sectionColour);
  });

  group.add(model);
  group.rotation.x = -0.02;
  group.updateMatrixWorld(true);

  const badgeSurfaceMeshes = getSurfaceMeshes(model);

  return {
    group,
    isModel: true,
    sectionColour,
    badgeSurfaceMeshes,
    ...createPlacementSurfaces(badgeSurfaceMeshes, placementData?.placement_surfaces)
  };
}

function colourShirtMaterial(sourceMaterial, sectionColour) {
  const material = sourceMaterial.clone();
  material.color.set(shirtBase);
  material.metalness = 0.02;
  material.roughness = 0.88;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.sectionColour = { value: sectionColour };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 sectionColour;')
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        #ifdef USE_MAP
          // The GLB bakes cyan trim and navy cloth into one map. Use the cyan
          // chroma as a mask and retain the brightness variation within each fabric.
          vec3 texel = sampledDiffuseColor.rgb;
          float trim = smoothstep(0.42, 0.67, (texel.g - texel.r) / max(texel.b, 0.003));
          float fabricShade = clamp(texel.b / mix(0.012, 0.053, trim), 0.06, 1.55);
          diffuseColor.rgb = mix(diffuse, sectionColour, trim) * fabricShade;
        #endif
      `);
  };

  return material;
}

function buildProceduralUniform(placementData) {
  const group = new THREE.Group();
  const shirtMaterial = fabricMaterial(shirtBase);
  const sectionMaterial = fabricMaterial(darkTrim);
  const trimMaterial = fabricMaterial(darkTrim, 0.55);
  const seamMaterial = fabricMaterial('#252d46', 0.5);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.3, 0.58, 3, 6, 2), shirtMaterial);
  torso.position.y = -0.05;
  group.add(torso);

  const sleeveGeometry = new THREE.BoxGeometry(0.48, 1.75, 0.46, 2, 5, 2);
  // BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z.
  const leftSleeve = new THREE.Mesh(sleeveGeometry, [
    shirtMaterial, sectionMaterial, sectionMaterial, shirtMaterial, shirtMaterial, shirtMaterial
  ]);
  leftSleeve.position.set(-1.0, -0.18, 0.02);
  leftSleeve.rotation.z = -0.16;
  group.add(leftSleeve);

  const rightSleeve = new THREE.Mesh(sleeveGeometry, [
    sectionMaterial, shirtMaterial, sectionMaterial, shirtMaterial, shirtMaterial, shirtMaterial
  ]);
  rightSleeve.position.set(1.0, -0.18, 0.02);
  rightSleeve.rotation.z = 0.16;
  group.add(rightSleeve);

  const collarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.12), sectionMaterial);
  collarLeft.position.set(-0.25, 1.16, 0.35);
  collarLeft.rotation.z = -0.45;
  group.add(collarLeft);

  const collarRight = collarLeft.clone();
  collarRight.position.x = 0.25;
  collarRight.rotation.z = 0.45;
  group.add(collarRight);

  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.62, 0.04), trimMaterial);
  placket.position.set(0, 0.23, 0.33);
  group.add(placket);

  const leftPocket = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.035), shirtMaterial);
  leftPocket.position.set(-0.36, 0.1, 0.35);
  group.add(leftPocket);

  const rightPanelLine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.85, 0.03), seamMaterial);
  rightPanelLine.position.set(0.34, 0.0, 0.36);
  group.add(rightPanelLine);

  for (let y = 0.84; y > -0.42; y -= 0.28) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 24), seamMaterial);
    button.rotation.x = Math.PI / 2;
    button.position.set(0, y, 0.37);
    group.add(button);
  }

  const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.72, 4), trimMaterial);
  scarf.position.set(0, 0.98, 0.42);
  scarf.rotation.z = Math.PI / 4;
  group.add(scarf);

  group.rotation.x = -0.02;
  return {
    group,
    sectionColour: sectionMaterial.color,
    ...createFallbackPlacementSurfaces(placementData?.placement_surfaces)
  };
}

function fabricMaterial(color, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    flatShading: false
  });
}

function applySectionColour(uniform, sections, slug) {
  const section = sections.find((item) => item.slug === slug);
  uniform.sectionColour.set(section?.uniform_colour || darkTrim);
}

async function renderBadges(data, state, layer, uniform) {
  disposeLayer(layer, state);

  const badges = Object.entries(data.groups)
    .filter(([groupId]) => state.groups.has(groupId))
    .flatMap(([, group]) => group.badges)
    .filter((badge) => shouldShowBadge(badge, state.section));

  uniform?.group?.updateMatrixWorld(true);
  const meshes = await Promise.all(badges.map((badge) => createBadgeMesh(badge, data.anchors[badge.anchor], state, uniform, badge.anchor)));
  state.badges = badges;
  state.badgeMeshes = meshes.filter(Boolean);
  state.badgeMeshes.forEach((mesh) => {
    layer.add(mesh);
    state.badgeMeshById.set(mesh.userData.badgeId, mesh);
  });
}

function shouldShowBadge(badge, sectionSlug) {
  if (!Array.isArray(badge.only_sections) || !badge.only_sections.length) return true;
  return badge.only_sections.includes(sectionSlug);
}

function getGroupsForView(data, view) {
  const visibleGroups = Object.entries(data.groups || {})
    .filter(([, group]) => group.badges?.some((badge) => data.anchors?.[badge.anchor]?.surface === view))
    .map(([groupId]) => groupId);

  return new Set(visibleGroups);
}

function initDebugTools(root, canvas, camera, state, data, uniform, badgeLayer, debugLayer) {
  const controls = root.querySelector('.uniform-viewer__controls');
  const catalog = getBadgeCatalog(data);
  if (!controls || !catalog.length) return;

  root.classList.add('uniform-viewer--debug');
  state.debug = {
    target: 'badge',
    selectedId: catalog[0].id,
    selectedSurface: state.view,
    output: null,
    refresh: () => updateDebugMarker(data, state, uniform, debugLayer)
  };

  const panel = document.createElement('div');
  panel.className = 'uniform-debug uniform-control';
  panel.innerHTML = `
    <p class="uniform-control__label">Debug</p>
    <label class="uniform-debug__field">
      <span>Target</span>
      <select data-uniform-debug-target>
        <option value="badge">Badge</option>
        <option value="surface">Surface</option>
      </select>
    </label>
    <label class="uniform-debug__field">
      <span>Badge</span>
      <select data-uniform-debug-badge></select>
    </label>
    <label class="uniform-debug__field">
      <span>Surface</span>
      <select data-uniform-debug-surface></select>
    </label>
    <div class="uniform-debug__grid" aria-label="Move selected badge">
      <button type="button" data-uniform-debug-nudge="up">Up</button>
      <button type="button" data-uniform-debug-nudge="left">Left</button>
      <button type="button" data-uniform-debug-nudge="right">Right</button>
      <button type="button" data-uniform-debug-nudge="down">Down</button>
    </div>
    <div class="uniform-debug__actions">
      <button type="button" data-uniform-debug-size="-1">Smaller</button>
      <button type="button" data-uniform-debug-size="1">Larger</button>
      <button type="button" data-uniform-debug-roll="-1">Roll -</button>
      <button type="button" data-uniform-debug-roll="1">Roll +</button>
      <button type="button" data-uniform-debug-offset="-1">Offset -</button>
      <button type="button" data-uniform-debug-offset="1">Offset +</button>
    </div>
    <div class="uniform-debug__actions">
      <button type="button" data-uniform-debug-surface-depth="-1">Back</button>
      <button type="button" data-uniform-debug-surface-depth="1">Forward</button>
      <button type="button" data-uniform-debug-surface-size="narrower">Narrower</button>
      <button type="button" data-uniform-debug-surface-size="wider">Wider</button>
      <button type="button" data-uniform-debug-surface-size="shorter">Shorter</button>
      <button type="button" data-uniform-debug-surface-size="taller">Taller</button>
    </div>
    <textarea data-uniform-debug-output rows="3" readonly></textarea>
    <button type="button" class="uniform-debug__copy" data-uniform-debug-copy>Copy YAML</button>
  `;
  controls.append(panel);

  const targetSelect = panel.querySelector('[data-uniform-debug-target]');
  const select = panel.querySelector('[data-uniform-debug-badge]');
  const surfaceSelect = panel.querySelector('[data-uniform-debug-surface]');
  catalog.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.groupLabel}: ${entry.label}`;
    select.append(option);
  });
  Object.keys(uniform.placementSurfaces || {}).forEach((surface) => {
    const option = document.createElement('option');
    option.value = surface;
    option.textContent = surface.replace(/_/g, ' ');
    surfaceSelect.append(option);
  });

  state.debug.output = panel.querySelector('[data-uniform-debug-output]');

  targetSelect.addEventListener('change', () => {
    state.debug.target = targetSelect.value;
    state.debug.refresh();
  });

  select.addEventListener('change', () => {
    state.debug.selectedId = select.value;
    state.debug.refresh();
  });

  surfaceSelect.addEventListener('change', () => {
    state.debug.selectedSurface = surfaceSelect.value;
    state.debug.refresh();
  });

  panel.querySelectorAll('[data-uniform-debug-nudge]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (state.debug.target === 'surface') {
        nudgeSelectedSurface(uniform, state, button.dataset.uniformDebugNudge);
        await renderBadges(data, state, badgeLayer, uniform);
      } else {
        nudgeSelectedAnchor(data, state, button.dataset.uniformDebugNudge);
        await updateSelectedDebugBadge(data, state, badgeLayer, uniform);
      }
      state.debug.refresh();
    });
  });

  panel.querySelectorAll('[data-uniform-debug-size]').forEach((button) => {
    button.addEventListener('click', async () => {
      resizeSelectedAnchor(data, state, Number(button.dataset.uniformDebugSize));
      await updateSelectedDebugBadge(data, state, badgeLayer, uniform);
      state.debug.refresh();
    });
  });

  panel.querySelectorAll('[data-uniform-debug-roll]').forEach((button) => {
    button.addEventListener('click', async () => {
      rollSelectedAnchor(data, state, Number(button.dataset.uniformDebugRoll));
      await updateSelectedDebugBadge(data, state, badgeLayer, uniform);
      state.debug.refresh();
    });
  });

  panel.querySelectorAll('[data-uniform-debug-offset]').forEach((button) => {
    button.addEventListener('click', async () => {
      offsetSelectedAnchor(data, state, Number(button.dataset.uniformDebugOffset));
      await updateSelectedDebugBadge(data, state, badgeLayer, uniform);
      state.debug.refresh();
    });
  });

  panel.querySelectorAll('[data-uniform-debug-surface-depth]').forEach((button) => {
    button.addEventListener('click', async () => {
      depthSelectedSurface(uniform, state, Number(button.dataset.uniformDebugSurfaceDepth));
      await renderBadges(data, state, badgeLayer, uniform);
      state.debug.refresh();
    });
  });

  panel.querySelectorAll('[data-uniform-debug-surface-size]').forEach((button) => {
    button.addEventListener('click', async () => {
      resizeSelectedSurface(uniform, state, button.dataset.uniformDebugSurfaceSize);
      await renderBadges(data, state, badgeLayer, uniform);
      state.debug.refresh();
    });
  });

  panel.querySelector('[data-uniform-debug-copy]').addEventListener('click', async () => {
    const value = state.debug.output?.value || '';
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      state.debug.output.select();
      document.execCommand('copy');
    }
  });

  canvas.addEventListener('pointerdown', async (event) => {
    const hit = state.debug.target === 'surface'
      ? pickModelSurface(event, canvas, camera, uniform)
      : pickUniformSurface(event, canvas, camera, uniform);
    if (!hit) return;

    if (state.debug.target === 'surface') {
      applyDebugHitToSurface(uniform.placementSurfaces?.[state.debug.selectedSurface], hit);
      await renderBadges(data, state, badgeLayer, uniform);
      state.debug.refresh();
      return;
    }

    const entry = getSelectedDebugEntry(data, state);
    if (!entry) return;
    applyDebugHitToAnchor(entry.anchor, hit.point, hit.object?.userData?.surface || state.view, uniform);
    await updateSelectedDebugBadge(data, state, badgeLayer, uniform);
    state.debug.refresh();
  });

  state.debug.refresh();
}

function getBadgeCatalog(data) {
  return Object.entries(data.groups).flatMap(([groupId, group]) =>
    group.badges
      .filter((badge) => data.anchors[badge.anchor])
      .map((badge) => ({
        id: badge.id,
        label: badge.label || badge.short_label || badge.id,
        groupLabel: group.label,
        groupId,
        badge,
        anchor: data.anchors[badge.anchor],
        anchorId: badge.anchor
      }))
  );
}

function getSelectedDebugEntry(data, state) {
  return getBadgeCatalog(data).find((entry) => entry.id === state.debug?.selectedId) || null;
}

async function updateSelectedDebugBadge(data, state, layer, uniform) {
  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;

  const existing = state.badgeMeshById.get(entry.badge.id);
  if (existing) {
    updateBadgeMesh(existing, entry.anchor, uniform);
    return;
  }

  if (!isDebugEntryVisible(entry, state)) return;

  const mesh = await createBadgeMesh(entry.badge, entry.anchor, state, uniform, entry.anchorId);
  if (!mesh) return;

  layer.add(mesh);
  state.badgeMeshById.set(entry.badge.id, mesh);
}

function isDebugEntryVisible(entry, state) {
  return state.groups.has(entry.groupId) && shouldShowBadge(entry.badge, state.section);
}

function pickUniformSurface(event, canvas, camera, uniform) {
  const meshes = uniform.placementSurfaceMeshes?.length
    ? uniform.placementSurfaceMeshes
    : uniform.badgeSurfaceMeshes;

  if (!meshes?.length) return null;

  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(meshes, true);
  return intersections[0] || null;
}

function pickModelSurface(event, canvas, camera, uniform) {
  if (!uniform.badgeSurfaceMeshes?.length) return null;

  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(uniform.badgeSurfaceMeshes, true);
  return intersections[0] || null;
}

function applyDebugHitToAnchor(anchor, point, surface, uniform) {
  anchor.surface = surface;

  const placementSurface = uniform.placementSurfaces?.[surface];
  if (placementSurface) {
    const local = getPlacementSurfaceLocalPoint(point, placementSurface);
    anchor.y = roundCoordinate(local.y);

    if (surface === 'front') {
      anchor.x = roundCoordinate(local.x);
      delete anchor.z;
    } else {
      anchor.z = roundCoordinate(local.x);
      delete anchor.x;
    }

    return;
  }

  if (surface === 'front') {
    anchor.x = roundCoordinate(point.x);
    anchor.y = roundCoordinate(point.y);
    delete anchor.z;
  } else {
    anchor.y = roundCoordinate(point.y);
    anchor.z = roundCoordinate(point.z);
    delete anchor.x;
  }
}

function applyDebugHitToSurface(surface, hit) {
  if (!surface || !hit) return;

  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const origin = hit.point.clone().addScaledVector(normal, placementSurfaceOffset);
  updatePlacementSurfaceBasis(surface, origin, normal);
}

function nudgeSelectedAnchor(data, state, direction) {
  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;

  const anchor = entry.anchor;
  const surface = anchor.surface || state.view;
  const step = 0.01;

  if (direction === 'up') anchor.y = roundCoordinate((anchor.y || 0) + step);
  if (direction === 'down') anchor.y = roundCoordinate((anchor.y || 0) - step);

  if (surface === 'front') {
    if (direction === 'left') anchor.x = roundCoordinate((anchor.x || 0) - step);
    if (direction === 'right') anchor.x = roundCoordinate((anchor.x || 0) + step);
  } else {
    if (direction === 'left') anchor.z = roundCoordinate((anchor.z || 0) - step);
    if (direction === 'right') anchor.z = roundCoordinate((anchor.z || 0) + step);
  }
}

function nudgeSelectedSurface(uniform, state, direction) {
  const surface = uniform.placementSurfaces?.[state.debug?.selectedSurface];
  if (!surface) return;

  const step = 0.01;
  if (direction === 'up') surface.origin.addScaledVector(surface.up, step);
  if (direction === 'down') surface.origin.addScaledVector(surface.up, -step);
  if (direction === 'left') surface.origin.addScaledVector(surface.right, -step);
  if (direction === 'right') surface.origin.addScaledVector(surface.right, step);
  syncPlacementSurfaceMesh(surface);
}

function depthSelectedSurface(uniform, state, direction) {
  const surface = uniform.placementSurfaces?.[state.debug?.selectedSurface];
  if (!surface) return;

  surface.origin.addScaledVector(surface.normal, 0.006 * direction);
  syncPlacementSurfaceMesh(surface);
}

function resizeSelectedSurface(uniform, state, direction) {
  const surface = uniform.placementSurfaces?.[state.debug?.selectedSurface];
  if (!surface) return;

  const step = 0.04;
  if (direction === 'narrower') surface.width = Math.max(0.1, roundCoordinate(surface.width - step));
  if (direction === 'wider') surface.width = roundCoordinate(surface.width + step);
  if (direction === 'shorter') surface.height = Math.max(0.1, roundCoordinate(surface.height - step));
  if (direction === 'taller') surface.height = roundCoordinate(surface.height + step);
  syncPlacementSurfaceMesh(surface);
}

function resizeSelectedAnchor(data, state, direction) {
  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;

  const anchor = entry.anchor;
  const step = 0.01 * direction;
  anchor.w = roundCoordinate(Math.max(0.035, (anchor.w || 0.1) + step));
  anchor.h = roundCoordinate(Math.max(0.035, (anchor.h || 0.1) + step));
}

function rollSelectedAnchor(data, state, direction) {
  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;
  entry.anchor.roll = roundCoordinate((entry.anchor.roll || 0) + 0.02 * direction);
}

function offsetSelectedAnchor(data, state, direction) {
  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;

  const step = 0.004 * direction;
  const current = entry.anchor.offset ?? getDefaultBadgeOffset(entry.anchor);
  entry.anchor.offset = roundCoordinate(Math.max(0.002, Math.min(0.09, current + step)));
}

function updateDebugMarker(data, state, uniform, layer) {
  disposeDebugLayer(layer);

  if (state.debug?.target === 'surface') {
    const surface = uniform.placementSurfaces?.[state.debug.selectedSurface];
    if (!surface) return;

    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(surface.width, surface.height),
      new THREE.MeshBasicMaterial({
        color: 0xff2b68,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      })
    );
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(marker.geometry),
      new THREE.LineBasicMaterial({ color: 0xff2b68, transparent: true, opacity: 0.9 })
    );
    marker.add(border);
    marker.position.copy(surface.origin);
    marker.quaternion.copy(surface.quaternion);
    layer.add(marker);

    if (state.debug?.output) {
      state.debug.output.value = formatYamlPlacementSurface(state.debug.selectedSurface, surface);
    }
    return;
  }

  const entry = getSelectedDebugEntry(data, state);
  if (!entry) return;

  const placement = getBadgePlacement(entry.anchor, uniform);
  const radius = Math.max(entry.anchor.w || 0.1, entry.anchor.h || 0.1) * 0.64;
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.82, radius, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2b68, side: THREE.DoubleSide, transparent: true, opacity: 0.86, depthWrite: false })
  );
  marker.position.copy(placement.position);
  marker.quaternion.copy(placement.quaternion);
  layer.add(marker);

  if (state.debug?.output) {
    state.debug.output.value = formatYamlAnchor(entry.anchorId, entry.anchor);
  }
}

function disposeDebugLayer(layer) {
  while (layer.children.length) {
    const child = layer.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

function formatYamlAnchor(anchorId, anchor) {
  const parts = [`surface: ${anchor.surface}`];

  if (anchor.surface === 'front') {
    parts.push(`x: ${formatCoordinate(anchor.x || 0)}`);
  }

  parts.push(`y: ${formatCoordinate(anchor.y || 0)}`);

  if (anchor.surface !== 'front') {
    parts.push(`z: ${formatCoordinate(anchor.z || 0)}`);
  }

  if (anchor.roll) parts.push(`roll: ${formatCoordinate(anchor.roll)}`);
  if (anchor.offset != null) parts.push(`offset: ${formatCoordinate(anchor.offset)}`);
  parts.push(`w: ${formatCoordinate(anchor.w || 0.1)}`);
  parts.push(`h: ${formatCoordinate(anchor.h || 0.1)}`);

  return `${anchorId}: { ${parts.join(', ')} }`;
}

function formatYamlPlacementSurface(surfaceId, surface) {
  const pinOrigin = surface.origin.clone().addScaledVector(surface.normal, 3);
  const pinDirection = surface.normal.clone().multiplyScalar(-1);
  const lines = [
    `${surfaceId}:`,
    `  pin_origin: ${formatVector(pinOrigin)}`,
    `  pin_direction: ${formatVector(pinDirection)}`,
    `  fallback_origin: ${formatVector(surface.origin)}`,
    `  fallback_normal: ${formatVector(surface.normal)}`,
    `  coordinate_scale: ${formatCoordinate(surface.coordinateScale || 1)}`,
    `  width: ${formatCoordinate(surface.width)}`,
    `  height: ${formatCoordinate(surface.height)}`
  ];

  return lines.join('\n');
}

function formatVector(vector) {
  return `[${formatCoordinate(vector.x)}, ${formatCoordinate(vector.y)}, ${formatCoordinate(vector.z)}]`;
}

function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

function formatCoordinate(value) {
  return Number(roundCoordinate(value).toFixed(3));
}

async function createBadgeMesh(badge, anchor, state, uniform, anchorId = badge.anchor) {
  if (!anchor) return null;

  const texture = await loadBadgeTexture(badge, state);
  const geometry = new THREE.PlaneGeometry(anchor.w, anchor.h);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  const mesh = new THREE.Mesh(geometry, material);

  updateBadgeMesh(mesh, anchor, uniform);
  mesh.userData.texture = texture;
  mesh.userData.badgeId = badge.id;
  mesh.userData.anchorId = anchorId;
  mesh.userData.badge = badge;
  return mesh;
}

function updateBadgeMesh(mesh, anchor, uniform) {
  const width = anchor.w || 0.1;
  const height = anchor.h || 0.1;
  const current = mesh.geometry?.parameters || {};

  if (current.width !== width || current.height !== height) {
    mesh.geometry?.dispose();
    mesh.geometry = new THREE.PlaneGeometry(width, height);
  }

  const placement = getBadgePlacement(anchor, uniform);
  mesh.position.copy(placement.position);
  mesh.quaternion.copy(placement.quaternion);
}

function getBadgePlacement(anchor, uniform) {
  if (uniform?.placementSurfaces?.[anchor.surface]) {
    return projectAnchorToPlacementSurface(anchor, uniform.placementSurfaces[anchor.surface]);
  }

  if (uniform?.isModel && anchor.surface) {
    const projected = projectAnchorToModel(anchor, uniform);
    if (projected) return projected;
  }

  return {
    position: getFallbackAnchorPosition(anchor),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(anchor.rx || 0, anchor.ry || 0, anchor.rz || 0))
  };
}

function getFallbackAnchorPosition(anchor) {
  if (anchor.surface === 'front') return new THREE.Vector3(anchor.x || 0, anchor.y || 0, anchor.z || 0.58);
  if (anchor.surface === 'left_sleeve') return new THREE.Vector3(anchor.x || 1.1, anchor.y || 0, anchor.z || 0);
  if (anchor.surface === 'right_sleeve') return new THREE.Vector3(anchor.x || -1.1, anchor.y || 0, anchor.z || 0);
  return new THREE.Vector3(anchor.x || 0, anchor.y || 0, anchor.z || 0);
}

function createPlacementSurfaces(surfaceMeshes, surfaceData = {}) {
  const placementSurfaceGroup = new THREE.Group();
  const placementSurfaces = {};
  const placementSurfaceMeshes = [];
  const configs = getPlacementSurfaceConfigs(surfaceData);

  Object.entries(configs).forEach(([surface, config]) => {
    const placementSurface = createPlacementSurface(surface, config, surfaceMeshes);
    placementSurfaces[surface] = placementSurface;
    placementSurfaceGroup.add(placementSurface.mesh);
    placementSurfaceMeshes.push(placementSurface.mesh);
  });

  return { placementSurfaceGroup, placementSurfaces, placementSurfaceMeshes };
}

function createFallbackPlacementSurfaces(surfaceData = {}) {
  const placementSurfaceGroup = new THREE.Group();
  const placementSurfaces = {};
  const placementSurfaceMeshes = [];
  const configs = getPlacementSurfaceConfigs(surfaceData);

  Object.entries(configs).forEach(([surface, config]) => {
    const placementSurface = createPlacementSurfaceFromBasis(surface, config, config.fallbackOrigin, config.fallbackNormal);
    placementSurfaces[surface] = placementSurface;
    placementSurfaceGroup.add(placementSurface.mesh);
    placementSurfaceMeshes.push(placementSurface.mesh);
  });

  return { placementSurfaceGroup, placementSurfaces, placementSurfaceMeshes };
}

function getPlacementSurfaceConfigs(surfaceData = {}) {
  const defaults = {
    front: {
      origin: new THREE.Vector3(0, 0, 3),
      direction: new THREE.Vector3(0, 0, -1),
      fallbackOrigin: new THREE.Vector3(0, 0, 0.62),
      fallbackNormal: new THREE.Vector3(0, 0, 1),
      coordinateScale: 1,
      width: 1.35,
      height: 1.65
    },
    left_sleeve: {
      origin: new THREE.Vector3(3, 0, 0),
      direction: new THREE.Vector3(-1, 0, 0),
      fallbackOrigin: new THREE.Vector3(1.1, 0, 0),
      fallbackNormal: new THREE.Vector3(1, 0, 0),
      coordinateScale: -1,
      width: 0.76,
      height: 1.35
    },
    right_sleeve: {
      origin: new THREE.Vector3(-3, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      fallbackOrigin: new THREE.Vector3(-1.1, 0, 0),
      fallbackNormal: new THREE.Vector3(-1, 0, 0),
      coordinateScale: 1,
      width: 0.76,
      height: 1.35
    }
  };

  return Object.fromEntries(
    Object.entries(defaults).map(([surface, fallback]) => [
      surface,
      normalizePlacementSurfaceConfig(surfaceData[surface], fallback)
    ])
  );
}

function normalizePlacementSurfaceConfig(config = {}, fallback) {
  return {
    origin: vectorFromConfig(config.pin_origin, fallback.origin),
    direction: vectorFromConfig(config.pin_direction, fallback.direction).normalize(),
    fallbackOrigin: vectorFromConfig(config.fallback_origin, fallback.fallbackOrigin),
    fallbackNormal: vectorFromConfig(config.fallback_normal, fallback.fallbackNormal).normalize(),
    coordinateScale: config.coordinate_scale ?? fallback.coordinateScale,
    width: config.width ?? fallback.width,
    height: config.height ?? fallback.height
  };
}

function vectorFromConfig(value, fallback) {
  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  }

  return fallback.clone();
}

function createPlacementSurface(surface, config, surfaceMeshes) {
  raycaster.set(config.origin, config.direction);
  const intersections = raycaster.intersectObjects(surfaceMeshes, true);

  if (!intersections.length) {
    return createPlacementSurfaceFromBasis(surface, config, config.fallbackOrigin, config.fallbackNormal);
  }

  const hit = intersections[0];
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const origin = hit.point.clone().addScaledVector(normal, placementSurfaceOffset);
  return createPlacementSurfaceFromBasis(surface, config, origin, normal);
}

function createPlacementSurfaceFromBasis(surface, config, origin, normal) {
  const quaternion = getBadgeQuaternion(normal);
  const up = worldUp.clone().addScaledVector(normal, -worldUp.dot(normal));
  if (up.lengthSq() < 0.0001) up.set(0, 0, 1).addScaledVector(normal, -normal.z);
  up.normalize();
  const right = up.clone().cross(normal).normalize();
  const mesh = createPlacementSurfaceMesh(surface, config, origin, quaternion);

  return {
    surface,
    origin: origin.clone(),
    normal: normal.clone(),
    right,
    up,
    quaternion,
    coordinateScale: config.coordinateScale || 1,
    width: config.width,
    height: config.height,
    mesh
  };
}

function createPlacementSurfaceMesh(surface, config, origin, quaternion) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(config.width, config.height),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  mesh.position.copy(origin);
  mesh.quaternion.copy(quaternion);
  mesh.userData.surface = surface;
  return mesh;
}

function updatePlacementSurfaceBasis(surface, origin, normal) {
  const quaternion = getBadgeQuaternion(normal);
  const up = worldUp.clone().addScaledVector(normal, -worldUp.dot(normal));
  if (up.lengthSq() < 0.0001) up.set(0, 0, 1).addScaledVector(normal, -normal.z);
  up.normalize();

  surface.origin.copy(origin);
  surface.normal.copy(normal);
  surface.up.copy(up);
  surface.right.copy(up.clone().cross(normal).normalize());
  surface.quaternion.copy(quaternion);
  syncPlacementSurfaceMesh(surface);
}

function syncPlacementSurfaceMesh(surface) {
  if (!surface.mesh) return;

  const params = surface.mesh.geometry?.parameters || {};
  if (params.width !== surface.width || params.height !== surface.height) {
    surface.mesh.geometry?.dispose();
    surface.mesh.geometry = new THREE.PlaneGeometry(surface.width, surface.height);
  }

  surface.mesh.position.copy(surface.origin);
  surface.mesh.quaternion.copy(surface.quaternion);
}

function projectAnchorToPlacementSurface(anchor, surface) {
  const localX = anchor.surface === 'front' ? (anchor.x || 0) : (anchor.z || 0);
  const localY = anchor.y || 0;
  const offset = anchor.offset ?? placementBadgeOffset;
  const position = surface.origin.clone()
    .addScaledVector(surface.right, localX * surface.coordinateScale)
    .addScaledVector(surface.up, localY)
    .addScaledVector(surface.normal, offset);
  const quaternion = surface.quaternion.clone();

  if (anchor.roll) {
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(surface.normal, anchor.roll));
  }

  return { position, quaternion };
}

function getPlacementSurfaceLocalPoint(point, surface) {
  const delta = point.clone().sub(surface.origin);
  return {
    x: delta.dot(surface.right) / surface.coordinateScale,
    y: delta.dot(surface.up)
  };
}

function projectAnchorToModel(anchor, uniform) {
  const ray = getSurfaceRay(anchor);
  if (!ray || !uniform.badgeSurfaceMeshes?.length) return null;

  raycaster.set(ray.origin, ray.direction);
  const intersections = raycaster.intersectObjects(uniform.badgeSurfaceMeshes, true);
  if (!intersections.length) return null;

  const hit = intersections[0];
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const position = hit.point.clone().addScaledVector(normal, getAnchorOffset(anchor));
  const quaternion = getBadgeQuaternion(normal);

  if (anchor.roll) {
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(normal, anchor.roll));
  }

  return { position, quaternion };
}

function getBadgeQuaternion(normal) {
  const up = worldUp.clone().addScaledVector(normal, -worldUp.dot(normal));
  if (up.lengthSq() < 0.0001) up.set(0, 0, 1).addScaledVector(normal, -normal.z);
  up.normalize();

  const right = up.clone().cross(normal).normalize();
  const matrix = new THREE.Matrix4().makeBasis(right, up, normal);
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

function getAnchorOffset(anchor) {
  return anchor.offset ?? getDefaultBadgeOffset(anchor);
}

function getDefaultBadgeOffset(anchor) {
  const size = Math.max(anchor.w || 0.1, anchor.h || 0.1);
  return Math.min(badgeOffsetMax, Math.max(badgeOffsetMin, size * badgeOffsetScale));
}

function getSurfaceRay(anchor) {
  if (anchor.surface === 'front') {
    return {
      origin: new THREE.Vector3(anchor.x, anchor.y, 3),
      direction: new THREE.Vector3(0, 0, -1)
    };
  }

  if (anchor.surface === 'left_sleeve') {
    return {
      origin: new THREE.Vector3(3, anchor.y, anchor.z || 0),
      direction: new THREE.Vector3(-1, 0, 0)
    };
  }

  if (anchor.surface === 'right_sleeve') {
    return {
      origin: new THREE.Vector3(-3, anchor.y, anchor.z || 0),
      direction: new THREE.Vector3(1, 0, 0)
    };
  }

  return null;
}

function getSurfaceMeshes(model) {
  const meshes = [];
  model.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

async function loadBadgeTexture(badge, state) {
  const cacheKey = getBadgeTextureKey(badge, state);
  if (state.textureCache?.has(cacheKey)) {
    return state.textureCache.get(cacheKey);
  }

  const texturePromise = loadBadgeTextureUncached(badge, state);
  state.textureCache?.set(cacheKey, texturePromise);
  return texturePromise;
}

async function loadBadgeTextureUncached(badge, state) {
  if (badge.icon && state.icons[badge.icon]) {
    return loadSvgTexture(getBadgeIconSvg(badge, state), getIconColour(badge, state));
  }

  const assetPath = getBadgeAssetPath(badge, state.section);
  if (!assetPath) return createPlaceholderTexture(badge);
  if (/\.svg(?:$|\?)/i.test(assetPath)) {
    return loadSvgAssetTexture(assetPath, badge);
  }

  return new Promise((resolve) => {
    textureLoader.load(
      assetPath,
      (texture) => {
        prepareTexture(texture);
        resolve(texture);
      },
      undefined,
      () => resolve(createPlaceholderTexture(badge))
    );
  });
}

function getBadgeTextureKey(badge, state) {
  if (badge.icon && state.icons[badge.icon]) {
    return `icon:${badge.icon}:${getOasStage(badge, state) || ''}:${getIconColour(badge, state)}`;
  }

  const assetPath = getBadgeAssetPath(badge, state.section);
  if (assetPath) {
    return [
      'asset',
      assetPath,
      badge.fill || '',
      badge.stroke || '',
      badge.text_colour || '',
      badge.short_label || ''
    ].join(':');
  }

  return [
    'placeholder',
    badge.id,
    badge.short_label || badge.label || '',
    badge.shape || 'circle',
    badge.fill || '#ffffff',
    badge.stroke || '#100e4c'
  ].join(':');
}

function loadSvgTexture(svg, colour) {
  const svgText = svg.replace(/currentColor/g, colour);
  return rasterizeSvgTexture(svgText);
}

async function loadSvgAssetTexture(assetPath, badge) {
  try {
    const response = await fetch(assetPath);
    if (!response.ok) throw new Error(`Could not load SVG badge: ${assetPath}`);
    return rasterizeSvgTexture(transformBadgeSvg(await response.text(), badge));
  } catch {
    return createPlaceholderTexture(badge);
  }
}

function transformBadgeSvg(svgText, badge) {
  if (!svgText.includes('id="outer-rect"') && !svgText.includes("id='outer-rect'")) {
    return svgText;
  }

  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const outer = document.getElementById('outer-rect');
  const inner = document.getElementById('inner-rect');
  const text = document.getElementById('text');

  if (outer && badge.stroke) outer.setAttribute('fill', badge.stroke);
  if (inner && badge.fill) inner.setAttribute('fill', badge.fill);
  if (text) {
    text.textContent = badge.short_label || badge.label || text.textContent || '';
    text.setAttribute('fill', badge.text_colour || '#ffffff');
  }

  return new XMLSerializer().serializeToString(document.documentElement);
}

function rasterizeSvgTexture(svgText) {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgTextureSize;
      canvas.height = svgTextureSize;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      drawImageContained(context, image, canvas.width, canvas.height);

      const texture = new THREE.CanvasTexture(canvas);
      prepareTexture(texture);
      resolve(texture);
    };
    image.onerror = () => resolve(createPlaceholderTexture({ label: 'Badge', short_label: 'BADGE' }));
    image.src = dataUrl;
  });
}

function drawImageContained(context, image, width, height) {
  const imageWidth = image.naturalWidth || image.width || width;
  const imageHeight = image.naturalHeight || image.height || height;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function prepareTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

function getIconColour(badge, state) {
  const oasStage = getOasStage(badge, state);
  if (oasStage) {
    return state.oas?.stages?.[String(oasStage)] || badge.icon_colour || badge.fill || '#006649';
  }

  if (badge.icon_colour === 'section') {
    const section = state.sections.find((item) => item.slug === state.section);
    return section?.colour || badge.fill || '#100e4c';
  }

  return badge.icon_colour || badge.fill || '#100e4c';
}

function getBadgeIconSvg(badge, state) {
  const svg = state.icons[badge.icon] || '';
  const oasStage = getOasStage(badge, state);
  return oasStage ? svg.replaceAll('OAS_STAGE', String(oasStage)) : svg;
}

function getOasStage(badge, state) {
  if (!badge.icon?.startsWith('oas-')) return null;

  const sectionOas = state.oas?.[state.section];
  if (!sectionOas) return null;

  const skill = getOasSkill(badge, state);
  return Number(skill?.stage || sectionOas.stage_requirement || 1);
}

function getOasSkill(badge, state) {
  if (!badge.icon?.startsWith('oas-')) return null;

  const sectionOas = state.oas?.[state.section];
  if (!sectionOas) return null;

  const skillSlug = badge.icon.slice(4);
  const skills = [...(sectionOas.core_skills || []), ...(sectionOas.specialist_skills || [])];
  return skills.find((item) => slugifyBadgeName(item.name) === skillSlug) || null;
}

function getBadgeAssetPath(badge, sectionSlug) {
  if (badge.asset) return badge.asset;
  if (badge.section_assets?.[sectionSlug]) return badge.section_assets[sectionSlug];
  if (badge.section_asset === 'milestone-1') return `/assets/images/sections/milestone-1-${sectionSlug}.svg`;
  if (badge.section_asset === 'milestone-2') return `/assets/images/sections/milestone-2-${sectionSlug}.svg`;
  if (badge.section_asset === 'milestone-3') return `/assets/images/sections/milestone-3-${sectionSlug}.svg`;
  if (badge.section_asset === 'peak-award') return `/assets/images/sections/peak-award-${sectionSlug}.svg`;
  if (badge.section_asset === 'section-badge') return `/assets/images/sections/${sectionSlug}-badge.svg`;
  return null;
}

function createPlaceholderTexture(badge) {
  if (badge.shape === 'tape') return createTapeTexture(badge);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const fill = badge.fill || '#ffffff';
  const stroke = badge.stroke || '#100e4c';
  const textColour = badge.text_colour || readableTextColour(fill);

  context.clearRect(0, 0, size, size);
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.lineWidth = 20;

  drawShape(context, badge.shape || 'circle', size);
  context.fill();
  context.stroke();
  drawBadgeDetails(context, badge, size);

  context.fillStyle = textColour;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.font = '800 86px Nunito Sans, Arial';
  wrapText(context, badge.short_label || badge.label, size / 2, size / 2, size * 0.72, 92);

  const texture = new THREE.CanvasTexture(canvas);
  prepareTexture(texture);
  return texture;
}

function createTapeTexture(badge) {
  const width = 2048;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const fill = badge.fill || '#243a88';
  const stroke = badge.stroke || '#17265c';
  const textColour = badge.text_colour || '#f2c230';

  context.clearRect(0, 0, width, height);
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.lineWidth = 10;
  roundRect(context, 8, 8, width - 16, height - 16, 2);
  context.fill();
  context.stroke();

  context.fillStyle = textColour;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  fitSingleLine(context, badge.short_label || badge.label, width / 2, height / 2 + 2, width * 0.9, 168, 56, '500');

  const texture = new THREE.CanvasTexture(canvas);
  prepareTexture(texture);
  return texture;
}

function drawBadgeDetails(context, badge, size) {
  if (badge.shape !== 'tape' || !badge.stitch_colour) return;

  context.save();
  context.strokeStyle = badge.stitch_colour;
  context.lineWidth = 5;
  context.setLineDash([8, 10]);
  context.globalAlpha = 0.9;

  const top = 176;
  const bottom = size - 96;
  [72, size - 72].forEach((x) => {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  });

  context.restore();
}

function drawShape(context, shape, size) {
  const pad = 44;
  const min = pad;
  const max = size - pad;
  const mid = size / 2;

  context.beginPath();
  if (shape === 'rectangle' || shape === 'tape') {
    roundRect(context, pad, 120, size - pad * 2, 270, 34);
  } else if (shape === 'diamond') {
    context.moveTo(mid, 64);
    context.lineTo(size - 64, mid);
    context.lineTo(mid, size - 64);
    context.lineTo(64, mid);
    context.closePath();
  } else if (shape === 'square') {
    roundRect(context, 96, 96, size - 192, size - 192, 42);
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 6 + i * Math.PI / 3;
      const x = mid + Math.cos(angle) * (size * 0.39);
      const y = mid + Math.sin(angle) * (size * 0.39);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  } else {
    context.arc(mid, mid, (max - min) / 2, 0, Math.PI * 2);
  }
}

function fitSingleLine(context, text, x, y, maxWidth, startSize, minSize, weight = '800') {
  let size = startSize;
  do {
    context.font = `${weight} ${size}px Nunito Sans, Arial`;
    if (context.measureText(String(text)).width <= maxWidth) break;
    size -= 2;
  } while (size > minSize);

  context.fillText(String(text), x, y);
}

function roundRect(context, x, y, width, height, radius) {
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((lineText, index) => context.fillText(lineText, x, startY + index * lineHeight));
}

function disposeLayer(layer, state) {
  while (layer.children.length) {
    const child = layer.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }
  state.badgeMeshes = [];
  state.badgeMeshById?.clear();
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function setCamera(camera, target, view) {
  camera.position.copy(vectorFromArray(view.position));
  target.copy(vectorFromArray(view.target));
  camera.lookAt(target);
}

function vectorFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function readableTextColour(hex) {
  const colour = new THREE.Color(hex);
  const luminance = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
  return luminance > 0.58 ? '#100e4c' : '#ffffff';
}
