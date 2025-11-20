import React, { useEffect, useRef, Suspense, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { AnimationMixer, Vector3, MathUtils, Quaternion, Euler } from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

// Takram Libraries
import { AerialPerspective, Atmosphere } from '@takram/three-atmosphere/r3f';
import { Clouds, CloudLayer } from '@takram/three-clouds/r3f';
import { Geodetic, PointOfView, radians } from '@takram/three-geospatial';

// 3D Tiles Renderer
import { TilesPlugin, TilesRenderer } from '3d-tiles-renderer/r3f';
import {
  GLTFExtensionsPlugin,
  GoogleCloudAuthPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
  UpdateOnChangePlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

const BASE_URL = import.meta.env.BASE_URL;
const VRM_URL = `${BASE_URL}ai.vrm`;
const VRMA_URL = `${BASE_URL}fly_sky.vrma`;
const EARTH_RADIUS = 6378137;

const WEATHER_INTERVAL = 5 * 60 * 1000;

const TIME_SCALE = 100;

const INITIAL_DATE = new Date('2024-06-21T12:00:00');

// --- Weather Presets (天候設定) ---
const WEATHER_PRESETS = [
  {
    name: 'Clear (快晴)',
    coverage: 0.1,
    layers: [
      { channel: 'r', altitude: 1500, height: 500, densityScale: 0.0 },
      { channel: 'g', altitude: 2500, height: 800, densityScale: 0.0 },
      { channel: 'b', altitude: 7500, height: 500, densityScale: 0.1 },
    ]
  },
  {
    name: 'Sunny (晴れ)',
    coverage: 0.4,
    layers: [
      { channel: 'r', altitude: 1500, height: 500, densityScale: 0.4 },
      { channel: 'g', altitude: 2500, height: 800, densityScale: 0.0 },
      { channel: 'b', altitude: 7500, height: 500, densityScale: 0.2 },
    ]
  },
  {
    name: 'Cloudy (曇り)',
    coverage: 0.75,
    layers: [
      { channel: 'r', altitude: 1500, height: 500, densityScale: 0.6 },
      { channel: 'g', altitude: 2000, height: 1000, densityScale: 0.5 },
      { channel: 'b', altitude: 7500, height: 500, densityScale: 0.0 },
    ]
  }
];

const LOCATIONS = [
  { name: 'Tokyo', longitude: 139.7671, latitude: 35.6812, heading: 180, pitch: -5, distance: 1100 },
  { name: 'Fuji', longitude: 138.7278, latitude: 35.3206, heading: 0, pitch: -10, distance: 4000 },
  { name: 'Space', longitude: 139.7671, latitude: 35.6812, heading: 0, pitch: -90, distance: 100000 },
];

// --- Shared State for Synchronization ---
// 複数のCanvas間で状態を共有するための簡易ストア
const worldState = {
  // 世界座標 (Atmosphere内での位置 - ECEF)
  position: new Vector3(0, EARTH_RADIUS + 100000, 0),
  // ローカル回転 (AvatarLayerでの回転 - Y-up)
  // Note: This is treated as the "Local" quaternion.
  quaternion: new Quaternion(),
  // 移動速度 (m/s)
  speed: 1000.0,
};

// Helper: Calculate Basis Rotation (Alignment to Surface Normal)
function getSurfaceBasis(position) {
  if (!position) return new Quaternion();
  // Debug Geodetic API
  if (!window.geodeticLogged) {
    console.log('Geodetic prototype:', Geodetic.prototype);
    window.geodeticLogged = true;
  }
  const up = position.clone().normalize();
  if (up.lengthSq() < 0.1) return new Quaternion(); // Safety check
  const basis = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up);
  return basis;
}

// Helper: Calculate Ellipsoid Radius at current position (WGS84)
function getEllipsoidRadius(position) {
  const a = 6378137.0;
  const b = 6356752.314245;
  const r = position.length();
  if (r < 100) return a; // Fallback

  // Assuming Z is North in ECEF (Standard)
  const z = position.z;
  const sinPhi = z / r;
  const cosPhi = Math.sqrt(1 - sinPhi * sinPhi);

  const aCos = a * cosPhi;
  const bSin = b * sinPhi;
  const num = (a * aCos) * (a * aCos) + (b * bSin) * (b * bSin);
  const den = (aCos * aCos) + (bSin * bSin);

  return Math.sqrt(num / den);
}

// Teleport Function
function teleportTo(location) {
  const { longitude, latitude, heading, pitch, distance } = location;
  const position = new Vector3();
  const globalQuaternion = new Quaternion(); // Global rotation
  const up = new Vector3(0, 1, 0);

  // 1. Calculate True Position (at target lat/lon and altitude)
  // Treat 'distance' as altitude in meters
  const truePosition = new Geodetic(radians(longitude), radians(latitude), distance).toECEF();

  // 2. Calculate Rotation using PointOfView
  // We use PointOfView to get the correct orientation (looking at the target).
  // We ignore the position calculated by PointOfView because it assumes an orbit/look-at constraint.
  new PointOfView(distance, radians(heading), radians(pitch)).decompose(
    new Geodetic(radians(longitude), radians(latitude)).toECEF(),
    position, // Dummy position (ignored)
    globalQuaternion,
    up
  );

  console.log(`[Teleport] ${location.name} -> Altitude: ${distance}, TruePosLength: ${truePosition.length()}`);

  // 3. Apply True Position
  worldState.position.copy(truePosition);

  // 4. Apply Rotation (Global -> Local)
  // GlobalQ = BasisQ * LocalQ  =>  LocalQ = BasisQ^-1 * GlobalQ
  const basis = getSurfaceBasis(truePosition);
  const basisInv = basis.clone().invert();
  worldState.quaternion.copy(basisInv.multiply(globalQuaternion));
}

// キー入力管理
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false,
  Shift: false,
  Space: false,
};

// キーイベントリスナーの設定
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (e.key === 'Shift') keys.Shift = true;
    if (e.key === ' ') keys.Space = true;
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
    if (e.key === 'Shift') keys.Shift = false;
    if (e.key === ' ') keys.Space = false;
  });
}

// ---------------------------------------------------------
// Scene Components (Inside Canvas)
// ---------------------------------------------------------

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

function GoogleMaps3DTiles() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAP_API_KEY;

  if (!apiKey) return null;

  return (
    <TilesRenderer url={`https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`}>
      <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken: apiKey }} />
      <TilesPlugin plugin={GLTFExtensionsPlugin} dracoLoader={dracoLoader} />
      <TilesPlugin plugin={TileCompressionPlugin} />
      <TilesPlugin plugin={UpdateOnChangePlugin} />
      <TilesPlugin plugin={TilesFadePlugin} />
    </TilesRenderer>
  );
}

// Canvasの内側で動作するメインシーンコンポーネント
function AtmosphereScene() {
  const { gl } = useThree();
  const sunRef = useRef();
  const atmosphereRef = useRef();
  const dateRef = useRef(new Date(INITIAL_DATE));
  const [weather, setWeather] = useState(WEATHER_PRESETS[1]);

  // 1. 露出設定 (Canvas内なのでuseThreeが使える)
  useEffect(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.toneMappingExposure = 10.0;
  }, [gl]);

  // 2. 天候の定期変更
  useEffect(() => {
    const interval = setInterval(() => {
      setWeather(prev => {
        const others = WEATHER_PRESETS.filter(w => w.name !== prev.name);
        const next = others[Math.floor(Math.random() * others.length)];
        console.log(`[Weather] Changing to: ${next.name}`);
        return next;
      });
    }, WEATHER_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // 3. 時間進行と太陽移動 (Canvas内なのでuseFrameが使える)
  //useFrame((state, delta) => {
  //  const currentDate = dateRef.current;
  //  const elapsedMs = delta * TIME_SCALE * 1000;
  //  currentDate.setTime(currentDate.getTime() + elapsedMs);
  //  if (atmosphereRef.current) {
  //    atmosphereRef.current.updateByDate(currentDate);
  //  }
  //  if (sunRef.current) {
  //    const hours = currentDate.getHours() + currentDate.getMinutes() / 60 + currentDate.getSeconds() / 3600;
  //    const sunAngle = MathUtils.mapLinear(hours, 6, 18, 0, Math.PI);
  //    const sunX = -Math.cos(sunAngle);
  //    const sunY = Math.sin(sunAngle);

  //    if (hours < 6 || hours > 18) {
  //      sunRef.current.position.set(0, -1, 0);
  //      sunRef.current.intensity = 10.0;
  //    } else {
  //      sunRef.current.position.set(sunX, sunY, 0.2);
  //      sunRef.current.intensity = MathUtils.lerp(0.5, 3.0, sunY);
  //    }
  //  }
  //});
	useFrame((state, delta) => {
		const currentDate = dateRef.current;
		const elapsedMs = delta * TIME_SCALE * 1000;
		currentDate.setTime(currentDate.getTime() + elapsedMs);

		if (atmosphereRef.current) {
			atmosphereRef.current.updateByDate(currentDate);

			const sunDirection = atmosphereRef.current.sunDirection;

			if (sunRef.current && sunDirection) {

				sunRef.current.position.copy(sunDirection);
				sunRef.current.intensity = 3.0; // 強度は固定で、時間帯による調整はAtmosphereが担当

				if (sunDirection.y < -0.1) {
					sunRef.current.intensity = 0.1;
				}
			}
		}
	});
  return (
    <>
      {/* Camera is controlled by FollowCamera component */}
      <PerspectiveCamera
        makeDefault
        near={10}
        far={10000000}
        fov={45}
      />
      <FollowCamera />

      <directionalLight
        ref={sunRef}
        position={[0, 1, 0]}
        intensity={3.0}
        castShadow
      />

      <Atmosphere ref={atmosphereRef}>
        <GoogleMaps3DTiles />
        <EffectComposer multisampling={0} disableNormalPass={false}>
          <Clouds disableDefaultLayers coverage={weather.coverage}>
            {weather.layers.map((layer, index) => (
              <CloudLayer
                key={index}
                channel={layer.channel}
                altitude={layer.altitude}
                height={layer.height}
                densityScale={layer.densityScale}
                shapeAmount={0.5}
              />
            ))}
          </Clouds>
          <AerialPerspective sky />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Atmosphere>
    </>
  );
}

// Atmosphere側のカメラをShared Stateに同期させる
function FollowCamera() {
  useFrame((state) => {
    if (!worldState.position) return;

    // 1. Calculate Basis Rotation based on current position
    const basis = getSurfaceBasis(worldState.position);

    // 2. Apply Position
    state.camera.position.copy(worldState.position);

    // 3. Apply Rotation: GlobalQ = BasisQ * LocalQ
    // worldState.quaternion is treated as Local Quaternion here
    state.camera.quaternion.copy(basis).multiply(worldState.quaternion);
  });
  return null;
}

// ---------------------------------------------------------
// Scene 2: Avatar
// ---------------------------------------------------------
function VrmCharacter() {
  const mixerRef = useRef(null);
  const vrmRef = useRef(null);
  const { camera } = useThree();
  const actionsRef = useRef({});
  const currentActionRef = useRef(null);

  const gltf = useLoader(GLTFLoader, VRM_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  // Load all animations
  const [vrmaFly, vrmaFlyStop, vrmaFlyIdle] = useLoader(GLTFLoader, [
    `${BASE_URL}fly_sky.vrma`,
    `${BASE_URL}fly_stop.vrma`,
    `${BASE_URL}fly_idle.vrma`
  ], (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  });

  useEffect(() => {
    const vrm = gltf.userData.vrm;
    vrmRef.current = vrm;
    VRMUtils.removeUnnecessaryJoints(vrm.scene);
    vrm.humanoid.resetPose();
    vrm.scene.rotation.y = Math.PI;

    // Setup Animation Mixer
    const mixer = new AnimationMixer(vrm.scene);
    mixerRef.current = mixer;

    // Helper to create action
    const createAction = (vrma, name) => {
      if (vrma.userData.vrmAnimations?.[0]) {
        const clip = createVRMAnimationClip(vrma.userData.vrmAnimations[0], vrm);
        const action = mixer.clipAction(clip);
        action.name = name;
        return action;
      }
      return null;
    };

    const actionFly = createAction(vrmaFly, 'fly');
    const actionFlyStop = createAction(vrmaFlyStop, 'fly_stop');
    const actionFlyIdle = createAction(vrmaFlyIdle, 'fly_idle');

    actionsRef.current = {
      fly: actionFly,
      fly_stop: actionFlyStop,
      fly_idle: actionFlyIdle,
    };

    // Configure Loop Modes
    if (actionFlyStop) {
      actionFlyStop.setLoop(THREE.LoopOnce);
      actionFlyStop.clampWhenFinished = true;
    }

    // Initial Animation (Idle: fly_idle)
    if (actionFlyIdle) {
      actionFlyIdle.play();
      currentActionRef.current = 'fly_idle';
    } else if (actionFly) {
      actionFly.play();
      currentActionRef.current = 'fly';
    }

    // Mixer Event Listener for 'finished' (for fly_stop -> fly_idle)
    const onFinished = (e) => {
      if (e.action === actionFlyStop) {
        // fly_stop finished, crossfade to fly_idle
        if (actionsRef.current.fly_idle) {
          actionFlyStop.fadeOut(0.5);
          actionsRef.current.fly_idle.reset().fadeIn(0.5).play();
          currentActionRef.current = 'fly_idle';
        }
      }
    };
    mixer.addEventListener('finished', onFinished);

    return () => {
      mixer.removeEventListener('finished', onFinished);
    };
  }, [gltf, vrmaFly, vrmaFlyStop, vrmaFlyIdle]);

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);
    vrmRef.current?.update(delta);

    // Animation State Logic
    const isMoving = keys.w || keys.s || keys.a || keys.d;
    const actions = actionsRef.current;
    const current = currentActionRef.current;

    if (actions.fly && actions.fly_stop && actions.fly_idle) {
      if (isMoving) {
        // If moving and not flying, transition to fly
        if (current !== 'fly') {
          const prevAction = actions[current];
          if (prevAction) prevAction.fadeOut(0.5);

          actions.fly.reset().fadeIn(0.5).play();
          currentActionRef.current = 'fly';
        }
      } else {
        // If stopped moving and currently flying, transition to fly_stop (stop anim)
        if (current === 'fly') {
          actions.fly.fadeOut(0.5);
          actions.fly_stop.reset().fadeIn(0.5).play();
          currentActionRef.current = 'fly_stop';
        }
        // If currently fly_stop, wait for it to finish (handled by event listener)
        // If currently fly_idle, stay there.
      }
    }

    // Character Rotation Logic
    if (vrmRef.current) {
      const vrmNode = vrmRef.current.scene;
      const moveDir = new Vector3(0, 0, 0);

      if (keys.w) moveDir.z -= 1;
      if (keys.s) moveDir.z += 1;
      if (keys.a) moveDir.x -= 1;
      if (keys.d) moveDir.x += 1;

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();

        const cameraQuaternion = camera.quaternion.clone();
        moveDir.applyQuaternion(cameraQuaternion);

        // Create a target rotation looking at the movement direction
        // Model faces -Z, so we want -Z to point to movement.
        // lookAt points +Z to target. So we want +Z to point AWAY from movement.
        const targetPos = vrmNode.position.clone().sub(moveDir);
        const dummy = new THREE.Object3D();
        dummy.position.copy(vrmNode.position);
        dummy.lookAt(targetPos);

        // Smoothly rotate towards target
        vrmNode.quaternion.slerp(dummy.quaternion, 10.0 * delta);
      }
    }
  });

  return <primitive object={gltf.scene} />;
}

// Avatar側のカメラ操作と移動ロジック
function CameraSync() {
  const { camera } = useThree();
  const vec = new Vector3();

  // Dynamic Zoom State
  const zoomOffset = useRef(0);
  const MAX_ZOOM_OFFSET = 10.0;
  const ZOOM_SPEED = 2.0;

  useFrame((state, delta) => {
    // 1. カメラの回転をShared State (Local) に同期
    worldState.quaternion.copy(camera.quaternion);

    // 2. Calculate Basis Rotation
    const basis = getSurfaceBasis(worldState.position);

    // 3. WASD移動ロジック (Local -> Global)
    const isMoving = keys.w || keys.s || keys.a || keys.d || keys.q || keys.e;
    const speed = worldState.speed * (keys.Shift ? 2.0 : 1.0) * delta;

    // Local Movement Vector
    const moveDir = new Vector3();
    if (keys.w) moveDir.z -= 1;
    if (keys.s) moveDir.z += 1;
    if (keys.a) moveDir.x -= 1;
    if (keys.d) moveDir.x += 1;

    // Altitude Control (Global Up/Down relative to surface)
    // We apply this directly to worldState.position along the up vector
    const upVector = worldState.position.clone().normalize();
    if (keys.e) {
      worldState.position.addScaledVector(upVector, speed);
    }
    if (keys.q) {
      worldState.position.addScaledVector(upVector, -speed);
    }

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Apply Camera Rotation (Local)
      moveDir.applyQuaternion(camera.quaternion);

      // Apply Basis Rotation (Local -> Global)
      moveDir.applyQuaternion(basis);

      // Apply to Global Position
      worldState.position.addScaledVector(moveDir, speed);
    }

    // 4. Minimum Altitude Safety Check
    const currentDist = worldState.position.length();

    // Calculate local ellipsoid radius
    const localRadius = getEllipsoidRadius(worldState.position);

    const minAltitude = localRadius + 10; // Minimum 10m above ellipsoid

    // Debug Log
    if (state.clock.elapsedTime % 1.0 < 0.02) {
      console.log(`[CameraSync] Dist: ${currentDist.toFixed(1)}, LocalR: ${localRadius.toFixed(1)}, Alt: ${(currentDist - localRadius).toFixed(1)}`);
    }

    if (currentDist < minAltitude) {
      // console.log(`[CameraSync] Safety Check Triggered! Pushing up to ${minAltitude}`);
      worldState.position.setLength(minAltitude);
    }

    // 5. Dynamic Zoom Logic
    const targetZoom = isMoving ? MAX_ZOOM_OFFSET : 0;
    // Smoothly interpolate current zoom offset towards target
    const diff = targetZoom - zoomOffset.current;
    const step = diff * ZOOM_SPEED * delta;
    zoomOffset.current += step;

    camera.translateZ(step);
  });

  return null;
}

function AvatarLayer() {
  return (
    <Canvas gl={{ alpha: true, antialias: true }}>
      <PerspectiveCamera makeDefault position={[0, 1.5, 3]} fov={40} />
      <CameraSync />

      <directionalLight position={[-1, 1, 1]} intensity={1.5} />
      <ambientLight intensity={1.0} />
      <spotLight position={[0, 2, -2]} intensity={3} color="#ffdcb4" />

      <Suspense fallback={null}>
        <VrmCharacter />
      </Suspense>

      <OrbitControls target={[0, 1.2, 0]} minDistance={2.0} maxDistance={10.0} />
    </Canvas>
  );
}

// ---------------------------------------------------------
// UI Components
// ---------------------------------------------------------
function LocationUI() {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 100,
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap'
    }}>
      {LOCATIONS.map((loc) => (
        <button
          key={loc.name}
          onClick={() => teleportTo(loc)}
          style={{
            padding: '10px 20px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------
// Main App
// ---------------------------------------------------------
function AtmosphereLayer() {
  // Canvasが親となり、その中にロジックコンポーネント(AtmosphereScene)を入れる
  return (
    <Canvas gl={{ alpha: true, antialias: true }}>
      <AtmosphereScene />
    </Canvas>
  );
}

export default function App() {
  const layerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>

      {/* UI Layer */}
      <LocationUI />

      {/* Layer 0: Atmosphere */}
      <div style={{ ...layerStyle, zIndex: 0 }}>
        <AtmosphereLayer />
      </div>

      {/* Layer 1: Avatar */}
      <div style={{ ...layerStyle, zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
          <AvatarLayer />
        </div>
      </div>

    </div>
  );
}
