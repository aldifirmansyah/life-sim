/* Everything Raka can buy, grow, cook or give (spec §11: ~40 gift items), and
   what each resident thinks of them as a gift. Prices are in rupiah. */
import type { NPC } from '../npc/types';

export type Category = 'drink' | 'snack' | 'meal' | 'ingredient' | 'produce' | 'seed' | 'dish' | 'gift' | 'tool';

export interface Item {
  id: string;
  name: string;
  cat: Category;
  price: number;
  /** Eating or drinking it: energy and mood. Absent = not edible on its own. */
  eat?: { energy: number; mood: number };
  /** Short flavour text for the shop and bag. */
  blurb: string;
}

const I = (id: string, name: string, cat: Category, price: number, blurb: string, eat?: [number, number]): Item => ({
  id,
  name,
  cat,
  price,
  blurb,
  eat: eat && { energy: eat[0], mood: eat[1] },
});

export const ITEMS: Item[] = [
  // Drinks
  I('teh_manis', 'Teh manis', 'drink', 4000, 'Sweet tea in a plastic bag with a straw.', [5, 3]),
  I(
    'kopi_sachet',
    'Kopi sachet',
    'drink',
    3000,
    'Instant coffee, three-in-one. Gets you through the afternoon.',
    [10, 1],
  ),
  I('es_jeruk', 'Es jeruk', 'drink', 5000, 'Iced orange juice, very sweet.', [4, 5]),
  I(
    'kopi_tubruk',
    'Kopi tubruk',
    'drink',
    5000,
    'Thick black coffee with the grounds in. Pak Slamet’s pride.',
    [14, 3],
  ),
  // Snacks
  I('gorengan', 'Gorengan', 'snack', 3000, 'A bag of fried tempe, tahu and bakwan, still warm.', [6, 3]),
  I('kerupuk', 'Kerupuk', 'snack', 1000, 'Crunchy crackers. Goes with everything.', [2, 2]),
  I('permen', 'Permen', 'snack', 1000, 'A handful of fruit sweets. Children’s currency.', [1, 3]),
  I('keripik_pisang', 'Keripik pisang', 'snack', 6000, 'Banana chips, sweet and salty.', [4, 3]),
  I('kue_lapis', 'Kue lapis', 'snack', 12000, 'Nine steamed layers of pandan and rose.', [6, 6]),
  I('klepon', 'Klepon', 'snack', 5000, 'Pandan rice balls with palm sugar that bursts.', [5, 5]),
  I('onde_onde', 'Onde-onde', 'snack', 5000, 'Sesame balls filled with mung bean.', [5, 4]),
  I(
    'martabak_manis',
    'Martabak manis',
    'snack',
    25000,
    'Thick sweet pancake with chocolate and cheese. A crowd-pleaser.',
    [12, 10],
  ),
  I('roti_bakar', 'Roti bakar', 'snack', 12000, 'Toasted bread with condensed milk and chocolate.', [10, 6]),
  // Meals
  I('nasi_uduk', 'Nasi uduk', 'meal', 10000, 'Coconut rice with egg, tempe and sambal, wrapped in paper.', [25, 5]),
  I('nasi_bungkus', 'Nasi bungkus', 'meal', 12000, 'Rice and whatever was cooked today, wrapped to go.', [28, 4]),
  I('mie_rebus', 'Mie rebus', 'meal', 10000, 'Boiled noodles with egg and greens.', [22, 5]),
  I('bakso', 'Bakso', 'meal', 15000, 'Meatball soup with noodles. Mas Joko’s broth is the secret.', [26, 8]),
  // Ingredients (for cooking)
  I('beras', 'Beras', 'ingredient', 14000, 'A kilo of rice.'),
  I('telur', 'Telur', 'ingredient', 8000, 'Four eggs.'),
  I('bawang', 'Bawang', 'ingredient', 5000, 'Shallots and garlic.'),
  I('tempe', 'Tempe', 'ingredient', 5000, 'A block of fresh tempe.'),
  I('tahu', 'Tahu', 'ingredient', 4000, 'Firm tofu.'),
  I('kecap', 'Kecap manis', 'ingredient', 6000, 'Sweet soy sauce. Essential.'),
  I('sayur', 'Sayur asem pack', 'ingredient', 6000, 'Tamarind, long beans, corn, chayote and melinjo, ready to boil.'),
  // Produce
  I('cabai', 'Cabai', 'produce', 6000, 'Bird’s-eye chillies. Handle with care.'),
  I('tomat', 'Tomat', 'produce', 5000, 'Ripe tomatoes.'),
  I('kemangi', 'Kemangi', 'produce', 3000, 'Lemon basil, for sambal and lalapan.'),
  I('pisang', 'Pisang', 'produce', 10000, 'A hand of bananas.', [8, 2]),
  I('mangga', 'Mangga', 'produce', 12000, 'Sweet mangoes from Indramayu.', [6, 5]),
  I('rambutan', 'Rambutan', 'produce', 15000, 'A bunch of hairy red rambutan.', [5, 5]),
  I('jeruk', 'Jeruk', 'produce', 10000, 'Local oranges, green-skinned and sweet.', [5, 4]),
  // Seeds
  I('bibit_cabai', 'Bibit cabai', 'seed', 5000, 'Chilli seedlings. Ready in 4 days if watered.'),
  I('bibit_tomat', 'Bibit tomat', 'seed', 5000, 'Tomato seedlings. Ready in 5 days if watered.'),
  I('bibit_kemangi', 'Bibit kemangi', 'seed', 4000, 'Lemon basil seedlings. Ready in 3 days if watered.'),
  // Home-cooked dishes (berbagi: sharing food wins hearts)
  // Tools for pastimes.
  I('pancing', 'Pancing', 'tool', 35000, 'A bamboo fishing rod with line and hook. The kali has ikan, they say.'),
  I('gitar', 'Gitar bekas', 'tool', 150000, 'A second-hand acoustic guitar. One tuning peg sticks.'),
  I(
    'paket',
    'Paket',
    'tool',
    0,
    'A parcel wrapped in brown paper and raffia, from the notice board. Deliver it (Ask… menu).',
  ),
  I('ikan', 'Ikan mujair', 'produce', 0, 'A fish from the kali. Fry it, or give it to someone who will.'),
  // Brought round by neighbours (never sold).
  I('sayur_lodeh', 'Sayur lodeh', 'meal', 0, 'Vegetables in coconut milk, from a neighbour’s kitchen.', [24, 8]),
  I('nasi_kuning', 'Nasi kuning', 'meal', 0, 'Turmeric rice with egg and serundeng, from a neighbour.', [27, 8]),
  I('kolak', 'Kolak pisang', 'snack', 0, 'Banana and sweet potato in palm-sugar coconut milk.', [10, 8]),
  I('nasi_goreng', 'Nasi goreng', 'dish', 0, 'Home-made fried rice.', [30, 6]),
  I('ikan_goreng', 'Ikan goreng', 'dish', 0, 'Fried kali fish with sambal on the side.', [26, 7]),
  I('tempe_goreng', 'Tempe goreng', 'dish', 0, 'Crispy fried tempe.', [16, 4]),
  I('telur_balado', 'Telur balado', 'dish', 0, 'Eggs in red chilli sauce.', [20, 6]),
  I('sayur_asem', 'Sayur asem', 'dish', 0, 'Sour tamarind vegetable soup.', [22, 7]),
  I('sambal', 'Sambal', 'dish', 0, 'Fresh sambal tomat, ground by hand.', [4, 4]),
  I('pisang_goreng', 'Pisang goreng', 'dish', 0, 'Fried bananas, golden and sweet.', [14, 6]),
  // Small gifts
  I('bunga', 'Bunga', 'gift', 10000, 'A bunch of melati and roses from the pasar.'),
  I('kopi_bubuk', 'Kopi bubuk', 'gift', 20000, 'A pack of ground Java coffee. The good stuff.'),
  I('koran', 'Koran', 'gift', 4000, 'Today’s newspaper.'),
  I('buku_tts', 'Buku TTS', 'gift', 8000, 'A crossword book. Elders love these.'),
  I('bola', 'Bola', 'gift', 25000, 'A proper futsal ball.'),
];
export const ITEM = new Map(ITEMS.map(i => [i.id, i]));
export const item = (id: string) => ITEM.get(id)!;

export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** What each resident loves and dislikes. Likes also come from their conversation topics (see giftReaction). */
const PREFS: Record<string, { loves: string[]; dislikes: string[] }> = {
  bambang: { loves: ['koran', 'kopi_bubuk'], dislikes: ['permen'] },
  ratna: { loves: ['bunga', 'martabak_manis'], dislikes: ['bola'] },
  sri: { loves: ['bunga', 'jeruk'], dislikes: ['kerupuk'] },
  dimas: { loves: ['bola', 'es_jeruk'], dislikes: ['buku_tts'] },
  darto: { loves: ['kopi_bubuk', 'koran'], dislikes: ['permen'] },
  sumi: { loves: ['kue_lapis', 'bunga'], dislikes: ['cabai'] },
  yusuf: { loves: ['kopi_bubuk', 'martabak_manis'], dislikes: ['bunga'] },
  lestari: { loves: ['bunga', 'rambutan'], dislikes: ['kerupuk'] },
  bima: { loves: ['bola', 'permen'], dislikes: ['sayur_asem'] },
  putri: { loves: ['permen', 'klepon'], dislikes: ['sambal'] },
  slamet: { loves: ['martabak_manis', 'rambutan'], dislikes: ['teh_manis'] },
  hartono: { loves: ['koran', 'buku_tts'], dislikes: ['bola'] },
  joko: { loves: ['sambal', 'mangga'], dislikes: ['bunga'] },
  udin: { loves: ['kopi_bubuk', 'roti_bakar'], dislikes: ['bunga'] },
  rahmat: { loves: ['kopi_sachet', 'nasi_bungkus'], dislikes: ['permen'] },
  yati: { loves: ['bunga', 'onde_onde'], dislikes: ['bola'] },
  endang: { loves: ['kue_lapis', 'rambutan'], dislikes: ['koran'] },
  wati: { loves: ['jeruk', 'bunga'], dislikes: ['kopi_sachet'] },
  rizky: { loves: ['mie_rebus', 'kopi_sachet'], dislikes: ['sayur_asem'] },
  nadia: { loves: ['es_jeruk', 'bunga'], dislikes: ['koran'] },
  hasan: { loves: ['jeruk', 'buku_tts'], dislikes: ['permen'] },
  karyo: { loves: ['kopi_bubuk', 'pisang_goreng'], dislikes: ['bunga'] },
  ayu: { loves: ['klepon', 'es_jeruk'], dislikes: ['kopi_sachet'] },
  fajar: { loves: ['martabak_manis', 'es_jeruk'], dislikes: ['buku_tts'] },
};

export type Reaction = 'loved' | 'liked' | 'neutral' | 'disliked';

/** How a resident feels about a gift. */
export function giftReaction(npc: NPC, id: string): Reaction {
  const p = PREFS[npc.id] ?? { loves: [], dislikes: [] };
  const it = item(id);
  if (p.loves.includes(id)) return 'loved';
  if (p.dislikes.includes(id)) return 'disliked';
  // Everyone appreciates home cooking; food lovers like any food; gardeners like seeds and produce.
  if (it.cat === 'dish') return 'liked';
  if (npc.likes.includes('food') && (it.cat === 'snack' || it.cat === 'meal')) return 'liked';
  if (npc.age < 13 && (it.cat === 'snack' || it.cat === 'drink')) return 'liked';
  if ((npc.id === 'darto' || npc.id === 'karyo') && (it.cat === 'seed' || it.cat === 'produce')) return 'liked';
  if (npc.age >= 55 && (it.cat === 'produce' || id === 'kue_lapis')) return 'liked';
  if (it.cat === 'ingredient' || it.cat === 'seed') return 'neutral';
  return 'neutral';
}

/** Who sells what. Vendors only trade while their keeper is there (see ui/activities.ts). */
export const STOCK: Record<string, string[]> = {
  warung: [
    'teh_manis',
    'kopi_sachet',
    'es_jeruk',
    'gorengan',
    'kerupuk',
    'permen',
    'keripik_pisang',
    'nasi_uduk',
    'nasi_bungkus',
    'beras',
    'telur',
    'bawang',
    'tempe',
    'tahu',
    'kecap',
    'cabai',
    'bibit_cabai',
    'bibit_tomat',
    'bibit_kemangi',
    'koran',
    'buku_tts',
    'bola',
    'pancing',
  ],
  pasar: [
    'sayur',
    'tomat',
    'cabai',
    'kemangi',
    'pisang',
    'mangga',
    'rambutan',
    'jeruk',
    'bunga',
    'kue_lapis',
    'klepon',
    'onde_onde',
    'tempe',
    'tahu',
  ],
  warkop: ['kopi_tubruk', 'mie_rebus', 'roti_bakar', 'martabak_manis', 'kopi_bubuk', 'gorengan'],
  bakso: ['bakso', 'kerupuk', 'es_jeruk'],
};
/** Bought at these vendors, food and drink is had on the spot rather than carried. */
export const EAT_HERE: Record<string, string[]> = {
  warkop: ['kopi_tubruk', 'mie_rebus', 'roti_bakar'],
  bakso: ['bakso'],
};

export interface Recipe {
  id: string;
  needs: Record<string, number>;
  portions: number;
  minutes: number;
  /** Cooking level needed to try it. */
  level: number;
}
export const RECIPES: Recipe[] = [
  { id: 'tempe_goreng', needs: { tempe: 1, bawang: 1 }, portions: 3, minutes: 20, level: 1 },
  { id: 'pisang_goreng', needs: { pisang: 1 }, portions: 3, minutes: 20, level: 1 },
  { id: 'nasi_goreng', needs: { beras: 1, telur: 1, bawang: 1, kecap: 1 }, portions: 2, minutes: 30, level: 1 },
  { id: 'sambal', needs: { cabai: 1, tomat: 1, bawang: 1 }, portions: 2, minutes: 15, level: 2 },
  { id: 'telur_balado', needs: { telur: 1, cabai: 1, bawang: 1 }, portions: 2, minutes: 30, level: 2 },
  { id: 'sayur_asem', needs: { sayur: 1, tomat: 1 }, portions: 3, minutes: 45, level: 3 },
  { id: 'ikan_goreng', needs: { ikan: 1, bawang: 1 }, portions: 2, minutes: 25, level: 2 },
];
