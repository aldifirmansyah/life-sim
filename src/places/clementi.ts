/* 448 Clementi Market & Food Centre, south of Clementi MRT (places/hawker.ts builds it). */
import { buildHawker, type Stall } from './hawker';
import { CLEMENTI_HAWKER } from './sites';

const STALLS: Stall[] = [
  {
    name: 'Ah Seng Chicken Rice',
    sub: 'Since 1983',
    color: '#d9582b',
    dishes: [
      { name: 'Chicken rice', price: 4.5, energy: 25, mood: 5, note: 'Fragrant rice, chilli with ginger. Shiok.' },
    ],
  },
  {
    name: 'Nasi Padang Minang',
    sub: 'Masakan Padang',
    color: '#2f8a4e',
    dishes: [
      {
        name: 'Nasi padang with rendang',
        price: 6,
        energy: 28,
        mood: 10,
        note: 'Rendang like at home in Indonesia. Aldi goes quiet for a moment.',
      },
    ],
  },
  {
    name: 'Clementi Laksa',
    sub: 'Lemak and spicy',
    color: '#e0a02a',
    dishes: [{ name: 'Laksa', price: 5, energy: 25, mood: 6, note: 'Rich coconut broth, cockles, a big spoon.' }],
  },
  {
    name: 'Mee Pok Fishball',
    sub: 'Dry or soup',
    color: '#3f7fd0',
    dishes: [
      { name: 'Mee pok, dry', price: 4, energy: 22, mood: 4, note: 'Springy noodles, vinegar, chilli, fishballs.' },
    ],
  },
  {
    name: 'Prata House',
    sub: 'Kosong · Egg · Plaster',
    color: '#8a4a2f',
    dishes: [
      { name: 'Roti prata, two pieces', price: 3, energy: 18, mood: 4, note: 'Crispy, with fish curry to dip.' },
    ],
  },
  {
    name: 'Kueh & Gifts',
    sub: 'Kueh lapis · Tarts · Puffs',
    color: '#c9493a',
    dishes: [
      { name: 'Kueh lapis, a box', price: 5, energy: 0, mood: 0, note: '', gift: 'kueh' },
      { name: 'Pineapple tarts, a tin', price: 12, energy: 0, mood: 0, note: '', gift: 'tarts' },
      { name: 'Curry puffs, three', price: 3, energy: 0, mood: 0, note: '', gift: 'puff' },
      { name: 'Kopi, takeaway bag', price: 1.4, energy: 0, mood: 0, note: '', gift: 'kopi' },
    ],
  },
  {
    name: 'Kopi & Drinks',
    sub: 'Kopi · Teh · Sugarcane',
    color: '#6b4a2f',
    dishes: [
      { name: 'Kopi', price: 1.4, energy: 10, mood: 2, note: 'Thick and sweet with condensed milk.', drink: true },
      { name: 'Teh tarik', price: 1.6, energy: 8, mood: 3, note: 'Pulled tea, frothy on top.', drink: true },
      {
        name: 'Sugarcane juice',
        price: 2,
        energy: 6,
        mood: 3,
        note: 'Cold and fresh. Good in this heat.',
        drink: true,
      },
    ],
  },
];

export function buildClementi() {
  buildHawker({
    name: '448 Clementi Food Centre',
    board: ['448 Clementi', 'Market & Food Centre'],
    ...CLEMENTI_HAWKER,
    stalls: STALLS,
  });
}
