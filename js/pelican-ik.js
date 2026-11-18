import * as THREE from "three";

// ============================================================================
// Design Palette Tokens (SHARED_RIG_CONTRACT.md Section 2)
// ============================================================================
const PALETTE = {
  skyCerulean: "#6EC6E6",
  chalkIvory: "#F7F3E8",
  creamPearl: "#EAE2D0",
  slateTip: "#253646",
  harborNavy: "#102336",
  mandarin: "#F26A2E",
  coralGlow: "#FF9B6A",
  goldenOchre: "#F4B942",
  brassOchre: "#D9A441",
  honeyLeather: "#8C4A27",
  rivieraRed: "#D63B2F",
  visorInk: "#0B1622",
  sardineSilver: "#DCE5ED",
  sardineBack: "#3B5971",
  emeraldLift: "#10B981",
  debugCyan: "#38BDF8",
};

const LEG_LEN_1 = 0.38; // Thigh (hip -> knee)
const LEG_LEN_2 = 0.37; // Shank (knee -> ankle)
const WING_LEN_1 = 0.34; // Humerus (shoulder -> elbow)
const WING_LEN_2 = 0.36; // Ulna/Forearm (elbow -> wrist/carpal)

const _ikDiff = new THREE.Vector3();
const _ikFallback = new THREE.Vector3();
const _basisX = new THREE.Vector3();
const _basisY = new THREE.Vector3();
const _basisZ = new THREE.Vector3();
const _basisFallback = new THREE.Vector3();
const _basisMat4 = new THREE.Matrix4();
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _euler = new THREE.Euler();

// ============================================================================
// Exact Analytical 3D 2-Bone Inverse Kinematics
// ============================================================================
/**
 * Solves exact 3D two-bone inverse kinematics in the plane spanned by
 * (targetPos - rootPos) and poleVector.
 * Clamps target distance to [abs(len1 - len2) + 1e-4, (len1 + len2) * 0.998]
 * and clamps Law-of-Cosines input to [-1, 1] so Math.acos NEVER produces NaN.
 */
export function solveTwoBoneIK(rootPos, targetPos, poleVector, len1, len2, out = null) {
  const result = out || {
    rootPos: new THREE.Vector3(),
    midPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    bendDir: new THREE.Vector3(),
    planeNormal: new THREE.Vector3(),
    rawDistance: 0,
    clampedDistance: 0,
    kneeAngleRad: 0,
  };

  result.rootPos.copy(rootPos);
  _ikDiff.subVectors(targetPos, rootPos);
  const rawDist = _ikDiff.length();
  result.rawDistance = rawDist;

  if (rawDist > 1e-6) {
    result.dir.copy(_ikDiff).multiplyScalar(1 / rawDist);
  } else {
    result.dir.set(0, -1, 0);
  }

  const minDist = Math.abs(len1 - len2) + 1e-4;
  const maxDist = (len1 + len2) * 0.998;
  const clampedDist = THREE.MathUtils.clamp(rawDist, minDist, maxDist);
  result.clampedDistance = clampedDist;

  result.endPos.copy(rootPos).addScaledVector(result.dir, clampedDist);

  // Orthonormalize poleVector against dir to span the exact bend plane
  const proj = poleVector.dot(result.dir);
  result.bendDir.copy(poleVector).addScaledVector(result.dir, -proj);
  if (result.bendDir.lengthSq() < 1e-8) {
    // Fallback perpendicular if poleVector is nearly collinear with dir
    _ikFallback.set(
      Math.abs(result.dir.x) < 0.85 ? 1 : 0,
      0,
      Math.abs(result.dir.x) < 0.85 ? 0 : 1
    );
    result.bendDir.crossVectors(result.dir, _ikFallback);
  }
  result.bendDir.normalize();
  result.planeNormal.crossVectors(result.dir, result.bendDir).normalize();

  // Law of cosines at root joint: cos(alpha) = (L1^2 + d^2 - L2^2) / (2 * L1 * d)
  const cosAlpha = THREE.MathUtils.clamp(
    (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist),
    -1,
    1
  );
  const alpha = Math.acos(cosAlpha);
  const alongDist = Math.cos(alpha) * len1;
  const perpDist = Math.sin(alpha) * len1;

  // Interior knee/elbow angle for diagnostics
  const cosKnee = THREE.MathUtils.clamp(
    (len1 * len1 + len2 * len2 - clampedDist * clampedDist) / (2 * len1 * len2),
    -1,
    1
  );
  result.kneeAngleRad = Math.acos(cosKnee);

  result.midPos
    .copy(rootPos)
    .addScaledVector(result.dir, alongDist)
    .addScaledVector(result.bendDir, perpDist);

  return result;
}

/**
 * Orients a limb Object3D whose local +Y runs from jointA (y=0) to jointB (y=len),
 * using forwardHint (+X) to eliminate axial twist roll.
 */
function orientBoneAlongY(obj, startPos, endPos, forwardHint) {
  obj.position.copy(startPos);
  _basisY.subVectors(endPos, startPos);
  const len = _basisY.length();
  if (len < 1e-6) {
    _basisY.set(0, 1, 0);
  } else {
    _basisY.multiplyScalar(1 / len);
  }

  _basisX.copy(forwardHint).addScaledVector(_basisY, -forwardHint.dot(_basisY));
  if (_basisX.lengthSq() < 1e-8) {
    _basisFallback.set(0, 0, 1);
    _basisX.crossVectors(_basisY, _basisFallback);
  }
  _basisX.normalize();
  _basisZ.crossVectors(_basisX, _basisY).normalize();
  _basisX.crossVectors(_basisY, _basisZ).normalize();

  _basisMat4.makeBasis(_basisX, _basisY, _basisZ);
  obj.quaternion.setFromRotationMatrix(_basisMat4);
}

/**
 * Computes a right-handed quaternion for a wing bone where:
 *   side * localZ = spanwise bone direction (start -> end)
 *   +localX       = leading edge direction (forward in open flight)
 *   +localY       = dorsal upper surface (skyward in open flight)
 * Guarantees 100% mirror symmetry across Z=0 with determinant +1 (zero negative scale).
 */
function computeWingSegmentQuaternion(startPos, endPos, side, leadingHint, outQuat) {
  _basisZ.subVectors(endPos, startPos);
  const len = _basisZ.length();
  if (len < 1e-6) {
    _basisZ.set(0, 0, 1);
  } else {
    _basisZ.multiplyScalar(side / len);
  }

  _basisX.copy(leadingHint).addScaledVector(_basisZ, -leadingHint.dot(_basisZ));
  if (_basisX.lengthSq() < 1e-8) {
    _basisFallback.set(0, 1, 0);
    _basisX.crossVectors(_basisFallback, _basisZ);
  }
  _basisX.normalize();
  _basisY.crossVectors(_basisZ, _basisX).normalize();
  _basisX.crossVectors(_basisY, _basisZ).normalize();

  _basisMat4.makeBasis(_basisX, _basisY, _basisZ);
  return outQuat.setFromRotationMatrix(_basisMat4);
}

// ============================================================================
// Procedural Sculpted BufferGeometry Helpers (Three.js r170)
// ============================================================================

/**
 * Plump, charismatic streamlined Great White Pelican torso BufferGeometry.
 * Spine travels from rear rump/tail-base (-0.19, +0.02, 0) up and forward
 * through a buoyant boat-hull belly and proud rounded breast (+0.23, +0.26, 0).
 */
function createPelicanTorsoGeometry() {
  const rings = 28;
  const segs = 24;
  const positions = [];
  const colors = [];
  const indices = [];

  const ivory = new THREE.Color(PALETTE.chalkIvory);
  const cream = new THREE.Color(PALETTE.creamPearl);
  const tmpColor = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    const t = i / rings; // 0 = tail tip of rump, 1 = upper chest/neck collar
    const smoothSin = Math.sin(Math.PI * Math.pow(t, 0.78));

    // Spine centerline in torso local coordinates
    const cx = THREE.MathUtils.lerp(-0.185, 0.225, t) + Math.sin(t * Math.PI) * 0.028;
    const cy =
      THREE.MathUtils.lerp(0.035, 0.275, Math.pow(t, 1.08)) -
      Math.sin(t * Math.PI) * 0.032;

    // Plump belly & broad proud chest profile
    const chestPuff = Math.exp(-Math.pow((t - 0.68) / 0.26, 2)) * 0.038;
    const rx = 0.016 + smoothSin * 0.132 + chestPuff * 0.7; // vertical half-height
    const rz = 0.014 + smoothSin * 0.128 + chestPuff * 0.85; // lateral half-width

    // Cross-section tilt perpendicular to spine tangent
    const pitchTilt = -0.52;
    const cosP = Math.cos(pitchTilt);
    const sinP = Math.sin(pitchTilt);

    for (let j = 0; j <= segs; j++) {
      const phi = (j / segs) * Math.PI * 2;
      const cosPhi = Math.cos(phi); // +1 = dorsal top, -1 = ventral keel
      const sinPhi = Math.sin(phi); // +/-1 = left/right flanks

      // Boat-keel belly fullness on underside (cosPhi < 0)
      const bellyScale = cosPhi < 0 ? 1.14 : 0.94;
      const localUp = cosPhi * rx * bellyScale;
      const localSide = sinPhi * rz * (1 - 0.06 * Math.max(0, -cosPhi));

      const vx = cx - localUp * sinP;
      const vy = cy + localUp * cosP;
      const vz = localSide;
      positions.push(vx, vy, vz);

      // Subtle pearl-cream shading along underbelly & tail base
      const shadeMix = THREE.MathUtils.clamp(
        0.35 * Math.max(0, -cosPhi) + 0.22 * (1 - t),
        0,
        0.75
      );
      tmpColor.copy(ivory).lerp(cream, shadeMix);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  const stride = segs + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted 3D avian feather BufferGeometry extending from x = 0 (quill root)
 * to x = -length (trailing tip along -X), width along Z, dorsal camber along +Y,
 * with raised central rachis shaft and smooth sRGB->linear vertex color gradient!
 */
function createSculptedFeatherGeometry({
  length = 0.32,
  width = 0.062,
  camber = 0.012,
  thickness = 0.0045,
  asymmetry = 0.18,
  tipSplit = 1.0, // < 1.0 gives dark slate tip starting at tipSplit (e.g. 0.45)
  baseHex = PALETTE.chalkIvory,
  midHex = PALETTE.creamPearl,
  tipHex = PALETTE.slateTip,
} = {}) {
  const spanSegs = 10;
  const chordPts = [-1.0, -0.48, 0.0, 0.48, 1.0];
  const positions = [];
  const colors = [];
  const indices = [];

  const cBase = new THREE.Color(baseHex);
  const cMid = new THREE.Color(midHex);
  const cTip = new THREE.Color(tipHex);
  const cShaft = new THREE.Color(PALETTE.chalkIvory);
  const tmp = new THREE.Color();

  // Build top surface (surface = 0) and bottom surface (surface = 1)
  const cols = chordPts.length;
  const rows = spanSegs + 1;
  const vertsPerSide = rows * cols;

  for (let side = 0; side < 2; side++) {
    const isTop = side === 0;
    for (let i = 0; i <= spanSegs; i++) {
      const u = i / spanSegs; // 0 = base, 1 = feather tip
      const x = -u * length;

      // Natural asymmetrical flight-feather silhouette: sleek leading vane, fuller trailing vane
      const envelope =
        Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.62) *
        (1 - 0.18 * u * u);
      const halfW = width * 0.5 * Math.max(0.06, envelope);
      const archY = Math.sin(u * Math.PI) * camber - u * u * camber * 0.45;

      for (let j = 0; j < cols; j++) {
        const cv = chordPts[j]; // -1..+1
        const asymScale = cv < 0 ? 1 - asymmetry : 1 + asymmetry;
        const z = cv * halfW * asymScale;

        const isShaft = j === 2;
        const ridge = isShaft ? thickness * (1 - 0.65 * u) : thickness * 0.28 * (1 - Math.abs(cv));
        const vaneCurve = (1 - cv * cv) * 0.0035;
        const y = archY + vaneCurve + (isTop ? ridge : -ridge * 0.65);

        positions.push(x, y, z);

        if (tipSplit < 0.999) {
          const tipMix = THREE.MathUtils.smoothstep(u, tipSplit - 0.09, tipSplit + 0.09);
          tmp.copy(cBase).lerp(cMid, u * 0.28).lerp(cTip, tipMix);
          if (isShaft && u < tipSplit + 0.16) {
            tmp.lerp(cShaft, 0.55);
          }
        } else {
          tmp.copy(cBase).lerp(cMid, u * 0.45);
        }
        if (!isTop) {
          tmp.lerp(cMid, 0.2);
        }
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }
  }

  // Top indices
  for (let i = 0; i < spanSegs; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }
  // Bottom indices (reversed winding)
  for (let i = 0; i < spanSegs; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = vertsPerSide + i * cols + j;
      const b = vertsPerSide + (i + 1) * cols + j;
      const c = vertsPerSide + (i + 1) * cols + (j + 1);
      const d = vertsPerSide + i * cols + (j + 1);
      indices.push(a, b, d, d, b, c);
    }
  }
  // Stitch perimeter edges cleanly
  for (let i = 0; i < spanSegs; i++) {
    const tL0 = i * cols;
    const tL1 = (i + 1) * cols;
    const bL0 = vertsPerSide + tL0;
    const bL1 = vertsPerSide + tL1;
    indices.push(tL0, tL1, bL0, bL0, tL1, bL1);

    const tR0 = i * cols + (cols - 1);
    const tR1 = (i + 1) * cols + (cols - 1);
    const bR0 = vertsPerSide + tR0;
    const bR1 = vertsPerSide + tR1;
    indices.push(tR0, bR0, tR1, bR0, bR1, tR1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted 0.42m Great White Pelican upper mandible geometry along +X:
 * Wide brow base -> ridged central culmen -> slightly spatulate distal bill.
 */
function createUpperMandibleGeometry(length = 0.405) {
  const rings = 20;
  const profileAngles = 14;
  const positions = [];
  const colors = [];
  const indices = [];

  const cGold = new THREE.Color(PALETTE.goldenOchre);
  const cRidge = new THREE.Color("#FAD26B");
  const cCoral = new THREE.Color(PALETTE.mandarin);
  const tmp = new THREE.Color();

  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const x = u * length;

    // Slight spatulate pelican widening near u=0.72 before rounding to the hooked nail
    const widthFactor =
      (1 - 0.44 * u) + 0.12 * Math.exp(-Math.pow((u - 0.74) / 0.18, 2)) - 0.25 * Math.pow(u, 6);
    const halfW = 0.035 * Math.max(0.18, widthFactor);
    const heightTop = 0.032 * Math.pow(1 - 0.68 * u, 0.85) + 0.004;
    const yBase = -0.004 * Math.sin(u * Math.PI);

    for (let j = 0; j <= profileAngles; j++) {
      const a = (j / profileAngles) * Math.PI * 2;
      const cosA = Math.cos(a); // +1 = top culmen, -1 = underside palate
      const sinA = Math.sin(a); // +/-1 = left/right tomial cutting edges

      const z = sinA * halfW;
      let y = yBase;
      if (cosA >= 0) {
        // Raised dorsal culmen ridge along centerline
        const culmen = Math.exp(-Math.pow(sinA / 0.28, 2)) * 0.0055 * (1 - 0.35 * u);
        y += Math.pow(cosA, 0.75) * heightTop + culmen;
      } else {
        // Slightly concave lower palate
        y += cosA * 0.0045;
      }

      positions.push(x, y, z);

      // Warm coral blush along lateral tomia & distal tip, bright ochre along dorsal ridge
      const edgeBlush = Math.pow(Math.abs(sinA), 3) * 0.32 + Math.pow(u, 3.5) * 0.38;
      const ridgeGlow = cosA > 0.65 ? (cosA - 0.65) * 0.8 : 0;
      tmp.copy(cGold).lerp(cRidge, ridgeGlow).lerp(cCoral, THREE.MathUtils.clamp(edgeBlush, 0, 0.55));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  const stride = profileAngles + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < profileAngles; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Shared half-width function for the lower mandible U-rim AND the top boundary
 * of the dynamic elastic gular pouch so they stay 100% seamlessly stitched!
 */
function lowerBillHalfWidth(u, lateralBow = 0) {
  const baseProfile =
    0.033 * (1 - 0.38 * u) +
    0.005 * Math.exp(-Math.pow((u - 0.7) / 0.2, 2));
  const tipArch = Math.sqrt(Math.max(0, 1 - Math.pow(u, 4.2)));
  const flexBow = Math.sin(u * Math.PI) * lateralBow;
  return Math.max(0.002, (baseProfile + flexBow) * tipArch);
}

/**
 * Builds the articulated U-shaped lower mandible rim geometry.
 */
function createLowerMandibleRimGeometry(length = 0.402) {
  const pts = [];
  const samples = 18;
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    pts.push(new THREE.Vector3(u * length, 0, -lowerBillHalfWidth(u, 0)));
  }
  for (let i = samples - 1; i >= 0; i--) {
    const u = i / samples;
    pts.push(new THREE.Vector3(u * length, 0, +lowerBillHalfWidth(u, 0)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
  return new THREE.TubeGeometry(curve, 44, 0.0058, 8, false);
}

/**
 * Creates a stretched interdigital foot-webbing fan membrane between two toe angles.
 */
function createWebMembraneGeometry(lenA, angA, lenB, angB) {
  const radialSegs = 6;
  const arcSegs = 6;
  const positions = [];
  const indices = [];

  for (let side = 0; side < 2; side++) {
    const yOff = side === 0 ? 0.0026 : -0.0012;
    for (let i = 0; i <= radialSegs; i++) {
      const rFrac = i / radialSegs;
      for (let j = 0; j <= arcSegs; j++) {
        const s = j / arcSegs;
        const ang = THREE.MathUtils.lerp(angA, angB, s);
        const edgeLen = THREE.MathUtils.lerp(lenA, lenB, s);
        // Classic scalloped inward arc along leading edge between toes
        const scallop = 1 - 0.14 * Math.sin(s * Math.PI) * rFrac;
        const r = rFrac * edgeLen * 0.92 * scallop;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const camber = Math.sin(s * Math.PI) * 0.0022 * rFrac;
        positions.push(x, yOff + camber, z);
      }
    }
  }

  const cols = arcSegs + 1;
  const vertsPerSide = (radialSegs + 1) * cols;
  for (let i = 0; i < radialSegs; i++) {
    for (let j = 0; j < arcSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b, d, c, b);

      const a2 = vertsPerSide + a;
      const b2 = vertsPerSide + b;
      const c2 = vertsPerSide + c;
      const d2 = vertsPerSide + d;
      indices.push(a2, b2, d2, d2, b2, c2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Sub-Assembly Builders (Feet, Wings, Gular Pouch + Sardine, Accessories, Debug)
// ============================================================================

function createWebbedFootAssembly(side, mats) {
  const footRoot = new THREE.Group(); // Origin sits at ball-of-foot pedal contact!

  // Ankle/tarsal cushion slightly rear and above ball of foot
  const ankleLocal = new THREE.Vector3(-0.028, 0.022, 0);
  const ankleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), mats.orangeLeg);
  ankleKnob.position.copy(ankleLocal);
  ankleKnob.castShadow = true;
  ankleKnob.receiveShadow = true;
  footRoot.add(ankleKnob);

  const solePad = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), mats.orangeLeg);
  solePad.position.set(-0.012, 0.009, 0);
  solePad.scale.set(1.35, 0.52, 1.15);
  solePad.castShadow = true;
  footRoot.add(solePad);

  // 3 diverging forward toes (+X forward, Z lateral)
  const toeSpecs = [
    { len: 0.108, ang: -0.40 * side, r0: 0.0085, r1: 0.0048 }, // inner toe
    { len: 0.128, ang: 0.0, r0: 0.0095, r1: 0.0052 }, // long middle toe
    { len: 0.114, ang: +0.40 * side, r0: 0.0085, r1: 0.0048 }, // outer toe
  ];

  const sortedToes = [...toeSpecs].sort((a, b) => a.ang - b.ang);
  for (const spec of sortedToes) {
    const toePivot = new THREE.Group();
    toePivot.position.set(-0.012, 0.008, 0);
    toePivot.rotation.y = -spec.ang; // around +Y: -ang rotates +X toward +Z*sin(ang)

    const toeGeo = new THREE.CylinderGeometry(spec.r1, spec.r0, spec.len, 9, 1);
    toeGeo.rotateZ(-Math.PI / 2);
    toeGeo.translate(spec.len * 0.5, 0, 0);
    const toeMesh = new THREE.Mesh(toeGeo, mats.orangeLeg);
    toeMesh.castShadow = true;
    toeMesh.receiveShadow = true;
    toePivot.add(toeMesh);

    // Subtle avian phalanx knuckle bead
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(spec.r0 * 1.08, 8, 8), mats.orangeLeg);
    knuckle.position.set(spec.len * 0.52, 0.001, 0);
    toePivot.add(knuckle);

    // Dark slate claw at tip
    const clawGeo = new THREE.ConeGeometry(spec.r1 * 0.95, 0.016, 7);
    clawGeo.rotateZ(-Math.PI / 2 - 0.24);
    clawGeo.translate(spec.len + 0.006, -0.0015, 0);
    const claw = new THREE.Mesh(clawGeo, mats.slateDark);
    claw.castShadow = true;
    toePivot.add(claw);

    footRoot.add(toePivot);
  }

  // Rear hallux spur
  const halluxGeo = new THREE.CapsuleGeometry(0.005, 0.022, 4, 8);
  halluxGeo.rotateZ(Math.PI / 2 - 0.18);
  const hallux = new THREE.Mesh(halluxGeo, mats.orangeLeg);
  hallux.position.set(-0.038, 0.010, -0.006 * side);
  hallux.castShadow = true;
  footRoot.add(hallux);

  // Two taut interdigital webbing fans stretched between toes 0-1 and 1-2
  for (let w = 0; w < 2; w++) {
    const tA = sortedToes[w];
    const tB = sortedToes[w + 1];
    const webGeo = createWebMembraneGeometry(tA.len, tA.ang, tB.len, tB.ang);
    const webMesh = new THREE.Mesh(webGeo, mats.webbing);
    webMesh.position.set(-0.012, 0.0065, 0);
    webMesh.castShadow = true;
    webMesh.receiveShadow = true;
    footRoot.add(webMesh);
  }

  return { footRoot, ankleLocal };
}

/**
 * Builds one complete multi-segment feathered wing (Left side=-1 or Right side=+1)
 * with shoulder -> humerus (0.34m) -> elbow -> forearm (0.36m) -> wrist/hand
 * and 14 individual overlapping sculpted flight feathers (6 secondaries + 8 slate-tipped primaries)
 * plus plush dorsal covert shingles!
 */
function createWingAssembly(side, mats, sharedGeos) {
  const wingRoot = new THREE.Group(); // Placed at rig-local shoulderPos each frame

  // 1. Upper Wing / Humerus (extends from (0,0,0) to (0, 0, side * WING_LEN_1))
  const upperGroup = new THREE.Group();
  wingRoot.add(upperGroup);

  const humerusGeo = new THREE.CapsuleGeometry(0.032, WING_LEN_1 - 0.03, 6, 12);
  humerusGeo.rotateX(Math.PI / 2);
  humerusGeo.translate(0, 0, side * (WING_LEN_1 * 0.5));
  const humerusMesh = new THREE.Mesh(humerusGeo, mats.ivoryPlumage);
  humerusMesh.scale.set(1.35, 0.72, 1.0);
  humerusMesh.castShadow = true;
  humerusMesh.receiveShadow = true;
  upperGroup.add(humerusMesh);

  // Shoulder plumage epaulette cap
  const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), mats.ivoryPlumage);
  shoulderCap.scale.set(1.3, 0.85, 1.05);
  shoulderCap.castShadow = true;
  upperGroup.add(shoulderCap);

  // Upper humerus dorsal coverts (4 overlapping ivory shingles)
  for (let c = 0; c < 4; c++) {
    const u = (c + 0.5) / 4;
    const covert = new THREE.Mesh(sharedGeos.covertFeather, mats.vertexFeather);
    covert.position.set(0.035, 0.018, side * (u * WING_LEN_1));
    covert.rotation.set(0, side * 0.08, 0.06);
    covert.castShadow = true;
    upperGroup.add(covert);
  }

  // 2. Forearm / Ulna-Radius (placed at elbowPos in rig-local space)
  const foreGroup = new THREE.Group();
  wingRoot.add(foreGroup);

  const ulnaGeo = new THREE.CapsuleGeometry(0.025, WING_LEN_2 - 0.02, 6, 12);
  ulnaGeo.rotateX(Math.PI / 2);
  ulnaGeo.translate(0, 0.004, side * (WING_LEN_2 * 0.5));
  const ulnaMesh = new THREE.Mesh(ulnaGeo, mats.ivoryPlumage);
  ulnaMesh.scale.set(1.45, 0.68, 1.0);
  ulnaMesh.castShadow = true;
  ulnaMesh.receiveShadow = true;
  foreGroup.add(ulnaMesh);

  // Leading-edge propatagium airfoil web & median dorsal coverts
  for (let c = 0; c < 5; c++) {
    const u = (c + 0.45) / 5;
    const cov = new THREE.Mesh(sharedGeos.covertFeather, mats.vertexFeather);
    cov.position.set(0.038, 0.015, side * (u * WING_LEN_2));
    cov.scale.set(1.08, 1.0, 0.95);
    cov.rotation.set(0, side * 0.05, 0.05);
    cov.castShadow = true;
    foreGroup.add(cov);
  }

  // 3. Hand / Carpal Manus (placed at wristPos in rig-local space)
  const handGroup = new THREE.Group();
  wingRoot.add(handGroup);

  const manusGeo = new THREE.CapsuleGeometry(0.018, 0.11, 5, 10);
  manusGeo.rotateX(Math.PI / 2);
  manusGeo.translate(0.012, 0.003, side * 0.065);
  const manusMesh = new THREE.Mesh(manusGeo, mats.ivoryPlumage);
  manusMesh.scale.set(1.3, 0.65, 1.0);
  manusMesh.castShadow = true;
  handGroup.add(manusMesh);

  // Alula thumb-feather tuft at carpal leading edge
  const alula = new THREE.Mesh(sharedGeos.alulaFeather, mats.vertexFeather);
  alula.position.set(0.032, 0.014, side * 0.02);
  alula.rotation.y = -side * 0.35;
  alula.castShadow = true;
  handGroup.add(alula);

  // 14 Individual Overlapping Sculpted Flight Feathers!
  //   Indices 0..5: 6 Secondaries along forearm (ulna)
  //   Indices 6..13: 8 Outer Primaries fanned from carpal/manus (dark slate #253646 tips!)
  const feathers = [];

  for (let i = 0; i < 14; i++) {
    const pivot = new THREE.Group();
    const isPrimary = i >= 6;

    if (!isPrimary) {
      // 6 Secondaries mounted along forearm (z = side * [0.04..0.34])
      const fFrac = i / 5; // 0..1
      const zSpan = side * THREE.MathUtils.lerp(0.045, WING_LEN_2 - 0.025, fFrac);
      pivot.position.set(0.012, 0.004 + (5 - i) * 0.0016, zSpan);

      const mesh = new THREE.Mesh(
        i >= 4 ? sharedGeos.outerSecondary : sharedGeos.innerSecondary,
        mats.vertexFeather
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      foreGroup.add(pivot);

      feathers.push({
        pivot,
        index: i,
        isPrimary: false,
        // Flight pose angles: trailing cleanly along -X with slight outward fan
        flightYaw: -side * (0.04 + fFrac * 0.16),
        flightPitch: 0.03,
        flightRoll: 0,
        // Handlebar grip pose: tucked sleekly along the forearm sleeve!
        gripYaw: -side * (1.02 - fFrac * 0.18),
        gripPitch: -0.12,
        gripRoll: side * 0.08,
      });
    } else {
      // 8 Outer Primaries (pIdx = 0..7) fanning from inner carpal to outermost leading wingtip!
      const pIdx = i - 6; // 0..7
      const pFrac = pIdx / 7; // 0..1
      const zMount = side * THREE.MathUtils.lerp(0.018, 0.125, pFrac);
      const xMount = THREE.MathUtils.lerp(0.006, 0.026, pFrac);
      // Shingle overlap: outer primaries tuck slightly beneath inner ones on dorsal side
      const yMount = 0.008 - pIdx * 0.0014;
      pivot.position.set(xMount, yMount, zMount);

      const geoIdx = Math.min(sharedGeos.primaries.length - 1, pIdx);
      const mesh = new THREE.Mesh(sharedGeos.primaries[geoIdx], mats.vertexFeather);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      handGroup.add(pivot);

      // Note on yaw around +Y:
      // Feather geometry extends along -X.
      // Rotating -X by yaw around +Y gives (-cos(yaw), 0, +sin(yaw)).
      // To point outward along side * Z (+Z for right side=+1, -Z for left side=-1),
      // we need sin(yaw) to have the SAME sign as `side` -> yaw = +side * fanAngle!
      // At fanAngle = 0: points -X (backward).
      // At fanAngle = PI/2 (1.57 rad): points straight outward along side * Z (2.5m wingspan!)!
      const fanAngleFlight = THREE.MathUtils.lerp(0.38, 1.49, Math.pow(pFrac, 0.86));
      const fanAngleGrip = THREE.MathUtils.lerp(-0.18, 0.24, pFrac);

      feathers.push({
        pivot,
        index: i,
        pIdx,
        isPrimary: true,
        flightYaw: side * fanAngleFlight,
        flightPitch: 0.02 - pFrac * 0.04,
        flightRoll: -side * pFrac * 0.06,
        // On handlebar grips: compact graceful hand-like cluster wrapping the cork grip!
        gripYaw: side * fanAngleGrip,
        gripPitch: -0.28 - pFrac * 0.08,
        gripRoll: side * 0.12,
        gripScale: THREE.MathUtils.lerp(0.62, 0.46, pFrac),
      });
    }
  }

  return {
    side,
    wingRoot,
    upperGroup,
    foreGroup,
    handGroup,
    feathers,
  };
}

/**
 * Creates the silver sardine mesh nestled inside the elastic gular pouch!
 */
function createSardineAssembly(mats) {
  const fishGroup = new THREE.Group();

  // Streamlined laterally-compressed silver sardine body
  const bodyGeo = new THREE.CapsuleGeometry(0.017, 0.095, 6, 14);
  bodyGeo.rotateZ(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.sardineSilver);
  bodyMesh.scale.set(1.0, 1.15, 0.58);
  bodyMesh.castShadow = true;
  fishGroup.add(bodyMesh);

  // Iridescent dark dorsal stripe
  const backGeo = new THREE.CapsuleGeometry(0.011, 0.088, 5, 10);
  backGeo.rotateZ(Math.PI / 2);
  const backMesh = new THREE.Mesh(backGeo, mats.sardineBack);
  backMesh.position.set(0.004, 0.009, 0);
  backMesh.scale.set(1.0, 0.55, 0.52);
  fishGroup.add(backMesh);

  // Tiny fish eyes
  const eyeGeo = new THREE.SphereGeometry(0.0032, 8, 8);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, mats.navyInk);
    eye.position.set(-0.048, 0.004, s * 0.0085);
    fishGroup.add(eye);
  }

  // Articulated forked silver tail fin (+X end so tail peeks out of beak!)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0.058, 0, 0);
  fishGroup.add(tailPivot);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.042, 0.028);
  finShape.lineTo(0.024, 0.0);
  finShape.lineTo(0.042, -0.028);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.0024,
    bevelEnabled: false,
  });
  finGeo.translate(0, 0, -0.0012);
  const tailFin = new THREE.Mesh(finGeo, mats.sardineSilver);
  tailFin.castShadow = true;
  tailPivot.add(tailFin);

  return { fishGroup, tailPivot };
}

/**
 * Dynamic parametric elastic gular throat pouch suspended seamlessly from
 * the hinged lower mandible U-rim & throat base, with real-time jiggle,
 * honk inflation, and sardine bulge deformation!
 */
function createGularPouchSystem(mats) {
  const NU = 22; // Lengthwise along bill (0 = throat base, 1 = distal chin arch)
  const NV = 14; // Crosswise (-1 = left mandible rail, 0 = deep keel, +1 = right rail)
  const vertCount = (NU + 1) * (NV + 1);
  const positions = new Float32Array(vertCount * 3);
  const indices = [];

  const stride = NV + 1;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(geo, mats.gularPouch);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Prevent frustum-culling pops during extreme pouch inflation
  mesh.frustumCulled = false;

  const billLength = 0.402;

  function updatePouchGeometry({
    jawOpenAngle = 0,
    pouchDisp = 0,
    pouchLatDisp = 0,
    honkBalloon = 0,
    fishBulge = 0,
    fishCenterU = 0.38,
    time = 0,
  }) {
    const cosJaw = Math.cos(jawOpenAngle);
    const sinJaw = Math.sin(jawOpenAngle);
    const lateralBow = honkBalloon * 0.018 + fishBulge * 0.012;

    let ptr = 0;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU; // 0..1 along mandible

      // Exact point on the hinged lower mandible rim
      const localX = u * billLength;
      const rimX = localX * cosJaw;
      const rimY = -localX * sinJaw;
      const rimHalfZ = lowerBillHalfWidth(u, lateralBow);

      // Characteristic pelican hammock depth curve: deepest in rear-mid throat (u ~ 0.28),
      // tapering gracefully toward the distal chin tip (u -> 1)
      const longitudinalHammock =
        Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.82) * (1 - 0.25 * u);
      const throatAnchorBlend = Math.pow(1 - u, 2.6);

      // Localized sardine lump inside pouch
      const fishGauss =
        fishBulge * Math.exp(-Math.pow((u - fishCenterU) / 0.17, 2));
      const wriggle = fishBulge > 0.05 ? Math.sin(time * 16 + u * 9) * 0.004 * fishBulge : 0;

      const baseDepth =
        0.078 +
        pouchDisp * 0.95 +
        honkBalloon * 0.072 +
        fishGauss * 0.048 +
        jawOpenAngle * 0.035;

      const depthAtU =
        Math.max(0.012, baseDepth) * longitudinalHammock +
        throatAnchorBlend * 0.052;

      const balloonOutZ =
        (honkBalloon * 0.034 + fishGauss * 0.022 + Math.max(0, pouchDisp) * 0.18) *
        Math.sin(u * Math.PI);

      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1; // -1 (left rim) .. 0 (keel) .. +1 (right rim)
        const absV = Math.abs(v);
        const bellyFactor = Math.pow(Math.max(0, 1 - v * v), 0.72);
        const balloonFactor = Math.sin((1 - absV) * Math.PI * 0.5);

        // Subtle longitudinal throat pleats when relaxed, smoothing out when inflated
        const pleatAmp = 0.0024 * (1 - 0.7 * THREE.MathUtils.clamp(honkBalloon + fishBulge, 0, 1));
        const pleat = Math.cos(v * Math.PI * 5) * pleatAmp * bellyFactor;

        let vx = rimX - throatAnchorBlend * bellyFactor * 0.032;
        let vy = rimY - depthAtU * bellyFactor + pleat;
        let vz =
          v * rimHalfZ +
          Math.sign(v) * balloonOutZ * balloonFactor +
          (pouchLatDisp + wriggle) * bellyFactor * Math.sin(u * Math.PI * 0.9);

        positions[ptr++] = vx;
        positions[ptr++] = vy;
        positions[ptr++] = vz;
      }
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return { mesh, updatePouchGeometry };
}

/**
 * Builds the 3 toggleable French Riviera accessories:
 *   1. cap: French yacht captain's cap (#F7F3E8 crown, #102336 band, #D9A441 brass anchor badge, glossy visor)
 *   2. goggles: Brass & leather twin-lens aviator goggles (forehead <-> eyes on isAeroSprint!)
 *   3. scarf: 8-segment chained red-and-ivory Riviera silk scarf trailing in the wind!
 */
function createAccessories(headGroup, scarfMountGroup, mats) {
  // ---- 1. French Maritime Yacht Captain's Cap ----
  const capGroup = new THREE.Group();
  capGroup.position.set(-0.006, 0.056, 0);
  capGroup.rotation.set(0.055, 0, 0.085); // Jaunty maritime tilt
  headGroup.add(capGroup);

  // Harbor-navy wool band
  const bandMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.051, 0.022, 24),
    mats.navyInk
  );
  bandMesh.position.y = 0.011;
  bandMesh.castShadow = true;
  capGroup.add(bandMesh);

  // Crisp flared white yachting crown (LatheGeometry for authentic peaked dish silhouette)
  const crownPts = [
    new THREE.Vector2(0.0, 0.048),
    new THREE.Vector2(0.048, 0.047),
    new THREE.Vector2(0.072, 0.041),
    new THREE.Vector2(0.070, 0.034),
    new THREE.Vector2(0.053, 0.021),
  ];
  const crownGeo = new THREE.LatheGeometry(crownPts, 28);
  const crownMesh = new THREE.Mesh(crownGeo, mats.ivoryCap);
  crownMesh.scale.set(1.14, 1.0, 1.02); // Slightly peaked fore-aft
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  capGroup.add(crownMesh);

  // Glossy curved patent visor (+X front)
  const visorShape = new THREE.Shape();
  visorShape.moveTo(0.028, -0.046);
  visorShape.quadraticCurveTo(0.098, -0.042, 0.102, 0.0);
  visorShape.quadraticCurveTo(0.098, 0.042, 0.028, 0.046);
  visorShape.quadraticCurveTo(0.045, 0.0, 0.028, -0.046);
  const visorGeo = new THREE.ExtrudeGeometry(visorShape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 2,
  });
  visorGeo.rotateX(Math.PI / 2);
  const visorMesh = new THREE.Mesh(visorGeo, mats.glossyVisor);
  visorMesh.position.set(0.006, 0.004, 0);
  visorMesh.rotation.z = -0.24; // Pitches downward over brow
  visorMesh.castShadow = true;
  capGroup.add(visorMesh);

  // Braided brass chin-cord & side buttons
  const cordGeo = new THREE.TorusGeometry(0.0535, 0.0032, 8, 20, Math.PI * 0.92);
  cordGeo.rotateX(Math.PI / 2);
  cordGeo.rotateY(-Math.PI * 0.46);
  const cordMesh = new THREE.Mesh(cordGeo, mats.brass);
  cordMesh.position.set(0.003, 0.006, 0);
  capGroup.add(cordMesh);

  for (const s of [-1, 1]) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 10), mats.brass);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.006, 0.008, s * 0.053);
    capGroup.add(btn);
  }

  // Sculpted Brass Anchor Badge on front of cap
  const badgeGroup = new THREE.Group();
  badgeGroup.position.set(0.058, 0.024, 0);
  badgeGroup.rotation.z = 0.12;
  capGroup.add(badgeGroup);

  const shieldPatch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.011, 0.004, 14),
    mats.navyInk
  );
  shieldPatch.rotation.z = Math.PI / 2;
  badgeGroup.add(shieldPatch);

  // Anchor shank, cross-stock, ring, and twin flukes
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.015, 8), mats.brass);
  shank.position.x = 0.003;
  badgeGroup.add(shank);

  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.010, 8), mats.brass);
  stock.rotation.x = Math.PI / 2;
  stock.position.set(0.003, 0.0035, 0);
  badgeGroup.add(stock);

  const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.0026, 0.0009, 6, 12), mats.brass);
  topRing.rotation.y = Math.PI / 2;
  topRing.position.set(0.003, 0.0085, 0);
  badgeGroup.add(topRing);

  const flukeArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.0055, 0.0013, 6, 12, Math.PI),
    mats.brass
  );
  flukeArc.rotation.y = Math.PI / 2;
  flukeArc.rotation.x = Math.PI;
  flukeArc.position.set(0.003, -0.0025, 0);
  badgeGroup.add(flukeArc);

  // ---- 2. Brass & Leather Twin-Lens Aviator Goggles ----
  const gogglesGroup = new THREE.Group();
  headGroup.add(gogglesGroup);

  // Honey-leather elastic strap wrapping head
  const strapGeo = new THREE.TorusGeometry(0.053, 0.0055, 8, 28, Math.PI * 1.45);
  strapGeo.rotateX(Math.PI / 2);
  strapGeo.rotateY(Math.PI * 0.275);
  const strapMesh = new THREE.Mesh(strapGeo, mats.leather);
  strapMesh.scale.set(1.06, 1.0, 0.98);
  strapMesh.castShadow = true;
  gogglesGroup.add(strapMesh);

  // Twin angled leather cushions + machined brass rims + cyan glass lenses
  for (const s of [-1, 1]) {
    const lensAssembly = new THREE.Group();
    // Angled cleanly around the forward cheeks/eyes of the pelican head
    lensAssembly.position.set(0.044, 0, s * 0.036);
    lensAssembly.rotation.y = -s * 0.62; // Faces forward + outward (+X and +/-Z)

    const cushion = new THREE.Mesh(
      new THREE.TorusGeometry(0.0175, 0.0048, 8, 18),
      mats.leather
    );
    cushion.rotation.y = Math.PI / 2;
    cushion.castShadow = true;
    lensAssembly.add(cushion);

    const brassRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0185, 0.0175, 0.010, 20, 1, true),
      mats.brass
    );
    brassRim.rotation.z = Math.PI / 2;
    brassRim.position.x = 0.005;
    brassRim.castShadow = true;
    lensAssembly.add(brassRim);

    const bezelRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.0022, 8, 20),
      mats.brass
    );
    bezelRing.rotation.y = Math.PI / 2;
    bezelRing.position.x = 0.010;
    lensAssembly.add(bezelRing);

    const glassLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.0176, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.36),
      mats.goggleGlass
    );
    glassLens.rotation.z = -Math.PI / 2;
    glassLens.position.x = 0.001;
    lensAssembly.add(glassLens);

    gogglesGroup.add(lensAssembly);
  }

  // Hinged brass & leather nose bridge over upper culmen
  const bridge = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0032, 6, 12, Math.PI * 0.8),
    mats.brass
  );
  bridge.rotation.y = Math.PI / 2;
  bridge.rotation.x = -Math.PI * 0.1;
  bridge.position.set(0.056, 0.006, 0);
  gogglesGroup.add(bridge);

  // ---- 3. 8-Segment Chained Red-and-Ivory Riviera Silk Scarf ----
  const scarfGroup = new THREE.Group();
  scarfMountGroup.add(scarfGroup);

  // Cozy neck collar loop (alternating red & ivory silk bands)
  const collarRed = new THREE.Mesh(
    new THREE.TorusGeometry(0.062, 0.017, 10, 24),
    mats.scarfRed
  );
  collarRed.rotation.x = Math.PI / 2 + 0.15;
  collarRed.scale.set(1.08, 1.0, 0.96);
  collarRed.castShadow = true;
  scarfGroup.add(collarRed);

  const collarStripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.064, 0.0085, 8, 24),
    mats.ivoryCap
  );
  collarStripe.rotation.x = Math.PI / 2 + 0.15;
  collarStripe.position.y = 0.007;
  scarfGroup.add(collarStripe);

  // Silk knot at back-left of neck
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), mats.scarfRed);
  knot.position.set(-0.058, -0.006, -0.022);
  knot.scale.set(1.1, 0.95, 1.2);
  knot.castShadow = true;
  scarfGroup.add(knot);

  // 8 Chained Articulated Silk Segments trailing along -X!
  const scarfLinks = [];
  const segLen = 0.072;
  let parentNode = new THREE.Group();
  parentNode.position.set(-0.066, -0.008, -0.022);
  scarfGroup.add(parentNode);

  for (let k = 0; k < 8; k++) {
    const linkPivot = k === 0 ? parentNode : new THREE.Group();
    if (k > 0) {
      linkPivot.position.set(-segLen * 0.94, 0, 0);
      parentNode.add(linkPivot);
    }

    const width = THREE.MathUtils.lerp(0.044, 0.060, k / 7);
    const segMat = k % 2 === 0 ? mats.scarfRed : mats.ivoryCap;
    const ribbonGeo = new THREE.BoxGeometry(segLen, 0.007, width, 2, 1, 2);
    ribbonGeo.translate(-segLen * 0.5, 0, 0);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, segMat);
    ribbonMesh.castShadow = true;
    ribbonMesh.receiveShadow = true;
    linkPivot.add(ribbonMesh);

    // Decorative Riviera border trim stripe along middle of each silk link
    const trimMat = k % 2 === 0 ? mats.ivoryCap : mats.scarfRed;
    const trimGeo = new THREE.BoxGeometry(segLen * 0.26, 0.0082, width * 1.01);
    trimGeo.translate(-segLen * 0.82, 0, 0);
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    linkPivot.add(trimMesh);

    // Silk fringe tassels on final link (k === 7)
    if (k === 7) {
      for (let t = -2; t <= 2; t++) {
        const tasselGeo = new THREE.CylinderGeometry(0.0022, 0.0012, 0.028, 6);
        tasselGeo.rotateZ(Math.PI / 2);
        tasselGeo.translate(-segLen - 0.013, 0, t * 0.011);
        const tassel = new THREE.Mesh(tasselGeo, t % 2 === 0 ? mats.scarfRed : mats.ivoryCap);
        linkPivot.add(tassel);
      }
    }

    scarfLinks.push(linkPivot);
    parentNode = linkPivot;
  }

  return {
    capGroup,
    gogglesGroup,
    scarfGroup,
    scarfLinks,
  };
}

/**
 * Live IK & Biomechanics Debug Overlay (showIKDebug):
 * Renders joint spheres, dynamic bone LineSegments + pole vector ticks,
 * and a bright emerald lift vector arrow above the wings!
 */
function createIKDebugOverlay() {
  const debugGroup = new THREE.Group();
  debugGroup.visible = false;

  const cyanJointMat = new THREE.MeshBasicMaterial({
    color: PALETTE.debugCyan,
    depthTest: false,
  });
  const goldJointMat = new THREE.MeshBasicMaterial({
    color: PALETTE.goldenOchre,
    depthTest: false,
  });
  const orangeJointMat = new THREE.MeshBasicMaterial({
    color: PALETTE.mandarin,
    depthTest: false,
  });

  // 23 Joint Spheres:
  //   0: pelvis
  //   1..4: L hip, L knee, L ankle, L pedal
  //   5..8: R hip, R knee, R ankle, R pedal
  //   9..12: L shoulder, L elbow, L wrist, L wingtip
  //   13..16: R shoulder, R elbow, R wrist, R wingtip
  //   17..22: neck[0..4], head/beakTip
  const jointMeshes = [];
  const jointGeo = new THREE.SphereGeometry(0.016, 10, 8);
  for (let i = 0; i < 23; i++) {
    let mat = cyanJointMat;
    if (i === 2 || i === 6 || i === 10 || i === 14) mat = goldJointMat; // knees & elbows
    if (i === 4 || i === 8 || i === 11 || i === 15) mat = orangeJointMat; // pedals & grips
    const m = new THREE.Mesh(jointGeo, mat);
    m.renderOrder = 999;
    debugGroup.add(m);
    jointMeshes.push(m);
  }

  // Dynamic Bone LineSegments (28 segments = 56 vertices)
  const maxSegments = 28;
  const linePositions = new Float32Array(maxSegments * 2 * 3);
  const lineColors = new Float32Array(maxSegments * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  const linePosAttr = new THREE.BufferAttribute(linePositions, 3);
  const lineColAttr = new THREE.BufferAttribute(lineColors, 3);
  linePosAttr.setUsage(THREE.DynamicDrawUsage);
  lineColAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("position", linePosAttr);
  lineGeo.setAttribute("color", lineColAttr);

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const boneLines = new THREE.LineSegments(lineGeo, lineMat);
  boneLines.renderOrder = 998;
  boneLines.frustumCulled = false;
  debugGroup.add(boneLines);

  // Bright Emerald Aerodynamic Lift Vector Arrow above wings!
  const liftArrowGroup = new THREE.Group();
  const emeraldMat = new THREE.MeshBasicMaterial({
    color: PALETTE.emeraldLift,
    depthTest: false,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.009, 0.009, 1.0, 10);
  shaftGeo.translate(0, 0.5, 0);
  const liftShaft = new THREE.Mesh(shaftGeo, emeraldMat);
  liftShaft.renderOrder = 999;
  liftArrowGroup.add(liftShaft);

  const headGeo = new THREE.ConeGeometry(0.028, 0.085, 12);
  headGeo.translate(0, 0.0425, 0);
  const liftCone = new THREE.Mesh(headGeo, emeraldMat);
  liftCone.renderOrder = 999;
  liftArrowGroup.add(liftCone);

  // Twin auxiliary wing-center lift arrows on left & right wings!
  const subArrows = [];
  for (const s of [-1, 1]) {
    const sub = new THREE.Group();
    const sh = new THREE.Mesh(shaftGeo, emeraldMat);
    sh.scale.set(0.7, 1, 0.7);
    sh.renderOrder = 999;
    const cn = new THREE.Mesh(headGeo, emeraldMat);
    cn.scale.set(0.75, 0.75, 0.75);
    cn.renderOrder = 999;
    sub.add(sh, cn);
    sub.userData = { shaft: sh, cone: cn, side: s };
    debugGroup.add(sub);
    subArrows.push(sub);
  }

  debugGroup.add(liftArrowGroup);

  const cCyan = new THREE.Color(PALETTE.debugCyan);
  const cGold = new THREE.Color(PALETTE.goldenOchre);
  const cOrange = new THREE.Color(PALETTE.mandarin);
  const cEmerald = new THREE.Color(PALETTE.emeraldLift);

  function setSeg(segIdx, pA, pB, color) {
    const base = segIdx * 6;
    linePositions[base] = pA.x;
    linePositions[base + 1] = pA.y;
    linePositions[base + 2] = pA.z;
    linePositions[base + 3] = pB.x;
    linePositions[base + 4] = pB.y;
    linePositions[base + 5] = pB.z;

    lineColors[base] = color.r;
    lineColors[base + 1] = color.g;
    lineColors[base + 2] = color.b;
    lineColors[base + 3] = color.r;
    lineColors[base + 4] = color.g;
    lineColors[base + 5] = color.b;
  }

  function updateDebug(pts, liftN, flightBlend) {
    // Joint spheres
    const orderedJoints = [
      pts.pelvis,
      pts.lHip, pts.lKnee, pts.lAnkle, pts.lPedal,
      pts.rHip, pts.rKnee, pts.rAnkle, pts.rPedal,
      pts.lShoulder, pts.lElbow, pts.lWrist, pts.lWingtip,
      pts.rShoulder, pts.rElbow, pts.rWrist, pts.rWingtip,
      pts.neck[0], pts.neck[1], pts.neck[2], pts.neck[3], pts.neck[4], pts.beakTip,
    ];
    for (let i = 0; i < orderedJoints.length; i++) {
      jointMeshes[i].position.copy(orderedJoints[i]);
    }

    let s = 0;
    // Pelvis & Left Leg IK chain
    setSeg(s++, pts.pelvis, pts.lHip, cCyan);
    setSeg(s++, pts.lHip, pts.lKnee, cOrange);
    setSeg(s++, pts.lKnee, pts.lAnkle, cOrange);
    setSeg(s++, pts.lAnkle, pts.lPedal, cGold);

    // Pelvis & Right Leg IK chain
    setSeg(s++, pts.pelvis, pts.rHip, cCyan);
    setSeg(s++, pts.rHip, pts.rKnee, cOrange);
    setSeg(s++, pts.rKnee, pts.rAnkle, cOrange);
    setSeg(s++, pts.rAnkle, pts.rPedal, cGold);

    // Spine & Left Wing IK/Flight chain
    setSeg(s++, pts.pelvis, pts.neck[0], cCyan);
    setSeg(s++, pts.neck[0], pts.lShoulder, cCyan);
    setSeg(s++, pts.lShoulder, pts.lElbow, cCyan);
    setSeg(s++, pts.lElbow, pts.lWrist, cCyan);
    setSeg(s++, pts.lWrist, pts.lWingtip, cEmerald);

    // Right Wing IK/Flight chain
    setSeg(s++, pts.neck[0], pts.rShoulder, cCyan);
    setSeg(s++, pts.rShoulder, pts.rElbow, cCyan);
    setSeg(s++, pts.rElbow, pts.rWrist, cCyan);
    setSeg(s++, pts.rWrist, pts.rWingtip, cEmerald);

    // 5-Segment Neck + Head + Beak chain
    setSeg(s++, pts.neck[0], pts.neck[1], cGold);
    setSeg(s++, pts.neck[1], pts.neck[2], cGold);
    setSeg(s++, pts.neck[2], pts.neck[3], cGold);
    setSeg(s++, pts.neck[3], pts.neck[4], cGold);
    setSeg(s++, pts.neck[4], pts.head, cGold);
    setSeg(s++, pts.head, pts.beakTip, cOrange);

    // Pole vector indicator ticks at knees & elbows
    setSeg(s++, pts.lKnee, pts.lKneePoleTick, cGold);
    setSeg(s++, pts.rKnee, pts.rKneePoleTick, cGold);
    setSeg(s++, pts.lElbow, pts.lElbowPoleTick, cGold);
    setSeg(s++, pts.rElbow, pts.rElbowPoleTick, cGold);

    lineGeo.setDrawRange(0, s * 2);
    linePosAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;

    // Bright Emerald Lift Vector Arrow above dorsal center + wings!
    const baseLen = 0.09 + Math.min(0.75, (liftN / 150) * 0.65 + flightBlend * 0.14);
    liftArrowGroup.position.copy(pts.neck[0]).add(_v0.set(-0.04, 0.18, 0));
    liftShaft.scale.y = baseLen;
    liftCone.position.y = baseLen;
    liftArrowGroup.visible = true;

    for (const sub of subArrows) {
      const midWing = sub.userData.side < 0 ? pts.lElbow : pts.rElbow;
      const subLen = baseLen * 0.72;
      sub.position.copy(midWing).add(_v0.set(0, 0.05, 0));
      sub.userData.shaft.scale.y = subLen;
      sub.userData.cone.position.y = subLen;
      sub.visible = flightBlend > 0.04 || liftN > 1;
    }
  }

  return { debugGroup, updateDebug };
}

// ============================================================================
// Main Character Factory: createPelicanCharacter(options = {})
// ============================================================================
export function createPelicanCharacter(options = {}) {
  const group = new THREE.Group();
  group.name = "PelicanCharacterRig";

  // Registry of shaded materials for fast wireframe toggling
  const shadedMaterials = [];
  const registerMat = (mat) => {
    shadedMaterials.push(mat);
    return mat;
  };

  const mats = {
    ivoryPlumage: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.chalkIvory,
        roughness: 0.68,
        metalness: 0.02,
      })
    ),
    creamPlumage: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.creamPearl,
        roughness: 0.72,
        metalness: 0.02,
      })
    ),
    torsoVertex: registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.66,
        metalness: 0.02,
      })
    ),
    vertexFeather: registerMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.58,
        metalness: 0.03,
      })
    ),
    slateDark: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.slateTip,
        roughness: 0.52,
        metalness: 0.06,
      })
    ),
    orangeLeg: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.mandarin,
        roughness: 0.44,
        metalness: 0.02,
      })
    ),
    webbing: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.mandarin,
        roughness: 0.40,
        sheen: 0.55,
        sheenColor: new THREE.Color(PALETTE.coralGlow),
        emissive: new THREE.Color(PALETTE.coralGlow),
        emissiveIntensity: 0.06,
      })
    ),
    upperBillVertex: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.30,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
      })
    ),
    lowerBillOchre: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.goldenOchre,
        roughness: 0.32,
        clearcoat: 0.18,
      })
    ),
    coralNail: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.mandarin,
        roughness: 0.26,
        clearcoat: 0.35,
      })
    ),
    // Signature elastic gular throat pouch material!
    gularPouch: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(PALETTE.mandarin),
        roughness: 0.36,
        metalness: 0.0,
        sheen: 0.6,
        sheenRoughness: 0.38,
        sheenColor: new THREE.Color(PALETTE.coralGlow),
        clearcoat: 0.15,
        clearcoatRoughness: 0.34,
        transmission: 0.12,
        thickness: 0.07,
        emissive: new THREE.Color(PALETTE.coralGlow),
        emissiveIntensity: 0.07,
        side: THREE.DoubleSide,
      })
    ),
    eyeGoldRing: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.goldenOchre,
        roughness: 0.48,
      })
    ),
    eyeSkyIris: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.skyCerulean,
        roughness: 0.25,
      })
    ),
    navyInk: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.harborNavy,
        roughness: 0.18,
        metalness: 0.08,
      })
    ),
    eyeGlint: registerMat(
      new THREE.MeshBasicMaterial({
        color: "#FFFFFF",
      })
    ),
    ivoryCap: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.chalkIvory,
        roughness: 0.48,
        metalness: 0.02,
      })
    ),
    glossyVisor: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.visorInk,
        roughness: 0.12,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
      })
    ),
    brass: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.brassOchre,
        metalness: 0.85,
        roughness: 0.22,
      })
    ),
    leather: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.honeyLeather,
        roughness: 0.56,
        metalness: 0.05,
      })
    ),
    goggleGlass: registerMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.skyCerulean,
        roughness: 0.08,
        metalness: 0.08,
        transmission: 0.52,
        transparent: true,
        opacity: 0.78,
        clearcoat: 1.0,
      })
    ),
    scarfRed: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.rivieraRed,
        roughness: 0.45,
        sheen: 0.4,
      })
    ),
    sardineSilver: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.sardineSilver,
        metalness: 0.82,
        roughness: 0.20,
      })
    ),
    sardineBack: registerMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.sardineBack,
        metalness: 0.65,
        roughness: 0.28,
      })
    ),
  };

  // Shared sculpted feather geometries
  const sharedGeos = {
    covertFeather: createSculptedFeatherGeometry({
      length: 0.145,
      width: 0.058,
      camber: 0.009,
      tipSplit: 1.0,
      baseHex: PALETTE.chalkIvory,
      midHex: PALETTE.creamPearl,
    }),
    alulaFeather: createSculptedFeatherGeometry({
      length: 0.12,
      width: 0.036,
      camber: 0.007,
      tipSplit: 0.45,
      baseHex: PALETTE.chalkIvory,
      tipHex: PALETTE.slateTip,
    }),
    innerSecondary: createSculptedFeatherGeometry({
      length: 0.26,
      width: 0.068,
      camber: 0.012,
      tipSplit: 1.0,
      baseHex: PALETTE.chalkIvory,
      midHex: PALETTE.creamPearl,
    }),
    outerSecondary: createSculptedFeatherGeometry({
      length: 0.295,
      width: 0.066,
      camber: 0.013,
      tipSplit: 0.62,
      baseHex: PALETTE.chalkIvory,
      midHex: PALETTE.creamPearl,
      tipHex: PALETTE.slateTip,
    }),
    tailRectrix: createSculptedFeatherGeometry({
      length: 0.21,
      width: 0.052,
      camber: 0.008,
      asymmetry: 0.04,
      tipSplit: 0.68,
      baseHex: PALETTE.chalkIvory,
      midHex: PALETTE.creamPearl,
      tipHex: PALETTE.slateTip,
    }),
    primaries: Array.from({ length: 8 }, (_, pIdx) => {
      const frac = pIdx / 7;
      // Graduated primary lengths peaking at pIdx 5..6 (~0.435m) for full 2.52m wingspan!
      const len =
        0.315 +
        Math.sin(Math.PI * Math.min(1, frac * 0.82 + 0.12)) * 0.125;
      const wid = THREE.MathUtils.lerp(0.064, 0.044, frac);
      const split = THREE.MathUtils.lerp(0.50, 0.34, frac);
      return createSculptedFeatherGeometry({
        length: len,
        width: wid,
        camber: 0.015,
        asymmetry: 0.22,
        tipSplit: split,
        baseHex: PALETTE.chalkIvory,
        midHex: PALETTE.creamPearl,
        tipHex: PALETTE.slateTip,
      });
    }),
  };

  // ==========================================================================
  // 1. Pelvis, Sculpted Plumage Torso & Fanned Tail Feathers
  // ==========================================================================
  const pelvisGroup = new THREE.Group();
  group.add(pelvisGroup);

  // Fluffy lower rump cushion sitting right on Brooks leather saddle
  const rumpCushion = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 16, 14),
    mats.creamPlumage
  );
  rumpCushion.position.set(0.01, 0.048, 0);
  rumpCushion.scale.set(1.28, 0.78, 1.08);
  rumpCushion.castShadow = true;
  rumpCushion.receiveShadow = true;
  pelvisGroup.add(rumpCushion);

  // Fanned Tail Feathers (9 overlapping rectrices with #253646 slate tips!)
  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.145, 0.072, 0);
  tailGroup.rotation.z = -0.26; // Angled gracefully upward to clear rear fender
  pelvisGroup.add(tailGroup);

  const tailFeathers = [];
  for (let t = 0; t < 9; t++) {
    const centered = t - 4; // -4..+4
    const fPivot = new THREE.Group();
    fPivot.position.set(0, Math.abs(centered) * -0.002 + 0.012, centered * 0.011);
    const fMesh = new THREE.Mesh(sharedGeos.tailRectrix, mats.vertexFeather);
    const scaleLen = 1 - Math.abs(centered) * 0.045;
    fMesh.scale.set(scaleLen, 1, 1);
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    fPivot.add(fMesh);
    tailGroup.add(fPivot);
    tailFeathers.push({ pivot: fPivot, centered });
  }

  // Upper tail covert fan
  for (let c = -2; c <= 2; c++) {
    const uCov = new THREE.Mesh(sharedGeos.covertFeather, mats.vertexFeather);
    uCov.position.set(0.01, 0.024, c * 0.018);
    uCov.rotation.y = c * 0.14;
    uCov.castShadow = true;
    tailGroup.add(uCov);
  }

  // Torso Group (pivots forward during aero sprint crouch!)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0.02, 0.035, 0);
  pelvisGroup.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(createPelicanTorsoGeometry(), mats.torsoVertex);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Layered Chest & Scapular Feather Shingles
  for (let row = 0; row < 3; row++) {
    const count = 5 - row;
    for (let k = 0; k < count; k++) {
      const zNorm = count > 1 ? (k / (count - 1)) * 2 - 1 : 0;
      const chestShingle = new THREE.Mesh(sharedGeos.covertFeather, mats.vertexFeather);
      chestShingle.position.set(
        0.165 + row * 0.032,
        0.115 + row * 0.042,
        zNorm * (0.078 - row * 0.012)
      );
      // Orient shingle downward-backward over proud breast
      chestShingle.rotation.set(zNorm * 0.25, zNorm * 0.35, -0.85);
      chestShingle.scale.set(0.88, 1, 0.92);
      chestShingle.castShadow = true;
      torsoGroup.add(chestShingle);
    }
  }

  // Left & Right dorsal scapular feather mantles over shoulder blades
  for (const s of [-1, 1]) {
    for (let r = 0; r < 4; r++) {
      const scap = new THREE.Mesh(sharedGeos.covertFeather, mats.vertexFeather);
      scap.position.set(0.11 - r * 0.048, 0.245 - r * 0.022, s * (0.088 - r * 0.006));
      scap.rotation.set(s * 0.36, -s * 0.16, 0.22);
      scap.scale.set(1.12, 1, 1.05);
      scap.castShadow = true;
      torsoGroup.add(scap);
    }
  }

  // ==========================================================================
  // 2. 5-Segment Spring-Damped S-Curve Neck, Expressive Head & 0.42m Bill
  // ==========================================================================
  const neckBaseGroup = new THREE.Group();
  neckBaseGroup.position.set(0.205, 0.255, 0);
  torsoGroup.add(neckBaseGroup);

  // Classic pelican S-curve incremental rest angles (each segment adds to parent):
  // Seg 0 & 1 curve gently BACK over shoulders (cumPitch -> +0.62 rad),
  // Seg 2 inflects upward (+0.18 rad), Seg 3 & 4 sweep gracefully FORWARD (-0.48 rad) to crown!
  const neckSegSpecs = [
    { len: 0.078, rBot: 0.064, rTop: 0.056, basePitch: +0.34 },
    { len: 0.076, rBot: 0.056, rTop: 0.050, basePitch: +0.32 },
    { len: 0.076, rBot: 0.050, rTop: 0.046, basePitch: -0.44 },
    { len: 0.074, rBot: 0.046, rTop: 0.044, basePitch: -0.46 },
    { len: 0.070, rBot: 0.044, rTop: 0.043, basePitch: -0.20 },
  ];

  const neckSegments = [];
  let neckParent = neckBaseGroup;
  for (let n = 0; n < 5; n++) {
    const spec = neckSegSpecs[n];
    const segGroup = new THREE.Group();
    if (n > 0) {
      segGroup.position.set(0, neckSegSpecs[n - 1].len, 0);
    }
    neckParent.add(segGroup);

    const cylGeo = new THREE.CylinderGeometry(spec.rTop, spec.rBot, spec.len * 1.08, 16, 1);
    cylGeo.translate(0, spec.len * 0.5, 0);
    const segMesh = new THREE.Mesh(cylGeo, mats.ivoryPlumage);
    segMesh.scale.set(1.06, 1, 0.96);
    segMesh.castShadow = true;
    segMesh.receiveShadow = true;
    segGroup.add(segMesh);

    const jointCollar = new THREE.Mesh(
      new THREE.SphereGeometry(spec.rBot * 1.01, 14, 10),
      mats.ivoryPlumage
    );
    jointCollar.scale.set(1.06, 0.85, 0.96);
    jointCollar.castShadow = true;
    segGroup.add(jointCollar);

    neckSegments.push({ group: segGroup, spec });
    neckParent = segGroup;
  }

  // Scarf mounts around lower neck segment 1!
  const scarfMountGroup = new THREE.Group();
  scarfMountGroup.position.set(0, 0.02, 0);
  neckSegments[1].group.add(scarfMountGroup);

  // Expressive Head Group at top of 5th neck segment
  const headGroup = new THREE.Group();
  headGroup.position.set(0, neckSegSpecs[4].len, 0);
  neckSegments[4].group.add(headGroup);

  // Sculpted cranial dome & cheeks
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.056, 18, 14), mats.ivoryPlumage);
  cranium.position.set(0.008, 0.018, 0);
  cranium.scale.set(1.22, 0.98, 0.95);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  headGroup.add(cranium);

  // Bare golden-peach pelican lore mask connecting eyes cleanly to bill base
  const loreMask = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), mats.eyeGoldRing);
  loreMask.position.set(0.046, 0.012, 0);
  loreMask.scale.set(1.18, 0.78, 0.88);
  headGroup.add(loreMask);

  // Snowy Occipital Crest Feathers (6 sculpted plumes sweeping off back of crown!)
  const crestGroup = new THREE.Group();
  crestGroup.position.set(-0.044, 0.036, 0);
  headGroup.add(crestGroup);
  const crestPlumes = [];
  for (let c = 0; c < 6; c++) {
    const plumeGeo = createSculptedFeatherGeometry({
      length: 0.088 - Math.abs(c - 2.5) * 0.008,
      width: 0.024,
      camber: 0.014,
      tipSplit: 1.0,
      baseHex: PALETTE.chalkIvory,
      midHex: PALETTE.creamPearl,
    });
    const plume = new THREE.Mesh(plumeGeo, mats.vertexFeather);
    const spread = (c - 2.5) * 0.14;
    plume.position.set(0, (2.5 - Math.abs(c - 2.5)) * 0.004, (c - 2.5) * 0.006);
    plume.rotation.set(0, spread, 0.22 + (c % 2) * 0.08);
    plume.castShadow = true;
    crestGroup.add(plume);
    crestPlumes.push(plume);
  }

  // Expressive Dark Eyes with Golden-Sky Rings & Blinking Eyelids
  const eyelids = [];
  for (const s of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(0.038, 0.026, s * 0.043);
    eyeSocket.rotation.y = -s * 0.42;
    headGroup.add(eyeSocket);

    // Golden-ochre outer orbital ring
    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.0135, 0.0032, 8, 18),
      mats.eyeGoldRing
    );
    goldRing.position.z = s * 0.002;
    eyeSocket.add(goldRing);

    // Riviera cerulean iris ring
    const skyIris = new THREE.Mesh(
      new THREE.TorusGeometry(0.0098, 0.0024, 8, 16),
      mats.eyeSkyIris
    );
    skyIris.position.z = s * 0.004;
    eyeSocket.add(skyIris);

    // Glossy harbor-navy eyeball/pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0096, 12, 10), mats.navyInk);
    pupil.position.z = s * 0.0025;
    eyeSocket.add(pupil);

    // Crisp white specular catchlight
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 8), mats.eyeGlint);
    glint.position.set(0.0035, 0.0042, s * 0.0112);
    eyeSocket.add(glint);

    // Articulated upper & lower blinking eyelids
    const upperLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0126, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      mats.eyeGoldRing
    );
    upperLid.position.z = s * 0.0025;
    upperLid.rotation.z = 0.95; // Retracted open at rest
    eyeSocket.add(upperLid);

    const lowerLid = new THREE.Mesh(
      new THREE.SphereGeometry(0.0124, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      mats.eyeGoldRing
    );
    lowerLid.position.z = s * 0.0025;
    lowerLid.rotation.z = -0.85;
    eyeSocket.add(lowerLid);

    eyelids.push({ upperLid, lowerLid });
  }

  // Iconic 0.42m Long Pelican Bill Assembly!
  const billRoot = new THREE.Group();
  billRoot.position.set(0.056, 0.004, 0);
  billRoot.rotation.z = -0.05; // Slight proud downward poise
  headGroup.add(billRoot);

  const upperJawGroup = new THREE.Group();
  billRoot.add(upperJawGroup);

  const upperMandibleMesh = new THREE.Mesh(
    createUpperMandibleGeometry(0.402),
    mats.upperBillVertex
  );
  upperMandibleMesh.castShadow = true;
  upperMandibleMesh.receiveShadow = true;
  upperJawGroup.add(upperMandibleMesh);

  // Nostril slits near culmen base
  for (const s of [-1, 1]) {
    const naris = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0016, 0.014, 4, 6),
      mats.slateDark
    );
    naris.rotation.z = Math.PI / 2;
    naris.position.set(0.048, 0.025, s * 0.009);
    upperJawGroup.add(naris);
  }

  // Hooked Coral Nail (#F26A2E) at distal tip (completing the 0.42m bill!)
  const nailGroup = new THREE.Group();
  nailGroup.position.set(0.398, 0.003, 0);
  upperJawGroup.add(nailGroup);

  const nailBridge = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0075, 0.016, 5, 8),
    mats.coralNail
  );
  nailBridge.rotation.z = Math.PI / 2 + 0.25;
  nailBridge.position.set(0.009, -0.002, 0);
  nailBridge.castShadow = true;
  nailGroup.add(nailBridge);

  const nailHook = new THREE.Mesh(
    new THREE.ConeGeometry(0.0072, 0.024, 10),
    mats.coralNail
  );
  nailHook.rotation.z = Math.PI - 0.32; // Curves sharply downward like a true pelican hook!
  nailHook.position.set(0.018, -0.013, 0);
  nailHook.castShadow = true;
  nailGroup.add(nailHook);

  const beakTipMarker = new THREE.Object3D();
  beakTipMarker.position.set(0.42, -0.01, 0);
  upperJawGroup.add(beakTipMarker);

  // Hinged Lower Mandible Rim + Signature Elastic Gular Throat Pouch!
  const lowerJawGroup = new THREE.Group();
  lowerJawGroup.position.set(0, -0.005, 0);
  billRoot.add(lowerJawGroup);

  const lowerRimMesh = new THREE.Mesh(
    createLowerMandibleRimGeometry(0.402),
    mats.lowerBillOchre
  );
  lowerRimMesh.castShadow = true;
  lowerJawGroup.add(lowerRimMesh);

  // Dynamic Gular Pouch stays in billRoot space so its top rim tracks lowerJawAngle
  // while its rear throat edge stays seamlessly anchored to the neck!
  const pouchSystem = createGularPouchSystem(mats);
  pouchSystem.mesh.position.set(0, -0.005, 0);
  billRoot.add(pouchSystem.mesh);

  // Wriggling Silver Sardine inside the gular pouch!
  const sardine = createSardineAssembly(mats);
  sardine.fishGroup.visible = false;
  billRoot.add(sardine.fishGroup);

  // Accessories (Captain's Cap, Aviator Goggles, 8-Segment Riviera Silk Scarf)
  const accessories = createAccessories(headGroup, scarfMountGroup, mats);

  // ==========================================================================
  // 3. Left & Right 2-Bone Orange Legs + 3-Toed Webbed Feet
  // ==========================================================================
  function createLegRig(side) {
    const legRoot = new THREE.Group();
    group.add(legRoot);

    // Thigh Group (oriented along +Y from hip -> knee, len1 = 0.38m)
    const thighGroup = new THREE.Group();
    legRoot.add(thighGroup);

    // Fluffy ivory feathered upper-thigh cuff (crural plumage)
    const thighPlumeGeo = new THREE.CylinderGeometry(0.036, 0.056, 0.14, 14);
    thighPlumeGeo.translate(0, 0.07, 0);
    const thighPlume = new THREE.Mesh(thighPlumeGeo, mats.ivoryPlumage);
    thighPlume.scale.set(1.12, 1, 1.04);
    thighPlume.castShadow = true;
    thighPlume.receiveShadow = true;
    thighGroup.add(thighPlume);

    // Orange thigh bone
    const thighGeo = new THREE.CylinderGeometry(0.021, 0.031, LEG_LEN_1, 12);
    thighGeo.translate(0, LEG_LEN_1 * 0.5, 0);
    const thighMesh = new THREE.Mesh(thighGeo, mats.orangeLeg);
    thighMesh.castShadow = true;
    thighMesh.receiveShadow = true;
    thighGroup.add(thighMesh);

    // Sculpted Knee Cap at kneePos
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), mats.orangeLeg);
    kneeCap.scale.set(1.08, 1.0, 0.95);
    kneeCap.castShadow = true;
    legRoot.add(kneeCap);

    // Shank Group (oriented along +Y from knee -> ankle, len2 = 0.37m)
    const shankGroup = new THREE.Group();
    legRoot.add(shankGroup);

    const shankGeo = new THREE.CylinderGeometry(0.015, 0.021, LEG_LEN_2, 12);
    shankGeo.translate(0, LEG_LEN_2 * 0.5, 0);
    const shankMesh = new THREE.Mesh(shankGeo, mats.orangeLeg);
    shankMesh.castShadow = true;
    shankMesh.receiveShadow = true;
    shankGroup.add(shankMesh);

    // Sculpted 3-Toed Webbed Foot
    const { footRoot, ankleLocal } = createWebbedFootAssembly(side, mats);
    legRoot.add(footRoot);

    return {
      side,
      legRoot,
      thighGroup,
      kneeCap,
      shankGroup,
      footRoot,
      ankleLocal,
      ikResult: solveTwoBoneIK(
        new THREE.Vector3(),
        new THREE.Vector3(0, -0.6, 0),
        new THREE.Vector3(1, 0.35, side * 0.18),
        LEG_LEN_1,
        LEG_LEN_2
      ),
    };
  }

  const leftLeg = createLegRig(-1);
  const rightLeg = createLegRig(+1);

  // ==========================================================================
  // 4. Dual-Mode Articulated Feathered Wings (Left -Z & Right +Z)
  // ==========================================================================
  const leftWing = createWingAssembly(-1, mats, sharedGeos);
  const rightWing = createWingAssembly(+1, mats, sharedGeos);
  group.add(leftWing.wingRoot, rightWing.wingRoot);

  const leftWingIK = solveTwoBoneIK(
    new THREE.Vector3(),
    new THREE.Vector3(0.2, -0.1, -0.2),
    new THREE.Vector3(-0.3, 0.4, -0.9),
    WING_LEN_1,
    WING_LEN_2
  );
  const rightWingIK = solveTwoBoneIK(
    new THREE.Vector3(),
    new THREE.Vector3(0.2, -0.1, +0.2),
    new THREE.Vector3(-0.3, 0.4, +0.9),
    WING_LEN_1,
    WING_LEN_2
  );

  // ==========================================================================
  // 5. Live IK & Biomechanics Debug Overlay
  // ==========================================================================
  const debugOverlay = createIKDebugOverlay();
  group.add(debugOverlay.debugGroup);

  // ==========================================================================
  // Animation, Physics & Trigger State
  // ==========================================================================
  let internalTime = 0;
  let prevSpeedMps = 6.8;
  let prevBounceY = 0;
  let currentWireframe = false;

  // Smooth blends (0..1)
  let flightBlend = 0;
  let flapPhase = 0;
  let sprintBlend = 0;
  let goggleSlide = 0;

  // 5-segment neck spring-damper state
  let neckPitchDisp = 0;
  let neckPitchVel = 0;
  let neckRollDisp = 0;
  let neckRollVel = 0;

  // Head look smoothing
  let headYawSmoothed = 0;
  let headPitchSmoothed = 0;

  // Periodic eye-blink state (every 3.0 - 5.0s)
  let nextBlinkTimer = 2.4;
  let blinkElapsed = -1;
  const blinkDuration = 0.16;

  // Elastic gular pouch spring-damper state
  let pouchDisp = 0;
  let pouchVel = 0;
  let pouchLatDisp = 0;
  let pouchLatVel = 0;

  // Triggered action timers
  let honkTimer = 0;
  const honkDuration = 0.92;
  let gulpTimer = 0;
  const gulpDuration = 1.15;

  // Persistent accessory visibility state
  const accessoryFlags = {
    cap: options.accessories?.cap ?? true,
    goggles: options.accessories?.goggles ?? true,
    scarf: options.accessories?.scarf ?? true,
  };

  // Live telemetry exposed for HUD / Rig Inspector
  const telemetry = {
    leftFootErrorMm: 0,
    rightFootErrorMm: 0,
    footErrorMm: 0,
    wingLiftN: 0,
    flightBlend: 0,
    wingspanM: 0.62,
    honkLevel: 0,
    gulpProgress: 0,
  };

  // Reusable rig-local work vectors (zero per-frame allocations)
  const saddlePos = new THREE.Vector3(-0.28, 0.76, 0);
  const leftPedalPos = new THREE.Vector3(-0.08, 0.125, -0.115);
  const rightPedalPos = new THREE.Vector3(-0.08, 0.455, +0.115);
  const leftGripPos = new THREE.Vector3(0.22, 0.90, -0.24);
  const rightGripPos = new THREE.Vector3(0.22, 0.90, +0.24);

  const lHipRig = new THREE.Vector3();
  const rHipRig = new THREE.Vector3();
  const lAnkleTarget = new THREE.Vector3();
  const rAnkleTarget = new THREE.Vector3();
  const lAchievedFoot = new THREE.Vector3();
  const rAchievedFoot = new THREE.Vector3();
  const lLegPole = new THREE.Vector3(1.0, 0.35, -0.18);
  const rLegPole = new THREE.Vector3(1.0, 0.35, +0.18);
  const lWingPole = new THREE.Vector3(-0.3, 0.4, -0.9);
  const rWingPole = new THREE.Vector3(-0.3, 0.4, +0.9);

  const lShoulderRig = new THREE.Vector3();
  const rShoulderRig = new THREE.Vector3();
  const torsoRigMat = new THREE.Matrix4();
  const neckAccumMat = new THREE.Matrix4();
  const qTorsoRig = new THREE.Quaternion();
  const qUpperGrip = new THREE.Quaternion();
  const qForeGrip = new THREE.Quaternion();
  const qHandGrip = new THREE.Quaternion();
  const qUpperFlight = new THREE.Quaternion();
  const qForeFlight = new THREE.Quaternion();
  const qHandFlight = new THREE.Quaternion();
  const qUpperFinal = new THREE.Quaternion();
  const qForeFinal = new THREE.Quaternion();
  const qHandFinal = new THREE.Quaternion();

  const debugPts = {
    pelvis: new THREE.Vector3(),
    lHip: new THREE.Vector3(),
    lKnee: new THREE.Vector3(),
    lAnkle: new THREE.Vector3(),
    lPedal: new THREE.Vector3(),
    rHip: new THREE.Vector3(),
    rKnee: new THREE.Vector3(),
    rAnkle: new THREE.Vector3(),
    rPedal: new THREE.Vector3(),
    lShoulder: new THREE.Vector3(),
    lElbow: new THREE.Vector3(),
    lWrist: new THREE.Vector3(),
    lWingtip: new THREE.Vector3(),
    rShoulder: new THREE.Vector3(),
    rElbow: new THREE.Vector3(),
    rWrist: new THREE.Vector3(),
    rWingtip: new THREE.Vector3(),
    neck: Array.from({ length: 5 }, () => new THREE.Vector3()),
    head: new THREE.Vector3(),
    beakTip: new THREE.Vector3(),
    lKneePoleTick: new THREE.Vector3(),
    rKneePoleTick: new THREE.Vector3(),
    lElbowPoleTick: new THREE.Vector3(),
    rElbowPoleTick: new THREE.Vector3(),
  };

  // ==========================================================================
  // Interactive Action Triggers
  // ==========================================================================
  function triggerHonk() {
    honkTimer = honkDuration;
    // Energetic upward pouch slap + resonant neck rebound
    pouchVel += 0.42;
    neckPitchVel += 1.65;
  }

  function triggerFishGulp() {
    gulpTimer = gulpDuration;
    // Heavy downward catch impact into elastic gular pouch + lateral wiggle
    pouchVel += 0.68;
    pouchLatVel += (Math.random() > 0.5 ? 1 : -1) * 0.32;
    neckPitchVel += 2.35; // Joyful skyward head toss!
  }

  // ==========================================================================
  // Helper: Solve & Blend Dual-Mode Wing (Grip IK <-> 2.5m Open Flight)
  // ==========================================================================
  function updateSingleWing(
    wing,
    shoulderRigPos,
    gripTargetPos,
    wingPoleVec,
    ikSolverOut,
    blend,
    flapTime,
    flapAmp,
    steerAngle
  ) {
    const side = wing.side; // -1 Left (-Z), +1 Right (+Z)
    wing.wingRoot.position.copy(shoulderRigPos);

    // ---- Mode A: Handlebar Grip 2-Bone IK Pose (blend = 0) ----
    // Offset grip target +0.016m up so carpal pad rests gracefully ON TOP of cork grip
    _v3.copy(gripTargetPos);
    _v3.y += 0.016;
    solveTwoBoneIK(shoulderRigPos, _v3, wingPoleVec, WING_LEN_1, WING_LEN_2, ikSolverOut);

    // Compute twist-free right-handed basis quaternions for Grip IK segments
    computeWingSegmentQuaternion(
      shoulderRigPos,
      ikSolverOut.midPos,
      side,
      _v0.set(0.45, 0.88, side * 0.15),
      qUpperGrip
    );
    computeWingSegmentQuaternion(
      ikSolverOut.midPos,
      ikSolverOut.endPos,
      side,
      _v0.set(0.35, 0.90, -side * 0.25),
      qForeGrip
    );
    // Hand wraps neatly forward along handlebar grip axis
    _euler.set(side * 0.12, -side * 1.18 + steerAngle * 0.85, -0.18, "YXZ");
    qHandGrip.setFromEuler(_euler);

    // ---- Mode B: Full ~2.5m Flight Wingspan & Aerodynamic Flapping (blend = 1) ----
    // Rhythmic shoulder.rotation.x flapping + forearm & wrist lag + AoA pitch twist!
    const shoulderFlap = Math.sin(flapTime) * flapAmp + 0.08;
    const elbowLag = Math.sin(flapTime - 0.52);
    const wristLag = Math.sin(flapTime - 0.98);
    const aoaTwist = Math.cos(flapTime) * 0.24; // Supination/pronation angle-of-attack

    // Upper wing (shoulder.rotation.x drives symmetric vertical downstroke/upstroke!)
    _euler.set(
      -side * shoulderFlap, // -side * (+up) lifts both -Z and +Z wings skyward together!
      -side * 0.05,
      -0.06 + aoaTwist * 0.45,
      "XYZ"
    );
    qUpperFlight.copy(qTorsoRig).multiply(_quatA.setFromEuler(_euler));

    // Forearm flexes slightly on upstroke and extends wide on power downstroke
    const elbowFlexUp = Math.max(0, elbowLag) * 0.22;
    _euler.set(
      -side * (shoulderFlap + elbowLag * 0.22),
      side * elbowFlexUp * 0.45,
      -0.05 + aoaTwist * 0.78,
      "XYZ"
    );
    qForeFlight.copy(qTorsoRig).multiply(_quatA.setFromEuler(_euler));

    // Carpal/hand wrist lag + distal AoA twist
    _euler.set(
      -side * (shoulderFlap + wristLag * 0.34),
      side * Math.max(0, wristLag) * 0.18,
      -0.04 + aoaTwist * 1.05,
      "XYZ"
    );
    qHandFlight.copy(qTorsoRig).multiply(_quatA.setFromEuler(_euler));

    // ---- Smooth Quaternion Slerp (preserves exact bone lengths for ALL 0..1!) ----
    qUpperFinal.copy(qUpperGrip).slerp(qUpperFlight, blend);
    qForeFinal.copy(qForeGrip).slerp(qForeFlight, blend);
    qHandFinal.copy(qHandGrip).slerp(qHandFlight, blend);

    // Place upperGroup (at shoulder), foreGroup (at elbow), handGroup (at wrist) relative to wingRoot
    wing.upperGroup.position.set(0, 0, 0);
    wing.upperGroup.quaternion.copy(qUpperFinal);

    // Elbow offset from shoulder = rotate( (0, 0, side * WING_LEN_1), qUpperFinal )
    _v1.set(0, 0, side * WING_LEN_1).applyQuaternion(qUpperFinal);
    wing.foreGroup.position.copy(_v1);
    wing.foreGroup.quaternion.copy(qForeFinal);

    // Wrist offset from shoulder = elbowOffset + rotate( (0, 0, side * WING_LEN_2), qForeFinal )
    _v2.set(0, 0, side * WING_LEN_2).applyQuaternion(qForeFinal).add(_v1);
    wing.handGroup.position.copy(_v2);
    wing.handGroup.quaternion.copy(qHandFinal);

    // Animate all 14 individual sculpted flight feathers (curl/tuck <-> 2.52m spread + AoA twist!)
    for (let i = 0; i < wing.feathers.length; i++) {
      const f = wing.feathers[i];
      const waveLag = Math.cos(flapTime - i * 0.11) * blend * (f.isPrimary ? 0.20 : 0.10);
      const yaw = THREE.MathUtils.lerp(f.gripYaw, f.flightYaw, blend);
      const pitch = THREE.MathUtils.lerp(f.gripPitch, f.flightPitch, blend) + waveLag;
      const roll = THREE.MathUtils.lerp(f.gripRoll, f.flightRoll, blend);
      f.pivot.rotation.set(roll, yaw, pitch, "YXZ");

      if (f.isPrimary) {
        const sLen = THREE.MathUtils.lerp(f.gripScale, 1.0, blend);
        f.pivot.scale.set(sLen, 1, THREE.MathUtils.lerp(0.78, 1.0, blend));
      }
    }

    // Record exact rig-local debug joint positions for this wing
    const elbowDebug = side < 0 ? debugPts.lElbow : debugPts.rElbow;
    const wristDebug = side < 0 ? debugPts.lWrist : debugPts.rWrist;
    const tipDebug = side < 0 ? debugPts.lWingtip : debugPts.rWingtip;
    const poleTick = side < 0 ? debugPts.lElbowPoleTick : debugPts.rElbowPoleTick;

    elbowDebug.copy(shoulderRigPos).add(_v1);
    wristDebug.copy(shoulderRigPos).add(_v2);

    const tipSpan = THREE.MathUtils.lerp(0.08, 0.43, blend);
    const tipBack = THREE.MathUtils.lerp(-0.14, -0.06, blend);
    tipDebug
      .set(tipBack, 0, side * tipSpan)
      .applyQuaternion(qHandFinal)
      .add(wristDebug);

    poleTick.copy(elbowDebug).addScaledVector(ikSolverOut.bendDir, 0.085 * (1 - blend * 0.5));
  }

  // ==========================================================================
  // Per-Frame Update
  // ==========================================================================
  function update(state = {}) {
    const safeDt = THREE.MathUtils.clamp(
      typeof state.dt === "number" && Number.isFinite(state.dt) ? state.dt : 1 / 60,
      1e-4,
      0.05
    );
    if (typeof state.time === "number" && Number.isFinite(state.time)) {
      internalTime = state.time;
    } else {
      internalTime += safeDt;
    }

    const crankPhase = Number(state.crankPhase) || 0;
    const steerAngle = Number(state.steerAngle) || 0;
    const leanAngle = Number(state.leanAngle) || 0;
    const speedMps = Number.isFinite(state.speedMps) ? state.speedMps : 6.8;
    const isAirborne = Boolean(state.isAirborne);
    const flapBurstVal =
      typeof state.flapBurst === "boolean"
        ? state.flapBurst
          ? 1
          : 0
        : Math.max(0, Number(state.flapBurst) || 0);
    const isAeroSprint = Boolean(state.isAeroSprint);
    const fishCount = Math.max(0, Number(state.fishInPouch) || 0);

    // Wireframe toggle across all shaded materials
    const wantWireframe = Boolean(state.wireframe);
    if (wantWireframe !== currentWireframe) {
      currentWireframe = wantWireframe;
      for (let i = 0; i < shadedMaterials.length; i++) {
        shadedMaterials[i].wireframe = currentWireframe;
      }
    }

    // Accessory toggles
    if (state.accessories && typeof state.accessories === "object") {
      if (state.accessories.cap !== undefined) accessoryFlags.cap = Boolean(state.accessories.cap);
      if (state.accessories.goggles !== undefined) {
        accessoryFlags.goggles = Boolean(state.accessories.goggles);
      }
      if (state.accessories.scarf !== undefined) {
        accessoryFlags.scarf = Boolean(state.accessories.scarf);
      }
    }
    accessories.capGroup.visible = accessoryFlags.cap;
    accessories.gogglesGroup.visible = accessoryFlags.goggles;
    accessories.scarfGroup.visible = accessoryFlags.scarf;

    // Resolve rig-local anchors (with exact contract fallbacks if omitted)
    const anc = state.anchors;
    if (anc?.saddle) {
      saddlePos.copy(anc.saddle);
    } else {
      saddlePos.set(-0.28, 0.76, 0);
    }
    if (anc?.rightPedal) {
      rightPedalPos.copy(anc.rightPedal);
    } else {
      rightPedalPos.set(
        -0.08 + 0.165 * Math.sin(crankPhase),
        0.29 + 0.165 * Math.cos(crankPhase),
        0.115
      );
    }
    if (anc?.leftPedal) {
      leftPedalPos.copy(anc.leftPedal);
    } else {
      leftPedalPos.set(
        -0.08 + 0.165 * Math.sin(crankPhase + Math.PI),
        0.29 + 0.165 * Math.cos(crankPhase + Math.PI),
        -0.115
      );
    }
    if (anc?.leftGrip) {
      leftGripPos.copy(anc.leftGrip);
    } else {
      leftGripPos.set(0.22, 0.90, -0.24);
    }
    if (anc?.rightGrip) {
      rightGripPos.copy(anc.rightGrip);
    } else {
      rightGripPos.set(0.22, 0.90, +0.24);
    }

    // ---- Smooth Mode Blends (Flight, Aero Sprint, Goggles Slide) ----
    const targetFlight = isAirborne || flapBurstVal > 0 ? 1 : 0;
    const flightRate = targetFlight > flightBlend ? 6.8 : 4.2;
    flightBlend = THREE.MathUtils.damp(flightBlend, targetFlight, flightRate, safeDt);
    const smoothFlight = THREE.MathUtils.smoothstep(flightBlend, 0, 1);

    const targetSprint = isAeroSprint ? 1 : 0;
    sprintBlend = THREE.MathUtils.damp(sprintBlend, targetSprint, 6.5, safeDt);
    goggleSlide = THREE.MathUtils.damp(goggleSlide, targetSprint, 8.2, safeDt);

    // ---- 1. Pelvis Cadence Bounce, Hip Rock & Aero Torso Crouch ----
    const pedalActivity = THREE.MathUtils.clamp(speedMps / 4.5, 0, 1.35) * (1 - smoothFlight * 0.65);
    const bounceY = Math.sin(crankPhase * 2) * 0.014 * pedalActivity;
    const hipRockRoll = Math.sin(crankPhase) * 0.065 * pedalActivity;
    const hipYaw = -Math.cos(crankPhase) * 0.025 * pedalActivity - steerAngle * 0.08;

    pelvisGroup.position.set(
      saddlePos.x + 0.012 + sprintBlend * 0.025,
      saddlePos.y + 0.008 + bounceY,
      saddlePos.z
    );
    pelvisGroup.rotation.set(
      hipRockRoll + leanAngle * 0.18,
      hipYaw,
      -0.04 * sprintBlend,
      "XYZ"
    );
    pelvisGroup.updateMatrix();

    // Forward torso crouch when isAeroSprint is true (rz < 0 leans +Y forward toward +X!)
    const breathing = Math.sin(internalTime * (2.6 + sprintBlend * 2.2)) * 0.014;
    const torsoPitchZ = -0.18 - sprintBlend * 0.34 + smoothFlight * 0.08 + breathing;
    torsoGroup.rotation.set(
      leanAngle * 0.14 + steerAngle * 0.10,
      -steerAngle * 0.16,
      torsoPitchZ,
      "XYZ"
    );
    torsoGroup.updateMatrix();

    // Torso world-in-rig matrix & orientation
    torsoRigMat.multiplyMatrices(pelvisGroup.matrix, torsoGroup.matrix);
    qTorsoRig.setFromRotationMatrix(torsoRigMat);

    // Tail feather rudder & fan animation
    const tailSpread = 0.12 + smoothFlight * 0.09 + sprintBlend * 0.04;
    tailGroup.rotation.y = steerAngle * 0.42 + Math.sin(crankPhase) * 0.04;
    tailGroup.rotation.z = -0.26 + Math.sin(crankPhase * 2 + 0.6) * 0.035 + sprintBlend * 0.12;
    for (let t = 0; t < tailFeathers.length; t++) {
      const tf = tailFeathers[t];
      tf.pivot.rotation.y = tf.centered * tailSpread;
    }

    // ---- 2. Exact Analytical 2-Bone Leg IK + Natural Cycling Ankle Pitch ----
    // Hip sockets in pelvis local space -> saddle + (+0.04, +0.03, ∓0.095) at rest!
    lHipRig.set(0.028, 0.022, -0.095).applyMatrix4(pelvisGroup.matrix);
    rHipRig.set(0.028, 0.022, +0.095).applyMatrix4(pelvisGroup.matrix);

    const legs = [
      { leg: leftLeg, hip: lHipRig, pedal: leftPedalPos, ankleTarget: lAnkleTarget, achieved: lAchievedFoot, pole: lLegPole },
      { leg: rightLeg, hip: rHipRig, pedal: rightPedalPos, ankleTarget: rAnkleTarget, achieved: rAchievedFoot, pole: rLegPole },
    ];

    for (let i = 0; i < 2; i++) {
      const { leg, hip, pedal, ankleTarget, achieved, pole } = legs[i];

      // Compute pedal stroke angle relative to bottom bracket (-0.08, 0.29)
      const dxCrank = pedal.x - -0.08;
      const dyCrank = pedal.y - 0.29;
      const strokeAngle = Math.atan2(dxCrank, dyCrank); // 0=top, PI/2=front, PI=bottom

      // ~12° (-0.21 rad) toe-down at bottom of stroke, ~6° (+0.10 rad) heel-drop at top!
      const anklePitchZ =
        0.155 * Math.cos(strokeAngle) - 0.055 * Math.sin(strokeAngle) - 0.055;

      // Orient foot cleanly on the horizontal pedal platform
      _euler.set(0, -leg.side * 0.055, anklePitchZ, "YXZ");
      leg.footRoot.quaternion.setFromEuler(_euler);

      // Desired ankle joint position when ball-of-foot sole rests on pedal (+8mm platform top)
      _v0.copy(leg.ankleLocal).applyQuaternion(leg.footRoot.quaternion);
      ankleTarget.set(pedal.x, pedal.y + 0.008, pedal.z).add(_v0);

      // Solve exact 3D 2-Bone IK: hip -> knee -> ankleTarget
      solveTwoBoneIK(hip, ankleTarget, pole, LEG_LEN_1, LEG_LEN_2, leg.ikResult);

      // Orient thigh (len1=0.38m), kneeCap, shank (len2=0.37m), and place webbed foot
      orientBoneAlongY(leg.thighGroup, hip, leg.ikResult.midPos, leg.ikResult.bendDir);
      leg.kneeCap.position.copy(leg.ikResult.midPos);
      orientBoneAlongY(leg.shankGroup, leg.ikResult.midPos, leg.ikResult.endPos, leg.ikResult.bendDir);

      // Place footRoot at achieved endPos - rotatedAnkleLocal so ankle joint NEVER detaches!
      achieved.copy(leg.ikResult.endPos).sub(_v0);
      leg.footRoot.position.copy(achieved);
    }

    // Compute exact foot-to-pedal tracking error in millimeters (0.0 mm during normal riding!)
    telemetry.leftFootErrorMm =
      Math.hypot(
        lAchievedFoot.x - leftPedalPos.x,
        lAchievedFoot.y - (leftPedalPos.y + 0.008),
        lAchievedFoot.z - leftPedalPos.z
      ) * 1000;
    telemetry.rightFootErrorMm =
      Math.hypot(
        rAchievedFoot.x - rightPedalPos.x,
        rAchievedFoot.y - (rightPedalPos.y + 0.008),
        rAchievedFoot.z - rightPedalPos.z
      ) * 1000;
    telemetry.footErrorMm = Math.max(telemetry.leftFootErrorMm, telemetry.rightFootErrorMm);

    // ---- 3. Dual-Mode Articulated Feathered Wings (Grip IK <-> 2.5m Flight!) ----
    lShoulderRig.set(0.165, 0.215, -0.135).applyMatrix4(torsoRigMat);
    rShoulderRig.set(0.165, 0.215, +0.135).applyMatrix4(torsoRigMat);

    const flapFreqHz = flapBurstVal > 0 ? 4.2 : 2.75;
    flapPhase += safeDt * Math.PI * 2 * flapFreqHz * (0.25 + 0.75 * smoothFlight);
    const flapAmp = 0.56 + Math.min(1, flapBurstVal) * 0.14;

    updateSingleWing(
      leftWing,
      lShoulderRig,
      leftGripPos,
      lWingPole,
      leftWingIK,
      smoothFlight,
      flapPhase,
      flapAmp,
      steerAngle
    );
    updateSingleWing(
      rightWing,
      rShoulderRig,
      rightGripPos,
      rWingPole,
      rightWingIK,
      smoothFlight,
      flapPhase,
      flapAmp,
      steerAngle
    );

    // Compute instantaneous aerodynamic wing lift in Newtons (~108 N pelican weight)
    const downstrokePower = Math.max(0, -Math.cos(flapPhase));
    telemetry.flightBlend = smoothFlight;
    telemetry.wingspanM = debugPts.rWingtip.distanceTo(debugPts.lWingtip);
    telemetry.wingLiftN =
      smoothFlight > 0.005
        ? Math.round(
            smoothFlight * (34 + Math.max(0, speedMps) * 5.8 + downstrokePower * 76)
          )
        : 0;

    // ---- 4. 5-Segment Spring-Damped S-Curve Neck, Head, Blink, Bill & Pouch ----
    const accelLong = THREE.MathUtils.clamp((speedMps - prevSpeedMps) / safeDt, -22, 22);
    const bounceVel = THREE.MathUtils.clamp((bounceY - prevBounceY) / safeDt, -2.5, 2.5);
    prevSpeedMps = speedMps;
    prevBounceY = bounceY;

    // Neck spring-damper integration (semi-implicit Euler)
    const neckPitchForce =
      accelLong * 0.16 - bounceVel * 0.9 - neckPitchDisp * 46 - neckPitchVel * 8.2;
    neckPitchVel += neckPitchForce * safeDt;
    neckPitchDisp = THREE.MathUtils.clamp(neckPitchDisp + neckPitchVel * safeDt, -0.35, 0.42);

    const neckRollForce =
      (-steerAngle * speedMps * 0.18 - leanAngle * 4.5) - neckRollDisp * 40 - neckRollVel * 7.8;
    neckRollVel += neckRollForce * safeDt;
    neckRollDisp = THREE.MathUtils.clamp(neckRollDisp + neckRollVel * safeDt, -0.30, 0.30);

    // Advance honk & fish-gulp animation envelopes
    let honkEnv = 0;
    let billClap = 0;
    if (honkTimer > 0) {
      honkTimer = Math.max(0, honkTimer - safeDt);
      const p = 1 - honkTimer / honkDuration; // 0 -> 1
      if (p < 0.72) {
        honkEnv = Math.sin((p / 0.72) * Math.PI);
      } else {
        // Playful double mandible clap at end of honk!
        billClap = Math.abs(Math.sin(((p - 0.72) / 0.28) * Math.PI * 2)) * 0.28;
      }
    }
    const totalHonk = Math.max(THREE.MathUtils.clamp(Number(state.honkAmount) || 0, 0, 1.4), honkEnv);
    telemetry.honkLevel = totalHonk;

    let gulpProgress = 0;
    let gulpJawOpen = 0;
    let gulpHeadToss = 0;
    let gulpSwallowU = 0.40;
    if (gulpTimer > 0) {
      gulpTimer = Math.max(0, gulpTimer - safeDt);
      gulpProgress = 1 - gulpTimer / gulpDuration; // 0 -> 1
      if (gulpProgress < 0.30) {
        // Wide catch gape!
        gulpJawOpen = Math.sin((gulpProgress / 0.30) * Math.PI * 0.5) * 0.62;
        gulpSwallowU = THREE.MathUtils.lerp(0.68, 0.44, gulpProgress / 0.30);
      } else if (gulpProgress < 0.72) {
        // Joyful head toss skyward + gulping swallow down throat!
        const sub = (gulpProgress - 0.30) / 0.42;
        gulpJawOpen = (1 - sub) * 0.35 + Math.abs(Math.sin(sub * Math.PI * 2)) * 0.16;
        gulpHeadToss = Math.sin(sub * Math.PI) * 0.42;
        gulpSwallowU = THREE.MathUtils.lerp(0.44, 0.12, sub);
      } else {
        const sub = (gulpProgress - 0.72) / 0.28;
        gulpSwallowU = 0.12;
        gulpHeadToss = -Math.sin(sub * Math.PI) * 0.08;
      }
    }
    telemetry.gulpProgress = gulpProgress;

    // Counteract torso pitch at neck base so S-curve stays proudly poised above handlebars,
    // tucking sleekly forward during aero sprint!
    neckBaseGroup.rotation.z = -torsoPitchZ * 0.78 - sprintBlend * 0.22;

    let parentCumPitchZ = pelvisGroup.rotation.z + torsoPitchZ + neckBaseGroup.rotation.z;
    let parentCumYawY = pelvisGroup.rotation.y + torsoGroup.rotation.y;

    for (let n = 0; n < 5; n++) {
      const w = (n + 1) / 5;
      const seg = neckSegments[n];
      // Flatten S-curve forward slightly when aero-sprinting
      const sCurvePitch = seg.spec.basePitch * (1 - sprintBlend * 0.36);
      const dynamicPitch =
        neckPitchDisp * (0.28 * w) +
        Math.sin(crankPhase * 2 - n * 0.35) * 0.016 * pedalActivity +
        gulpHeadToss * (0.12 * w);

      const segYaw = -steerAngle * 0.06;
      const segPitch = sCurvePitch + dynamicPitch;
      seg.group.rotation.set(neckRollDisp * 0.22, segYaw, segPitch, "XYZ");
      parentCumPitchZ += segPitch;
      parentCumYawY += segYaw;
    }

    // Compute neck debug joints & head rig-local position cleanly via preallocated neckAccumMat
    neckAccumMat.copy(torsoRigMat);
    neckBaseGroup.updateMatrix();
    neckAccumMat.multiply(neckBaseGroup.matrix);
    for (let n = 0; n < 5; n++) {
      neckSegments[n].group.updateMatrix();
      neckAccumMat.multiply(neckSegments[n].group.matrix);
      debugPts.neck[n].set(0, 0, 0).applyMatrix4(neckAccumMat);
    }

    // Avian horizon-stabilized gaze + optional lookTargetLocal head tracking!
    let desiredRigHeadYaw = -steerAngle * 0.48;
    let desiredRigHeadPitch =
      -0.04 - sprintBlend * 0.08 + gulpHeadToss * 0.55 + totalHonk * 0.22;

    if (state.lookTargetLocal) {
      _v0.set(0, neckSegSpecs[4].len, 0).applyMatrix4(neckAccumMat);
      _v1.set(
        state.lookTargetLocal.x - _v0.x,
        state.lookTargetLocal.y - _v0.y,
        state.lookTargetLocal.z - _v0.z
      );
      const horizDist = Math.hypot(_v1.x, _v1.z);
      if (horizDist > 0.05) {
        // In Three.js +Y rotation: +yaw turns +X toward -Z
        const worldYaw = Math.atan2(-_v1.z, _v1.x);
        const worldPitch = Math.atan2(_v1.y, horizDist);
        desiredRigHeadYaw = THREE.MathUtils.clamp(worldYaw, -0.90, 0.90);
        desiredRigHeadPitch = THREE.MathUtils.clamp(worldPitch, -0.42, 0.52);
      }
    }

    const targetLocalHeadYaw = THREE.MathUtils.clamp(
      desiredRigHeadYaw - parentCumYawY,
      -0.95,
      0.95
    );
    const targetLocalHeadPitch = THREE.MathUtils.clamp(
      desiredRigHeadPitch - parentCumPitchZ,
      -0.85,
      0.95
    );

    headYawSmoothed = THREE.MathUtils.damp(headYawSmoothed, targetLocalHeadYaw, 7.5, safeDt);
    headPitchSmoothed = THREE.MathUtils.damp(headPitchSmoothed, targetLocalHeadPitch, 8.5, safeDt);

    headGroup.rotation.set(
      -leanAngle * 0.25,
      headYawSmoothed,
      headPitchSmoothed,
      "YXZ"
    );
    headGroup.updateMatrix();

    // Snowy occipital crest flutter (tucks slightly when captain's cap is worn)
    const capTuck = accessoryFlags.cap ? -0.18 : 0.08;
    for (let c = 0; c < crestPlumes.length; c++) {
      crestPlumes[c].rotation.z =
        0.22 +
        capTuck +
        Math.sin(internalTime * (6 + speedMps * 0.7) + c * 0.9) *
          0.06 *
          THREE.MathUtils.clamp(speedMps / 8, 0.2, 1.4);
    }

    // Periodic Natural Eye Blinking (every 3.0–5.0s) + happy squint during honk/gulp!
    nextBlinkTimer -= safeDt;
    if (nextBlinkTimer <= 0 && blinkElapsed < 0) {
      blinkElapsed = 0;
      nextBlinkTimer = 3.0 + Math.random() * 2.0;
    }
    let blinkAmount = 0;
    if (blinkElapsed >= 0) {
      blinkElapsed += safeDt;
      if (blinkElapsed >= blinkDuration) {
        blinkElapsed = -1;
      } else {
        blinkAmount = Math.sin((blinkElapsed / blinkDuration) * Math.PI);
      }
    }
    const squint = Math.max(blinkAmount, totalHonk * 0.38, gulpHeadToss * 0.75);
    for (let e = 0; e < eyelids.length; e++) {
      eyelids[e].upperLid.rotation.z = THREE.MathUtils.lerp(0.95, 0.02, squint);
      eyelids[e].lowerLid.rotation.z = THREE.MathUtils.lerp(-0.88, -0.04, squint * 0.85);
    }

    // ---- Aviator Goggles Forehead <-> Eyes Slide Animation ----
    // goggleSlide = 0: stylishly perched on forehead below cap visor
    // goggleSlide = 1: slid smoothly down over eyes during isAeroSprint!
    accessories.gogglesGroup.position.set(
      THREE.MathUtils.lerp(-0.006, 0.005, goggleSlide),
      THREE.MathUtils.lerp(0.046, 0.024, goggleSlide),
      0
    );
    accessories.gogglesGroup.rotation.z = THREE.MathUtils.lerp(0.36, -0.03, goggleSlide);

    // ---- Articulated Mandibles, Elastic Gular Pouch Jiggle & Silver Sardine ----
    const sprintPant = sprintBlend * (0.04 + Math.max(0, Math.sin(internalTime * 7.5)) * 0.035);
    const jawOpenAngle = THREE.MathUtils.clamp(
      totalHonk * 0.52 + billClap + gulpJawOpen + sprintPant,
      0,
      0.72
    );

    // Upper mandible lifts subtly on big honks/gulps; lower mandible hinges downward (rz < 0)
    upperJawGroup.rotation.z = totalHonk * 0.11 + gulpJawOpen * 0.14 + billClap * 0.25;
    lowerJawGroup.rotation.z = -jawOpenAngle;

    // Elastic Gular Pouch spring-damper jiggle physics (pouchDisp, pouchVel)!
    const pouchDrive =
      -bounceVel * 0.065 +
      Math.abs(accelLong) * 0.002 +
      (isAirborne ? -0.015 : 0);
    const pouchForce = pouchDrive * 18 - pouchDisp * 68 - pouchVel * 5.8;
    pouchVel += pouchForce * safeDt;
    pouchDisp = THREE.MathUtils.clamp(pouchDisp + pouchVel * safeDt, -0.045, 0.085);

    const pouchLatForce =
      (-steerAngle * speedMps * 0.04) - pouchLatDisp * 54 - pouchLatVel * 5.4;
    pouchLatVel += pouchLatForce * safeDt;
    pouchLatDisp = THREE.MathUtils.clamp(pouchLatDisp + pouchLatVel * safeDt, -0.04, 0.04);

    const hasFish = fishCount > 0 || gulpTimer > 0;
    const fishBulgeAmount =
      gulpTimer > 0
        ? 0.95 * (1 - Math.max(0, gulpProgress - 0.72) / 0.28)
        : Math.min(1.0, fishCount * 0.42);
    const fishCenterU = gulpTimer > 0 ? gulpSwallowU : 0.42;

    pouchSystem.updatePouchGeometry({
      jawOpenAngle,
      pouchDisp,
      pouchLatDisp,
      honkBalloon: totalHonk,
      fishBulge: fishBulgeAmount,
      fishCenterU,
      time: internalTime,
    });

    // Wriggling Silver Sardine inside pouch / peeking out of beak!
    sardine.fishGroup.visible = hasFish;
    if (hasFish) {
      if (gulpTimer > 0) {
        // During triggerFishGulp(): sardine slides from outer bill deep into throat while wriggling!
        const fishX = THREE.MathUtils.lerp(0.28, 0.06, Math.min(1, gulpProgress * 1.25));
        const fishY = -0.032 - pouchDisp * 0.55 - Math.sin(gulpProgress * Math.PI) * 0.025;
        sardine.fishGroup.position.set(fishX, fishY, pouchLatDisp * 0.7);
        sardine.fishGroup.rotation.set(
          0.25,
          Math.sin(internalTime * 24) * 0.22,
          -jawOpenAngle * 0.55 + 0.32
        );
        const swallowScale = gulpProgress > 0.65 ? Math.max(0.01, 1 - (gulpProgress - 0.65) / 0.35) : 1;
        sardine.fishGroup.scale.setScalar(swallowScale);
        sardine.tailPivot.rotation.y = Math.sin(internalTime * 34) * 0.58;
      } else {
        // Carrying sardines in pouch (fishInPouch > 0): silver tail peeks out playfully above rim!
        const wriggleBurst = Math.pow(Math.max(0, Math.sin(internalTime * 1.7)), 6);
        const tailFreq = 10 + wriggleBurst * 18;
        sardine.fishGroup.scale.setScalar(0.95);
        sardine.fishGroup.position.set(
          0.215,
          -0.026 - jawOpenAngle * 0.09 - pouchDisp * 0.38,
          0.014 + pouchLatDisp * 0.6
        );
        sardine.fishGroup.rotation.set(
          0.38,
          0.26 + Math.sin(internalTime * tailFreq) * (0.06 + wriggleBurst * 0.16),
          0.22 - jawOpenAngle * 0.42
        );
        sardine.tailPivot.rotation.y =
          Math.sin(internalTime * tailFreq - 0.8) * (0.20 + wriggleBurst * 0.45);
      }
    }

    // ---- 5. 8-Segment Chained Riviera Silk Scarf Aerodynamic Wave ----
    if (accessoryFlags.scarf) {
      const windFactor = THREE.MathUtils.clamp(speedMps / 9.5, 0.06, 1.65);
      const waveFreq = 4.2 + Math.max(0, speedMps) * 1.25;
      // Gravity droop when parked/slow; streams horizontally behind neck at speed!
      const gravityDroop = (1 - THREE.MathUtils.clamp(speedMps / 5.5, 0, 1)) * 0.16;

      for (let k = 0; k < accessories.scarfLinks.length; k++) {
        const link = accessories.scarfLinks[k];
        const phase = internalTime * waveFreq - k * 0.72;
        const ampGrow = 0.045 + (k / 7) * 0.11 * windFactor;

        const pitchWave =
          (k === 0 ? 0.18 - sprintBlend * 0.25 : 0) +
          gravityDroop +
          Math.sin(phase) * ampGrow;
        const yawWave =
          (k === 0 ? steerAngle * 0.28 : steerAngle * 0.04) +
          Math.cos(phase * 0.85 + 0.6) * ampGrow * 0.95;
        const rollTwist = Math.sin(phase * 1.1) * 0.12 * windFactor;

        link.rotation.set(rollTwist, yawWave, pitchWave, "YXZ");
      }
    }

    // ---- 6. Live IK & Biomechanics Debug Overlay ----
    const showDebug = Boolean(state.showIKDebug);
    debugOverlay.debugGroup.visible = showDebug;
    if (showDebug) {
      debugPts.pelvis.copy(pelvisGroup.position);
      debugPts.lHip.copy(lHipRig);
      debugPts.lKnee.copy(leftLeg.ikResult.midPos);
      debugPts.lAnkle.copy(leftLeg.ikResult.endPos);
      debugPts.lPedal.copy(leftPedalPos);
      debugPts.rHip.copy(rHipRig);
      debugPts.rKnee.copy(rightLeg.ikResult.midPos);
      debugPts.rAnkle.copy(rightLeg.ikResult.endPos);
      debugPts.rPedal.copy(rightPedalPos);
      debugPts.lShoulder.copy(lShoulderRig);
      debugPts.rShoulder.copy(rShoulderRig);

      debugPts.lKneePoleTick
        .copy(leftLeg.ikResult.midPos)
        .addScaledVector(leftLeg.ikResult.bendDir, 0.085);
      debugPts.rKneePoleTick
        .copy(rightLeg.ikResult.midPos)
        .addScaledVector(rightLeg.ikResult.bendDir, 0.085);

      neckAccumMat.multiply(headGroup.matrix);
      debugPts.head.set(0, 0, 0).applyMatrix4(neckAccumMat);
      billRoot.updateMatrix();
      upperJawGroup.updateMatrix();
      neckAccumMat.multiply(billRoot.matrix).multiply(upperJawGroup.matrix);
      debugPts.beakTip.copy(beakTipMarker.position).applyMatrix4(neckAccumMat);

      debugOverlay.updateDebug(debugPts, telemetry.wingLiftN, smoothFlight);
    }
  }

  // Initialize character into a clean valid cycling pose on frame 0
  update({
    dt: 1 / 60,
    time: 0,
    crankPhase: 0,
    steerAngle: 0,
    leanAngle: 0,
    speedMps: 6.8,
    fishInPouch: options.fishInPouch ?? 2,
    accessories: accessoryFlags,
    showIKDebug: Boolean(options.showIKDebug),
    wireframe: Boolean(options.wireframe),
  });

  return {
    group,
    update,
    triggerFishGulp,
    triggerHonk,
    telemetry,
    getTelemetry: () => ({ ...telemetry }),
  };
}
