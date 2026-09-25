/* The phone (P): a few apps as a panel. HomeLah (rooms for rent) and the bank
   balance for now; ride-hail comes with step 10. Needs the SIM card. */
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { wallet, sgd } from './stats';
import { SALARY, job } from './work';

/** Apps added by later steps. */
export const apps: { label: string; note?: string; run: () => void }[] = [];

export function openPhone() {
  if (!wallet.sim) return toast('No signal', 'Get a local SIM card first (8-Twelve at the airport).');
  const rows: Row[] = [
    ...apps,
    {
      label: 'Bank',
      note: sgd(wallet.money),
      run: () =>
        openPanel({
          title: 'Bank',
          sub: 'Savings account',
          body: `Balance ${sgd(wallet.money)}.${job.pass ? ` Salary ${sgd(SALARY)} on the 25th.` : ''}`,
          back: openPhone,
          rows: [{ label: 'Back', run: openPhone }],
        }),
    },
    { label: 'Put the phone away', run: () => closePanel() },
  ];
  openPanel({ title: 'Phone', sub: 'SingaTel · 4G', rows });
}
