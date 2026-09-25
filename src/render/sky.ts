/* Sky dome, stars and moon. */
import * as THREE from 'three';
import { scene } from './context';

export const skyU = {
  top: { value: new THREE.Color() },
  hor: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
  sunCol: { value: new THREE.Color() },
  sunVis: { value: 0 },
};
export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2400, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 top,hor,sunDir,sunCol;uniform float sunVis;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=clamp(d.y,0.,1.);vec3 c=mix(hor,top,pow(h,.5));if(d.y<0.)c=hor;float s=max(dot(d,sunDir),0.);c+=sunCol*(pow(s,900.)*4.+pow(s,10.)*.28)*sunVis;gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`,
  }),
);
sky.renderOrder = -10;
scene.add(sky);
const starGeo = new THREE.BufferGeometry();
{
  const p = [];
  for (let i = 0; i < 700; i++) {
    const u = Math.random() * Math.PI * 2,
      v = Math.random() * 0.9 + 0.08;
    const r = Math.sqrt(1 - v * v);
    p.push(Math.cos(u) * r * 2000, v * 2000, Math.sin(u) * r * 2000);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
export const starMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1.6,
  sizeAttenuation: false,
  transparent: true,
  opacity: 0,
  fog: false,
  depthWrite: false,
});
export const stars = new THREE.Points(starGeo, starMat);
stars.renderOrder = -9;
scene.add(stars);
export const moon = new THREE.Mesh(
  new THREE.SphereGeometry(35, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xf6f0da, fog: false, transparent: true }),
);
scene.add(moon);
