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
  listenPlaysLeft: 2,
  isAudioPlaying: false
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
  stopAllAudio();
  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-blue-400', 'font-bold');
    btn.classList.add('text-slate-400');
  });
  const activeBtn = document.getElementById(`nav-${tab}`);
  activeBtn.classList.add('text-blue-400', 'font-bold');
}

function stopAllAudio() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  state.isAudioPlaying = false;
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
  const currentVal = select.value || 'all';
  const cats = [...new Set(state.cards.map(c => c.category))];
  select.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (cats.includes(currentVal)) select.value = currentVal;
}

function filterCards(keepIndex = false) {
  const cat = document.getElementById('categoryFilter').value;
  const status = document.getElementById('statusFilter').value;
  state.filteredCards = state.cards.filter(c => {
    const matchCat = cat === 'all' || c.category === cat;
    const matchStatus = status === 'all' || c.status === status;
    return matchCat && matchStatus;
  });
  if (!keepIndex || state.currentCardIdx >= state.filteredCards.length) {
    state.currentCardIdx = 0;
  }
  renderCard();
}

function renderCard() {
  const knownCount = state.cards.filter(c => c.status === 'known').length;
  document.getElementById('headerStats').textContent = `${knownCount} / ${state.cards.length} Cards Mastered`;
  document.getElementById('flashcardInner').classList.remove('is-flipped');

  if (!state.filteredCards.length) {
    document.getElementById('cardCategoryBadge').textContent = 'Done';
    document.getElementById('cardFrontText').textContent = 'No cards match this filter.';
    document.getElementById('cardBackDef').textContent = 'Switch filter or import more decks.';
    document.getElementById('cardBackEx').textContent = '';
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
  if (!state.filteredCards.length) return;
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

  const activeFilter = document.getElementById('statusFilter').value;
  if (activeFilter !== 'all' && activeFilter !== status) {
    filterCards(true);
  } else {
    nextCard();
  }
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
  stopAllAudio();
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
      def = defPart.replace(exMatch[0], '').trim();
    }
    state.cards.push({
      id: Date.now() + Math.random(),
      category: cat,
      term: termPart,
      definition: def,
      example: ex,
      status: 'learning'
    });
    existingTerms.add(termPart.toLowerCase());
    added++;
  });

  saveCards(state.cards);
  populateCategories();
  filterCards();
  document.getElementById('bulkImportText').value = '';
  closeModal('deckModal');
  alert(`${added} new cards imported (duplicates skipped).`);
}

function exportBackupJson() {
  const blob = new Blob([JSON.stringify(state.cards, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'linguaskill-b2-backup.json';
  a.click();
}

// SKILLS INITIALIZATION
function initSkillSelectors() {
  ['reading', 'listening', 'writing', 'speaking'].forEach(skill => {
    const sel = document.getElementById(`${skill}TaskSelect`);
    sel.innerHTML = state.tasks[skill].map((t, i) => `<option value="${i}">${t.title}</option>`).join('');
  });
  renderReadingTask();
  renderListeningTask();
  renderWritingTask();
  renderSpeakingTask();
}

// READING
function renderReadingTask() {
  const idx = document.getElementById('readingTaskSelect').value || 0;
  const task = state.tasks.reading[idx];
  if (!task) return;
  document.getElementById('readingFeedback').classList.add('hidden');
  let html = task.text;
  task.gaps.forEach((g, i) => {
    const n = i + 1;
    const inputHtml = `<input id="rgap-${i}" type="text" placeholder="(${n})" autocomplete="off" autocapitalize="none" class="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 w-28 text-center text-blue-300 font-semibold mx-1 select-text" />`;
    const regex = new RegExp(`\\{${n}\\}|\\(${n}\\)|\\[${n}\\]`, 'g');
    if (regex.test(html)) {
      html = html.replace(regex, inputHtml);
    } else {
      html += ` ${inputHtml}`;
    }
  });
  document.getElementById('readingContent').innerHTML = `<p>${html}</p>`;
}

function checkReadingAnswers() {
  const idx = document.getElementById('readingTaskSelect').value || 0;
  const task = state.tasks.reading[idx];
  if (!task) return;
  let report = [];
  task.gaps.forEach((g, i) => {
    const inputEl = document.getElementById(`rgap-${i}`);
    const userVal = (inputEl?.value || '').trim().toLowerCase();
    const validAnswers = g.answer.toLowerCase().split('/').map(s => s.trim());
    const ok = validAnswers.includes(userVal);
    if (inputEl) {
      inputEl.className = ok
        ? 'bg-emerald-950/80 border border-emerald-500 rounded px-2 py-0.5 w-28 text-center text-emerald-300 font-bold mx-1 select-text'
        : 'bg-rose-950/80 border border-rose-500 rounded px-2 py-0.5 w-28 text-center text-rose-300 font-bold mx-1 select-text';
    }
    report.push(`<div><strong>Gap ${i + 1}:</strong> ${ok ? '✅ Correct' : `❌ Expected "${g.answer}"`} — <span class="text-slate-400">${g.explanation}</span></div>`);
  });
  const fb = document.getElementById('readingFeedback');
  fb.innerHTML = report.join('');
  fb.classList.remove('hidden');
}

// LISTENING
function renderListeningTask() {
  stopAllAudio();
  const idx = document.getElementById('listeningTaskSelect').value || 0;
  const task = state.tasks.listening[idx];
  if (!task) return;
  state.listenPlaysLeft = 2;
  document.getElementById('listenPlaysLeft').textContent = 'Plays remaining: 2 / 2';
  document.getElementById('listeningTranscript').classList.add('hidden');
  document.getElementById('listeningTranscript').textContent = task.transcript;
  document.getElementById('listeningQuestions').innerHTML = task.questions.map((q, qi) => `
    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
      <p class="font-semibold text-xs">${qi + 1}. ${q.question}</p>
      ${q.options.map((opt, oi) => `
        <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="radio" name="lq-${qi}" value="${oi}" /> <span>${opt}</span>
        </label>
      `).join('')}
      <p id="lfb-${qi}" class="hidden text-xs text-blue-400 pt-1"></p>
    </div>
  `).join('');
}

function playListeningAudio() {
  if (state.isAudioPlaying) {
    stopAllAudio();
    return;
  }
  if (state.listenPlaysLeft <= 0) {
    alert('No plays remaining for this task (Exam limit: 2 plays). Select task again to reset.');
    return;
  }
  const idx = document.getElementById('listeningTaskSelect').value || 0;
  const task = state.tasks.listening[idx];
  if (!task) return;

  state.listenPlaysLeft--;
  document.getElementById('listenPlaysLeft').textContent = `Plays remaining: ${state.listenPlaysLeft} / 2`;

  const cleanSpeechText = task.transcript.replace(/^[A-Za-z\s]+:\s*/gm, '');
  const u = new SpeechSynthesisUtterance(cleanSpeechText);
  u.lang = 'en-GB';
  u.rate = 0.98;
  state.isAudioPlaying = true;
  u.onend = () => { state.isAudioPlaying = false; };
  u.onerror = () => { state.isAudioPlaying = false; };
  speechSynthesis.speak(u);
}

function checkListeningAnswers() {
  const idx = document.getElementById('listeningTaskSelect').value || 0;
  const task = state.tasks.listening[idx];
  if (!task) return;
  task.questions.forEach((q, qi) => {
    const chosen = document.querySelector(`input[name="lq-${qi}"]:checked`);
    const fb = document.getElementById(`lfb-${qi}`);
    const isOk = chosen && Number(chosen.value) === q.correctIndex;
    fb.textContent = isOk ? `✅ Correct! ${q.explanation}` : `❌ Correct answer: "${q.options[q.correctIndex]}". ${q.explanation}`;
    fb.className = isOk ? 'text-xs text-emerald-400 pt-1 font-medium' : 'text-xs text-rose-400 pt-1 font-medium';
    fb.classList.remove('hidden');
  });
}

function toggleTranscript() {
  document.getElementById('listeningTranscript').classList.toggle('hidden');
}

// WRITING
function renderWritingTask() {
  const idx = document.getElementById('writingTaskSelect').value || 0;
  const task = state.tasks.writing[idx];
  if (!task) return;
  document.getElementById('writingPromptBox').textContent = task.prompt;
  document.getElementById('writingFeedbackBox').classList.add('hidden');
  updateWordCount();
}

function updateWordCount() {
  const idx = document.getElementById('writingTaskSelect').value || 0;
  const task = state.tasks.writing[idx];
  const text = document.getElementById('writingInput').value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const target = task?.minWords || 250;
  const el = document.getElementById('wordCountDisplay');
  el.textContent = `Words: ${words} / Target: ${target}+`;
  el.className = words >= target ? 'font-bold text-emerald-400' : 'font-bold text-amber-400';
}

function toggleWritingTimer() {
  if (state.writingTimerId) {
    clearInterval(state.writingTimerId);
    state.writingTimerId = null;
    return;
  }
  state.writingTimerId = setInterval(() => {
    if (state.writingSeconds > 0) state.writingSeconds--;
    document.getElementById('writingTimerDisplay').textContent = formatMMSS(state.writingSeconds);
  }, 1000);
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

// HELPER: LIVE STATUS BANNER WITH ESTIMATED TIME
function showAiProgressBanner(targetBtn, message, estSeconds) {
  let banner = document.getElementById('aiLiveStatusBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'aiLiveStatusBanner';
    banner.className = 'bg-blue-950/90 border border-blue-500/40 text-blue-200 px-3.5 py-2.5 rounded-xl text-xs space-y-1.5 my-2 shadow-lg';
  }
  targetBtn.parentElement.insertBefore(banner, targetBtn.nextSibling);

  let elapsed = 0;
  const updateHtml = () => {
    const pct = Math.min(95, Math.round((elapsed / estSeconds) * 100));
    banner.innerHTML = `
      <div class="flex justify-between items-center font-semibold">
        <span>⏳ ${message}</span>
        <span class="font-mono text-blue-300">${elapsed}s / ~${estSeconds}s</span>
      </div>
      <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
        <div class="bg-blue-500 h-full transition-all duration-500" style="width:${pct}%"></div>
      </div>
    `;
  };

  updateHtml();
  const timerId = setInterval(() => {
    elapsed++;
    updateHtml();
  }, 1000);

  return () => {
    clearInterval(timerId);
    if (banner && banner.parentElement) banner.remove();
  };
}

async function gradeWritingWithAi() {
  const text = document.getElementById('writingInput').value.trim();
  if (!text) {
    alert('Please write your response first before grading.');
    return;
  }
  const btn = document.getElementById('btnGradeWriting');
  const box = document.getElementById('writingFeedbackBox');
  const oldText = btn.textContent;

  btn.disabled = true;
  btn.textContent = '⏳ Grading in progress (~12–15s)...';
  const stopBanner = showAiProgressBanner(btn, 'Analysiere Text nach Cambridge-B2-Kriterien (ca. 12–15 Sek.)...', 14);

  try {
    const idx = document.getElementById('writingTaskSelect').value || 0;
    const task = state.tasks.writing[idx];
    const res = await callGeminiJson(
      'You are an official Cambridge Linguaskill Business B2 examiner. Return JSON with keys: score (string e.g. "168 / 180 (Solid B2)"), strengths (string), improvements (string), improvedVersion (string).',
      `Task: ${task.prompt}\n\nCandidate Text:\n${text}`,
      { thinkingBudget: 1024, maxOutputTokens: 4096 }
    );
    const fmt = val => Array.isArray(val) ? val.map(v => `• ${v}`).join('\n') : (val || '');
    box.textContent = `Estimated Score: ${res.score}\n\n✅ Strengths:\n${fmt(res.strengths)}\n\n🛠️ Key Fixes:\n${fmt(res.improvements)}\n\n✨ B2 Model Upgrade:\n${res.improvedVersion}`;
    box.classList.remove('hidden');
  } catch (e) {
    alert(e.message);
  } finally {
    stopBanner();
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// SPEAKING
function renderSpeakingTask() {
  const idx = document.getElementById('speakingTaskSelect').value || 0;
  const task = state.tasks.speaking[idx];
  if (!task) return;
  clearInterval(state.speakingTimerId);
  document.getElementById('speakingPromptBox').textContent = task.prompt;
  document.getElementById('speakingPhaseBadge').textContent = `Prep: ${task.prepSeconds}s | Speak: ${task.speakSeconds}s`;
  document.getElementById('speakingTimerBig').textContent = formatMMSS(task.prepSeconds);
}

function startSpeakingFlow() {
  const idx = document.getElementById('speakingTaskSelect').value || 0;
  const task = state.tasks.speaking[idx];
  runSpeakingCountdown('PREPARATION TIME', task.prepSeconds, () => {
    runSpeakingCountdown('🎙️ SPEAKING NOW (RECORDING)', task.speakSeconds, () => {
      document.getElementById('speakingPhaseBadge').textContent = '✅ Response Completed';
    });
  });
}

function runSpeakingCountdown(label, seconds, onComplete) {
  clearInterval(state.speakingTimerId);
  let rem = seconds;
  document.getElementById('speakingPhaseBadge').textContent = label;
  document.getElementById('speakingTimerBig').textContent = formatMMSS(rem);
  state.speakingTimerId = setInterval(() => {
    rem--;
    document.getElementById('speakingTimerBig').textContent = formatMMSS(rem);
    if (rem <= 0) {
      clearInterval(state.speakingTimerId);
      if (onComplete) onComplete();
    }
  }, 1000);
}

function skipSpeakingPrep() {
  const idx = document.getElementById('speakingTaskSelect').value || 0;
  const task = state.tasks.speaking[idx];
  runSpeakingCountdown('🎙️ SPEAKING NOW (RECORDING)', task.speakSeconds, () => {
    document.getElementById('speakingPhaseBadge').textContent = '✅ Response Completed';
  });
}

function submitSpeakingEarly() {
  clearInterval(state.speakingTimerId);
  document.getElementById('speakingPhaseBadge').textContent = '✅ Submitted Early — Loading Next Task...';
  const sel = document.getElementById('speakingTaskSelect');
  sel.value = (Number(sel.value) + 1) % state.tasks.speaking.length;
  setTimeout(renderSpeakingTask, 700);
}

// SMART AI TASK GENERATOR
async function generateAiTask(skill) {
  const btn = document.getElementById(`btnGen${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
  const oldText = btn.textContent;

  const skillConfig = {
    reading: {
      estSeconds: 9,
      thinkingBudget: 1024,
      maxOutputTokens: 4096,
      statusMsg: 'Erstelle B2-Lückentext & Grammatik-Prüfung (ca. 8–10 Sek.)...',
      prompt: 'Create an authentic 150-word Cambridge Linguaskill Business B2 Open Gap-Fill text (IT, project management, finance, or operations) with {1}, {2}, {3}, {4}, {5}. Ensure each gap has only ONE grammatically valid single-word answer (prepositions, relative pronouns, conjunctions like despite/whereas/provided, or passive auxiliaries). Return JSON: { "title": "Specific Business Title", "text": "...", "gaps": [{"answer":"single_word", "explanation":"Clear grammatical rule (15-20 words)"}] } (exactly 5 gaps).'
    },
    listening: {
      estSeconds: 13,
      thinkingBudget: 1280,
      maxOutputTokens: 4096,
      statusMsg: 'Konstruiere B2-Audio-Dialog mit Distraktor-Fallen (ca. 12–15 Sek.)...',
      prompt: 'Create an authentic 165-word Cambridge Linguaskill Business B2 Listening monologue or dialogue. Include realistic B2 distractors where all 3 options are mentioned in the audio, but 2 are ruled out by contrast markers (e.g. "initially", "however", "rather than"). Return JSON: { "title": "Specific Business Title", "transcript": "...", "questions": [{"question":"...", "options":["A","B","C"], "correctIndex":0, "explanation":"Explain why correct and why distractors are wrong (15-25 words)"}] } (2 questions).'
    },
    writing: {
      estSeconds: 4,
      thinkingBudget: 256,
      maxOutputTokens: 2048,
      statusMsg: 'Generiere B2-Schreibauftrag (ca. 3–5 Sek.)...',
      prompt: 'Create an authentic Cambridge Linguaskill Business B2 Writing Part 2 Report prompt (250+ words) with realistic corporate context and 3 clear bullet points requiring evaluation and recommendations. Return JSON: { "title": "Report: ...", "minWords": 250, "prompt": "..." }.'
    },
    speaking: {
      estSeconds: 4,
      thinkingBudget: 256,
      maxOutputTokens: 2048,
      statusMsg: 'Generiere B2-Speaking-Szenario (ca. 3–5 Sek.)...',
      prompt: 'Create an authentic Cambridge Linguaskill Business B2 Speaking task (Presentation, Recommendation, or Argument Evaluation) with realistic workplace context and 3 bullet points. Return JSON: { "title": "...", "prepSeconds": 20, "speakSeconds": 60, "prompt": "..." }.'
    }
  };

  const cfg = skillConfig[skill];
  const startTime = Date.now();
  btn.disabled = true;
  btn.textContent = `⏳ ~${cfg.estSeconds}s...`;
  const stopBanner = showAiProgressBanner(btn, cfg.statusMsg, cfg.estSeconds);

  try {
    const newTask = await callGeminiJson(
      'You are a senior Cambridge Linguaskill Business B2 exam writer. Ensure authentic B2 complexity, natural corporate register, and strict JSON output.',
      cfg.prompt,
      { thinkingBudget: cfg.thinkingBudget, maxOutputTokens: cfg.maxOutputTokens }
    );

    state.tasks[skill].push(newTask);
    saveTasks(state.tasks);
    initSkillSelectors();
    document.getElementById(`${skill}TaskSelect`).value = state.tasks[skill].length - 1;
    if (skill === 'reading') renderReadingTask();
    if (skill === 'listening') renderListeningTask();
    if (skill === 'writing') renderWritingTask();
    if (skill === 'speaking') renderSpeakingTask();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    btn.textContent = `✓ Bereit (${elapsed}s)`;
    setTimeout(() => { btn.textContent = oldText; }, 2000);
  } catch (e) {
    alert(e.message);
    btn.textContent = oldText;
  } finally {
    stopBanner();
    btn.disabled = false;
  }
}