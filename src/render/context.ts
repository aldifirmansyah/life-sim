import * as THREE from 'three';
import { $ } from '../core/util';

export const canvas = $<HTMLCanvasElement>('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const scene = new THREE.Scene();
export const fog = new THREE.Fog(0xbfe3f5, 45, 140);
scene.fog = fog;
export const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 700);
camera.rotation.order = 'YXZ';
