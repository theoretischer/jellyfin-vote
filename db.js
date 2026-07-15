const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadVotes() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(VOTES_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveVotes(votes) {
  ensureDataDir();
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

function loadSettings() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { hideFromDeleteList: [] };
  }
}

function saveSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getItemKey(jellyfinItemId) {
  return jellyfinItemId;
}

module.exports = {
  loadVotes,
  saveVotes,
  loadSettings,
  saveSettings,
  getItemKey,
  DATA_DIR,
};
