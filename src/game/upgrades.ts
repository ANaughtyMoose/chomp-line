export type UpgradeId =
  | 'pyro_carver'
  | 'aurora_glider'
  | 'gate_striker'
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
    tag: 'FLAMING SKIS',
    description:
      'Grazing pine trees while carving ignites them into cozy Yule bonfires (+Flow & points) that scorch and stun the Yeti.',
    maxLevel: 3,
  },
  {
    id: 'aurora_glider',
    name: 'Aurora Glider',
    icon: '🪽',
    tag: 'AIRBORNE FLOW',
    description:
      'Hold Space in mid-air to unfurl emerald Aurora wings, soaring effortlessly over forests and multiplying trick scores.',
    maxLevel: 3,
  },
  {
    id: 'gate_striker',
    name: 'Fairy-Light Gate Striker',
    icon: '⚡',
    tag: 'SLALOM ARC',
    description:
      'Slicing through candy-cane slalom gates unleashes golden fairy-light arcs that shatter obstacles ahead into bonus points.',
    maxLevel: 3,
  },
  {
    id: 'avalanche_stomp',
    name: 'Avalanche Stomp',
    icon: '❄️',
    tag: 'TRICK SHOCKWAVE',
    description:
      'Landing a 360°+ mogul spin unleashes a powder blast that clears nearby rocks & trees and knocks back a lunging Yeti.',
    maxLevel: 3,
  },
  {
    id: 'decoy_snowman',
    name: 'Decoy Snowman',
    icon: '⛄',
    tag: 'YETI BAIT [E]',
    description:
      'Press E (or auto-deploy before a bite) to drop a cheerful snowman that distracts the Yeti for 3.5s. Stacks add +2 charges.',
    maxLevel: 3,
  },
  {
    id: 'bauble_shield',
    name: 'Heirloom Bauble Ward',
    icon: '🎄',
    tag: 'COMBO GUARD',
    description:
      'Orbiting blown-glass ornaments shatter to absorb a tree or rock crash while keeping your speed and combo intact.',
    maxLevel: 3,
  },
  {
    id: 'cocoa_magnet',
    name: 'Hot Cocoa Magnet',
    icon: '☕',
    tag: 'FLOW HARVEST',
    description:
      'Pulls steaming hot-cocoa mugs toward you, widens slalom capture, and boosts Flow refill while carving.',
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
      gate_striker: 0,
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
