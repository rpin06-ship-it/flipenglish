// ---------- Raccourcis vers les éléments de la page ----------
const $ = (id) => document.getElementById(id);

const views = {
  home: $('home-view'),
  study: $('study-view'),
  summary: $('summary-view'),
};

const card = $('card');
const flipBtn = $('flip-btn');
const answerBtns = $('answer-btns');
const speakBtn = $('speak-btn');

// ---------- Progression (enregistrée dans le navigateur) ----------
// Format : { "animaux": ["dog", "cat"], ... } = mots que l'utilisateur sait.
const STORAGE_KEY = 'flipenglish-progress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {}; // navigation privée ou stockage bloqué : on repart de zéro
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Pas grave : l'application marche, la progression ne sera juste pas gardée.
  }
}

function setKnown(themeId, englishWord, isKnown) {
  const known = new Set(progress[themeId] || []);
  if (isKnown) known.add(englishWord);
  else known.delete(englishWord);
  progress[themeId] = [...known];
  saveProgress();
}

let progress = loadProgress();
let levels = []; // niveaux et thèmes reçus du serveur

// Pourcentage du niveau précédent à maîtriser pour débloquer le suivant.
const UNLOCK_THRESHOLD = 0.8;

// ---------- État de la séance de révision ----------
let session = null;
// session = {
//   theme,          le thème complet (avec ses mots)
//   queue,          cartes restant à voir, la première est affichée
//   firstTry,       Map mot -> true/false selon la première réponse
//   done,           nombre de cartes validées avec "Je savais"
//   flipped,        la carte actuelle est-elle retournée ?
// }

// ---------- Navigation entre les écrans ----------
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  window.scrollTo(0, 0);
}

// ---------- Accueil ----------
async function loadLevels() {
  try {
    const res = await fetch('/api/levels');
    if (!res.ok) throw new Error();
    levels = await res.json();
    renderHome();
  } catch {
    const error = $('home-error');
    error.textContent = 'Impossible de charger les thèmes. Vérifie ta connexion puis recharge la page.';
    error.hidden = false;
  }
}

// Nombre de mots sus dans un thème (jamais plus que le nombre de mots du thème).
function knownCount(theme) {
  return Math.min((progress[theme.id] || []).length, theme.count);
}

// Mots sus et mots au total pour un niveau entier.
function levelStats(level) {
  let known = 0;
  let total = 0;
  level.themes.forEach((theme) => {
    known += knownCount(theme);
    total += theme.count;
  });
  return { known, total };
}

function createThemeCard(theme, locked) {
  const known = knownCount(theme);
  const percent = Math.round((known / theme.count) * 100);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-card';
  button.disabled = locked;
  button.style.setProperty('--theme-color', theme.color);
  button.innerHTML = `
    <div class="theme-top">
      <span class="theme-emoji">${locked ? '🔒' : theme.emoji}</span>
      <div>
        <div class="theme-name">${theme.name}</div>
        <div class="theme-meta">${known} / ${theme.count} mots appris</div>
      </div>
      ${percent === 100 ? '<span class="badge">Maîtrisé</span>' : ''}
    </div>
    <div class="bar" aria-label="${percent} % appris">
      <div class="bar-fill" style="width: ${percent}%"></div>
    </div>
  `;
  if (!locked) button.addEventListener('click', () => startTheme(theme.id));
  return button;
}

function renderHome() {
  const container = $('levels');
  container.innerHTML = '';

  let totalWords = 0;
  let totalKnown = 0;
  let previous = null; // statistiques du niveau précédent

  levels.forEach((level) => {
    const stats = levelStats(level);
    totalWords += stats.total;
    totalKnown += stats.known;

    // Le premier niveau est toujours ouvert ; les suivants demandent 80 % du précédent.
    const needed = previous ? Math.ceil(previous.total * UNLOCK_THRESHOLD) : 0;
    const locked = previous !== null && previous.known < needed;

    const section = document.createElement('section');
    section.className = `level${locked ? ' is-locked' : ''}`;

    const header = document.createElement('div');
    header.className = 'level-header';
    header.innerHTML = `
      <h2 class="level-title">${level.emoji} ${level.name}</h2>
      <span class="level-count">${stats.known} / ${stats.total} mots</span>
    `;
    section.appendChild(header);

    if (locked) {
      const hint = document.createElement('p');
      hint.className = 'level-lock';
      hint.textContent = `🔒 Maîtrise encore ${needed - previous.known} mot${needed - previous.known > 1 ? 's' : ''} du niveau ${previous.name} pour débloquer ce niveau.`;
      section.appendChild(hint);
    }

    const grid = document.createElement('div');
    grid.className = 'theme-grid';
    level.themes.forEach((theme) => grid.appendChild(createThemeCard(theme, locked)));
    section.appendChild(grid);

    container.appendChild(section);
    previous = { ...stats, name: level.name };
  });

  $('overall-count').textContent = `${totalKnown} / ${totalWords} mots`;
  $('overall-bar').style.width = totalWords ? `${(totalKnown / totalWords) * 100}%` : '0';
}

function goHome() {
  window.speechSynthesis?.cancel();
  session = null;
  renderHome();
  showView('home');
}

// ---------- Révision ----------
// Mélange un tableau (algorithme de Fisher-Yates).
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function startTheme(themeId) {
  try {
    const res = await fetch(`/api/themes/${encodeURIComponent(themeId)}`);
    if (!res.ok) throw new Error();
    const theme = await res.json();

    session = {
      theme,
      queue: shuffle(theme.words),
      firstTry: new Map(),
      done: 0,
      flipped: false,
    };

    views.study.style.setProperty('--theme', theme.color);
    $('study-title').textContent = `${theme.emoji} ${theme.name}`;
    showView('study');
    showCard();
  } catch {
    alert('Impossible de charger ce thème. Réessaie dans un instant.');
  }
}

function showCard() {
  const word = session.queue[0];
  const total = session.theme.words.length;

  // Remet la carte côté français sans animation, pour ne pas dévoiler la réponse.
  card.style.transition = 'none';
  card.classList.remove('is-flipped');
  void card.offsetWidth; // force le navigateur à appliquer le changement tout de suite
  card.style.transition = '';

  $('card-fr').textContent = word.fr;
  $('card-en').textContent = word.en;

  card.classList.remove('is-entering');
  void card.offsetWidth;
  card.classList.add('is-entering');

  session.flipped = false;
  flipBtn.hidden = false;
  answerBtns.hidden = true;

  $('study-count').textContent = `${session.done} / ${total}`;
  $('study-bar').style.width = `${(session.done / total) * 100}%`;
}

function flipCard() {
  if (!session || session.flipped) return;
  session.flipped = true;
  card.classList.remove('is-entering');
  card.classList.add('is-flipped');
  flipBtn.hidden = true;
  answerBtns.hidden = false;
  speak(session.queue[0].en);
}

function answer(isKnown) {
  if (!session || !session.flipped) return;
  const word = session.queue.shift();

  // On garde la toute première réponse pour le score final.
  if (!session.firstTry.has(word.en)) {
    session.firstTry.set(word.en, isKnown);
  }

  setKnown(session.theme.id, word.en, isKnown);

  if (isKnown) {
    session.done++;
  } else {
    session.queue.push(word); // la carte reviendra en fin de série
  }

  if (session.queue.length === 0) {
    showSummary();
  } else {
    showCard();
  }
}

// ---------- Bilan ----------
function showSummary() {
  const { theme, firstTry } = session;
  const total = theme.words.length;
  const firstTime = [...firstTry.values()].filter(Boolean).length;
  const toReview = theme.words.filter((w) => firstTry.get(w.en) === false);

  let emoji = '🎉';
  let title = 'Parfait !';
  if (firstTime < total) {
    emoji = firstTime >= total / 2 ? '💪' : '🌱';
    title = firstTime >= total / 2 ? 'Bien joué !' : 'Bon début !';
  }

  $('summary-emoji').textContent = emoji;
  $('summary-title').textContent = title;
  $('summary-score').textContent = `${firstTime} mot${firstTime > 1 ? 's' : ''} sur ${total} trouvé${firstTime > 1 ? 's' : ''} du premier coup.`;

  const list = $('review-words');
  list.innerHTML = '';
  toReview.forEach((w) => {
    const li = document.createElement('li');
    const fr = document.createElement('span');
    const en = document.createElement('span');
    fr.textContent = w.fr;
    en.textContent = w.en;
    en.className = 'en';
    li.append(fr, en);
    list.appendChild(li);
  });
  $('review-list').hidden = toReview.length === 0;

  showView('summary');
}

// ---------- Prononciation (synthèse vocale du navigateur) ----------
const canSpeak = 'speechSynthesis' in window;

function speak(text) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel(); // coupe une lecture en cours
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';
  utterance.rate = 0.9; // un peu plus lent, plus facile pour débuter
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

if (!canSpeak) speakBtn.hidden = true;

// ---------- Événements ----------
card.addEventListener('click', flipCard);
flipBtn.addEventListener('click', flipCard);
$('known-btn').addEventListener('click', () => answer(true));
$('review-btn').addEventListener('click', () => answer(false));

speakBtn.addEventListener('click', (event) => {
  event.stopPropagation(); // évite de déclencher le clic sur la carte
  if (session) speak(session.queue[0].en);
});

$('quit-btn').addEventListener('click', goHome);
$('home-btn').addEventListener('click', goHome);
$('logo').addEventListener('click', goHome);
$('restart-btn').addEventListener('click', () => startTheme(session.theme.id));

$('reset-btn').addEventListener('click', () => {
  if (confirm('Effacer toute ta progression ?')) {
    progress = {};
    saveProgress();
    renderHome();
  }
});

// Raccourcis clavier pendant la révision
document.addEventListener('keydown', (event) => {
  if (views.study.hidden) return;
  if (event.key === ' ' || event.key === 'Enter') {
    if (event.target.tagName === 'BUTTON' && event.target !== card) return;
    event.preventDefault();
    flipCard();
  } else if (event.key === 'ArrowRight') {
    answer(true);
  } else if (event.key === 'ArrowLeft') {
    answer(false);
  } else if (event.key === 'Escape') {
    goHome();
  }
});

// Certains navigateurs chargent les voix en différé.
if (canSpeak) window.speechSynthesis.getVoices();

loadLevels();
