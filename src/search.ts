// Search engine: FlexSearch + a small bounded English query expansion.
//
// English-only by design. There is no Vietnamese/CJK normalization, no
// Vietnamese synonym groups, no CJK tokenizer, and no broad per-alias fan-out.
// Synonym recall is handled by a tiny query alias map (term -> canonical tag)
// that is present in the index. Exact emoji/symbol paste is an O(1) fast path.
//
// Per query we run at most THREE FlexSearch lookups per active type:
//   - up to two primary variants (the token itself + its canonical alias), and
//   - one reserved typo-light lookup, used only when a single >=5-char token
//     has poor direct recall and it near-matches a small static head-word set.

// flexsearch 0.7 là CommonJS bundle; rollup cần default import rồi destructure
// để tránh "Index not found" lúc build production.
import FlexSearch from 'flexsearch';
const Index = FlexSearch.Index;
type Index = import('flexsearch').Index;

export type ItemType = 'emoji' | 'symbol' | 'kaomoji';

export interface SearchItem {
  t: string;
  y: string;
  c: string;
  s: string;
  n: string;
  g: string;
  cp?: string;
}

export interface SearchOptions {
  limit?: number;
  /** Restrict the search to one item type. Omit to search all three. */
  type?: ItemType;
}

const DEFAULT_LIMIT = 900;
/** Primary (non-typo) lookup variants per active type. */
const MAX_PRIMARY_VARIANTS = 2;
/** Total lookup cap per active type is 3: 2 primary + 1 reserved typo fallback. */
/** Below this many hits we attempt the typo-light fallback. */
const RECALL_THRESHOLD = 3;
const TYPO_MIN_LEN = 5;
const TYPO_MAX_DIST = 2;

const TOKEN_RE = /[a-z0-9]+/g;
const ALL_TYPES: ItemType[] = ['emoji', 'symbol', 'kaomoji'];

/** English stopwords + generic UI words that carry no search signal. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'from', 'is', 'are', 'be', 'it', 'this', 'that', 'these', 'those',
  'my', 'your', 'our', 'me', 'you', 'i', 'we', 'they', 'he', 'she', 'as', 'by',
  'so', 'do', 'does', 'can', 'will', 'please', 'give', 'show', 'find', 'get',
  'want', 'need', 'looking', 'search', 'some', 'any', 'all', 'one', 'two',
  'good', 'nice', 'best', 'emoji', 'icon', 'emoticon', 'kaomoji', 'symbol',
  'symbols', 'text', 'face', 'faces', 'copy', 'paste', 'thing', 'stuff',
]);

/**
 * Query synonym -> canonical term. Canonical terms are guaranteed to exist in
 * the index because the build-time taxonomy emits them as tags. This map is
 * intentionally small and bounded — it is NOT a per-alias group fan-out.
 */
const QUERY_ALIASES: Record<string, string> = {
  heart: 'love', hearts: 'love', romance: 'love', romantic: 'love',
  valentine: 'love', kiss: 'love', kisses: 'love', kissing: 'love', hug: 'love',
  hugs: 'love', hugging: 'love', couple: 'love',
  smile: 'happy', smiling: 'happy', smiley: 'happy', smiles: 'happy',
  joy: 'happy', joyful: 'happy', laugh: 'happy', laughing: 'happy', laughs: 'happy',
  grin: 'happy', grinning: 'happy', lol: 'happy', haha: 'happy', hehe: 'happy',
  excited: 'happy', wink: 'happy', winking: 'happy', cheer: 'happy',
  cry: 'sad', crying: 'sad', tear: 'sad', tears: 'sad', lonely: 'sad',
  worried: 'sad', pensive: 'sad',
  mad: 'angry', rage: 'angry', furious: 'angry', pout: 'angry', pouting: 'angry',
  shocked: 'surprise', wow: 'surprise', astonished: 'surprise', omg: 'surprise',
  idea: 'thinking', hmm: 'thinking',
  blush: 'shy', blushing: 'shy', flushed: 'shy',
  sleepy: 'sleep', zzz: 'sleep', tired: 'sleep',
  sunglasses: 'cool',
  doctor: 'care', nurse: 'care', hospital: 'care', medical: 'care', sick: 'care',
  people: 'person', human: 'person', man: 'person', woman: 'person', boy: 'person',
  girl: 'person', baby: 'person', child: 'person', family: 'person',
  finger: 'hand', clap: 'hand', praying: 'hand', fist: 'hand', punch: 'hand',
  creature: 'animal', pet: 'animal',
  kitty: 'cat', kitten: 'cat', cats: 'cat', feline: 'cat',
  puppy: 'dog', puppies: 'dog', dogs: 'dog', paw: 'dog',
  birds: 'bird', duck: 'bird', chick: 'bird',
  whale: 'fish', dolphin: 'fish', shark: 'fish',
  bunny: 'animal', monkey: 'animal', frog: 'animal',
  forest: 'nature', mountain: 'nature', river: 'nature', ocean: 'nature',
  plant: 'tree', plants: 'tree', leaf: 'tree', leaves: 'tree', seedling: 'tree', wood: 'tree',
  rose: 'flower', tulip: 'flower', blossom: 'flower', bouquet: 'flower',
  rainy: 'weather', cloudy: 'weather', sun: 'weather', sunny: 'weather', snow: 'weather',
  storm: 'weather', thunder: 'weather', lightning: 'weather', umbrella: 'weather',
  wind: 'weather', windy: 'weather', rainbow: 'weather', comet: 'weather',
  fruit: 'food', coffee: 'food', cake: 'food', pizza: 'food', burger: 'food',
  beer: 'food', wine: 'food', hungry: 'food',
  car: 'travel', train: 'travel', plane: 'travel', ship: 'travel', boat: 'travel',
  rocket: 'travel', bus: 'travel', bike: 'travel',
  clock: 'time', watch: 'time', hour: 'time', alarm: 'time',
  dollar: 'money', dollars: 'money', cash: 'money', coin: 'money', coins: 'money',
  currency: 'money', yen: 'money', euro: 'money', pound: 'money',
  song: 'music', guitar: 'music', piano: 'music', drum: 'music',
  ball: 'sport', soccer: 'sport', football: 'sport', trophy: 'sport',
  country: 'flag', nation: 'flag', flags: 'flag',
  arrows: 'arrow', direction: 'arrow',
  sparkle: 'star', sparkles: 'star', stars: 'star', magic: 'star',
  tick: 'check', ok: 'check',
  cancel: 'cross', delete: 'cross',
  alert: 'warning', danger: 'warning', prohibited: 'warning',
  number: 'math', numbers: 'math', plus: 'math', minus: 'math',
  sword: 'weapon', gun: 'weapon',
};

/**
 * Small static English head-word set for the typo-light fallback. A single
 * >=5-char query token with poor recall is matched (Levenshtein <= 2) against
 * this set, then routed through the alias map. Kept tiny on purpose so fuzzy
 * matching cannot cause false-positive chaos.
 */
const HEAD_WORDS: readonly string[] = [
  'happy', 'heart', 'love', 'smile', 'weather', 'rain', 'cloud', 'sun', 'snow',
  'storm', 'wind', 'star', 'flower', 'tree', 'animal', 'person', 'people',
  'money', 'dollar', 'calendar', 'clock', 'time', 'music', 'song', 'dance',
  'flag', 'arrow', 'check', 'cross', 'warning', 'number', 'phone', 'mail',
  'food', 'fruit', 'coffee', 'car', 'train', 'plane', 'fire', 'water', 'moon',
  'sport', 'game', 'ball', 'home', 'school', 'sad', 'angry', 'cry', 'laugh',
  'sleep', 'think', 'idea', 'hand', 'face', 'eye', 'dog', 'cat', 'bear', 'bird',
  'fish', 'horse', 'baby', 'family',
];

// ---- module state ----
let allItems: SearchItem[] = [];
const typeIndexes: Record<ItemType, Index | null> = { emoji: null, symbol: null, kaomoji: null };
let textExactMap: Map<string, number> = new Map();
let nameExactMap: Map<string, number> = new Map();
let lookupCounter = 0;

function itemTypeOf(y: string): ItemType | null {
  if (y === 'emoji' || y === 'symbol' || y === 'kaomoji') return y;
  return null;
}

/** FlexSearch encoder: ASCII word tokens only. Non-ASCII is dropped. */
function encodeAscii(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

export function initSearch(data: SearchItem[]): number {
  const start = performance.now();

  allItems = data;
  for (const type of ALL_TYPES) {
    typeIndexes[type] = new Index({
      encode: encodeAscii,
      tokenize: 'forward',
      resolution: 9,
    });
  }

  textExactMap = new Map();
  nameExactMap = new Map();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const type = itemTypeOf(item.y);
    if (!type) continue;

    // Index content = curated English tokens (g) + name (n) + subcategory (s).
    // g already carries canonical tags + name/category words; n/s add coverage.
    const content = `${item.g} ${item.n} ${item.s ?? ''}`;
    typeIndexes[type]!.add(i, content);

    const textNorm = normalizeExact(item.t);
    if (textNorm && !textExactMap.has(textNorm)) textExactMap.set(textNorm, i);

    const nameNorm = normalizeName(item.n);
    if (nameNorm && !nameExactMap.has(nameNorm)) nameExactMap.set(nameNorm, i);
  }

  return performance.now() - start;
}

export function search(query: string, options: SearchOptions = {}): SearchItem[] {
  if (allItems.length === 0) return [];

  const rawQuery = query.trim();
  if (!rawQuery) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const scores = new Map<number, number>();

  // 1. Exact emoji/symbol paste fast path — O(1), type-agnostic.
  const exactId = textExactMap.get(normalizeExact(rawQuery));
  if (exactId !== undefined) scores.set(exactId, 0);

  // 2. Tokenize into meaningful English terms. Textual search is English-only:
  //    any non-ASCII query (Vietnamese diacritics, CJK, pasted symbol) skips the
  //    textual index entirely and can only ever hit the exact-paste fast path.
  const hasNonAscii = /[^\x00-\x7f]/.test(rawQuery);
  const tokens = hasNonAscii ? [] : tokenize(rawQuery);
  if (tokens.length === 0) {
    if (exactId === undefined) return [];
    if (options.type && itemTypeOf(allItems[exactId]?.y) !== options.type) return [];
    const exactItem = allItems[exactId];
    return exactItem ? [exactItem] : [];
  }

  // 3. Exact name match boost.
  const nameId = nameExactMap.get(tokens.join(' '));
  if (nameId !== undefined) scores.set(nameId, Math.min(scores.get(nameId) ?? 99, 1));

  // 4. Determine active types (catalog scope vs global home search).
  const activeTypes: ItemType[] = options.type ? [options.type] : ALL_TYPES;

  // 5. Primary variants (token + canonical alias), capped at 2 per type.
  const primary = buildPrimaryVariants(tokens);
  runLookups(activeTypes, primary, scores, limit);

  // 6. Reserved typo-light fallback (3rd lookup) — only on poor recall for a
  //    single >=5-char token, against the small static head-word set.
  if (
    scores.size < RECALL_THRESHOLD &&
    tokens.length === 1 &&
    tokens[0].length >= TYPO_MIN_LEN
  ) {
    const head = typoMatch(tokens[0]);
    if (head) {
      const term = QUERY_ALIASES[head] ?? head;
      runLookups(activeTypes, [term], scores, limit);
    }
  }

  // 7. Enforce catalog type scope: the exact-paste and exact-name fast paths
  //    are global, so drop anything outside the requested type before ranking.
  if (options.type) {
    for (const id of scores.keys()) {
      const item = allItems[id];
      if (!item || itemTypeOf(item.y) !== options.type) scores.delete(id);
    }
  }

  return rankAndSlice(scores, limit);
}

export function getItemCount(): number {
  return allItems.length;
}

export function qualityScore(item: SearchItem): number {
  let score = 100;
  if (item.c === 'uncategorized' || item.c === 'misc') score -= 30;
  if (item.y === 'kaomoji') {
    score -= Math.max(0, item.t.length - 24) * 0.8;
    if (/[A-Za-z]{3,}/.test(item.t)) score -= 50;
  }
  if (item.y === 'emoji' && /[\u{1F3FB}-\u{1F3FF}]/u.test(item.t)) score -= 60;
  return score;
}

// ---- internals ----

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
  return matches.filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));
}

/** Build <=2 primary variants: each meaningful token (longest first) plus its
 * canonical alias if it has one. */
function buildPrimaryVariants(tokens: string[]): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (s: string): void => {
    if (s && !seen.has(s) && variants.length < MAX_PRIMARY_VARIANTS) {
      seen.add(s);
      variants.push(s);
    }
  };
  const ordered = [...tokens].sort((a, b) => b.length - a.length);
  for (const tok of ordered) {
    if (variants.length >= MAX_PRIMARY_VARIANTS) break;
    add(tok);
    const canonical = QUERY_ALIASES[tok];
    if (canonical) add(canonical);
  }
  return variants;
}

function runLookups(types: ItemType[], variants: string[], scores: Map<number, number>, limit: number): void {
  for (const type of types) {
    const idx = typeIndexes[type];
    if (!idx) continue;
    for (let v = 0; v < variants.length; v++) {
      const variant = variants[v];
      if (!variant) continue;
      lookupCounter++;
      try {
        const raw = idx.search(variant, limit);
        if (!Array.isArray(raw)) continue;
        for (let rank = 0; rank < raw.length; rank++) {
          const id = typeof raw[rank] === 'number' ? (raw[rank] as number) : (raw[rank] as unknown as { id: number }).id;
          const score = 10 + v * 4 + rank / 1000;
          const prev = scores.get(id);
          if (prev === undefined || score < prev) scores.set(id, score);
        }
      } catch {
        // Ignore malformed query variants.
      }
    }
  }
}

/** Total FlexSearch lookups performed since init (for the benchmark). */
export function getLookupCount(): number {
  return lookupCounter;
}

/** Reset the lookup counter (used by the benchmark between phases). */
export function resetLookupCount(): void {
  lookupCounter = 0;
}

/** Near-match a single token against the small head-word set (Levenshtein). */
function typoMatch(token: string): string | null {
  let best: string | null = null;
  let bestDist = TYPO_MAX_DIST + 1;
  for (const head of HEAD_WORDS) {
    if (Math.abs(head.length - token.length) > TYPO_MAX_DIST) continue;
    const dist = levenshtein(token, head);
    if (dist < bestDist) {
      bestDist = dist;
      best = head;
    }
  }
  return bestDist <= TYPO_MAX_DIST ? best : null;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

function rankAndSlice(scores: Map<number, number>, limit: number): SearchItem[] {
  return Array.from(scores.entries())
    .map(([id, score]) => ({ item: allItems[id], score }))
    .filter((x) => Boolean(x.item))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const qa = qualityScore(a.item);
      const qb = qualityScore(b.item);
      if (qa !== qb) return qb - qa;
      return a.item.n.localeCompare(b.item.n);
    })
    .slice(0, limit)
    .map((x) => x.item);
}

function normalizeExact(text: string): string {
  return String(text).replace(/\s+/g, '').toLowerCase();
}

function normalizeName(text: string): string {
  return String(text).toLowerCase().match(TOKEN_RE)?.join(' ') ?? '';
}
