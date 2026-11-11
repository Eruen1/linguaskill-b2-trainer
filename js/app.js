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
  if (!text) return;
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
      { thinkingBudget: 1536, maxOutputTokens: 1800 }
    );
    box.textContent = `Estimated Score: ${res.score}\n\n✅ Strengths:\n${res.strengths}\n\n🛠️ Key Fixes:\n${res.improvements}\n\n✨ B2 Model Upgrade:\n${res.improvedVersion}`;
    box.classList.remove('hidden');
  } catch (e) {
    alert(e.message);
  } finally {
    stopBanner();
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// SMART AI TASK GENERATOR (TAILORED THINKING BUDGET & TIME ESTIMATE PER SKILL)
async function generateAiTask(skill) {
  const btn = document.getElementById(`btnGen${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
  const oldText = btn.textContent;

  const skillConfig = {
    reading: {
      estSeconds: 9,
      thinkingBudget: 1024,
      maxOutputTokens: 1400,
      statusMsg: 'Erstelle B2-Lückentext & Grammatik-Prüfung (ca. 8–10 Sek.)...',
      prompt: 'Create an authentic 150-word Cambridge Linguaskill Business B2 Open Gap-Fill text (IT, project management, finance, or operations) with {1}, {2}, {3}, {4}, {5}. Ensure each gap has only ONE grammatically valid single-word answer (prepositions, relative pronouns, conjunctions like despite/whereas/provided, or passive auxiliaries). Return JSON: { "title": "Specific Business Title", "text": "...", "gaps": [{"answer":"single_word", "explanation":"Clear grammatical rule (15-20 words)"}] } (exactly 5 gaps).'
    },
    listening: {
      estSeconds: 13,
      thinkingBudget: 1536,
      maxOutputTokens: 1600,
      statusMsg: 'Konstruiere B2-Audio-Dialog mit Distraktor-Fallen (ca. 12–15 Sek.)...',
      prompt: 'Create an authentic 165-word Cambridge Linguaskill Business B2 Listening monologue or dialogue. Include realistic B2 distractors where all 3 options are mentioned in the audio, but 2 are ruled out by contrast markers (e.g. "initially", "however", "rather than"). Return JSON: { "title": "Specific Business Title", "transcript": "...", "questions": [{"question":"...", "options":["A","B","C"], "correctIndex":0, "explanation":"Explain why correct and why distractors are wrong (15-25 words)"}] } (2 questions).'
    },
    writing: {
      estSeconds: 4,
      thinkingBudget: 256,
      maxOutputTokens: 700,
      statusMsg: 'Generiere B2-Schreibauftrag (ca. 3–5 Sek.)...',
      prompt: 'Create an authentic Cambridge Linguaskill Business B2 Writing Part 2 Report prompt (250+ words) with realistic corporate context and 3 clear bullet points requiring evaluation and recommendations. Return JSON: { "title": "Report: ...", "minWords": 250, "prompt": "..." }.'
    },
    speaking: {
      estSeconds: 4,
      thinkingBudget: 256,
      maxOutputTokens: 700,
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