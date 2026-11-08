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

  const label = document.createElement("span");
  label.className = "card-label";
  label.textContent = photo.name;
  front.append(image, label);
  inner.append(back, front);
  card.append(inner);
  card.addEventListener("click", () => revealCard(card));
  return card;
}

function newGame() {
  if (photos.length < pairCount) return;
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
  board.classList.toggle("board--4x7", pairCount === 14);
  gameModeLabel.textContent = pairCount === 8 ? "CLÁSSICO · 4×4" : "DESAFIO · 4×7";

  const chosenPhotos = shuffle(photos).slice(0, pairCount);
  const cards = shuffle([...chosenPhotos, ...chosenPhotos]);
  cards.forEach((photo, index) => board.append(createCard(photo, index)));
  updateBestScore();
}

function revealCard(card) {
  if (locked || card === firstCard || card.classList.contains("is-matched") || card.classList.contains("is-flipped")) return;
  startTimer();
  card.classList.add("is-flipped");
  const photo = photos.find((item) => item.id === card.dataset.photo);
  card.setAttribute("aria-label", `${photo?.name || "Foto"}, revelada`);
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
    firstCard.setAttribute("aria-label", `${photo?.name || "Foto"}, par encontrado`);
    card.setAttribute("aria-label", `${photo?.name || "Foto"}, par encontrado`);
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
  winSummary.textContent = `Você encontrou ${pairCount} pares em ${formatTime(seconds)}, com ${moves} movimentos.`;
  window.setTimeout(() => {
    winOverlay.hidden = false;
    document.querySelector("#play-again").focus();
  }, 650);
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
    name: `Foto ${index + 1}`,
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
