/* The rest of the centre (step 7):
   - Masjid Sultan in Kampong Glam: the wudhu taps by the entrance, the prayer
     hall with the mihrab to the west. Wudhu, then pray the prayer whose time it is
     (Subuh, Zohor, Asar, Maghrib, Isyak); Friday prayers at 13:00. Aldi can also
     pray at home once wudhu is done there (the bathroom tap).
   - Lucky Place on Orchard Road: the ground floor is Singapore's little Indonesia,
     busiest on Sundays: Toko Indonesia, bakso, the remittance counter.
   - Chinatown's street market by the temple (and a quiet visit to the temple),
     Haji Lane's shops, Tekka Centre in Little India, Tiong Bahru Market, and
     window shopping at EON Orchard. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { interiors } from '../interiors/interior';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { S } from '../core/state';
import { passTime } from '../core/time';
import { spend, sgd, addEnergy, addMood } from '../game/stats';
import { weekday } from '../game/calendar';
import { buildHawker } from './hawker';
import { buildShopRow, shopPanel, listMenu, type Shop } from './shops';
import { MOSQUE, LUCKY, CT_MARKET, HAJI_LANE, TEKKA, TB_MARKET } from './sites';
import { TOWNS } from '../city/geo';

export function buildCentre() {
  buildMosque();
  buildLucky();
  buildMarkets();
}

/* ---------- prayer ---------- */

/** Prayer times (Singapore, roughly): [name, from, until]. */
const PRAYERS: [string, number, number][] = [
  ['Subuh', 5 * 60 + 40, 7 * 60],
  ['Zohor', 13 * 60 + 5, 16 * 60 + 25],
  ['Asar', 16 * 60 + 25, 19 * 60 + 10],
  ['Maghrib', 19 * 60 + 10, 20 * 60 + 25],
  ['Isyak', 20 * 60 + 25, 26 * 60],
];
export const faith = { wudhu: -1e9, prayed: [] as string[], day: 0, fridays: 0 };
const prayerNow = () => PRAYERS.find(([, a, b]) => S.time >= a && S.time < b)?.[0] ?? null;
const hasWudhu = () => S.time - faith.wudhu < 180;
function prayedToday() {
  if (faith.day !== S.day) {
    faith.day = S.day;
    faith.prayed = [];
  }
  return faith.prayed;
}
export function takeWudhu() {
  passTime(5, 'Wudhu…', () => {
    faith.wudhu = S.time;
    toast('Wudhu', 'Hands, mouth, nose, face, arms, head, ears, feet. Cool water, a calm mind.', null);
  });
}
export function prayLabel(where: string) {
  const p = prayerNow();
  if (!p || prayedToday().includes(p)) return null;
  const friday = weekday(S.day) === 5 && p === 'Zohor' && where === 'mosque' && S.time < 14 * 60;
  return `${friday ? 'Friday prayers (Jumaat)' : `Pray ${p}`}${hasWudhu() ? '' : ' (wudhu first)'}`;
}
export function pray(where: string) {
  const p = prayerNow();
  if (!p || prayedToday().includes(p)) return;
  if (!hasWudhu()) return toast('Wudhu first', where === 'mosque' ? 'The taps are by the entrance.' : 'At the tap.');
  const friday = weekday(S.day) === 5 && p === 'Zohor' && where === 'mosque' && S.time < 14 * 60;
  passTime(friday ? 45 : 10, friday ? 'Khutbah and Jumaat…' : `${p}…`, () => {
    prayedToday().push(p);
    addMood(friday ? 10 : where === 'mosque' ? 6 : 4);
    addEnergy(2);
    if (friday) faith.fridays++;
    toast(
      friday ? 'Jumaat at Masjid Sultan' : `${p}${where === 'mosque' ? ' at Masjid Sultan' : ''}`,
      prayedToday().length === 5
        ? 'Alhamdulillah, all five today.'
        : friday
          ? 'The hall full to the doors, people from everywhere. Like the mosque at home.'
          : 'A quiet moment in a busy city.',
      'good',
    );
  });
}

function buildMosque() {
  const { x, z, w, d, h } = MOSQUE;
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2;
  const p = new PropSet('mosque');
  const wall = '#efe6cf',
    trim = '#d9b24a';
  p.box(x0, x1, 0, 0.1, z0, z1, '#2f6b4f'); // the carpet
  for (let zz = z0 + 3; zz < z1 - 3; zz += 1.3) p.box(x0 + 3, x1 - 1, 0.1, 0.11, zz - 0.04, zz + 0.04, '#d9b24a'); // saf lines
  p.box(x0 - 0.3, x1 + 0.3, h, h + 0.5, z0 - 0.3, z1 + 0.3, wall);
  p.box(x0 - 0.3, x0, 0, h, z0, z1, wall, { col: true });
  p.box(x1, x1 + 0.3, 0, h, z0, z1, wall, { col: true });
  p.box(x0 - 0.3, x1 + 0.3, 0, h, z0 - 0.3, z0, wall, { col: true });
  // The south front: three arched doorways.
  const doors = [x - 7, x, x + 7];
  let a = x0;
  for (const dx of [...doors, x1 + 1.6]) {
    if (dx - 1.6 > a) p.box(a, dx - 1.6, 0, h, z1, z1 + 0.3, wall, { col: true });
    a = dx + 1.6;
  }
  for (const dx of doors) p.box(dx - 1.6, dx + 1.6, 3.4, h, z1, z1 + 0.3, wall);
  p.box(x0 - 0.3, x1 + 0.3, h - 0.8, h - 0.5, z1 + 0.3, z1 + 0.4, trim);
  // The mihrab (west) and the minbar beside it.
  p.box(x0, x0 + 0.4, 0, 4, z - 1.5, z + 1.5, trim);
  p.box(x0 + 0.4, x0 + 0.5, 0.2, 3.4, z - 1, z + 1, '#2f5d3a');
  p.box(x0 + 0.5, x0 + 2.2, 0, 1.8, z + 2.2, z + 3.2, '#8a6a4a', { col: true });
  // Wudhu taps outside, east of the doors, under a canopy.
  const tx0 = x + 9,
    tz = z1 + 3;
  p.box(tx0 - 3, tx0 + 3, 0, 0.9, tz - 0.3, tz + 0.3, '#c9c4ba', { col: true });
  for (let k = -2; k <= 2; k++) p.box(tx0 + k * 1.2 - 0.05, tx0 + k * 1.2 + 0.05, 0.9, 1.3, tz - 0.1, tz, '#9aa3a9');
  p.box(tx0 - 3.5, tx0 + 3.5, 2.8, 3, tz - 1.5, tz + 1.5, '#2f5d3a');
  p.box(x0, x1, 0, 0.06, z1, z1 + 6, '#d8d2c4'); // the forecourt
  p.build();
  register({
    x: tx0,
    y: 1.1,
    z: tz + 0.2,
    reach: 3,
    size: 2,
    label: () => (hasWudhu() ? null : 'Take wudhu'),
    run: takeWudhu,
  });
  // Anywhere in the hall.
  register({
    x,
    y: 0.6,
    z,
    reach: 20,
    size: 14,
    label: () => (S.inside === 'Masjid Sultan' ? prayLabel('mosque') : null),
    run: () => pray('mosque'),
  });
  interiors.push({
    name: 'Masjid Sultan',
    rooms: [{ name: 'Prayer hall', x0, x1, z0, z1 }],
    props: p,
    door: { update() {} },
    lamp: [x, h - 0.6, z],
    lampOn: () => true,
    amount: 0.8,
    showWithin: 300,
  });
}

/* ---------- Lucky Place ---------- */

const TOKO: Shop = {
  name: 'Toko Indonesia Kak Ana',
  sub: 'Indomie · Kerupuk · Sambal',
  color: '#b8342a',
  hello: '"Dari mana? Oh, Bekasi! Ada Indomie goreng, keripik tempe, sambal bu Rudy. Lengkap!"',
  wares: [
    { name: 'Indomie goreng, a box of 40', price: 18, gift: 'indomie' },
    { name: 'Keripik tempe', price: 5, gift: 'keripik' },
    {
      name: 'Kopi Kapal Api, for the flat',
      price: 7,
      mood: 5,
      note: 'The smell of home. Aldi opens the pack right there.',
    },
    { name: 'Es cendol', price: 3.5, minutes: 10, energy: 6, mood: 6, note: 'Cendol like in Bandung. Almost.' },
  ],
};
const BAKSO: Shop = {
  name: 'Bakso Pak Kumis',
  sub: 'Bakso · Mie ayam · Soto',
  color: '#e07a1f',
  hello: '"Bakso urat? Pedas atau tidak?"',
  wares: [
    {
      name: 'Bakso urat',
      price: 7,
      minutes: 20,
      energy: 26,
      mood: 10,
      note: 'Hot, spicy, the sambal just right. Aldi texts a photo to Ibu.',
    },
    {
      name: 'Mie ayam',
      price: 6.5,
      minutes: 20,
      energy: 25,
      mood: 8,
      note: 'Chicken noodles like the gerobak outside the old office.',
    },
    {
      name: 'Soto Betawi',
      price: 8,
      minutes: 20,
      energy: 27,
      mood: 9,
      note: 'Coconut milk soup from Jakarta. Aldi goes quiet.',
    },
  ],
};
function remit() {
  openPanel({
    title: 'Kirim Uang · remittance',
    sub: 'Lucky Place, level 1',
    body: 'Send money home to the family in Bekasi. The rate is on the board: 1 SGD = 12,100 IDR.',
    rows: [
      ...[100, 300, 500].map(n => ({
        label: `Send ${sgd(n)} home`,
        note: `Rp ${(n * 12100).toLocaleString('id-ID')}`,
        run: () => {
          if (!spend(n)) return toast('Not enough money', `That's ${sgd(n)}.`);
          closePanel();
          addMood(n >= 500 ? 12 : n >= 300 ? 9 : 6);
          toast('Sent home', 'Ibu: "Alhamdulillah, sudah masuk. Jaga kesehatan ya, nak. Jangan lupa makan."', 'msg');
        },
      })),
      { label: 'Not today', run: () => closePanel() },
    ],
  });
}

function buildLucky() {
  const { x0, x1, z0, z1, h } = LUCKY;
  const p = new PropSet('lucky');
  const cx = (x0 + x1) / 2;
  p.box(x0, x1, 0, 0.08, z0, z1, '#cfc6b4');
  p.box(x0 - 0.3, x1 + 0.3, h, h + 0.35, z0 - 0.3, z1 + 0.3, '#d9d2c3');
  p.box(x0 - 0.3, x1 + 0.3, 0, h, z0 - 0.3, z0, '#e6ddc8', { col: true });
  p.box(x0 - 0.3, x0, 0, h, z0, z1, '#e6ddc8', { col: true });
  p.box(x1, x1 + 0.3, 0, h, z0, z1, '#e6ddc8', { col: true });
  p.box(x0, cx - 3, 0, h, z1, z1 + 0.3, '#9fc3d1', { col: true, b: p.glass });
  p.box(cx + 3, x1, 0, h, z1, z1 + 0.3, '#9fc3d1', { col: true, b: p.glass });
  p.box(cx - 3, cx + 3, 3, h, z1, z1 + 0.3, '#9fc3d1', { b: p.glass });
  // Shop units along the back and the sides; the atrium in the middle with a fountain and benches.
  const units: [Shop | null, number, number, number, number, number][] = [
    [TOKO, x0 + 1, x0 + 9, z0, z0 + 5, 1],
    [BAKSO, x0 + 10, x0 + 18, z0, z0 + 5, 1],
    [null, x0 + 19, x1 - 1, z0, z0 + 5, 1],
  ];
  for (const [s, ax, bx, az, bz] of units) {
    if (s) listMenu(s);
    p.box(ax, bx, 0, 3, az, az + 0.3, s ? s.color : '#2f6fb3');
    p.box(ax, bx, 0, 1, bz - 0.6, bz, '#d8d2c4', { col: true });
    const shopX = (ax + bx) / 2;
    sign(
      s
        ? {
            text: s.name,
            sub: s.sub,
            w: bx - ax - 0.6,
            h: 0.6,
            bg: '#1d2b36',
            fg: '#ffffff',
            subfg: '#f2c14e',
            border: s.color,
            font: 'ui',
          }
        : {
            text: 'Kirim Uang',
            sub: 'Remittance · Money changer',
            w: bx - ax - 0.6,
            h: 0.6,
            bg: '#2f6fb3',
            fg: '#ffffff',
            subfg: '#f2c14e',
            border: '#ffffff',
            font: 'ui',
          },
      shopX,
      3.4,
      bz + 0.05,
      0,
    );
    register({
      x: shopX,
      y: 1.2,
      z: bz + 0.2,
      reach: 2.8,
      size: 1.2,
      label: () => (s ? s.name : 'Kirim Uang: send money home'),
      run: () => (s ? shopPanel(s) : remit()),
    });
  }
  p.put(cx, 0.4, (z0 + z1) / 2 + 3, 2.4, 0.8, 2.4, '#c9c4ba', 0, p.cyl);
  p.put(cx, 0.82, (z0 + z1) / 2 + 3, 2, 0.05, 2, '#4fb3d9', 0, p.cyl);
  for (const dx of [-6, 6]) p.box(cx + dx - 1.5, cx + dx + 1.5, 0, 0.45, z1 - 6, z1 - 5.4, '#8a6a4a', { col: true });
  sign(
    {
      text: 'Selamat datang di Lucky Place',
      sub: 'Toko Indonesia · Bakso · Kirim Uang',
      w: 7,
      h: 0.9,
      bg: '#b8342a',
      fg: '#ffffff',
      subfg: '#f2d27a',
      border: '#f2d27a',
      font: 'ui',
    },
    cx,
    4.3,
    z1 - 0.2,
    Math.PI,
  );
  p.build();
  interiors.push({
    name: 'Lucky Place',
    rooms: [{ name: 'Level 1', x0, x1, z0, z1 }],
    props: p,
    door: { update() {} },
    lamp: [cx, h - 0.5, (z0 + z1) / 2],
    lampOn: () => true,
    amount: 0.7,
    showWithin: 200,
  });
}

/* ---------- markets and shops ---------- */

function buildMarkets() {
  // Chinatown's street market, and the temple.
  buildShopRow('chinatown', CT_MARKET, -1, [
    {
      name: 'Tea Chapter',
      sub: 'Oolong · Pu-erh',
      color: '#2f6b4f',
      hello: 'Uncle Lim pours a thimble of tea. "Try first. No need to buy."',
      wares: [
        { name: 'Oolong tea, a tin', price: 15, gift: 'tea' },
        {
          name: 'A pot of tea, sitting down',
          price: 8,
          minutes: 30,
          energy: 5,
          mood: 8,
          note: 'Tiny cups, many refills, slow time.',
        },
      ],
    },
    {
      name: 'Bee Kee Bak Kwa',
      sub: 'Since 1933 · Pork',
      color: '#b8342a',
      hello: '"Bak kwa, very good for gift. Pork ah, just so you know."',
      wares: [{ name: 'Bak kwa, 500 g (a gift)', price: 32, gift: 'bakkwa' }],
    },
    {
      name: 'Lantern & Souvenir',
      sub: 'Fans · Magnets · Lanterns',
      color: '#d9582b',
      wares: [
        {
          name: 'A paper lantern for the room',
          price: 12,
          mood: 4,
          note: 'Red and gold. It will look good by the window.',
        },
      ],
    },
    {
      name: 'Mooncake Corner',
      sub: 'Snow skin · Baked',
      color: '#8a4a2f',
      wares: [{ name: 'Mooncakes, a box of four', price: 38, gift: 'mooncake' }],
    },
  ]);
  const ct = TOWNS.find(t => t.id === 'chinatown')!;
  register({
    x: ct.x,
    y: 1.5,
    z: ct.z + 13,
    reach: 4,
    size: 4,
    label: () => (S.time >= 7 * 60 && S.time < 19 * 60 ? 'Visit the temple (quietly)' : null),
    run: () =>
      passTime(20, 'Incense and chanting…', () => {
        addMood(4);
        toast(
          'Buddha Tooth Relic Temple',
          'Gold, red, incense, the monks chanting. Aldi takes off the shoes and just watches.',
          null,
        );
      }),
  });
  // Haji Lane's shops.
  buildShopRow(
    'haji',
    HAJI_LANE,
    1,
    [
      {
        name: 'Batik Ibrahim',
        sub: 'Batik · Songket',
        color: '#8e44ad',
        hello: 'Ibrahim, grinning: "Batik from Pekalongan, like your side. For you, special price."',
        wares: [
          { name: 'A batik scarf (a gift)', price: 25, gift: 'batik' },
          {
            name: 'A batik shirt for Aldi',
            price: 45,
            mood: 8,
            own: 'batik',
            note: 'For 17 Agustus at the embassy. Aldi looks sharp.',
          },
        ],
      },
      {
        name: 'Kampong Glam Café',
        sub: 'Teh tarik · Murtabak',
        color: '#2f5d3a',
        wares: [
          {
            name: 'Murtabak and teh tarik',
            price: 9,
            minutes: 25,
            energy: 26,
            mood: 7,
            note: 'Crispy, the curry thick. The mosque dome glows across the road.',
          },
        ],
      },
      {
        name: 'Perfume Scents',
        sub: 'Attar · Oud',
        color: '#d9b24a',
        wares: [{ name: 'A little bottle of attar', price: 15, mood: 4, note: 'Sandalwood. For Friday prayers.' }],
      },
      {
        name: 'Haji Lane Records',
        sub: 'Vinyl · Posters',
        color: '#2c3e50',
        wares: [
          {
            name: 'An old Dewa 19 record',
            price: 28,
            mood: 7,
            note: 'Found in a crate. Aldi hums the whole way home.',
          },
        ],
      },
    ],
    { height: 8 },
  );
  // Tekka Centre and Tiong Bahru Market.
  buildHawker({
    name: 'Tekka Centre',
    board: ['Tekka Centre', 'Little India · Market & Food'],
    ...TEKKA,
    stalls: [
      {
        name: 'Allauddin Biryani',
        sub: 'Mutton · Chicken',
        color: '#e0a02a',
        dishes: [
          {
            name: 'Mutton biryani',
            price: 7,
            energy: 30,
            mood: 8,
            note: 'Fragrant rice, tender mutton, a boiled egg.',
          },
        ],
      },
      {
        name: 'Thosai Corner',
        sub: 'Masala · Paper',
        color: '#b8342a',
        dishes: [
          { name: 'Masala thosai', price: 3.5, energy: 20, mood: 5, note: 'Crisp and huge, with three chutneys.' },
        ],
      },
      {
        name: 'Teh Tarik Stall',
        sub: 'Pulled fresh',
        color: '#6b4a2f',
        dishes: [{ name: 'Teh tarik', price: 1.5, energy: 8, mood: 3, note: 'Pulled a metre high.', drink: true }],
      },
      {
        name: 'Garlands',
        sub: 'Jasmine · Marigold',
        color: '#e07a1f',
        dishes: [
          { name: 'A jasmine garland (a gift)', price: 6, energy: 0, mood: 0, note: '', gift: 'garland' },
          { name: 'Flowers, a bunch (a gift)', price: 12, energy: 0, mood: 0, note: '', gift: 'flowers' },
        ],
      },
      {
        name: 'Nasi Padang Sinar',
        sub: 'Masakan Minang',
        color: '#2f8a4e',
        dishes: [
          {
            name: 'Nasi padang',
            price: 6,
            energy: 28,
            mood: 8,
            note: "Good, but Pak Harun's rendang is better. Don't tell anyone.",
          },
        ],
      },
    ],
  });
  buildHawker({
    name: 'Tiong Bahru Market',
    board: ['Tiong Bahru Market', 'Food Centre'],
    ...TB_MARKET,
    stalls: [
      {
        name: 'Jian Bo Chwee Kueh',
        sub: 'Since 1958',
        color: '#3f7fd0',
        dishes: [
          {
            name: 'Chwee kueh, four',
            price: 3,
            energy: 16,
            mood: 6,
            note: 'Soft rice cakes, salty radish on top. Jun Hao was right.',
          },
        ],
      },
      {
        name: 'Lor Mee 178',
        sub: 'Thick gravy',
        color: '#6b3a2a',
        dishes: [
          { name: 'Lor mee', price: 5, energy: 25, mood: 5, note: 'Thick gravy, vinegar, garlic. Heavy but shiok.' },
        ],
      },
      {
        name: 'Tiong Bahru Bakehouse',
        sub: 'Kaya croissants',
        color: '#c9a878',
        dishes: [
          {
            name: 'Kouign-amann and a latte',
            price: 11,
            energy: 18,
            mood: 7,
            note: 'Buttery layers. The hipster side of Singapore.',
          },
          { name: 'Kaya croissants to take away', price: 9, energy: 0, mood: 0, note: '', gift: 'croissant' },
        ],
      },
      {
        name: 'Drinks',
        sub: 'Kopi · Barley',
        color: '#6b4a2f',
        dishes: [
          {
            name: 'Barley water',
            price: 1.8,
            energy: 5,
            mood: 3,
            note: 'Cooling. Aunty says good for the heat.',
            drink: true,
          },
        ],
      },
    ],
  });
  // Window shopping at EON Orchard.
  const or = TOWNS.find(t => t.id === 'orchard')!;
  register({
    x: or.x - 30,
    y: 1.5,
    z: or.z - 14.5,
    reach: 5,
    size: 4,
    label: () => (S.time >= 10 * 60 && S.time < 22 * 60 ? 'Window shopping at EON Orchard' : null),
    run: () =>
      passTime(40, 'Window shopping…', () => {
        addMood(4);
        addEnergy(-4);
        toast(
          'EON Orchard',
          'Aircon, luxury shops, a watch that costs a year of rent. Aldi buys nothing and feels fine.',
          null,
        );
      }),
  });
}

export const saveCentre = () => ({ ...faith, prayed: [...faith.prayed] });
export function loadCentre(d: Partial<typeof faith> | undefined) {
  Object.assign(faith, { wudhu: -1e9, prayed: [], day: 0, fridays: 0 }, d ?? {});
}
