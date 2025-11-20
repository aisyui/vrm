import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { AnimationMixer, GridHelper, AxesHelper } from 'three';
import { OrbitControls } from '@react-three/drei';

const VRM_URL = '/ai.vrm';
const VRMA_URL = '/idle.vrma';

function Avatar() {
  const mixerRef = useRef(null);
  const vrmRef = useRef(null);
  const gltf = useLoader(GLTFLoader, VRM_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrma = useLoader(GLTFLoader, VRMA_URL, (loader) => {
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  });

  useEffect(() => {
    const vrm = gltf.userData.vrm;
    vrmRef.current = vrm;
    VRMUtils.removeUnnecessaryJoints(vrm.scene);
    vrm.humanoid.resetPose();
    vrm.scene.rotation.y = Math.PI;
    if (vrma.userData.vrmAnimations && vrma.userData.vrmAnimations.length > 0) {
      const clip = createVRMAnimationClip(vrma.userData.vrmAnimations[0], vrm);
      mixerRef.current = new AnimationMixer(vrm.scene);
      mixerRef.current.clipAction(clip).play();
    }
  }, [gltf, vrma]);

  useFrame((state, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (vrmRef.current) vrmRef.current.update(delta);
  });

  return <primitive object={gltf.scene} />;
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 1.5, 3] }}>
        <color attach="background" args={['#202020']} />
        <directionalLight position={[1, 1, 1]} intensity={1.5} />
        <ambientLight intensity={0.5} />
        <primitive object={new GridHelper(10, 10)} />
        <primitive object={new AxesHelper(1)} />
        <React.Suspense fallback={null}>
          <Avatar />
        </React.Suspense>
        <OrbitControls target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
