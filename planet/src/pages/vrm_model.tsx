import * as THREE from 'three'
import React, { useState, useEffect, useRef,useMemo  } from 'react';
import { Points, OrbitControls, useGLTF } from '@react-three/drei'
import { useFrame, Canvas } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { EffectComposer, SelectiveBloom } from '@react-three/postprocessing'
import { SphereGeometry } from 'three';
import { GLTF } from 'three-stdlib'

interface ModelProps {
	url: string
	url_anim: string
}

const VRMModel: React.FC<ModelProps> = ({ url = "./models/ai.vrm", url_anim="./models/default.vrma" }) => {

	const [vrm, setVrm] = useState<VRM | null>(null);
	const mixerRef = useRef<THREE.AnimationMixer | null>(null);

	useEffect(() => {
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));
		loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
		loader.load(url, (gltf) => {
			const vrmModel = gltf.userData.vrm as VRM;
			VRMUtils.removeUnnecessaryJoints(vrmModel.scene);
			setVrm(vrmModel);
			const mixer = new THREE.AnimationMixer(vrmModel.scene);
			mixerRef.current = mixer;
			loader.load(url_anim, (animGltf) => {
				const vrmAnimations = animGltf.userData.vrmAnimations as VRMAnimation[];
				if (vrmAnimations && vrmAnimations.length > 0) {
					const clip = createVRMAnimationClip(vrmAnimations[0], vrmModel);
					mixer.clipAction(clip).play();
				}
			});
		});
	}, [url, url_anim]);

	useFrame((state, delta) => {
		if (mixerRef.current) mixerRef.current.update(delta);
		if (vrm) vrm.update(delta);
	});

	return vrm ? <primitive object={vrm.scene} /> : null;
};

type GLTFResult = GLTF & {
  nodes: {
    Object_2: THREE.Mesh
  }
  materials: {
    ['Scene_-_Root']: THREE.PointsMaterial
  }
}

export function Galaxy(props: JSX.IntrinsicElements['group']) {
	const ref = useRef<THREE.Group>(null!)
	const galaxyCenterLightRef = useRef<THREE.PointLight>(null!)
	const searchParams = new URLSearchParams(window.location.search);
	var g = searchParams.get('g') ?? 'galaxy';
	var model_path = "./models/" + g + ".glb"
	var model_scale = 0.05;

	const { nodes } = useGLTF(model_path) as GLTFResult
	const [positions, colors] = useMemo(() => {
			nodes.Object_2.geometry.center()
    const positions = new Float32Array(
      nodes.Object_2.geometry.attributes.position.array.buffer
    )
    const colors = new Float32Array(positions.length)
    const getDistanceToCenter = (x: number, y: number, z: number) =>
      Math.sqrt(x * x + y * y + z * z)
		var model_color = 100;
		if (g === 'sun'){
			const sphereGeometry = new SphereGeometry(1, 332, 332);
			nodes.Object_2.geometry = sphereGeometry;
			model_scale = 1;
		} else if (g === 'moon'){
			const sphereGeometry = new SphereGeometry(1, 132, 132);
			nodes.Object_2.geometry = sphereGeometry;
			model_color = 1;
			model_scale = 0.1;
		} else if (g === 'earth'){
			const sphereGeometry = new SphereGeometry(1, 232, 232);
			nodes.Object_2.geometry = sphereGeometry;
			model_color = 0.5;
			model_scale = 0.3;
		} else if (g === 'asteroid') {
			const sphereGeometry = new SphereGeometry(1, 32, 32);
			nodes.Object_2.geometry = sphereGeometry;
			model_color = 1;
			model_scale = 0.1;
		} else if (g === 'neutron') {
			model_color = 1;
		}
			// make colors closer to 0,0,0 be more reddish and colors further away be more blueish
			const color = new THREE.Color()
			for (let i = 0; i < positions.length; i += 3) {
				const x = positions[i]
				const y = positions[i + 1]
				const z = positions[i + 2]
				const distanceToCenter = getDistanceToCenter(x, y, z)
				const normalizedDistanceToCenter = distanceToCenter / model_color
				// make colors closer to 0,0,0 be more reddish and colors further away be more blueish (do not use hsl)
				color.setHSL(
					(0.15 * (0.21 + Math.cos(distanceToCenter * 0.02))) / 2,
					0.75,
					0.6
				)
				color.setRGB(
					Math.cos(normalizedDistanceToCenter),
					THREE.MathUtils.randFloat(0, 0.8),
					Math.sin(normalizedDistanceToCenter)
				)
				color.toArray(colors, i)
			}

    return [positions, colors]
  }, [nodes])
  
  useFrame(({ clock }) => {
    // zoom in and out
    ref.current.rotation.z = clock.getElapsedTime() / 2
			 ref.current.scale.setScalar(Math.sin(clock.getElapsedTime() / 10) + 1.2)
  })

  return (
   <group {...props} dispose={null} ref={ref}>
			<pointLight
        position={[0, 0, 0]}
        ref={galaxyCenterLightRef}
        intensity={0.5}
      />
      <Points scale={model_scale} positions={positions} colors={colors}>
        <pointsMaterial
          //map={starTexture}
          transparent
          depthWrite={false}
          vertexColors
          opacity={0.4}
          depthTest
          size={0.01}
        />
      </Points>
      <EffectComposer autoClear={false}>
        <SelectiveBloom
          intensity={5}
          luminanceThreshold={0.01}
          luminanceSmoothing={0.225}
          lights={[galaxyCenterLightRef]}
        />
      </EffectComposer>
		    <ambientLight intensity={1} />
			</group>
  )
}

export const VRMModelCanvas = () => {
	return (
		<div style={{ height: '100vh', width: '100vw' }}>

		<Canvas
		shadows
		gl={{
			toneMapping: THREE.NeutralToneMapping,
				toneMappingExposure: 1.5,
				alpha: true,
				powerPreference: "high-performance",
				antialias: true,
		}}
		camera={{ position: [1, 1, 1] }}>

		<directionalLight 
		color="white" 
		castShadow 
		position={[0, 10, 0]} 
		intensity={1.5} 
		shadow-mapSize={[1024, 1024]}/>

		<OrbitControls />
		<ambientLight intensity={1} />
		<pointLight position={[10, 10, 10]} />
		<VRMModel url="./models/ai.vrm" url_anim="./models/default.vrma" />
		<Galaxy position={[0, 9, 0]} />
		</Canvas>
		</div>
	)
}
export default VRMModelCanvas;
