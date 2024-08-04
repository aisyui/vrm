import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";
import { GridHelper, Mesh, MeshLambertMaterial, BoxGeometry, Vector3, Vector2, Color, DirectionalLight, Fog, HemisphereLight, HalfFloatType } from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";

window.addEventListener("DOMContentLoaded", () => {

	let manager = new THREE.LoadingManager();
	const canvas = document.getElementById("canvas");
	if (canvas == null) return;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera( 70, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
	camera.position.set(0, 1.5, -1.5)
	camera.rotation.set(0.0, Math.PI, 0.0)
	camera.lookAt(new THREE.Vector3(0, 0, 0));

	const renderer = new THREE.WebGLRenderer({
		alpha: true,
		powerPreference: "high-performance",
		antialias: true,
		stencil: false,
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(canvas.clientWidth, canvas.clientHeight);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMapping = THREE.NeutralToneMapping;
	canvas.appendChild(renderer.domElement);
	renderer.toneMappingExposure = 1.5;
	renderer.setClearColor(0xffffff, 1.0);

	const light = new THREE.DirectionalLight(0xffffff, Math.PI);
	light.position.set(1.0, 1.0, 1.0);
	scene.add(light);

	let currentVrm: any = undefined;
	let currentVrmAnimation: any = undefined;
	let currentMixer:any = undefined;
	let percentComplete = null;

	function load(url: string) {
		loader.load(
			url,
			(gltf) => {
				tryInitVRM(gltf);
				tryInitVRMA(gltf);
			},
			(xhr) => {
				percentComplete = (xhr.loaded / xhr.total) * 100
			},
			(error) => console.error(error)
		);
	}

	function tryInitVRM(gltf: any) {
		const vrm = gltf.userData.vrm;
		if ( vrm == null ) {
			return;
		}
		currentVrm = vrm;
		scene.add(vrm.scene);
		initAnimationClip();
	}

	function tryInitVRMA(gltf: any) {
		const vrmAnimations = gltf.userData.vrmAnimations;
		if (vrmAnimations == null) {
			return;
		}
		currentVrmAnimation = vrmAnimations[0] ?? null;
		initAnimationClip();
	}

	function initAnimationClip() {
		if (currentVrm && currentVrmAnimation) {
			currentMixer = new THREE.AnimationMixer(currentVrm.scene);
			const clip = createVRMAnimationClip(currentVrmAnimation, currentVrm);
			currentMixer.clipAction(clip).play();
		}
	}

	const loader = new GLTFLoader(manager);
	loader.register((parser) => {
		return new VRMLoaderPlugin(parser);
	});
	loader.register((parser) => {
		return new VRMAnimationLoaderPlugin(parser);
	});

	load("/models/default.vrm");
	load("/models/default.vrma");

	const clock = new THREE.Clock();
	clock.start();

	onResize();
	window.addEventListener('resize', onResize);
	function onResize() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(width, height);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	animate();
	function animate() {
		const delta = clock.getDelta();
		if (currentMixer) {
			currentMixer.update(delta);
		}
		if (currentVrm) {
			currentVrm.update(delta);
		}
		requestAnimationFrame(animate);
		renderer.render(scene, camera);
	}

})
