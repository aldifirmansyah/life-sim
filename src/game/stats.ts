/* Aldi's wallet and cards, in SGD. More stats (energy, mood, skills) come back
   with the steps that use them (ported from kampung-v1's game/stats.ts). */
import { $ } from '../core/util';
import { sfx } from '../audio/audio';

export const wallet = {
  money: 500,
  /** A local SIM card (SingaTel): the phone works. */
  sim: false,
  /** An EZ-Lah transit card: the fare gates open. */
  card: false,
};

export const sgd = (n: number) => `S$${n.toFixed(2)}`;

/** Pay n dollars if there's enough; false (and nothing paid) otherwise. */
export function spend(n: number): boolean {
  if (wallet.money + 1e-9 < n) return false;
  wallet.money = Math.round((wallet.money - n) * 100) / 100;
  sfx('coin');
  showMoney();
  return true;
}
export function earn(n: number) {
  wallet.money = Math.round((wallet.money + n) * 100) / 100;
  sfx('coin');
  showMoney();
}
export function showMoney() {
  $('money').textContent = sgd(wallet.money);
}

export const saveStats = () => ({ ...wallet });
export function loadStats(d: Partial<typeof wallet> | undefined) {
  if (d) Object.assign(wallet, d);
  showMoney();
}
