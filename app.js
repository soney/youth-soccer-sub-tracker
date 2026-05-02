const STORAGE_KEY = "youth-soccer-sub-tracker:v1";
const MIN_PLAYERS_ON_FIELD = 1;
const MAX_PLAYERS_ON_FIELD = 18;
const MIN_SUB_INTERVAL_MINUTES = 0;
const MAX_SUB_INTERVAL_MINUTES = 30;
const MINUTE_MS = 60 * 1000;
const MAX_HISTORY_ENTRIES = 120;

const fallbackState = {
  playersOnField: 7,
  subIntervalMinutes: 5,
  lastSubAtGameMs: 0,
  soundEnabled: true,
  gameMs: 0,
  running: false,
  lastTick: null,
  activeView: "field",
  roster: [],
  history: []
};

let state = loadState();
let saveStatusTimer = null;
let audioContext = null;
let subAlertIntervalId = null;
let alertingSubAtGameMs = null;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  gameClock: document.querySelector("#gameClock"),
  startStopButton: document.querySelector("#startStopButton"),
  resetTimesButton: document.querySelector("#resetTimesButton"),
  benchAllButton: document.querySelector("#benchAllButton"),
  decreaseLimit: document.querySelector("#decreaseLimit"),
  increaseLimit: document.querySelector("#increaseLimit"),
  playerLimit: document.querySelector("#playerLimit"),
  fieldCount: document.querySelector("#fieldCount"),
  subTimerPanel: document.querySelector("#subTimerPanel"),
  nextSubClock: document.querySelector("#nextSubClock"),
  subStatus: document.querySelector("#subStatus"),
  decreaseSubInterval: document.querySelector("#decreaseSubInterval"),
  increaseSubInterval: document.querySelector("#increaseSubInterval"),
  subInterval: document.querySelector("#subInterval"),
  subDoneButton: document.querySelector("#subDoneButton"),
  soundAlertButton: document.querySelector("#soundAlertButton"),
  testSoundButton: document.querySelector("#testSoundButton"),
  keeperName: document.querySelector("#keeperName"),
  lineupNotice: document.querySelector("#lineupNotice"),
  playerList: document.querySelector("#playerList"),
  correctionList: document.querySelector("#correctionList"),
  fieldEmptyState: document.querySelector("#fieldEmptyState"),
  historyList: document.querySelector("#historyList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  tabs: document.querySelectorAll(".tab"),
  fieldView: document.querySelector("#fieldView"),
  rosterView: document.querySelector("#rosterView"),
  playerForm: document.querySelector("#playerForm"),
  playerId: document.querySelector("#playerId"),
  playerName: document.querySelector("#playerName"),
  playerNumber: document.querySelector("#playerNumber"),
  savePlayerButton: document.querySelector("#savePlayerButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  bulkNames: document.querySelector("#bulkNames"),
  importBulkButton: document.querySelector("#importBulkButton"),
  rosterList: document.querySelector("#rosterList"),
  clearRosterButton: document.querySelector("#clearRosterButton")
};

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createFallbackState();
    }

    const saved = JSON.parse(raw);
    return {
      ...fallbackState,
      ...saved,
      playersOnField: clampNumber(saved.playersOnField, MIN_PLAYERS_ON_FIELD, MAX_PLAYERS_ON_FIELD, 7),
      subIntervalMinutes: clampNumber(
        saved.subIntervalMinutes,
        MIN_SUB_INTERVAL_MINUTES,
        MAX_SUB_INTERVAL_MINUTES,
        fallbackState.subIntervalMinutes
      ),
      lastSubAtGameMs: Math.min(normalizeMs(saved.lastSubAtGameMs), normalizeMs(saved.gameMs)),
      soundEnabled: saved.soundEnabled !== false,
      gameMs: normalizeMs(saved.gameMs),
      running: Boolean(saved.running),
      lastTick: saved.lastTick ? Number(saved.lastTick) : null,
      activeView: saved.activeView === "roster" ? "roster" : "field",
      roster: Array.isArray(saved.roster) ? saved.roster.map(normalizePlayer) : [],
      history: Array.isArray(saved.history) ? saved.history.map(normalizeHistoryEntry).filter(Boolean) : []
    };
  } catch {
    return createFallbackState();
  }
}

function createFallbackState() {
  return {
    ...fallbackState,
    roster: [],
    history: []
  };
}

function normalizePlayer(player) {
  return {
    id: sanitizeId(player.id || createId()),
    name: String(player.name || "").trim() || "Player",
    number: String(player.number || "").replace(/[^\d]/g, "").slice(0, 3),
    onField: Boolean(player.onField),
    goalie: Boolean(player.goalie),
    fieldMs: normalizeMs(player.fieldMs),
    goalieMs: normalizeMs(player.goalieMs)
  };
}

function sanitizeId(value) {
  const id = String(value).replace(/[^a-zA-Z0-9:._-]/g, "");
  return id || createId();
}

function normalizeHistoryEntry(entry) {
  if (!entry || !entry.message) {
    return null;
  }

  return {
    id: sanitizeId(entry.id || createId()),
    message: String(entry.message).slice(0, 140),
    type: String(entry.type || "info").replace(/[^a-z-]/g, "") || "info",
    gameMs: normalizeMs(entry.gameMs),
    wallTime: normalizeMs(entry.wallTime) || Date.now()
  };
}

function normalizeMs(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

function primeAudio() {
  if (!state.soundEnabled) {
    return;
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  const resume = context.state === "suspended" ? context.resume() : Promise.resolve();
  resume
    .then(() => playTone(context, 660, 0, 0.03, 0.0001))
    .catch(() => {});
}

function playTone(context, frequency, offset, duration, peakGain = 0.28, type = "square") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + offset;
  const stop = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(stop + 0.03);
}

function playAlertSound(force = false) {
  if (!force && !state.soundEnabled) {
    return;
  }

  if (navigator.vibrate) {
    navigator.vibrate([220, 80, 220, 80, 220]);
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  const playPattern = () => {
    playTone(context, 1047, 0, 0.16, 0.32);
    playTone(context, 1568, 0.22, 0.16, 0.32);
    playTone(context, 1047, 0.44, 0.16, 0.32);
    playTone(context, 1568, 0.66, 0.24, 0.32);
  };

  if (context.state === "suspended") {
    context.resume().then(playPattern).catch(() => {});
  } else {
    playPattern();
  }
}

function subAlertIsDue() {
  if (!state.running || !state.soundEnabled || state.subIntervalMinutes === 0) {
    return false;
  }

  const intervalMs = state.subIntervalMinutes * 60 * 1000;
  return getDisplayGameMs() - state.lastSubAtGameMs >= intervalMs;
}

function startSubAlertLoop() {
  if (subAlertIntervalId && alertingSubAtGameMs === state.lastSubAtGameMs) {
    return;
  }

  stopSubAlertLoop();
  alertingSubAtGameMs = state.lastSubAtGameMs;
  playAlertSound();
  subAlertIntervalId = window.setInterval(() => {
    if (!subAlertIsDue()) {
      stopSubAlertLoop();
      return;
    }
    playAlertSound();
  }, 2200);
}

function stopSubAlertLoop() {
  if (subAlertIntervalId) {
    window.clearInterval(subAlertIntervalId);
  }
  subAlertIntervalId = null;
  alertingSubAtGameMs = null;
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

function saveState(showSaved = true) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showSaved) {
      flashSaved();
    }
  } catch {
    elements.saveStatus.textContent = "Unsaved";
  }
}

function flashSaved() {
  window.clearTimeout(saveStatusTimer);
  elements.saveStatus.textContent = "Saved";
  elements.saveStatus.classList.remove("is-saving");
  saveStatusTimer = window.setTimeout(() => {
    elements.saveStatus.textContent = state.running ? "Live" : "Saved";
  }, 900);
}

function accrueTime(now = Date.now()) {
  if (!state.running || !state.lastTick) {
    return;
  }

  const delta = Math.max(0, now - state.lastTick);
  if (!delta) {
    return;
  }

  state.gameMs += delta;
  state.roster.forEach((player) => {
    if (player.onField) {
      player.fieldMs += delta;
    }
    if (player.onField && player.goalie) {
      player.goalieMs += delta;
    }
  });
  state.lastTick = now;
}

function getDisplayMs(player, type, now = Date.now()) {
  const base = type === "goalie" ? player.goalieMs : player.fieldMs;
  if (!state.running || !state.lastTick || !player.onField) {
    return base;
  }

  if (type === "goalie" && !player.goalie) {
    return base;
  }

  return base + Math.max(0, now - state.lastTick);
}

function getDisplayGameMs(now = Date.now()) {
  if (!state.running || !state.lastTick) {
    return state.gameMs;
  }
  return state.gameMs + Math.max(0, now - state.lastTick);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatSignedMinutes(ms) {
  const minutes = Math.abs(Math.round(ms / MINUTE_MS));
  return `${ms >= 0 ? "+" : "-"}${minutes}m`;
}

function formatWallTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function activePlayers() {
  return state.roster.filter((player) => player.onField);
}

function keeper() {
  return state.roster.find((player) => player.onField && player.goalie) || null;
}

function findPlayer(playerId) {
  return state.roster.find((player) => player.id === playerId) || null;
}

function addHistory(message, type = "info") {
  state.history.unshift({
    id: createId(),
    message,
    type,
    gameMs: state.gameMs,
    wallTime: Date.now()
  });
  state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
}

function orderedPlayers(now) {
  return [...state.roster].sort((a, b) => {
    if (a.onField !== b.onField) {
      return a.onField ? -1 : 1;
    }

    const aFieldMs = getDisplayMs(a, "field", now);
    const bFieldMs = getDisplayMs(b, "field", now);
    if (a.onField) {
      if (a.goalie !== b.goalie) {
        return a.goalie ? 1 : -1;
      }
      return (bFieldMs - aFieldMs) || comparePlayerNames(a, b);
    }
    return (aFieldMs - bFieldMs) || comparePlayerNames(a, b);
  });
}

function nextNonKeeperOut(now) {
  return activePlayers()
    .filter((player) => !player.goalie)
    .sort((a, b) => {
      return (getDisplayMs(b, "field", now) - getDisplayMs(a, "field", now)) || comparePlayerNames(a, b);
    })[0] || null;
}

function nextOutCandidate(now) {
  return nextNonKeeperOut(now) || activePlayers()
    .sort((a, b) => {
      return (getDisplayMs(b, "field", now) - getDisplayMs(a, "field", now)) || comparePlayerNames(a, b);
    })[0] || null;
}

function firstName(name) {
  return String(name).trim().split(/\s+/)[0] || "Player";
}

function comparePlayerNames(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function setView(view) {
  state.activeView = view === "roster" ? "roster" : "field";
  elements.fieldView.hidden = state.activeView !== "field";
  elements.rosterView.hidden = state.activeView !== "roster";
  elements.tabs.forEach((tab) => {
    const isActive = tab.dataset.view === state.activeView;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  saveState(false);
}

function render() {
  const now = Date.now();
  const activeCount = activePlayers().length;
  const activeKeeper = keeper();

  elements.gameClock.textContent = formatTime(getDisplayGameMs(now));
  elements.startStopButton.textContent = state.running ? "Stop" : "Start";
  elements.startStopButton.classList.toggle("is-running", state.running);
  elements.saveStatus.textContent = state.running ? "Live" : "Saved";
  elements.playerLimit.textContent = state.playersOnField;
  elements.fieldCount.textContent = `${activeCount} of ${state.playersOnField}`;
  elements.fieldCount.classList.toggle("is-over", activeCount > state.playersOnField);
  elements.decreaseLimit.disabled = state.playersOnField <= MIN_PLAYERS_ON_FIELD;
  elements.increaseLimit.disabled = state.playersOnField >= MAX_PLAYERS_ON_FIELD;
  renderSubTimer(now);
  elements.keeperName.textContent = activeKeeper ? `Keeper: ${activeKeeper.name}` : "No keeper";

  const overLimit = activeCount > state.playersOnField;
  elements.lineupNotice.hidden = !overLimit;
  elements.lineupNotice.textContent = overLimit
    ? `${activeCount - state.playersOnField} over the field limit`
    : "";

  renderPlayerList(now);
  renderCorrectionList(now);
  renderRosterList();
  renderHistoryList();
  elements.fieldEmptyState.hidden = state.roster.length !== 0;
}

function renderSubTimer(now) {
  const intervalMs = state.subIntervalMinutes * 60 * 1000;
  elements.subInterval.textContent = state.subIntervalMinutes > 0 ? `${state.subIntervalMinutes}m` : "Off";
  elements.decreaseSubInterval.disabled = state.subIntervalMinutes <= MIN_SUB_INTERVAL_MINUTES;
  elements.increaseSubInterval.disabled = state.subIntervalMinutes >= MAX_SUB_INTERVAL_MINUTES;
  elements.subDoneButton.disabled = state.subIntervalMinutes === 0;
  elements.soundAlertButton.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
  elements.soundAlertButton.setAttribute("aria-pressed", String(state.soundEnabled));
  elements.soundAlertButton.classList.toggle("is-on", state.soundEnabled);

  if (state.subIntervalMinutes === 0) {
    elements.nextSubClock.textContent = "--:--";
    elements.subStatus.textContent = "Sub timer off";
    elements.subDoneButton.textContent = "Sub Done";
    elements.subTimerPanel.classList.remove("is-due");
    elements.nextSubClock.classList.remove("is-due");
    stopSubAlertLoop();
    return;
  }

  const currentGameMs = getDisplayGameMs(now);
  const elapsedSinceSub = Math.max(0, currentGameMs - state.lastSubAtGameMs);
  const remainingMs = Math.max(0, intervalMs - elapsedSinceSub);
  const isDue = elapsedSinceSub >= intervalMs;

  elements.nextSubClock.textContent = formatTime(remainingMs);
  elements.subStatus.textContent = isDue
    ? "Sub due"
    : `Every ${state.subIntervalMinutes} min`;
  elements.subDoneButton.textContent = isDue ? "Stop Alert" : "Sub Done";
  elements.subTimerPanel.classList.toggle("is-due", isDue);
  elements.nextSubClock.classList.toggle("is-due", isDue);
  syncSubAlertLoop(isDue);
}

function syncSubAlertLoop(isDue) {
  if (!state.running || !state.soundEnabled || !isDue) {
    stopSubAlertLoop();
    return;
  }

  startSubAlertLoop();
}

function renderPlayerList(now) {
  const players = orderedPlayers(now);
  const fieldPlayers = players.filter((player) => player.onField);
  const benchPlayers = players.filter((player) => !player.onField);

  if (!players.length) {
    elements.playerList.innerHTML = "";
    return;
  }

  elements.playerList.innerHTML = [
    renderLineupGroup("field", "On Field", `${fieldPlayers.length} of ${state.playersOnField}`, fieldPlayers, now),
    '<div class="lineup-divider" aria-hidden="true"></div>',
    renderLineupGroup("bench", "Bench", `${benchPlayers.length} waiting`, benchPlayers, now)
  ].join("");
}

function renderLineupGroup(kind, title, countText, players, now) {
  const emptyText = kind === "field" ? "No players on the field" : "No players on the bench";
  const playerCards = players.length
    ? players.map((player) => renderPlayerCard(player, now)).join("")
    : `<div class="lineup-empty">${emptyText}</div>`;

  return `
    <section class="lineup-section is-${kind}" aria-label="${title}">
      <div class="lineup-section-header">
        <h3>${title}</h3>
        <span>${countText}</span>
      </div>
      <div class="lineup-section-list">
        ${playerCards}
      </div>
    </section>
  `;
}

function renderPlayerCard(player, now) {
  const jersey = player.number ? `#${escapeHtml(player.number)}` : "--";
  const displayName = escapeHtml(firstName(player.name));
  const fieldTime = formatTime(getDisplayMs(player, "field", now));
  const activeCount = activePlayers().length;
  const swapTarget = !player.onField && activeCount >= state.playersOnField ? nextOutCandidate(now) : null;
  const canToggle = player.onField || activeCount < state.playersOnField || Boolean(swapTarget);
  const actionLabel = player.onField
    ? `Move ${player.name} to the bench`
    : swapTarget
      ? `Swap ${player.name} in for ${swapTarget.name}`
      : `Move ${player.name} to the field`;

  return `
    <button class="player-card ${player.onField ? "is-field" : "is-bench"}" type="button" data-action="toggle-field" data-id="${player.id}" ${canToggle ? "" : "disabled"} aria-label="${escapeHtml(actionLabel)}">
      <div class="jersey">${jersey}</div>
      <strong class="player-first-name">${displayName}</strong>
      <span class="player-field-time">${fieldTime}</span>
    </button>
  `;
}

function renderCorrectionList(now) {
  if (!state.roster.length) {
    elements.correctionList.innerHTML = '<div class="correction-empty">No players yet</div>';
    return;
  }

  elements.correctionList.innerHTML = orderedPlayers(now).map((player) => {
    const jersey = player.number ? `#${escapeHtml(player.number)}` : "--";
    const name = escapeHtml(firstName(player.name));
    const fieldTime = formatTime(getDisplayMs(player, "field", now));

    return `
      <div class="correction-row">
        <div class="jersey">${jersey}</div>
        <strong>${name}</strong>
        <span>${fieldTime}</span>
        <button class="small-action" type="button" data-action="adjust-time" data-kind="field" data-delta="-${MINUTE_MS}" data-id="${player.id}" aria-label="Subtract 1 minute field time for ${escapeHtml(player.name)}">-1m</button>
        <button class="small-action" type="button" data-action="adjust-time" data-kind="field" data-delta="${MINUTE_MS}" data-id="${player.id}" aria-label="Add 1 minute field time for ${escapeHtml(player.name)}">+1m</button>
      </div>
    `;
  }).join("");
}

function renderHistoryList() {
  elements.clearHistoryButton.disabled = state.history.length === 0;

  if (!state.history.length) {
    elements.historyList.innerHTML = '<div class="history-empty">No substitutions yet</div>';
    return;
  }

  elements.historyList.innerHTML = state.history.slice(0, 80).map((entry) => {
    return `
      <article class="history-item is-${escapeHtml(entry.type)}">
        <div>
          <strong>${escapeHtml(formatTime(entry.gameMs))}</strong>
          <span>${escapeHtml(formatWallTime(entry.wallTime))}</span>
        </div>
        <p>${escapeHtml(entry.message)}</p>
      </article>
    `;
  }).join("");
}

function renderRosterList() {
  elements.rosterList.innerHTML = state.roster.map((player) => {
    const jersey = player.number ? `#${escapeHtml(player.number)}` : "--";
    return `
      <article class="roster-row">
        <div class="jersey">${jersey}</div>
        <div class="roster-name">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${player.number ? `No. ${escapeHtml(player.number)}` : "No number"}</span>
        </div>
        <div class="roster-actions">
          <button class="small-action" type="button" data-action="edit-player" data-id="${player.id}">Edit</button>
          <button class="small-action delete" type="button" data-action="delete-player" data-id="${player.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function toggleTimer() {
  primeAudio();
  if (state.running) {
    accrueTime();
    state.running = false;
    state.lastTick = null;
    stopSubAlertLoop();
  } else {
    state.running = true;
    state.lastTick = Date.now();
    if (state.gameMs === 0) {
      state.lastSubAtGameMs = 0;
    }
  }
  saveState();
  render();
}

function resetTimes() {
  const confirmed = window.confirm("Reset all game, field, goalie times, and history?");
  if (!confirmed) {
    return;
  }

  const now = Date.now();
  state.gameMs = 0;
  state.lastSubAtGameMs = 0;
  state.history = [];
  stopSubAlertLoop();
  state.roster.forEach((player) => {
    player.fieldMs = 0;
    player.goalieMs = 0;
  });
  if (state.running) {
    state.lastTick = now;
  }
  saveState();
  render();
}

function benchAll() {
  const hadActivePlayers = activePlayers().length > 0;
  accrueTime();
  state.roster.forEach((player) => {
    player.onField = false;
    player.goalie = false;
  });
  if (hadActivePlayers) {
    addHistory("Bench all players", "bench");
    resetSubCountdown();
  }
  saveState();
  render();
}

function updateLimit(delta) {
  accrueTime();
  state.playersOnField = clampNumber(
    state.playersOnField + delta,
    MIN_PLAYERS_ON_FIELD,
    MAX_PLAYERS_ON_FIELD,
    fallbackState.playersOnField
  );
  saveState();
  render();
}

function updateSubInterval(delta) {
  accrueTime();
  const previousInterval = state.subIntervalMinutes;
  state.subIntervalMinutes = clampNumber(
    state.subIntervalMinutes + delta,
    MIN_SUB_INTERVAL_MINUTES,
    MAX_SUB_INTERVAL_MINUTES,
    fallbackState.subIntervalMinutes
  );
  if (previousInterval === 0 && state.subIntervalMinutes > 0) {
    state.lastSubAtGameMs = state.gameMs;
  }
  stopSubAlertLoop();
  saveState();
  render();
}

function markSubDone() {
  primeAudio();
  accrueTime();
  resetSubCountdown();
  addHistory("Sub timer reset", "sub");
  saveState();
  render();
}

function resetSubCountdown() {
  state.lastSubAtGameMs = state.gameMs;
  stopSubAlertLoop();
}

function toggleSoundAlerts() {
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled) {
    primeAudio();
  } else {
    stopSubAlertLoop();
  }
  saveState();
  render();
}

function testSoundAlert() {
  state.soundEnabled = true;
  saveState();
  render();
  playAlertSound(true);
}

function adjustPlayerTime(playerId, kind, deltaMs) {
  const player = findPlayer(playerId);
  const prop = kind === "goalie" ? "goalieMs" : "fieldMs";
  if (!player || !Number.isFinite(deltaMs)) {
    return;
  }

  accrueTime();
  const before = player[prop];
  player[prop] = Math.max(0, before + deltaMs);
  if (player[prop] !== before) {
    addHistory(`${player.name} ${formatSignedMinutes(deltaMs)} ${kind === "goalie" ? "goalie" : "field"} time`, "adjust");
    saveState();
  }
  render();
}

function togglePlayerField(playerId) {
  const player = findPlayer(playerId);
  if (!player) {
    return;
  }

  accrueTime();
  const wasOnField = player.onField;
  const swapTarget = !player.onField && activePlayers().length >= state.playersOnField
    ? nextOutCandidate(Date.now())
    : null;
  if (!player.onField && activePlayers().length >= state.playersOnField && !swapTarget) {
    render();
    return;
  }

  if (swapTarget) {
    swapTarget.onField = false;
    swapTarget.goalie = false;
    player.onField = true;
    player.goalie = false;
    addHistory(`${player.name} in, ${swapTarget.name} out`, "sub");
    resetSubCountdown();
    saveState();
    render();
    return;
  }

  player.onField = !player.onField;
  if (!player.onField) {
    player.goalie = false;
  }
  addHistory(`${player.name} ${player.onField ? "to field" : "to bench"}`, player.onField ? "field" : "bench");
  if (wasOnField && !player.onField) {
    resetSubCountdown();
  }
  saveState();
  render();
}

function toggleKeeper(playerId) {
  const player = findPlayer(playerId);
  if (!player || !player.onField) {
    return;
  }

  accrueTime();
  if (player.goalie) {
    player.goalie = false;
    addHistory(`${player.name} removed as keeper`, "keeper");
  } else {
    state.roster.forEach((item) => {
      item.goalie = item.id === playerId;
    });
    addHistory(`${player.name} set as keeper`, "keeper");
  }
  saveState();
  render();
}

function addOrUpdatePlayer(event) {
  event.preventDefault();
  const name = elements.playerName.value.trim();
  const number = elements.playerNumber.value.replace(/[^\d]/g, "").slice(0, 3);
  const id = elements.playerId.value;

  if (!name) {
    elements.playerName.focus();
    return;
  }

  accrueTime();
  if (id) {
    const player = state.roster.find((item) => item.id === id);
    if (player) {
      player.name = name;
      player.number = number;
    }
  } else {
    state.roster.push({
      id: createId(),
      name,
      number,
      onField: false,
      goalie: false,
      fieldMs: 0,
      goalieMs: 0
    });
  }

  clearPlayerForm();
  saveState();
  render();
}

function editPlayer(playerId) {
  const player = state.roster.find((item) => item.id === playerId);
  if (!player) {
    return;
  }

  elements.playerId.value = player.id;
  elements.playerName.value = player.name;
  elements.playerNumber.value = player.number;
  elements.savePlayerButton.textContent = "Save Player";
  elements.cancelEditButton.hidden = false;
  setView("roster");
  elements.playerName.focus();
}

function deletePlayer(playerId) {
  const player = state.roster.find((item) => item.id === playerId);
  if (!player) {
    return;
  }

  const confirmed = window.confirm(`Delete ${player.name} from the roster?`);
  if (!confirmed) {
    return;
  }

  accrueTime();
  state.roster = state.roster.filter((item) => item.id !== playerId);
  clearPlayerForm();
  saveState();
  render();
}

function clearPlayerForm() {
  elements.playerId.value = "";
  elements.playerName.value = "";
  elements.playerNumber.value = "";
  elements.savePlayerButton.textContent = "Add Player";
  elements.cancelEditButton.hidden = true;
}

function importBulkPlayers() {
  const lines = elements.bulkNames.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    elements.bulkNames.focus();
    return;
  }

  accrueTime();
  lines.forEach((line) => {
    const parsed = parsePlayerLine(line);
    if (!parsed.name) {
      return;
    }
    state.roster.push({
      id: createId(),
      name: parsed.name,
      number: parsed.number,
      onField: false,
      goalie: false,
      fieldMs: 0,
      goalieMs: 0
    });
  });

  elements.bulkNames.value = "";
  saveState();
  render();
}

function parsePlayerLine(line) {
  const startingNumber = line.match(/^#?\s*(\d{1,3})\s+(.+)$/);
  if (startingNumber) {
    return {
      number: startingNumber[1],
      name: startingNumber[2].trim()
    };
  }

  const trailingNumber = line.match(/^(.*?)\s+#?(\d{1,3})$/);
  if (trailingNumber) {
    return {
      name: trailingNumber[1].trim(),
      number: trailingNumber[2]
    };
  }

  return {
    name: line,
    number: ""
  };
}

function clearRoster() {
  const confirmed = window.confirm("Clear the roster, all player times, and history?");
  if (!confirmed) {
    return;
  }

  state.roster = [];
  state.gameMs = 0;
  state.lastSubAtGameMs = 0;
  state.history = [];
  stopSubAlertLoop();
  state.running = false;
  state.lastTick = null;
  clearPlayerForm();
  saveState();
  render();
}

function clearHistory() {
  if (!state.history.length) {
    return;
  }

  const confirmed = window.confirm("Clear the substitution history?");
  if (!confirmed) {
    return;
  }

  state.history = [];
  saveState();
  render();
}

function handleActionClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (action === "toggle-field") {
    togglePlayerField(id);
  }
  if (action === "toggle-keeper") {
    toggleKeeper(id);
  }
  if (action === "edit-player") {
    editPlayer(id);
  }
  if (action === "delete-player") {
    deletePlayer(id);
  }
  if (action === "adjust-time") {
    adjustPlayerTime(id, button.dataset.kind, Number(button.dataset.delta));
  }
}

function bindEvents() {
  elements.startStopButton.addEventListener("click", toggleTimer);
  elements.resetTimesButton.addEventListener("click", resetTimes);
  elements.benchAllButton.addEventListener("click", benchAll);
  elements.decreaseLimit.addEventListener("click", () => updateLimit(-1));
  elements.increaseLimit.addEventListener("click", () => updateLimit(1));
  elements.decreaseSubInterval.addEventListener("click", () => updateSubInterval(-1));
  elements.increaseSubInterval.addEventListener("click", () => updateSubInterval(1));
  elements.subDoneButton.addEventListener("click", markSubDone);
  elements.soundAlertButton.addEventListener("click", toggleSoundAlerts);
  elements.testSoundButton.addEventListener("click", testSoundAlert);
  document.addEventListener("pointerdown", primeAudio, { once: true, passive: true });
  document.addEventListener("keydown", primeAudio, { once: true });
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setView(tab.dataset.view);
      render();
    });
  });
  document.querySelectorAll("[data-view-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.viewSwitch);
      render();
    });
  });
  elements.playerList.addEventListener("click", handleActionClick);
  elements.correctionList.addEventListener("click", handleActionClick);
  elements.rosterList.addEventListener("click", handleActionClick);
  elements.playerForm.addEventListener("submit", addOrUpdatePlayer);
  elements.cancelEditButton.addEventListener("click", clearPlayerForm);
  elements.importBulkButton.addEventListener("click", importBulkPlayers);
  elements.clearRosterButton.addEventListener("click", clearRoster);
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      accrueTime();
      saveState(false);
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

bindEvents();
setView(state.activeView);
render();
window.setInterval(render, 1000);
registerServiceWorker();
