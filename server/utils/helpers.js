const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

function genId() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return fallback; }
}

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function ok(data, msg = 'success') { return { code: 0, data, msg }; }
function fail(msg = 'error', code = -1) { return { code, msg, data: null }; }

module.exports = { genId, readJSON, writeJSON, ok, fail };
