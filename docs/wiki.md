## example three-vrm 

- vrm : [download](https://hub.vroid.com/characters/675572020956181239/models/7175071267176594918)
- vrma : [download](https://vroid.booth.pm/items/5512385)

> ./dist/vrma

```js
load("/vrma/model.vrm");
load("/vrma/VRMA_01.vrma");	
```

## iframe

```html
<div class="vrm-model">
<iframe src="https://vrm.syui.ai" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen scrolling="no"></iframe>
</div>

<style>
.vrm-model iframe {
	margin:30px 0 30px 0;
	width: 100%;
	height: 640px;
}
</style>
```

## head

```js
let head = currentVrm.humanoid.getRawBoneNode("head");
```

## blink

```js
currentVrm.expressionManager.setValue('blink', 0);
```

## bloom

```js
//import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
//import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
//import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
// https://github.com/pmndrs/postprocessing
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new BloomEffect()));

requestAnimationFrame(function render() {

	requestAnimationFrame(render);
	composer.render();

});
```

## progress

```js
// https://sbcode.net/threejs/progress-indicator
let manager = new THREE.LoadingManager();
let progressBar = document.getElementById('progressBar') as HTMLProgressElement

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
```

```html
<progress value="0" max="100" id="progressBar"></progress>
```

```css
progress {
	width: 100%;
	height:8px;
	position: absolute;
	border-radius: 0px;
}

::-webkit-progress-bar {
	border-radius: 0px;
	background-color: #e6e6fa;
}

::-webkit-progress-value {
  background-color: #4682b4;
}
```

## link

- https://vrm.dev/
- https://threejs.org/docs/
- https://github.com/pixiv/three-vrm
- https://github.com/vrm-c/vrm-specification/blob/master/specification/
- https://github.com/pmndrs/postprocessing

