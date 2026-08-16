const API = '';

function $(sel) {
  return document.querySelector(sel);
}
function $$(sel) {
  return document.querySelectorAll(sel);
}

function show(el) {
  el.style.display = '';
}
function hide(el) {
  el.style.display = 'none';
}

async function get(path) {
  const r = await fetch(API + '/api' + path);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(API + '/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

function poll(path, interval, callback) {
  callback();
  setInterval(async () => {
    try {
      callback();
    } catch {}
  }, interval);
}

// ---- 功能开关 ----
let featureFlags = {};
async function loadFeatures() {
  try {
    const res = await get('/settings');
    if (res.code === 0 && res.data && res.data.features) {
      featureFlags = res.data.features;
    }
  } catch {}
}
function isFeatureEnabled(name) {
  return featureFlags[name] !== false;
}
