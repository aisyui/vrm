import * as THREE from 'three'
import React, { useState, useEffect, useRef, useMemo  } from 'react';
import { Points, OrbitControls, useGLTF } from '@react-three/drei'
import { useFrame, Canvas } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import { VRMSpringBoneManager } from '@pixiv/three-vrm-springbone';
import { EffectComposer, SelectiveBloom } from '@react-three/postprocessing'
import { SphereGeometry } from 'three';
import { GLTF } from 'three-stdlib'

interface ModelProps {
	url: string
	url_anim: string
	position?: [number, number, number]
	rotation?: [number, number, number]
	scale?: number 
}

const VRMModel: React.FC<ModelProps> = ({ url = "./models/ai.vrm", url_anim="./models/default.vrma", position = [0, 0, 0], scale  = 1, rotation = [0, 1.5, 0] }) => {

	const [vrm, setVrm] = useState<VRM | null>(null);
	const mixerRef = useRef<THREE.AnimationMixer | null>(null);
	const springBoneManagerRef = useRef<VRMSpringBoneManager | null>(null);

	useEffect(() => {
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));
		loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
		loader.load(url, (gltf) => {
			const vrmModel = gltf.userData.vrm as VRM;
			VRMUtils.removeUnnecessaryJoints(vrmModel.scene);
			springBoneManagerRef.current = vrmModel.springBoneManager as VRMSpringBoneManager;
			springBoneManagerRef.current?.reset();
			setVrm(vrmModel);
			if (vrmModel) {
				vrmModel.scene.rotation.set(...rotation);
				vrmModel.scene.position.set(...position);
				vrmModel.scene.scale.setScalar(scale);
			}
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
	}, [url, url_anim, position, scale, rotation]);

	useFrame((state, delta) => {
		if (mixerRef.current) mixerRef.current.update(delta);
		if (springBoneManagerRef.current) springBoneManagerRef.current.update(delta);
		if (vrm) vrm.update(delta);
	});

	return vrm ? <primitive object={vrm.scene} /> : null;
};

interface ModelGlbProps {
	url: string
	position?: [number, number, number]
	rotation?: [number, number, number]
	scale?: number 
}

const GlbModel: React.FC<ModelGlbProps> = ({ url = "./models/solar_system.glb", position = [0, 0, 0], scale  = 1, rotation = [0, 0, 0] }) => {
	const { scene } = useGLTF(url)
	scene.scale.setScalar(scale);
	scene.position.set(...position);
	return <primitive object={scene} />
}

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
	const ms = searchParams.get('ms');
	const vrm_scale = ms ? parseInt(ms, 10) : 1;
	var model_galaxy = "./models/galaxy.glb"
	var model_custom = "./models/ai.vrm"
	var model_scale = 0.01;
	var position_custom = [-0.2, -0.8, -0.3] as [number, number, number];
	var rotation_custom = [0, 1.5, 0] as [number, number, number];
	var sphereGeometry = new SphereGeometry(1, 332, 332);
	var anim_custom = "./models/emote.vrma";
	const { nodes } = useGLTF(model_galaxy) as GLTFResult
	var model_color = 100;
	nodes.Object_2.geometry.center()
	if (g === 'sun'){
		sphereGeometry = new SphereGeometry(1, 332, 332);
		nodes.Object_2.geometry = sphereGeometry;
		model_scale = 1;
	} else if (g === 'moon'){
		sphereGeometry = new SphereGeometry(1, 132, 132);
		nodes.Object_2.geometry = sphereGeometry;
		model_color = 1;
		model_scale = 0.01;
		position_custom = [-0.5,-1,0];
		anim_custom = "./models/fly.vrma";
		model_custom = "./models/ai_default.vrm";
	} else if (g === 'earth'){
		sphereGeometry = new SphereGeometry(1, 232, 232);
		nodes.Object_2.geometry = sphereGeometry;
		model_color = 0.5;
		model_scale = 0.3;
		position_custom = [-1,-1,0];
		anim_custom = "./models/fly.vrma";
		model_custom = "./models/ai_default.vrm";
	} else if (g === 'neutron') {
		model_color = 1;
	}
	const [positions, colors] = useMemo(() => {
		const positions = new Float32Array(
			nodes.Object_2.geometry.attributes.position.array.buffer
		)
		const colors = new Float32Array(positions.length)
		const getDistanceToCenter = (x: number, y: number, z: number) =>
			Math.sqrt(x * x + y * y + z * z)
		const color = new THREE.Color()
		for (let i = 0; i < positions.length; i += 3) {
			const x = positions[i]
			const y = positions[i + 1]
			const z = positions[i + 1]
			const distanceToCenter = getDistanceToCenter(x, y, z)
			const normalizedDistanceToCenter = distanceToCenter / model_color
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
	}, [nodes, model_color])

	useFrame(({ clock }) => {
		ref.current.rotation.y = clock.getElapsedTime() / 2
		ref.current.scale.setScalar(Math.sin(clock.getElapsedTime() / 2) + 1.2)
	})

	return (
		<group {...props} dispose={null} ref={ref}>
		<VRMModel url={model_custom} url_anim={anim_custom} position={position_custom} scale={vrm_scale} rotation={rotation_custom} />
		{g === 'sun' && <GlbModel url="./models/solar-system.glb" scale={10} />}
		{g === 'galaxy' && <GlbModel url="./models/solar-system.glb" scale={0.5} position={[0,0.5,2]}/>}

		<pointLight
		position={[0, 0, 0]}
		ref={galaxyCenterLightRef}
		intensity={0.2}
		/>
		<Points scale={model_scale} positions={positions} colors={colors} rotation={[1.5,0,0]}>
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
		<Canvas
		shadows
		gl={{
			toneMapping: THREE.NeutralToneMapping,
				toneMappingExposure: 1.1,
				alpha: true,
				powerPreference: "high-performance",
				antialias: true,
		}}
		camera={{ position: [1, 1, 1] }}>

		<directionalLight 
		color="white" 
		castShadow 
		position={[0, 10, 0]} 
		intensity={0.4} 
		shadow-mapSize={[1024, 1024]}/>

		<OrbitControls
		minDistance={2} maxDistance={3}
		enableZoom={true} enablePan={false} enableRotate={true}
		zoomSpeed={0.5}
		panSpeed={0.5}
		rotateSpeed={0.5} />	
		<ambientLight intensity={1} />
		<pointLight position={[10, 10, 10]} />
		<Galaxy position={[0, 0, 0]} />
		</Canvas>
	)
}

export default VRMModelCanvas;
