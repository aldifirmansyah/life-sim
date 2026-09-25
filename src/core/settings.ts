import { REDUCED } from './util';

export interface Settings {
  /** 0 = low, 1 = medium, 2 = high */
  quality: number;
  sens: number;
  bob: boolean;
  debug: boolean;
  /** 0..1 volumes: everything, ambience, effects and UI. */
  volume: number;
  ambience: number;
  effects: number;
  /** Dialogue typing: 0 slow, 1 normal, 2 fast, 3 instant. */
  textSpeed: number;
}

export const SETTINGS: Settings = {
  quality: 1,
  sens: 1,
  bob: !REDUCED,
  debug: false,
  volume: 0.8,
  ambience: 0.8,
  effects: 0.8,
  textSpeed: 1,
};
try {
  Object.assign(SETTINGS, JSON.parse(localStorage.getItem('kampung-settings') || '{}'));
} catch (e) {
  /* storage unavailable */
}
export const saveSettings = () => {
  try {
    localStorage.setItem('kampung-settings', JSON.stringify(SETTINGS));
  } catch (e) {
    /* storage unavailable */
  }
};
