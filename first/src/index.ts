import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";
import { GridHelper, Mesh, MeshLambertMaterial, BoxGeometry, Vector3, Vector2, Color, DirectionalLight, Fog, HemisphereLight, HalfFloatType } from 'three';
import { VRMSpringBoneManager, VRMSpringBoneJoint, VRMSpringBoneJointHelper } from '@pixiv/three-vrm-springbone';
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";

window.addEventListener("DOMContentLoaded", () => {

	let default_model = "/vrma/model/ai.vrm"
	// vrma
	let motion_enable = false;
	let head = null;

	// https://sbcode.net/threejs/progress-indicator
	let manager = new THREE.LoadingManager();
	let progressBar = document.getElementById('progressBar') as HTMLProgressElement

	// three
	const canvas = document.getElementById("canvas");
	if (canvas == null) return;
	const scene = new THREE.Scene();
	//const camera = new THREE.PerspectiveCamera( 70, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
	const camera = new THREE.PerspectiveCamera( 70, canvas.clientWidth/canvas.clientHeight, 0.1, 2000);
	camera.position.set(0, 1.5, -1.5)
	camera.rotation.set(0.0, Math.PI, 0.0)
	camera.lookAt(new THREE.Vector3(0, 0, 0));

	// https://threejs.org/docs/#api/en/constants/Renderer
	const renderer = new THREE.WebGLRenderer({
		alpha: true,
		powerPreference: "high-performance",
		antialias: true,
		stencil: false,
		//depth: false
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
	//light.intensity = -0.8;
	//renderer.setClearColor(0x000000, 1.0);
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
				//progressBar.value = percentComplete === Infinity ? 100 : percentComplete
			},
			(progress) => console.log( "Loading model...", 100.0 * (progress.loaded / progress.total), "%" ),
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

	load(default_model);
	load("/vrma/anime/fly_c.vrma");	

	let item = null;
	loader.load( '/vrma/item/tera.glb', function ( gltf ) {
		item = gltf.scene;

	}, undefined, function ( error ) {
		console.error( error );
	});

	const clock = new THREE.Clock();
	clock.start();

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.2;
	controls.enableRotate = true;
	controls.target.set( 0.0, 1.0, 0.0 );

	//scene.background = new THREE.Color(0xffffff);
	const directionalLight = new THREE.DirectionalLight(0xffffff);
	directionalLight.position.set(1, 1, 1);
	//directionalLight.castShadow = true;
	//directionalLight.shadow.radius = 3.0;
	//renderer.shadowMap.enabled = true;
	//directionalLight.intensity = 0.3;
	scene.add(directionalLight);
	const ambientLight = new THREE.AmbientLight(0x333333);
	scene.add(ambientLight);

	let grid = new GridHelper(500, 1000, 0xffffff, 0xffffff);
	scene.add(grid);
	grid.position.set(Math.round(0), 0, Math.round(0));
	scene.fog = new Fog(0xffffff, 3, 20);
	scene.fog?.color.set(0xffffff);

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

	let composer = new EffectComposer(renderer, {
		frameBufferType: HalfFloatType
	});
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(new EffectPass(camera, new BloomEffect()));

	function random_happy() {
		// https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.ja.md
		currentVrm.expressionManager.setValue('relaxed', 0.5);
	}

	function random_head() {
		// https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/lookAt.ja.md
		currentVrm.lookAt.target = camera;
		//currentVrm.VRMLookAtBoneApplier = camera;
		//currentVrm.VRMLookAtExpressionApplier = camera;
		// https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/humanoid.ja.md
		head = currentVrm.humanoid.getRawBoneNode("head");
		head.target = camera;
	}

	function random_blink(){
		setInterval(() => {
			currentVrm.expressionManager.setValue('relaxed', 0);
			currentVrm.expressionManager.setValue('blink', 0);
			random_head();
			const r = Math.floor(Math.random() * 3);
			if (r == 1) {
				setTimeout(() => { currentVrm.expressionManager.setValue('blink', 1); }, 5000);
				setTimeout(() => {
					currentVrm.expressionManager.setValue('blink', 0);
				}, 5500);
			};
			setTimeout(() => {
				currentVrm.expressionManager.setValue('relaxed', 0.5);
				currentVrm.expressionManager.setValue('blink', 1);
			}, 6000);
		}, 6500);
	}
	random_blink();

	const el_light = document.querySelector('#btn-moon') as HTMLInputElement | null;
	if(el_light != null) {
		el_light.addEventListener('click', function(){
			light_s();
		});
	}

	let light_enable = 0;
	let light_max = 4;
	function light_s(){
		if (light_enable >= light_max) {
			light_enable = 0;
		}
		console.log(light_enable);
		switch (light_enable) {
			case 0:
				renderer.toneMapping = THREE.ACESFilmicToneMapping;
			light.intensity = -0.8;
			renderer.setClearColor(0x000000);
			scene.background = new THREE.Color(0x000000);
			scene.fog = new Fog(0x000000, 3, 20);
			break;
			case 1:
				renderer.toneMapping = THREE.NeutralToneMapping;
			light.intensity = 1;
			scene.background = new THREE.Color(0xffffff);
			renderer.setClearColor(0xffffff);
			scene.fog = new Fog(0xffffff, 3, 20);
			break;
			case 2:
				renderer.toneMapping = THREE.ReinhardToneMapping;
			break;
			case 3:
				renderer.toneMapping = THREE.ReinhardToneMapping;
			renderer.toneMapping = THREE.NeutralToneMapping;
			renderer.physicallyCorrectLights = true;
			light.intensity = 2;
			break;
		}
		light_enable++;
	}

	const el_user = document.querySelector('#btn-user') as HTMLInputElement | null;
	if(el_user != null) {
		el_user.addEventListener('click', function(){
			user_s();
		});
	}

	let user_enable = 0;
	let user_max = 3;
	let anime_id;
	function user_s(){
		if (user_enable >= user_max) {
			user_enable = 0;
		}
		console.log(user_enable);
		switch (user_enable) {
			case 0:
			light.intensity = 1;
			renderer.setClearColor(0x000000);
			scene.remove(grid);
			scene.background = new THREE.Color(0x000000);
			scene.fog = new Fog(0x000000, 3, 20);
			requestAnimationFrame(function render() {
				anime_id = requestAnimationFrame(render);
				composer.render();
			});	
			break;
			case 1:
				cancelAnimationFrame(anime_id);
			scene.add(grid);
			load("/vrma/model/ai_normal.vrm");
			scene.remove(currentVrm.scene);
			renderer.toneMapping = THREE.NeutralToneMapping;
			light.intensity = 1;
			scene.background = new THREE.Color(0xffffff);
			renderer.setClearColor(0xffffff);
			scene.fog = new Fog(0xffffff, 3, 20);
			break;
			case 2:
				load("/vrma/model/ai.vrm");
			scene.remove(currentVrm.scene);
			break;
		}
		user_enable++;

	}

	const el_hdr = document.querySelector('#btn-sandar') as HTMLInputElement | null;
	if(el_hdr != null) {
		el_hdr.addEventListener('click', function(){
			hdr_s();
		});
	}

	let hdr_r = 0;
	function hdr_s() {
		if (hdr_r >= 2) { hdr_r = 0; } else { hdr_r++; };
		let hdr = "/img/" + hdr_r + ".hdr";
		new RGBELoader().load(hdr, function (texture) {
			texture.mapping = THREE.EquirectangularReflectionMapping;
			scene.background = texture;
			scene.environment = texture;
		});
	}

	function cool_time() {
		setTimeout(() => {
			motion_enable = false;
		}, 5000);
	}

	const el_sword = document.querySelector('#btn-sword') as HTMLInputElement | null;
	if(el_sword != null) {
		el_sword.addEventListener('click', function(){
			sword_s();
		});
	}

	function sword_s(){
		scene.remove(currentVrm.scene);
		load("/vrma/model/ai_sword.vrm");
		load("/vrma/anime/sword.vrma");	
		setTimeout(() => {
			load("/vrma/anime/idle.vrma");	
		}, 1000);
		setTimeout(() => {
			load("/vrma/model/ai.vrm");
			scene.remove(currentVrm.scene);
		}, 5000);
	}

	const el_cloud = document.querySelector('#btn-cloud') as HTMLInputElement | null;
	if(el_cloud != null) {
		el_cloud.addEventListener('click', function(){
			cloud_s();
		});
	}

	function cloud_s(){
		load("/vrma/anime/sky.vrma");	
		setTimeout(() => {
			load("/vrma/anime/jump.vrma");	
		}, 5000);
		setTimeout(() => {
			load("/vrma/anime/idle.vrma");	
		}, 5500);
	}

	let mouse_ivent_timer_id;
	const el_run = document.querySelector('#btn-run') as HTMLInputElement | null;
	if(el_run != null) {
		el_run.addEventListener('mousedown', function(){
			mouse_ivent_timer_id = setTimeout(function () {
				motion_enable = true;
			}, 1000);
			load("/vrma/anime/run.vrma");	
		});
	}
	document.querySelector('#btn-run').addEventListener('mouseup', (event) => {
		clearTimeout(mouse_ivent_timer_id);
		load("/vrma/anime/idle.vrma");	
		cool_time();
	});

	const el_jump = document.querySelector('#btn-jump') as HTMLInputElement | null;
	if(el_jump != null) {
		el_jump.addEventListener('mousedown', function(){
			jump_s();
		});
	}

	function jump_s(){
		motion_enable = true;
		load("/vrma/anime/jump.vrma");	
		setTimeout(() => {
			load("/vrma/anime/idle.vrma");	
		}, 500);
		cool_time();
	}

	setInterval(() => {
		const r = Math.floor(Math.random() * 4 + 1);
		if (motion_enable == false) { load("/vrma/random/" + r + ".vrma"); }
		setTimeout(() => {
			if (motion_enable == false) { load("/vrma/anime/fly_c.vrma");	}
		}, 10000);
	}, 15000);

	animate();
	function animate() {
		controls.update();
		const delta = clock.getDelta();
		if (currentMixer) {
			currentMixer.update(delta);
		}
		if (currentVrm) {
			currentVrm.update(delta);
		}
		requestAnimationFrame(animate);
		scene.rotation.y += 0.0005;
		renderer.render(scene, camera);
	}

	// https://threejs.org/docs/#api/en/loaders/managers/LoadingManager
	manager.onStart = function ( url, itemsLoaded, itemsTotal ) {
		//console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
		progressBar.style.display = 'block'
		let percentComplete = (itemsLoaded / itemsTotal) * 100
		progressBar.value = percentComplete === Infinity ? 100 : percentComplete
	};
	manager.onLoad = function ( ) {
		//console.log( 'Loading complete!');
		progressBar.style.display = 'none'
	};
	manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
		let percentComplete = (itemsLoaded / itemsTotal) * 100
		progressBar.value = percentComplete === Infinity ? 100 : percentComplete
		//console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
	};
	manager.onError = function ( url ) {
		//console.log( 'There was an error loading ' + url );
		progressBar.style.display = 'block'
	};

	let nav_enable = true;
	let nav_mobile = document.getElementById('nav-mobile') as HTMLProgressElement
	const el_nav = document.querySelector('#nav') as HTMLInputElement | null;
	if(el_nav != null) {
		el_nav.addEventListener('click', function(){
			if (nav_enable == true) {
				nav_mobile.style.display = 'block'
				nav_enable = false;
			} else {
				nav_mobile.style.display = 'none'
				nav_enable = true;
			}
		});
	}

	let grid_enable = true;
	const el_grid = document.querySelector('#btn-grid') as HTMLInputElement | null;
	if(el_grid != null) {
		el_grid.addEventListener('click', function(){
			if (grid_enable == true) {
				scene.remove(grid);
				grid_enable = false;
			} else {
				scene.add(grid);
				grid_enable = true;
			}
		});
	}

	let tera_enable = true;
	const el_tera = document.querySelector('#btn-tera') as HTMLInputElement | null;
	if(el_tera != null) {
		el_tera.addEventListener('click', function(){
			if (tera_enable == true) {
				item.rotation.set(0, 0, 5);
				item.position.set(0, -15, 0);
				item.scale.set(8, 8, 8);
				scene.add(item);
				tera_enable = false;
			} else {
				scene.remove(item);
				tera_enable = true;
			}
		});
	}

})
