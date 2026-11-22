import './style.css';
import { ChompLineGame, GameMode } from './game/game';
import { UPGRADE_CATALOG, UpgradeDef, UpgradeState } from './game/upgrades';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const hudLeft = document.getElementById('hud-left')!;
const hudRight = document.getElementById('hud-right')!;
const zoneName = document.getElementById('zone-name')!;
const zoneDot = document.getElementById('zone-dot')!;
const comboPill = document.getElementById('combo-pill')!;
const flowFill = document.getElementById('flow-fill')!;
const flowPct = document.getElementById('flow-pct')!;
const chompLabel = document.getElementById('chomp-label')!;
const chompDist = document.getElementById('chomp-dist')!;
const chompFill = document.getElementById('chomp-fill')!;
const gearBar = document.getElementById('gear-bar')!;

const hudDist = document.getElementById('hud-dist')!;
const hudSpeed = document.getElementById('hud-speed')!;
const hudScore = document.getElementById('hud-score')!;
const hudBest = document.getElementById('hud-best')!;

const touchControls = document.getElementById('touch-controls')!;
const touchJump = document.getElementById('touch-jump')!;
const touchBoost = document.getElementById('touch-boost')!;
const touchDecoy = document.getElementById('touch-decoy')!;
const touchDecoyLbl = document.getElementById('touch-decoy-lbl')!;
const touchSteerHint = document.getElementById('touch-steer-hint')!;

const yetiAlert = document.getElementById('yeti-alert')!;
const yetiAlertText = document.getElementById('yeti-alert-text')!;
const milestoneBanner = document.getElementById('milestone-banner')!;
const milestoneEyebrow = document.getElementById('milestone-eyebrow')!;
const milestoneTitle = document.getElementById('milestone-title')!;
const milestoneSub = document.getElementById('milestone-sub')!;
const toastLayer = document.getElementById('toast-layer')!;

const titleScreen = document.getElementById('title-screen')!;
const titleBest = document.getElementById('title-best')!;
const upgradeScreen = document.getElementById('upgrade-screen')!;
const upgradeEyebrow = document.getElementById('upgrade-eyebrow')!;
const upgradeCards = document.getElementById('upgrade-cards')!;
const pauseScreen = document.getElementById('pause-screen')!;
const gameoverScreen = document.getElementById('gameover-screen')!;

const passStamp = document.getElementById('pass-stamp')!;
const passHeadline = document.getElementById('pass-headline')!;
const statDist = document.getElementById('stat-dist')!;
const statScore = document.getElementById('stat-score')!;
const statTricks = document.getElementById('stat-tricks')!;
const statBest = document.getElementById('stat-best')!;
const passGear = document.getElementById('pass-gear')!;

const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnResume = document.getElementById('btn-resume')!;
const btnRestartPause = document.getElementById('btn-restart-pause')!;
const btnRetry = document.getElementById('btn-retry')!;
const btnMusic = document.getElementById('btn-music')!;
const btnSfx = document.getElementById('btn-sfx')!;
const btnPause = document.getElementById('btn-pause')!;

const isTouchDevice =
  window.matchMedia('(pointer: coarse)').matches ||
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0;

function renderGearChips(container: HTMLElement, upgrades: UpgradeState): void {
  const active = UPGRADE_CATALOG.filter((u) => upgrades.levels[u.id] > 0);
  if (active.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = active
    .map((u) => {
      let extra = `Lv ${upgrades.levels[u.id]}`;
      if (u.id === 'bauble_shield') extra = `×${upgrades.shields}`;
      if (u.id === 'decoy_snowman') extra = `×${upgrades.decoyCharges}`;
      return `<div class="gear-chip"><span>${u.icon}</span><span>${u.name}</span><span class="gear-lvl">${extra}</span></div>`;
    })
    .join('');
}

let lastGearHash = '';
let milestoneTimeout: number | null = null;
let touchHintHidden = false;

const game = new ChompLineGame(canvas, {
  onHudUpdate(data) {
    hudDist.textContent = `${data.distance.toLocaleString()} m`;
    hudScore.textContent = `${data.score.toLocaleString()} pts`;
    hudBest.textContent = `Best ${data.bestDistance.toLocaleString()} m`;

    if (data.isMaxSpeed) {
      hudSpeed.textContent = 'MAX';
      hudSpeed.classList.add('max-speed');
    } else {
      hudSpeed.textContent = `${Math.round(data.speedMps * 2.2)} mph`;
      hudSpeed.classList.remove('max-speed');
    }

    flowFill.style.width = `${data.flow}%`;
    flowFill.classList.toggle('boosting', data.boosting);
    flowPct.textContent = `${data.flow}%`;

    // Show real Yeti Lead bar before chase, turning ACTIVE once Yeti is on your tail!
    if (data.yetiActive) {
      chompLabel.textContent = 'The Chomp Line';
      chompDist.textContent = 'ACTIVE';
      chompFill.style.width = '100%';
      chompFill.classList.add('active');
    } else {
      chompLabel.textContent = 'Yeti Lead';
      chompDist.textContent = `${Math.max(0, Math.round(data.yetiLeadMeters))} m`;
      const pct = Math.max(0, Math.min(100, (data.yetiLeadMeters / 2000) * 100));
      chompFill.style.width = `${pct}%`;
      chompFill.classList.toggle('active', data.yetiLeadMeters < 350);
    }

    zoneName.textContent = data.sectorName;
    zoneDot.style.background = data.sectorColor;
    zoneDot.style.boxShadow = `0 0 12px ${data.sectorColor}`;

    comboPill.classList.toggle('hidden', data.comboMult <= 1.05);
    comboPill.textContent = `×${data.comboMult.toFixed(1)}`;

    yetiAlert.classList.toggle('hidden', !data.yetiActive);
    yetiAlertText.textContent = data.yetiAlertText;

    // Show touch decoy button whenever player has charges
    const hasDecoy = data.upgrades.decoyCharges > 0;
    touchDecoy.classList.toggle('hidden', !hasDecoy);
    if (hasDecoy) touchDecoyLbl.textContent = `×${data.upgrades.decoyCharges}`;

    if (!touchHintHidden && data.distance > 120) {
      touchHintHidden = true;
      touchSteerHint.style.opacity = '0';
    }

    const hash = `${JSON.stringify(data.upgrades.levels)}-${data.upgrades.shields}-${data.upgrades.decoyCharges}`;
    if (hash !== lastGearHash) {
      lastGearHash = hash;
      renderGearChips(gearBar, data.upgrades);
    }
  },

  onToast(text, variant = 'default') {
    const el = document.createElement('div');
    el.className = `toast ${variant}`;
    el.textContent = text;
    el.style.left = `${48 + (Math.random() - 0.5) * 14}%`;
    toastLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 1180);
  },

  onMilestone(eyebrow, title, sub) {
    milestoneEyebrow.textContent = eyebrow;
    milestoneTitle.textContent = title;
    milestoneSub.textContent = sub;
    milestoneBanner.classList.remove('hidden');
    if (milestoneTimeout !== null) window.clearTimeout(milestoneTimeout);
    milestoneTimeout = window.setTimeout(() => {
      milestoneBanner.classList.add('hidden');
    }, 2800);
  },

  onShowUpgradeDraft(distance, choices: UpgradeDef[]) {
    upgradeEyebrow.textContent = `ALPINE LODGE • ${distance.toLocaleString()} m`;
    upgradeCards.innerHTML = '';
    choices.forEach((def, idx) => {
      const btn = document.createElement('button');
      btn.className = 'upgrade-card';
      btn.innerHTML = `
        <span class="upgrade-key desktop-only">${idx + 1}</span>
        <div class="upgrade-icon">${def.icon}</div>
        <div class="upgrade-tag">${def.tag}</div>
        <div class="upgrade-name">${def.name}</div>
        <div class="upgrade-desc">${def.description}</div>
      `;
      btn.addEventListener('click', () => game.selectUpgrade(def.id));
      upgradeCards.appendChild(btn);
    });
  },

  onGameOver(summary) {
    passStamp.textContent = `Chomped at ${summary.distance.toLocaleString()} m`;
    passHeadline.textContent =
      summary.distance >= 3000
        ? 'Legend of the Chomp Line'
        : summary.distance >= 2000
          ? 'Braved the Chomp Line'
          : 'Caught by the Yeti';
    statDist.textContent = `${summary.distance.toLocaleString()} m`;
    statScore.textContent = summary.score.toLocaleString();
    statTricks.textContent = String(summary.tricksAndOutplays);
    statBest.textContent = `${summary.bestDistance.toLocaleString()} m`;
    renderGearChips(passGear, summary.upgrades);
  },

  onModeChange(mode: GameMode) {
    if (mode !== 'loading') {
      btnPlay.disabled = false;
      btnPlay.textContent = 'Drop In & Ski';
    }

    const showHud = mode === 'playing' || mode === 'upgrading' || mode === 'paused';
    hudLeft.classList.toggle('hidden', !showHud);
    hudRight.classList.toggle('hidden', !showHud);
    touchControls.classList.toggle('hidden', !(isTouchDevice && mode === 'playing'));
    if (mode !== 'playing') yetiAlert.classList.add('hidden');

    titleScreen.classList.toggle('hidden', mode !== 'title' && mode !== 'loading');
    upgradeScreen.classList.toggle('hidden', mode !== 'upgrading');
    pauseScreen.classList.toggle('hidden', mode !== 'paused');
    gameoverScreen.classList.toggle('hidden', mode !== 'gameover');

    if (mode === 'title') {
      titleBest.textContent = `Best Descent: ${game.getBestDistance().toLocaleString()} m`;
    }
  },
});

titleBest.textContent = `Best Descent: ${game.getBestDistance().toLocaleString()} m`;

btnPlay.addEventListener('click', () => {
  if (game.getMode() === 'title') game.startNewRun();
});
btnResume.addEventListener('click', () => game.resumeGame());
btnRestartPause.addEventListener('click', () => game.startNewRun());
btnRetry.addEventListener('click', () => game.startNewRun());

btnPause.addEventListener('click', () => {
  if (game.getMode() === 'playing') game.pauseGame();
  else if (game.getMode() === 'paused') game.resumeGame();
});

btnMusic.addEventListener('click', () => {
  const muted = game.sound.toggleMusic();
  btnMusic.classList.toggle('muted', muted);
});

btnSfx.addEventListener('click', () => {
  const muted = game.sound.toggleSfx();
  btnSfx.textContent = muted ? '🔇' : '🔊';
  btnSfx.classList.toggle('muted', muted);
});

// Ergonomic iPhone / Touch Button Bindings (multi-touch friendly!)
const bindHoldBtn = (el: HTMLElement, onDown: () => void, onUp: () => void) => {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('active');
    onDown();
  });
  const release = (e: Event) => {
    e.preventDefault();
    el.classList.remove('active');
    onUp();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
};

bindHoldBtn(
  touchJump,
  () => game.setTouchJump(true),
  () => game.setTouchJump(false)
);
bindHoldBtn(
  touchBoost,
  () => game.setTouchBoost(true),
  () => game.setTouchBoost(false)
);
touchDecoy.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  game.triggerTouchDecoy();
});
