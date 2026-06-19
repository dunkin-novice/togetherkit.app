// data.jsx — seed data, palettes and pure helpers for Together.
// Ported 1:1 from the Claude Design source so the prototype behaves identically.

// Generates a soft gradient placeholder photo as a data-URI (no network needed).
function photo(label, c1, c2) {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'>"
    + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='" + c1 + "'/><stop offset='1' stop-color='" + c2 + "'/></linearGradient></defs>"
    + "<rect width='640' height='480' fill='url(#g)'/>"
    + "<circle cx='320' cy='205' r='96' fill='rgba(255,255,255,.22)'/>"
    + "<path d='M276 205a44 44 0 1 0 88 0 44 44 0 1 0-88 0' fill='none' stroke='rgba(255,255,255,.55)' stroke-width='10'/>"
    + "<text x='320' y='415' font-family='Nunito,sans-serif' font-size='44' font-weight='800' fill='rgba(255,255,255,.92)' text-anchor='middle'>" + label + "</text>"
    + "</svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// Label tone palette — soft background + readable foreground pairs.
const TONES = [
  { bg: '#eef1e6', fg: '#6f7d52' },
  { bg: '#e7eef0', fg: '#5d7480' },
  { bg: '#efe8f1', fg: '#7e6f86' },
  { bg: '#f4e8dd', fg: '#a8794f' },
  { bg: '#f3e6e4', fg: '#a86a6a' },
  { bg: '#e6efed', fg: '#5e827b' },
  { bg: '#f2eade', fg: '#9c7b54' },
];
const toneOf = (label) => TONES[((label && label.tone) || 0) % TONES.length];

// The two people sharing the list. Colors are resolved at render time from the
// live primary/partner tweak values.
const USER_KEYS = ['Dunkin', 'Pare'];

const UNIT_SUGGESTIONS = ['pcs', 'g', 'kg', 'ml', 'l', 'cm', 'm', 'pack', 'bottle', 'box'];

const INITIAL_LABELS = [
  { id: 'ing', name: 'Ingredients', tone: 0, custom: false },
  { id: 'uti', name: 'Utility',     tone: 1, custom: false },
  { id: 'per', name: 'Personal',    tone: 2, custom: false },
];

const INITIAL_ITEMS = [
  { id: 1, name: 'Avocados',       qty: 4, unit: 'kg',     labelId: 'ing', by: 'Pare',   date: 'Today',      done: false, important: true,  image: photo('Avocados', '#9caa6e', '#6f8050') },
  { id: 2, name: 'Oatmeal',        qty: 2, unit: 'box',    labelId: 'ing', by: 'Dunkin', date: 'Today',      done: true,  important: false, image: photo('Oatmeal', '#d8b487', '#b98f5e') },
  { id: 3, name: 'Oat milk',       qty: 1, unit: 'l',      labelId: 'ing', by: 'Dunkin', date: 'Yesterday',  done: false, important: false, image: null },
  { id: 4, name: 'Dish soap',      qty: 1, unit: 'bottle', labelId: 'uti', by: 'Dunkin', date: 'Yesterday',  done: false, important: true,  image: photo('Dish soap', '#8fb0b8', '#5f8893') },
  { id: 5, name: 'Sourdough loaf', qty: 1, unit: 'pcs',    labelId: 'ing', by: 'Pare',   date: 'Yesterday',  done: true,  important: false, image: null },
  { id: 6, name: 'Shampoo',        qty: 1, unit: 'bottle', labelId: 'per', by: 'Pare',   date: '2 days ago', done: false, important: false, image: null },
];

// Parse a single bulk-add line. Supports comma / .. / – / — / -- / / separators,
// and falls back to "<name…> <qty> <unit>" detection. Returns null for blank
// lines, otherwise { name, qty, unit, valid, raw }.
function parseBulkLine(line) {
  const raw = (line || '').trim();
  if (!raw) return null;
  let parts = null;
  if (raw.indexOf(',') >= 0) parts = raw.split(',');
  else if (raw.indexOf('..') >= 0) parts = raw.split('..');
  else if (raw.indexOf('–') >= 0) parts = raw.split('–');
  else if (raw.indexOf('—') >= 0) parts = raw.split('—');
  else if (raw.indexOf('--') >= 0) parts = raw.split('--');
  else if (raw.indexOf('/') >= 0) parts = raw.split('/');
  if (parts) {
    parts = parts.map(p => p.trim()).filter(p => p.length);
    if (parts.length >= 3) {
      const name = parts[0]; const qty = parseFloat(parts[1]); const unit = parts.slice(2).join(' ');
      return { name, qty, unit, valid: !!name && !isNaN(qty) && qty > 0 && !!unit, raw };
    }
    return { raw, valid: false };
  }
  const tokens = raw.split(/\s+/);
  let idx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) { if (/^\d+(\.\d+)?$/.test(tokens[i])) { idx = i; break; } }
  if (idx > 0 && idx < tokens.length - 1) {
    const name = tokens.slice(0, idx).join(' '); const qty = parseFloat(tokens[idx]); const unit = tokens.slice(idx + 1).join(' ');
    return { name, qty, unit, valid: !!name && !isNaN(qty) && qty > 0 && !!unit, raw };
  }
  return { raw, valid: false };
}

Object.assign(window, {
  TogetherData: {
    photo, TONES, toneOf, USER_KEYS, UNIT_SUGGESTIONS,
    INITIAL_LABELS, INITIAL_ITEMS, parseBulkLine,
  },
});
