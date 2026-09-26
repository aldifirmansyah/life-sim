/* Discovery (v2 step 17): things worth finding off the main roads, kept in the
   Explore app on the phone, and marked on the map once found.
   - The makan list: every dish at the hawker centres (and the shops you eat in),
     ticked when eaten there or taken away. Eight tried unlocks an off-menu dish at
     Lau Pa Sat.
   - Community cats (14): in the HDB estates by the void decks, Chinatown, Haji Lane,
     Katong. E to photograph one (found), then to pet.
   - Murals (6): painted walls in the heritage districts (a pattern of tiles each).
   - Viewpoints (13): Level 30 at Won Raffles Place, the two cable-car towers, the
     overhead bridges, the NS Line's platform above Orchard. Found by standing there.
   - Heritage plaques (11): a short history of a place, on a post by it.
   Completing a set earns a title ("kaki") and some mood. Saved. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { hash, rng } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { register } from '../game/interact';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { mapLayers } from '../ui/map';
import { sfx } from '../audio/audio';
import { addMood } from '../game/stats';
import { apps } from '../game/phone';
import { freeAt, bridges, muralSpots, tentSpots } from '../city/gen';
import { NSL } from '../city/mrtdata';
import { regionAt } from '../city/geo';
import { near } from './shops';
import {
  CITY_OFFICE,
  CABLE,
  MOSQUE,
  LAU_PA_SAT,
  TEKKA,
  TB_MARKET,
  KATONG_ROW,
  SILOSO,
  BOAT_QUAY,
  CLEMENTI_HAWKER,
  CT_MARKET,
  HAJI_LANE,
} from './sites';

/* ---------- state ---------- */

const found = {
  tasted: [] as string[],
  cats: [] as number[],
  murals: [] as number[],
  views: [] as number[],
  plaques: [] as number[],
  titles: [] as string[],
  petted: -1,
};

/** Every dish on the makan list: its name and where. Filled by the hawker centres and shops as they're built. */
export const MAKAN: { name: string; where: string }[] = [];
export function addMakan(name: string, where: string) {
  if (!MAKAN.some(m => m.name === name && m.where === where)) MAKAN.push({ name, where });
}
const key = (name: string, where: string) => `${where}|${name}`;
/** A dish eaten (at the table or on the go): ticks it on the makan list. */
export function tasted(name: string, where: string) {
  if (!MAKAN.some(m => m.name === name && m.where === where)) return;
  const k = key(name, where);
  if (found.tasted.includes(k)) return;
  found.tasted.push(k);
  toast('Makan list', `${name} (${where}): ${found.tasted.length} of ${MAKAN.length} tried.`, null);
  if (found.tasted.length === 8)
    toast(
      'A secret at Lau Pa Sat',
      'Word is, the satay uncle cooks something off the menu for regulars. Ask him.',
      'good',
    );
  titles();
}
/** Enough of the makan list for the off-menu dish at Lau Pa Sat. */
export const makanRegular = () => found.tasted.length >= 8;

/* ---------- the finds ---------- */

interface Find {
  name: string;
  x: number;
  z: number;
  y?: number;
  text?: string;
}
const CAT_NAMES = [
  'Oyen',
  'Mimi',
  'Lucky',
  'Tompel',
  'Belang',
  'Kopi',
  'Milo',
  'Snowy',
  'Ah Hock',
  'Putih',
  'Garfield',
  'Boss',
  'Momo',
  'Toast',
];
const cats: Find[] = [];
const murals: (Find & { ry: number })[] = [];
const views: (Find & { r: number })[] = [];
const plaques: Find[] = [];

/** Nudge a spot to the nearest ground free of colliders. */
function freeNear(x: number, z: number, m: number): [number, number] {
  if (freeAt(x, z, m)) return [x, z];
  for (let r = 1.5; r < 12; r += 1.5)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const px = x + Math.cos(a) * r,
        pz = z + Math.sin(a) * r;
      if (freeAt(px, pz, m)) return [px, pz];
    }
  return [x, z];
}

function place() {
  // Cats: by each void-deck tent spot, and three in the old districts.
  const catAt: [string, number, number][] = [
    ...tentSpots.map(t => [t.town, t.x + 7, t.z - 5] as [string, number, number]),
    ['Chinatown', CT_MARKET.x1 + 3, CT_MARKET.z0 - 3],
    ['Haji Lane', HAJI_LANE.x1 + 2, HAJI_LANE.z1 + 3],
    ['Katong', KATONG_ROW.x1 + 2, KATONG_ROW.z0 - 3],
  ];
  catAt.slice(0, CAT_NAMES.length).forEach(([where, x, z], i) => {
    const [px, pz] = freeNear(x, z, 0.4);
    cats.push({ name: `${CAT_NAMES[i]}, the ${where} cat`, x: px, z: pz });
  });
  for (const m of muralSpots) murals.push({ name: `The ${m.name} mural`, x: m.x, z: m.z, ry: m.ry });
  views.push({
    name: 'Level 30, Won Raffles Place',
    x: (CITY_OFFICE.x0 + CITY_OFFICE.x1) / 2,
    z: (CITY_OFFICE.z0 + CITY_OFFICE.z1) / 2,
    y: CITY_OFFICE.floor,
    r: 14,
  });
  views.push({ name: 'The cable car tower, HarbourFront', x: CABLE.ax, z: CABLE.az, y: CABLE.h, r: 7 });
  views.push({ name: 'The cable car tower, Sentosa', x: CABLE.bx, z: CABLE.bz, y: CABLE.h, r: 7 });
  const orchard = NSL.stations.find(s => s.name.includes('Orchard'));
  if (orchard)
    views.push({ name: 'Above Orchard Road (the NS Line platform)', x: orchard.x, z: orchard.z, y: NSL.floor, r: 20 });
  bridges.forEach((b, i) =>
    views.push({ name: `Overhead bridge ${i + 1}, ${regionAt(b.x, b.z)}`, x: b.x, z: b.z, y: 5.6, r: 5 }),
  );
  const P: [string, number, number, string][] = [
    [
      'Masjid Sultan',
      MOSQUE.x + 10,
      MOSQUE.z + MOSQUE.d / 2 + 3,
      'Built in 1824 for Sultan Hussein Shah; the present mosque, with its golden domes, was finished in 1932. The bases of the domes are ringed with glass bottle ends given by the poor, so that everyone could have a part in it.',
    ],
    [
      'Lau Pa Sat',
      LAU_PA_SAT.x - LAU_PA_SAT.w / 2 - 2,
      LAU_PA_SAT.z + LAU_PA_SAT.d / 2 + 2,
      "Telok Ayer Market: a cast-iron octagon made in Glasgow and put up here in 1894. 'Lau pa sat' is Hokkien for 'old market'.",
    ],
    [
      'Raffles Hotel',
      268,
      195,
      'Opened in 1887 by the Armenian Sarkies brothers. The Singapore Sling was first mixed in its Long Bar, around 1915.',
    ],
    [
      'Buddha Tooth Temple, Chinatown',
      64,
      516,
      "Chinatown was set aside for the Chinese community in Raffles' town plan of 1822; the shophouses on its streets date from the 1840s to the 1960s.",
    ],
    [
      'Tekka Centre',
      TEKKA.x + 12,
      TEKKA.z + TEKKA.d / 2 + 2,
      "'Tek kia kha', Hokkien for 'the foot of the bamboo': bamboo once grew on the banks of the Rochor River here. Little India's market has fed the district since 1915.",
    ],
    [
      'Tiong Bahru',
      TB_MARKET.x + 12,
      TB_MARKET.z + TB_MARKET.d / 2 + 2,
      "Singapore's first public housing estate, built by the Singapore Improvement Trust in the 1930s in Streamline Moderne: curved balconies, spiral stairs.",
    ],
    [
      'Katong',
      KATONG_ROW.x0 - 3,
      KATONG_ROW.z0 - 3,
      'Seaside villas and coconut plantations once; the Peranakan shophouses of Joo Chiat and Koon Seng Road keep their bright tiles and pintu pagar half-doors.',
    ],
    [
      'Fort Siloso',
      SILOSO.x + 6,
      SILOSO.z - 8,
      'Built in the 1880s to guard the western approach to Keppel Harbour. In 1942 its guns faced the sea while the invasion came by land.',
    ],
    [
      'Boat Quay',
      BOAT_QUAY.x0 + 20,
      BOAT_QUAY.z0 - 6,
      "Once three quarters of Singapore's shipping was handled here, bumboats packed along the river, until the great clean-up of 1977 to 1987.",
    ],
    [
      'Clementi',
      CLEMENTI_HAWKER.x - CLEMENTI_HAWKER.w / 2 - 3,
      CLEMENTI_HAWKER.z + CLEMENTI_HAWKER.d / 2 + 3,
      'Named after Sir Cecil Clementi, Governor of the Straits Settlements from 1930 to 1934. The new town was built in the late 1970s.',
    ],
    ['Changi', 1250, 20, "Changi Airport opened in 1981, on land reclaimed from the sea at the island's eastern tip."],
  ];
  for (const [name, x, z, text] of P) {
    const [px, pz] = freeNear(x, z, 0.5);
    plaques.push({ name, x: px, z: pz, text });
  }
}

/* ---------- drawing ---------- */

let catMesh: THREE.InstancedMesh;
function catGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, col: string, rx = 0) => {
    g.rotateX(rx).translate(x, y, z);
    const c = new THREE.Color(col);
    const n = g.getAttribute('position').count;
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]),
        3,
      ),
    );
    parts.push(g.toNonIndexed());
  };
  add(new THREE.BoxGeometry(0.22, 0.2, 0.42), 0, 0.2, 0, '#ffffff');
  add(new THREE.BoxGeometry(0.18, 0.16, 0.16), 0, 0.36, 0.24, '#ffffff');
  for (const x of [-0.06, 0.06]) add(new THREE.ConeGeometry(0.035, 0.07, 4), x, 0.47, 0.24, '#ffffff');
  add(new THREE.BoxGeometry(0.16, 0.12, 0.05), 0, 0.22, 0.21, '#f4f1ea');
  add(new THREE.BoxGeometry(0.04, 0.04, 0.3), 0, 0.28, -0.32, '#ffffff', 0.7);
  for (const x of [-0.07, 0.07])
    for (const z of [-0.14, 0.14]) add(new THREE.BoxGeometry(0.05, 0.12, 0.05), x, 0.06, z, '#ffffff');
  for (const x of [-0.045, 0.045]) add(new THREE.BoxGeometry(0.025, 0.025, 0.01), x, 0.39, 0.325, '#2b2622');
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}
function buildCats() {
  catMesh = new THREE.InstancedMesh(catGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), cats.length);
  const m = new THREE.Matrix4();
  cats.forEach((c, i) => {
    const r = rng(hash('cat', i));
    m.makeRotationY(r.range(0, Math.PI * 2)).setPosition(c.x, 0, c.z);
    catMesh.setMatrixAt(i, m);
    catMesh.setColorAt(i, new THREE.Color(r.pick(['#d98a4a', '#8e969c', '#3a3530', '#f4f1ea', '#c9a26a'])));
  });
  catMesh.castShadow = true;
  scene.add(catMesh);
}
/** A mural: a wall and a pattern of painted tiles, one PropSet each, drawn near Aldi. */
function buildMural(m: (typeof murals)[number], i: number) {
  const p = new PropSet('mural-' + i);
  const fx = Math.sin(m.ry),
    fz = Math.cos(m.ry);
  const ax = Math.cos(m.ry),
    az = -Math.sin(m.ry);
  p.put(m.x, 1.7, m.z, 6.4, 3.4, 0.3, '#efe9dc', m.ry);
  const r = rng(hash('mural', i));
  const pal = r.pick([
    ['#d7263d', '#f2c14e', '#2f6fb3', '#f4f1ea', '#3f7d3a'],
    ['#e07a1f', '#8e44ad', '#3fa7d6', '#f2c14e', '#1d2b36'],
    ['#b8342a', '#f4a6b8', '#9fd3c7', '#f6d98b', '#2c3e50'],
  ]);
  const motif = i % 4;
  const W = 12,
    Hh = 6;
  for (let u = 0; u < W; u++)
    for (let v = 0; v < Hh; v++) {
      const cu = (u - W / 2 + 0.5) / (W / 2),
        cv = (v - Hh / 2 + 0.5) / (Hh / 2);
      const k =
        motif === 0
          ? Math.floor(Math.hypot(cu * 1.6, cv) * 3) // a sun
          : motif === 1
            ? (u + v) % 3 // diagonals
            : motif === 2
              ? Math.floor((Math.sin(u * 0.9) * 1.2 + v) / 1.3) // waves
              : Math.abs(u - W / 2) + Math.abs(v - Hh / 2) < 4
                ? 0
                : 2 + ((u + v) % 2); // a diamond
      const col = pal[((k % pal.length) + pal.length) % pal.length];
      const ox = (u - W / 2 + 0.5) * 0.5,
        oy = 0.35 + v * 0.5 + 0.25;
      p.put(m.x + ax * ox + fx * 0.16, oy, m.z + az * ox + fz * 0.16, 0.5, 0.5, 0.03, col, m.ry);
    }
  p.build();
  near.push({ p, x: m.x, z: m.z, r: 220 });
}
function buildPlaques() {
  const p = new PropSet('plaques');
  for (const q of plaques) {
    p.post(q.x, q.z, 0, 1.2, 0.05, '#3a4046');
    p.put(q.x, 1.35, q.z, 0.5, 0.36, 0.05, '#6b4a2a');
  }
  p.build();
  p.show(true);
}

/* ---------- finding ---------- */

function titles() {
  const sets: [string, boolean][] = [
    ['Makan Kaki', found.tasted.length >= Math.min(20, MAKAN.length)],
    ['Cat Kaki', found.cats.length >= cats.length],
    ['Art Kaki', found.murals.length >= murals.length],
    ['Sky Kaki', found.views.length >= 6],
    ['Heritage Kaki', found.plaques.length >= plaques.length],
  ];
  for (const [t, ok] of sets)
    if (ok && !found.titles.includes(t)) {
      found.titles.push(t);
      addMood(10);
      sfx('level');
      toast(`Title: ${t}`, 'In the Explore app. Jun Hao will be impressed.', 'good');
    }
}
function find(list: number[], i: number, what: string, name: string) {
  if (list.includes(i)) return false;
  list.push(i);
  addMood(2);
  sfx('good');
  toast(`Found: ${name}`, `${what} · in the Explore app.`, 'good');
  titles();
  return true;
}

export function buildExplore() {
  place();
  buildCats();
  murals.forEach(buildMural);
  buildPlaques();
  cats.forEach((c, i) =>
    register({
      x: c.x,
      y: 0.35,
      z: c.z,
      reach: 2.6,
      size: 0.5,
      label: () =>
        found.cats.includes(i) ? (found.petted === S.day ? null : `Pet ${c.name.split(',')[0]}`) : 'Photograph the cat',
      run: () => {
        if (!find(found.cats, i, `Community cat ${found.cats.length + 1} of ${cats.length}`, c.name)) {
          found.petted = S.day;
          addMood(1);
          toast(c.name.split(',')[0], 'A slow blink. You are acceptable.', null);
        }
      },
    }),
  );
  murals.forEach((m, i) =>
    register({
      x: m.x + Math.sin(m.ry) * 0.2,
      y: 1.7,
      z: m.z + Math.cos(m.ry) * 0.2,
      reach: 7,
      size: 3,
      label: () => (found.murals.includes(i) ? null : 'Take in the mural'),
      run: () => find(found.murals, i, `Mural ${found.murals.length + 1} of ${murals.length}`, m.name),
    }),
  );
  plaques.forEach((q, i) => {
    register({
      x: q.x,
      y: 1.35,
      z: q.z,
      reach: 2.6,
      size: 0.6,
      label: () => `Heritage plaque: ${q.name}`,
      run: () => {
        find(found.plaques, i, `Plaque ${found.plaques.length + 1} of ${plaques.length}`, q.name);
        openPanel({
          title: q.name,
          sub: 'Heritage plaque',
          body: q.text,
          rows: [{ label: 'OK', run: () => closePanel() }],
        });
      },
    });
    sign(
      {
        text: 'Heritage',
        sub: q.name,
        w: 0.46,
        h: 0.3,
        bg: '#6b4a2a',
        fg: '#f2e2b8',
        subfg: '#f2e2b8',
        border: '#f2e2b8',
        font: 'ui',
      },
      q.x,
      1.36,
      q.z + 0.03,
      0,
      { both: true },
    );
  });
  apps.push({ label: 'Explore', note: 'finds and the makan list', run: exploreApp });
  mapLayers.push((g, P) => {
    const dot = (x: number, z: number, col: string) => {
      const [px, pz] = P(x, z);
      g.beginPath();
      g.arc(px, pz, 3.2, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      g.stroke();
    };
    found.cats.forEach(i => dot(cats[i].x, cats[i].z, '#e07a1f'));
    found.murals.forEach(i => dot(murals[i].x, murals[i].z, '#8e44ad'));
    found.views.forEach(i => dot(views[i].x, views[i].z, '#2f6fb3'));
    found.plaques.forEach(i => dot(plaques[i].x, plaques[i].z, '#6b4a2a'));
  });
}

let acc = 0;
export function updateExplore(dt: number) {
  if (!S.started) return;
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  // Viewpoints: found by standing there.
  views.forEach((v, i) => {
    if (found.views.includes(i)) return;
    if (Math.hypot(player.x - v.x, player.z - v.z) < v.r && Math.abs(player.y - (v.y ?? 0)) < 2.5)
      find(found.views, i, `Viewpoint ${found.views.length + 1} of ${views.length}: what a view`, v.name);
  });
}

/* ---------- the app ---------- */

function exploreApp() {
  const back = () => exploreApp();
  const list = (title: string, items: string[]) =>
    openPanel({ title, sub: 'Explore', body: items.join('\n'), back, rows: [{ label: 'Back', run: back }] });
  const tick = (ok: boolean) => (ok ? '✓' : '·');
  const rows: Row[] = [
    {
      label: 'Makan list',
      note: `${found.tasted.length} / ${MAKAN.length}`,
      run: () => {
        const by = new Map<string, string[]>();
        for (const m of MAKAN) {
          if (!by.has(m.where)) by.set(m.where, []);
          by.get(m.where)!.push(`${tick(found.tasted.includes(key(m.name, m.where)))} ${m.name}`);
        }
        list(
          'Makan list',
          [...by].map(([w, ds]) => `${w}\n${ds.join('\n')}`),
        );
      },
    },
    {
      label: 'Community cats',
      note: `${found.cats.length} / ${cats.length}`,
      run: () =>
        list(
          'Community cats',
          cats.map((c, i) => (found.cats.includes(i) ? `✓ ${c.name}` : `· a cat in ${regionAt(c.x, c.z)}`)),
        ),
    },
    {
      label: 'Murals',
      note: `${found.murals.length} / ${murals.length}`,
      run: () =>
        list(
          'Murals',
          murals.map((m, i) => (found.murals.includes(i) ? `✓ ${m.name}` : `· somewhere in ${regionAt(m.x, m.z)}`)),
        ),
    },
    {
      label: 'Viewpoints',
      note: `${found.views.length} / ${views.length}`,
      run: () =>
        list(
          'Viewpoints',
          views.map((v, i) => (found.views.includes(i) ? `✓ ${v.name}` : `· up high in ${regionAt(v.x, v.z)}`)),
        ),
    },
    {
      label: 'Heritage plaques',
      note: `${found.plaques.length} / ${plaques.length}`,
      run: () =>
        list(
          'Heritage plaques',
          plaques.map((q, i) => (found.plaques.includes(i) ? `✓ ${q.name}` : `· ${regionAt(q.x, q.z)}`)),
        ),
    },
    {
      label: 'Titles',
      note: `${found.titles.length} / 5`,
      run: () =>
        list('Titles', [
          found.titles.length ? found.titles.map(t => `★ ${t}`).join('\n') : 'None yet.',
          '',
          'Makan Kaki: 20 dishes. Cat Kaki: every cat. Art Kaki: every mural. Sky Kaki: 6 viewpoints. Heritage Kaki: every plaque.',
        ]),
    },
    { label: 'Back', run: () => closePanel() },
  ];
  openPanel({ title: 'Explore', sub: 'What you have found around Singapore', rows });
}

export const saveExplore = () => JSON.parse(JSON.stringify(found));
export function loadExplore(d: Partial<typeof found> | undefined) {
  Object.assign(found, { tasted: [], cats: [], murals: [], views: [], plaques: [], titles: [], petted: -1 }, d ?? {});
}
export const exploreDebug = { found, cats, murals, views, plaques };
