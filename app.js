const board = document.querySelector("#game-board");
const timerElement = document.querySelector("#timer");
const movesElement = document.querySelector("#moves");
const matchesElement = document.querySelector("#matches");
const pairTotalElement = document.querySelector("#pair-total");
const bestScoreElement = document.querySelector("#best-score");
const winOverlay = document.querySelector("#win-overlay");
const winSummary = document.querySelector("#win-summary");
const soundToggle = document.querySelector("#sound-toggle");
const folderInput = document.querySelector("#photo-folder");
const photoStatus = document.querySelector("#photo-status");
const folderButtonLabel = document.querySelector("#folder-button-label");
const newGameButton = document.querySelector("#new-game");
const startGameButton = document.querySelector("#start-game");
const setupScreen = document.querySelector("#setup-screen");
const gameScreen = document.querySelector("#game-screen");
const gameModeLabel = document.querySelector("#game-mode-label");
const levelButtons = [...document.querySelectorAll(".level-button")];
const leaderboardOverlay = document.querySelector("#leaderboard-overlay");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardStatus = document.querySelector("#leaderboard-status");
const leaderboardTabs = [...document.querySelectorAll(".leaderboard-tab")];
const scoreForm = document.querySelector("#score-submit-form");
const playerNameInput = document.querySelector("#player-name");
const scoreSubmitStatus = document.querySelector("#score-submit-status");
const scoreSubmitButton = document.querySelector("#submit-score");

let photos = [];
let pairCount = 8;
let firstCard = null;
let locked = false;
let moves = 0;
let matches = 0;
let seconds = 0;
let timerId = null;
let soundEnabled = false;
let audioContext = null;
let matchedReveal = null;
let matchedRevealTimeout = null;
let leaderboardPairCount = 8;
let lastRound = null;

const SCORE_BASE = 10000;
const EXTRA_MOVE_PENALTY = 250;
const SECOND_PENALTY = 10;

function getSupabaseConfig() {
  const config = window.REELIX_SUPABASE;
  if (!config || typeof config.url !== "string" || typeof config.publicKey !== "string" || !config.url || !config.publicKey) {
    return null;
  }

  const url = new URL(config.url);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("A URL do Supabase precisa usar HTTPS.");
  }
  const publicKey = config.publicKey.trim();
  const isLegacyAnonKey = publicKey.startsWith("eyJ");
  if (publicKey.startsWith("sb_secret_")) {
    throw new Error("Chaves secret não podem ser usadas no navegador.");
  }
  if (!publicKey.startsWith("sb_publishable_") && !isLegacyAnonKey) {
    throw new Error("Use uma chave publishable ou anon pública do Supabase.");
  }
  if (isLegacyAnonKey) {
    const claims = JSON.parse(atob(publicKey.split(".")[1]));
    if (claims.role !== "anon") throw new Error("Use a chave anon, nunca uma service_role.");
  }
  return { url: url.toString().replace(/\/$/, ""), publicKey, isLegacyAnonKey };
}

function isSupabaseConfigured() {
  try {
    return getSupabaseConfig() !== null;
  } catch (error) {
    console.error("Configuração do Supabase inválida.", error);
    return false;
  }
}

function getSupabaseStatusMessage() {
  try {
    return getSupabaseConfig() ? null : "O placar online ainda não está configurado. Configure a URL e a chave pública no arquivo supabase-config.js.";
  } catch (error) {
    console.error("Configuração do Supabase inválida.", error);
    return error.message;
  }
}

function calculateScore(pairs, moveCount, elapsedSeconds) {
  const extraMoves = Math.max(0, moveCount - pairs);
  return Math.max(0, SCORE_BASE - extraMoves * EXTRA_MOVE_PENALTY - elapsedSeconds * SECOND_PENALTY);
}

function formatScore(score) {
  return new Intl.NumberFormat("pt-BR").format(score);
}

async function requestSupabase(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("O placar online ainda não foi configurado.");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.publicKey,
      ...(config.isLegacyAnonKey ? { Authorization: `Bearer ${config.publicKey}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase respondeu ${response.status}: ${details || response.statusText}`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function renderLeaderboard(rows) {
  leaderboardList.replaceChildren();
  if (rows.length === 0) {
    leaderboardStatus.textContent = "Ainda não há pontuações neste modo. Seja o primeiro!";
    return;
  }

  leaderboardStatus.textContent = `${rows.length} melhores partidas`;
  rows.forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const player = document.createElement("span");
    player.className = "leaderboard-player";
    const name = document.createElement("strong");
    name.textContent = row.player_name;
    const detail = document.createElement("small");
    detail.textContent = `${row.pair_count} pares · ${formatTime(row.elapsed_seconds)} · ${row.moves} jogadas`;
    player.append(name, detail);
    const score = document.createElement("strong");
    score.className = "leaderboard-score";
    score.textContent = formatScore(row.score);
    item.append(rank, player, score);
    leaderboardList.append(item);
  });
}

async function loadLeaderboard(pairs = leaderboardPairCount) {
  leaderboardPairCount = pairs;
  leaderboardTabs.forEach((tab) => {
    const active = Number(tab.dataset.leaderboardPairs) === pairs;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", active.toString());
  });
  leaderboardList.replaceChildren();
  leaderboardStatus.textContent = "Carregando placar…";
  const setupMessage = getSupabaseStatusMessage();
  if (setupMessage) {
    leaderboardStatus.textContent = setupMessage;
    return;
  }

  const mode = pairs === 8 ? "4x4" : "4x6";
  const query = new URLSearchParams({
    select: "player_name,pair_count,score,moves,elapsed_seconds,created_at",
    mode: `eq.${mode}`,
    order: "score.desc,created_at.asc",
    limit: "20"
  });
  try {
    const rows = await requestSupabase(`reelix_scores?${query}`);
    renderLeaderboard(rows);
  } catch (error) {
    console.error("Não foi possível carregar o placar.", error);
    leaderboardStatus.textContent = `Não foi possível carregar o placar: ${error.message}`;
  }
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secondsPart = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secondsPart}`;
}

function updateBestScore() {
  const best = Number(localStorage.getItem(`reelix-best-${pairCount}`));
  bestScoreElement.textContent = best ? `${best} mov.` : "—";
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    seconds += 1;
    timerElement.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function playTone(frequency, duration = 0.09, type = "sine") {
  if (!soundEnabled) return;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;

  audioContext ??= new AudioContextConstructor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.055, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function createCard(photo, index) {
  const card = document.createElement("button");
  card.className = "memory-card";
  card.type = "button";
  card.dataset.photo = photo.id;
  card.setAttribute("aria-label", `Carta ${index + 1}, fechada`);

  const inner = document.createElement("span");
  inner.className = "card-inner";

  const back = document.createElement("span");
  back.className = "card-face card-back";
  back.setAttribute("aria-hidden", "true");
  const glyph = document.createElement("span");
  glyph.className = "card-glyph";
  glyph.textContent = "✳";
  back.append(glyph);

  const front = document.createElement("span");
  front.className = "card-face card-front";
  front.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.className = "card-photo";
  image.src = photo.url;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.onerror = () => {
    image.classList.add("photo-error");
    image.alt = "Não foi possível carregar esta foto";
  };

  front.append(image);
  inner.append(back, front);
  card.append(inner);
  card.addEventListener("click", () => revealCard(card));
  return card;
}

function clearMatchedReveal() {
  if (matchedRevealTimeout !== null) {
    window.clearTimeout(matchedRevealTimeout);
    matchedRevealTimeout = null;
  }
  if (matchedReveal) {
    matchedReveal.getAnimations().forEach((animation) => animation.cancel());
    matchedReveal.remove();
    matchedReveal = null;
  }
}

function showMatchedPhoto(card) {
  clearMatchedReveal();

  const source = card.querySelector(".card-photo");
  if (!source) return;

  const start = card.getBoundingClientRect();
  const aspectRatio = source.naturalWidth && source.naturalHeight
    ? source.naturalWidth / source.naturalHeight
    : start.width / start.height;
  const maxWidth = window.innerWidth * 0.9;
  const maxHeight = window.innerHeight * 0.9;
  const width = Math.min(maxWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;

  const overlay = document.createElement("div");
  overlay.className = "matched-photo-reveal";
  overlay.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.src = source.currentSrc || source.src;
  image.alt = "";
  image.style.left = `${start.left}px`;
  image.style.top = `${start.top}px`;
  image.style.width = `${start.width}px`;
  image.style.height = `${start.height}px`;
  overlay.append(image);
  gameScreen.append(overlay);
  matchedReveal = overlay;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  image.animate([
    { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, borderRadius: "8px" },
    { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, borderRadius: "18px" }
  ], {
    duration: reducedMotion ? 1 : 420,
    easing: "cubic-bezier(.16, 1, .3, 1)",
    fill: "forwards"
  });
  overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: reducedMotion ? 1 : 300,
    easing: "ease-out",
    fill: "forwards"
  });

  matchedRevealTimeout = window.setTimeout(() => {
    if (matchedReveal !== overlay) return;
    const fadeOut = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedMotion ? 1 : 180,
      easing: "ease-in",
      fill: "forwards"
    });
    fadeOut.onfinish = () => {
      if (matchedReveal !== overlay) return;
      overlay.remove();
      matchedReveal = null;
      matchedRevealTimeout = null;
    };
  }, (reducedMotion ? 1 : 420) + 500);
}

function newGame() {
  if (photos.length < pairCount) return;
  clearMatchedReveal();
  lastRound = null;
  stopTimer();
  firstCard = null;
  locked = false;
  moves = 0;
  matches = 0;
  seconds = 0;
  movesElement.textContent = "0";
  matchesElement.textContent = "0";
  timerElement.textContent = "00:00";
  pairTotalElement.textContent = pairCount.toString();
  winOverlay.hidden = true;
  board.replaceChildren();
  board.classList.toggle("board--4x4", pairCount === 8);
  board.classList.toggle("board--4x6", pairCount === 12);
  gameModeLabel.textContent = pairCount === 8 ? "CLÁSSICO · 4×4" : "DESAFIO · 4×6";

  const chosenPhotos = shuffle(photos).slice(0, pairCount);
  const cards = shuffle([...chosenPhotos, ...chosenPhotos]);
  cards.forEach((photo, index) => board.append(createCard(photo, index)));
  updateBestScore();
}

function revealCard(card) {
  if (locked || card === firstCard || card.classList.contains("is-matched") || card.classList.contains("is-flipped")) return;
  startTimer();
  card.classList.add("is-flipped");
  card.setAttribute("aria-label", `Carta revelada`);
  playTone(480);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  moves += 1;
  movesElement.textContent = moves.toString();
  if (firstCard.dataset.photo === card.dataset.photo) {
    firstCard.classList.add("is-matched");
    card.classList.add("is-matched");
    firstCard.setAttribute("aria-label", "Par encontrado");
    card.setAttribute("aria-label", "Par encontrado");
    showMatchedPhoto(card);
    firstCard = null;
    matches += 1;
    matchesElement.textContent = matches.toString();
    playTone(680, 0.16, "triangle");
    if (matches === pairCount) finishGame();
    return;
  }

  locked = true;
  const previousCard = firstCard;
  firstCard = null;
  window.setTimeout(() => {
    previousCard.classList.remove("is-flipped");
    card.classList.remove("is-flipped");
    previousCard.setAttribute("aria-label", "Carta fechada");
    card.setAttribute("aria-label", "Carta fechada");
    locked = false;
  }, 850);
}

function finishGame() {
  stopTimer();
  const bestKey = `reelix-best-${pairCount}`;
  const previousBest = Number(localStorage.getItem(bestKey));
  if (!previousBest || moves < previousBest) localStorage.setItem(bestKey, moves.toString());
  updateBestScore();
  const score = calculateScore(pairCount, moves, seconds);
  lastRound = { pairCount, moves, seconds, score };
  winSummary.textContent = `Você encontrou ${pairCount} pares em ${formatTime(seconds)}, com ${moves} jogadas e ${formatScore(score)} pontos.`;
  playerNameInput.value = localStorage.getItem("reelix-player-name") || "";
  const setupMessage = getSupabaseStatusMessage();
  scoreSubmitButton.disabled = Boolean(setupMessage);
  scoreSubmitStatus.textContent = setupMessage || "Sua pontuação será exibida no ranking público.";
  window.setTimeout(() => {
    winOverlay.hidden = false;
    playerNameInput.focus();
  }, 650);
}

async function submitScore(event) {
  event.preventDefault();
  if (!lastRound || !scoreForm.reportValidity()) return;

  const playerName = playerNameInput.value.trim();
  if (playerName.length < 2 || playerName.length > 20) {
    scoreSubmitStatus.textContent = "Use um nome ou apelido entre 2 e 20 caracteres.";
    return;
  }

  scoreSubmitButton.disabled = true;
  scoreSubmitStatus.textContent = "Salvando sua pontuação…";
  try {
    await requestSupabase("reelix_scores", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        player_name: playerName,
        mode: lastRound.pairCount === 8 ? "4x4" : "4x6",
        pair_count: lastRound.pairCount,
        score: lastRound.score,
        moves: lastRound.moves,
        elapsed_seconds: lastRound.seconds
      })
    });
    localStorage.setItem("reelix-player-name", playerName);
    scoreSubmitStatus.textContent = "Pontuação salva! Boa sorte no ranking.";
    document.querySelector("#leaderboard-from-win").focus();
  } catch (error) {
    console.error("Não foi possível salvar a pontuação.", error);
    scoreSubmitStatus.textContent = `${error.message} Confira a configuração do placar e tente novamente.`;
    scoreSubmitButton.disabled = !isSupabaseConfigured();
  }
}

function openLeaderboard(pairs = pairCount) {
  document.documentElement.classList.add("has-modal");
  document.body.classList.add("has-modal");
  leaderboardTabs.forEach((tab) => {
    const active = Number(tab.dataset.leaderboardPairs) === pairs;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", active.toString());
  });
  leaderboardOverlay.hidden = false;
  document.querySelector("#close-leaderboard").focus();
  loadLeaderboard(pairs);
}

function closeLeaderboard() {
  leaderboardOverlay.hidden = true;
  document.documentElement.classList.remove("has-modal");
  document.body.classList.remove("has-modal");
  document.querySelector("#open-leaderboard").focus();
}

function updatePhotoControls() {
  levelButtons.forEach((button) => {
    const levelPairs = Number(button.dataset.pairs);
    button.disabled = photos.length < levelPairs;
    button.classList.toggle("is-available", photos.length >= levelPairs);
  });
  newGameButton.disabled = photos.length < pairCount;
  startGameButton.disabled = photos.length < pairCount;
}

function choosePhotoFolder() {
  folderInput.click();
}

async function startGame() {
  if (photos.length < pairCount) return;
  setupScreen.hidden = true;
  gameScreen.hidden = false;
  gameScreen.classList.add("is-active");

  try {
    if (typeof gameScreen.requestFullscreen === "function" && !document.fullscreenElement) {
      await gameScreen.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (error) {
    console.info("Modo de tela cheia do navegador indisponível; usando tela expandida.", error);
  }
  newGame();
}

async function exitGame() {
  stopTimer();
  clearMatchedReveal();
  winOverlay.hidden = true;
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.info("Não foi possível sair do modo de tela cheia do navegador.", error);
  }
  gameScreen.classList.remove("is-active");
  gameScreen.hidden = true;
  setupScreen.hidden = false;
}

folderInput.addEventListener("click", () => {
  folderInput.value = "";
});
folderInput.addEventListener("change", () => {
  const acceptedExtensions = /\.(avif|bmp|jpe?g|png|webp)$/i;
  const acceptedTypes = new Set(["image/avif", "image/bmp", "image/jpeg", "image/png", "image/webp"]);
  const files = [...folderInput.files].filter((file) => (
    acceptedTypes.has(file.type) || acceptedExtensions.test(file.name)
  ));

  if (files.length < 8) {
    photoStatus.textContent = photos.length
      ? `A pasta escolhida tem ${files.length} imagens. As ${photos.length} fotos anteriores continuam ativas; selecione uma pasta com pelo menos 8.`
      : `Encontramos ${files.length} imagens. Selecione uma pasta com pelo menos 8 fotos.`;
    photoStatus.classList.add("photo-status--error");
    updatePhotoControls();
    return;
  }

  photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  photos = files.map((file, index) => ({
    id: `photo-${index}`,
    url: URL.createObjectURL(file)
  }));
  folderButtonLabel.textContent = "Trocar pasta de fotos";
  photoStatus.textContent = `${photos.length} fotos prontas.`;
  photoStatus.classList.remove("photo-status--error");
  updatePhotoControls();
  if (photos.length < pairCount) {
    pairCount = 8;
    levelButtons.forEach((button) => {
      const active = Number(button.dataset.pairs) === pairCount;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active.toString());
    });
  }
  updatePhotoControls();
});

document.querySelector("#choose-folder").addEventListener("click", choosePhotoFolder);
document.querySelector("#new-game").addEventListener("click", newGame);
document.querySelector("#play-again").addEventListener("click", newGame);
document.querySelector("#open-leaderboard").addEventListener("click", () => openLeaderboard());
document.querySelector("#close-leaderboard").addEventListener("click", closeLeaderboard);
document.querySelector("#leaderboard-from-win").addEventListener("click", async () => {
  const pairs = lastRound?.pairCount || pairCount;
  await exitGame();
  openLeaderboard(pairs);
});
document.querySelector("#score-submit-form").addEventListener("submit", submitScore);
leaderboardOverlay.addEventListener("click", (event) => {
  if (event.target === leaderboardOverlay) closeLeaderboard();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !leaderboardOverlay.hidden) closeLeaderboard();
});
leaderboardTabs.forEach((tab) => {
  tab.addEventListener("click", () => loadLeaderboard(Number(tab.dataset.leaderboardPairs)));
});
levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    pairCount = Number(button.dataset.pairs);
    levelButtons.forEach((levelButton) => {
      const active = levelButton === button;
      levelButton.classList.toggle("is-active", active);
      levelButton.setAttribute("aria-pressed", active.toString());
    });
    startGameButton.disabled = photos.length < pairCount;
  });
});
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.classList.toggle("is-on", soundEnabled);
  soundToggle.setAttribute("aria-label", soundEnabled ? "Desativar sons" : "Ativar sons");
  soundToggle.title = soundEnabled ? "Desativar sons" : "Ativar sons";
  if (soundEnabled) playTone(540, 0.12);
});

startGameButton.addEventListener("click", startGame);
document.querySelector("#exit-game").addEventListener("click", exitGame);
window.addEventListener("beforeunload", () => {
  photos.forEach((photo) => URL.revokeObjectURL(photo.url));
});

updatePhotoControls();
