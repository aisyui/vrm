import * as THREE from 'three'
import React, { useState, useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei'
import { useFrame, Canvas } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip } from "@pixiv/three-vrm-animation";

interface ModelProps {
	url: string
	url_anim: string
}

const VRMModel: React.FC<ModelProps> = ({ url, url_anim }) => {

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

export const VRMModelCanvas = () => {
	return (
		<div style={{ height: '100vh', width: '100vw' }}>

		<Canvas
		shadows
		gl={{
			//toneMapping: THREE.ACESFilmicToneMapping,
			//toneMapping: THREE.ReinhardToneMapping,
			toneMapping: THREE.NeutralToneMapping,
				toneMappingExposure: 1.5,
				alpha: true,
				powerPreference: "high-performance",
				antialias: true,
				//stencil: false,
				//depth: false
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

		<VRMModel url="./models/ai_vrm10.vrm" url_anim="./models/default.vrma" />

		</Canvas>
		</div>
	)
}
export default VRMModelCanvas;

