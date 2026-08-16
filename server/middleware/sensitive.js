const config = require('../config');

module.exports = {
  check(text) {
    if (!text) return { ok: true, word: null };
    for (const word of config.sensitiveWords) {
      if (text.includes(word)) return { ok: false, word };
    }
    return { ok: true, word: null };
  },
  filter(text) {
    if (!text) return text;
    let result = text;
    for (const word of config.sensitiveWords) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), '***');
    }
    return result;
  },
};
