let state = {
  cards: [],
  filteredCards: [],
  currentCardIdx: 0,
  reverseCard: false,
  tasks: { reading: [], listening: [], writing: [], speaking: [] },
  writingSeconds: 3300,
  writingTimerId: null,
  speakingTimerId: null,
  speakingPhase: 'idle',
  listenPlaysLeft: 2
};

window.addEventListener('DOMContentLoaded', async () => {
  const data = await loadInitialData();
  state.cards = data.cards;
  state.tasks = data.tasks;

  updateApiKeyBadge();
  populateCategories();
  filterCards();
  initSkillSelectors();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// NAVIGATION & MODALS
function switchTab(tab) {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-blue-400', 'font-bold');
    btn.classList.add('text-slate-400');
  });
  const activeBtn = document.getElementById(`nav-${tab}`);
  activeBtn.classList.add('text-blue-400', 'font-bold');
}

function openModal(id) {
  if (id === 'apiModal') {
    document.getElementById('apiKeyInput').value = getApiKey();
  }
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// API KEY UI
function updateApiKeyBadge() {
  const btn = document.getElementById('apiKeyStatusBtn');
  if (getApiKey()) {
    btn.textContent = 'API Key ✓';
    btn.className = 'text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-lg font-medium';
  } else {
    btn.textContent = '⚙️ API Key';
    btn.className = 'text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg font-medium';
  }
}

function saveUserApiKey() {
  const val = document.getElementById('apiKeyInput').value;
  setApiKey(val);
  updateApiKeyBadge();
  closeModal('apiModal');
}

function clearUserApiKey() {
  removeApiKey();
  document.getElementById('apiKeyInput').value = '';
  updateApiKeyBadge();
}

// FLASHCARDS
function populateCategories() {
  const select = document.getElementById('categoryFilter');
  const cats = [...new Set(state.cards.map(c => c.category))];
  select.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterCards() {
  const cat = document.getElementById('categoryFilter').value;
  const status = document.getElementById('statusFilter').value;
  state.filteredCards = state.cards.filter(c => {
    const matchCat = cat === 'all' || c.category === cat;
    const matchStatus = status === 'all' || c.status === status;
    return matchCat && matchStatus;
  });
  state.currentCardIdx = 0;
  renderCard();
}

function renderCard() {
  const knownCount = state.cards.filter(c => c.status === 'known').length;
  document.getElementById('headerStats').textContent = `${knownCount} / ${state.cards.length} Cards Mastered`;
  document.getElementById('flashcardInner').classList.remove('is-flipped');

  if (!state.filteredCards.length) {
    document.getElementById('cardFrontText').textContent = 'No cards match this filter.';
    document.getElementById('cardCounter').textContent = '0 / 0';
    return;
  }

  const card = state.filteredCards[state.currentCardIdx];
  document.getElementById('cardCategoryBadge').textContent = card.category;
  document.getElementById('cardCounter').textContent = `${state.currentCardIdx + 1} / ${state.filteredCards.length}`;

  if (!state.reverseCard) {
    document.getElementById('cardFrontText').textContent = card.term;
    document.getElementById('cardBackDef').textContent = card.definition;
  } else {
    document.getElementById('cardFrontText').textContent = card.definition;
    document.getElementById('cardBackDef').textContent = card.term;
  }
  document.getElementById('cardBackEx').textContent = card.example || '';
}

function flipCard() {
  document.getElementById('flashcardInner').classList.toggle('is-flipped');
}

function nextCard() {
  if (!state.filteredCards.length) return;
  state.currentCardIdx = (state.currentCardIdx + 1) % state.filteredCards.length;
  renderCard();
}

function markCard(status) {
  if (!state.filteredCards.length) return;
  const card = state.filteredCards[state.currentCardIdx];
  card.status = status;
  saveCards(state.cards);
  nextCard();
}

function toggleCardDirection() {
  state.reverseCard = !state.reverseCard;
  document.getElementById('dirBtn').textContent = state.reverseCard ? 'Def → Term' : 'Term → Def';
  renderCard();
}

function shuffleCards() {
  state.filteredCards.sort(() => Math.random() - 0.5);
  state.currentCardIdx = 0;
  renderCard();
}

function speakCurrentCard(e) {
  e.stopPropagation();
  if (!state.filteredCards.length) return;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(state.filteredCards[state.currentCardIdx].term);
  u.lang = 'en-GB';
  speechSynthesis.speak(u);
}

function importBulkCards() {
  const cat = document.getElementById('importCategoryName').value.trim() || 'Imported Set';
  const raw = document.getElementById('bulkImportText').value.trim();
  if (!raw) return;

  const existingTerms = new Set(state.cards.map(c => c.term.toLowerCase()));
  const lines = raw.split('\n').filter(l => l.includes('|'));
  let added = 0;

  lines.forEach(line => {
    const [termPart, defPart] = line.split('|').map(s => s.trim());
    if (!termPart || !defPart || existingTerms.has(termPart.toLowerCase())) return;
    let def = defPart;
    let ex = '';
    const exMatch = defPart.match(/\[Example:\s*(.*?)\]/i);
    if (exMatch) {
      ex = exMatch[1];
      def = defPart.replace