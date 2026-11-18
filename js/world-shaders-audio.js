import * as THREE from "three";

const ROAD_RADIUS = 68.0;
const ROAD_WIDTH = 6.8;

const PRESETS = {
  sunset: {
    zenith: new THREE.Color("#2b6da8"),
    horizon: new THREE.Color("#ffd099"),
    sunColor: new THREE.Color("#ff9d52"),
    sunDir: new THREE.Vector3(-0.72, 0.24, -0.65).normalize(),
    sunIntensity: 2.85,
    hemiSky: new THREE.Color("#9bd4ff"),
    hemiGround: new THREE.Color("#c88b62"),
    hemiIntensity: 0.92,
    fogColor: new THREE.Color("#f0caa4"),
    fogDensity: 0.0022,
    deepWater: new THREE.Color("#0c4f78"),
    shallowWater: new THREE.Color("#2ec4b6"),
    foamColor: new THREE.Color("#fff6ea"),
    nightFactor: 0.0,
    waveScale: 1.0,
    windSpeed: 1.0,
  },
  noon: {
    zenith: new THREE.Color("#1f82d8"),
    horizon: new THREE.Color("#bce8ff"),
    sunColor: new THREE.Color("#fff9ea"),
    sunDir: new THREE.Vector3(-0.35, 0.84, 0.41).normalize(),
    sunIntensity: 3.15,
    hemiSky: new THREE.Color("#8fd8ff"),
    hemiGround: new THREE.Color("#d8cfb8"),
    hemiIntensity: 1.1,
    fogColor: new THREE.Color("#c7ecff"),
    fogDensity: 0.0015,
    deepWater: new THREE.Color("#0969a3"),
    shallowWater: new THREE.Color("#3fe0cb"),
    foamColor: new THREE.Color("#ffffff"),
    nightFactor: 0.0,
    waveScale: 0.85,
    windSpeed: 0.85,
  },
  night: {
    zenith: new THREE.Color("#050d1c"),
    horizon: new THREE.Color("#132b4c"),
    sunColor: new THREE.Color("#8bb8ff"),
    sunDir: new THREE.Vector3(0.52, 0.44, -0.73).normalize(),
    sunIntensity: 0.85,
    hemiSky: new THREE.Color("#274773"),
    hemiGround: new THREE.Color("#0a1524"),
    hemiIntensity: 0.55,
    fogColor: new THREE.Color("#0c1d36"),
    fogDensity: 0.0026,
    deepWater: new THREE.Color("#04192e"),
    shallowWater: new THREE.Color("#0b5870"),
    foamColor: new THREE.Color("#5ef2ff"),
    nightFactor: 1.0,
    waveScale: 0.9,
    windSpeed: 0.9,
  },
  headwind: {
    zenith: new THREE.Color("#314b63"),
    horizon: new THREE.Color("#9db4c4"),
    sunColor: new THREE.Color("#ffe5c4"),
    sunDir: new THREE.Vector3(-0.58, 0.48, 0.65).normalize(),
    sunIntensity: 2.1,
    hemiSky: new THREE.Color("#8ca6ba"),
    hemiGround: new THREE.Color("#5f6e78"),
    hemiIntensity: 0.95,
    fogColor: new THREE.Color("#a2b6c4"),
    fogDensity: 0.0032,
    deepWater: new THREE.Color("#123d59"),
    shallowWater: new THREE.Color("#2f8f99"),
    foamColor: new THREE.Color("#f3f8fb"),
    nightFactor: 0.0,
    waveScale: 1.65,
    windSpeed: 2.2,
  },
};

function makeMilestoneTexture(kmIndex) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext("2d");
  // Red Michelin-style French borne kilométrique top cap + ivory stone body
  ctx.fillStyle = "#f4efe2";
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = "#e04f26";
  ctx.fillRect(0, 0, 256, 118);

  ctx.fillStyle = "#f7f3e8";
  ctx.font = "700 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("N 98", 128, 76);

  ctx.fillStyle = "#102336";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("CÔTE D'AZUR", 128, 186);
  ctx.font = "700 68px monospace";
  ctx.fillText(`KM ${String(kmIndex).padStart(2, "0")}`, 128, 274);
  ctx.font = "600 24px Georgia, serif";
  ctx.fillStyle = "#5a6b7c";
  ctx.fillText("CAP DU PÉLICAN", 128, 332);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBannerTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 220;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#f7f3e8";
  ctx.fillRect(0, 0, 1024, 220);

  ctx.fillStyle = "#102336";
  ctx.fillRect(14, 14, 996, 192);

  ctx.strokeStyle = "#d9a441";
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, 976, 172);

  ctx.fillStyle = "#4cc9b0";
  ctx.fillRect(28, 28, 22, 164);
  ctx.fillStyle = "#f26a2e";
  ctx.fillRect(974, 28, 22, 164);

  ctx.fillStyle = "#f7f3e8";
  ctx.font = "italic 700 54px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("LE GRAND PRIX DU PÉLICAN", 512, 108);

  ctx.fillStyle = "#d9a441";
  ctx.font = "700 26px monospace";
  ctx.fillText("CHRONOMÈTRE MARITIME · CÔTE D'AZUR · DÉPART / ARRIVÉE", 512, 158);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCoastalWorld(scene, renderer, options = {}) {
  const group = new THREE.Group();
  scene.add(group);

  scene.fog = new THREE.FogExp2("#f0caa4", 0.0022);

  // Directional Sun/Moon Light with soft shadows following the rider!
  const sunLight = new THREE.DirectionalLight("#ff9d52", 2.85);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 60;
  const d = 7.5;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight("#9bd4ff", "#c88b62", 0.92);
  scene.add(hemiLight);

  // 1. Custom GLSL Atmospheric Sky Dome
  const skyUniforms = {
    uZenith: { value: PRESETS.sunset.zenith.clone() },
    uHorizon: { value: PRESETS.sunset.horizon.clone() },
    uSunColor: { value: PRESETS.sunset.sunColor.clone() },
    uSunDir: { value: PRESETS.sunset.sunDir.clone() },
    uNight: { value: 0.0 },
    uTime: { value: 0.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vWorldDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uZenith, pow(h, 0.58));

        // Sun / Moon disc & warm Mie scattering halo
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        sky += uSunColor * pow(sunAmt, 10.0) * 0.42;
        sky += uSunColor * smoothstep(0.9985, 0.9996, sunAmt) * 2.2;

        // Procedural twinkling starfield at night
        if (uNight > 0.05 && dir.y > 0.04) {
          vec2 starUV = dir.xz / (dir.y + 0.35) * 95.0;
          vec2 cell = floor(starUV);
          float rnd = hash21(cell);
          if (rnd > 0.986) {
            vec2 f = fract(starUV) - 0.5;
            float dStar = length(f);
            float twinkle = 0.65 + 0.35 * sin(uTime * 3.2 + rnd * 60.0);
            float star = smoothstep(0.18, 0.01, dStar) * twinkle * smoothstep(0.04, 0.28, dir.y);
            sky += vec3(0.82, 0.91, 1.0) * star * uNight * 1.4;
          }
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(440, 40, 28), skyMat);
  group.add(skyDome);

  // Subtle Distant Painterly Horizon Ring using AI-generated Riviera gouache panorama
  const horizonCylGeo = new THREE.CylinderGeometry(360, 360, 95, 64, 1, true);
  const horizonCylMat = new THREE.MeshBasicMaterial({
    map: options.skyPanoramaTexture || null,
    side: THREE.BackSide,
    transparent: true,
    opacity: options.skyPanoramaTexture ? 0.42 : 0.0,
    depthWrite: false,
    fog: false,
  });
  const horizonCyl = new THREE.Mesh(horizonCylGeo, horizonCylMat);
  horizonCyl.position.y = 32;
  group.add(horizonCyl);

  // 2. Custom GLSL Gerstner Ocean Shader
  const oceanUniforms = {
    uTime: { value: 0 },
    uDeepColor: { value: PRESETS.sunset.deepWater.clone() },
    uShallowColor: { value: PRESETS.sunset.shallowWater.clone() },
    uFoamColor: { value: PRESETS.sunset.foamColor.clone() },
    uSunColor: { value: PRESETS.sunset.sunColor.clone() },
    uSunDir: { value: PRESETS.sunset.sunDir.clone() },
    uSkyColor: { value: PRESETS.sunset.horizon.clone() },
    uNight: { value: 0.0 },
    uWaveScale: { value: 1.0 },
    uRiderPos: { value: new THREE.Vector3(ROAD_RADIUS, 0, 0) },
  };

  const oceanGeo = new THREE.PlaneGeometry(760, 760, 200, 200);
  oceanGeo.rotateX(-Math.PI / 2);

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveScale;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveCrest;

      void main() {
        vec3 p = position;
        float r = length(p.xz);
        // Calm waves slightly right against the seawall
        float wallDamp = smoothstep(0.0, 6.0, abs(r - 68.0));
        float amp = uWaveScale * (0.12 + 0.24 * wallDamp);

        float w1 = sin(p.x * 0.17 + uTime * 1.45 + p.z * 0.08);
        float w2 = cos(p.z * 0.23 - uTime * 1.15 - p.x * 0.11);
        float w3 = sin((p.x + p.z) * 0.41 + uTime * 2.1) * 0.45;
        float disp = (w1 + w2 + w3) * amp;
        p.y += disp;

        float dx = (0.17 * cos(p.x * 0.17 + uTime * 1.45 + p.z * 0.08)
                 + 0.11 * sin(p.z * 0.23 - uTime * 1.15 - p.x * 0.11)
                 + 0.41 * 0.45 * cos((p.x + p.z) * 0.41 + uTime * 2.1)) * amp;
        float dz = (0.08 * cos(p.x * 0.17 + uTime * 1.45 + p.z * 0.08)
                 - 0.23 * sin(p.z * 0.23 - uTime * 1.15 - p.x * 0.11)
                 + 0.41 * 0.45 * cos((p.x + p.z) * 0.41 + uTime * 2.1)) * amp;

        vNormal = normalize(vec3(-dx, 1.0, -dz));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vWaveCrest = w1 + w2 + w3;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform float uNight;
      uniform vec3 uRiderPos;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vWaveCrest;

      void main() {
        float r = length(vWorldPos.xz);
        // Shallow reef glow around the central lighthouse island (r < 45) & causeway (r ~ 68)
        float distCauseway = abs(r - 68.0);
        float distIsland = max(0.0, r - 34.0);
        float shallowMask = max(
          1.0 - smoothstep(3.2, 16.0, distCauseway),
          1.0 - smoothstep(0.0, 18.0, distIsland)
        );

        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.6);

        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(shallowMask, 0.0, 1.0));
        vec3 col = mix(baseWater, uSkyColor, fresnel * 0.55);

        // Sun specular glitter path
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, H), 0.0), 140.0);
        col += uSunColor * spec * 1.75;

        // Animated shoreline foam against causeway seawall & central rocky island
        float angle = atan(vWorldPos.z, vWorldPos.x);
        float foamWave = sin(distCauseway * 4.2 - uTime * 2.8 + sin(angle * 24.0) * 1.5);
        float seawallFoam = (1.0 - smoothstep(3.4, 5.4, distCauseway)) * smoothstep(0.25, 0.85, foamWave);
        float islandFoam = (1.0 - smoothstep(31.0, 35.5, r)) * smoothstep(0.2, 0.8, sin(r * 3.5 - uTime * 2.4));
        float crestFoam = smoothstep(1.55, 2.25, vWaveCrest) * 0.38;
        float totalFoam = clamp(seawallFoam + islandFoam + crestFoam, 0.0, 1.0);
        col = mix(col, uFoamColor, totalFoam * 0.82);

        // Night bioluminescent plankton shimmer near rider & shoreline
        if (uNight > 0.05) {
          float dRider = length(vWorldPos.xz - uRiderPos.xz);
          float bioGlow = (1.0 - smoothstep(4.0, 22.0, dRider)) * (0.5 + 0.5 * sin(vWorldPos.x * 1.7 + vWorldPos.z * 1.9 + uTime * 4.0));
          col += vec3(0.08, 0.88, 0.96) * (bioGlow * 0.55 + totalFoam * 0.35) * uNight;
        }

        // Distance atmospheric fade
        float distCam = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-pow(distCam * 0.0021, 2.0));
        col = mix(col, uSkyColor, clamp(fogFactor, 0.0, 0.92));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = -1.35;
  group.add(oceanMesh);

  // 3. Scenic Circular Mediterranean Stone & Timber Causeway (R = 68m, Top Deck y = 0.0)
  const causewayGroup = new THREE.Group();
  group.add(causewayGroup);

  const SEGMENTS = 220;
  // Stone seawall foundation (y = -1.65 .. -0.02)
  const wallShape = new THREE.Shape();
  wallShape.absarc(0, 0, ROAD_RADIUS + ROAD_WIDTH * 0.54, 0, Math.PI * 2, false);
  const wallHole = new THREE.Path();
  wallHole.absarc(0, 0, ROAD_RADIUS - ROAD_WIDTH * 0.54, 0, Math.PI * 2, true);
  wallShape.holes.push(wallHole);

  const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: 1.65,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: SEGMENTS,
  });
  wallGeo.rotateX(Math.PI / 2);
  const wallMat = new THREE.MeshStandardMaterial({
    color: "#d9ceb8",
    roughness: 0.88,
    metalness: 0.04,
  });
  const seawallMesh = new THREE.Mesh(wallGeo, wallMat);
  seawallMesh.position.y = -0.11;
  seawallMesh.receiveShadow = true;
  causewayGroup.add(seawallMesh);

  // Smooth Warm Asphalt / Limestone Cycling Deck right at y = 0.0
  const roadGeo = new THREE.RingGeometry(
    ROAD_RADIUS - ROAD_WIDTH * 0.47,
    ROAD_RADIUS + ROAD_WIDTH * 0.47,
    SEGMENTS,
    2
  );
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: "#434c59",
    roughness: 0.78,
    metalness: 0.06,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.y = 0.0;
  roadMesh.receiveShadow = true;
  causewayGroup.add(roadMesh);

  // Terracotta / Sandstone Promenade Shoulders
  for (const side of [-1, 1]) {
    const rInner = ROAD_RADIUS + side * (ROAD_WIDTH * 0.47) - (side < 0 ? 0.36 : 0);
    const rOuter = rInner + 0.36;
    const curbGeo = new THREE.RingGeometry(rInner, rOuter, SEGMENTS, 1);
    curbGeo.rotateX(-Math.PI / 2);
    const curbMesh = new THREE.Mesh(
      curbGeo,
      new THREE.MeshStandardMaterial({ color: "#e6dcc8", roughness: 0.72 })
    );
    curbMesh.position.y = 0.015;
    curbMesh.receiveShadow = true;
    causewayGroup.add(curbMesh);
  }

  // Dashed Ivory Centerline & Stone Coastal Bollards (InstancedMesh for ultra-low draw calls!)
  const dashCount = 120;
  const dashGeo = new THREE.BoxGeometry(1.35, 0.012, 0.13);
  const dashMat = new THREE.MeshStandardMaterial({ color: "#f7f3e8", roughness: 0.5 });
  const dashInst = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  dashInst.receiveShadow = true;

  const bollardCount = 96;
  const bollardGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.62, 12);
  const bollardMat = new THREE.MeshStandardMaterial({ color: "#f2ece0", roughness: 0.65 });
  const bollardInst = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount * 2);
  bollardInst.castShadow = true;
  bollardInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < dashCount; i++) {
    const th = (i / dashCount) * Math.PI * 2;
    dummy.position.set(Math.cos(th) * ROAD_RADIUS, 0.008, Math.sin(th) * ROAD_RADIUS);
    dummy.rotation.set(0, -th + Math.PI / 2, 0);
    dummy.updateMatrix();
    dashInst.setMatrixAt(i, dummy.matrix);
  }
  let bIdx = 0;
  for (let i = 0; i < bollardCount; i++) {
    const th = (i / bollardCount) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const rb = ROAD_RADIUS + side * (ROAD_WIDTH * 0.51);
      dummy.position.set(Math.cos(th) * rb, 0.31, Math.sin(th) * rb);
      dummy.rotation.set(0, -th, 0);
      dummy.updateMatrix();
      bollardInst.setMatrixAt(bIdx++, dummy.matrix);
    }
  }
  causewayGroup.add(dashInst);
  causewayGroup.add(bollardInst);

  // French Michelin-style Kilometer Milestones (KM 01 .. KM 08)
  for (let k = 1; k <= 8; k++) {
    const th = ((k - 0.5) / 8) * Math.PI * 2;
    const rm = ROAD_RADIUS - ROAD_WIDTH * 0.49;
    const stone = new THREE.Group();
    const tex = makeMilestoneTexture(k);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.68, 0.24),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 })
    );
    body.position.y = 0.34;
    body.castShadow = true;
    stone.add(body);
    stone.position.set(Math.cos(th) * rm, 0, Math.sin(th) * rm);
    stone.rotation.y = -th;
    causewayGroup.add(stone);
  }

  // Grand Prix Start / Finish Arch at theta = 0.18 rad (right ahead of initial spawn!)
  const archAngle = 0.22;
  const archGroup = new THREE.Group();
  archGroup.position.set(
    Math.cos(archAngle) * ROAD_RADIUS,
    0,
    Math.sin(archAngle) * ROAD_RADIUS
  );
  archGroup.rotation.y = -archAngle; // local +Z is radial, local -Z/+Z spans road width!
  const pillarMat = new THREE.MeshStandardMaterial({
    color: "#102336",
    metalness: 0.35,
    roughness: 0.4,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: "#d9a441",
    metalness: 0.82,
    roughness: 0.24,
  });

  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 16), pillarMat);
    post.position.set(s * 3.95, 2.7, 0);
    post.castShadow = true;
    archGroup.add(post);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), brassMat);
    finial.position.set(s * 3.95, 5.5, 0);
    archGroup.add(finial);
  }

  const bannerTex = makeBannerTexture();
  const bannerBox = new THREE.Mesh(
    new THREE.BoxGeometry(8.3, 1.35, 0.28),
    new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.45 })
  );
  bannerBox.position.set(0, 4.65, 0);
  bannerBox.castShadow = true;
  archGroup.add(bannerBox);

  // Central Club Crest Medallion atop the Arch using AI-generated emblemTexture!
  const crestDiscMat = new THREE.MeshStandardMaterial({
    map: options.emblemTexture || null,
    color: options.emblemTexture ? "#ffffff" : "#f7f3e8",
    roughness: 0.38,
  });
  const crestDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.14, 32), crestDiscMat);
  crestDisc.rotation.x = Math.PI / 2;
  crestDisc.position.set(0, 5.55, 0);
  archGroup.add(crestDisc);
  const crestRim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 12, 36), brassMat);
  crestRim.position.set(0, 5.55, 0);
  archGroup.add(crestRim);

  causewayGroup.add(archGroup);

  // 4. Central Mediterranean Rocky Island + Phare du Pélican Lighthouse + Umbrella Pines
  const islandGroup = new THREE.Group();
  group.add(islandGroup);

  const rockMat = new THREE.MeshStandardMaterial({
    color: "#c4b093",
    roughness: 0.92,
    flatShading: true,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: "#5f8d5a",
    roughness: 0.85,
    flatShading: true,
  });

  const mainCliff = new THREE.Mesh(new THREE.ConeGeometry(31, 11.5, 11), rockMat);
  mainCliff.position.set(0, 3.6, 0);
  mainCliff.scale.set(1.08, 1, 0.94);
  mainCliff.receiveShadow = true;
  islandGroup.add(mainCliff);

  const meadowCap = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 19, 3.2, 11), grassMat);
  meadowCap.position.set(0, 7.6, 0);
  islandGroup.add(meadowCap);

  // Striped Red-and-White Riviera Lighthouse
  const lighthouse = new THREE.Group();
  lighthouse.position.set(0, 9.1, 0);
  islandGroup.add(lighthouse);

  const stripeColors = ["#f7f3e8", "#e04f26", "#f7f3e8", "#e04f26", "#f7f3e8"];
  for (let i = 0; i < 5; i++) {
    const rBot = 2.5 - i * 0.22;
    const rTop = 2.5 - (i + 1) * 0.22;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 2.6, 20),
      new THREE.MeshStandardMaterial({ color: stripeColors[i], roughness: 0.55 })
    );
    seg.position.y = i * 2.6 + 1.3;
    seg.castShadow = true;
    lighthouse.add(seg);
  }

  const galleryDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.6, 0.45, 24),
    pillarMat
  );
  galleryDeck.position.y = 13.2;
  lighthouse.add(galleryDeck);

  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 1.9, 16),
    new THREE.MeshBasicMaterial({ color: "#fff3b8" })
  );
  lanternGlass.position.y = 14.3;
  lighthouse.add(lanternGlass);

  const domeCap = new THREE.Mesh(
    new THREE.ConeGeometry(1.45, 1.35, 20),
    new THREE.MeshStandardMaterial({ color: "#102336", roughness: 0.35 })
  );
  domeCap.position.y = 15.85;
  lighthouse.add(domeCap);

  // Rotating Volumetric Lighthouse Twin Beams!
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 14.3;
  lighthouse.add(beamPivot);

  const beamMat = new THREE.MeshBasicMaterial({
    color: "#ffe89e",
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const dirSign of [-1, 1]) {
    const coneGeo = new THREE.ConeGeometry(5.5, 48, 20, 1, true);
    coneGeo.translate(0, -24, 0);
    coneGeo.rotateZ((dirSign * Math.PI) / 2);
    const cone = new THREE.Mesh(coneGeo, beamMat);
    beamPivot.add(cone);
  }

  // Mediterranean Umbrella Pines & Terracotta Villa on Island
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#6e4c36", roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: "#2f6b48",
    roughness: 0.8,
    flatShading: true,
  });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const rad = 11.5 + (i % 3) * 4.5;
    const tree = new THREE.Group();
    const hY = rad < 14 ? 8.8 : 5.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7), trunkMat);
    trunk.position.y = 1.6;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.3, 9, 7), canopyMat);
    crown.scale.set(1.35, 0.52, 1.35);
    crown.position.y = 3.4;
    tree.add(trunk, crown);
    tree.position.set(Math.cos(a) * rad, hY, Math.sin(a) * rad);
    islandGroup.add(tree);
  }

  // 5. Bobbing Channel Buoys & Distant White Sailboats in the Bay
  const buoys = [];
  const buoyRedMat = new THREE.MeshStandardMaterial({ color: "#e04f26", roughness: 0.45 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: "#ffaa33" });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.14;
    const r = i % 2 === 0 ? 82 : 52;
    const b = new THREE.Group();
    const floatBody = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), buoyRedMat);
    const tower = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 8), buoyRedMat);
    tower.position.y = 0.85;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), beaconMat);
    lamp.position.y = 1.65;
    b.add(floatBody, tower, lamp);
    b.position.set(Math.cos(a) * r, -1.25, Math.sin(a) * r);
    b.userData = { baseX: b.position.x, baseZ: b.position.z, phase: i * 1.1 };
    group.add(b);
    buoys.push(b);
  }

  const sailboats = [];
  const hullMat = new THREE.MeshStandardMaterial({ color: "#f7f3e8", roughness: 0.4 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: "#fffcf5",
    side: THREE.DoubleSide,
    roughness: 0.55,
  });
  for (let i = 0; i < 7; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5.2, 6), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.45);
    const sailGeo = new THREE.ConeGeometry(2.1, 6.8, 3);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 3.6, 0);
    sail.scale.set(1, 1, 0.12);
    boat.add(hull, sail);
    group.add(boat);
    sailboats.push({
      mesh: boat,
      radius: 108 + (i % 3) * 26,
      angle: (i / 7) * Math.PI * 2,
      speed: 0.025 + (i % 3) * 0.008,
    });
  }

  // 6. Circling Ambient Distant Seabirds
  const seabirds = [];
  const birdWingMat = new THREE.MeshBasicMaterial({ color: "#faf6ec", side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const bird = new THREE.Group();
    const lw = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.22), birdWingMat);
    lw.position.x = -0.32;
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.22), birdWingMat);
    rw.position.x = 0.32;
    bird.add(lw, rw);
    group.add(bird);
    seabirds.push({
      group: bird,
      lw,
      rw,
      angle: (i / 12) * Math.PI * 2,
      radius: 36 + (i % 4) * 12,
      height: 16 + (i % 5) * 3.2,
      speed: 0.18 + (i % 3) * 0.04,
      flapOffset: i * 0.9,
    });
  }

  // 7. Aerodynamic Wind-Stream Particles around the Rider
  const WIND_COUNT = 56;
  const windGeo = new THREE.BoxGeometry(0.95, 0.018, 0.018);
  const windMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const windInst = new THREE.InstancedMesh(windGeo, windMat, WIND_COUNT);
  windInst.frustumCulled = false;
  group.add(windInst);
  const windParticles = Array.from({ length: WIND_COUNT }, () => ({
    x: (Math.random() - 0.5) * 14,
    y: 0.35 + Math.random() * 2.8,
    z: (Math.random() - 0.5) * 7,
    speedMul: 0.8 + Math.random() * 0.7,
  }));

  // 8. Jumping Silver Sardines Pool (for `spawnJumpingFish`)
  const activeFishes = [];
  const sardineBodyMat = new THREE.MeshStandardMaterial({
    color: "#dce8f2",
    metalness: 0.88,
    roughness: 0.18,
  });

  function spawnJumpingFish(rigWorldPos, rigForwardVec, onCatch) {
    const fish = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 6, 12), sardineBodyMat);
    body.rotation.z = Math.PI / 2;
    body.scale.set(1, 1, 0.55);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 4), sardineBodyMat);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.18;
    fish.add(body, tail);
    fish.castShadow = true;
    group.add(fish);

    // Launch from the ocean just outside the causeway beside the rider!
    const radialOut = rigWorldPos.clone().setY(0).normalize();
    const startPos = radialOut
      .multiplyScalar(ROAD_RADIUS + ROAD_WIDTH * 0.68)
      .setY(-1.1)
      .addScaledVector(rigForwardVec, 3.8);

    activeFishes.push({
      mesh: fish,
      tail,
      startPos,
      t: 0,
      duration: 0.82,
      onCatch,
    });
    return { usesCallback: true };
  }

  // Exact Circular Causeway Sampler (`+X` aligned along `tangent`, `+Z` along `rightNormal`!)
  function sampleRoadTrack(s, lateralOffset = 0) {
    const theta = s / ROAD_RADIUS;
    const r = ROAD_RADIUS + lateralOffset;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const position = new THREE.Vector3(cosT * r, 0.0, sinT * r);
    const tangent = new THREE.Vector3(-sinT, 0.0, cosT).normalize();
    const rightNormal = new THREE.Vector3(cosT, 0.0, sinT).normalize();
    // Verify: in Three.js, rotating (1,0,0) by ry around +Y gives (cos(ry), 0, -sin(ry)).
    // Setting ry = atan2(-tangent.z, tangent.x) makes +X === tangent and +Z === rightNormal!
    const headingY = Math.atan2(-tangent.z, tangent.x);

    return { position, tangent, rightNormal, headingY, bankAngle: 0 };
  }

  let activePreset = PRESETS.sunset;

  function setPreset(presetName) {
    const p = PRESETS[presetName] || PRESETS.sunset;
    activePreset = p;

    skyUniforms.uZenith.value.copy(p.zenith);
    skyUniforms.uHorizon.value.copy(p.horizon);
    skyUniforms.uSunColor.value.copy(p.sunColor);
    skyUniforms.uSunDir.value.copy(p.sunDir);
    skyUniforms.uNight.value = p.nightFactor;

    oceanUniforms.uDeepColor.value.copy(p.deepWater);
    oceanUniforms.uShallowColor.value.copy(p.shallowWater);
    oceanUniforms.uFoamColor.value.copy(p.foamColor);
    oceanUniforms.uSunColor.value.copy(p.sunColor);
    oceanUniforms.uSunDir.value.copy(p.sunDir);
    oceanUniforms.uSkyColor.value.copy(p.horizon);
    oceanUniforms.uNight.value = p.nightFactor;
    oceanUniforms.uWaveScale.value = p.waveScale;

    sunLight.color.copy(p.sunColor);
    sunLight.intensity = p.sunIntensity;
    hemiLight.color.copy(p.hemiSky);
    hemiLight.groundColor.copy(p.hemiGround);
    hemiLight.intensity = p.hemiIntensity;

    scene.fog.color.copy(p.fogColor);
    scene.fog.density = p.fogDensity;

    beamMat.opacity = p.nightFactor > 0.5 ? 0.34 : presetName === "sunset" ? 0.14 : 0.02;
    horizonCylMat.opacity =
      options.skyPanoramaTexture && p.nightFactor < 0.5
        ? presetName === "sunset"
          ? 0.45
          : 0.28
        : 0.0;
  }

  setPreset("sunset");

  const riderQuat = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const tmpVec = new THREE.Vector3();

  function update(state = {}) {
    const dt = state.dt ?? 0.016;
    const time = state.time ?? 0;
    const rigPos = state.rigPosition || new THREE.Vector3(ROAD_RADIUS, 0, 0);
    const rigHeading = state.rigHeading ?? 0;
    const speedMps = state.speedMps ?? 7;

    if (state.emblemTexture && crestDiscMat.map !== state.emblemTexture) {
      crestDiscMat.map = state.emblemTexture;
      crestDiscMat.needsUpdate = true;
    }
    if (state.skyPanoramaTexture && horizonCylMat.map !== state.skyPanoramaTexture) {
      horizonCylMat.map = state.skyPanoramaTexture;
      horizonCylMat.needsUpdate = true;
    }

    skyUniforms.uTime.value = time;
    oceanUniforms.uTime.value = time;
    oceanUniforms.uRiderPos.value.copy(rigPos);

    // Keep shadow frustum centered on the Pelican & Bicycle!
    sunLight.target.position.copy(rigPos);
    sunLight.position.copy(rigPos).addScaledVector(activePreset.sunDir, 24);

    // Rotate lighthouse twin beams
    beamPivot.rotation.y = time * 0.72;

    // Bob buoys on ocean swells
    for (const b of buoys) {
      b.position.y = -1.25 + Math.sin(time * 1.8 + b.userData.phase) * 0.16;
      b.rotation.z = Math.sin(time * 1.4 + b.userData.phase) * 0.12;
      b.rotation.x = Math.cos(time * 1.2 + b.userData.phase) * 0.1;
    }

    // Glide sailboats around outer bay
    for (const sb of sailboats) {
      sb.angle += sb.speed * dt;
      sb.mesh.position.set(
        Math.cos(sb.angle) * sb.radius,
        -1.22 + Math.sin(time * 1.5 + sb.angle) * 0.08,
        Math.sin(sb.angle) * sb.radius
      );
      sb.mesh.rotation.y = -sb.angle + Math.PI / 2;
      sb.mesh.rotation.z = Math.sin(time * 1.1 + sb.angle) * 0.06;
    }

    // Flap & wheel ambient seabirds around the lighthouse island
    for (const bd of seabirds) {
      bd.angle += bd.speed * dt;
      bd.group.position.set(
        Math.cos(bd.angle) * bd.radius,
        bd.height + Math.sin(time * 1.2 + bd.flapOffset) * 0.8,
        Math.sin(bd.angle) * bd.radius
      );
      bd.group.rotation.y = -bd.angle;
      const flap = Math.sin(time * 7.5 + bd.flapOffset) * 0.55;
      bd.lw.rotation.z = flap;
      bd.rw.rotation.z = -flap;
    }

    // Update aerodynamic wind streaks around the rider
    riderQuat.setFromAxisAngle(yAxis, rigHeading);
    const windOpacity = THREE.MathUtils.clamp((speedMps - 3) / 14, 0.06, 0.48) * activePreset.windSpeed;
    windMat.opacity = Math.min(0.55, windOpacity);

    for (let i = 0; i < WIND_COUNT; i++) {
      const wp = windParticles[i];
      wp.x -= (speedMps * 1.65 + 4.0 * activePreset.windSpeed) * wp.speedMul * dt;
      if (wp.x < -7.5) {
        wp.x = 7.5;
        wp.y = 0.3 + Math.random() * 2.9;
        wp.z = (Math.random() - 0.5) * 7.2;
      }
      tmpVec.set(wp.x, wp.y, wp.z).applyQuaternion(riderQuat).add(rigPos);
      dummy.position.copy(tmpVec);
      dummy.quaternion.copy(riderQuat);
      dummy.scale.set(0.6 + speedMps * 0.09, 1, 1);
      dummy.updateMatrix();
      windInst.setMatrixAt(i, dummy.matrix);
    }
    windInst.instanceMatrix.needsUpdate = true;

    // Update arcing silver sardines homing cleanly into Capitaine Archibald's pouch!
    for (let i = activeFishes.length - 1; i >= 0; i--) {
      const f = activeFishes[i];
      f.t += dt / f.duration;
      const u = Math.min(1, f.t);
      const pouchWorld = tmpVec
        .set(0.56, 1.38, 0)
        .applyQuaternion(riderQuat)
        .add(rigPos);

      const cur = new THREE.Vector3().lerpVectors(f.startPos, pouchWorld, u);
      cur.y += Math.sin(u * Math.PI) * 2.85;
      f.mesh.position.copy(cur);
      f.mesh.lookAt(pouchWorld);
      f.tail.rotation.y = Math.sin(time * 38) * 0.45;

      if (f.t >= 1) {
        group.remove(f.mesh);
        activeFishes.splice(i, 1);
        if (typeof f.onCatch === "function") f.onCatch();
      }
    }
  }

  return {
    group,
    sunLight,
    hemiLight,
    presets: Object.keys(PRESETS),
    setPreset,
    sampleRoadTrack,
    spawnJumpingFish,
    update,
  };
}

export function createSoundEngine() {
  let ctx = null;
  let masterGain = null;
  let surfGain = null;
  let windFilter = null;
  let windGain = null;
  let muted = false;
  let clickTimer = 0;

  function ensureGraph() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.55;
    masterGain.connect(ctx.destination);

    // Shared 2-second pink-ish noise buffer for surf & coastal breeze
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
    }

    // Ocean surf loop
    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = buf;
    surfSrc.loop = true;
    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = "lowpass";
    surfFilter.frequency.value = 340;
    surfGain = ctx.createGain();
    surfGain.gain.value = 0.16;
    surfSrc.connect(surfFilter).connect(surfGain).connect(masterGain);
    surfSrc.start();

    // Apparent headwind loop
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 520;
    windFilter.Q.value = 1.4;
    windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    windSrc.connect(windFilter).connect(windGain).connect(masterGain);
    windSrc.start();
  }

  function unlock() {
    ensureGraph();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function setMuted(flag) {
    muted = Boolean(flag);
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.04);
    }
  }

  function getMuted() {
    return muted;
  }

  function ringBell() {
    unlock();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // Authentic dual-strike vintage brass bicycle bell ("bring-bring!")
    for (const offset of [0, 0.115]) {
      const partials = [
        [1318, 0.22, 0.95],
        [2695, 0.14, 0.65],
        [4210, 0.09, 0.42],
        [5840, 0.05, 0.22],
      ];
      for (const [freq, amp, dur] of partials) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + offset);
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.linearRampToValueAtTime(amp, now + offset + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
        osc.connect(g).connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.02);
      }
    }
  }

  function honkPelican() {
    unlock();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // Comical nasal reed formant + elastic pouch slap
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(245, now);
    osc.frequency.exponentialRampToValueAtTime(168, now + 0.34);

    filt.type = "bandpass";
    filt.frequency.setValueAtTime(680, now);
    filt.frequency.linearRampToValueAtTime(460, now + 0.34);
    filt.Q.value = 4.2;

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(filt).connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  function playSplashAndCatch() {
    unlock();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // Joyful two-note catch chime
    for (const [note, delay] of [[587.33, 0], [880, 0.08]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note, now + delay);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(0.2, now + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      osc.connect(g).connect(masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    }
  }

  function playWingFlap() {
    unlock();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.24);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  function playFreehubTick() {
    if (!ctx || muted || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2950, now);
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.012);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.015);
  }

  function update(state = {}) {
    if (!ctx || ctx.state !== "running" || muted) return;
    const dt = state.dt ?? 0.016;
    const speed = state.speedMps ?? 0;
    const windInt = state.windIntensity ?? 0.35;

    if (windGain && windFilter) {
      const targetWind = Math.min(0.24, 0.02 + (speed / 16) * 0.14 * (0.7 + windInt));
      windGain.gain.setTargetAtTime(targetWind, ctx.currentTime, 0.08);
      windFilter.frequency.setTargetAtTime(360 + speed * 42, ctx.currentTime, 0.08);
    }
    if (surfGain) {
      const surfMod = 0.13 + 0.05 * Math.sin(ctx.currentTime * 0.55);
      surfGain.gain.setTargetAtTime(surfMod, ctx.currentTime, 0.12);
    }

    // Crisp metallic bicycle freehub pawl clicking when coasting or soft-pedaling!
    if (speed > 1.8) {
      const rateHz = state.isCoasting ? speed * 3.1 : speed * 0.9;
      clickTimer += dt * rateHz;
      if (clickTimer >= 1) {
        clickTimer %= 1;
        playFreehubTick();
      }
    }
  }

  return {
    unlock,
    setMuted,
    getMuted,
    ringBell,
    honkPelican,
    playSplashAndCatch,
    playWingFlap,
    update,
  };
}
