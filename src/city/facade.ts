/* Building facades without textures: a Lambert material whose shader draws the
   windows from the world position and the face's normal, so any box of any size
   gets a correct grid of storeys and bays. The style (a per-instance float) picks
   the pattern: HDB blocks with corridor parapets, glass towers, offices with
   ribbon windows, shophouses with shutters, malls, industry, terminals, houses.
   At night a share of the windows glow, chosen per window from a hash, so the
   city lights up unevenly. The skyline (stream.ts) uses the same material. */
import * as THREE from 'three';
import { envHooks, env } from '../render/lighting';

export const STYLE = {
  hdb: 1,
  point: 2,
  glass: 3,
  office: 4,
  shophouse: 5,
  mall: 6,
  industry: 7,
  terminal: 8,
  house: 9,
} as const;

const VERT_HEAD = /* glsl */ `
attribute float aStyle;
varying float vStyle;
varying vec3 vWP;
varying vec3 vWN;
varying float vBase;
varying float vSeed;
`;
const VERT_MAIN = /* glsl */ `
  vec4 fcW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  vWP = fcW.xyz;
  vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
  vStyle = aStyle;
  float fcH = length(instanceMatrix[1].xyz);
  vBase = instanceMatrix[3].y - fcH * 0.5;
  vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
`;
const FRAG_HEAD = /* glsl */ `
uniform float uWin;
uniform vec3 uSky;
varying float vStyle;
varying vec3 vWP;
varying vec3 vWN;
varying float vBase;
varying float vSeed;
float fcHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
`;
/* Runs after the instance colour is applied: sets the window pattern in diffuseColor and the night glow. */
const FRAG_COLOR = /* glsl */ `
  vec3 fcGlow = vec3(0.0);
  {
    vec3 n = normalize(vWN);
    int st = int(vStyle + 0.5);
    if (abs(n.y) > 0.5) {
      diffuseColor.rgb *= 0.82;
    } else if (st > 0) {
      float along = abs(n.x) > abs(n.z) ? vWP.z : vWP.x;
      float y = vWP.y - vBase;
      // Storey height, bay width, window box within a bay (x0, x1, y0, y1), share lit at night.
      float fh = 2.9, cw = 2.2, x0 = 0.2, x1 = 0.8, y0 = 0.35, y1 = 0.8, lit = 0.55;
      vec3 glass = vec3(0.14, 0.18, 0.22);
      bool ground = y < fh;
      if (st == 1 || st == 2) { fh = 2.8; cw = 2.4; x0 = 0.18; x1 = 0.72; y0 = 0.38; y1 = 0.78; lit = 0.6; }
      else if (st == 3) { fh = 3.8; cw = 1.6; x0 = 0.06; x1 = 0.94; y0 = 0.08; y1 = 0.92; lit = 0.35; glass = mix(vec3(0.2, 0.32, 0.38), uSky, 0.45); }
      else if (st == 4) { fh = 3.6; cw = 3.0; x0 = 0.0; x1 = 1.0; y0 = 0.4; y1 = 0.85; lit = 0.4; glass = mix(vec3(0.16, 0.24, 0.3), uSky, 0.3); }
      else if (st == 5) { fh = 3.5; cw = 2.6; x0 = 0.25; x1 = 0.75; y0 = 0.25; y1 = 0.85; lit = 0.5; }
      else if (st == 6) { fh = 5.0; cw = 9.0; x0 = 0.1; x1 = 0.9; y0 = 0.62; y1 = 0.72; lit = 0.8; }
      else if (st == 7) { fh = 6.0; cw = 1.2; x0 = 0.0; x1 = 0.08; y0 = 0.0; y1 = 1.0; lit = 0.0; }
      else if (st == 8) { fh = 6.0; cw = 3.0; x0 = 0.03; x1 = 0.97; y0 = 0.1; y1 = 0.95; lit = 0.9; glass = mix(vec3(0.25, 0.35, 0.42), uSky, 0.5); }
      else if (st == 9) { fh = 3.0; cw = 3.2; x0 = 0.3; x1 = 0.7; y0 = 0.3; y1 = 0.75; lit = 0.6; }
      float fl = floor(y / fh), fu = fract(y / fh);
      float col = floor(along / cw), cu = fract(along / cw);
      bool win = cu > x0 && cu < x1 && fu > y0 && fu < y1;
      // HDB: the ground floor is an open void deck (dark, with pillars); a pale parapet runs along each storey.
      if ((st == 1 || st == 2) && ground) {
        diffuseColor.rgb *= cu < 0.12 ? 1.0 : 0.35;
        win = false;
      } else if ((st == 1 || st == 2) && fu < 0.14) {
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.88), 0.7);
        win = false;
      }
      // Shophouses and malls: a lit shopfront along the ground floor.
      if ((st == 5 || st == 6) && ground) win = fu > 0.05 && fu < 0.75 && cu > 0.06 && cu < 0.94;
      // Industry: corrugated cladding.
      if (st == 7) { diffuseColor.rgb *= win ? 0.8 : 1.0; win = false; }
      if (win) {
        float h = fcHash(vec3(col, fl, vSeed * 97.0));
        bool on = h < lit;
        vec3 warm = mix(vec3(1.0, 0.82, 0.55), vec3(0.85, 0.93, 1.0), step(0.6, fcHash(vec3(fl, col, vSeed))));
        if ((st == 5 || st == 6 || st == 8) && ground) { on = true; warm = vec3(1.0, 0.9, 0.7); }
        diffuseColor.rgb = glass;
        if (on) fcGlow = warm * uWin * 0.9;
      }
    }
  }
`;

function makeFacade() {
  const uniforms = {
    uWin: { value: 0 },
    uSky: { value: new THREE.Color(0.7, 0.8, 0.9) },
  };
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader =
      VERT_HEAD + sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + VERT_MAIN);
    sh.fragmentShader =
      FRAG_HEAD +
      sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fcGlow;',
        );
  };
  m.customProgramCacheKey = () => 'facade';
  return { m, uniforms };
}

export const facade = makeFacade();

// Windows glow with the evening; glass reflects the sky.
envHooks.push((_h, _night, win) => {
  facade.uniforms.uWin.value = win;
  facade.uniforms.uSky.value.copy(env.hor).lerp(env.top, 0.3);
});
