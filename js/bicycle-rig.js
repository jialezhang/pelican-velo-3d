import * as THREE from "three";

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Palette constants matching SHARED_RIG_CONTRACT.md Section 2 & 3
 */
const PALETTE = {
  celesteMint: 0x4cc9b0,
  chrome: 0xe8eef2,
  nickel: 0xcfd8df,
  darkSteel: 0x2c3540,
  leatherHoney: 0x8c4a27,
  corkWarm: 0xc79862,
  gumwallCream: 0xefe6d5,
  charcoalTread: 0x222831,
  brassOchre: 0xd9a441,
  copperRivet: 0xc66f36,
  wickerRattan: 0xc69355,
  wickerDark: 0xa37138,
  harborNavy: 0x102336,
  chalkIvory: 0xf7f3e8,
  rubyRed: 0xd92638,
  amberReflector: 0xf4a623,
  baguetteCrust: 0xd6923e,
  baguetteCrumb: 0xf4e3be,
  kraftPaper: 0xe6d4b5,
  sardineSilver: 0xd0dde8,
  sardineDorsal: 0x2f4d68,
  iceCrystal: 0xdcf2fc,
  headlampWarm: 0xffe8a3,
};

/**
 * Connects p1 -> p2 seamlessly using CylinderGeometry + Quaternion.setFromUnitVectors.
 * r1 is the radius at p1 (bottom of cylinder), r2 is the radius at p2 (top of cylinder).
 */
export function makeTubeBetween(
  p1,
  p2,
  r1,
  r2,
  material,
  radialSegments = 16,
  shadowOpts = { cast: true, receive: true }
) {
  const delta = new THREE.Vector3().subVectors(p2, p1);
  const len = delta.length();
  const safeLen = Math.max(len, 1e-5);
  const geo = new THREE.CylinderGeometry(r2, r1, safeLen, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  if (len > 1e-6) {
    const dir = delta.multiplyScalar(1 / len);
    if (dir.y < -0.99999) {
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
      mesh.quaternion.setFromUnitVectors(UP_AXIS, dir);
    }
  }
  mesh.castShadow = shadowOpts.cast !== false;
  mesh.receiveShadow = shadowOpts.receive !== false;
  return mesh;
}

function applyShadowRecursive(root, castShadow, receiveShadow) {
  root.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      if (child.userData.noShadow) return;
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;
    }
  });
}

function createRigMaterials() {
  const wireframeList = [];
  const register = (mat) => {
    wireframeList.push(mat);
    return mat;
  };

  const celeste = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.celesteMint,
      metalness: 0.14,
      roughness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.14,
    })
  );

  const chrome = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.chrome,
      metalness: 0.9,
      roughness: 0.16,
    })
  );

  const brushedNickel = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.nickel,
      metalness: 0.82,
      roughness: 0.28,
    })
  );

  const darkSteel = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.darkSteel,
      metalness: 0.74,
      roughness: 0.36,
    })
  );

  const brass = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.brassOchre,
      metalness: 0.86,
      roughness: 0.2,
    })
  );

  const copper = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.copperRivet,
      metalness: 0.84,
      roughness: 0.24,
    })
  );

  const leather = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.leatherHoney,
      metalness: 0.04,
      roughness: 0.46,
      clearcoat: 0.22,
      clearcoatRoughness: 0.38,
    })
  );

  const cork = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.corkWarm,
      metalness: 0.02,
      roughness: 0.78,
    })
  );

  const gumwall = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.gumwallCream,
      metalness: 0.02,
      roughness: 0.74,
    })
  );

  const rubberTread = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.charcoalTread,
      metalness: 0.05,
      roughness: 0.82,
    })
  );

  const navyEnamel = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.harborNavy,
      metalness: 0.15,
      roughness: 0.3,
    })
  );

  const ivoryEnamel = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.chalkIvory,
      metalness: 0.06,
      roughness: 0.32,
    })
  );

  const rubyReflector = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.rubyRed,
      emissive: 0x6b0814,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    })
  );

  const amberReflector = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.amberReflector,
      emissive: 0x7a4200,
      emissiveIntensity: 0.32,
      metalness: 0.08,
      roughness: 0.16,
      clearcoat: 0.9,
    })
  );

  const wicker = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.wickerRattan,
      metalness: 0.02,
      roughness: 0.76,
    })
  );

  const wickerDark = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.wickerDark,
      metalness: 0.02,
      roughness: 0.8,
    })
  );

  const baguetteCrust = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.baguetteCrust,
      metalness: 0.02,
      roughness: 0.68,
    })
  );

  const baguetteCrumb = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.baguetteCrumb,
      metalness: 0.0,
      roughness: 0.86,
    })
  );

  const kraftPaper = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.kraftPaper,
      metalness: 0.0,
      roughness: 0.88,
      side: THREE.DoubleSide,
    })
  );

  const sardineSilver = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.sardineSilver,
      metalness: 0.85,
      roughness: 0.18,
      iridescence: 0.45,
      iridescenceIOR: 1.35,
    })
  );

  const sardineBack = register(
    new THREE.MeshStandardMaterial({
      color: PALETTE.sardineDorsal,
      metalness: 0.55,
      roughness: 0.28,
    })
  );

  const iceCrystal = register(
    new THREE.MeshPhysicalMaterial({
      color: PALETTE.iceCrystal,
      metalness: 0.0,
      roughness: 0.1,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
    })
  );

  const headlampLens = register(
    new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: PALETTE.headlampWarm,
      emissiveIntensity: 0.12,
      metalness: 0.1,
      roughness: 0.1,
    })
  );

  const compassGlass = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xeef9ff,
      metalness: 0.0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.38,
      clearcoat: 1.0,
    })
  );

  // Volumetric light cones intentionally excluded from wireframeList so night + wireframe stays clean
  const beamOuterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.headlampWarm) },
      uOpacity: { value: 0.22 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // Cylinder/Cone vUv.y: 1.0 at apex (+Y), 0.0 at far base (-Y)
        float axial = smoothstep(0.0, 0.88, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        float rimFade = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.45);
        float alpha = axial * rimFade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  return {
    wireframeList,
    celeste,
    chrome,
    brushedNickel,
    darkSteel,
    brass,
    copper,
    leather,
    cork,
    gumwall,
    rubberTread,
    navyEnamel,
    ivoryEnamel,
    rubyReflector,
    amberReflector,
    wicker,
    wickerDark,
    baguetteCrust,
    baguetteCrumb,
    kraftPaper,
    sardineSilver,
    sardineBack,
    iceCrystal,
    headlampLens,
    compassGlass,
    beamOuterMat,
  };
}

/**
 * Parametric thickened C-channel mudguard (fender) geometry in XY plane around origin.
 */
function createFenderGeometry(
  crownRadius,
  width,
  cupDepth,
  thickness,
  thetaStart,
  thetaEnd,
  arcSegs = 44,
  profileSegs = 10
) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const indices = [];

  const maxPsi = 1.18;
  const sinMaxPsi = Math.sin(maxPsi);
  const cols = profileSegs + 1;
  const rows = arcSegs + 1;

  // Surface 0: outer shell (+1), Surface 1: inner shell (-1)
  for (let surf = 0; surf < 2; surf++) {
    const rOffset = surf === 0 ? thickness * 0.5 : -thickness * 0.5;
    const nSign = surf === 0 ? 1 : -1;

    for (let i = 0; i < rows; i++) {
      const u = i / arcSegs;
      const theta = thetaStart + (thetaEnd - thetaStart) * u;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      for (let j = 0; j < cols; j++) {
        const v = j / profileSegs;
        const psi = -maxPsi + 2 * maxPsi * v;
        const r = crownRadius + rOffset - cupDepth * (1 - Math.cos(psi));
        const z = (width * 0.5) * (Math.sin(psi) / sinMaxPsi);

        positions.push(r * cosT, r * sinT, z);

        // Outward normal combining radial XY and cupped Z tilt
        const nr = Math.cos(psi * 0.65) * nSign;
        const nz = Math.sin(psi * 0.65) * nSign;
        normals.push(nr * cosT, nr * sinT, nz);
      }
    }
  }

  const surfStride = rows * cols;
  for (let i = 0; i < arcSegs; i++) {
    for (let j = 0; j < profileSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      // Outer shell
      indices.push(a, b, c, a, c, d);
      // Inner shell (reversed winding)
      const ai = surfStride + a;
      const bi = surfStride + b;
      const ci = surfStride + c;
      const di = surfStride + d;
      indices.push(ai, ci, bi, ai, di, ci);
    }
  }

  // Stitch side rims (j = 0 and j = profileSegs)
  for (let i = 0; i < arcSegs; i++) {
    const o0 = i * cols;
    const o1 = (i + 1) * cols;
    const i0 = surfStride + o0;
    const i1 = surfStride + o1;
    indices.push(o0, i0, i1, o0, i1, o1);

    const ro0 = i * cols + profileSegs;
    const ro1 = (i + 1) * cols + profileSegs;
    const ri0 = surfStride + ro0;
    const ri1 = surfStride + ro1;
    indices.push(ro0, ro1, ri1, ro0, ri1, ri0);
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a toothed chainring or rear cog centered at (0, 0, 0) in XY plane.
 */
function createToothedSprocketGeometry(pitchRadius, toothCount, thickness, innerRadius) {
  const shape = new THREE.Shape();
  const samples = toothCount * 8;
  const addendum = 0.0033;
  const dedendum = 0.0032;

  for (let i = 0; i <= samples; i++) {
    const frac = i / samples;
    const angle = frac * Math.PI * 2;
    const toothWave = Math.cos(frac * toothCount * Math.PI * 2);
    // Crisp involute-like tooth tip & rounded roller valley
    const shaped = Math.sign(toothWave) * Math.pow(Math.abs(toothWave), 0.72);
    const r = pitchRadius + (shaped > 0 ? shaped * addendum : shaped * dedendum);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  if (innerRadius > 0.004) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0004,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, -thickness * 0.5);
  return geo;
}

/**
 * Builds a figure-8 roller chain side plate in XY plane, centered on Z=0.
 */
function createFigure8PlateGeometry(halfSpan, lobeRadius, waistHalf, thickness) {
  const shape = new THREE.Shape();
  const steps = 12;

  // Right lobe outer arc (-PI/2 .. +PI/2)
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI * 0.55 + (Math.PI * 1.1 * i) / steps;
    const x = halfSpan + Math.cos(a) * lobeRadius;
    const y = Math.sin(a) * lobeRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  // Upper pinched waist curve to left lobe
  shape.quadraticCurveTo(0, waistHalf, -halfSpan + Math.cos(Math.PI * 0.45) * lobeRadius, Math.sin(Math.PI * 0.45) * lobeRadius);

  // Left lobe outer arc (+PI*0.45 .. +PI*1.55)
  for (let i = 1; i <= steps; i++) {
    const a = Math.PI * 0.45 + (Math.PI * 1.1 * i) / steps;
    shape.lineTo(-halfSpan + Math.cos(a) * lobeRadius, Math.sin(a) * lobeRadius);
  }
  // Lower pinched waist curve back to right lobe
  shape.quadraticCurveTo(0, -waistHalf, halfSpan + Math.cos(-Math.PI * 0.55) * lobeRadius, Math.sin(-Math.PI * 0.55) * lobeRadius);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0002,
    bevelSize: 0.0002,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -thickness * 0.5);
  return geo;
}

/**
 * Sculpted Brooks B67 honey-leather saddle shell.
 * In local coordinates, (0, 0, 0) is the exact sitting top anchor (-0.28, 0.76, 0).
 */
function createBrooksSaddleShellGeometry() {
  // Saddle spans local x in [-0.085 (rear cantle), +0.132 (front nose)]
  const uSegs = 28;
  const vSegs = 16;
  const positions = [];
  const indices = [];

  const profileAt = (u) => {
    // u = 0 rear cantle (x = -0.085), u = 1 front nose (x = +0.132)
    const x = -0.085 + u * 0.217;
    // Classic pear-shaped Brooks planform: wide rear, pinched thigh transition, rounded nose
    const rearBell = Math.exp(-Math.pow((u - 0.14) / 0.28, 2));
    const halfWidth = 0.021 + 0.064 * rearBell * (1 - 0.55 * Math.pow(u, 1.8));
    // Gentle hammock profile with exact y = 0 at sitting anchor x = 0 (u = 0.085 / 0.217 = 0.3917)
    const uAnchor = 0.085 / 0.217;
    const rawCrown = 0.011 * Math.pow((u - uAnchor) / 0.55, 2) + 0.004 * Math.exp(-Math.pow(u / 0.16, 2));
    const crownY = rawCrown;
    const skirtDrop = 0.024 + 0.008 * Math.sin(u * Math.PI);
    return { x, halfWidth, crownY, skirtDrop };
  };

  const cols = vSegs + 1;
  const rows = uSegs + 1;
  const leatherThick = 0.0048;

  for (let surf = 0; surf < 2; surf++) {
    const yShift = surf === 0 ? 0 : -leatherThick;
    const zScale = surf === 0 ? 1.0 : 0.96;

    for (let i = 0; i < rows; i++) {
      const u = i / uSegs;
      const { x, halfWidth, crownY, skirtDrop } = profileAt(u);
      // Taper end caps neatly at u=0 and u=1
      const endPinch = Math.sin(Math.acos(Math.min(0.999, Math.abs(u * 2 - 1) > 0.88 ? (Math.abs(u * 2 - 1) - 0.88) / 0.12 : 0)));

      for (let j = 0; j < cols; j++) {
        const s = (j / vSegs) * 2 - 1; // -1 .. +1
        const z = s * halfWidth * endPinch * zScale;
        const archDrop = Math.pow(Math.abs(s), 2.15) * skirtDrop * endPinch;
        const y = crownY - archDrop + yShift;
        positions.push(x, y, z);
      }
    }
  }

  const stride = rows * cols;
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, c, b, a, d, c);

      const ai = stride + a;
      const bi = stride + b;
      const ci = stride + c;
      const di = stride + d;
      indices.push(ai, bi, ci, ai, ci, di);
    }
  }

  // Stitch skirt edges
  for (let i = 0; i < uSegs; i++) {
    const l0 = i * cols;
    const l1 = (i + 1) * cols;
    indices.push(l0, l1, stride + l1, l0, stride + l1, stride + l0);

    const r0 = i * cols + vSegs;
    const r1 = (i + 1) * cols + vSegs;
    indices.push(r0, stride + r1, r1, r0, stride + r0, stride + r1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a true 24-spoke 2-cross tangent-laced vintage wheel of exact outer tire radius 0.340m.
 */
function createSpokedWheel(mats, options = {}) {
  const wheelRoot = new THREE.Group();
  const spinGroup = new THREE.Group();
  wheelRoot.add(spinGroup);

  const hubWidth = options.isRear ? 0.132 : 0.108;
  const flangeZ = 0.030;
  const flangeRadius = 0.025;
  const rimSpokeBedRadius = 0.266;

  // Non-rotating axle & chrome acorn nuts
  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048, 0.0048, hubWidth + 0.022, 12),
    mats.darkSteel
  );
  axle.rotation.x = Math.PI * 0.5;
  wheelRoot.add(axle);

  for (const side of [-1, 1]) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.0078, 12, 10), mats.chrome);
    nut.position.z = side * (hubWidth * 0.5 + 0.008);
    nut.scale.z = 1.25;
    wheelRoot.add(nut);
  }

  // Rotating chrome hub barrel & twin high flanges
  const hubBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0135, 0.0135, flangeZ * 2.15, 20),
    mats.chrome
  );
  hubBarrel.rotation.x = Math.PI * 0.5;
  spinGroup.add(hubBarrel);

  for (const side of [-1, 1]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(flangeRadius, flangeRadius, 0.0034, 28),
      mats.chrome
    );
    flange.rotation.x = Math.PI * 0.5;
    flange.position.z = side * flangeZ;
    spinGroup.add(flange);

    const coneCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, (hubWidth * 0.5 - flangeZ) * 0.92, 16),
      mats.brushedNickel
    );
    coneCap.rotation.x = Math.PI * 0.5;
    coneCap.position.z = side * (flangeZ + (hubWidth * 0.5 - flangeZ) * 0.46);
    spinGroup.add(coneCap);
  }

  // True 24-spoke tangent-laced pattern (12 per flange, alternating leading/trailing 2-cross)
  const spokeCount = 24;
  const crossAngle = 0.56; // ~32 deg tangent exit angle for 2-cross on 12 flange holes
  for (let i = 0; i < spokeCount; i++) {
    const rimTheta = (i / spokeCount) * Math.PI * 2;
    const flangeSide = i % 2 === 0 ? 1 : -1;
    const sideIndex = Math.floor(i / 2);
    const leadSign = sideIndex % 2 === 0 ? 1 : -1;
    const hubTheta = rimTheta + leadSign * crossAngle;

    // Subtle J-bend offset on inner/outer face of hub flange so crossing spokes clear cleanly
    const zHub = flangeSide * (flangeZ + leadSign * 0.0018);
    const zRim = flangeSide * 0.0022;

    const pHub = new THREE.Vector3(
      Math.cos(hubTheta) * (flangeRadius - 0.0025),
      Math.sin(hubTheta) * (flangeRadius - 0.0025),
      zHub
    );
    const pRim = new THREE.Vector3(
      Math.cos(rimTheta) * rimSpokeBedRadius,
      Math.sin(rimTheta) * rimSpokeBedRadius,
      zRim
    );

    const spokeDir = new THREE.Vector3().subVectors(pRim, pHub).normalize();
    const pNippleStart = pRim.clone().addScaledVector(spokeDir, -0.013);
    const pRimSeat = pRim.clone().addScaledVector(spokeDir, 0.0025);

    const spokeMesh = makeTubeBetween(pHub, pNippleStart, 0.00135, 0.00135, mats.chrome, 7);
    spinGroup.add(spokeMesh);

    const nippleMesh = makeTubeBetween(pNippleStart, pRimSeat, 0.0024, 0.0028, mats.brass, 8);
    spinGroup.add(nippleMesh);
  }

  // Polished chrome Westwood rim + spoke ridge
  const rimMain = new THREE.Mesh(new THREE.TorusGeometry(0.278, 0.0125, 16, 72), mats.chrome);
  rimMain.scale.z = 1.48;
  spinGroup.add(rimMain);

  const rimSpokeRidge = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.0052, 12, 72), mats.chrome);
  spinGroup.add(rimSpokeRidge);

  // Brass Presta valve stem + knurled cap
  const valveTheta = -Math.PI * 0.5 + Math.PI / spokeCount;
  const pValveRim = new THREE.Vector3(
    Math.cos(valveTheta) * 0.268,
    Math.sin(valveTheta) * 0.268,
    0
  );
  const pValveTip = new THREE.Vector3(
    Math.cos(valveTheta) * 0.241,
    Math.sin(valveTheta) * 0.241,
    0
  );
  const pValveCap = new THREE.Vector3(
    Math.cos(valveTheta) * 0.235,
    Math.sin(valveTheta) * 0.235,
    0
  );
  spinGroup.add(makeTubeBetween(pValveRim, pValveTip, 0.0031, 0.0027, mats.brass, 10));
  spinGroup.add(makeTubeBetween(pValveTip, pValveCap, 0.0035, 0.0024, mats.brass, 10));

  // Cream gumwall tire carcass (r spans 0.281 .. 0.335, wider in Z for visible gumwall sidewalls)
  const gumwallTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.308, 0.027, 20, 76),
    mats.gumwall
  );
  gumwallTorus.scale.z = 0.88; // half-width = 0.0238m
  spinGroup.add(gumwallTorus);

  // Charcoal outer rubber tread ring — exact outer radius: 0.317 + 0.023 = 0.340m!
  const treadTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.317, 0.023, 20, 76),
    mats.rubberTread
  );
  treadTorus.scale.z = 0.86; // half-width = 0.0198m -> clean sidewall transition at r ~ 0.326m!
  spinGroup.add(treadTorus);

  // 40 subtle chevron tread ribs around circumference so tire rotation reads crisply
  const ribCount = 40;
  const ribGeo = new THREE.BoxGeometry(0.009, 0.0028, 0.026);
  const ribInstanced = new THREE.InstancedMesh(ribGeo, mats.rubberTread, ribCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.3386, Math.sin(a) * 0.3386, 0);
    dummy.rotation.set(0, 0, a - Math.PI * 0.5);
    dummy.updateMatrix();
    ribInstanced.setMatrixAt(i, dummy.matrix);
  }
  ribInstanced.instanceMatrix.needsUpdate = true;
  spinGroup.add(ribInstanced);

  return { wheelRoot, spinGroup };
}

/**
 * Builds a vintage chrome rim brake caliper assembly.
 */
function createRimBrakeCaliper(mats) {
  const g = new THREE.Group();
  const centerBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.036, 12), mats.chrome);
  centerBolt.rotation.z = Math.PI * 0.5;
  g.add(centerBolt);

  for (const side of [-1, 1]) {
    const armTop = new THREE.Vector3(0, 0.004, side * 0.012);
    const armMid = new THREE.Vector3(0, -0.028, side * 0.034);
    const armPad = new THREE.Vector3(0, -0.068, side * 0.026);
    g.add(makeTubeBetween(armTop, armMid, 0.0045, 0.0042, mats.chrome, 10));
    g.add(makeTubeBetween(armMid, armPad, 0.0042, 0.0038, mats.chrome, 10));

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.008), mats.rubberTread);
    pad.position.set(0, -0.070, side * 0.021);
    g.add(pad);
  }
  return g;
}

/**
 * Builds a shimmering sculpted Mediterranean silver sardine (~0.13m long along +X).
 */
function createSilverSardineMesh(mats) {
  const fish = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.072, 8, 16), mats.sardineSilver);
  body.rotation.z = Math.PI * 0.5;
  body.scale.set(1.0, 1.0, 0.52);
  fish.add(body);

  const dorsalStrip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.066, 6, 12), mats.sardineBack);
  dorsalStrip.rotation.z = Math.PI * 0.5;
  dorsalStrip.position.y = 0.0052;
  dorsalStrip.scale.set(1.0, 0.72, 0.46);
  fish.add(dorsalStrip);

  // Forked tail fin
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(-0.024, 0.016);
  tailShape.lineTo(-0.014, 0);
  tailShape.lineTo(-0.024, -0.016);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.0016, bevelEnabled: false });
  tailGeo.translate(0, 0, -0.0008);
  const tail = new THREE.Mesh(tailGeo, mats.sardineSilver);
  tail.position.set(-0.044, 0, 0);
  fish.add(tail);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 8, 8), mats.navyEnamel);
    eye.position.set(0.034, 0.003, side * 0.0055);
    fish.add(eye);
  }

  return fish;
}

/**
 * Main factory: creates the vintage Bianchi-celeste French Riviera porteur/cruiser bicycle rig.
 */
export function createBicycleRig(options = {}) {
  const castShadow = options.castShadow !== false;
  const receiveShadow = options.receiveShadow !== false;

  const group = new THREE.Group();
  group.name = "BicycleRig";

  const mats = createRigMaterials();

  // =========================================================================
  // 1. KEY MECHANICAL FRAME COORDINATES (Meters, Rig-Local Space)
  // =========================================================================
  const R_HUB = new THREE.Vector3(-0.54, 0.34, 0);
  const F_HUB = new THREE.Vector3(0.56, 0.34, 0);
  const BB_POS = new THREE.Vector3(-0.08, 0.29, 0);
  const SADDLE_TOP = new THREE.Vector3(-0.28, 0.76, 0);

  // Steering head tube axis: classic 72 deg head angle (18 deg tilt back from +Y)
  const HEAD_TILT_RAD = THREE.MathUtils.degToRad(18);
  const STEER_AXIS = new THREE.Vector3(-Math.sin(HEAD_TILT_RAD), Math.cos(HEAD_TILT_RAD), 0);

  // Fork crown & head tube positioned for authentic 50mm fork rake + clean tire/fender clearance
  const FORK_CROWN = new THREE.Vector3(0.3969, 0.6803, 0);
  const HT_BOT = FORK_CROWN.clone().addScaledVector(STEER_AXIS, 0.0155); // (0.3921, 0.6950, 0)
  const HT_TOP = HT_BOT.clone().addScaledVector(STEER_AXIS, 0.104); // (0.3600, 0.7939, 0)
  const HT_MID = HT_BOT.clone().addScaledVector(STEER_AXIS, 0.052); // (0.3760, 0.7445, 0)
  const HT_DOWN_JUNC = HT_BOT.clone().addScaledVector(STEER_AXIS, 0.021);
  const HT_TOP_JUNC = HT_TOP.clone().addScaledVector(STEER_AXIS, -0.020);

  // Seat cluster lug on line from BB (-0.08, 0.29, 0) upward at 68.9 deg
  const SC_LUG = new THREE.Vector3(-0.224, 0.665, 0);
  const SEAT_AXIS = new THREE.Vector3().subVectors(SC_LUG, BB_POS).normalize();

  // Rear dropouts (136mm hub spacing so +Z drivetrain sits cleanly inside right dropout)
  const R_DROPOUT_L = new THREE.Vector3(-0.54, 0.34, -0.068);
  const R_DROPOUT_R = new THREE.Vector3(-0.54, 0.34, +0.068);

  // =========================================================================
  // 2. CELESTE-MINT LUGGED STEEL DIAMOND FRAME & CHROME LUGS
  // =========================================================================
  const frameGroup = new THREE.Group();
  frameGroup.name = "LuggedDiamondFrame";
  group.add(frameGroup);

  // Main diamond celeste tubes
  frameGroup.add(makeTubeBetween(HT_BOT, HT_TOP, 0.0172, 0.0172, mats.celeste, 20));
  frameGroup.add(makeTubeBetween(SC_LUG, HT_TOP_JUNC, 0.0135, 0.0135, mats.celeste, 18));
  frameGroup.add(makeTubeBetween(BB_POS, HT_DOWN_JUNC, 0.0152, 0.0152, mats.celeste, 18));
  frameGroup.add(makeTubeBetween(BB_POS, SC_LUG, 0.0145, 0.0145, mats.celeste, 18));

  // Championship ivory & harbor-navy band panels on seat tube & down tube
  const stBandCenter = BB_POS.clone().lerp(SC_LUG, 0.56);
  const stBandA = stBandCenter.clone().addScaledVector(SEAT_AXIS, -0.042);
  const stBandB = stBandCenter.clone().addScaledVector(SEAT_AXIS, +0.042);
  frameGroup.add(makeTubeBetween(stBandA, stBandB, 0.0151, 0.0151, mats.ivoryEnamel, 18));
  frameGroup.add(
    makeTubeBetween(
      stBandA.clone().addScaledVector(SEAT_AXIS, -0.008),
      stBandA,
      0.0153,
      0.0153,
      mats.navyEnamel,
      18
    )
  );
  frameGroup.add(
    makeTubeBetween(
      stBandB,
      stBandB.clone().addScaledVector(SEAT_AXIS, +0.008),
      0.0153,
      0.0153,
      mats.navyEnamel,
      18
    )
  );
  frameGroup.add(
    makeTubeBetween(
      stBandCenter.clone().addScaledVector(SEAT_AXIS, -0.012),
      stBandCenter.clone().addScaledVector(SEAT_AXIS, +0.012),
      0.0154,
      0.0154,
      mats.brass,
      18
    )
  );

  // Vintage chrome frame-fit tire pump tucked along underside of Top Tube
  const topTubeDir = new THREE.Vector3().subVectors(HT_TOP_JUNC, SC_LUG).normalize();
  const topTubePerpDown = new THREE.Vector3(topTubeDir.y, -topTubeDir.x, 0);
  const pumpRear = SC_LUG.clone()
    .addScaledVector(topTubeDir, 0.075)
    .addScaledVector(topTubePerpDown, 0.021);
  const pumpFront = HT_TOP_JUNC.clone()
    .addScaledVector(topTubeDir, -0.075)
    .addScaledVector(topTubePerpDown, 0.021);
  frameGroup.add(makeTubeBetween(pumpRear, pumpFront, 0.0068, 0.0068, mats.chrome, 12));
  frameGroup.add(
    makeTubeBetween(
      pumpRear,
      pumpRear.clone().addScaledVector(topTubeDir, 0.075),
      0.0088,
      0.0082,
      mats.leather,
      12
    )
  );

  // Polished Chrome Lugs: Upper Head Lug, Lower Head Lug, Headset Cups & Riviera Head Badge
  const addLugSleeve = (origin, target, len, radius) => {
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    const end = origin.clone().addScaledVector(dir, len);
    frameGroup.add(makeTubeBetween(origin, end, radius, radius * 0.92, mats.chrome, 18));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.93, 0.0016, 8, 20), mats.chrome);
    ring.position.copy(end);
    ring.quaternion.setFromUnitVectors(Z_AXIS, dir);
    frameGroup.add(ring);
  };

  // Head tube chrome lug collars + top/down tube sockets
  frameGroup.add(
    makeTubeBetween(
      HT_TOP_JUNC.clone().addScaledVector(STEER_AXIS, -0.018),
      HT_TOP,
      0.0192,
      0.0194,
      mats.chrome,
      20
    )
  );
  frameGroup.add(
    makeTubeBetween(
      HT_BOT,
      HT_DOWN_JUNC.clone().addScaledVector(STEER_AXIS, 0.018),
      0.0194,
      0.0192,
      mats.chrome,
      20
    )
  );
  addLugSleeve(HT_TOP_JUNC, SC_LUG, 0.048, 0.0156);
  addLugSleeve(HT_DOWN_JUNC, BB_POS, 0.054, 0.0174);

  // Chrome headset bearing cups
  frameGroup.add(
    makeTubeBetween(
      HT_BOT.clone().addScaledVector(STEER_AXIS, -0.008),
      HT_BOT,
      0.0205,
      0.022,
      mats.chrome,
      20
    )
  );
  frameGroup.add(
    makeTubeBetween(
      HT_TOP,
      HT_TOP.clone().addScaledVector(STEER_AXIS, 0.014),
      0.022,
      0.0175,
      mats.chrome,
      20
    )
  );

  // Brass & Harbor-Navy Club Cycliste Head Badge on front of Head Tube
  const headFrontNormal = new THREE.Vector3(STEER_AXIS.y, STEER_AXIS.x, 0).normalize();
  const badgeShield = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.036, 14), mats.brass);
  badgeShield.position.copy(HT_MID).addScaledVector(headFrontNormal, 0.0075);
  badgeShield.quaternion.setFromUnitVectors(UP_AXIS, STEER_AXIS);
  badgeShield.scale.set(0.85, 1.0, 0.65);
  frameGroup.add(badgeShield);

  const badgeInlay = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 12, 10), mats.navyEnamel);
  badgeInlay.position.copy(HT_MID).addScaledVector(headFrontNormal, 0.0155);
  badgeInlay.scale.set(0.45, 1.35, 0.85);
  frameGroup.add(badgeInlay);

  // Seat Cluster Chrome Lug + Binder Bolt
  frameGroup.add(
    makeTubeBetween(
      SC_LUG.clone().addScaledVector(SEAT_AXIS, -0.032),
      SC_LUG.clone().addScaledVector(SEAT_AXIS, +0.022),
      0.0165,
      0.0172,
      mats.chrome,
      18
    )
  );
  addLugSleeve(SC_LUG, HT_TOP_JUNC, 0.046, 0.0156);
  const binderBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.028, 12), mats.chrome);
  binderBolt.rotation.x = Math.PI * 0.5;
  binderBolt.position.copy(SC_LUG).add(new THREE.Vector3(-0.017, 0.008, 0));
  frameGroup.add(binderBolt);

  // Bottom Bracket (-0.08, 0.29, 0) Polished Chrome Shell + Lug Sockets
  const bbShell = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.068, 22), mats.chrome);
  bbShell.rotation.x = Math.PI * 0.5;
  bbShell.position.copy(BB_POS);
  frameGroup.add(bbShell);

  for (const side of [-1, 1]) {
    const bbCup = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.006, 22), mats.brushedNickel);
    bbCup.rotation.x = Math.PI * 0.5;
    bbCup.position.set(BB_POS.x, BB_POS.y, side * 0.035);
    frameGroup.add(bbCup);
  }
  addLugSleeve(BB_POS, SC_LUG, 0.052, 0.0168);
  addLugSleeve(BB_POS, HT_DOWN_JUNC, 0.056, 0.0174);

  // Twin Chain Stays & Twin Seat Stays + Clearance-Verified Bridges + Chrome Rear Dropouts
  const csBridgeZ = 0.039;
  const ssBridgeZ = 0.039;
  const csBridgeLeft = new THREE.Vector3(-0.178, 0.301, -csBridgeZ);
  const csBridgeRight = new THREE.Vector3(-0.178, 0.301, +csBridgeZ);
  const ssBridgeLeft = new THREE.Vector3(-0.289, 0.604, -ssBridgeZ);
  const ssBridgeRight = new THREE.Vector3(-0.289, 0.604, +ssBridgeZ);

  frameGroup.add(makeTubeBetween(csBridgeLeft, csBridgeRight, 0.0065, 0.0065, mats.celeste, 12));
  frameGroup.add(makeTubeBetween(ssBridgeLeft, ssBridgeRight, 0.007, 0.007, mats.chrome, 12));

  // Rear chrome caliper brake mounted on Seat Stay Bridge
  const rearBrake = createRimBrakeCaliper(mats);
  rearBrake.position.set(-0.289, 0.604, 0);
  rearBrake.rotation.z = Math.atan2(0.54 - 0.289, 0.604 - 0.34);
  frameGroup.add(rearBrake);

  for (const side of [-1, 1]) {
    const pBBStay = new THREE.Vector3(BB_POS.x - 0.012, BB_POS.y - 0.002, side * 0.023);
    const pCSMid = side < 0 ? csBridgeLeft : csBridgeRight;
    const pDropout = side < 0 ? R_DROPOUT_L : R_DROPOUT_R;
    const pCSChromeStart = pCSMid.clone().lerp(pDropout, 0.68);

    // Chrome BB chainstay lug socket -> celeste chainstay -> chrome rear stay sock!
    const pBBLugEnd = pBBStay.clone().lerp(pCSMid, 0.42);
    frameGroup.add(makeTubeBetween(pBBStay, pBBLugEnd, 0.0112, 0.0102, mats.chrome, 14));
    frameGroup.add(makeTubeBetween(pBBLugEnd, pCSMid, 0.0096, 0.0092, mats.celeste, 14));
    frameGroup.add(makeTubeBetween(pCSMid, pCSChromeStart, 0.0092, 0.0076, mats.celeste, 14));
    frameGroup.add(makeTubeBetween(pCSChromeStart, pDropout, 0.0077, 0.0066, mats.chrome, 14));

    // Seat stay: chrome top flute at seat cluster -> celeste seat stay -> chrome rear sock
    const pSSTop = new THREE.Vector3(SC_LUG.x - 0.008, SC_LUG.y - 0.005, side * 0.0155);
    const pSSMid = side < 0 ? ssBridgeLeft : ssBridgeRight;
    const pSSTopCapEnd = pSSTop.clone().lerp(pSSMid, 0.28);
    const pSSChromeStart = pSSMid.clone().lerp(pDropout, 0.66);

    frameGroup.add(makeTubeBetween(pSSTop, pSSTopCapEnd, 0.0082, 0.0078, mats.chrome, 12));
    frameGroup.add(makeTubeBetween(pSSTopCapEnd, pSSMid, 0.0076, 0.0074, mats.celeste, 12));
    frameGroup.add(makeTubeBetween(pSSMid, pSSChromeStart, 0.0074, 0.0066, mats.celeste, 12));
    frameGroup.add(makeTubeBetween(pSSChromeStart, pDropout, 0.0067, 0.0058, mats.chrome, 12));

    // Sculpted chrome rear dropout plate
    const dropoutPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 16), mats.chrome);
    dropoutPlate.rotation.x = Math.PI * 0.5;
    dropoutPlate.position.copy(pDropout);
    frameGroup.add(dropoutPlate);
  }

  // =========================================================================
  // 3. REAR WHEEL, CELESTE REAR FENDER & RUBY-RED REFLECTOR
  // =========================================================================
  const rearWheelExplodeGroup = new THREE.Group();
  rearWheelExplodeGroup.position.copy(R_HUB);
  group.add(rearWheelExplodeGroup);

  const rearWheel = createSpokedWheel(mats, { isRear: true });
  rearWheelExplodeGroup.add(rearWheel.wheelRoot);

  const rearFenderGroup = new THREE.Group();
  rearFenderGroup.position.copy(R_HUB);
  group.add(rearFenderGroup);

  // Rear fender wraps from front-bottom (-0.08 rad) over top (+PI/2) to rear skirt (+3.28 rad)
  const rearFenderGeo = createFenderGeometry(0.356, 0.054, 0.017, 0.0028, -0.06, 3.28, 48, 10);
  const rearFenderMesh = new THREE.Mesh(rearFenderGeo, mats.celeste);
  rearFenderGroup.add(rearFenderMesh);

  // Cream tail tip band + chrome fender stays
  const rearTipBandGeo = createFenderGeometry(0.3568, 0.0545, 0.017, 0.002, 2.98, 3.28, 10, 10);
  rearFenderGroup.add(new THREE.Mesh(rearTipBandGeo, mats.ivoryEnamel));

  for (const side of [-1, 1]) {
    const stayHub = new THREE.Vector3(0, 0, side * 0.065);
    for (const stayAngle of [2.18, 2.96]) {
      const stayClip = new THREE.Vector3(
        Math.cos(stayAngle) * 0.352,
        Math.sin(stayAngle) * 0.352,
        side * 0.027
      );
      rearFenderGroup.add(makeTubeBetween(stayHub, stayClip, 0.0022, 0.0022, mats.chrome, 8));
    }
  }

  // Ruby-Red Rear Reflector mounted on rear fender tail
  const reflectorAngle = 2.86;
  const reflectorGroup = new THREE.Group();
  reflectorGroup.position.set(
    Math.cos(reflectorAngle) * 0.362,
    Math.sin(reflectorAngle) * 0.362,
    0
  );
  reflectorGroup.rotation.z = reflectorAngle - Math.PI; // points outward/rearward along -X
  rearFenderGroup.add(reflectorGroup);

  const reflectorHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0155, 0.0125, 0.016, 18),
    mats.chrome
  );
  reflectorHousing.rotation.z = Math.PI * 0.5;
  reflectorGroup.add(reflectorHousing);

  const reflectorJewel = new THREE.Mesh(
    new THREE.SphereGeometry(0.0135, 16, 12),
    mats.rubyReflector
  );
  reflectorJewel.position.x = -0.0065;
  reflectorJewel.scale.set(0.55, 1.0, 1.0);
  reflectorGroup.add(reflectorJewel);

  // =========================================================================
  // 4. BROOKS HONEY-LEATHER SPRUNG SADDLE (SITTING ANCHOR AT (-0.28, 0.76, 0))
  // =========================================================================
  const saddleExplodeGroup = new THREE.Group();
  group.add(saddleExplodeGroup);

  // Fluted chrome seatpost rising collinearly out of SC_LUG
  const seatpostClampPos = SC_LUG.clone().addScaledVector(SEAT_AXIS, 0.062); // (-0.246, 0.723, 0)
  saddleExplodeGroup.add(
    makeTubeBetween(
      SC_LUG.clone().addScaledVector(SEAT_AXIS, -0.025),
      seatpostClampPos,
      0.0125,
      0.0125,
      mats.chrome,
      18
    )
  );
  const clampCradle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.048, 14), mats.chrome);
  clampCradle.rotation.x = Math.PI * 0.5;
  clampCradle.position.copy(seatpostClampPos);
  saddleExplodeGroup.add(clampCradle);

  // Saddle top sub-group centered at exact (-0.28, 0.76, 0)
  const saddleHeadGroup = new THREE.Group();
  saddleHeadGroup.position.copy(SADDLE_TOP);
  saddleExplodeGroup.add(saddleHeadGroup);

  const saddleAnchor = new THREE.Object3D();
  saddleAnchor.name = "saddleAnchor";
  saddleHeadGroup.add(saddleAnchor);

  const saddleShellMesh = new THREE.Mesh(createBrooksSaddleShellGeometry(), mats.leather);
  saddleHeadGroup.add(saddleShellMesh);

  // Hammered copper rivets: 7 along rear cantle + 2 on nose
  const rivetGeo = new THREE.SphereGeometry(0.0034, 10, 8);
  for (let i = -3; i <= 3; i++) {
    const frac = i / 3;
    const rivet = new THREE.Mesh(rivetGeo, mats.copper);
    const zR = frac * 0.056;
    const xR = -0.072 + Math.abs(frac) * 0.014;
    const yR = 0.008 - Math.pow(Math.abs(frac), 2.1) * 0.016;
    rivet.position.set(xR, yR, zR);
    rivet.scale.y = 0.45;
    saddleHeadGroup.add(rivet);
  }
  for (const side of [-1, 1]) {
    const noseRivet = new THREE.Mesh(rivetGeo, mats.copper);
    noseRivet.position.set(0.112, 0.004, side * 0.0085);
    noseRivet.scale.y = 0.45;
    saddleHeadGroup.add(noseRivet);
  }

  // Brass rear cantle nameplate & front tension bolt
  const cantleBadge = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.009, 0.036), mats.brass);
  cantleBadge.position.set(-0.086, -0.004, 0);
  saddleHeadGroup.add(cantleBadge);

  const noseShackle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.022, 12), mats.brass);
  noseShackle.rotation.z = Math.PI * 0.5;
  noseShackle.position.set(0.128, -0.012, 0);
  saddleHeadGroup.add(noseShackle);

  // Twin rear coil springs (TorusGeometry stack) & chrome saddle rails
  for (const side of [-1, 1]) {
    const springX = -0.342;
    const springZ = side * 0.044;
    const springTurns = 6;
    for (let k = 0; k < springTurns; k++) {
      const t = k / (springTurns - 1);
      const coilRadius = 0.0125 + Math.sin(t * Math.PI) * 0.0032;
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(coilRadius, 0.0024, 10, 22),
        mats.chrome
      );
      coil.position.set(springX, 0.712 + t * 0.032, springZ);
      coil.rotation.x = Math.PI * 0.5 + 0.11;
      saddleExplodeGroup.add(coil);
    }

    // Chrome saddle rail from beneath coil spring -> through seatpost clamp -> up to saddle nose
    const pRailRear = new THREE.Vector3(springX, 0.710, springZ);
    const pRailClampRear = new THREE.Vector3(seatpostClampPos.x - 0.022, seatpostClampPos.y - 0.004, side * 0.022);
    const pRailClampFront = new THREE.Vector3(seatpostClampPos.x + 0.028, seatpostClampPos.y - 0.002, side * 0.022);
    const pRailNose = new THREE.Vector3(-0.154, 0.746, side * 0.007);

    saddleExplodeGroup.add(makeTubeBetween(pRailRear, pRailClampRear, 0.0032, 0.0032, mats.chrome, 10));
    saddleExplodeGroup.add(makeTubeBetween(pRailClampRear, pRailClampFront, 0.0032, 0.0032, mats.chrome, 10));
    saddleExplodeGroup.add(makeTubeBetween(pRailClampFront, pRailNose, 0.0032, 0.0032, mats.chrome, 10));
  }

  // =========================================================================
  // 5. FULL ANIMATED DRIVETRAIN (+Z), 48-LINK CHAIN & COUNTER-ROTATING PEDALS
  // =========================================================================
  const drivetrainExplodeGroup = new THREE.Group();
  drivetrainExplodeGroup.name = "DrivetrainAssembly";
  group.add(drivetrainExplodeGroup);

  const CHAINRING_Z = 0.055;
  const CHAINRING_R = 0.095;
  const REAR_COG_Z = 0.052;
  const REAR_COG_R = 0.042;
  const CRANK_LEN = 0.165;
  const PEDAL_Z = 0.115;

  // 5-Arm Star Spider + 42T Toothed Chainring at (-0.08, 0.29, +0.055)
  const chainringWheelGroup = new THREE.Group();
  chainringWheelGroup.position.set(BB_POS.x, BB_POS.y, CHAINRING_Z);
  drivetrainExplodeGroup.add(chainringWheelGroup);

  const chainringMesh = new THREE.Mesh(
    createToothedSprocketGeometry(CHAINRING_R, 42, 0.0034, 0.073),
    mats.chrome
  );
  chainringWheelGroup.add(chainringMesh);

  const spiderHub = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.007, 20), mats.chrome);
  spiderHub.rotation.x = Math.PI * 0.5;
  chainringWheelGroup.add(spiderHub);

  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.PI * 0.5;
    const pInner = new THREE.Vector3(Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0.0015);
    const pBolt = new THREE.Vector3(Math.cos(a) * 0.077, Math.sin(a) * 0.077, 0.0005);
    const arm = makeTubeBetween(pInner, pBolt, 0.0085, 0.0055, mats.chrome, 10);
    arm.scale.z = 0.48;
    chainringWheelGroup.add(arm);

    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0044, 0.006, 12), mats.brass);
    bolt.rotation.x = Math.PI * 0.5;
    bolt.position.copy(pBolt);
    chainringWheelGroup.add(bolt);
  }

  // 19T Rear Cog at (-0.54, 0.34, +0.052)
  const rearCogGroup = new THREE.Group();
  rearCogGroup.position.set(R_HUB.x, R_HUB.y, REAR_COG_Z);
  drivetrainExplodeGroup.add(rearCogGroup);

  const rearCogMesh = new THREE.Mesh(
    createToothedSprocketGeometry(REAR_COG_R, 19, 0.0034, 0.018),
    mats.chrome
  );
  rearCogGroup.add(rearCogMesh);

  const freewheelBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.014, 18),
    mats.brass
  );
  freewheelBody.rotation.x = Math.PI * 0.5;
  freewheelBody.position.z = -0.006;
  rearCogGroup.add(freewheelBody);

  // Exact External Bitangent Chain Loop Math: C1 (-0.08, 0.29, R1=0.095) <-> C2 (-0.54, 0.34, R2=0.042)
  const c1x = BB_POS.x;
  const c1y = BB_POS.y;
  const c2x = R_HUB.x;
  const c2y = R_HUB.y;
  const chainDx = c1x - c2x; // +0.460
  const chainDy = c1y - c2y; // -0.050
  const chainCenterDist = Math.hypot(chainDx, chainDy);
  const chainPhi = Math.atan2(chainDy, chainDx);
  const sinBeta = (CHAINRING_R - REAR_COG_R) / chainCenterDist;
  const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
  const beta = Math.asin(sinBeta);

  const thetaTop = chainPhi + Math.PI * 0.5 + beta;
  const thetaBot = chainPhi - Math.PI * 0.5 - beta;

  const t1TopX = c1x + CHAINRING_R * Math.cos(thetaTop);
  const t1TopY = c1y + CHAINRING_R * Math.sin(thetaTop);
  const t1BotX = c1x + CHAINRING_R * Math.cos(thetaBot);
  const t1BotY = c1y + CHAINRING_R * Math.sin(thetaBot);

  const t2TopX = c2x + REAR_COG_R * Math.cos(thetaTop);
  const t2TopY = c2y + REAR_COG_R * Math.sin(thetaTop);
  const t2BotX = c2x + REAR_COG_R * Math.cos(thetaBot);
  const t2BotY = c2y + REAR_COG_R * Math.sin(thetaBot);

  const arc1Len = CHAINRING_R * (Math.PI + 2 * beta); // clockwise around chainring front
  const tanLen = chainCenterDist * cosBeta; // exact tangent length
  const arc2Len = REAR_COG_R * (Math.PI - 2 * beta); // clockwise around rear cog back
  const chainTotalLen = arc1Len + tanLen + arc2Len + tanLen;

  const seg1End = arc1Len;
  const seg2End = seg1End + tanLen;
  const seg3End = seg2End + arc2Len;

  function sampleChainLoop(rawS, outPos, outTan) {
    let s = rawS % chainTotalLen;
    if (s < 0) s += chainTotalLen;

    if (s < seg1End) {
      // Segment 1: Front Chainring clockwise from thetaTop -> thetaBot
      const theta = thetaTop - s / CHAINRING_R;
      outPos.set(c1x + CHAINRING_R * Math.cos(theta), c1y + CHAINRING_R * Math.sin(theta), CHAINRING_Z);
      outTan.set(Math.sin(theta), -Math.cos(theta), 0);
    } else if (s < seg2End) {
      // Segment 2: Bottom tangent from T1_bot -> T2_bot
      const u = (s - seg1End) / tanLen;
      outPos.set(
        t1BotX + (t2BotX - t1BotX) * u,
        t1BotY + (t2BotY - t1BotY) * u,
        CHAINRING_Z + (REAR_COG_Z - CHAINRING_Z) * u
      );
      outTan.set(t2BotX - t1BotX, t2BotY - t1BotY, REAR_COG_Z - CHAINRING_Z).normalize();
    } else if (s < seg3End) {
      // Segment 3: Rear Cog clockwise from thetaBot -> thetaTop - 2*PI
      const theta = thetaBot - (s - seg2End) / REAR_COG_R;
      outPos.set(c2x + REAR_COG_R * Math.cos(theta), c2y + REAR_COG_R * Math.sin(theta), REAR_COG_Z);
      outTan.set(Math.sin(theta), -Math.cos(theta), 0);
    } else {
      // Segment 4: Top tangent (tension run) from T2_top -> T1_top
      const u = (s - seg3End) / tanLen;
      outPos.set(
        t2TopX + (t1TopX - t2TopX) * u,
        t2TopY + (t1TopY - t2TopY) * u,
        REAR_COG_Z + (CHAINRING_Z - REAR_COG_Z) * u
      );
      outTan.set(t1TopX - t2TopX, t1TopY - t2TopY, CHAINRING_Z - REAR_COG_Z).normalize();
    }
  }

  // 48 Full Animated Roller Chain Links (48 outer plate pairs + 48 inner plate pairs + 96 rollers & pins)
  const CHAIN_LINK_COUNT = 48;
  const fullLinkStride = chainTotalLen / CHAIN_LINK_COUNT; // ~0.02837m
  const pinPitch = fullLinkStride * 0.5; // ~0.01419m
  const halfPinPitch = pinPitch * 0.5;

  const outerPlateGeo = createFigure8PlateGeometry(halfPinPitch, 0.0046, 0.0031, 0.0011);
  const innerPlateGeo = createFigure8PlateGeometry(halfPinPitch, 0.0042, 0.0028, 0.0011);

  const rollerGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.0048, 10);
  rollerGeo.rotateX(Math.PI * 0.5);

  const pinGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.0098, 8);
  pinGeo.rotateX(Math.PI * 0.5);

  // 48 * 2 = 96 outer plates, 96 inner plates, 96 rollers, 96 pins (4 ultra-fast InstancedMeshes!)
  const outerPlatesInst = new THREE.InstancedMesh(outerPlateGeo, mats.chrome, CHAIN_LINK_COUNT * 2);
  const innerPlatesInst = new THREE.InstancedMesh(innerPlateGeo, mats.brass, CHAIN_LINK_COUNT * 2);
  const rollersInst = new THREE.InstancedMesh(rollerGeo, mats.darkSteel, CHAIN_LINK_COUNT * 2);
  const pinsInst = new THREE.InstancedMesh(pinGeo, mats.brushedNickel, CHAIN_LINK_COUNT * 2);

  drivetrainExplodeGroup.add(outerPlatesInst, innerPlatesInst, rollersInst, pinsInst);

  const _cPos = new THREE.Vector3();
  const _cTan = new THREE.Vector3();
  const _cSide = new THREE.Vector3();
  const _cNorm = new THREE.Vector3();
  const _cMat = new THREE.Matrix4();
  const _cOffsetPos = new THREE.Vector3();

  function updateChainInstances(crankPhase) {
    const travel = crankPhase * CHAINRING_R;

    for (let i = 0; i < CHAIN_LINK_COUNT; i++) {
      const sBase = i * fullLinkStride + travel;

      // Sub-element A: Inner brass-gold link centered at sBase
      sampleChainLoop(sBase, _cPos, _cTan);
      _cSide.set(0, 0, 1).addScaledVector(_cTan, -_cTan.z).normalize();
      _cNorm.crossVectors(_cSide, _cTan).normalize();
      _cMat.makeBasis(_cTan, _cNorm, _cSide);

      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const zSign = sideIdx === 0 ? -1 : 1;
        _cOffsetPos.copy(_cPos).addScaledVector(_cSide, zSign * 0.0029);
        _cMat.setPosition(_cOffsetPos);
        innerPlatesInst.setMatrixAt(i * 2 + sideIdx, _cMat);
      }

      // Sub-element B: Outer chrome link centered at sBase + pinPitch
      sampleChainLoop(sBase + pinPitch, _cPos, _cTan);
      _cSide.set(0, 0, 1).addScaledVector(_cTan, -_cTan.z).normalize();
      _cNorm.crossVectors(_cSide, _cTan).normalize();
      _cMat.makeBasis(_cTan, _cNorm, _cSide);

      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const zSign = sideIdx === 0 ? -1 : 1;
        _cOffsetPos.copy(_cPos).addScaledVector(_cSide, zSign * 0.0041);
        _cMat.setPosition(_cOffsetPos);
        outerPlatesInst.setMatrixAt(i * 2 + sideIdx, _cMat);
      }

      // Shared joint pins & rollers at sBase - halfPinPitch and sBase + halfPinPitch
      for (let pIdx = 0; pIdx < 2; pIdx++) {
        const sPin = sBase + (pIdx === 0 ? -halfPinPitch : halfPinPitch);
        sampleChainLoop(sPin, _cPos, _cTan);
        _cSide.set(0, 0, 1).addScaledVector(_cTan, -_cTan.z).normalize();
        _cNorm.crossVectors(_cSide, _cTan).normalize();
        _cMat.makeBasis(_cTan, _cNorm, _cSide);
        _cMat.setPosition(_cPos);

        const instIdx = i * 2 + pIdx;
        rollersInst.setMatrixAt(instIdx, _cMat);
        pinsInst.setMatrixAt(instIdx, _cMat);
      }
    }

    outerPlatesInst.instanceMatrix.needsUpdate = true;
    innerPlatesInst.instanceMatrix.needsUpdate = true;
    rollersInst.instanceMatrix.needsUpdate = true;
    pinsInst.instanceMatrix.needsUpdate = true;
  }

  // Left (z = -0.115) & Right (z = +0.115) Crank Arms (L = 0.165m) + Counter-Rotating Platform Pedals
  const crankAssembly = new THREE.Group();
  crankAssembly.name = "CrankAssembly";
  crankAssembly.position.copy(BB_POS);
  group.add(crankAssembly);

  const bbSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.146, 14), mats.darkSteel);
  bbSpindle.rotation.x = Math.PI * 0.5;
  crankAssembly.add(bbSpindle);

  function buildPlatformPedal(sideSign) {
    const pedalGroup = new THREE.Group();
    const treadDropY = -0.009; // Drop-spindle offset so top rubber tread is flush at y = 0!

    // Offset crank-spindle collar linking spindle axis (0,0) to dropped platform body (0, -0.009)
    pedalGroup.add(
      makeTubeBetween(
        new THREE.Vector3(0, 0, -sideSign * 0.032),
        new THREE.Vector3(0, treadDropY, -sideSign * 0.028),
        0.0055,
        0.0062,
        mats.chrome,
        10
      )
    );

    // Central barrel sleeve
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.068, 12), mats.chrome);
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.y = treadDropY;
    pedalGroup.add(barrel);

    // Chrome cage plates (inner & outer)
    for (const zOff of [-0.031, 0.031]) {
      const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.015, 0.003), mats.chrome);
      sidePlate.position.set(0, treadDropY, zOff);
      pedalGroup.add(sidePlate);
    }

    // Front & rear cage end plates + Amber Reflectors (#F4A623)
    for (const xSign of [-1, 1]) {
      const endBar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.064), mats.brushedNickel);
      endBar.position.set(xSign * 0.043, treadDropY, 0);
      pedalGroup.add(endBar);

      const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0085, 0.042), mats.amberReflector);
      reflector.position.set(xSign * 0.0455, treadDropY, 0);
      pedalGroup.add(reflector);
    }

    // Twin serrated charcoal rubber tread blocks: top surface sits flush at y = 0!
    for (const xBlock of [-0.022, 0.022]) {
      const rubberBlock = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.056), mats.rubberTread);
      rubberBlock.position.set(xBlock, treadDropY, 0);
      pedalGroup.add(rubberBlock);
    }

    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0, 0); // Exact orbit (-0.08 + 0.165*sin, 0.29 + 0.165*cos, ±0.115) & flush with top tread!
    pedalGroup.add(anchor);

    return { pedalGroup, anchor };
  }

  function buildCrankSide(isRight) {
    const sideSign = isRight ? 1 : -1;
    const ySign = isRight ? 1 : -1; // At crankPhase=0, right crank is +Y (top), left crank is -Y (bottom)
    const crankSideGroup = new THREE.Group();
    crankAssembly.add(crankSideGroup);

    const zBoss = sideSign * 0.068;
    const zTip = sideSign * 0.078;
    const pCrankHub = new THREE.Vector3(0, 0, zBoss);
    const pCrankTip = new THREE.Vector3(0, ySign * CRANK_LEN, zTip);

    // Forged fluted chrome crank arm + bosses
    const bossHub = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 18), mats.chrome);
    bossHub.rotation.x = Math.PI * 0.5;
    bossHub.position.copy(pCrankHub);
    crankSideGroup.add(bossHub);

    const bossDustCap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 14), mats.brass);
    bossDustCap.rotation.x = Math.PI * 0.5;
    bossDustCap.position.copy(pCrankHub);
    crankSideGroup.add(bossDustCap);

    const arm = makeTubeBetween(pCrankHub, pCrankTip, 0.0125, 0.0095, mats.chrome, 14);
    arm.scale.z = 0.52;
    crankSideGroup.add(arm);

    const bossTip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.010, 16), mats.chrome);
    bossTip.rotation.x = Math.PI * 0.5;
    bossTip.position.copy(pCrankTip);
    crankSideGroup.add(bossTip);

    // Chrome pedal spindle from crank tip out to exact z = ±0.115
    const pPedalCenter = new THREE.Vector3(0, ySign * CRANK_LEN, sideSign * PEDAL_Z);
    crankSideGroup.add(makeTubeBetween(pCrankTip, pPedalCenter, 0.0052, 0.0046, mats.chrome, 10));

    const { pedalGroup, anchor } = buildPlatformPedal(sideSign);
    pedalGroup.position.copy(pPedalCenter);
    crankSideGroup.add(pedalGroup);

    return { crankSideGroup, pedalGroup, anchor };
  }

  const rightCrank = buildCrankSide(true);
  const leftCrank = buildCrankSide(false);

  // =========================================================================
  // 6. STEERABLE FRONT ASSEMBLY (EXACT HEAD-TUBE CONJUGATION TRANSFORM)
  // =========================================================================
  // M_mount * Ry(steerAngle) * M_mount^-1:
  // At steerAngle = 0, steerRigOrigin is 100% rig-local identity coordinates!
  // At steerAngle != 0, the entire front assembly rotates around the exact 72 deg head tube axis!
  const steerMount = new THREE.Group();
  steerMount.position.copy(HT_MID);
  steerMount.rotation.z = HEAD_TILT_RAD;
  group.add(steerMount);

  const steerPivot = new THREE.Group();
  steerPivot.name = "SteerPivot";
  steerMount.add(steerPivot);

  const steerUnrotate = new THREE.Group();
  steerUnrotate.rotation.z = -HEAD_TILT_RAD;
  steerPivot.add(steerUnrotate);

  const steerRigOrigin = new THREE.Group();
  steerRigOrigin.position.set(-HT_MID.x, -HT_MID.y, -HT_MID.z);
  steerUnrotate.add(steerRigOrigin);

  // --- 6A. Lugged Fork Crown, Curved Celeste/Chrome-Sock Fork Blades & Bottle Dynamo ---
  const forkGroup = new THREE.Group();
  steerRigOrigin.add(forkGroup);

  // Steerer shaft connecting fork crown through head tube
  forkGroup.add(makeTubeBetween(FORK_CROWN, HT_TOP, 0.0145, 0.0145, mats.chrome, 16));

  // Sculpted polished chrome twin-plate fork crown
  const forkCrownBar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.024, 0.098), mats.chrome);
  forkCrownBar.position.copy(FORK_CROWN);
  forkCrownBar.rotation.z = HEAD_TILT_RAD;
  forkGroup.add(forkCrownBar);

  // Front rim brake caliper mounted at fork crown
  const frontBrake = createRimBrakeCaliper(mats);
  frontBrake.position.copy(FORK_CROWN).add(new THREE.Vector3(0.016, -0.008, 0));
  frontBrake.rotation.z = -Math.atan2(F_HUB.x - FORK_CROWN.x, FORK_CROWN.y - F_HUB.y);
  forkGroup.add(frontBrake);

  const F_DROPOUT_Z = 0.054;
  for (const side of [-1, 1]) {
    const pCrownShoulder = FORK_CROWN.clone().add(new THREE.Vector3(0, -0.006, side * 0.044));
    const pMidUpper = pCrownShoulder.clone().addScaledVector(STEER_AXIS, -0.185);
    pMidUpper.z = side * 0.049;
    // Graceful French randonneur fork rake curve into front dropouts at (+0.56, 0.34, ±0.054)
    const pRakeCtrl = pCrownShoulder.clone().addScaledVector(STEER_AXIS, -0.295);
    pRakeCtrl.x += 0.012;
    pRakeCtrl.z = side * 0.052;
    const pFrontDropout = new THREE.Vector3(F_HUB.x, F_HUB.y, side * F_DROPOUT_Z);

    const forkCurve = new THREE.CatmullRomCurve3([
      pCrownShoulder,
      pMidUpper,
      pRakeCtrl,
      pFrontDropout,
    ]);
    const bladePts = forkCurve.getPoints(8);

    // Chrome fork crown socket
    forkGroup.add(makeTubeBetween(bladePts[0], bladePts[1], 0.0122, 0.0116, mats.chrome, 14));
    // Celeste tapered upper/mid fork blade
    for (let s = 1; s < 5; s++) {
      const rA = 0.0114 - (s - 1) * 0.0008;
      const rB = 0.0114 - s * 0.0008;
      forkGroup.add(makeTubeBetween(bladePts[s], bladePts[s + 1], rA, rB, mats.celeste, 14));
      const jSphere = new THREE.Mesh(new THREE.SphereGeometry(rB * 0.99, 10, 8), mats.celeste);
      jSphere.position.copy(bladePts[s + 1]);
      forkGroup.add(jSphere);
    }
    // Polished chrome lower fork socks!
    for (let s = 5; s < 8; s++) {
      const rA = 0.0082 - (s - 5) * 0.0006;
      const rB = 0.0082 - (s - 4) * 0.0006;
      forkGroup.add(makeTubeBetween(bladePts[s], bladePts[s + 1], rA, rB, mats.chrome, 14));
    }

    const fDropoutPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.005, 14), mats.chrome);
    fDropoutPlate.rotation.x = Math.PI * 0.5;
    fDropoutPlate.position.copy(pFrontDropout);
    forkGroup.add(fDropoutPlate);
  }

  // Vintage bottle dynamo mounted on left fork blade
  const dynamoGroup = new THREE.Group();
  dynamoGroup.position.set(0.455, 0.548, -0.062);
  dynamoGroup.rotation.z = -0.45;
  forkGroup.add(dynamoGroup);
  const dynamoBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.032, 8, 14), mats.chrome);
  dynamoGroup.add(dynamoBody);
  const dynamoRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 12), mats.brass);
  dynamoRoller.position.set(0.006, 0.030, 0.018);
  dynamoGroup.add(dynamoRoller);

  // --- 6B. Front Wheel (+0.56, 0.34, 0) & Painted Celeste Front Fender ---
  const frontWheelExplodeGroup = new THREE.Group();
  frontWheelExplodeGroup.position.copy(F_HUB);
  steerRigOrigin.add(frontWheelExplodeGroup);

  const frontWheel = createSpokedWheel(mats, { isRear: false });
  frontWheelExplodeGroup.add(frontWheel.wheelRoot);

  const frontFenderGroup = new THREE.Group();
  frontFenderGroup.position.copy(F_HUB);
  steerRigOrigin.add(frontFenderGroup);

  const frontFenderGeo = createFenderGeometry(0.356, 0.054, 0.017, 0.0028, 0.68, 2.86, 40, 10);
  frontFenderGroup.add(new THREE.Mesh(frontFenderGeo, mats.celeste));

  // Vintage chrome fender crest fin near front nose
  const crestTheta = 1.02;
  const crestFin = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.0035), mats.chrome);
  crestFin.position.set(Math.cos(crestTheta) * 0.363, Math.sin(crestTheta) * 0.363, 0);
  crestFin.rotation.z = crestTheta - Math.PI * 0.5;
  frontFenderGroup.add(crestFin);

  for (const side of [-1, 1]) {
    const stayHub = new THREE.Vector3(0, 0, side * F_DROPOUT_Z);
    for (const stayAngle of [1.45, 2.52]) {
      const stayClip = new THREE.Vector3(
        Math.cos(stayAngle) * 0.352,
        Math.sin(stayAngle) * 0.352,
        side * 0.027
      );
      frontFenderGroup.add(makeTubeBetween(stayHub, stayClip, 0.0022, 0.0022, mats.chrome, 8));
    }
  }

  // --- 6C. Quill Stem, Swept-Back Moustache Handlebars, Grips, Levers & Brass Bell ---
  const cockpitExplodeGroup = new THREE.Group();
  steerRigOrigin.add(cockpitExplodeGroup);

  const STEM_PEAK = HT_TOP.clone().addScaledVector(STEER_AXIS, 0.098); // (0.3297, 0.8871, 0)
  const STEM_CLAMP = new THREE.Vector3(0.382, 0.908, 0);

  cockpitExplodeGroup.add(makeTubeBetween(HT_TOP, STEM_PEAK, 0.0112, 0.0112, mats.chrome, 16));
  const stemKnee = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 12), mats.chrome);
  stemKnee.position.copy(STEM_PEAK);
  cockpitExplodeGroup.add(stemKnee);

  const expanderBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 12), mats.brass);
  expanderBolt.position.copy(STEM_PEAK).addScaledVector(STEER_AXIS, 0.010);
  expanderBolt.quaternion.setFromUnitVectors(UP_AXIS, STEER_AXIS);
  cockpitExplodeGroup.add(expanderBolt);

  cockpitExplodeGroup.add(makeTubeBetween(STEM_PEAK, STEM_CLAMP, 0.0122, 0.0135, mats.chrome, 16));
  const barClampSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.036, 18), mats.chrome);
  barClampSleeve.rotation.x = Math.PI * 0.5;
  barClampSleeve.position.copy(STEM_CLAMP);
  cockpitExplodeGroup.add(barClampSleeve);

  // Symmetric swept-back moustache cruiser handlebars with exact grip midpoints (+0.22, 0.90, ∓0.24)
  for (const side of [-1, 1]) {
    const pCenter = STEM_CLAMP.clone();
    const pShoulder = new THREE.Vector3(0.390, 0.911, side * 0.095);
    const pBend = new THREE.Vector3(0.362, 0.909, side * 0.198);
    const pGripFront = new THREE.Vector3(0.280, 0.903, side * 0.236);
    const pGripMid = new THREE.Vector3(0.220, 0.900, side * 0.240);
    const pGripEnd = new THREE.Vector3(0.160, 0.897, side * 0.244);

    const barCurve = new THREE.CatmullRomCurve3([
      pCenter,
      pShoulder,
      pBend,
      pGripFront,
      pGripMid,
      pGripEnd,
    ]);
    const barGeo = new THREE.TubeGeometry(barCurve, 42, 0.0108, 14, false);
    cockpitExplodeGroup.add(new THREE.Mesh(barGeo, mats.chrome));

    // Stitched honey-leather & cork grip around pGripFront -> pGripEnd (midpoint = (+0.22, 0.90, ∓0.24))
    cockpitExplodeGroup.add(makeTubeBetween(pGripFront, pGripEnd, 0.0148, 0.0154, mats.leather, 18));

    // Cork inlay bands + chrome end collars + brass bar-end plug
    const gripDir = new THREE.Vector3().subVectors(pGripEnd, pGripFront).normalize();
    const pCollarFront = pGripFront.clone().addScaledVector(gripDir, 0.008);
    const pCollarRear = pGripEnd.clone().addScaledVector(gripDir, -0.008);
    cockpitExplodeGroup.add(makeTubeBetween(pGripFront, pCollarFront, 0.0158, 0.0158, mats.chrome, 16));
    cockpitExplodeGroup.add(makeTubeBetween(pCollarRear, pGripEnd, 0.0158, 0.0158, mats.chrome, 16));

    const pCorkA = pGripMid.clone().addScaledVector(gripDir, -0.018);
    const pCorkB = pGripMid.clone().addScaledVector(gripDir, +0.018);
    cockpitExplodeGroup.add(makeTubeBetween(pCorkA, pCorkB, 0.0157, 0.0157, mats.cork, 16));

    const endPlug = new THREE.Mesh(new THREE.SphereGeometry(0.0152, 14, 10), mats.brass);
    endPlug.position.copy(pGripEnd);
    cockpitExplodeGroup.add(endPlug);

    // Retro chrome brake lever clamped just ahead of grip
    const leverClampPos = new THREE.Vector3(0.304, 0.905, side * 0.226);
    const leverHood = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.020), mats.chrome);
    leverHood.position.copy(leverClampPos).add(new THREE.Vector3(0.008, -0.006, side * 0.010));
    cockpitExplodeGroup.add(leverHood);

    const pLeverStart = leverHood.position.clone();
    const pLeverMid = pLeverStart.clone().add(new THREE.Vector3(-0.042, -0.018, side * 0.028));
    const pLeverTip = pLeverMid.clone().add(new THREE.Vector3(-0.048, -0.012, side * 0.012));
    cockpitExplodeGroup.add(makeTubeBetween(pLeverStart, pLeverMid, 0.0042, 0.0036, mats.chrome, 10));
    cockpitExplodeGroup.add(makeTubeBetween(pLeverMid, pLeverTip, 0.0036, 0.0028, mats.chrome, 10));
    const leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), mats.chrome);
    leverBall.position.copy(pLeverTip);
    cockpitExplodeGroup.add(leverBall);
  }

  // Exact Handlebar Grip Anchors at (+0.22, 0.90, -0.24) and (+0.22, 0.90, +0.24)
  const leftGripAnchor = new THREE.Object3D();
  leftGripAnchor.name = "leftGripAnchor";
  leftGripAnchor.position.set(0.22, 0.9, -0.24);
  cockpitExplodeGroup.add(leftGripAnchor);

  const rightGripAnchor = new THREE.Object3D();
  rightGripAnchor.name = "rightGripAnchor";
  rightGripAnchor.position.set(0.22, 0.9, 0.24);
  cockpitExplodeGroup.add(rightGripAnchor);

  // Brass Rotary Bicycle Bell (#D9A441) + Animated Clapper & Dome
  const bellBaseGroup = new THREE.Group();
  bellBaseGroup.position.set(0.386, 0.916, -0.072);
  cockpitExplodeGroup.add(bellBaseGroup);

  const bellClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.016, 14), mats.chrome);
  bellClamp.rotation.x = Math.PI * 0.5;
  bellClamp.position.y = -0.006;
  bellBaseGroup.add(bellClamp);

  const bellPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.006, 0.018, 12), mats.chrome);
  bellPost.position.y = 0.008;
  bellBaseGroup.add(bellPost);

  const bellDomePivot = new THREE.Group();
  bellDomePivot.position.y = 0.016;
  bellBaseGroup.add(bellDomePivot);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.brass
  );
  bellDome.scale.set(1.0, 0.78, 1.0);
  bellDomePivot.add(bellDome);

  const bellFinial = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), mats.chrome);
  bellFinial.position.y = 0.021;
  bellDomePivot.add(bellFinial);

  const bellTopAnchor = new THREE.Object3D();
  bellTopAnchor.name = "bellTopAnchor";
  bellTopAnchor.position.set(0, 0.024, 0);
  bellDomePivot.add(bellTopAnchor);

  // Spring-loaded brass clapper & thumb lever
  const bellClapperPivot = new THREE.Group();
  bellClapperPivot.position.set(0, 0.012, 0);
  bellBaseGroup.add(bellClapperPivot);

  const clapperArm = makeTubeBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.028, 0.004, -0.020),
    0.0022,
    0.0022,
    mats.chrome,
    8
  );
  bellClapperPivot.add(clapperArm);

  const clapperHammer = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 10, 8), mats.brass);
  clapperHammer.position.set(-0.028, 0.005, -0.020);
  bellClapperPivot.add(clapperHammer);

  // --- 6D. Woven Wicker Front Basket (#C69355) + Baguette, Brass Compass & 2 Sardines on Ice ---
  const basketExplodeGroup = new THREE.Group();
  steerRigOrigin.add(basketExplodeGroup);

  // Chrome porteur support strut from Fork Crown up under the wicker basket
  basketExplodeGroup.add(
    makeTubeBetween(
      FORK_CROWN.clone().add(new THREE.Vector3(0.012, 0.004, 0)),
      new THREE.Vector3(0.495, 0.728, 0),
      0.0045,
      0.0045,
      mats.chrome,
      10
    )
  );
  for (const side of [-1, 1]) {
    basketExplodeGroup.add(
      makeTubeBetween(
        new THREE.Vector3(0.495, 0.728, 0),
        new THREE.Vector3(0.515, 0.732, side * 0.105),
        0.004,
        0.004,
        mats.chrome,
        8
      )
    );
    // Twin honey-leather handlebar mounting straps with brass buckles
    const strapLoop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0048, 8, 18), mats.leather);
    strapLoop.position.set(0.402, 0.892, side * 0.072);
    strapLoop.rotation.y = Math.PI * 0.5;
    basketExplodeGroup.add(strapLoop);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), mats.brass);
    buckle.position.set(0.418, 0.875, side * 0.072);
    basketExplodeGroup.add(buckle);
  }

  const basketGroup = new THREE.Group();
  basketGroup.position.set(0.515, 0.808, 0);
  basketExplodeGroup.add(basketGroup);

  const basketCenterAnchor = new THREE.Object3D();
  basketCenterAnchor.name = "basketCenterAnchor";
  basketCenterAnchor.position.set(0, 0.042, 0);
  basketGroup.add(basketCenterAnchor);

  const bH = 0.155;
  const bBotX = 0.155;
  const bBotZ = 0.235;
  const bTopX = 0.188;
  const bTopZ = 0.278;

  // Basket floor panel
  const basketFloor = new THREE.Mesh(new THREE.BoxGeometry(bBotX, 0.010, bBotZ), mats.wickerDark);
  basketFloor.position.y = -bH * 0.5;
  basketGroup.add(basketFloor);

  // Horizontal woven reed rings (alternating warm rattan & toasted reed for crisp woven depth)
  const reedRows = 11;
  for (let r = 0; r < reedRows; r++) {
    const t = r / (reedRows - 1);
    const y = -bH * 0.5 + 0.008 + t * (bH - 0.012);
    const rx = (bBotX + (bTopX - bBotX) * t) * 0.5;
    const rz = (bBotZ + (bTopZ - bBotZ) * t) * 0.5;
    const reedMat = r % 2 === 0 ? mats.wicker : mats.wickerDark;
    const ringRadius = r === reedRows - 1 ? 0.0095 : 0.0058;

    const pFL = new THREE.Vector3(+rx, y, -rz);
    const pFR = new THREE.Vector3(+rx, y, +rz);
    const pBR = new THREE.Vector3(-rx, y, +rz);
    const pBL = new THREE.Vector3(-rx, y, -rz);

    basketGroup.add(makeTubeBetween(pFL, pFR, ringRadius, ringRadius, reedMat, 10));
    basketGroup.add(makeTubeBetween(pFR, pBR, ringRadius, ringRadius, reedMat, 10));
    basketGroup.add(makeTubeBetween(pBR, pBL, ringRadius, ringRadius, reedMat, 10));
    basketGroup.add(makeTubeBetween(pBL, pFL, ringRadius, ringRadius, reedMat, 10));

    for (const corner of [pFL, pFR, pBR, pBL]) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(ringRadius * 1.12, 8, 8), reedMat);
      knot.position.copy(corner);
      basketGroup.add(knot);
    }
  }

  // Vertical rattan stakes woven through the basket walls
  const stakePositions = [
    [-0.5, -0.5], [-0.5, -0.25], [-0.5, 0], [-0.5, 0.25], [-0.5, 0.5],
    [+0.5, -0.5], [+0.5, -0.25], [+0.5, 0], [+0.5, 0.25], [+0.5, 0.5],
    [-0.25, -0.5], [0, -0.5], [+0.25, -0.5],
    [-0.25, +0.5], [0, +0.5], [+0.25, +0.5],
  ];
  for (const [fx, fz] of stakePositions) {
    const pBot = new THREE.Vector3(fx * bBotX, -bH * 0.5, fz * bBotZ);
    const pTop = new THREE.Vector3(fx * bTopX, +bH * 0.5, fz * bTopZ);
    basketGroup.add(makeTubeBetween(pBot, pTop, 0.0042, 0.0046, mats.wicker, 8));
  }

  // Interior linen/ice tray floor at y = +0.015 inside basket so Riviera cargo is prominently visible!
  const cargoTray = new THREE.Mesh(
    new THREE.BoxGeometry(bTopX * 0.86, 0.012, bTopZ * 0.86),
    mats.ivoryEnamel
  );
  cargoTray.position.y = 0.016;
  basketGroup.add(cargoTray);

  // Cargo 1: Crusty French Baguette in Boulangerie Paper Sleeve (peeking jauntily from left side)
  const baguetteGroup = new THREE.Group();
  baguetteGroup.position.set(0.010, 0.068, -0.068);
  baguetteGroup.rotation.set(-0.36, 0.14, 0.42);
  basketGroup.add(baguetteGroup);

  const baguetteLoaf = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.022, 0.21, 10, 18),
    mats.baguetteCrust
  );
  baguetteLoaf.scale.set(1.0, 1.0, 0.84);
  baguetteGroup.add(baguetteLoaf);

  // 4 diagonal baker's score slashes (grignes)
  for (let k = 0; k < 4; k++) {
    const slash = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0052, 0.026, 6, 10),
      mats.baguetteCrumb
    );
    slash.position.set(0.016, 0.022 + k * 0.028, 0.002);
    slash.rotation.set(0.55, 0, -0.35);
    baguetteGroup.add(slash);
  }

  // Kraft paper boulangerie sleeve around lower half
  const paperSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0255, 0.024, 0.125, 16, 1, true),
    mats.kraftPaper
  );
  paperSleeve.position.y = -0.052;
  baguetteGroup.add(paperSleeve);

  // Cargo 2: Vintage Brass Maritime Compass (rear-right, angled toward rider POV)
  const compassGroup = new THREE.Group();
  compassGroup.position.set(-0.036, 0.042, 0.064);
  compassGroup.rotation.set(0.12, 0, 0.28);
  basketGroup.add(compassGroup);

  const compassCase = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.027, 0.014, 24), mats.brass);
  compassGroup.add(compassCase);

  const compassRim = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.0028, 10, 24), mats.brass);
  compassRim.rotation.x = Math.PI * 0.5;
  compassRim.position.y = 0.007;
  compassGroup.add(compassRim);

  const compassRingLoop = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0018, 8, 16), mats.brass);
  compassRingLoop.position.set(-0.032, 0.002, 0);
  compassRingLoop.rotation.x = Math.PI * 0.5;
  compassGroup.add(compassRingLoop);

  const compassFace = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.002, 24), mats.ivoryEnamel);
  compassFace.position.y = 0.0068;
  compassGroup.add(compassFace);

  const compassNeedlePivot = new THREE.Group();
  compassNeedlePivot.position.y = 0.0088;
  compassGroup.add(compassNeedlePivot);

  const needleNorth = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.018, 6), mats.rubyReflector);
  needleNorth.rotation.z = -Math.PI * 0.5;
  needleNorth.position.x = 0.009;
  compassNeedlePivot.add(needleNorth);

  const needleSouth = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.018, 6), mats.navyEnamel);
  needleSouth.rotation.z = Math.PI * 0.5;
  needleSouth.position.x = -0.009;
  compassNeedlePivot.add(needleSouth);

  const compassPivotPin = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), mats.brass);
  compassNeedlePivot.add(compassPivotPin);

  const compassLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.023, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35),
    mats.compassGlass
  );
  compassLens.position.y = 0.002;
  compassGroup.add(compassLens);

  // Cargo 3: Bed of Glistening Crushed Ice + 2 Shimmering Silver Sardines
  const iceOffsets = [
    [0.028, 0.028, 0.012, 0.022],
    [0.045, 0.027, 0.048, 0.020],
    [0.015, 0.028, 0.058, 0.024],
    [0.052, 0.027, -0.005, 0.021],
    [0.036, 0.030, 0.088, 0.022],
    [0.005, 0.027, 0.095, 0.019],
    [-0.010, 0.027, 0.025, 0.020],
    [0.048, 0.028, 0.072, 0.018],
    [0.024, 0.029, -0.022, 0.020],
  ];
  for (let idx = 0; idx < iceOffsets.length; idx++) {
    const [ix, iy, iz, isize] = iceOffsets[idx];
    const cube = new THREE.Mesh(
      new THREE.DodecahedronGeometry(isize * 0.62, 0),
      mats.iceCrystal
    );
    cube.position.set(ix, iy, iz);
    cube.rotation.set(idx * 0.7, idx * 1.1, idx * 0.5);
    cube.scale.y = 0.65;
    basketGroup.add(cube);
  }

  const sardine1 = createSilverSardineMesh(mats);
  sardine1.position.set(0.028, 0.042, 0.024);
  sardine1.rotation.set(1.15, 0.28, -0.12);
  basketGroup.add(sardine1);

  const sardine2 = createSilverSardineMesh(mats);
  sardine2.position.set(0.046, 0.043, 0.068);
  sardine2.rotation.set(-1.12, -0.18, 0.16);
  basketGroup.add(sardine2);

  // --- 6E. Vintage Chrome Dynamo Headlamp + Volumetric Cone + SpotLight ---
  const headlampExplodeGroup = new THREE.Group();
  steerRigOrigin.add(headlampExplodeGroup);

  // Chrome bracket projecting cleanly from front of porteur basket rack so beam is 100% unobstructed
  headlampExplodeGroup.add(
    makeTubeBetween(
      new THREE.Vector3(0.595, 0.752, 0),
      new THREE.Vector3(0.642, 0.768, 0),
      0.0042,
      0.0042,
      mats.chrome,
      10
    )
  );

  const headlampGroup = new THREE.Group();
  headlampGroup.position.set(0.650, 0.782, 0);
  headlampGroup.rotation.z = -0.105; // Aimed gently onto the road ahead so cone haze clears y=0
  headlampExplodeGroup.add(headlampGroup);

  // Teardrop bullet chrome shell
  const lampConeRear = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 20, 14),
    mats.chrome
  );
  lampConeRear.position.x = -0.016;
  lampConeRear.scale.set(1.45, 1.0, 1.0);
  headlampGroup.add(lampConeRear);

  const lampBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.031, 0.0042, 12, 24),
    mats.chrome
  );
  lampBezel.position.x = 0.018;
  lampBezel.rotation.y = Math.PI * 0.5;
  headlampGroup.add(lampBezel);

  // Classic hooded chrome upper visor
  const lampVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.022, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
    mats.brass
  );
  lampVisor.rotation.z = Math.PI * 0.5;
  lampVisor.rotation.x = Math.PI * 0.5;
  lampVisor.position.set(0.024, 0.002, 0);
  headlampGroup.add(lampVisor);

  const lampLensMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.0295, 18, 12),
    mats.headlampLens
  );
  lampLensMesh.position.x = 0.016;
  lampLensMesh.scale.set(0.35, 1.0, 1.0);
  headlampGroup.add(lampLensMesh);

  // Additive Volumetric Light Cone Mesh (apex at lens, opening along +X, staying cleanly above y=0)
  const beamConeGroup = new THREE.Group();
  beamConeGroup.position.set(0.026, 0, 0);
  beamConeGroup.visible = false;
  beamConeGroup.scale.setScalar(0.0001);
  headlampGroup.add(beamConeGroup);

  const beamLen = 3.0;
  const beamGeo = new THREE.CylinderGeometry(0.028, 0.36, beamLen, 28, 1, true);
  // Rotate so cylinder top (+Y, radius 0.028, uv.y=1) sits at x=0 and expands to x=+beamLen
  beamGeo.rotateZ(Math.PI * 0.5);
  beamGeo.translate(beamLen * 0.5, 0, 0);
  const beamOuterMesh = new THREE.Mesh(beamGeo, mats.beamOuterMat);
  beamOuterMesh.userData.noShadow = true;
  beamOuterMesh.renderOrder = 4;
  beamConeGroup.add(beamOuterMesh);

  const beamCoreGeo = new THREE.CylinderGeometry(0.018, 0.17, beamLen * 0.72, 20, 1, true);
  beamCoreGeo.rotateZ(Math.PI * 0.5);
  beamCoreGeo.translate(beamLen * 0.36, 0, 0);
  const beamCoreMesh = new THREE.Mesh(beamCoreGeo, mats.beamOuterMat);
  beamCoreMesh.userData.noShadow = true;
  beamCoreMesh.renderOrder = 5;
  beamConeGroup.add(beamCoreMesh);

  // Real THREE.SpotLight illuminating the road ahead when headlightOn is true
  const headlightSpot = new THREE.SpotLight(PALETTE.headlampWarm, 0, 22, 0.52, 0.68, 1.2);
  headlightSpot.position.set(0.03, 0, 0);
  headlightSpot.castShadow = false; // Avoid exceeding WebGL max shadow texture units with world sunLight
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(5.5, -0.35, 0);
  headlampGroup.add(headlightSpot, spotTarget);
  headlightSpot.target = spotTarget;

  // =========================================================================
  // 7. INITIALIZE SHADOWS, STATE & PUBLIC RIG CONTRACT API
  // =========================================================================
  applyShadowRecursive(group, castShadow, receiveShadow);

  let currentWireframe = false;
  let explodedAmount = 0;

  // Initialize drivetrain at crankPhase = 0 so rig is valid before first update()
  updateChainInstances(0);

  function applyHeadlightState(isOn, time = 0) {
    const on = Boolean(isOn);
    beamConeGroup.visible = on;
    beamConeGroup.scale.setScalar(on ? 1.0 : 0.0001);
    headlightSpot.visible = on;
    const pulse = 1.0 + Math.sin(time * 9.5) * 0.025;
    headlightSpot.intensity = on ? 9.5 * pulse : 0;
    mats.headlampLens.emissiveIntensity = on ? 1.45 * pulse : 0.1;
    mats.beamOuterMat.uniforms.uOpacity.value = on ? 0.21 * pulse : 0.0;
    mats.rubyReflector.emissiveIntensity = on ? 0.9 : 0.32;
  }

  function setExploded(amount01) {
    const e = THREE.MathUtils.clamp(Number(amount01) || 0, 0, 1);
    explodedAmount = e;

    // Smooth mechanical sub-assembly explosion preserving reachable rider IK geometry!
    drivetrainExplodeGroup.position.set(0, 0, 0.22 * e);
    rightCrank.crankSideGroup.position.set(0, 0, 0.026 * e);
    leftCrank.crankSideGroup.position.set(0, 0, -0.026 * e);

    rearWheelExplodeGroup.position.set(R_HUB.x - 0.15 * e, R_HUB.y, -0.22 * e);
    frontWheelExplodeGroup.position.set(F_HUB.x + 0.15 * e, F_HUB.y, -0.22 * e);

    rearFenderGroup.position.set(R_HUB.x - 0.08 * e, R_HUB.y + 0.14 * e, 0);
    frontFenderGroup.position.set(F_HUB.x + 0.06 * e, F_HUB.y + 0.13 * e, 0);

    // Offset saddle cleanly along seatpost axis while keeping bottom-of-stroke within 2-bone IK reach
    saddleExplodeGroup.position.set(SEAT_AXIS.x * 0.042 * e, SEAT_AXIS.y * 0.042 * e, 0);
    cockpitExplodeGroup.position.set(STEER_AXIS.x * 0.035 * e, STEER_AXIS.y * 0.035 * e, 0);

    basketExplodeGroup.position.set(0.18 * e, 0.08 * e, 0);
    headlampExplodeGroup.position.set(0.27 * e, 0.04 * e, 0);
  }

  function update(state = {}) {
    const crankPhase = Number.isFinite(state.crankPhase) ? state.crankPhase : 0;
    const wheelPhase = Number.isFinite(state.wheelPhase) ? state.wheelPhase : 0;
    const steerAngle = Number.isFinite(state.steerAngle)
      ? THREE.MathUtils.clamp(state.steerAngle, -0.85, 0.85)
      : 0;
    const time = Number.isFinite(state.time) ? state.time : 0;
    const bellStrike =
      typeof state.bellStrike === "boolean"
        ? state.bellStrike
          ? 1
          : 0
        : THREE.MathUtils.clamp(Number(state.bellStrike) || 0, 0, 1.5);

    // 1. Wheel forward rotation (-wheelPhase around +Z)
    rearWheel.spinGroup.rotation.z = -wheelPhase;
    frontWheel.spinGroup.rotation.z = -wheelPhase;
    dynamoRoller.rotation.y = wheelPhase * 12.0;

    // 2. Cranks (-crankPhase) & counter-rotated horizontal platform pedals (+crankPhase)
    crankAssembly.rotation.z = -crankPhase;
    rightCrank.pedalGroup.rotation.z = crankPhase;
    leftCrank.pedalGroup.rotation.z = crankPhase;

    // 3. Drivetrain sprockets & 48 animated roller chain links
    chainringWheelGroup.rotation.z = -crankPhase;
    rearCogGroup.rotation.z = -crankPhase * (CHAINRING_R / REAR_COG_R);
    updateChainInstances(crankPhase);

    // 4. Steerable front assembly pivot around tilted head tube axis
    steerPivot.rotation.y = steerAngle;

    // 5. Brass rotary bell clapper shake & dome shimmer
    if (bellStrike > 0.001) {
      const ringWave = Math.sin(time * 68.0);
      bellClapperPivot.rotation.y = ringWave * 0.36 * bellStrike;
      bellDomePivot.rotation.z = Math.cos(time * 84.0) * 0.055 * bellStrike;
      bellDomePivot.rotation.x = ringWave * 0.045 * bellStrike;
    } else {
      bellClapperPivot.rotation.y = 0;
      bellDomePivot.rotation.set(0, 0, 0);
    }

    // Subtle compass needle life against steering
    compassNeedlePivot.rotation.y = -steerAngle * 0.85 + Math.sin(time * 2.3) * 0.06;

    // 6. Headlamp & wireframe toggles
    applyHeadlightState(state.headlightOn, time);

    const nextWireframe = Boolean(state.wireframe);
    if (nextWireframe !== currentWireframe) {
      currentWireframe = nextWireframe;
      for (const mat of mats.wireframeList) {
        mat.wireframe = nextWireframe;
      }
    }
  }

  function getRigAnchors() {
    group.updateMatrixWorld(true);

    const toRigLocal = (anchorObj) => {
      const v = new THREE.Vector3();
      anchorObj.getWorldPosition(v);
      return group.worldToLocal(v);
    };

    return {
      leftPedal: toRigLocal(leftCrank.anchor),
      rightPedal: toRigLocal(rightCrank.anchor),
      leftGrip: toRigLocal(leftGripAnchor),
      rightGrip: toRigLocal(rightGripAnchor),
      saddle: toRigLocal(saddleAnchor),
      basketCenter: toRigLocal(basketCenterAnchor),
      bellTop: toRigLocal(bellTopAnchor),
    };
  }

  // Ensure initial matrices & default lighting state are clean
  applyHeadlightState(false, 0);
  setExploded(explodedAmount);
  group.updateMatrixWorld(true);

  return {
    group,
    update,
    getRigAnchors,
    setExploded,
  };
}
