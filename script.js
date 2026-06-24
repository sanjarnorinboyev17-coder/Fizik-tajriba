// THREE va OrbitControls global o'zgaruvchilar sifatida mavjud (CDN dan yuklandi)

let scene, camera, renderer, controls;
let devices = [], wires = [], terminals = [], sparkParticles = [], bubbleParticles = [];
let polarityLabels = [];
let activeWireMesh = null, selectedTerminal = null, currentMode = 'lamp';
let mainPointLight = null, lampLight2 = null;
let isSwitchOn = false, isElectrolysing = false;
let connections = {};
let connectionPairs = []; // { from, to, mesh, color }
let bulbGlassMat = null, bulbFilamentMat = null;
let lampRegistry = {};
let switchLever = null;
let resistorBody = null;
let ledLensMat = null, ledLight = null;
let motorRotor = null, motorRunning = false;
let resistanceOhm = 15;
let animTime = 0;

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let dragPlane;
let isDragging = false;

const EXPERIMENT_NAMES = {
  lamp: 'Lampochka',
  short: 'Qisqa tutashuv',
  electrolysis: 'Elektroliz',
  parallel: 'Parallel',
  ohm: 'Ohm qonuni',
  led: 'LED qutbi',
  motor: 'Motor',
  series: 'Ketma-ket',
  'dual-battery': '2 batareya',
  rheostat: 'Reostat',
  capacitor: 'Kondensator',
  inductor: 'Induktor',
  diode: 'Diod',
  transformer: 'Transformer',
  solar: 'Quyosh paneli'
};

// Colors
const MAT = {
  plastic: () => new THREE.MeshStandardMaterial({ color: 0x263241, roughness: 0.72, metalness: 0.02 }),
  metal:   () => new THREE.MeshStandardMaterial({ color: 0xc0c5ce, metalness: 0.85, roughness: 0.2 }),
  copper:  () => new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.72, roughness: 0.24 }),
  rubber:  () => new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.82 }),
  gold:    () => new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 }),
  red:     () => new THREE.MeshStandardMaterial({ color: 0xef4444 }),
  green:   () => new THREE.MeshStandardMaterial({ color: 0x22c55e }),
  wire:    (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5 }),
};

// Terminal colors by role
const TERM_COLORS = {
  plus:  0xef4444,
  minus: 0x3b82f6,
  in:    0xf59e0b,
  out:   0x64748b,
};

function termColor(name) {
  if (name === 'el_in')     return 0xef4444;
  if (name === 'el_out')    return 0x3b82f6;
  if (name.includes('plus'))  return 0xef4444;
  if (name.includes('minus')) return 0x3b82f6;
  if (name.includes('_p'))    return 0xef4444;
  if (name.includes('_n'))    return 0x3b82f6;
  if (name.includes('_in'))   return 0xf59e0b;
  if (name.includes('_out'))  return 0x64748b;
  return 0x94a3b8;
}

function wireColor(fromName) {
  if (fromName === 'el_in') return 0xdc2626;
  if (fromName === 'el_out') return 0x2563eb;
  if (fromName.includes('plus') || fromName.includes('_p')) return 0xdc2626;
  if (fromName.includes('minus') || fromName.includes('_n')) return 0x2563eb;
  return 0x334155;
}

// =============================================
// INIT
// =============================================
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd7dde5);
  scene.fog = new THREE.Fog(0xd7dde5, 34, 70);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 7, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Orbit — left drag rotates
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.NONE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.72);
  sun.position.set(8, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.38);
  fill.position.set(-5, 5, -5);
  scene.add(fill);

  createLabRoom();

  // Table surface
  const tableGeo = new THREE.BoxGeometry(18, 0.15, 12);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xaeb7c2, roughness: 0.58, metalness: 0.05 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -0.08;
  table.receiveShadow = true;
  scene.add(table);

  // Grid lines
  const grid = new THREE.GridHelper(18, 18, 0xdde1e7, 0xe8ecf0);
  grid.position.y = 0.001;
  scene.add(grid);

  // Table legs
  [[-8.5,-5.5],[8.5,-5.5],[-8.5,5.5],[8.5,5.5]].forEach(([x,z]) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 })
    );
    leg.position.set(x, -1.1, z);
    leg.castShadow = true;
    scene.add(leg);
  });

  // Wire drag plane — sits at klemma height
  dragPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  dragPlane.rotation.x = -Math.PI / 2;
  dragPlane.position.y = 0.5;
  scene.add(dragPlane);

  setupEvents();
  loadExperiment('lamp');
  animate();
}

function createLabRoom() {
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 0.78, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.82 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.72 });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x56616f, roughness: 0.54, metalness: 0.08 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd7ff,
    transparent: true,
    opacity: 0.36,
    roughness: 0.08,
    metalness: 0.02
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 34), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.18;
  floor.receiveShadow = true;
  scene.add(floor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(42, 12, 0.18), wallMat);
  backWall.position.set(0, 4.5, -12.2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 12, 28), wallMat);
  leftWall.position.set(-18.5, 4.5, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 12, 28), wallMat);
  rightWall.position.set(18.5, 4.5, 0);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  const wallBand = new THREE.Mesh(new THREE.BoxGeometry(42, 0.18, 0.2), accentMat);
  wallBand.position.set(0, 1.8, -12.08);
  scene.add(wallBand);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 2.4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x254b3f, roughness: 0.86 })
  );
  board.position.set(-5.3, 3.8, -12.0);
  scene.add(board);

  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5.95, 2.75, 0.05), MAT.metal());
  boardFrame.position.set(-5.3, 3.8, -12.07);
  boardFrame.scale.z = 0.25;
  scene.add(boardFrame);

  [['U = I · R', -5.3, 4.25], ['+  −', -5.3, 3.65], ['Zanjir', -5.3, 3.15]].forEach(([text, x, y]) => {
    const label = makeLabel(text, 0xe8fff4);
    label.scale.set(1.8, 1.8, 1.8);
    label.position.set(x, y, -11.93);
    scene.add(label);
  });

  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(4.7, 2.7, 0.08), MAT.metal());
  windowFrame.position.set(5.4, 4.25, -12.04);
  scene.add(windowFrame);
  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(4.3, 2.3, 0.05), glassMat);
  windowGlass.position.set(5.4, 4.25, -11.98);
  scene.add(windowGlass);
  for (const x of [4.3, 6.5]) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.35, 0.06), MAT.metal());
    divider.position.set(x, 4.25, -11.94);
    scene.add(divider);
  }
  const horizon = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.55, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x78b6dd, roughness: 0.5 })
  );
  horizon.position.set(5.4, 3.68, -11.92);
  scene.add(horizon);

  for (const x of [-12.5, 12.5]) {
    const shelf = new THREE.Group();
    shelf.position.set(x, 0, -11.8);

    for (const y of [1.3, 2.3, 3.3]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.65), MAT.metal());
      plank.position.set(0, y, 0);
      plank.castShadow = true;
      shelf.add(plank);
    }

    for (let i = 0; i < 5; i++) {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 0.55 + (i % 2) * 0.14, 18),
        new THREE.MeshStandardMaterial({
          color: [0x60a5fa, 0x34d399, 0xfbbf24, 0xf87171, 0xa78bfa][i],
          transparent: true,
          opacity: 0.72,
          roughness: 0.18
        })
      );
      bottle.position.set(-1.6 + i * 0.48, 2.68, 0);
      bottle.castShadow = true;
      shelf.add(bottle);
    }

    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.55), cabinetMat);
      box.position.set(-1.1 + i * 1.05, 1.62, 0);
      box.castShadow = true;
      shelf.add(box);
    }
    scene.add(shelf);
  }

  const backBench = new THREE.Group();
  backBench.position.set(0, -0.75, -8.65);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.28, 1.25),
    new THREE.MeshStandardMaterial({ color: 0x394452, roughness: 0.5, metalness: 0.08 })
  );
  counter.position.y = 1.35;
  counter.castShadow = true;
  counter.receiveShadow = true;
  backBench.add(counter);

  for (let i = 0; i < 5; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.15, 1.05), cabinetMat);
    cab.position.set(-4.35 + i * 2.15, 0.65, 0);
    cab.castShadow = true;
    cab.receiveShadow = true;
    backBench.add(cab);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.035), MAT.metal());
    handle.position.set(cab.position.x, 0.8, 0.55);
    handle.castShadow = true;
    backBench.add(handle);
  }

  const sink = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, 0.62),
    new THREE.MeshStandardMaterial({ color: 0xa7b0bd, roughness: 0.18, metalness: 0.72 })
  );
  sink.position.set(3.25, 1.52, 0.05);
  backBench.add(sink);

  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 24, Math.PI), MAT.metal());
  faucet.position.set(3.25, 1.76, -0.18);
  faucet.rotation.z = Math.PI;
  backBench.add(faucet);

  for (let i = 0; i < 4; i++) {
    const flask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 0.48, 18),
      new THREE.MeshStandardMaterial({
        color: [0x38bdf8, 0xf472b6, 0x4ade80, 0xfacc15][i],
        transparent: true,
        opacity: 0.68,
        roughness: 0.12
      })
    );
    flask.position.set(-4.4 + i * 0.55, 1.72, 0.05);
    flask.castShadow = true;
    backBench.add(flask);
  }

  const oscilloscope = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.62, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.42 })
  );
  oscilloscope.position.set(-1.0, 1.72, 0.0);
  oscilloscope.castShadow = true;
  backBench.add(oscilloscope);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.34, 0.025),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  screen.position.set(-1.0, 1.76, 0.38);
  backBench.add(screen);

  scene.add(backBench);

  for (const x of [-4.5, 0, 4.5]) {
    const lightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.08, 0.75),
      new THREE.MeshBasicMaterial({ color: 0xf8fbff })
    );
    lightPanel.position.set(x, 8.3, -2.5);
    scene.add(lightPanel);

    const labLight = new THREE.PointLight(0xf4f8ff, 0.42, 12);
    labLight.position.set(x, 7.8, -2.2);
    scene.add(labLight);
  }

  const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.06), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
  outlet.position.set(10.4, 1.15, -11.93);
  scene.add(outlet);
  [-0.16, 0.16].forEach(dx => {
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x1f2937 }));
    socket.rotation.x = Math.PI / 2;
    socket.position.set(10.4 + dx, 1.15, -11.88);
    scene.add(socket);
  });
}

// =============================================
// TERMINAL HELPER
// =============================================
function terminalLabelText(name) {
  if (name === 'el_in') return '+';
  if (name === 'el_out') return '-';
  if (name.includes('plus') || name.includes('_p')) return '+';
  if (name.includes('minus') || name.includes('_n')) return '-';
  if (name.includes('_in')) return 'IN';
  if (name.includes('_out')) return 'OUT';
  return '';
}

function createPoleMarker(labelText, col) {
  const marker = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.035, 32),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.02 })
  );
  plate.position.y = 0.45;
  plate.castShadow = true;
  marker.add(plate);

  const signMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.32, metalness: 0.05 });
  const minusBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.026, 0.06), signMat);
  minusBar.position.y = 0.48;
  minusBar.castShadow = true;
  marker.add(minusBar);

  if (labelText === '+') {
    const plusBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.028, 0.28), signMat);
    plusBar.position.y = 0.485;
    plusBar.castShadow = true;
    marker.add(plusBar);
  }

  return marker;
}

function createTerminal(name, parentGroup, x, y, z) {
  const col = termColor(name);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.name = name;
  const leadDir = Math.abs(x) >= Math.abs(z)
    ? new THREE.Vector3(Math.sign(x) || 1, 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(z) || 1);

  // Collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.3 })
  );
  g.add(collar);

  // Post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.2 })
  );
  post.position.y = 0.13;
  post.name = name; // raycast target
  g.add(post);

  // Label disc
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: col })
  );
  disc.position.y = 0.23;
  disc.name = name;
  g.add(disc);

  // Glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.015, 8, 24),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  ring.name = name + '_ring';
  g.add(ring);

  const labelText = terminalLabelText(name);
  if (labelText) {
    const labelColor = labelText === '+' ? 0xef4444 : labelText === '-' ? 0x2563eb : 0x111827;
    const sign = makeLabel(labelText, labelColor);
    sign.scale.setScalar(labelText.length > 1 ? 0.46 : 0.82);
    sign.position.y = 0.64;
    sign.renderOrder = 2;
    sign.userData.isPolarityLabel = true;
    g.add(sign);
    polarityLabels.push(sign);

    if (labelText === '+' || labelText === '-') {
      g.add(createPoleMarker(labelText, labelColor));
    }
  }

  // Short lead wire so every terminal visibly has a wire end before it is connected.
  const stubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.48, 10);
  const stub = new THREE.Mesh(stubGeo, MAT.wire(wireColor(name)));
  if (Math.abs(leadDir.x) > 0) {
    stub.rotation.z = Math.PI / 2;
    stub.position.set(leadDir.x * 0.3, 0.12, 0);
  } else {
    stub.rotation.x = Math.PI / 2;
    stub.position.set(0, 0.12, leadDir.z * 0.3);
  }
  stub.castShadow = true;
  g.add(stub);

  const stubTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.25 })
  );
  stubTip.position.set(leadDir.x * 0.55, 0.12, leadDir.z * 0.55);
  stubTip.castShadow = true;
  g.add(stubTip);

  parentGroup.add(g);

  // Register the post as a raycast target
  post.userData.terminalName = name;
  disc.userData.terminalName = name;
  post.userData.isTerminal = true;
  disc.userData.isTerminal = true;
  terminals.push(post);
  terminals.push(disc);
}

function clearLab() {
  Object.values(lampRegistry).forEach(lamp => {
    if (lamp.light) scene.remove(lamp.light);
  });
  devices.forEach(d => scene.remove(d));
  wires.forEach(w => { w.geometry.dispose(); scene.remove(w); });
  sparkParticles.forEach(p => { scene.remove(p); });
  bubbleParticles.forEach(b => { scene.remove(b); });
  if (mainPointLight) { scene.remove(mainPointLight); mainPointLight = null; }
  if (lampLight2) { scene.remove(lampLight2); lampLight2 = null; }

  devices = []; wires = []; terminals = []; sparkParticles = []; bubbleParticles = [];
  polarityLabels = [];
  connectionPairs = [];
  connections = {};
  activeWireMesh = null; selectedTerminal = null;
  isSwitchOn = false; isElectrolysing = false;
  switchLever = null; bulbGlassMat = null; bulbFilamentMat = null;
  lampRegistry = {};
  resistorBody = null;
  if (ledLight) { scene.remove(ledLight); ledLight = null; }
  ledLensMat = null;
  motorRotor = null;
  motorRunning = false;
  document.getElementById('ohm-controls').style.display = 'none';
  updateMeters(0, 0);
}

// =============================================
// DEVICES
// =============================================
function makeLabel(text, color = 0x1e293b) {
  // Simple canvas texture label
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, 128, 32);
  ctx.fillStyle = '#' + color.toString(16).padStart(6,'0');
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 16);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
}

function spawnBattery(x, z, id = '') {
  const g = new THREE.Group();
  g.position.set(x, 0.18, z);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 1.1), MAT.plastic());
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // Stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.1, 1.12), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }));
  stripe.position.y = 0.08; g.add(stripe);

  // Plus/minus symbols (colored ends)
  const plusEnd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 1.1), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
  plusEnd.position.x = -0.86; g.add(plusEnd);
  const minusEnd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 1.1), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
  minusEnd.position.x = 0.86; g.add(minusEnd);

  const lbl = makeLabel('9V');
  lbl.position.set(0, 0.21, 0); lbl.rotation.x = -Math.PI/2;
  g.add(lbl);

  const plusLbl = makeLabel('+', 0xffffff);
  plusLbl.scale.setScalar(0.75);
  plusLbl.position.set(-0.86, 0.28, 0.36);
  plusLbl.rotation.x = -Math.PI / 2;
  g.add(plusLbl);

  const minusLbl = makeLabel('-', 0xffffff);
  minusLbl.scale.setScalar(0.75);
  minusLbl.position.set(0.86, 0.28, 0.36);
  minusLbl.rotation.x = -Math.PI / 2;
  g.add(minusLbl);

  createTerminal('bat' + id + '_plus', g, -0.65, 0.22, 0);
  createTerminal('bat' + id + '_minus', g, 0.65, 0.22, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnLamp(x, z, id = '') {
  const g = new THREE.Group();
  g.position.set(x, 0.1, z);
  const lampKey = id || 'main';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.26, 24), MAT.plastic());
  base.castShadow = true; base.receiveShadow = true; g.add(base);

  // Screw base
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.22, 16), MAT.metal());
  screw.position.y = 0.24; g.add(screw);

  // Bulb glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.22,
    roughness: 0, metalness: 0,
    emissive: new THREE.Color(0x000000)
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 20), glassMat);
  bulb.position.y = 0.65; g.add(bulb);

  // Filament (thin cylinder inside)
  const filamentMat = new THREE.MeshBasicMaterial({ color: 0x4a3000 });
  const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6), filamentMat);
  fil.position.y = 0.65; g.add(fil);

  // Support wire visuals
  for (let i = 0; i < 2; i++) {
    const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4),
      new THREE.MeshBasicMaterial({ color: 0x888888 }));
    sw.position.set((i===0?-0.04:0.04), 0.48, 0);
    g.add(sw);
  }

  createTerminal('lamp' + id + '_in', g, -0.3, 0.13, 0);
  createTerminal('lamp' + id + '_out', g, 0.3, 0.13, 0);

  lampRegistry[lampKey] = { group: g, glassMat, filamentMat, light: null };
  bulbGlassMat = glassMat;
  bulbFilamentMat = filamentMat;

  scene.add(g); devices.push(g);
  return g;
}

function spawnResistor(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.15, z);

  resistorBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.34, 0.46),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.05 })
  );
  resistorBody.castShadow = true;
  resistorBody.receiveShadow = true;
  g.add(resistorBody);

  [-0.28, 0, 0.28].forEach((xPos, idx) => {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.36, 0.48),
      new THREE.MeshStandardMaterial({ color: [0x111827, 0xfacc15, 0x7c3aed][idx], roughness: 0.4 })
    );
    band.position.x = xPos;
    g.add(band);
  });

  const leftLead = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10), MAT.metal());
  leftLead.rotation.z = Math.PI / 2;
  leftLead.position.x = -0.9;
  g.add(leftLead);

  const rightLead = leftLead.clone();
  rightLead.position.x = 0.9;
  g.add(rightLead);

  const lbl = makeLabel('R');
  lbl.position.set(0, 0.22, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('res_in', g, -0.75, 0.16, 0);
  createTerminal('res_out', g, 0.75, 0.16, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnLed(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.78), MAT.rubber());
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  ledLensMat = new THREE.MeshStandardMaterial({
    color: 0xf87171,
    emissive: new THREE.Color(0x220000),
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.72,
    roughness: 0.08
  });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), ledLensMat);
  lens.position.y = 0.38;
  lens.scale.y = 1.25;
  lens.castShadow = true;
  g.add(lens);

  const anode = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8), MAT.copper());
  anode.rotation.z = Math.PI / 2;
  anode.position.set(-0.38, 0.18, 0);
  g.add(anode);

  const cathode = anode.clone();
  cathode.position.x = 0.38;
  g.add(cathode);

  const lbl = makeLabel('LED');
  lbl.position.set(0, 0.13, 0.42);
  lbl.rotation.x = -Math.PI / 2 + 0.25;
  g.add(lbl);

  createTerminal('led_p', g, -0.52, 0.12, 0);
  createTerminal('led_n', g, 0.52, 0.12, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnMotor(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.18, z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 1.0), MAT.rubber());
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.78, 28),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.65, roughness: 0.28 })
  );
  can.rotation.z = Math.PI / 2;
  can.position.y = 0.36;
  can.castShadow = true;
  g.add(can);

  motorRotor = new THREE.Group();
  motorRotor.position.set(0, 0.36, 0.52);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.03, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.1 })
    );
    blade.position.z = 0.24;
    blade.rotation.y = (Math.PI * 2 / 3) * i;
    motorRotor.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), MAT.metal());
  motorRotor.add(hub);
  g.add(motorRotor);

  const lbl = makeLabel('MOTOR');
  lbl.position.set(0, 0.14, -0.45);
  lbl.rotation.x = -Math.PI / 2 + 0.25;
  g.add(lbl);

  createTerminal('motor_p', g, -0.56, 0.12, -0.18);
  createTerminal('motor_n', g, 0.56, 0.12, -0.18);

  scene.add(g); devices.push(g);
  return g;
}

function spawnSwitch(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.08, z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
  base.castShadow = true; base.receiveShadow = true; g.add(base);

  // Rails
  for (let s of [-1,1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.04, 0.08), MAT.metal());
    rail.position.set(0, 0.1, s * 0.3); g.add(rail);
  }

  // Pivot post
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 12), MAT.metal());
  pivot.position.y = 0.15; g.add(pivot);

  // Lever
  const lev = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3 }));
  lev.position.y = 0.28;
  lev.rotation.z = -0.7;
  lev.name = 'lever_handle';
  lev.userData.isSwitchLever = true;
  g.add(lev);
  switchLever = lev;

  const lbl = makeLabel('KALIT', 0xffffff);
  lbl.position.set(0, 0.12, 0.56); lbl.rotation.x = -Math.PI/2 + 0.3;
  g.add(lbl);

  createTerminal('sw_in', g, -0.45, 0.12, 0);
  createTerminal('sw_out', g, 0.45, 0.12, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnElectrolysis(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.name = 'el_container';

  // Beaker body (open-top cylinder)
  const beakerMat = new THREE.MeshStandardMaterial({
    color: 0xd0eeff, transparent: true, opacity: 0.35,
    roughness: 0, metalness: 0, side: THREE.DoubleSide
  });
  const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.65, 1.2, 28, 1, true), beakerMat);
  beaker.position.y = 0.6; g.add(beaker);

  // Bottom disc
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.65, 28), beakerMat);
  bottom.rotation.x = -Math.PI/2; g.add(bottom);

  // Water
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9, transparent: true, opacity: 0.35,
    roughness: 0.2
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.62, 0.85, 24), waterMat);
  water.position.y = 0.42; g.add(water);

  // Electrodes
  for (let [xp, col, nm] of [[-0.25, 0xef4444, '+'],[0.25, 0x3b82f6, '-']]) {
    const elMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.8, roughness: 0.2 });
    const el = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.18), elMat);
    el.position.set(xp, 0.58, 0); g.add(el);

    const elLbl = makeLabel(nm, col);
    elLbl.position.set(xp, 1.1, 0.2); elLbl.rotation.x = -0.3;
    g.add(elLbl);
  }

  createTerminal('el_in', g, -0.25, 1.08, 0);
  createTerminal('el_out', g, 0.25, 1.08, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnCapacitor(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.15, z);

  const plate1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.5), MAT.metal());
  plate1.position.set(-0.22, 0.1, 0);
  plate1.castShadow = true;
  g.add(plate1);

  const plate2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.5), MAT.metal());
  plate2.position.set(0.22, 0.1, 0);
  plate2.castShadow = true;
  g.add(plate2);

  const separator = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.55), new THREE.MeshStandardMaterial({ color: 0xff8c00 }));
  separator.position.set(0, 0.08, 0);
  g.add(separator);

  const lbl = makeLabel('C');
  lbl.position.set(0, 0.22, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('cap_in', g, -0.75, 0.16, 0);
  createTerminal('cap_out', g, 0.75, 0.16, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnInductor(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.15, z);

  for (let i = 0; i < 5; i++) {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.04, 8, 20),
      MAT.copper()
    );
    coil.rotation.x = Math.PI / 2;
    coil.position.x = -0.35 + i * 0.18;
    coil.castShadow = true;
    g.add(coil);
  }

  const lbl = makeLabel('L');
  lbl.position.set(0, 0.22, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('ind_in', g, -0.75, 0.16, 0);
  createTerminal('ind_out', g, 0.75, 0.16, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnDiode(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.12, z);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 20), MAT.rubber());
  body.castShadow = true;
  g.add(body);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  stripe.position.z = 0.08;
  g.add(stripe);

  const lead1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), MAT.metal());
  lead1.rotation.z = Math.PI / 2;
  lead1.position.set(-0.5, 0, 0);
  g.add(lead1);

  const lead2 = lead1.clone();
  lead2.position.x = 0.5;
  g.add(lead2);

  const lbl = makeLabel('D');
  lbl.position.set(0, 0.22, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('diod_p', g, -0.65, 0.12, 0);
  createTerminal('diod_n', g, 0.65, 0.12, 0);

  scene.add(g); devices.push(g);
  return g;
}

function spawnTransformer(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.18, z);

  const core = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.35), MAT.metal());
  core.castShadow = true;
  g.add(core);

  [-0.4, 0.4].forEach(xp => {
    for (let i = 0; i < 6; i++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.025, 8, 16),
        MAT.copper()
      );
      coil.rotation.x = Math.PI / 2;
      coil.position.set(xp, -0.3 + i * 0.16, 0);
      coil.castShadow = true;
      g.add(coil);
    }
  });

  const lbl = makeLabel('T');
  lbl.position.set(0, 0.22, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('trf_in1', g, -0.65, 0.12, -0.2);
  createTerminal('trf_in2', g, -0.65, 0.12, 0.2);
  createTerminal('trf_out1', g, 0.65, 0.12, -0.2);
  createTerminal('trf_out2', g, 0.65, 0.12, 0.2);

  scene.add(g); devices.push(g);
  return g;
}

function spawnSolarPanel(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.2, z);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.3, metalness: 0.1 })
  );
  panel.castShadow = true;
  panel.receiveShadow = true;
  g.add(panel);

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.15, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x06b6d4, emissiveIntensity: 0.3 })
      );
      cell.position.set(-0.7 + i * 0.3, 0.25 - j * 0.22, 0.04);
      g.add(cell);
    }
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.85, 0.08), MAT.metal());
  frame.position.z = -0.02;
  g.add(frame);

  const lbl = makeLabel('☀️');
  lbl.position.set(0, 0.5, 0); lbl.rotation.x = -Math.PI / 2;
  g.add(lbl);

  createTerminal('sol_p', g, -0.9, 0.12, 0);
  createTerminal('sol_n', g, 0.9, 0.12, 0);

  scene.add(g); devices.push(g);
  return g;
}
function buildWireGeo(p1, p2) {
  const dist = p1.distanceTo(p2);
  // Arc height: minimum so it's always visible, proportional to distance
  const h = 0.5 + dist * 0.32;
  const segs = 28;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = new THREE.Vector3().lerpVectors(p1, p2, t);
    p.y += Math.sin(t * Math.PI) * h;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 36, 0.038, 8, false);
}

function worldPos(obj) {
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return v;
}

// =============================================
// EXPERIMENT LOADING
// =============================================
function loadExperiment(type) {
  currentMode = type;
  clearLab();
  setStatus('Kabel simlarini ulang...', '');

  document.querySelectorAll('.btn-exp').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + type).classList.add('active');
  const activeLabel = document.getElementById('active-experiment');
  if (activeLabel) activeLabel.textContent = EXPERIMENT_NAMES[type] || 'Tajriba';

  if (type === 'lamp') {
    spawnBattery(-2.8, -0.5);
    spawnSwitch(0, 0.7);
    spawnLamp(2.8, -0.5);
    setStatus('Batareya → Kalit → Lampochka tartibida ulang', 'info');
    setGuide('Sxema: Bat(+) → Kalit IN, Kalit OUT → Lampa IN, Lampa OUT → Bat(-). Oxirida kalitni bosing.');
  }
  else if (type === 'short') {
    spawnBattery(0, 0);
    setStatus("Batareyaning (+) va (-) klemmasini to'g'ridan-to'g'ri ulang!", 'warning');
    setGuide('Bu xavfli holatni ko‘rsatish tajribasi. Bat(+) ni Bat(-) ga to‘g‘ridan-to‘g‘ri ulang va qisqa tutashuv nima uchun xavfli ekanini ko‘ring.', 'warning');
  }
  else if (type === 'electrolysis') {
    spawnBattery(-3, 0);
    spawnElectrolysis(2, 0);
    setStatus('Batareyani elektrod klemmalarga ulang', 'info');
    setGuide('Sxema: Bat(+) → Elektrod(+), Bat(-) → Elektrod(-). Qutblar almashsa ham elektroliz bo‘ladi, lekin gazlar joyi almashadi.');
  }
  else if (type === 'parallel') {
    spawnBattery(0, 1.5);
    spawnLamp(-2.2, -1, 'A');
    spawnLamp(2.2, -1, 'B');
    setStatus('Ikkala lampochkani parallel ulang', 'info');
    setGuide('Sxema: Bat(+) dan ikkala lampaning IN klemmasiga alohida sim, Bat(-) dan ikkala OUT klemmasiga alohida sim torting.');
  }
  else if (type === 'ohm') {
    resistanceOhm = 15;
    spawnBattery(-3, 0);
    spawnResistor(0, 0);
    spawnLamp(3, 0);
    document.getElementById('ohm-controls').style.display = 'block';
    updateResistanceReadout();
    setStatus('Batareya → rezistor → lampochka zanjirini ulang', 'info');
    setGuide('Sxema: Bat(+) → Rezistor IN, Rezistor OUT → Lampa IN, Lampa OUT → Bat(-). Keyin R tugmalari bilan qarshilikni o‘zgartiring.');
  }
  else if (type === 'led') {
    spawnBattery(-2.4, 0);
    spawnResistor(0, 0);
    spawnLed(2.4, 0);
    setStatus('LED qutblarini to‘g‘ri ulang', 'info');
    setGuide('Sxema: Bat(+) → Rezistor IN, Rezistor OUT → LED(+), LED(-) → Bat(-). LED teskari ulansa yonmaydi.');
  }
  else if (type === 'motor') {
    spawnBattery(-2.6, 0);
    spawnSwitch(0, 0.6);
    spawnMotor(2.6, -0.1);
    setStatus('Motorni kalit orqali ulang', 'info');
    setGuide('Sxema: Bat(+) → Kalit IN, Kalit OUT → Motor(+), Motor(-) → Bat(-). Kalitni bosganda parrak aylanishi kerak.');
  }
  else if (type === 'series') {
    spawnBattery(-3, 0);
    spawnLamp(0, 0, 'A');
    spawnLamp(3, 0, 'B');
    setStatus('Ikki lampochkani ketma-ket ulang', 'info');
    setGuide('Sxema: Bat(+) → LampaA IN, LampaA OUT → LampaB IN, LampaB OUT → Bat(-). Ketma-ket zanjirda lampalar xira yonadi.');
  }
  else if (type === 'dual-battery') {
    spawnBattery(-3.2, 0.8, 'A');
    spawnBattery(-0.8, 0.8, 'B');
    spawnLamp(2.8, 0);
    setStatus('Ikki batareyani ketma-ket ulab, lampaga ulang', 'info');
    setGuide('Sxema: BatA(+) → BatB(-), BatB(+) → Lampa IN, Lampa OUT → BatA(-). Kuchlanishlar qo‘shilib 18 V bo‘ladi.');
  }
  else if (type === 'rheostat') {
    resistanceOhm = 25;
    spawnBattery(-3, 0);
    spawnResistor(0, 0);
    spawnLamp(3, 0);
    document.getElementById('ohm-controls').style.display = 'block';
    updateResistanceReadout();
    setStatus('Reostat bilan lampochka yorqinligini boshqaring', 'info');
    setGuide('Sxema: Bat(+) → Rezistor IN, Rezistor OUT → Lampa IN, Lampa OUT → Bat(-). R qiymatini o‘zgartirib yorqinlikni kuzating.');
  }
  else if (type === 'capacitor') {
    spawnBattery(-3, 0);
    spawnCapacitor(0, 0);
    spawnLamp(3, 0);
    setStatus('Kondensatorga tok qo\'yish va chiqitish', 'info');
    setGuide('Sxema: Bat(+) → Kondensator → Lampa → Bat(-). Kondensator yumshoq yonadi, faqat qo\'yish vaqtida.');
  }
  else if (type === 'inductor') {
    spawnBattery(-3, 0);
    spawnInductor(0, 0);
    spawnLamp(3, 0);
    setStatus('Induktor magnit tuyuligini ko\'rsatadi', 'info');
    setGuide('Sxema: Bat(+) → Induktor → Lampa → Bat(-). Induktor tok o\'zgarishiga qarshilik qiladi.');
  }
  else if (type === 'diode') {
    spawnBattery(-3, 0);
    spawnDiode(0, 0);
    spawnLamp(3, 0);
    setStatus('Diod bir tomonga tokni beradi', 'info');
    setGuide('Sxema: Bat(+) → Diod(+) → Lampa → Bat(-). Diod teskari bo\'lsa lampa yonmaydi.');
  }
  else if (type === 'transformer') {
    spawnBattery(-3, 0);
    spawnTransformer(0, 0);
    spawnLamp(3, 0);
    setStatus('Transformer kuchlanishni o\'zgartiradi', 'info');
    setGuide('Sxema: Bat(+) → Transformer IN → OUT → Lampa → Bat(-). Trafo spiralelari soni nisbati kuchlanishni o\'zgartiradi.');
  }
  else if (type === 'solar') {
    spawnSolarPanel(-2, 0);
    spawnLamp(2, 0);
    setStatus('Quyosh paneli nurdan elektr hosil qiladi', 'info');
    setGuide('Sxema: Quyosh paneli → Lampa. Panelni kameranis yordamida buringuz va nur o\'zgarishini kuzating.');
  }
}

function resetWires() {
  wires.forEach(w => { w.geometry.dispose(); scene.remove(w); });
  wires = [];
  connectionPairs = [];
  connections = {};
  if (activeWireMesh) { scene.remove(activeWireMesh); activeWireMesh = null; }
  selectedTerminal = null;
  isSwitchOn = false; isElectrolysing = false;
  if (switchLever) { switchLever.rotation.z = -0.7; }
  resetVisuals();
  updateConnList();
  setStatus('Simlar tozalandi. Qaytadan ulang.', '');
  updateMeters(0, 0);
}

// =============================================
// EVENTS
// =============================================
function getTerminalFromIntersect(obj) {
  if (obj.userData && obj.userData.isTerminal) return obj;
  return null;
}

function hasConnection(a, b) {
  return Array.isArray(connections[a]) && connections[a].includes(b);
}

function addConnection(a, b) {
  if (!connections[a]) connections[a] = [];
  if (!connections[b]) connections[b] = [];
  if (!connections[a].includes(b)) connections[a].push(b);
  if (!connections[b].includes(a)) connections[b].push(a);
}

function hasAnyConnection(name) {
  return Array.isArray(connections[name]) && connections[name].length > 0;
}

function setupEvents() {
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    clampDraggablePanels();
  });
  setupDraggablePanels();
}

const PANEL_POSITION_KEYS = {
  ui: 'physics-lab-ui-position',
  'voltage-panel': 'physics-lab-meter-position'
};

function setupDraggablePanels() {
  ['ui', 'voltage-panel'].forEach(id => {
    const panel = document.getElementById(id);
    const handle = panel?.querySelector('[data-drag-handle]');
    if (!panel || !handle) return;

    restorePanelPosition(panel);
    let drag = null;

    handle.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
      panel.classList.add('is-dragging');
      event.preventDefault();
    });

    handle.addEventListener('pointermove', event => {
      if (!drag) return;
      movePanel(panel, event.clientX - drag.x, event.clientY - drag.y);
    });

    const finishDrag = event => {
      if (!drag) return;
      drag = null;
      panel.classList.remove('is-dragging');
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      savePanelPosition(panel);
    };
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('dblclick', () => resetPanelPosition(panel));
  });
}

function movePanel(panel, left, top) {
  const rect = panel.getBoundingClientRect();
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  panel.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
  panel.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}

function savePanelPosition(panel) {
  const key = PANEL_POSITION_KEYS[panel.id];
  if (!key) return;
  localStorage.setItem(key, JSON.stringify({ left: panel.style.left, top: panel.style.top }));
}

function restorePanelPosition(panel) {
  const key = PANEL_POSITION_KEYS[panel.id];
  const saved = key && localStorage.getItem(key);
  if (!saved) return;
  try {
    const { left, top } = JSON.parse(saved);
    if (left && top) movePanel(panel, parseFloat(left), parseFloat(top));
  } catch (_) {
    localStorage.removeItem(key);
  }
}

function resetPanelPosition(panel) {
  const key = PANEL_POSITION_KEYS[panel.id];
  if (key) localStorage.removeItem(key);
  panel.style.left = '';
  panel.style.top = '';
  panel.style.right = '';
  panel.style.bottom = '';
}

function clampDraggablePanels() {
  ['ui', 'voltage-panel'].forEach(id => {
    const panel = document.getElementById(id);
    if (panel?.style.left && panel.style.top) movePanel(panel, parseFloat(panel.style.left), parseFloat(panel.style.top));
  });
}

function getMouse(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onPointerDown(e) {
  getMouse(e);
  raycaster.setFromCamera(mouse, camera);

  // Check switch lever first
  const allObjs = [];
  scene.traverse(o => { if (o.isMesh) allObjs.push(o); });
  const hits = raycaster.intersectObjects(allObjs, false);

  if (hits.length > 0) {
    const obj = hits[0].object;

    if (obj.userData.isSwitchLever) {
      isSwitchOn = !isSwitchOn;
      obj.rotation.z = isSwitchOn ? 0.7 : -0.7;
      calculateCircuit();
      return;
    }

    const term = getTerminalFromIntersect(obj);
    if (term) {
      selectedTerminal = term;
      isDragging = true;
      controls.enabled = false;

      const startP = worldPos(selectedTerminal);
      const col = wireColor(selectedTerminal.userData.terminalName);
      const geo = buildWireGeo(startP, startP.clone().add(new THREE.Vector3(0.01,0,0)));
      activeWireMesh = new THREE.Mesh(geo, MAT.wire(col));
      activeWireMesh.castShadow = true;
      scene.add(activeWireMesh);
    }
  }
}

function onPointerMove(e) {
  if (!selectedTerminal || !activeWireMesh || !isDragging) return;
  getMouse(e);
  raycaster.setFromCamera(mouse, camera);

  const planeHit = raycaster.intersectObject(dragPlane);
  if (planeHit.length === 0) return;

  let target = planeHit[0].point;

  // Snap check
  const allObjs = [];
  scene.traverse(o => { if (o.isMesh && o.userData.isTerminal && o !== selectedTerminal) allObjs.push(o); });
  const snapHit = raycaster.intersectObjects(allObjs, false);
  if (snapHit.length > 0) {
    target = worldPos(snapHit[0].object);
  }

  activeWireMesh.geometry.dispose();
  activeWireMesh.geometry = buildWireGeo(worldPos(selectedTerminal), target);
}

function onPointerUp(e) {
  if (!isDragging || !selectedTerminal) return;
  isDragging = false;
  controls.enabled = true;
  getMouse(e);
  raycaster.setFromCamera(mouse, camera);

  const allObjs = [];
  scene.traverse(o => { if (o.isMesh && o.userData.isTerminal && o !== selectedTerminal) allObjs.push(o); });
  const hits = raycaster.intersectObjects(allObjs, false);

  if (hits.length > 0) {
    const targetTerm = hits[0].object;
    const fromName = selectedTerminal.userData.terminalName;
    const toName = targetTerm.userData.terminalName;

    // Prevent exact duplicate wires, but allow shared terminals for parallel circuits.
    if (!hasConnection(fromName, toName)) {
      const p1 = worldPos(selectedTerminal);
      const p2 = worldPos(targetTerm);
      const col = wireColor(fromName);

      if (activeWireMesh) { activeWireMesh.geometry.dispose(); scene.remove(activeWireMesh); activeWireMesh = null; }

      const geo = buildWireGeo(p1, p2);
      const mesh = new THREE.Mesh(geo, MAT.wire(col));
      mesh.castShadow = true;
      scene.add(mesh); wires.push(mesh);

      addConnection(fromName, toName);
      connectionPairs.push({ from: fromName, to: toName, col });

      updateConnList();
      calculateCircuit();
    } else {
      // Already connected
      if (activeWireMesh) { scene.remove(activeWireMesh); activeWireMesh = null; }
      setStatus("Bu klemma allaqachon ulangan!", 'warning');
    }
  } else {
    if (activeWireMesh) { scene.remove(activeWireMesh); activeWireMesh = null; }
  }

  selectedTerminal = null;
}

// =============================================
// CIRCUIT LOGIC
// =============================================
function connected(a, b) {
  return hasConnection(a, b);
}

function setLampState(key, on, intensity = 1) {
  const lamp = lampRegistry[key];
  if (!lamp) return;

  if (on) {
    lamp.glassMat.color.setHex(0xfffde0);
    lamp.glassMat.emissive.setHex(0xfbbf24);
    lamp.glassMat.emissiveIntensity = 0.45 * intensity;
    lamp.glassMat.opacity = 0.72;
    lamp.filamentMat.color.setHex(0xff6600);

    if (!lamp.light) {
      lamp.light = new THREE.PointLight(0xfbbf24, 3 * intensity, 7);
      const p = new THREE.Vector3();
      lamp.group.getWorldPosition(p);
      p.y += 0.75;
      lamp.light.position.copy(p);
      scene.add(lamp.light);
    }
    lamp.light.intensity = 3 * intensity;
  } else {
    lamp.glassMat.emissive.setHex(0x000000);
    lamp.glassMat.emissiveIntensity = 0;
    lamp.glassMat.opacity = 0.22;
    lamp.glassMat.color.setHex(0xffffff);
    lamp.filamentMat.color.setHex(0x4a3000);
    if (lamp.light) {
      scene.remove(lamp.light);
      lamp.light = null;
    }
  }
}

function resetAllLamps() {
  Object.keys(lampRegistry).forEach(key => setLampState(key, false));
}

function updateResistanceReadout() {
  const readout = document.getElementById('resistance-readout');
  if (readout) readout.textContent = 'Qarshilik: ' + resistanceOhm + ' Ω';
}

function adjustResistance(delta) {
  resistanceOhm = Math.max(5, Math.min(60, resistanceOhm + delta));
  updateResistanceReadout();
  if (resistorBody) {
    const hot = Math.max(0, 1 - resistanceOhm / 60);
    resistorBody.material.color.setHSL(0.08, 0.9, 0.42 + hot * 0.16);
  }
  calculateCircuit();
}

function setLedState(on) {
  if (!ledLensMat) return;
  if (on) {
    ledLensMat.color.setHex(0xff1f2d);
    ledLensMat.emissive.setHex(0xff0000);
    ledLensMat.emissiveIntensity = 1.35;
    ledLensMat.opacity = 0.95;
    if (!ledLight) {
      ledLight = new THREE.PointLight(0xff1f2d, 2.4, 4);
      ledLight.position.set(2.4, 0.9, 0);
      scene.add(ledLight);
    }
  } else {
    ledLensMat.color.setHex(0xf87171);
    ledLensMat.emissive.setHex(0x220000);
    ledLensMat.emissiveIntensity = 0.1;
    ledLensMat.opacity = 0.72;
    if (ledLight) {
      scene.remove(ledLight);
      ledLight = null;
    }
  }
}

function setMotorState(on) {
  motorRunning = on;
}

function calculateCircuit() {
  if (currentMode === 'lamp') {
    const complete =
      (connected('bat_plus', 'sw_in') && connected('sw_out', 'lamp_in') && connected('lamp_out', 'bat_minus')) ||
      (connected('bat_plus', 'lamp_out') && connected('lamp_in', 'sw_out') && connected('sw_in', 'bat_minus'));

    if (complete && isSwitchOn) {
      setLampState('main', true, 1.15);
      setStatus('⚡ Zanjir yopiq — Lampochka yonmoqda!', 'success');
      setGuide('To‘g‘ri: zanjir yopildi va tok lampochkadan o‘tdi.', 'success');
      updateMeters(9, 0.9);
    } else if (complete) {
      resetVisuals();
      setStatus('Zanjir ulandi. Kalitni yoqing!', 'warning');
      setGuide('Sxema to‘g‘ri. Endi kalit dastasini bosing.', 'warning');
      updateMeters(0, 0);
    } else {
      resetVisuals();
      const allConnected = ['bat_plus', 'bat_minus', 'sw_in', 'sw_out', 'lamp_in', 'lamp_out'].every(hasAnyConnection);
      setStatus(allConnected ? 'Simlar noto‘g‘ri ulandi. Sxemani tekshiring.' : 'Simlarni ulashni davom ettiring...', allConnected ? 'danger' : '');
      setGuide(allConnected ? 'Xato: Bat(+) kalitga, kalit chiqishi lampaga, lampadan Bat(-) ga qaytishi kerak.' : 'Avval Bat(+) dan kalitga, keyin kalitdan lampaga sim torting.', allConnected ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'short') {
    if (connected('bat_plus', 'bat_minus')) {
      setStatus('💥 QISQA TUTASHUV! Batareyani bunday ulamang.', 'danger');
      setGuide('Xulosa: iste’molchi yoki rezistorsiz to‘g‘ridan-to‘g‘ri ulash juda katta tok hosil qiladi.', 'danger');
      updateMeters(9, 50);
      const batPos = new THREE.Vector3();
      devices[0].getWorldPosition(batPos); batPos.y += 0.5;
      triggerExplosion(batPos);
    } else {
      updateMeters(0, 0);
    }
  } else if (currentMode === 'electrolysis') {
    const complete =
      (connected('bat_plus', 'el_in') && connected('bat_minus', 'el_out')) ||
      (connected('bat_plus', 'el_out') && connected('bat_minus', 'el_in'));

    if (complete) {
      isElectrolysing = true;
      setStatus('🧪 Elektroliz aktiv — H₂ va O₂ ajralmoqda!', 'success');
      setGuide('To‘g‘ri: elektrodlar orasidan tok o‘tmoqda, suvda gaz pufakchalari ajraladi.', 'success');
      updateMeters(9, 1.2);
    } else {
      isElectrolysing = false;
      setGuide('Bat(+) va Bat(-) ni ikkita alohida elektrodlarga ulang. Ikkala sim bitta elektrodga ketsa tajriba ishlamaydi.', hasAnyConnection('bat_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'parallel') {
    const lampA =
      (connected('bat_plus', 'lampA_in') && connected('bat_minus', 'lampA_out')) ||
      (connected('bat_plus', 'lampA_out') && connected('bat_minus', 'lampA_in'));
    const lampB =
      (connected('bat_plus', 'lampB_in') && connected('bat_minus', 'lampB_out')) ||
      (connected('bat_plus', 'lampB_out') && connected('bat_minus', 'lampB_in'));

    setLampState('A', lampA, 1);
    setLampState('B', lampB, 1);

    if (lampA && lampB) {
      setStatus('🔗 Parallel zanjir aktiv — ikkala lampa yonmoqda!', 'success');
      setGuide('To‘g‘ri: har bir lampa batareyaga alohida tarmoq bilan ulandi.', 'success');
      updateMeters(9, 1.8);
    } else if (lampA || lampB) {
      setStatus('Bitta lampa ulandi. Ikkinchisini ham ulang.', 'info');
      setGuide('Ikkinchi lampa uchun ham Bat(+) va Bat(-) dan alohida tarmoq chiqaring.');
      updateMeters(9, 0.9);
    } else {
      resetAllLamps();
      setGuide('Parallel ulashda Bat(+) bir nechta klemaga ulanishi mumkin. Har lampaga alohida plus va minus yo‘l kerak.');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'ohm') {
    const complete =
      (connected('bat_plus', 'res_in') && connected('res_out', 'lamp_in') && connected('lamp_out', 'bat_minus')) ||
      (connected('bat_plus', 'lamp_out') && connected('lamp_in', 'res_out') && connected('res_in', 'bat_minus'));

    if (complete) {
      const amps = 9 / resistanceOhm;
      const brightness = Math.max(0.28, Math.min(1.25, amps / 0.55));
      setLampState('main', true, brightness);
      setStatus('Ω Ohm qonuni: I = U / R. Qarshilik o‘zgarsa, tok ham o‘zgaradi.', 'success');
      setGuide('To‘g‘ri: I = U / R. Qarshilik oshsa tok kamayadi, lampochka xiralashadi.', 'success');
      updateMeters(9, amps);
    } else {
      resetAllLamps();
      setStatus('Rezistor va lampochkani ketma-ket ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      setGuide('Ketma-ket tartibni saqlang: Bat(+) → Rezistor → Lampa → Bat(-).', hasAnyConnection('bat_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'led') {
    const correct = connected('bat_plus', 'res_in') && connected('res_out', 'led_p') && connected('led_n', 'bat_minus');
    const reversed = connected('bat_plus', 'res_in') && connected('res_out', 'led_n') && connected('led_p', 'bat_minus');

    if (correct) {
      setLedState(true);
      setStatus('🔴 LED to‘g‘ri qutbda ulandi — yonmoqda!', 'success');
      setGuide('To‘g‘ri: LED faqat anod (+) tomondan tok kirganda yonadi. Rezistor tokni cheklaydi.', 'success');
      updateMeters(9, 0.03);
    } else {
      setLedState(false);
      if (reversed) {
        setStatus('LED teskari ulandi — yonmaydi.', 'danger');
        setGuide('Xato: LED(+) anod tomoni rezistordan kelishi, LED(-) Bat(-) ga qaytishi kerak.', 'danger');
      } else {
        setStatus('LED zanjirini ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
        setGuide('Sxema: Bat(+) → Rezistor → LED(+) va LED(-) → Bat(-). Rezistorsiz LED ni ulamang.');
      }
      updateMeters(0, 0);
    }
  } else if (currentMode === 'motor') {
    const complete =
      (connected('bat_plus', 'sw_in') && connected('sw_out', 'motor_p') && connected('motor_n', 'bat_minus')) ||
      (connected('bat_plus', 'motor_p') && connected('motor_n', 'sw_out') && connected('sw_in', 'bat_minus'));

    if (complete && isSwitchOn) {
      setMotorState(true);
      setStatus('🌀 Motor ishlayapti — elektr energiya harakatga aylandi.', 'success');
      setGuide('To‘g‘ri: kalit yopilganda motor chulg‘amidan tok o‘tadi va rotor aylanadi.', 'success');
      updateMeters(9, 1.4);
    } else if (complete) {
      setMotorState(false);
      setStatus('Motor ulandi. Kalitni yoqing.', 'warning');
      setGuide('Sxema to‘g‘ri. Endi kalit dastasini bosing.', 'warning');
      updateMeters(0, 0);
    } else {
      setMotorState(false);
      setStatus('Motor zanjirini ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      setGuide('Sxema: Bat(+) → Kalit → Motor(+) va Motor(-) → Bat(-).', hasAnyConnection('bat_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'series') {
    const complete =
      (connected('bat_plus', 'lampA_in') && connected('lampA_out', 'lampB_in') && connected('lampB_out', 'bat_minus')) ||
      (connected('bat_plus', 'lampB_out') && connected('lampB_in', 'lampA_out') && connected('lampA_in', 'bat_minus'));

    if (complete) {
      setLampState('A', true, 0.55);
      setLampState('B', true, 0.55);
      setStatus('💡💡 Ketma-ket zanjir aktiv — ikkala lampa xira yonmoqda.', 'success');
      setGuide('To‘g‘ri: bitta tok yo‘li ikkala lampadan navbat bilan o‘tadi. Qarshilik oshgani uchun yorqinlik kamayadi.', 'success');
      updateMeters(9, 0.45);
    } else {
      resetAllLamps();
      setStatus('Lampalarni ketma-ket tartibda ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      setGuide('Ketma-ket zanjirda Bat(+) dan birinchi lampaga, undan ikkinchi lampaga, so‘ng Bat(-) ga qaytish kerak.', hasAnyConnection('bat_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'dual-battery') {
    const complete =
      connected('batA_plus', 'batB_minus') &&
      connected('batB_plus', 'lamp_in') &&
      connected('lamp_out', 'batA_minus');

    if (complete) {
      setLampState('main', true, 1.35);
      setStatus('🔋🔋 18 V zanjir aktiv — lampochka juda yorqin yonmoqda.', 'success');
      setGuide('To‘g‘ri: batareyalar ketma-ket ulanganda kuchlanishlar qo‘shiladi. 9 V + 9 V = 18 V.', 'success');
      updateMeters(18, 1.8);
    } else {
      resetAllLamps();
      setStatus('Ikki batareyani ketma-ket ulang.', hasAnyConnection('batA_plus') ? 'warning' : 'info');
      setGuide('BatA(+) ni BatB(-) ga ulang. Keyin BatB(+) lampaga, lampadan BatA(-) ga qayting.', hasAnyConnection('batA_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'rheostat') {
    const complete =
      (connected('bat_plus', 'res_in') && connected('res_out', 'lamp_in') && connected('lamp_out', 'bat_minus')) ||
      (connected('bat_plus', 'lamp_out') && connected('lamp_in', 'res_out') && connected('res_in', 'bat_minus'));

    if (complete) {
      const amps = 9 / resistanceOhm;
      const brightness = Math.max(0.18, Math.min(1.2, amps / 0.42));
      setLampState('main', true, brightness);
      setStatus('🎚 Reostat ishlayapti — qarshilik o‘zgarsa yorqinlik ham o‘zgaradi.', 'success');
      setGuide('To‘g‘ri: qarshilik kamayganda tok ortadi va lampa yorqinlashadi; qarshilik oshganda lampa xiralashadi.', 'success');
      updateMeters(9, amps);
    } else {
      resetAllLamps();
      setStatus('Reostat va lampochkani ketma-ket ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      setGuide('Sxema: Bat(+) → Rezistor → Lampa → Bat(-). R tugmalari faqat zanjir to‘g‘ri ulanganda natija beradi.', hasAnyConnection('bat_plus') ? 'danger' : '');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'capacitor') {
    const complete = connected('bat_plus', 'cap_in') && connected('cap_out', 'lamp_in') && connected('lamp_out', 'bat_minus');
    if (complete) {
      setLampState('main', true, 0.7);
      setStatus('⚡ Kondensator zaryad bo\'lmoqda — lampa yumshoq yonadi', 'success');
      setGuide(`To'g'ri: kondensator zaryad bo'lsa lampa tezda yonadi, so'ng xiralashadi.`, 'success');
      updateMeters(9, 0.5);
    } else {
      resetAllLamps();
      setStatus('Kondensatorni lampoga ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'inductor') {
    const complete = connected('bat_plus', 'ind_in') && connected('ind_out', 'lamp_in') && connected('lamp_out', 'bat_minus');
    if (complete) {
      setLampState('main', true, 0.8);
      setStatus('🌀 Induktor magnit tuyuligini yaratadi — tok o\'zgarishiga qarshilik', 'success');
      setGuide(`To'g'ri: induktor tok o'zgarishiga qarshilik qiladi, magnit maydoni hosil qiladi.`, 'success');
      updateMeters(9, 0.55);
    } else {
      resetAllLamps();
      setStatus('Induktorni lampoga ulang.', hasAnyConnection('bat_plus') ? 'warning' : 'info');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'diode') {
    const correct = connected('bat_plus', 'diod_p') && connected('diod_n', 'lamp_in') && connected('lamp_out', 'bat_minus');
    const reversed = connected('bat_plus', 'diod_n') && connected('diod_p', 'lamp_in') && connected('lamp_out', 'bat_minus');
    
    if (correct) {
      setLampState('main', true, 1);
      setStatus(`▶️ Diod to'g'ri yo'nalishdagi tok beradi — lampa yonadi`, 'success');
      setGuide(`To'g'ri: diod faqat anod(+) tomondan tok kirganda ishlaydi. Teskari ulsa yonmaydi.`, 'success');
      updateMeters(9, 0.7);
    } else if (reversed) {
      setLampState('main', false);
      setStatus(`❌ Diod teskari ulandi — tok o'tmaydik`, 'danger');
      setGuide('Xato: Diod(+) batareyaning + tomoniga, Diod(-) lampaga qaytish kerak.', 'danger');
      updateMeters(0, 0);
    } else {
      resetAllLamps();
      setStatus(`Diodni to'g'ri yo'nalishdaga ulang.`, hasAnyConnection('bat_plus') ? 'warning' : 'info');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'transformer') {
    const complete = connected('bat_plus', 'trf_in1') && connected('trf_in2', 'bat_minus') && 
                     connected('trf_out1', 'lamp_in') && connected('lamp_out', 'trf_out2');
    if (complete) {
      setLampState('main', true, 0.9);
      setStatus('🔌 Transformer — primer va sekunder o\'yin', 'success');
      setGuide(`To'g'ri: trafo primer (kirish) va sekunder (chiqish) spiralelari kuchlanishni o'zgartiradi.`, 'success');
      updateMeters(9, 0.6);
    } else {
      resetAllLamps();
      setStatus(`Transformerni to'g'ri ulang.`, hasAnyConnection('bat_plus') ? 'warning' : 'info');
      updateMeters(0, 0);
    }
  } else if (currentMode === 'solar') {
    const complete = connected('sol_p', 'lamp_in') && connected('lamp_out', 'sol_n');
    if (complete) {
      setLampState('main', true, 0.6);
      setStatus('☀️ Quyosh paneli nur energiyasini elektr energiyaga aylantiryapti', 'success');
      setGuide(`To'g'ri: quyosh paneli fotonelarni elektron-teshik juftliklarinya aylantirib tok hosil qiladi.`, 'success');
      updateMeters(5, 0.3);
    } else {
      resetAllLamps();
      setStatus('Quyosh panelini lampoga ulang.', hasAnyConnection('sol_p') ? 'warning' : 'info');
      updateMeters(0, 0);
    }
  }
}

function resetVisuals() {
  resetAllLamps();
  setLedState(false);
  setMotorState(false);
  if (bulbGlassMat) {
    bulbGlassMat.emissive.setHex(0x000000);
    bulbGlassMat.emissiveIntensity = 0;
    bulbGlassMat.opacity = 0.22;
    bulbGlassMat.color.setHex(0xffffff);
  }
  if (bulbFilamentMat) bulbFilamentMat.color.setHex(0x4a3000);
  if (mainPointLight) { scene.remove(mainPointLight); mainPointLight = null; }
  if (lampLight2) { scene.remove(lampLight2); lampLight2 = null; }
  isElectrolysing = false;
}

function triggerExplosion(pos) {
  for (let i = 0; i < 60; i++) {
    const col = [0xef4444, 0xf97316, 0xfbbf24, 0xffffff][Math.floor(Math.random()*4)];
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(Math.random() * 0.04 + 0.01, 4, 4),
      new THREE.MeshBasicMaterial({ color: col })
    );
    p.position.copy(pos);
    p.userData = {
      v: new THREE.Vector3(
        (Math.random()-0.5) * 0.2,
        Math.random() * 0.35 + 0.05,
        (Math.random()-0.5) * 0.2
      ),
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02
    };
    scene.add(p);
    sparkParticles.push(p);
  }
  // Shockwave ring
  const ringGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos);
  ring.userData = { type: 'shockwave', life: 1.0 };
  scene.add(ring);
  sparkParticles.push(ring);
}

// =============================================
// STATUS & METERS
// =============================================
function setStatus(msg, type) {
  const box = document.getElementById('status-box');
  box.innerHTML = msg;
  box.className = type || '';
}

function setGuide(msg, type = '') {
  const box = document.getElementById('guide-box');
  box.innerHTML = '<span class="guide-title">Qo‘llanma</span>' + msg;
  box.className = '';
  if (type === 'danger') box.classList.add('guide-box-danger');
  if (type === 'success') box.classList.add('guide-box-success');
}

function updateMeters(v, a) {
  const w = v * a;
  document.getElementById('volt-val').innerHTML = v.toFixed(1) + ' <span class="meter-unit">V</span>';
  document.getElementById('amp-val').innerHTML = (a > 20 ? '∞' : a.toFixed(1)) + ' <span class="meter-unit">A</span>';
  document.getElementById('watt-val').innerHTML = (w > 200 ? '∞' : w.toFixed(1)) + ' <span class="meter-unit">W</span>';

  const vPct = Math.min(v / 12 * 100, 100);
  const aPct = a > 20 ? 100 : Math.min(a / 3 * 100, 100);
  const wPct = w > 200 ? 100 : Math.min(w / 36 * 100, 100);

  document.getElementById('volt-bar').style.width = vPct + '%';
  document.getElementById('amp-bar').style.width = aPct + '%';
  document.getElementById('watt-bar').style.width = wPct + '%';

  const ampBar = document.getElementById('amp-bar');
  if (a > 20) ampBar.style.background = '#ef4444';
  else ampBar.style.background = '#22c55e';
}

function updateConnList() {
  const el = document.getElementById('conn-list');
  if (connectionPairs.length === 0) { el.innerHTML = ''; return; }
  const names = {
    bat_plus: 'Bat(+)', bat_minus: 'Bat(-)',
    batA_plus: 'BatA(+)', batA_minus: 'BatA(-)',
    batB_plus: 'BatB(+)', batB_minus: 'BatB(-)',
    sw_in: 'Kalit IN', sw_out: 'Kalit OUT',
    lamp_in: 'Lampa IN', lamp_out: 'Lampa OUT',
    lampA_in: 'LampaA IN', lampA_out: 'LampaA OUT',
    lampB_in: 'LampaB IN', lampB_out: 'LampaB OUT',
    el_in: 'Elektrod(+)', el_out: 'Elektrod(-)',
    res_in: 'Rezistor IN', res_out: 'Rezistor OUT',
    led_p: 'LED(+)', led_n: 'LED(-)',
    motor_p: 'Motor(+)', motor_n: 'Motor(-)',
  };
  el.innerHTML = connectionPairs.map(p => `
    <div class="conn-item">
      <div class="conn-dot" style="background:#${p.col.toString(16).padStart(6,'0')}"></div>
      ${names[p.from]||p.from} → ${names[p.to]||p.to}
    </div>
  `).join('');
}

// =============================================
// ANIMATION
// =============================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  animTime += 0.016;

  // Spark particles
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const p = sparkParticles[i];
    if (p.userData.type === 'shockwave') {
      p.scale.setScalar(1 + (1 - p.userData.life) * 8);
      p.material.opacity = p.userData.life * 0.8;
      p.userData.life -= 0.03;
      if (p.userData.life <= 0) { p.geometry.dispose(); scene.remove(p); sparkParticles.splice(i,1); }
    } else {
      p.position.add(p.userData.v);
      p.userData.v.y -= 0.008;
      p.userData.life -= p.userData.decay;
      p.material.opacity = p.userData.life;
      if (p.userData.life <= 0) { p.geometry.dispose(); scene.remove(p); sparkParticles.splice(i,1); }
    }
  }

  // Electrolysis bubbles
  if (isElectrolysing && Math.random() < 0.45) {
    const elJar = scene.children.find(c => c.name === 'el_container');
    if (elJar) {
      for (let side of [-0.25, 0.25]) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(Math.random() * 0.02 + 0.008, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 + Math.random()*0.3 })
        );
        b.position.set(
          elJar.position.x + side + (Math.random()-0.5)*0.08,
          0.15 + Math.random() * 0.1,
          elJar.position.z + (Math.random()-0.5)*0.08
        );
        b.userData.vy = 0.012 + Math.random() * 0.008;
        scene.add(b); bubbleParticles.push(b);
      }
    }
  }

  for (let i = bubbleParticles.length - 1; i >= 0; i--) {
    const b = bubbleParticles[i];
    b.position.y += b.userData.vy;
    b.position.x += (Math.random()-0.5) * 0.002;
    if (b.position.y > 0.9) {
      b.geometry.dispose(); scene.remove(b); bubbleParticles.splice(i,1);
    }
  }

  // Lamp flicker effect
  if (mainPointLight) {
    const flicker = 0.95 + Math.sin(animTime * 40) * 0.03 + Math.random() * 0.04;
    mainPointLight.intensity = 4 * flicker;
    if (bulbGlassMat) bulbGlassMat.emissiveIntensity = 0.6 * flicker;
  }

  if (motorRotor && motorRunning) {
    motorRotor.rotation.z += 0.45;
  }

  polarityLabels.forEach(label => {
    label.quaternion.copy(camera.quaternion);
  });

  // Terminal pulse rings (hover feel)
  scene.traverse(o => {
    if (o.name && o.name.endsWith('_ring')) {
      o.scale.setScalar(1 + Math.sin(animTime * 3) * 0.12);
      o.material.opacity = 0.3 + Math.sin(animTime * 3) * 0.15;
    }
  });

  renderer.render(scene, camera);
}

Object.assign(window, { loadExperiment, resetWires, adjustResistance });

// Sahifa yuklanganda init() va animate() ni boshlash
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
