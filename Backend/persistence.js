const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

let INST, RECS, ITEMS;
let saveTimer = null;
let isLoading = false;

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      console.log('  Loaded ' + (data.INST?.length || 0) + ' institutions, ' + (data.RECS?.length || 0) + ' recs from disk');
      return { INST: data.INST || [], RECS: data.RECS || [], ITEMS: data.ITEMS || [] };
    }
  } catch (err) {
    console.warn('  Failed to load data file:', err.message);
  }
  return { INST: [], RECS: [], ITEMS: [] };
}

function scheduleSave() {
  if (isLoading) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ INST: INST, RECS: RECS, ITEMS: ITEMS }, null, 2), 'utf-8');
    } catch (err) {
      console.error('  Failed to save data:', err.message);
    }
  }, 300);
}

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ INST: INST, RECS: RECS, ITEMS: ITEMS }, null, 2), 'utf-8');
  } catch (err) {
    console.error('  Failed to save data:', err.message);
  }
}

function overridePush(arr) {
  var orig = arr.push.bind(arr);
  arr.push = function() { var r = orig.apply(arr, arguments); scheduleSave(); return r; };
}

function overrideSplice(arr) {
  var orig = arr.splice.bind(arr);
  arr.splice = function() { var r = orig.apply(arr, arguments); scheduleSave(); return r; };
}

function init(instArr, recsArr, itemsArr) {
  INST = instArr;
  RECS = recsArr;
  ITEMS = itemsArr;

  // Load persisted data
  var persisted = load();

  // Suppress saves during loading
  isLoading = true;
  for (var i = 0; i < persisted.INST.length; i++) INST.push(persisted.INST[i]);
  for (var i = 0; i < persisted.RECS.length; i++) RECS.push(persisted.RECS[i]);
  for (var i = 0; i < persisted.ITEMS.length; i++) ITEMS.push(persisted.ITEMS[i]);
  isLoading = false;

  // Override push/splice for auto-save
  overridePush(INST);
  overridePush(RECS);
  overridePush(ITEMS);
  overrideSplice(INST);
  overrideSplice(RECS);
  overrideSplice(ITEMS);

  console.log('  Persistence: ' + INST.length + ' institutions, ' + RECS.length + ' recommendations');
}

module.exports = { init: init, saveNow: saveNow };
