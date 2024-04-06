import * as THREE from 'three';
import { GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
import { ASSETS } from "./lib/assets";
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface ModelRef {
    model?: GLTF;
    loaded: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
}

interface AnimSettings {
    name: string;
    mixer: THREE.AnimationMixer;
    completeListener: () => void;
}

const loader = new GLTFLoader();
let allLoadedCallback: () => void;
const models: ModelRef[] = [];
const textures: THREE.Texture[] = [];
const anims: Record<number, AnimSettings> = {};
const originals: Record<number, GLTF> = {};

export type KayBone = "armRight" | "armLeft" | "Head" | "Body" | "handSlotLeft" | "handSlotRight";

export function attach(target: THREE.Object3D<THREE.Object3DEventMap>, attachment: ModelRef, bone: KayBone): THREE.Object3D<THREE.Object3DEventMap> {
    const boneInstance = target.getObjectByName(bone);
    if (boneInstance) {
        const item = instanceModel(attachment);
        boneInstance.attach(item);
    }

    return target
}

export function createFromKayAnimations(scene: THREE.Scene, animations: ModelRef, skin: ModelRef, prefix: string): THREE.Object3D<THREE.Object3DEventMap> {
    const instance = instanceModel(animations);
    const skinModel = instanceModel(skin);

    instance.getObjectByName("PrototypePete")?.removeFromParent();
    const leftArm = skinModel.getObjectByName(prefix + "_armLeft");
    if (leftArm) {
        instance.getObjectByName("armLeft")?.attach(leftArm);
    }
    const rightArm = skinModel.getObjectByName(prefix + "_armRight");
    if (rightArm) {
       instance.getObjectByName("armRight")?.attach(rightArm);
    }
    const head = skinModel.getObjectByName(prefix + "_head")
    if (head) {
        instance.getObjectByName("Head")?.attach(head);
    }
    const body = skinModel.getObjectByName(prefix + "_body");
    if (body) {
        instance.getObjectByName("Body")?.attach(body);
    }
    return instance;
}

export function dumpColors(model: THREE.Object3D): void {
    model.traverse(child => {
        if (child instanceof THREE.Mesh) {
            console.log(child.material.name);
        }
    })
}

export function recolor(model: THREE.Object3D, name: string, col: string): void {
    model.traverse(child => {
        if (child instanceof THREE.Mesh) {
            if (child.material.name === name) {
                child.material = child.material.clone();
                child.material.color = new THREE.Color(col);
            }
        }
    })
}

export function applyTexture(model: THREE.Object3D<THREE.Object3DEventMap>, texture: THREE.Texture): THREE.Object3D<THREE.Object3DEventMap> {
    model.traverse(child => {
        if (child instanceof THREE.SkinnedMesh) {
            child.material.map = texture;
        }
    })

    return model;
}

export function instanceModel(modelRef: ModelRef): THREE.Object3D<THREE.Object3DEventMap> {
    if (!modelRef.model) {
        throw "Model hasn't loaded yet";
    }
    const instance = clone(modelRef.model.scene);

    instance.traverse(child => {
        child.receiveShadow = modelRef.receiveShadow;
        child.castShadow = modelRef.castShadow;
    });

    originals[instance.id] = modelRef.model;

    return instance;
}

export function loadTexture(ref: string): THREE.Texture {
    const texture = new THREE.TextureLoader().load(ASSETS[ref]);
    texture.flipY = false;

    textures.push(texture);
    return texture;
}

export function loadModel(ref: string, castShadow: boolean, receiveShadow: boolean, textureOverride?: THREE.Texture): ModelRef {
    const modelRef: ModelRef = {
        loaded: false,
        castShadow, receiveShadow
    };
    models.push(modelRef);

    loader.load(ASSETS[ref], (model) => {
        model.scene.traverse(child => {
            child.receiveShadow = receiveShadow;
            child.castShadow = castShadow;
            if (child instanceof THREE.SkinnedMesh && textureOverride) {
                if (child.material.map) {
                    child.material.map = textureOverride;
                }
            }
        });

        modelRef.loaded = true;
        modelRef.model = model;

        if (models.every(m => m.loaded)) {
            allLoadedCallback();
        }
    });

    return modelRef;
}

export function onAllLoaded(callback: () => void) {
    allLoadedCallback = callback;
}

export function getAnimations(modelRef: ModelRef): string[] {
    if (!modelRef.model) {
        throw "Model hasn't loaded yet";
    }

    return modelRef.model.animations.map(anim => anim.name);
}

export function getCurrentAnimation(model: THREE.Object3D): string {
    const anim: AnimSettings = anims[model.id];
    if (!anim) {
        return "";
    }

    return anim.name;
}

export function animateModel(model: THREE.Object3D<THREE.Object3DEventMap>, name: string, once = false, onDone: (() => void) | undefined = undefined): void {
    let anim: AnimSettings = anims[model.id];
    if (!anim) {
        anim = anims[model.id] = {
            name: "",
            mixer: new THREE.AnimationMixer(model),
            completeListener: () => { return }
        }

        anim.mixer.addEventListener("finished", () => {
            anim.completeListener();
            anim.completeListener = () => { return }
        });
    }

    if (anim.name === name) {
        return;
    }
    anim.name = name;

    anim.mixer.stopAllAction();
    const animation = originals[model.id].animations.find(anim => anim.name === name);
    if (!animation) {
        console.log("Couldn't find animation: " + name);
        return;
    }

    const action = anim.mixer.clipAction(animation);

    if (once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
    }
    action.enabled = true;
    action.play();
    if (onDone) {
        anim.completeListener = onDone;
    } else {
        anim.completeListener = () => { return }
    }
}

export function updateAnimations(delta: number): void {
    Object.values(anims).forEach(anim => anim.mixer.update(delta));
}