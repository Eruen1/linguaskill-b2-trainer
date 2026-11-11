const STORAGE_KEYS = {
  CARDS: 'lsk_b2_cards_v4',
  TASKS: 'lsk_b2_tasks_v4',
  API_KEY: 'lsk_gemini_api_key'
};

async function loadInitialData() {
  let cards = JSON.parse(localStorage.getItem(STORAGE_KEYS.CARDS) || 'null');
  if (!cards || !cards.length) {
    try {
      const res = await fetch('data/cards.json');
      cards = await res.json();
      saveCards(cards);
    } catch (e) {
      cards = [];
    }
  }

  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || 'null');
  if (!tasks) {
    try {
      const res = await fetch('data/tasks.json');
      tasks = await res.json();
      saveTasks(tasks);
    } catch (e) {
      tasks = { reading: [], listening: [], writing: [], speaking: [] };
    }
  }
  return { cards, tasks };
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
}

function setApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
}

function removeApiKey() {
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
}