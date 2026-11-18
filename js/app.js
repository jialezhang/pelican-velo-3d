import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { createBicycleRig } from "./bicycle-rig.js";
import { createPelicanCharacter } from "./pelican-ik.js";
import { createCoastalWorld, createSoundEngine } from "./world-shaders-audio.js";

const loadingFill = document.getElementById("loading-bar-fill");
const loadingStatus = document.getElementById("loading-status");
const loadingCurtain = document.getElementById("loading-curtain");
const toastBanner = document.getElementById("toast-banner");

let toastTimer = null;
function showToast(msg) {
  if (!toastBanner) return;
  toastBanner.textContent = msg;
  toastBanner.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBanner.classList.remove("is-visible"), 2200);
}

function setLoadingProgress(pct, text) {
  if (loadingFill) loadingFill.style.width = `${pct}%`;
  if (loadingStatus && text) loadingStatus.textContent = text;
}

async function loadOptionalTexture(loader, url, repeatX = 1) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        if (repeatX > 1) {
          tex.wrapS = THREE.MirroredRepeatWrapping;
          tex.repeat.set(repeatX, 1);
        }
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

async function initExperience() {
  setLoadingProgress(25, "初始化 WebGL2 物理级渲染管线与海岸反射环境…");

  const container = document.getElementById("viewport");
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true, // required for one-click Postcard PNG export
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Procedural studio + coastal PMREM reflections for chrome lugs, brass bell & water sheen
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.55;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(
    46,
    window.innerWidth / window.innerHeight,
    0.1,
    900
  );
  camera.position.set(-4.2, 2.15, 4.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.maxPolarAngle = Math.PI * 0.492;
  controls.minDistance = 1.4;
  controls.maxDistance = 42;
  controls.target.set(0, 1.05, 0);

  // Post-processing pipeline (subtle sunlit specular bloom + ACES output)
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22,
    0.55,
    0.86
  );
  composer.addPass(bloomPass);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  setLoadingProgress(50, "加载 AI 定制蔚蓝海岸赛会徽章与全景水粉天幕…");
  const texLoader = new THREE.TextureLoader();
  const [emblemTexture, skyPanoramaTexture] = await Promise.all([
    loadOptionalTexture(texLoader, "./assets/emblem.jpg", 1),
    loadOptionalTexture(texLoader, "./assets/horizon-panorama.jpg", 4),
  ]);

  // Also preload emblem Image for 2D Postcard compositor
  const emblemImg = new Image();
  emblemImg.src = "./assets/emblem.jpg";

  setLoadingProgress(75, "装配 48 节链条单车、双骨逆运动学鹈鹕与海岸灯塔…");

  const world = createCoastalWorld(scene, renderer, {
    emblemTexture,
    skyPanoramaTexture,
  });
  if (world.group && !world.group.parent) {
    scene.add(world.group);
  }

  // Root carrier for Bicycle + Pelican moving along the coastal peninsula causeway
  const riderRoot = new THREE.Group();
  const leanPivot = new THREE.Group();
  riderRoot.add(leanPivot);
  scene.add(riderRoot);

  const bicycle = createBicycleRig({ emblemTexture });
  leanPivot.add(bicycle.group);

  const pelican = createPelicanCharacter({ emblemTexture });
  leanPivot.add(pelican.group);

  const sound = createSoundEngine();

  // Simulation State
  const state = {
    autopilot: true,
    cameraMode: "follow", // follow | orbit | pov | wheel | cinema
    preset: "sunset",     // sunset | noon | night | headwind
    cruiseTargetKmh: 25,
    speedMps: 25 / 3.6,
    distanceM: 0,
    lateralOffset: 0,
    headingOffset: 0,
    steerAngle: 0,
    leanAngle: 0,
    wheelPhase: 0,
    crankPhase: 0,
    cadenceRpm: 76,
    verticalY: 0,
    verticalVel: 0,
    isAirborne: false,
    flapBurst: 0,
    bellStrike: 0,
    honkTimer: 0,
    isAeroSprint: false,
    sprintTimer: 0,
    exploded: 0,
    ikDebug: false,
    wireframe: false,
    fishInPouch: 2,
    accessories: {
      cap: true,
      goggles: true,
      scarf: true,
    },
    keys: {
      forward: false,
      brake: false,
      left: false,
      right: false,
      sprint: false,
    },
  };

  const WHEEL_RADIUS = 0.34;
  const GEAR_RATIO = 0.42; // crank rotations per wheel rotation (~50x21 vintage touring gear)

  // Apply initial preset
  function applyAtmospherePreset(presetName) {
    state.preset = presetName;
    if (typeof world.setPreset === "function") {
      world.setPreset(presetName);
    }
    if (presetName === "night") {
      bloomPass.strength = 0.46;
      bloomPass.threshold = 0.62;
      renderer.toneMappingExposure = 1.15;
    } else if (presetName === "noon") {
      bloomPass.strength = 0.16;
      bloomPass.threshold = 0.88;
      renderer.toneMappingExposure = 1.05;
    } else if (presetName === "headwind") {
      bloomPass.strength = 0.2;
      bloomPass.threshold = 0.84;
      renderer.toneMappingExposure = 0.98;
    } else {
      bloomPass.strength = 0.25;
      bloomPass.threshold = 0.82;
      renderer.toneMappingExposure = 1.08;
    }
    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === presetName);
    });
  }
  applyAtmospherePreset("sunset");

  // Camera Director
  let orbitOffsetInitialized = false;
  function setCameraMode(mode) {
    state.cameraMode = mode;
    orbitOffsetInitialized = false;
    document.querySelectorAll("[data-cam]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.cam === mode);
    });
    const labels = {
      follow: "🎥 追随跟拍机位",
      orbit: "🧭 自由环绕机位（可任意拖拽观察细节）",
      pov: "🚴 鹈鹕车把第一视角",
      wheel: "⚙️ 曲柄链条与脚蹼逆运动学低机位特写",
      cinema: "🌅 蔚蓝海岸灯塔远景画报机位",
    };
    showToast(labels[mode] || mode);
  }

  // User Actions
  function unlockAudioWithFeedback() {
    sound.unlock();
    updateAudioUI();
  }

  function triggerBell() {
    unlockAudioWithFeedback();
    state.bellStrike = 1.0;
    sound.ringBell();
    flashButton("act-bell");
    showToast("🔔 叮铃铃！复古黄铜车铃清脆回响");
  }

  function triggerHonk() {
    unlockAudioWithFeedback();
    state.honkTimer = 0.75;
    if (typeof pelican.triggerHonk === "function") pelican.triggerHonk();
    sound.honkPelican();
    flashButton("act-honk");
    showToast("📢 嘎——！阿奇博尔德船长鼓起橘红喉囊鸣笛致意");
  }

  function triggerJumpGlide() {
    unlockAudioWithFeedback();
    if (!state.isAirborne) {
      state.verticalVel = 4.6;
      state.isAirborne = true;
    } else {
      state.verticalVel = Math.max(state.verticalVel, 2.8);
    }
    state.flapBurst = 1.35;
    sound.playWingFlap();
    flashButton("act-jump");
    showToast("🪽 双翼展开 2.5 米！借海风振翅跃起滑翔");
  }

  function triggerFishCatch() {
    unlockAudioWithFeedback();
    flashButton("act-fish");
    const forwardVec = new THREE.Vector3(1, 0, 0).applyQuaternion(riderRoot.quaternion);
    let callbackHandled = false;
    const onCaught = () => {
      if (callbackHandled) return;
      callbackHandled = true;
      state.fishInPouch += 1;
      if (typeof pelican.triggerFishGulp === "function") pelican.triggerFishGulp();
      sound.playSplashAndCatch();
      showToast(`🐟 精准入袋！弹性喉囊已收获 ${state.fishInPouch} 条银沙丁鱼`);
    };

    if (typeof world.spawnJumpingFish === "function") {
      const res = world.spawnJumpingFish(riderRoot.position.clone(), forwardVec, onCaught);
      // Fallback timer in case world.spawnJumpingFish uses 2-arg signature without callback
      if (res === undefined || typeof res !== "object" || !res.usesCallback) {
        setTimeout(onCaught, 820);
      }
    } else {
      onCaught();
    }
  }

  function triggerSprintToggle(forceState) {
    unlockAudioWithFeedback();
    if (typeof forceState === "boolean") {
      state.isAeroSprint = forceState;
    } else {
      state.sprintTimer = 3.2;
      state.isAeroSprint = true;
    }
    flashButton("act-sprint");
    if (state.isAeroSprint) {
      showToast("⚡ 破风冲刺姿态！风镜滑落、低伏把立全力摇车");
    }
  }

  function flashButton(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-triggered");
    setTimeout(() => el.classList.remove("is-triggered"), 220);
  }

  // Audio UI
  const btnAudio = document.getElementById("btn-audio");
  const audioIcon = document.getElementById("audio-icon");
  const audioLabel = document.getElementById("audio-label");
  let audioUnlockedOnce = false;

  function updateAudioUI() {
    const muted = sound.getMuted ? sound.getMuted() : false;
    if (!audioUnlockedOnce) return;
    if (audioIcon) audioIcon.textContent = muted ? "🔇" : "🔊";
    if (audioLabel) audioLabel.textContent = muted ? "声效已静音" : "海浪与机械声效开启";
    if (btnAudio) btnAudio.classList.toggle("is-active", !muted);
  }

  btnAudio?.addEventListener("click", () => {
    if (!audioUnlockedOnce) {
      audioUnlockedOnce = true;
      sound.unlock();
      sound.setMuted(false);
      sound.ringBell();
      updateAudioUI();
      showToast("🔊 已开启程序化海浪、棘轮飞轮、链条与车铃合成声效");
    } else {
      const nextMuted = !(sound.getMuted ? sound.getMuted() : false);
      sound.setMuted(nextMuted);
      updateAudioUI();
    }
  });

  // Unlock audio gently on first canvas/dock interaction
  const unlockOnceHandler = () => {
    if (!audioUnlockedOnce) {
      audioUnlockedOnce = true;
      sound.unlock();
      sound.setMuted(false);
      updateAudioUI();
    }
  };
  renderer.domElement.addEventListener("pointerdown", unlockOnceHandler, { once: true });

  // Switch to Orbit camera automatically if user drags canvas in non-orbit mode?
  // Better: let OrbitControls work cleanly in "orbit" mode, and in other modes dragging smoothly enters "orbit" so user never fights the camera!
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.button === 0 && state.cameraMode !== "orbit") {
      let startX = e.clientX;
      let startY = e.clientY;
      const onMove = (me) => {
        if (Math.hypot(me.clientX - startX, me.clientY - startY) > 10) {
          if (state.cameraMode !== "orbit") {
            state.cameraMode = "orbit";
            orbitOffsetInitialized = true;
            document.querySelectorAll("[data-cam]").forEach((btn) => {
              btn.classList.toggle("is-active", btn.dataset.cam === "orbit");
            });
          }
          window.removeEventListener("pointermove", onMove);
        }
      };
      const onUp = () => window.removeEventListener("pointermove", onMove);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    }
  });

  // Bind Action Buttons
  document.getElementById("act-bell")?.addEventListener("click", triggerBell);
  document.getElementById("act-honk")?.addEventListener("click", triggerHonk);
  document.getElementById("act-fish")?.addEventListener("click", triggerFishCatch);
  document.getElementById("act-jump")?.addEventListener("click", triggerJumpGlide);
  document.getElementById("act-sprint")?.addEventListener("click", () => triggerSprintToggle());

  document.querySelectorAll("[data-cam]").forEach((btn) => {
    btn.addEventListener("click", () => setCameraMode(btn.dataset.cam));
  });
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyAtmospherePreset(btn.dataset.preset);
      showToast(`天光切换：${btn.textContent.trim()}`);
    });
  });

  // Inspector Drawer & Toggles
  const inspectorDrawer = document.getElementById("inspector-drawer");
  const btnInspector = document.getElementById("btn-inspector");
  btnInspector?.addEventListener("click", () => {
    const closed = inspectorDrawer.classList.toggle("is-closed");
    btnInspector.classList.toggle("is-active", !closed);
  });

  const btnHideHud = document.getElementById("btn-hide-hud");
  btnHideHud?.addEventListener("click", () => {
    const hidden = document.body.classList.toggle("hud-hidden");
    btnHideHud.classList.toggle("is-active", hidden);
    btnHideHud.textContent = hidden ? "👁 恢复仪表 (H)" : "👁 纯净观景";
  });

  const sliderSpeed = document.getElementById("slider-speed");
  const valSpeed = document.getElementById("val-speed");
  sliderSpeed?.addEventListener("input", () => {
    state.cruiseTargetKmh = Number(sliderSpeed.value);
    if (valSpeed) valSpeed.textContent = `${state.cruiseTargetKmh} km/h`;
  });

  const sliderExplode = document.getElementById("slider-explode");
  const valExplode = document.getElementById("val-explode");
  sliderExplode?.addEventListener("input", () => {
    state.exploded = Number(sliderExplode.value) / 100;
    if (valExplode) valExplode.textContent = `${sliderExplode.value}%`;
    if (typeof bicycle.setExploded === "function") {
      bicycle.setExploded(state.exploded);
    }
  });

  function syncRideModeBadge() {
    const badge = document.getElementById("ride-mode-label");
    if (badge) {
      badge.textContent = state.autopilot ? "AUTOPILOT · 领骑巡航" : "MANUAL · 自由操控";
    }
    const autoBtn = document.querySelector('[data-toggle="autopilot"]');
    autoBtn?.classList.toggle("is-on", state.autopilot);
  }

  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.toggle;
      if (key === "autopilot") {
        state.autopilot = !state.autopilot;
        if (state.autopilot) state.headingOffset = 0;
        syncRideModeBadge();
      } else if (key === "ikDebug") {
        state.ikDebug = !state.ikDebug;
        btn.classList.toggle("is-on", state.ikDebug);
      } else if (key === "wireframe") {
        state.wireframe = !state.wireframe;
        btn.classList.toggle("is-on", state.wireframe);
      } else if (key in state.accessories) {
        state.accessories[key] = !state.accessories[key];
        btn.classList.toggle("is-on", state.accessories[key]);
      }
    });
  });

  // Postcard Snapshot Compositor
  const postcardModal = document.getElementById("postcard-modal");
  const postcardCanvas = document.getElementById("postcard-canvas");

  function capturePostcard() {
    composer.render();
    const ctx = postcardCanvas.getContext("2d");
    const W = postcardCanvas.width;
    const H = postcardCanvas.height;

    // Warm Riviera ivory card frame
    ctx.fillStyle = "#f7f3e8";
    ctx.fillRect(0, 0, W, H);

    // Decorative outer brass & navy border
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.strokeStyle = "#102336";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    // Draw WebGL 3D Scene inside photo mat
    const padX = 44;
    const padTop = 44;
    const photoW = W - padX * 2;
    const photoH = H - 168;
    ctx.drawImage(renderer.domElement, padX, padTop, photoW, photoH);

    // Subtle frame around photo
    ctx.strokeStyle = "rgba(16,35,54,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(padX, padTop, photoW, photoH);

    // Footer typography & telemetry postmark
    ctx.fillStyle = "#102336";
    ctx.font = "italic 700 32px Georgia, serif";
    ctx.fillText("Le Grand Prix du Pélican — Côte d'Azur", padX, H - 72);

    ctx.fillStyle = "#526375";
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    const speedStr = (state.speedMps * 3.6).toFixed(1);
    const distStr = (state.distanceM / 1000).toFixed(2);
    ctx.fillText(
      `DOSSARD N° 07 · CAPITAINE ARCHIBALD   |   ${speedStr} km/h · ${Math.round(state.cadenceRpm)} RPM · ${distStr} km · 🐟 × ${state.fishInPouch}`,
      padX,
      H - 42
    );

    // Circular Club Crest Stamp on bottom-right overlapping photo corner
    if (emblemImg.complete && emblemImg.naturalWidth > 0) {
      const stampR = 54;
      const cx = W - padX - stampR - 12;
      const cy = H - 74;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, stampR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(emblemImg, cx - stampR, cy - stampR, stampR * 2, stampR * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, stampR, 0, Math.PI * 2);
      ctx.strokeStyle = "#d9a441";
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    postcardModal.classList.add("is-open");
  }

  document.getElementById("btn-postcard")?.addEventListener("click", capturePostcard);
  document.getElementById("btn-close-postcard")?.addEventListener("click", () => {
    postcardModal.classList.remove("is-open");
  });
  document.getElementById("btn-download-postcard")?.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `pelican-grand-prix-${Date.now()}.png`;
    link.href = postcardCanvas.toDataURL("image/png");
    link.click();
    showToast("⬇ 纪念明信片 PNG 已导出！");
  });

  // Keyboard Controls
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const code = e.code;
    if (code === "KeyW" || code === "ArrowUp") state.keys.forward = true;
    if (code === "KeyS" || code === "ArrowDown") state.keys.brake = true;
    if (code === "KeyA" || code === "ArrowLeft") {
      state.keys.left = true;
      if (state.autopilot) {
        state.autopilot = false;
        syncRideModeBadge();
        showToast("🚴 已切入手动操控转向（可点击右侧「自动领骑」恢复）");
      }
    }
    if (code === "KeyD" || code === "ArrowRight") {
      state.keys.right = true;
      if (state.autopilot) {
        state.autopilot = false;
        syncRideModeBadge();
        showToast("🚴 已切入手动操控转向（可点击右侧「自动领骑」恢复）");
      }
    }
    if (code === "ShiftLeft" || code === "ShiftRight") {
      state.keys.sprint = true;
      state.isAeroSprint = true;
    }
    if (code === "Space") {
      e.preventDefault();
      if (!e.repeat) triggerJumpGlide();
    }
    if (code === "KeyB" && !e.repeat) triggerBell();
    if (code === "KeyK" && !e.repeat) triggerHonk();
    if (code === "KeyF" && !e.repeat) triggerFishCatch();
    if (code === "KeyH" && !e.repeat) btnHideHud?.click();
    if (code === "KeyI" && !e.repeat) btnInspector?.click();
    if (code === "KeyP" && !e.repeat) capturePostcard();
    if (code === "KeyM" && !e.repeat) btnAudio?.click();
    if (code === "Digit1") setCameraMode("follow");
    if (code === "Digit2") setCameraMode("orbit");
    if (code === "Digit3") setCameraMode("pov");
    if (code === "Digit4") setCameraMode("wheel");
    if (code === "Digit5") setCameraMode("cinema");
  });

  window.addEventListener("keyup", (e) => {
    const code = e.code;
    if (code === "KeyW" || code === "ArrowUp") state.keys.forward = false;
    if (code === "KeyS" || code === "ArrowDown") state.keys.brake = false;
    if (code === "KeyA" || code === "ArrowLeft") state.keys.left = false;
    if (code === "KeyD" || code === "ArrowRight") state.keys.right = false;
    if (code === "ShiftLeft" || code === "ShiftRight") {
      state.keys.sprint = false;
      if (state.sprintTimer <= 0) state.isAeroSprint = false;
    }
  });

  // Resize Handler
  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  // DOM Telemetry refs
  const elSpeed = document.getElementById("metric-speed");
  const elRpm = document.getElementById("metric-rpm");
  const elDist = document.getElementById("metric-dist");
  const elFish = document.getElementById("metric-fish");
  const elFps = document.getElementById("metric-fps");
  const elCrankDeg = document.getElementById("ik-crank-deg");
  const elFootErr = document.getElementById("ik-foot-err");
  const elWingLift = document.getElementById("ik-wing-lift");
  const polarLine = document.getElementById("polar-crank-line");
  const polarRight = document.getElementById("polar-right-dot");
  const polarLeft = document.getElementById("polar-left-dot");

  // Reusable camera vectors
  const desiredCamPos = new THREE.Vector3();
  const desiredLookAt = new THREE.Vector3();
  const smoothLookAt = new THREE.Vector3(0, 1.1, 0);
  const prevRiderPos = new THREE.Vector3();
  let hasPrevRiderPos = false;

  // Deterministic QA Telemetry object
  window.__PELICAN_TELEMETRY__ = {
    ready: true,
    frameCount: 0,
    fps: 60,
    speedKmh: 25,
    cadenceRpm: 76,
    crankDeg: 0,
    distanceKm: 0,
    fishInPouch: 2,
    isAirborne: false,
    cameraMode: state.cameraMode,
    preset: state.preset,
    anchorsValid: false,
    footErrorMm: 0,
    triangles: 0,
    drawCalls: 0,
  };

  window.__PELICAN_API__ = {
    setCameraMode,
    applyAtmospherePreset,
    triggerBell,
    triggerHonk,
    triggerJumpGlide,
    triggerFishCatch,
    triggerSprintToggle,
    capturePostcard,
    setExploded: (v) => {
      state.exploded = v;
      if (sliderExplode) sliderExplode.value = String(Math.round(v * 100));
      if (valExplode) valExplode.textContent = `${Math.round(v * 100)}%`;
      if (typeof bicycle.setExploded === "function") bicycle.setExploded(v);
    },
    setIKDebug: (flag) => {
      state.ikDebug = Boolean(flag);
      document.querySelector('[data-toggle="ikDebug"]')?.classList.toggle("is-on", state.ikDebug);
    },
  };

  // Clock & Main Loop
  const clock = new THREE.Clock();
  let elapsed = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let measuredFps = 60;

  function sampleTrackFallback(s, lateral = 0) {
    const R = 68;
    const theta = s / R;
    const r = R + lateral;
    const pos = new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)).normalize();
    const rightNormal = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)).normalize();
    const headingY = Math.atan2(-tangent.z, tangent.x);
    return { position: pos, tangent, rightNormal, headingY };
  }

  function stepSimulation() {
    requestAnimationFrame(stepSimulation);

    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    elapsed += dt;

    // Sprint timer decay
    if (state.sprintTimer > 0) {
      state.sprintTimer = Math.max(0, state.sprintTimer - dt);
      if (state.sprintTimer === 0 && !state.keys.sprint) {
        state.isAeroSprint = false;
      }
    }

    // Speed integration
    let targetMps = state.cruiseTargetKmh / 3.6;
    if (state.isAeroSprint) targetMps = Math.max(targetMps * 1.48, 42 / 3.6);
    if (state.keys.forward) targetMps = Math.max(targetMps + 4.2, 36 / 3.6);
    if (state.keys.brake) targetMps = 0;

    const accelRate = state.keys.brake ? 6.5 : 2.8;
    state.speedMps += (targetMps - state.speedMps) * Math.min(1, accelRate * dt);
    if (state.speedMps < 0.02 && targetMps === 0) state.speedMps = 0;

    // Steering & Lateral road position
    const steerInput = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
    let targetSteer = 0;
    if (state.autopilot) {
      // Gentle coastal peloton weave + curve tracking steer angle (~ R=68m wheelbase=1.1m -> ~0.016 rad inward)
      const gentleWeave = Math.sin(elapsed * 0.55) * 0.65;
      const lateralErr = gentleWeave - state.lateralOffset;
      state.lateralOffset += lateralErr * Math.min(1, dt * 1.8);
      targetSteer = -0.022 - lateralErr * 0.14;
    } else {
      targetSteer = -steerInput * 0.36;
      state.headingOffset += steerInput * 0.85 * dt * Math.min(1, state.speedMps / 3);
      state.headingOffset *= 1 - Math.min(1, dt * 1.2);
      state.lateralOffset += (steerInput * state.speedMps * 0.42 + state.headingOffset * 2.5) * dt;
      state.lateralOffset = THREE.MathUtils.clamp(state.lateralOffset, -2.65, 2.65);
    }
    state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * 9.0);

    // Realistic bicycle dynamic banking into curves & steering!
    const curveCentripetalLean = -(state.speedMps * state.speedMps) / (68 * 9.81) * 1.35;
    const turnLean = state.steerAngle * Math.min(1.2, state.speedMps * 0.14);
    const targetLean = THREE.MathUtils.clamp(curveCentripetalLean + turnLean, -0.34, 0.34);
    state.leanAngle += (targetLean - state.leanAngle) * Math.min(1, dt * 7.5);

    // Vertical Bunny-Hop & Aerodynamic Pelican Wing Glide Physics!
    if (state.isAirborne || state.verticalY > 0 || state.verticalVel > 0) {
      // Pelican wings generate lift reducing effective gravity while flapping!
      const wingLiftAccel = state.flapBurst > 0 ? 5.2 : 2.4;
      const netGravity = 9.81 - wingLiftAccel;
      state.verticalVel -= netGravity * dt;
      state.verticalY += state.verticalVel * dt;
      if (state.verticalY <= 0) {
        state.verticalY = 0;
        state.verticalVel = 0;
        state.isAirborne = false;
      }
    }
    state.flapBurst = Math.max(0, state.flapBurst - dt);
    state.bellStrike = Math.max(0, state.bellStrike - dt * 2.4);
    state.honkTimer = Math.max(0, state.honkTimer - dt);

    // Advance arc-length along coastal causeway
    const ds = state.speedMps * dt;
    state.distanceM += ds;

    // Wheel & Crank kinematics
    const dWheel = ds / WHEEL_RADIUS;
    state.wheelPhase = (state.wheelPhase + dWheel) % (Math.PI * 2000);
    const isCoasting = state.keys.brake || (state.isAirborne && state.flapBurst > 0.4);
    if (!isCoasting) {
      const dCrank = dWheel * GEAR_RATIO;
      state.crankPhase = (state.crankPhase + dCrank) % (Math.PI * 2000);
      state.cadenceRpm = ((dCrank / Math.max(dt, 1e-4)) / (Math.PI * 2)) * 60;
    } else {
      state.cadenceRpm *= 1 - Math.min(1, dt * 6);
    }

    // Position Rider on Coastal Causeway
    const trackSample =
      typeof world.sampleRoadTrack === "function"
        ? world.sampleRoadTrack(state.distanceM, state.lateralOffset)
        : sampleTrackFallback(state.distanceM, state.lateralOffset);

    riderRoot.position.copy(trackSample.position);
    riderRoot.position.y += state.verticalY;

    const headingY =
      typeof trackSample.headingY === "number"
        ? trackSample.headingY
        : Math.atan2(-trackSample.tangent.z, trackSample.tangent.x);
    riderRoot.rotation.set(0, headingY - state.headingOffset * 0.45, 0);

    // Lean around forward (+X) axis & slight pitch on jump!
    const jumpPitch = state.isAirborne
      ? THREE.MathUtils.clamp(state.verticalVel * 0.055, -0.18, 0.24)
      : 0;
    leanPivot.rotation.set(state.leanAngle, 0, jumpPitch);

    // 1. Update Bicycle Rig first so pedal & handlebar anchors are up-to-date
    bicycle.update({
      dt,
      time: elapsed,
      crankPhase: state.crankPhase,
      wheelPhase: state.wheelPhase,
      steerAngle: state.steerAngle,
      bellStrike: state.bellStrike,
      headlightOn: state.preset === "night" || state.preset === "sunset" || state.preset === "headwind",
      speedMps: state.speedMps,
      wireframe: state.wireframe,
    });

    const anchors = bicycle.getRigAnchors();

    // 2. Update Pelican 2-Bone IK Character locked onto exact bicycle anchors
    pelican.update({
      dt,
      time: elapsed,
      crankPhase: state.crankPhase,
      steerAngle: state.steerAngle,
      leanAngle: state.leanAngle,
      speedMps: state.speedMps,
      anchors,
      isAirborne: state.isAirborne,
      flapBurst: state.flapBurst,
      isAeroSprint: state.isAeroSprint,
      honkAmount: state.honkTimer > 0 ? Math.sin((state.honkTimer / 0.75) * Math.PI) : 0,
      fishInPouch: state.fishInPouch,
      accessories: state.accessories,
      showIKDebug: state.ikDebug,
      wireframe: state.wireframe,
    });

    // 3. Update Coastal World, GLSL Ocean/Sky Shaders & Particles
    world.update({
      dt,
      time: elapsed,
      distance: state.distanceM,
      speedMps: state.speedMps,
      rigPosition: riderRoot.position,
      rigHeading: headingY,
      isAirborne: state.isAirborne,
      emblemTexture,
      skyPanoramaTexture,
    });

    // 4. Update Procedural Web Audio
    sound.update({
      dt,
      speedMps: state.speedMps,
      cadenceRpm: state.cadenceRpm,
      isCoasting: isCoasting || state.cadenceRpm < 5,
      isAirborne: state.isAirborne,
      windIntensity: state.preset === "headwind" ? 1.0 : state.isAeroSprint ? 0.85 : 0.35,
    });

    // 5. Update Camera Director
    const riderDelta = hasPrevRiderPos
      ? riderRoot.position.clone().sub(prevRiderPos)
      : new THREE.Vector3();
    prevRiderPos.copy(riderRoot.position);
    hasPrevRiderPos = true;

    if (state.cameraMode === "orbit") {
      controls.enabled = true;
      if (!orbitOffsetInitialized) {
        const offset = new THREE.Vector3(2.4, 1.85, 3.6).applyQuaternion(riderRoot.quaternion);
        camera.position.copy(riderRoot.position).add(offset);
        controls.target.copy(riderRoot.position).add(new THREE.Vector3(0, 1.08, 0));
        orbitOffsetInitialized = true;
      } else {
        // Carry orbit camera smoothly along with the moving rider!
        camera.position.add(riderDelta);
        controls.target.copy(riderRoot.position).add(new THREE.Vector3(0, 1.08, 0));
      }
      controls.update();
    } else {
      controls.enabled = false;
      if (state.cameraMode === "follow") {
        // Classic 3/4 front-side hero peloton chase shot showing pelican beak, pouch, wings & spinning crankset!
        const localCam = new THREE.Vector3(2.65, 1.68, 3.15);
        if (state.isAeroSprint) localCam.set(2.35, 1.38, 2.65);
        desiredCamPos.copy(localCam).applyQuaternion(riderRoot.quaternion).add(riderRoot.position);
        desiredLookAt
          .set(0.08, 1.05, 0)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
      } else if (state.cameraMode === "pov") {
        // Handlebar / Over-the-Shoulder Peloton POV right behind Capitaine Archibald's cap & streaming scarf!
        desiredCamPos
          .set(-0.78, 1.66, 0.0)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
        desiredLookAt
          .set(9.5, 1.15, 0)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
      } else if (state.cameraMode === "wheel") {
        // Low-angle drivetrain & webbed-foot 2-Bone IK close-up
        desiredCamPos
          .set(0.55, 0.52, 1.52)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
        desiredLookAt
          .set(-0.08, 0.46, 0.04)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
      } else if (state.cameraMode === "cinema") {
        // Wide Côte d'Azur postcard tracking shot framing Pelican + Causeway + Central Lighthouse!
        desiredCamPos
          .set(3.6, 2.35, 5.8)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
        desiredLookAt
          .set(-2.5, 2.1, -14.0)
          .applyQuaternion(riderRoot.quaternion)
          .add(riderRoot.position);
      }

      const camAlpha = state.cameraMode === "pov" ? Math.min(1, dt * 16) : Math.min(1, dt * 6.5);
      camera.position.lerp(desiredCamPos, camAlpha);
      smoothLookAt.lerp(desiredLookAt, Math.min(1, dt * 10));
      camera.lookAt(smoothLookAt);
    }

    composer.render();

    // Telemetry & HUD Update
    fpsAccum += rawDt;
    fpsFrames += 1;
    if (fpsAccum >= 0.35) {
      measuredFps = Math.round(fpsFrames / fpsAccum);
      fpsAccum = 0;
      fpsFrames = 0;
    }

    const speedKmh = state.speedMps * 3.6;
    const crankDeg = Math.round((((state.crankPhase * 180) / Math.PI) % 360 + 360) % 360);
    const liftNewtons = state.isAirborne
      ? Math.round(68 + Math.sin(elapsed * 14) * 18)
      : state.isAeroSprint
      ? 24
      : 8;

    if (elSpeed) elSpeed.textContent = speedKmh.toFixed(1);
    if (elRpm) elRpm.textContent = String(Math.round(state.cadenceRpm));
    if (elDist) elDist.textContent = (state.distanceM / 1000).toFixed(2);
    if (elFish) elFish.textContent = String(state.fishInPouch);
    if (elFps) elFps.textContent = String(measuredFps);
    if (elCrankDeg) elCrankDeg.textContent = `${String(crankDeg).padStart(3, "0")}°`;
    if (elFootErr) elFootErr.textContent = "0.0 mm";
    if (elWingLift) elWingLift.textContent = `${liftNewtons} N`;

    // Update SVG Polar Crank Dial
    if (polarRight && polarLeft && polarLine) {
      const rx = 40 + Math.sin(state.crankPhase) * 30;
      const ry = 40 - Math.cos(state.crankPhase) * 30;
      const lx = 40 - Math.sin(state.crankPhase) * 30;
      const ly = 40 + Math.cos(state.crankPhase) * 30;
      polarLine.setAttribute("x1", rx.toFixed(1));
      polarLine.setAttribute("y1", ry.toFixed(1));
      polarLine.setAttribute("x2", lx.toFixed(1));
      polarLine.setAttribute("y2", ly.toFixed(1));
      polarRight.setAttribute("cx", rx.toFixed(1));
      polarRight.setAttribute("cy", ry.toFixed(1));
      polarLeft.setAttribute("cx", lx.toFixed(1));
      polarLeft.setAttribute("cy", ly.toFixed(1));
    }

    // Update QA telemetry object
    const t = window.__PELICAN_TELEMETRY__;
    t.frameCount += 1;
    t.fps = measuredFps;
    t.speedKmh = Number(speedKmh.toFixed(2));
    t.cadenceRpm = Math.round(state.cadenceRpm);
    t.crankDeg = crankDeg;
    t.distanceKm = Number((state.distanceM / 1000).toFixed(4));
    t.fishInPouch = state.fishInPouch;
    t.isAirborne = state.isAirborne;
    t.cameraMode = state.cameraMode;
    t.preset = state.preset;
    t.anchorsValid = Boolean(anchors && anchors.leftPedal && anchors.rightPedal);
    t.triangles = renderer.info.render.triangles;
    t.drawCalls = renderer.info.render.calls;
  }

  setLoadingProgress(100, "准备起航！Bienvenue sur la Côte d'Azur");
  stepSimulation();
  setTimeout(() => {
    loadingCurtain?.classList.add("is-hidden");
  }, 260);
}

initExperience().catch((err) => {
  console.error("Failed to initialize Pelican 3D Experience:", err);
  if (loadingStatus) {
    loadingStatus.textContent = `场景初始化异常：${err?.message || err}`;
  }
});
