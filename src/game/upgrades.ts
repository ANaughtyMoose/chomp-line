export type UpgradeId =
  | 'pyro_carver'
  | 'aurora_glider'
  | 'rail_striker'
  | 'avalanche_stomp'
  | 'decoy_snowman'
  | 'bauble_shield'
  | 'cocoa_magnet';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  tag: string;
  description: string;
  maxLevel: number;
}

export const UPGRADE_CATALOG: UpgradeDef[] = [
  {
    id: 'pyro_carver',
    name: 'Pyro Carver',
    icon: '🔥',
    tag: 'FLAMING TRAIL',
    description:
      'Sharp carves blaze with golden fire, igniting nearby pines into roaring Yule bonfires that scorch and banish the Yeti.',
    maxLevel: 3,
  },
  {
    id: 'aurora_glider',
    name: 'Aurora Glider',
    icon: '🪽',
    tag: 'AIRBORNE FLOW',
    description:
      'Hold Space in mid-air to catch shimmering emerald thermal updrafts, soaring cleanly over forests and multiplying trick scores.',
    maxLevel: 3,
  },
  {
    id: 'rail_striker',
    name: 'Fairy-Light Rail Striker',
    icon: '⚡',
    tag: 'GRIND CHAIN',
    description:
      'Grinding festive wooden rails or clearing candy gates unleashes golden sparks that shatter obstacles ahead into bonus points.',
    maxLevel: 3,
  },
  {
    id: 'avalanche_stomp',
    name: 'Avalanche Stomp',
    icon: '❄️',
    tag: 'TRICK SHOCKWAVE',
    description:
      'Perfect-Stomp landings unleash a powder blast that obliterates nearby rocks & trees and knocks back a lunging Yeti.',
    maxLevel: 3,
  },
  {
    id: 'decoy_snowman',
    name: 'Decoy Snowman',
    icon: '⛄',
    tag: 'YETI BAIT [E]',
    description:
      'Press E (or auto-deploy before a lunge) to toss a festive snowman that stops the Yeti cold for 3.5s. Stacks add +2 charges.',
    maxLevel: 3,
  },
  {
    id: 'bauble_shield',
    name: 'Heirloom Bauble Ward',
    icon: '🎄',
    tag: 'COMBO GUARD',
    description:
      'Orbiting blown-glass ornaments shatter to absorb crashes while keeping your speed and combo multiplier intact.',
    maxLevel: 3,
  },
  {
    id: 'cocoa_magnet',
    name: 'Cocoa Slingshot',
    icon: '☕',
    tag: 'CARVE TURBO',
    description:
      'Carve-Slingshots charge 50% faster with bigger bursts, and steaming hot-cocoa pickups pull straight into your hands.',
    maxLevel: 3,
  },
];

export interface UpgradeState {
  levels: Record<UpgradeId, number>;
  shields: number;
  decoyCharges: number;
  decoyCooldown: number;
}

export function createInitialUpgrades(): UpgradeState {
  return {
    levels: {
      pyro_carver: 0,
      aurora_glider: 0,
      rail_striker: 0,
      avalanche_stomp: 0,
      decoy_snowman: 0,
      bauble_shield: 0,
      cocoa_magnet: 0,
    },
    shields: 0,
    decoyCharges: 0,
    decoyCooldown: 0,
  };
}

export function applyUpgrade(state: UpgradeState, id: UpgradeId): void {
  const def = UPGRADE_CATALOG.find((u) => u.id === id);
  if (!def) return;
  state.levels[id] = Math.min(def.maxLevel, state.levels[id] + 1);
  if (id === 'bauble_shield') state.shields += 1;
  if (id === 'decoy_snowman') state.decoyCharges += 2;
}

export function draftThreeUpgrades(state: UpgradeState): UpgradeDef[] {
  const pool = UPGRADE_CATALOG.filter((u) => state.levels[u.id] < u.maxLevel);
  const source = pool.length >= 3 ? [...pool] : [...UPGRADE_CATALOG];
  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return source.slice(0, 3);
}
