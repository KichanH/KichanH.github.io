/* =========================================================================
   머니북 · store.js
   데이터 저장 · 조회 · 계산을 독점하는 단일 모듈.
   화면 코드는 절대 localStorage를 직접 만지지 않습니다.
   ========================================================================= */

const SCHEMA_VERSION = 1;

const KEY = {
  meta: 'mb.meta',
  tx: 'mb.transactions',
  acc: 'mb.accounts',
  cat: 'mb.categories',
  budget: 'mb.budgets',
  recur: 'mb.recurrings'
};

/* ---------- 날짜 유틸 (모두 로컬 시간 기준, YYYY-MM-DD 문자열) ---------- */

export const D = {
  today() {
    return D.toISO(new Date());
  },
  toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },
  parse(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  ym(iso) {
    return iso.slice(0, 7);
  },
  thisMonth() {
    return D.today().slice(0, 7);
  },
  daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  },
  addMonths(iso, n) {
    const d = D.parse(iso);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, D.daysInMonth(d.getFullYear(), d.getMonth() + 1)));
    return D.toISO(d);
  },
  addDays(iso, n) {
    const d = D.parse(iso);
    d.setDate(d.getDate() + n);
    return D.toISO(d);
  },
  diffDays(a, b) {
    return Math.round((D.parse(b) - D.parse(a)) / 86400000);
  },
  monthLabel(ym) {
    const [y, m] = ym.split('-');
    return `${y}년 ${Number(m)}월`;
  },
  dayLabel(iso) {
    const d = D.parse(iso);
    const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
  },
  shortLabel(iso) {
    const d = D.parse(iso);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  },
  dotLabel(iso) {
    const d = D.parse(iso);
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  },
  shiftMonth(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  monthRange(ym) {
    const [y, m] = ym.split('-').map(Number);
    return { start: `${ym}-01`, end: `${ym}-${String(D.daysInMonth(y, m)).padStart(2, '0')}` };
  }
};

/* ---------- 기본 데이터 ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const DEFAULT_CATEGORIES = [
  { id: 'c_food', name: '식비', type: 'expense', color: '#0D9B74', colorDark: '#16A87F', icon: 'food' },
  { id: 'c_cafe', name: '카페·간식', type: 'expense', color: '#0D9B74', colorDark: '#16A87F', icon: 'cafe' },
  { id: 'c_trans', name: '교통', type: 'expense', color: '#2A78D6', colorDark: '#4A90E2', icon: 'bus' },
  { id: 'c_home', name: '주거·통신', type: 'expense', color: '#EB6834', colorDark: '#D9622F', icon: 'home' },
  { id: 'c_shop', name: '쇼핑', type: 'expense', color: '#EDA100', colorDark: '#B0842A', icon: 'bag' },
  { id: 'c_health', name: '의료·건강', type: 'expense', color: '#E87BA4', colorDark: '#D46E96', icon: 'health' },
  { id: 'c_fun', name: '문화·여가', type: 'expense', color: '#4A3AA7', colorDark: '#7A71D4', icon: 'play' },
  { id: 'c_etc', name: '기타', type: 'expense', color: '#93A29D', colorDark: '#6C7A75', icon: 'dots' },

  { id: 'i_salary', name: '급여', type: 'income', color: '#0D9B74', colorDark: '#16A87F', icon: 'wallet' },
  { id: 'i_allow', name: '용돈', type: 'income', color: '#2A78D6', colorDark: '#4A90E2', icon: 'gift' },
  { id: 'i_side', name: '부수입', type: 'income', color: '#EDA100', colorDark: '#B0842A', icon: 'trend' },
  { id: 'i_fin', name: '금융수익', type: 'income', color: '#4A3AA7', colorDark: '#7A71D4', icon: 'coin' },
  { id: 'i_refund', name: '환급', type: 'income', color: '#EB6834', colorDark: '#D9622F', icon: 'refund' },
  { id: 'i_etc', name: '기타', type: 'income', color: '#93A29D', colorDark: '#6C7A75', icon: 'dots' }
];

const DEFAULT_ACCOUNTS = [
  { id: 'a_cash', name: '현금 지갑', kind: 'cash', opening: 0, isLiability: false },
  { id: 'a_bank', name: '주거래 통장', kind: 'bank', opening: 0, isLiability: false },
  { id: 'a_card', name: '신용카드', kind: 'card', opening: 0, isLiability: true }
];

const DEFAULT_META = {
  schema: SCHEMA_VERSION,
  theme: 'system',
  createdAt: new Date().toISOString(),
  skippedRecurring: [],
  lastAutoPost: null
};

/* ---------- 저장소 ---------- */

function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[store] 읽기 실패, 기본값 사용:', key, e);
    return fallback;
  }
}

const state = {
  meta: { ...DEFAULT_META },
  transactions: [],
  accounts: [],
  categories: [],
  budgets: [],
  recurrings: []
};

const listeners = new Set();
let storageOk = true;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('[store] 구독자 오류', e);
    }
  });
}

/** 하나의 키를 저장. 실패하면 직전 스냅샷으로 되돌립니다. */
function persist(key, value, snapshot) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    storageOk = true;
    return true;
  } catch (e) {
    console.error('[store] 저장 실패 — 롤백합니다', e);
    storageOk = false;
    if (snapshot !== undefined) {
      if (key === KEY.tx) state.transactions = snapshot;
      if (key === KEY.acc) state.accounts = snapshot;
      if (key === KEY.cat) state.categories = snapshot;
      if (key === KEY.budget) state.budgets = snapshot;
      if (key === KEY.recur) state.recurrings = snapshot;
      if (key === KEY.meta) state.meta = snapshot;
    }
    return false;
  }
}

export function isStorageHealthy() {
  return storageOk;
}

export function load() {
  state.meta = { ...DEFAULT_META, ...readKey(KEY.meta, {}) };
  state.transactions = readKey(KEY.tx, []);
  state.accounts = readKey(KEY.acc, null) || DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
  state.categories = readKey(KEY.cat, null) || DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  state.budgets = readKey(KEY.budget, []);
  state.recurrings = readKey(KEY.recur, []);

  if (readKey(KEY.acc, null) === null) persist(KEY.acc, state.accounts);
  if (readKey(KEY.cat, null) === null) persist(KEY.cat, state.categories);
  persist(KEY.meta, state.meta);

  runAutoPost();
  return state;
}

export function getState() {
  return state;
}

/* ---------- 카테고리 · 계좌 ---------- */

export function categories(type) {
  return type ? state.categories.filter((c) => c.type === type) : state.categories;
}

export function category(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function addCategory({ name, type, color, colorDark, icon }) {
  const c = {
    id: uid(),
    name,
    type,
    color: color || '#93A29D',
    colorDark: colorDark || '#6C7A75',
    icon: icon || 'dots'
  };
  const snap = state.categories.slice();
  state.categories = [...state.categories, c];
  persist(KEY.cat, state.categories, snap);
  emit();
  return c;
}

export function removeCategory(id) {
  const used = state.transactions.some((t) => t.categoryId === id) ||
    state.recurrings.some((r) => r.categoryId === id);
  if (used) return { ok: false, reason: '이미 사용 중인 카테고리는 삭제할 수 없습니다.' };
  const snap = state.categories.slice();
  state.categories = state.categories.filter((c) => c.id !== id);
  persist(KEY.cat, state.categories, snap);
  emit();
  return { ok: true };
}

export function accounts() {
  return state.accounts;
}

export function account(id) {
  return state.accounts.find((a) => a.id === id) || null;
}

export function addAccount({ name, kind, opening, isLiability }) {
  const a = {
    id: uid(),
    name: name.trim(),
    kind: kind || 'bank',
    opening: Number(opening) || 0,
    isLiability: kind === 'card' ? true : !!isLiability
  };
  const snap = state.accounts.slice();
  state.accounts = [...state.accounts, a];
  persist(KEY.acc, state.accounts, snap);
  emit();
  return a;
}

export function updateAccount(id, patch) {
  const snap = state.accounts.slice();
  state.accounts = state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
  persist(KEY.acc, state.accounts, snap);
  emit();
}

export function removeAccount(id) {
  const used = state.transactions.some((t) => t.accountId === id || t.toAccountId === id);
  if (used) return { ok: false, reason: '거래가 있는 계좌는 삭제할 수 없습니다.' };
  const snap = state.accounts.slice();
  state.accounts = state.accounts.filter((a) => a.id !== id);
  persist(KEY.acc, state.accounts, snap);
  emit();
  return { ok: true };
}

/** 계좌 잔액 = 시작 잔액 + 수입 - 지출 ± 이체 (부채 계좌는 부호를 뒤집어 '남은 결제액'으로) */
export function balanceOf(accountId) {
  const acc = account(accountId);
  if (!acc) return 0;
  let bal = acc.opening;
  for (const t of state.transactions) {
    if (t.type === 'income' && t.accountId === accountId) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === accountId) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === accountId) bal -= t.amount;
      if (t.toAccountId === accountId) bal += t.amount;
    }
  }
  return bal;
}

export function assetSummary() {
  let assets = 0;
  let debts = 0;
  for (const a of state.accounts) {
    const b = balanceOf(a.id);
    if (a.isLiability) debts += -b;
    else assets += b;
  }
  return { assets, debts, net: assets - debts };
}

/* ---------- 거래 ---------- */

function sortTx(list) {
  return list.slice().sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));
}

export function transactions({ ym, type, categoryId, accountId, query } = {}) {
  let list = state.transactions;
  if (ym) list = list.filter((t) => t.date.startsWith(ym));
  if (type) list = list.filter((t) => t.type === type);
  if (categoryId) list = list.filter((t) => t.categoryId === categoryId);
  if (accountId) list = list.filter((t) => t.accountId === accountId || t.toAccountId === accountId);
  if (query) {
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = category(t.categoryId);
        return (
          (t.memo || '').toLowerCase().includes(q) ||
          (cat && cat.name.toLowerCase().includes(q)) ||
          String(t.amount).includes(q)
        );
      });
    }
  }
  return sortTx(list);
}

export function transaction(id) {
  return state.transactions.find((t) => t.id === id) || null;
}

export function addTx(input) {
  const t = normalizeTx(input);
  const snap = state.transactions.slice();
  state.transactions = [...state.transactions, t];
  persist(KEY.tx, state.transactions, snap);
  emit();
  return t;
}

export function updateTx(id, patch) {
  const snap = state.transactions.slice();
  state.transactions = state.transactions.map((t) =>
    t.id === id ? normalizeTx({ ...t, ...patch }) : t
  );
  persist(KEY.tx, state.transactions, snap);
  emit();
}

export function removeTx(id) {
  const t = transaction(id);
  const snap = state.transactions.slice();
  state.transactions = state.transactions.filter((x) => x.id !== id);
  persist(KEY.tx, state.transactions, snap);

  // 자동 기록된 회차를 지웠다면 다시 만들지 않습니다.
  if (t && t.recurringId) {
    const key = `${t.recurringId}|${t.date}`;
    if (!state.meta.skippedRecurring.includes(key)) {
      const msnap = { ...state.meta };
      state.meta = { ...state.meta, skippedRecurring: [...state.meta.skippedRecurring, key] };
      persist(KEY.meta, state.meta, msnap);
    }
  }
  emit();
}

function normalizeTx(input) {
  const type = input.type || 'expense';
  return {
    id: input.id || uid(),
    type,
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    date: input.date || D.today(),
    categoryId: type === 'transfer' ? null : input.categoryId || null,
    accountId: input.accountId || null,
    toAccountId: type === 'transfer' ? input.toAccountId || null : null,
    memo: (input.memo || '').trim(),
    installment: input.installment ? Number(input.installment) : null,
    source: input.source || 'manual',
    recurringId: input.recurringId || null,
    createdAt: input.createdAt || Date.now()
  };
}

/* ---------- 월 요약 · 통계 ---------- */

export function monthSummary(ym) {
  let income = 0;
  let expense = 0;
  for (const t of state.transactions) {
    if (!t.date.startsWith(ym)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  const budget = budgetOf(ym);
  return { income, expense, net: income - expense, budget, remaining: budget ? budget - expense : null };
}

export function dayTotal(iso) {
  let sum = 0;
  for (const t of state.transactions) {
    if (t.date !== iso) continue;
    if (t.type === 'income') sum += t.amount;
    else if (t.type === 'expense') sum -= t.amount;
  }
  return sum;
}

export function todayExpense() {
  const iso = D.today();
  let count = 0;
  let sum = 0;
  for (const t of state.transactions) {
    if (t.date === iso && t.type === 'expense') {
      count += 1;
      sum += t.amount;
    }
  }
  return { count, sum };
}

/** 카테고리별 지출 비중 — 큰 순서로 정렬해 반환 */
export function categoryBreakdown(ym, type = 'expense') {
  const map = new Map();
  let total = 0;
  for (const t of state.transactions) {
    if (!t.date.startsWith(ym) || t.type !== type) continue;
    const key = t.categoryId || 'none';
    map.set(key, (map.get(key) || 0) + t.amount);
    total += t.amount;
  }
  const rows = [...map.entries()]
    .map(([id, amount]) => {
      const c = category(id);
      return {
        id,
        name: c ? c.name : '미분류',
        color: c ? c.color : '#93A29D',
        colorDark: c ? c.colorDark : '#6C7A75',
        amount,
        ratio: total ? amount / total : 0
      };
    })
    .sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

/** 최근 n개월 지출 추이 (오래된 달 → 최신 달) */
export function trend(ym, months = 6, type = 'expense') {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = D.shiftMonth(ym, -i);
    let sum = 0;
    for (const t of state.transactions) {
      if (t.date.startsWith(m) && t.type === type) sum += t.amount;
    }
    out.push({ ym: m, label: `${Number(m.split('-')[1])}월`, amount: sum });
  }
  return out;
}

/* ---------- 예산 ---------- */

export function budgetOf(ym) {
  const b = state.budgets.find((x) => x.month === ym);
  return b ? b.limit : 0;
}

export function setBudget(ym, limit) {
  const snap = state.budgets.slice();
  const n = Math.max(0, Math.round(Number(limit) || 0));
  const exists = state.budgets.find((x) => x.month === ym);
  state.budgets = exists
    ? state.budgets.map((x) => (x.month === ym ? { ...x, limit: n } : x))
    : [...state.budgets, { month: ym, categoryId: null, limit: n }];
  persist(KEY.budget, state.budgets, snap);
  emit();
}

/* ---------- 고정지출 (recurring) ---------- */

export function recurrings() {
  return state.recurrings;
}

export function recurring(id) {
  return state.recurrings.find((r) => r.id === id) || null;
}

export function addRecurring(input) {
  const r = normalizeRecurring(input);
  const snap = state.recurrings.slice();
  state.recurrings = [...state.recurrings, r];
  persist(KEY.recur, state.recurrings, snap);
  runAutoPost();
  emit();
  return r;
}

export function updateRecurring(id, patch) {
  const snap = state.recurrings.slice();
  state.recurrings = state.recurrings.map((r) =>
    r.id === id ? normalizeRecurring({ ...r, ...patch }) : r
  );
  persist(KEY.recur, state.recurrings, snap);
  runAutoPost();
  emit();
}

export function removeRecurring(id) {
  const snap = state.recurrings.slice();
  state.recurrings = state.recurrings.filter((r) => r.id !== id);
  persist(KEY.recur, state.recurrings, snap);
  emit();
}

function normalizeRecurring(input) {
  return {
    id: input.id || uid(),
    name: (input.name || '').trim(),
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    cycle: input.cycle || 'monthly',
    cycleDay: Number(input.cycleDay) || 1,
    startDate: input.startDate || D.today(),
    endDate: input.endDate || null,
    categoryId: input.categoryId || null,
    accountId: input.accountId || null,
    autoPost: input.autoPost !== false,
    memo: (input.memo || '').trim(),
    createdAt: input.createdAt || Date.now()
  };
}

/** 특정 주기 항목의 n번째 결제일 (0-based). 범위를 벗어나면 null */
function chargeDateAt(r, index) {
  let iso;
  if (r.cycle === 'weekly') {
    // cycleDay 0~6 (일~토). startDate 이후 첫 해당 요일부터 7일 간격
    const s = D.parse(r.startDate);
    const diff = (r.cycleDay - s.getDay() + 7) % 7;
    iso = D.addDays(r.startDate, diff + index * 7);
  } else if (r.cycle === 'yearly') {
    const s = D.parse(r.startDate);
    const m = s.getMonth() + 1;
    const firstYear = s.getFullYear();
    const dayFirst = Math.min(r.cycleDay, D.daysInMonth(firstYear, m));
    const firstCharge = `${firstYear}-${String(m).padStart(2, '0')}-${String(dayFirst).padStart(2, '0')}`;
    const y = firstYear + index + (firstCharge < r.startDate ? 1 : 0);
    const day = Math.min(r.cycleDay, D.daysInMonth(y, m));
    iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else {
    // monthly
    const s = D.parse(r.startDate);
    const base = new Date(s.getFullYear(), s.getMonth(), 1);
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const day0 = Math.min(r.cycleDay, D.daysInMonth(first.getFullYear(), first.getMonth() + 1));
    const firstCharge = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(day0).padStart(2, '0')}`;
    const offset = firstCharge < r.startDate ? 1 : 0;
    const target = new Date(first.getFullYear(), first.getMonth() + index + offset, 1);
    const day = Math.min(r.cycleDay, D.daysInMonth(target.getFullYear(), target.getMonth() + 1));
    iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (iso < r.startDate) return null;
  if (r.endDate && iso > r.endDate) return null;
  return iso;
}

/** 결제일 목록 (최대 limit개) */
export function chargeDates(r, limit = 600) {
  const out = [];
  for (let i = 0; i < limit; i++) {
    const iso = chargeDateAt(r, i);
    if (!iso) break;
    out.push(iso);
  }
  return out;
}

/** 총 결제 횟수 — 종료일이 없으면 null */
export function totalOccurrences(r) {
  if (!r.endDate) return null;
  return chargeDates(r).length;
}

/** 기간 총액 — 종료일이 없으면 null */
export function periodTotal(r) {
  const n = totalOccurrences(r);
  return n === null ? null : n * r.amount;
}

/** 연 환산 금액 */
export function annualized(r) {
  const per = { monthly: 12, weekly: 52, yearly: 1 }[r.cycle] || 12;
  return r.amount * per;
}

/** 다음 결제일 — 오늘(포함) 이후 첫 결제일. 없으면 null */
export function nextChargeDate(r, from = D.today()) {
  for (let i = 0; i < 600; i++) {
    const iso = chargeDateAt(r, i);
    if (!iso) return null;
    if (iso >= from) return iso;
  }
  return null;
}

/** 상태: active | ending(이번 달 안에 종료) | ended */
export function recurringStatus(r, today = D.today()) {
  if (r.endDate && r.endDate < today) return 'ended';
  if (r.endDate && D.ym(r.endDate) === D.ym(today)) return 'ending';
  if (r.endDate && D.diffDays(today, r.endDate) <= 31) return 'ending';
  return 'active';
}

/** 해당 월의 결제일 목록 */
export function chargesInMonth(r, ym) {
  const { start, end } = D.monthRange(ym);
  return chargeDates(r).filter((d) => d >= start && d <= end);
}

/** 월 고정지출 요약 */
export function recurringSummary(ym = D.thisMonth(), today = D.today()) {
  let monthTotal = 0;
  let paid = 0;
  let upcoming = 0;
  let upcomingCount = 0;
  let yearAhead = 0;
  let paidCount = 0;
  const yearEnd = D.addMonths(today, 12);

  for (const r of state.recurrings) {
    const charges = chargesInMonth(r, ym);
    for (const c of charges) {
      monthTotal += r.amount;
      if (c <= today) {
        paid += r.amount;
        paidCount += 1;
      } else {
        upcoming += r.amount;
        upcomingCount += 1;
      }
    }
    // 앞으로 1년간 실제로 나갈 금액 — 종료일이 있으면 그때까지만 셉니다
    for (const c of chargeDates(r)) {
      if (c < today) continue;
      if (c >= yearEnd) break;
      yearAhead += r.amount;
    }
  }

  const budget = budgetOf(ym);
  return {
    monthTotal,
    paid,
    paidCount,
    upcoming,
    upcomingCount,
    yearAhead,
    budget,
    spendable: budget ? budget - monthTotal : null,
    progress: monthTotal ? paid / monthTotal : 0
  };
}

/** 다음 결제일 순으로 정렬된 목록 (+파생 필드) */
export function recurringList(today = D.today()) {
  return state.recurrings
    .map((r) => {
      const next = nextChargeDate(r, today);
      return {
        ...r,
        next,
        dday: next ? D.diffDays(today, next) : null,
        status: recurringStatus(r, today),
        total: totalOccurrences(r),
        periodTotal: periodTotal(r)
      };
    })
    .sort((a, b) => {
      if (a.next && b.next) return a.next.localeCompare(b.next);
      if (a.next) return -1;
      if (b.next) return 1;
      return a.name.localeCompare(b.name);
    });
}

/** 자동 기록 — 지난 결제일을 훑어 거래를 채웁니다 (중복·삭제분 제외) */
export function runAutoPost(today = D.today()) {
  const created = [];
  const existing = new Set(
    state.transactions.filter((t) => t.recurringId).map((t) => `${t.recurringId}|${t.date}`)
  );
  const skipped = new Set(state.meta.skippedRecurring || []);

  for (const r of state.recurrings) {
    if (!r.autoPost || !r.accountId) continue;
    for (const iso of chargeDates(r)) {
      if (iso > today) break;
      const key = `${r.id}|${iso}`;
      if (existing.has(key) || skipped.has(key)) continue;
      created.push(
        normalizeTx({
          type: 'expense',
          amount: r.amount,
          date: iso,
          categoryId: r.categoryId,
          accountId: r.accountId,
          memo: r.name,
          source: 'recurring',
          recurringId: r.id
        })
      );
      existing.add(key);
    }
  }

  if (created.length) {
    const snap = state.transactions.slice();
    state.transactions = [...state.transactions, ...created];
    persist(KEY.tx, state.transactions, snap);
  }
  const msnap = { ...state.meta };
  state.meta = { ...state.meta, lastAutoPost: today };
  persist(KEY.meta, state.meta, msnap);
  return created.length;
}

/* ---------- 설정 · 백업 ---------- */

export function meta() {
  return state.meta;
}

export function setMeta(patch) {
  const snap = { ...state.meta };
  state.meta = { ...state.meta, ...patch };
  persist(KEY.meta, state.meta, snap);
  emit();
}

export function exportJSON() {
  return JSON.stringify(
    {
      app: 'moneybook',
      schema: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        meta: state.meta,
        transactions: state.transactions,
        accounts: state.accounts,
        categories: state.categories,
        budgets: state.budgets,
        recurrings: state.recurrings
      }
    },
    null,
    2
  );
}

export function importJSON(text, { merge = false } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'JSON 형식이 아닙니다.' };
  }
  const d = parsed && parsed.data;
  if (!d || !Array.isArray(d.transactions)) {
    return { ok: false, reason: '머니북 백업 파일이 아닙니다.' };
  }

  const snapshot = {
    meta: { ...state.meta },
    transactions: state.transactions.slice(),
    accounts: state.accounts.slice(),
    categories: state.categories.slice(),
    budgets: state.budgets.slice(),
    recurrings: state.recurrings.slice()
  };

  try {
    if (merge) {
      const ids = new Set(state.transactions.map((t) => t.id));
      state.transactions = [...state.transactions, ...d.transactions.filter((t) => !ids.has(t.id))];
      const accIds = new Set(state.accounts.map((a) => a.id));
      state.accounts = [...state.accounts, ...(d.accounts || []).filter((a) => !accIds.has(a.id))];
      const catIds = new Set(state.categories.map((c) => c.id));
      state.categories = [...state.categories, ...(d.categories || []).filter((c) => !catIds.has(c.id))];
      const recIds = new Set(state.recurrings.map((r) => r.id));
      state.recurrings = [...state.recurrings, ...(d.recurrings || []).filter((r) => !recIds.has(r.id))];
      const months = new Set(state.budgets.map((b) => b.month));
      state.budgets = [...state.budgets, ...(d.budgets || []).filter((b) => !months.has(b.month))];
    } else {
      state.transactions = d.transactions;
      state.accounts = d.accounts || DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
      state.categories = d.categories || DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      state.budgets = d.budgets || [];
      state.recurrings = d.recurrings || [];
      state.meta = { ...DEFAULT_META, ...(d.meta || {}) };
    }

    const okAll =
      persist(KEY.tx, state.transactions) &&
      persist(KEY.acc, state.accounts) &&
      persist(KEY.cat, state.categories) &&
      persist(KEY.budget, state.budgets) &&
      persist(KEY.recur, state.recurrings) &&
      persist(KEY.meta, state.meta);

    if (!okAll) throw new Error('저장 실패');
    emit();
    return { ok: true, count: d.transactions.length };
  } catch (e) {
    Object.assign(state, snapshot);
    emit();
    return { ok: false, reason: '가져오기에 실패해 이전 데이터로 되돌렸습니다.' };
  }
}

export function wipeAll() {
  Object.values(KEY).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* 무시 */
    }
  });
  state.meta = { ...DEFAULT_META };
  state.transactions = [];
  state.accounts = DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
  state.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  state.budgets = [];
  state.recurrings = [];
  persist(KEY.acc, state.accounts);
  persist(KEY.cat, state.categories);
  persist(KEY.meta, state.meta);
  emit();
}

/* ---------- 포맷 ---------- */

export function won(n) {
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(Math.round(n)).toLocaleString('ko-KR');
}

export function signed(type, amount) {
  if (type === 'income') return '+' + won(amount);
  if (type === 'expense') return '-' + won(amount);
  return won(amount);
}
