/* =========================================================================
   머니북 · app.js
   해시 라우터 + 화면 렌더링. 데이터는 전부 store.js를 통해서만 다룹니다.
   ========================================================================= */

import * as S from './store.js';
import { D, won, signed } from './store.js';
import { icon, ACCOUNT_ICON, ACCOUNT_KIND_LABEL } from './icons.js';

/* ---------------- 공통 헬퍼 ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const isDark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (!document.documentElement.dataset.theme &&
    window.matchMedia('(prefers-color-scheme: dark)').matches);

const catColor = (c) => (!c ? 'var(--text-3)' : isDark() ? c.colorDark : c.color);

/** 색상 + 투명도로 tint 배경을 만듭니다 (color-mix은 폭넓게 지원됨) */
const tint = (color) => `color-mix(in srgb, ${color} 16%, var(--surface))`;

function catIconEl(cat, size = 'sm') {
  const color = catColor(cat);
  return `<div class="ico ${size}" style="background:${tint(color)};color:${color}">${icon(
    cat ? cat.icon : 'dots',
    size === 'sm' ? 17 : 18
  )}</div>`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function go(hash, replace = false) {
  if (replace) location.replace('#' + hash);
  else location.hash = hash;
}

function back() {
  if (history.length > 1) history.back();
  else go('/', true);
}

/* ---------------- 테마 ---------------- */

function applyTheme() {
  const t = S.meta().theme || 'system';
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;

  const dark = isDark();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = dark ? '#0d4c3e' : '#18846c';
  document.head.appendChild(m);
}

/* ---------------- 상태 (화면 로컬) ---------------- */

let viewYm = D.thisMonth();
const historyFilter = { type: '', categoryId: '' };
let statsPeriod = 'month';
let assetTab = 'asset';
let recurTab = 'active';
let sheetState = null;
let currentSheetKey = '';
let baseRoute = { path: '/', q: new URLSearchParams() };

/* ---------------- 라우터 ---------------- */

const SHEET_ROOTS = new Set(['entry', 'tx', 'rec', 'account', 'budget']);

function parseRoute() {
  const raw = (location.hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const segs = path.split('/').filter(Boolean);
  return { path, segs, q: new URLSearchParams(qs || '') };
}

function render() {
  const r = parseRoute();
  const root = r.segs[0] || '';

  if (SHEET_ROOTS.has(root)) {
    renderScreen(baseRoute);
    renderSheet(r);
  } else {
    baseRoute = r;
    renderScreen(r);
    closeSheet();
  }
}

function renderScreen(r) {
  const root = r.segs[0] || '';
  let html;
  if (root === 'history') html = viewHistory();
  else if (root === 'stats') html = viewStats();
  else if (root === 'assets') html = viewAssets();
  else if (root === 'recurring') html = viewRecurring();
  else if (root === 'settings') html = viewSettings();
  else html = viewHome();

  const app = $('#app');
  const prevScroll = app.dataset.route === r.path ? window.scrollY : 0;
  app.dataset.route = r.path;
  app.innerHTML = html;
  window.scrollTo(0, prevScroll);
  if (root === 'history') bindSwipe();
}

/* =========================================================================
   화면: 홈
   ========================================================================= */

function viewHome() {
  const sum = S.monthSummary(viewYm);
  const today = S.todayExpense();
  const asset = S.assetSummary();
  const rec = S.recurringSummary(viewYm);
  const recList = S.recurringList();
  const nextRec = recList.find((r) => r.next);
  const breakdown = S.categoryBreakdown(viewYm);
  const top = breakdown.rows[0];
  const txToday = S.transactions({}).filter((t) => t.date === D.today());
  const monthTxCount = S.transactions({ ym: viewYm }).length;

  const pct = sum.budget ? Math.min(100, Math.round((sum.expense / sum.budget) * 100)) : 0;
  const remain = sum.budget ? sum.budget - sum.expense : sum.net;

  return `
  <div class="screen">
    <header class="hero">
      <div class="hero-top">
        <div class="month-nav">
          <button class="icon-btn" data-act="month" data-d="-1" aria-label="이전 달">${icon('back', 17, 2)}</button>
          <b>${D.monthLabel(viewYm)}</b>
          <button class="icon-btn" data-act="month" data-d="1" aria-label="다음 달">${icon('forward', 17, 2)}</button>
        </div>
        <button class="ghost-btn" data-act="nav" data-to="/settings" aria-label="설정">${icon('settings', 18)}</button>
      </div>

      <div class="hero-label">${sum.budget ? '이번 달 남은 금액' : '이번 달 수입 - 지출'}</div>
      <div class="hero-amount num">${won(remain)}<small>원</small></div>

      <div class="hero-pills">
        <div class="hero-pill"><span>수입</span><b class="num">${won(sum.income)}</b></div>
        <div class="hero-pill"><span>지출</span><b class="num">${won(sum.expense)}</b></div>
      </div>

      ${
        sum.budget
          ? `<div class="hero-budget">
              <div class="hline"><span>예산 <span class="num">${won(sum.budget)}</span>원${
                rec.monthTotal ? ` · 고정지출 <span class="num">${won(rec.monthTotal)}</span>원 포함` : ''
              }</span><span class="num">${pct}%</span></div>
              <div class="bar"><i style="width:${pct}%"></i></div>
            </div>`
          : `<div class="hero-budget"><button class="hline" data-act="nav" data-to="/budget" style="opacity:.85;font-size:11px">
              <span>예산을 정하면 남은 금액을 계산해 드려요</span><span>설정 →</span></button></div>`
      }
    </header>

    <div class="body gap-8">
      <div class="section-label">빠른 메뉴</div>

      <button class="menu-card accent-expense" data-act="nav" data-to="/entry?type=expense">
        <div class="ico" style="background:var(--expense-tint);color:var(--expense)">${icon('arrowDown', 18, 1.9)}</div>
        <div class="grow"><div class="t">지출 입력</div><div class="s">${
          today.count ? `오늘 ${today.count}건 · <span class="num">${won(today.sum)}</span>원` : '오늘 기록이 아직 없어요'
        }</div></div>
        ${icon('forward', 17, 2)}
      </button>

      <button class="menu-card accent-income" data-act="nav" data-to="/entry?type=income">
        <div class="ico" style="background:var(--income-tint);color:var(--income)">${icon('arrowUp', 18, 1.9)}</div>
        <div class="grow"><div class="t">수입 입력</div><div class="s">이번 달 <span class="num">${won(sum.income)}</span>원</div></div>
        ${icon('forward', 17, 2)}
      </button>

      <button class="menu-card" data-act="nav" data-to="/recurring">
        <div class="ico" style="background:var(--brand-tint);color:var(--brand)">${icon('repeat', 18)}</div>
        <div class="grow"><div class="t">고정지출</div><div class="s">${
          nextRec
            ? `${esc(nextRec.name)} ${D.shortLabel(nextRec.next)} 결제 예정`
            : '유튜브·넷플릭스 같은 정기결제를 등록해 보세요'
        }</div></div>
        ${
          nextRec && nextRec.dday !== null
            ? `<span class="badge ${nextRec.dday <= 7 ? 'warn' : 'muted'} num">${
                nextRec.dday === 0 ? '오늘' : 'D-' + nextRec.dday
              }</span>`
            : ''
        }
        ${icon('forward', 17, 2)}
      </button>

      <button class="menu-card" data-act="nav" data-to="/assets">
        <div class="ico" style="background:var(--brand-tint);color:var(--brand)">${icon('card', 18)}</div>
        <div class="grow"><div class="t">자산</div><div class="s">순자산 <span class="num">${won(asset.net)}</span>원</div></div>
        ${icon('forward', 17, 2)}
      </button>

      <button class="menu-card" data-act="nav" data-to="/history">
        <div class="ico" style="background:var(--brand-tint);color:var(--brand)">${icon('list', 18)}</div>
        <div class="grow"><div class="t">거래내역</div><div class="s">${
          monthTxCount ? `${D.monthLabel(viewYm).split(' ')[1]} ${monthTxCount}건` : '아직 기록이 없어요'
        }</div></div>
        ${icon('forward', 17, 2)}
      </button>

      <button class="menu-card" data-act="nav" data-to="/stats">
        <div class="ico" style="background:var(--brand-tint);color:var(--brand)">${icon('chart', 18, 1.9)}</div>
        <div class="grow"><div class="t">통계</div><div class="s">${
          top ? `${esc(top.name)}가 ${Math.round(top.ratio * 100)}%로 가장 많아요` : '기록이 쌓이면 분석해 드려요'
        }</div></div>
        ${icon('forward', 17, 2)}
      </button>

      ${
        txToday.length
          ? `<div class="section-head" style="padding-top:9px">
              <span class="section-label" style="padding:0">오늘 ${txToday.length}건 · <span class="num">${won(
                Math.abs(S.dayTotal(D.today()))
              )}</span>원</span>
              <a href="#/history" data-act="nav" data-to="/history">전체 보기</a>
            </div>
            <div class="card">${txToday.slice(0, 3).map(txRow).join('<div class="sep"></div>')}</div>`
          : ''
      }
    </div>
  </div>`;
}

function txRow(t) {
  const cat = S.category(t.categoryId);
  const acc = S.account(t.accountId);
  const to = S.account(t.toAccountId);
  const label =
    t.type === 'transfer'
      ? `${acc ? esc(acc.name) : '?'} → ${to ? esc(to.name) : '?'}`
      : esc(t.memo || (cat ? cat.name : '기록'));
  const sub =
    t.type === 'transfer'
      ? '계좌 이체'
      : [cat ? cat.name : null, acc ? acc.name : null, t.source === 'recurring' ? '고정지출' : null]
          .filter(Boolean)
          .join(' · ');
  const amtClass =
    t.type === 'income' ? 'amt-income' : t.type === 'expense' ? 'amt-expense' : 'amt-muted';
  const ico =
    t.type === 'transfer'
      ? `<div class="ico sm" style="background:var(--surface-2);color:var(--text-2)">${icon('swap', 17)}</div>`
      : catIconEl(cat);

  return `<button class="row" data-act="detail" data-id="${t.id}">
    ${ico}
    <div class="grow"><div class="t">${label}</div><div class="s">${esc(sub)}</div></div>
    <div class="amt num ${amtClass}">${signed(t.type, t.amount)}</div>
  </button>`;
}

/* =========================================================================
   화면: 거래내역
   ========================================================================= */

function viewHistory() {
  const sum = S.monthSummary(viewYm);
  const list = S.transactions({
    ym: viewYm,
    type: historyFilter.type || undefined,
    categoryId: historyFilter.categoryId || undefined
  });

  const groups = [];
  for (const t of list) {
    const g = groups.find((x) => x.date === t.date);
    if (g) g.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }

  const filterCat = historyFilter.categoryId ? S.category(historyFilter.categoryId) : null;

  return `
  <div class="screen">
    <header class="nav">
      <button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 21, 2)}</button>
      <h1>거래내역</h1>
      <div class="nav-actions"></div>
    </header>

    <div class="body">
      <div class="section-head" style="padding:0 4px">
        <div class="month-nav" style="color:var(--text-1)">
          <button class="icon-btn" style="width:32px;height:36px;color:var(--text-3)" data-act="month" data-d="-1" aria-label="이전 달">${icon('back', 17, 2)}</button>
          <b style="font-size:14px">${D.monthLabel(viewYm)}</b>
          <button class="icon-btn" style="width:32px;height:36px;color:var(--text-3)" data-act="month" data-d="1" aria-label="다음 달">${icon('forward', 17, 2)}</button>
        </div>
        <div style="display:flex;gap:10px;font-size:12px;font-weight:700">
          <span class="num" style="color:var(--income)">+${won(sum.income)}</span>
          <span class="num" style="color:var(--expense)">-${won(sum.expense)}</span>
        </div>
      </div>

      <div class="chips scroll">
        <button class="chip" data-act="filter" data-type="" aria-pressed="${!historyFilter.type}">전체</button>
        <button class="chip" data-act="filter" data-type="expense" aria-pressed="${historyFilter.type === 'expense'}">지출</button>
        <button class="chip" data-act="filter" data-type="income" aria-pressed="${historyFilter.type === 'income'}">수입</button>
        <button class="chip" data-act="filter" data-type="transfer" aria-pressed="${historyFilter.type === 'transfer'}">이체</button>
        ${
          filterCat
            ? `<button class="chip" data-act="clear-cat" aria-pressed="true"><span class="dot" style="background:${catColor(
                filterCat
              )}"></span>${esc(filterCat.name)} ${icon('close', 12, 2.4)}</button>`
            : ''
        }
      </div>

      ${
        groups.length
          ? groups
              .map(
                (g) => `
        <div>
          <div class="day-head"><span>${D.dayLabel(g.date)}</span><span class="num">${
                  S.dayTotal(g.date) >= 0 ? '+' : ''
                }${won(S.dayTotal(g.date))}</span></div>
          <div class="card">${g.items.map(swipeRow).join('<div class="sep"></div>')}</div>
        </div>`
              )
              .join('')
          : `<div class="card"><div class="empty">${icon('receipt', 34, 1.4)}<b>${
              historyFilter.type || filterCat ? '조건에 맞는 기록이 없어요' : '이 달의 기록이 없어요'
            }</b><p>아래 + 버튼으로 첫 기록을 남겨 보세요.</p></div></div>`
      }
    </div>

    <button class="fab" data-act="nav" data-to="/entry?type=expense" aria-label="내역 추가">${icon('plus', 23, 2.2)}</button>
  </div>`;
}

function swipeRow(t) {
  return `<div class="swipe" data-id="${t.id}" style="position:relative;overflow:hidden">
    <div class="swipe-actions" style="position:absolute;inset:0 0 0 auto;display:flex">
      <button class="swipe-act" data-act="edit" data-id="${t.id}" style="width:62px;background:var(--text-2);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:10px">${icon(
    'edit',
    16,
    1.9
  )}수정</button>
      <button class="swipe-act" data-act="delete" data-id="${t.id}" style="width:62px;background:var(--expense);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:10px">${icon(
    'trash',
    16,
    1.9
  )}삭제</button>
    </div>
    <div class="swipe-front" style="position:relative;background:var(--surface);transition:transform .18s ease;touch-action:pan-y">
      ${txRow(t)}
    </div>
  </div>`;
}

/** 좌로 밀어 수정/삭제 노출 */
function bindSwipe() {
  let open = null;
  document.querySelectorAll('.swipe').forEach((wrap) => {
    const front = wrap.querySelector('.swipe-front');
    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let mode = null;

    front.addEventListener(
      'touchstart',
      (e) => {
        if (open && open !== front) {
          open.style.transform = '';
          open = null;
        }
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
        dx = 0;
        mode = null;
      },
      { passive: true }
    );

    front.addEventListener(
      'touchmove',
      (e) => {
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        if (mode === null) {
          if (Math.abs(cx - x0) > 8 && Math.abs(cx - x0) > Math.abs(cy - y0)) mode = 'x';
          else if (Math.abs(cy - y0) > 8) mode = 'y';
        }
        if (mode !== 'x') return;
        dx = Math.min(0, Math.max(-124, cx - x0));
        front.style.transition = 'none';
        front.style.transform = `translateX(${dx}px)`;
      },
      { passive: true }
    );

    const end = () => {
      if (mode !== 'x') return;
      front.style.transition = '';
      if (dx < -50) {
        front.style.transform = 'translateX(-124px)';
        open = front;
      } else {
        front.style.transform = '';
        if (open === front) open = null;
      }
    };
    front.addEventListener('touchend', end, { passive: true });
    front.addEventListener('touchcancel', end, { passive: true });
  });
}

/* =========================================================================
   화면: 통계
   ========================================================================= */

function viewStats() {
  const isYear = statsPeriod === 'year';
  const year = viewYm.slice(0, 4);

  // 조회 범위 — 연 모드는 'YYYY', 월 모드는 'YYYY-MM'.
  // store의 필터가 date.startsWith(범위)라 두 형태를 그대로 씁니다.
  const scope = isYear ? year : viewYm;
  const prevScope = isYear ? String(Number(year) - 1) : D.shiftMonth(viewYm, -1);

  const bd = S.categoryBreakdown(scope);
  const sum = S.monthSummary(scope);
  const prev = S.monthSummary(prevScope);

  // 추이 — 월 모드는 최근 6개월, 연 모드는 그 해 1~12월
  const tr = isYear
    ? Array.from({ length: 12 }, (_, i) => {
        const m = `${year}-${String(i + 1).padStart(2, '0')}`;
        return { ym: m, label: String(i + 1), amount: S.monthSummary(m).expense };
      })
    : S.trend(viewYm, 6);

  const nowYm = D.thisMonth();
  const hiIndex = isYear
    ? tr.findIndex((x) => x.ym === nowYm) // 올해가 아니면 -1 → 강조 없음
    : tr.length - 1;

  const max = Math.max(1, ...tr.map((x) => x.amount));
  const diff = prev.expense ? ((sum.expense - prev.expense) / prev.expense) * 100 : null;
  const budget = isYear ? 0 : sum.budget; // 예산은 월 단위로만 씁니다
  const pct = budget ? Math.min(100, Math.round((sum.expense / budget) * 100)) : 0;
  const periodLabel = isYear ? `${year}년` : D.monthLabel(viewYm);
  const shortLabel = isYear ? `${year}년` : `${Number(viewYm.slice(5))}월`;
  const cols = tr.length;

  const C = 2 * Math.PI * 54;
  let offset = 0;
  const arcs = bd.rows
    .map((r) => {
      const len = r.ratio * C;
      const seg = `<circle r="54" fill="none" stroke="${catColor(
        S.category(r.id)
      )}" stroke-width="22" stroke-dasharray="${Math.max(0, len - 3).toFixed(1)} ${C.toFixed(
        1
      )}" stroke-dashoffset="${(-offset).toFixed(1)}"></circle>`;
      offset += len;
      return seg;
    })
    .join('');

  return `
  <div class="screen">
    <header class="nav">
      <button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 21, 2)}</button>
      <h1>통계</h1>
      <div class="nav-actions"></div>
    </header>

    <div class="body">
      <div class="section-head" style="padding:0">
        <div class="segment" style="width:150px">
          <button data-act="stats-period" data-p="month" aria-pressed="${statsPeriod === 'month'}">월</button>
          <button data-act="stats-period" data-p="year" aria-pressed="${statsPeriod === 'year'}">연</button>
        </div>
        <div class="month-nav">
          <button class="icon-btn" style="width:32px;height:36px;color:var(--text-3)" data-act="stats-nav" data-d="-1" aria-label="${
            isYear ? '이전 해' : '이전 달'
          }">${icon('back', 16, 2)}</button>
          <b style="font-size:13px">${periodLabel}</b>
          <button class="icon-btn" style="width:32px;height:36px;color:var(--text-3)" data-act="stats-nav" data-d="1" aria-label="${
            isYear ? '다음 해' : '다음 달'
          }">${icon('forward', 16, 2)}</button>
        </div>
      </div>

      ${
        bd.total
          ? `<div class="card pad">
        <div class="donut-wrap">
          <svg width="152" height="152" viewBox="0 0 152 152" role="img" aria-label="카테고리별 지출 비중">
            <g transform="translate(76,76) rotate(-90)">
              <circle r="54" fill="none" stroke="var(--surface-2)" stroke-width="22"></circle>
              ${arcs}
            </g>
            <text x="76" y="68" text-anchor="middle" font-size="10" fill="var(--text-2)">${shortLabel} 총 지출</text>
            <text x="76" y="88" text-anchor="middle" font-size="17" font-weight="700" fill="var(--text-1)">${won(
              bd.total
            )}</text>
          </svg>
        </div>
        ${
          diff === null
            ? ''
            : `<div style="text-align:center;margin-top:6px;font-size:11px;color:var(--text-2)">${
                isYear ? '전년' : '전월'
              } 대비 <b class="num" style="color:${
                diff <= 0 ? 'var(--income)' : 'var(--expense)'
              }">${diff > 0 ? '+' : ''}${diff.toFixed(1)}%</b></div>`
        }
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:12px">
          ${bd.rows
            .map((r) => {
              const color = catColor(S.category(r.id));
              return `<button class="rank" data-act="filter-cat" data-id="${r.id}">
                <span class="dot" style="width:9px;height:9px;border-radius:3px;background:${color};flex-shrink:0"></span>
                <span class="nm">${esc(r.name)}</span>
                <span class="track"><i style="width:${(r.ratio * 100).toFixed(1)}%;background:${color}"></i></span>
                <span class="v num">${won(r.amount)}</span>
                <span class="p num">${Math.round(r.ratio * 100)}%</span>
              </button>`;
            })
            .join('')}
        </div>
      </div>`
          : `<div class="card"><div class="empty">${icon('chart', 34, 1.4)}<b>${
              isYear ? `${year}년에 기록된 지출이 없어요` : '분석할 지출이 없어요'
            }</b><p>지출을 몇 건 기록하면<br>카테고리별 비중을 보여드립니다.</p></div></div>`
      }

      <div class="card pad">
        <div class="section-head" style="padding:0">
          <span style="font-size:12px;font-weight:700">월별 지출 추이</span>
          <span style="font-size:10px;color:var(--text-2)">${isYear ? `${year}년 1~12월` : '최근 6개월'}</span>
        </div>
        <div class="trend" style="grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${
          isYear ? 4 : 10
        }px">
          ${tr
            .map((x, i) => {
              const on = i === hiIndex;
              const h = Math.max(3, Math.round((x.amount / max) * 96));
              // 연 모드는 막대가 좁아 금액 라벨이 줄바꿈되므로 생략합니다
              return `<div class="col ${on ? 'on' : ''}">${
                !isYear && on && x.amount ? `<b class="num">${Math.round(x.amount / 10000)}만</b>` : ''
              }<i style="height:${h}px"></i></div>`;
            })
            .join('')}
        </div>
        <div class="trend-x" style="grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${
          isYear ? 4 : 10
        }px;font-size:${isYear ? 9 : 10}px">
          ${tr.map((x, i) => `<div class="${i === hiIndex ? 'on' : ''}">${x.label}</div>`).join('')}
        </div>
      </div>

      ${
        isYear
          ? `<div class="card pad">
              <div class="section-head" style="padding:0">
                <span style="font-size:12px;font-weight:700">${year}년 요약</span>
                <span style="font-size:10px;color:var(--text-2)">기록된 달 기준</span>
              </div>
              <div style="display:flex;gap:10px;margin-top:12px">
                <div style="flex:1">
                  <div style="font-size:10px;color:var(--text-2)">총 수입</div>
                  <div class="num" style="font-size:15px;font-weight:700;color:var(--income);margin-top:1px">${won(
                    sum.income
                  )}원</div>
                </div>
                <div style="flex:1">
                  <div style="font-size:10px;color:var(--text-2)">총 지출</div>
                  <div class="num" style="font-size:15px;font-weight:700;color:var(--expense);margin-top:1px">${won(
                    sum.expense
                  )}원</div>
                </div>
                <div style="flex:1">
                  <div style="font-size:10px;color:var(--text-2)">월 평균 지출</div>
                  <div class="num" style="font-size:15px;font-weight:700;margin-top:1px">${won(
                    tr.filter((x) => x.amount > 0).length
                      ? sum.expense / tr.filter((x) => x.amount > 0).length
                      : 0
                  )}원</div>
                </div>
              </div>
            </div>`
          : `<button class="card pad" data-act="nav" data-to="/budget" style="text-align:left;width:100%">
              <div class="section-head" style="padding:0">
                <span style="font-size:12px;font-weight:700">${shortLabel} 예산</span>
                <span class="num" style="font-size:11px;color:var(--text-2)">${
                  budget ? `${won(sum.expense)} / ${won(budget)}` : '설정하기 →'
                }</span>
              </div>
              ${
                budget
                  ? `<div class="track" style="margin-top:9px;height:8px"><i style="width:${pct}%;background:var(--warn)"></i></div>
                     <div style="margin-top:8px;font-size:11px;color:var(--text-2)">남은 예산 <b class="num" style="color:var(--text-1)">${won(
                       budget - sum.expense
                     )}원</b></div>`
                  : `<div style="margin-top:8px;font-size:11px;color:var(--text-2)">예산을 정하면 남은 금액과 소진율을 계산해 드려요.</div>`
              }
            </button>`
      }
    </div>
  </div>`;
}

/* =========================================================================
   화면: 자산
   ========================================================================= */

function viewAssets() {
  const s = S.assetSummary();
  const list = S.accounts().filter((a) => (assetTab === 'asset' ? !a.isLiability : a.isLiability));
  const groups = [];
  for (const a of list) {
    const key = ACCOUNT_KIND_LABEL[a.kind] || '기타';
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(a);
    else groups.push({ key, items: [a] });
  }

  const counts = {
    asset: S.accounts().filter((a) => !a.isLiability).length,
    debt: S.accounts().filter((a) => a.isLiability).length
  };

  return `
  <div class="screen">
    <header class="nav">
      <button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 21, 2)}</button>
      <h1>자산</h1>
      <div class="nav-actions">
        <button class="icon-btn brand" data-act="nav" data-to="/account/new" aria-label="계좌 추가">${icon('plus', 20, 2)}</button>
      </div>
    </header>

    <div class="body">
      <div class="hero compact">
        <div style="font-size:11px;opacity:.82">순자산</div>
        <div class="hero-amount num" style="padding-left:0;font-size:28px;margin-top:2px">${won(s.net)}<small>원</small></div>
        <div class="hero-pills">
          <div class="hero-pill"><span>총 자산</span><b class="num">${won(s.assets)}</b></div>
          <div class="hero-pill"><span>총 부채</span><b class="num">${won(s.debts)}</b></div>
        </div>
      </div>

      <div class="segment">
        <button data-act="asset-tab" data-t="asset" aria-pressed="${assetTab === 'asset'}">자산 ${counts.asset}</button>
        <button data-act="asset-tab" data-t="debt" aria-pressed="${assetTab === 'debt'}">부채 ${counts.debt}</button>
      </div>

      ${
        groups.length
          ? groups
              .map(
                (g) => `
        <div>
          <div class="section-label" style="padding-bottom:8px">${g.key}</div>
          <div class="card">
            ${g.items
              .map((a) => {
                const bal = S.balanceOf(a.id);
                const shown = a.isLiability ? -bal : bal;
                return `<button class="row" data-act="nav" data-to="/account/${a.id}">
                  <div class="ico sm" style="background:var(--brand-tint);color:var(--brand)">${icon(
                    ACCOUNT_ICON[a.kind] || 'bank',
                    17
                  )}</div>
                  <div class="grow"><div class="t">${esc(a.name)}</div><div class="s">${
                  ACCOUNT_KIND_LABEL[a.kind] || ''
                }${a.opening ? ` · 시작 잔액 ${won(a.opening)}` : ''}</div></div>
                  <div class="amt num ${a.isLiability && shown > 0 ? 'amt-expense' : ''}">${
                  a.isLiability && shown > 0 ? '-' : ''
                }${won(Math.abs(shown))}</div>
                </button>`;
              })
              .join('<div class="sep"></div>')}
          </div>
        </div>`
              )
              .join('')
          : `<div class="card"><div class="empty">${icon('card', 34, 1.4)}<b>${
              assetTab === 'asset' ? '등록된 자산이 없어요' : '등록된 부채가 없어요'
            }</b><p>계좌·현금·카드를 추가하면<br>순자산을 계산해 드립니다.</p></div></div>`
      }

      <button class="btn dashed" data-act="nav" data-to="/account/new">${icon('plus', 16, 2)} 계좌 · 자산 추가</button>
    </div>
  </div>`;
}

/* =========================================================================
   화면: 고정지출
   ========================================================================= */

function viewRecurring() {
  const sum = S.recurringSummary(viewYm);
  const all = S.recurringList();
  const counts = {
    active: all.filter((r) => r.status === 'active').length,
    ending: all.filter((r) => r.status === 'ending').length,
    ended: all.filter((r) => r.status === 'ended').length
  };
  const list = all.filter((r) => r.status === recurTab);
  const progress = Math.round(sum.progress * 100);

  return `
  <div class="screen">
    <header class="nav">
      <button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 21, 2)}</button>
      <h1>고정지출</h1>
      <div class="nav-actions">
        <button class="icon-btn brand" data-act="nav" data-to="/rec/new" aria-label="고정지출 추가">${icon('plus', 20, 2)}</button>
      </div>
    </header>

    <div class="body">
      <div class="hero compact">
        <div style="font-size:11px;opacity:.82">매월 고정지출</div>
        <div class="hero-amount num" style="padding-left:0;font-size:28px;margin-top:2px">${won(sum.monthTotal)}<small>원</small></div>
        <div class="hero-pills">
          <div class="hero-pill"><span>이번 달 남은 결제</span><b class="num">${won(sum.upcoming)} <span style="font-size:10px;font-weight:400;opacity:.8">${
    sum.upcomingCount
  }건</span></b></div>
          <div class="hero-pill"><span>앞으로 1년</span><b class="num">${won(sum.yearAhead)}</b></div>
        </div>
        ${
          sum.monthTotal
            ? `<div class="hero-budget" style="padding:0">
                <div class="hline"><span>${
                  sum.upcomingCount
                    ? `${sum.paidCount}건 완료 · ${sum.upcomingCount}건 남음`
                    : '이번 달 결제 완료'
                }</span><span class="num">${won(sum.paid)} / ${won(sum.monthTotal)}</span></div>
                <div class="bar"><i style="width:${progress}%"></i></div>
              </div>`
            : ''
        }
      </div>

      ${
        sum.budget
          ? `<button class="card pad" data-act="nav" data-to="/budget" style="display:flex;align-items:center;gap:11px;width:100%;text-align:left">
              <div class="ico sm" style="background:var(--brand-tint);color:var(--brand)">${icon('won', 17)}</div>
              <div class="grow">
                <div style="font-size:11px;color:var(--text-2)">${D.monthLabel(viewYm).split(' ')[1]} 예산에서 고정지출을 빼면</div>
                <div style="font-size:14px;font-weight:700;margin-top:2px">쓸 수 있는 돈 <span class="num">${won(
                  sum.spendable
                )}원</span></div>
              </div>
              ${icon('forward', 17, 2)}
            </button>`
          : ''
      }

      <div class="segment">
        <button data-act="rec-tab" data-t="active" aria-pressed="${recurTab === 'active'}">진행 중 ${counts.active}</button>
        <button data-act="rec-tab" data-t="ending" aria-pressed="${recurTab === 'ending'}">종료 예정 ${counts.ending}</button>
        <button data-act="rec-tab" data-t="ended" aria-pressed="${recurTab === 'ended'}">종료됨 ${counts.ended}</button>
      </div>

      ${
        list.length
          ? `<div class="card">${list.map(recRow).join('<div class="sep"></div>')}</div>`
          : `<div class="card"><div class="empty">${icon('repeat', 34, 1.4)}<b>${
              recurTab === 'active' ? '등록된 고정지출이 없어요' : '해당하는 항목이 없어요'
            }</b><p>유튜브 프리미엄처럼 매달 빠져나가는 돈을<br>등록하면 남은 예산까지 계산해 드립니다.</p></div></div>`
      }

      <button class="btn dashed" data-act="nav" data-to="/rec/new">${icon('plus', 16, 2)} 고정지출 추가</button>
    </div>
  </div>`;
}

function recRow(r) {
  const cat = S.category(r.categoryId);
  const acc = S.account(r.accountId);
  const cycleLabel =
    r.cycle === 'weekly'
      ? `매주 ${['일', '월', '화', '수', '목', '금', '토'][r.cycleDay]}요일`
      : r.cycle === 'yearly'
      ? `매년 ${D.parse(r.startDate).getMonth() + 1}월 ${r.cycleDay}일`
      : `매월 ${r.cycleDay}일`;

  const rightTop = `<div class="amt num amt-${r.status === 'ended' ? 'muted' : 'expense'}">-${won(r.amount)}</div>`;
  const rightBottom =
    r.status === 'ended'
      ? '<div style="font-size:10px;color:var(--text-3);margin-top:1px">종료</div>'
      : r.dday === null
      ? '<div style="font-size:10px;color:var(--text-3);margin-top:1px">예정 없음</div>'
      : `<div class="num" style="font-size:10px;margin-top:1px;font-weight:700;color:${
          r.dday <= 7 ? 'var(--warn)' : 'var(--text-3)'
        }">${r.dday === 0 ? '오늘' : 'D-' + r.dday}</div>`;

  return `<button class="row" data-act="nav" data-to="/rec/${r.id}">
    ${catIconEl(cat)}
    <div class="grow">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="t">${esc(r.name)}</span>
        ${
          r.status === 'ending' && r.endDate
            ? `<span class="badge warn">${D.shortLabel(r.endDate)} 종료</span>`
            : ''
        }
      </div>
      <div class="s">${cycleLabel}${acc ? ` · ${esc(acc.name)}` : ''}${
    r.periodTotal ? ` · 총 ${won(r.periodTotal)}원` : ''
  }</div>
    </div>
    <div style="text-align:right">${rightTop}${rightBottom}</div>
  </button>`;
}

/* =========================================================================
   화면: 설정
   ========================================================================= */

function viewSettings() {
  const m = S.meta();
  const st = S.getState();
  const themeLabel = { system: '시스템 설정', light: '라이트', dark: '다크' }[m.theme || 'system'];

  return `
  <div class="screen">
    <header class="nav">
      <button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 21, 2)}</button>
      <h1>설정</h1>
      <div class="nav-actions"></div>
    </header>

    <div class="body">
      <div class="section-label">화면</div>
      <div class="card pad">
        <div style="font-size:12px;font-weight:700;margin-bottom:9px">테마 · 현재 ${themeLabel}</div>
        <div class="segment">
          <button data-act="theme" data-v="system" aria-pressed="${(m.theme || 'system') === 'system'}">시스템</button>
          <button data-act="theme" data-v="light" aria-pressed="${m.theme === 'light'}">라이트</button>
          <button data-act="theme" data-v="dark" aria-pressed="${m.theme === 'dark'}">다크</button>
        </div>
      </div>

      <div class="section-label">가계부</div>
      <div class="card">
        <button class="kv" data-act="nav" data-to="/budget">
          <span class="k">${D.monthLabel(viewYm).split(' ')[1]} 예산</span>
          <span class="v num">${S.budgetOf(viewYm) ? won(S.budgetOf(viewYm)) + '원' : '설정 안 함'}</span>
        </button>
        <div class="sep" style="margin-left:14px"></div>
        <button class="kv" data-act="nav" data-to="/assets">
          <span class="k">계좌 · 자산</span>
          <span class="v">${S.accounts().length}개</span>
        </button>
        <div class="sep" style="margin-left:14px"></div>
        <button class="kv" data-act="nav" data-to="/recurring">
          <span class="k">고정지출</span>
          <span class="v">${S.recurrings().length}개</span>
        </button>
      </div>

      <div class="section-label">데이터</div>
      <div class="card">
        <button class="kv" data-act="export">
          <span class="k">JSON으로 내보내기</span>
          <span class="v">${st.transactions.length}건</span>
        </button>
        <div class="sep" style="margin-left:14px"></div>
        <button class="kv" data-act="import">
          <span class="k">백업 파일 가져오기</span>
          <span class="v">덮어쓰기</span>
        </button>
        <div class="sep" style="margin-left:14px"></div>
        <button class="kv" data-act="wipe">
          <span class="k" style="color:var(--expense)">모든 데이터 삭제</span>
          <span class="v">${icon('trash', 16, 1.9)}</span>
        </button>
      </div>
      <p class="note">데이터는 이 기기의 브라우저 저장소에만 있습니다. 서버로 보내지 않으니 기기를 바꾸거나 브라우저 데이터를 지우면 사라집니다 — 가끔 내보내기로 백업해 두세요.</p>

      <div class="section-label">앱</div>
      <div class="card">
        <div class="kv"><span class="k">버전</span><span class="v">1.0.0</span></div>
        <div class="sep" style="margin-left:14px"></div>
        <div class="kv"><span class="k">저장소 상태</span><span class="v">${
          S.isStorageHealthy() ? '정상' : '쓰기 실패'
        }</span></div>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
  </div>`;
}

/* =========================================================================
   시트
   ========================================================================= */

function closeSheet() {
  const s = $('#sheet');
  if (s.innerHTML) s.innerHTML = '';
  currentSheetKey = '';
  sheetState = null;
  document.body.style.overflow = '';
}

function renderSheet(r) {
  const key = r.path + '?' + r.q.toString();
  const fresh = key !== currentSheetKey;
  currentSheetKey = key;
  document.body.style.overflow = 'hidden';

  const root = r.segs[0];
  let html = '';

  if (root === 'entry') {
    if (fresh) sheetState = initEntryState(r);
    html = sheetEntry();
  } else if (root === 'tx') {
    html = sheetDetail(r.segs[1]);
  } else if (root === 'rec') {
    if (fresh) sheetState = initRecState(r.segs[1]);
    html = sheetRecurring();
  } else if (root === 'account') {
    if (fresh) sheetState = initAccountState(r.segs[1]);
    html = sheetAccount();
  } else if (root === 'budget') {
    if (fresh) sheetState = { limit: String(S.budgetOf(viewYm) || '') };
    html = sheetBudget();
  }

  $('#sheet').innerHTML = `<div class="backdrop" data-act="close-sheet"></div>${html}`;
}

/* ---------- 입력 시트 ---------- */

function initEntryState(r) {
  const id = r.q.get('id');
  if (id) {
    const t = S.transaction(id);
    if (t) {
      return {
        mode: 'edit',
        id: t.id,
        type: t.type,
        amount: String(t.amount || ''),
        pending: 0,
        categoryId: t.categoryId,
        accountId: t.accountId,
        toAccountId: t.toAccountId,
        date: t.date,
        memo: t.memo || ''
      };
    }
  }
  const type = r.q.get('type') || 'expense';
  const accs = S.accounts();
  const defaultAcc = accs.find((a) => !a.isLiability) || accs[0];
  return {
    mode: 'new',
    id: null,
    type,
    amount: '',
    pending: 0,
    categoryId: (S.categories(type)[0] || {}).id || null,
    accountId: defaultAcc ? defaultAcc.id : null,
    toAccountId: accs.filter((a) => a.id !== (defaultAcc || {}).id)[0]?.id || null,
    date: D.today(),
    memo: ''
  };
}

function entryTotal() {
  return (sheetState.pending || 0) + (Number(sheetState.amount) || 0);
}

function sheetEntry() {
  const s = sheetState;
  const isTransfer = s.type === 'transfer';
  const cats = S.categories(s.type === 'income' ? 'income' : 'expense');
  const cat = S.category(s.categoryId);
  const acc = S.account(s.accountId);
  const toAcc = S.account(s.toAccountId);
  const total = entryTotal();
  const color = s.type === 'income' ? 'var(--income)' : s.type === 'expense' ? 'var(--expense)' : 'var(--brand)';

  const meta = isTransfer
    ? `${acc ? esc(acc.name) : '?'} → ${toAcc ? esc(toAcc.name) : '?'} · ${D.dotLabel(s.date)}`
    : `${cat ? esc(cat.name) : '카테고리 없음'} · ${acc ? esc(acc.name) : '계좌 없음'} · ${D.dotLabel(s.date)}`;

  return `
  <section class="sheet full" role="dialog" aria-label="${s.mode === 'edit' ? '거래 수정' : '내역 입력'}">
    <div class="sheet-head">
      <div class="handle"></div>
      <div class="sheet-bar">
        <button class="icon-btn" data-act="close-sheet" aria-label="닫기">${icon('close', 19, 2)}</button>
        <div class="segment type" style="flex:1;max-width:250px">
          <button data-act="entry-type" data-type="expense" data-t="expense" aria-pressed="${s.type === 'expense'}">지출</button>
          <button data-act="entry-type" data-type="income" data-t="income" aria-pressed="${s.type === 'income'}">수입</button>
          <button data-act="entry-type" data-type="transfer" data-t="transfer" aria-pressed="${s.type === 'transfer'}">이체</button>
        </div>
        ${
          s.mode === 'edit'
            ? `<button class="icon-btn" data-act="delete" data-id="${s.id}" style="color:var(--expense)" aria-label="삭제">${icon('trash', 19, 1.9)}</button>`
            : '<div style="width:44px"></div>'
        }
      </div>
    </div>

    <div class="amount-display">
      <div class="cap">금액${s.pending ? ` · 이어서 더하는 중 (${won(s.pending)} +)` : ''}</div>
      <div class="big num" style="color:${color}">${won(total)}<small>원</small></div>
      <div class="meta">${meta}</div>
    </div>

    <div class="sheet-body">
      ${
        isTransfer
          ? `<div>
              <div class="form-label">보내는 곳</div>
              <div class="chips scroll">${S.accounts()
                .map(
                  (a) =>
                    `<button class="chip" data-act="pick-acc" data-id="${a.id}" aria-pressed="${
                      a.id === s.accountId
                    }">${esc(a.name)}</button>`
                )
                .join('')}</div>
            </div>
            <div>
              <div class="form-label">받는 곳</div>
              <div class="chips scroll">${S.accounts()
                .map(
                  (a) =>
                    `<button class="chip" data-act="pick-to-acc" data-id="${a.id}" aria-pressed="${
                      a.id === s.toAccountId
                    }" ${a.id === s.accountId ? 'disabled style="opacity:.4"' : ''}>${esc(a.name)}</button>`
                )
                .join('')}</div>
            </div>`
          : `<div>
              <div class="section-head" style="padding:0 4px 6px">
                <span class="form-label" style="padding:0">카테고리</span>
              </div>
              <div class="cat-grid">
                ${cats
                  .map((c) => {
                    const on = c.id === s.categoryId;
                    const col = catColor(c);
                    return `<button class="cat-tile" data-act="pick-cat" data-id="${c.id}" aria-pressed="${on}"
                      style="${on ? `background:${tint(col)};border-color:${col};color:${col}` : ''}">
                      ${icon(c.icon, 18)}<span>${esc(c.name)}</span></button>`;
                  })
                  .join('')}
              </div>
            </div>
            <div>
              <div class="form-label">${s.type === 'income' ? '입금 계좌' : '결제수단'}</div>
              <div class="chips scroll">
                ${S.accounts()
                  .map(
                    (a) =>
                      `<button class="chip" data-act="pick-acc" data-id="${a.id}" aria-pressed="${
                        a.id === s.accountId
                      }">${esc(a.name)}</button>`
                  )
                  .join('')}
                <button class="chip dashed" data-act="nav" data-to="/account/new">${icon('plus', 13, 2)}</button>
              </div>
            </div>`
      }

      <div class="field-row">
        <label class="field" style="flex:1">
          ${icon('calendar', 17)}
          <input type="date" value="${s.date}" data-act="pick-date" aria-label="날짜">
        </label>
        <label class="field" style="flex:1.3">
          ${icon('memo', 17)}
          <input type="text" value="${esc(s.memo)}" placeholder="메모 (선택)" data-act="memo" maxlength="40">
        </label>
      </div>
      <div style="height:4px"></div>
    </div>

    <div class="keypad">
      ${['1', '2', '3']
        .map((k) => `<button class="key" data-act="key" data-k="${k}">${k}</button>`)
        .join('')}
      <button class="key util" data-act="key" data-k="back" aria-label="지우기">${icon('backspace', 20, 1.8)}</button>
      ${['4', '5', '6']
        .map((k) => `<button class="key" data-act="key" data-k="${k}">${k}</button>`)
        .join('')}
      <button class="key save" data-act="save-entry" ${total > 0 ? '' : 'disabled'}>저장</button>
      ${['7', '8', '9']
        .map((k) => `<button class="key" data-act="key" data-k="${k}">${k}</button>`)
        .join('')}
      <button class="key" data-act="key" data-k="00" style="font-size:16px">00</button>
      <button class="key" data-act="key" data-k="0">0</button>
      <button class="key util" data-act="key" data-k="plus" aria-label="이어서 더하기">+</button>
    </div>
  </section>`;
}

/* ---------- 거래 상세 시트 ---------- */

function sheetDetail(id) {
  const t = S.transaction(id);
  if (!t) return '<section class="sheet"><div class="sheet-body"><div class="empty"><b>기록을 찾을 수 없어요</b></div></div></section>';

  const cat = S.category(t.categoryId);
  const acc = S.account(t.accountId);
  const to = S.account(t.toAccountId);
  const color =
    t.type === 'income' ? 'var(--income)' : t.type === 'expense' ? 'var(--expense)' : 'var(--text-1)';

  const bd = S.categoryBreakdown(D.ym(t.date));
  const inCat = bd.rows.find((r) => r.id === t.categoryId);
  const share = inCat && inCat.amount ? Math.round((t.amount / inCat.amount) * 100) : null;

  const rows = [
    ['날짜', `${D.dotLabel(t.date)} (${['일', '월', '화', '수', '목', '금', '토'][D.parse(t.date).getDay()]})`],
    t.type === 'transfer'
      ? ['이체', `${acc ? esc(acc.name) : '?'} → ${to ? esc(to.name) : '?'}`]
      : ['결제수단', acc ? esc(acc.name) : '-'],
    t.type === 'transfer' ? null : ['카테고리', cat ? esc(cat.name) : '미분류'],
    t.memo ? ['메모', esc(t.memo)] : null,
    ['등록', t.source === 'recurring' ? '고정지출 자동 기록' : '직접 입력']
  ].filter(Boolean);

  return `
  <section class="sheet" role="dialog" aria-label="거래 상세">
    <div style="padding:10px 20px 20px">
      <div class="handle"></div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="min-width:0">
          ${
            cat
              ? `<div class="chip" style="background:${tint(catColor(cat))};border-color:transparent;color:${catColor(
                  cat
                )};font-weight:700"><span class="dot" style="background:${catColor(cat)}"></span>${esc(cat.name)}</div>`
              : `<div class="chip">${t.type === 'transfer' ? '이체' : '미분류'}</div>`
          }
          <div style="margin-top:10px;font-size:16px;font-weight:500">${esc(t.memo || (cat ? cat.name : '기록'))}</div>
          <div class="num" style="margin-top:2px;font-size:32px;font-weight:700;color:${color}">${signed(
    t.type,
    t.amount
  )}<small style="font-size:18px;font-weight:500;color:var(--text-1)">원</small></div>
        </div>
        ${
          cat
            ? `<div class="ico" style="width:40px;height:40px;border-radius:13px;background:${tint(
                catColor(cat)
              )};color:${catColor(cat)}">${icon(cat.icon, 20)}</div>`
            : ''
        }
      </div>

      <div style="margin-top:16px">
        ${rows
          .map(
            (r, i) =>
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;${
                i < rows.length - 1 ? 'border-bottom:1px solid var(--line-soft)' : ''
              }">
                <span style="font-size:12px;color:var(--text-2)">${r[0]}</span>
                <span style="font-size:13px;font-weight:500;text-align:right">${r[1]}</span>
              </div>`
          )
          .join('')}
      </div>

      ${
        share !== null && t.type === 'expense'
          ? `<div style="margin-top:8px;padding:12px 14px;border-radius:12px;background:var(--bg);display:flex;align-items:center;gap:9px">
              ${icon('chart', 17, 1.8)}
              <span style="font-size:11px;color:var(--text-2)">이번 달 ${esc(
                cat.name
              )} 지출의 <b class="num" style="color:var(--text-1)">${share}%</b>를 차지해요</span>
            </div>`
          : ''
      }

      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="btn danger" style="flex:1" data-act="delete" data-id="${t.id}">${icon('trash', 17, 1.9)} 삭제</button>
        <button class="btn" style="flex:2" data-act="nav" data-to="/entry?id=${t.id}">${icon('edit', 17, 1.9)} 수정하기</button>
      </div>
      <div style="height:calc(6px + var(--safe-bottom))"></div>
    </div>
  </section>`;
}

/* ---------- 고정지출 시트 ---------- */

function initRecState(id) {
  if (id && id !== 'new') {
    const r = S.recurring(id);
    if (r) {
      return {
        mode: 'edit',
        id: r.id,
        name: r.name,
        amount: String(r.amount || ''),
        cycle: r.cycle,
        cycleDay: r.cycleDay,
        startDate: r.startDate,
        endDate: r.endDate,
        noEnd: !r.endDate,
        categoryId: r.categoryId,
        accountId: r.accountId,
        autoPost: r.autoPost,
        error: ''
      };
    }
  }
  const today = D.today();
  const accs = S.accounts();
  const card = accs.find((a) => a.kind === 'card') || accs[0];
  return {
    mode: 'new',
    id: null,
    name: '',
    amount: '',
    cycle: 'monthly',
    cycleDay: D.parse(today).getDate(),
    startDate: today,
    endDate: null,
    noEnd: true,
    categoryId: (S.categories('expense')[0] || {}).id || null,
    accountId: card ? card.id : null,
    autoPost: true,
    error: ''
  };
}

function recDraft() {
  const s = sheetState;
  return {
    id: s.id || 'draft',
    name: s.name,
    amount: Number(s.amount) || 0,
    cycle: s.cycle,
    cycleDay: Number(s.cycleDay) || 1,
    startDate: s.startDate,
    endDate: s.noEnd ? null : s.endDate,
    categoryId: s.categoryId,
    accountId: s.accountId,
    autoPost: s.autoPost
  };
}

function sheetRecurring() {
  const s = sheetState;
  const draft = recDraft();
  const total = S.totalOccurrences(draft);
  const pTotal = S.periodTotal(draft);
  const annual = S.annualized(draft);
  const next = S.nextChargeDate(draft);
  const cats = S.categories('expense');
  const cycleLabel =
    s.cycle === 'weekly'
      ? `매주 ${['일', '월', '화', '수', '목', '금', '토'][s.cycleDay] || '월'}요일`
      : s.cycle === 'yearly'
      ? `매년 ${D.parse(s.startDate).getMonth() + 1}월 ${s.cycleDay}일`
      : `매월 ${s.cycleDay}일`;

  return `
  <section class="sheet full" role="dialog" aria-label="${s.mode === 'edit' ? '고정지출 수정' : '고정지출 추가'}">
    <div class="sheet-head">
      <div class="handle"></div>
      <div class="sheet-bar">
        <button class="icon-btn" data-act="close-sheet" aria-label="닫기">${icon('close', 19, 2)}</button>
        <h2>${s.mode === 'edit' ? '고정지출 수정' : '고정지출 추가'}</h2>
        ${
          s.mode === 'edit'
            ? `<button class="icon-btn" data-act="delete-rec" data-id="${s.id}" style="color:var(--expense)" aria-label="삭제">${icon('trash', 19, 1.9)}</button>`
            : '<div style="width:44px"></div>'
        }
      </div>
    </div>

    <div class="sheet-body">
      <div>
        <div class="form-label">매회 결제 금액</div>
        <label class="field">
          ${icon('won', 17)}
          <input type="text" inputmode="numeric" value="${esc(s.amount)}" placeholder="14900" data-act="rec-amount" aria-label="금액">
          <span style="color:var(--text-2);font-size:13px">원</span>
        </label>
      </div>

      <div>
        <div class="form-label">이름</div>
        <label class="field">
          ${icon('repeat', 17)}
          <input type="text" value="${esc(s.name)}" placeholder="유튜브 프리미엄" data-act="rec-name" maxlength="30" aria-label="이름">
        </label>
      </div>

      <div>
        <div class="form-label">결제 주기</div>
        <div class="segment">
          <button data-act="rec-cycle" data-v="weekly" aria-pressed="${s.cycle === 'weekly'}">매주</button>
          <button data-act="rec-cycle" data-v="monthly" aria-pressed="${s.cycle === 'monthly'}">매월</button>
          <button data-act="rec-cycle" data-v="yearly" aria-pressed="${s.cycle === 'yearly'}">매년</button>
        </div>
        <label class="field" style="margin-top:8px;justify-content:space-between">
          <span style="display:flex;align-items:center;gap:9px">${icon('calendar', 17)}<span class="val">결제일</span></span>
          <select data-act="rec-day" aria-label="결제일">
            ${(s.cycle === 'weekly'
              ? ['일', '월', '화', '수', '목', '금', '토'].map((d, i) => ({ v: i, label: `매주 ${d}요일` }))
              : s.cycle === 'yearly'
              ? Array.from({ length: 31 }, (_, i) => ({
                  v: i + 1,
                  label: `매년 ${D.parse(s.startDate).getMonth() + 1}월 ${i + 1}일`
                }))
              : Array.from({ length: 31 }, (_, i) => ({ v: i + 1, label: `매월 ${i + 1}일` }))
            )
              .map((o) => `<option value="${o.v}" ${Number(s.cycleDay) === o.v ? 'selected' : ''}>${o.label}</option>`)
              .join('')}
          </select>
        </label>
      </div>

      <div>
        <div class="form-label">기간</div>
        <div class="field-row">
          <label class="field">
            ${icon('calStart', 16)}
            <span class="stack"><span class="cap">시작</span>
              <input type="date" value="${s.startDate}" data-act="rec-start" aria-label="시작일"></span>
          </label>
          <label class="field ${s.error === 'date' ? 'error' : ''}" style="${
    s.noEnd ? 'opacity:.45;pointer-events:none' : ''
  }">
            ${icon('calEnd', 16)}
            <span class="stack"><span class="cap">종료</span>
              <input type="date" value="${s.endDate || ''}" data-act="rec-end" aria-label="종료일"></span>
          </label>
        </div>
        <button class="field" style="margin-top:8px;justify-content:space-between" data-act="rec-noend">
          <span style="font-size:13px;color:var(--text-2)">종료일 없이 계속 결제</span>
          <span class="toggle" aria-pressed="${s.noEnd}"><i></i></span>
        </button>
        ${s.error === 'date' ? '<div class="err-text">종료일이 시작일보다 빠릅니다.</div>' : ''}
      </div>

      ${
        draft.amount > 0
          ? `<div class="calc-box">
              <div class="head">${icon('calc', 15, 1.9)} 자동 계산</div>
              <div class="calc-grid">
                <div><span>총 결제 횟수</span><b class="num">${total === null ? '무기한' : total + '회'}</b></div>
                <div style="flex:1.4"><span>기간 총액</span><b class="num">${
                  pTotal === null ? '—' : won(pTotal) + '원'
                }</b></div>
                <div style="flex:1.2"><span>연 환산</span><b class="num">${won(annual)}원</b></div>
              </div>
              <div class="calc-note">${
                next
                  ? `다음 결제는 <b>${D.dotLabel(next)}</b>${
                      draft.endDate ? ` · 마지막 결제 <b>${D.dotLabel(S.chargeDates(draft).slice(-1)[0] || next)}</b>` : ''
                    }.`
                  : '남은 결제가 없습니다.'
              }${draft.endDate ? ' 종료일이 지나면 자동으로 ‘종료됨’으로 넘어갑니다.' : ''}</div>
            </div>`
          : ''
      }

      <div>
        <div class="form-label">카테고리</div>
        <div class="chips scroll">
          ${cats
            .map((c) => {
              const on = c.id === s.categoryId;
              const col = catColor(c);
              return `<button class="chip" data-act="rec-cat" data-id="${c.id}" aria-pressed="${on}"
                style="${on ? `background:${tint(col)};border-color:${col};color:${col};font-weight:700` : ''}">
                <span class="dot" style="background:${col}"></span>${esc(c.name)}</button>`;
            })
            .join('')}
        </div>
      </div>

      <div>
        <div class="form-label">결제수단</div>
        <div class="chips scroll">
          ${S.accounts()
            .map(
              (a) =>
                `<button class="chip" data-act="rec-acc" data-id="${a.id}" aria-pressed="${
                  a.id === s.accountId
                }">${esc(a.name)}</button>`
            )
            .join('')}
        </div>
      </div>

      <button class="field" style="min-height:52px;justify-content:space-between" data-act="rec-auto">
        <span style="min-width:0;text-align:left">
          <span style="font-size:13px;font-weight:500;display:block">결제일에 거래내역으로 자동 기록</span>
          <span style="font-size:10px;color:var(--text-3)">앱을 열 때 지난 결제분을 한 번에 채웁니다</span>
        </span>
        <span class="toggle" aria-pressed="${s.autoPost}"><i></i></span>
      </button>

      <div style="height:4px"></div>
    </div>

    <div class="sheet-foot">
      <button class="btn" data-act="save-rec" ${
        draft.amount > 0 && draft.name.trim() ? '' : 'disabled'
      }>저장하기</button>
    </div>
  </section>`;
}

/* ---------- 계좌 시트 ---------- */

function initAccountState(id) {
  if (id && id !== 'new') {
    const a = S.account(id);
    if (a) return { mode: 'edit', id: a.id, name: a.name, kind: a.kind, opening: String(a.opening || '') };
  }
  return { mode: 'new', id: null, name: '', kind: 'bank', opening: '' };
}

function sheetAccount() {
  const s = sheetState;
  const kinds = [
    ['bank', '입출금'],
    ['cash', '현금'],
    ['invest', '투자'],
    ['card', '카드']
  ];
  const bal = s.mode === 'edit' ? S.balanceOf(s.id) : null;

  return `
  <section class="sheet" role="dialog" aria-label="계좌">
    <div style="padding:10px 16px 16px">
      <div class="handle"></div>
      <div class="sheet-bar" style="padding:0 0 14px">
        <button class="icon-btn" data-act="close-sheet" aria-label="닫기">${icon('close', 19, 2)}</button>
        <h2>${s.mode === 'edit' ? '계좌 수정' : '계좌 추가'}</h2>
        ${
          s.mode === 'edit'
            ? `<button class="icon-btn" data-act="delete-acc" data-id="${s.id}" style="color:var(--expense)" aria-label="삭제">${icon('trash', 19, 1.9)}</button>`
            : '<div style="width:44px"></div>'
        }
      </div>

      <div class="form-label">이름</div>
      <label class="field">
        ${icon(ACCOUNT_ICON[s.kind] || 'bank', 17)}
        <input type="text" value="${esc(s.name)}" placeholder="신한 주거래" data-act="acc-name" maxlength="20" aria-label="계좌 이름">
      </label>

      <div class="form-label" style="padding-top:12px">유형</div>
      <div class="chips">
        ${kinds
          .map(
            ([k, label]) =>
              `<button class="chip" data-act="acc-kind" data-v="${k}" aria-pressed="${s.kind === k}">${label}</button>`
          )
          .join('')}
      </div>

      <div class="form-label" style="padding-top:12px">시작 잔액</div>
      <label class="field">
        ${icon('won', 17)}
        <input type="text" inputmode="numeric" value="${esc(s.opening)}" placeholder="0" data-act="acc-opening" aria-label="시작 잔액">
        <span style="color:var(--text-2);font-size:13px">원</span>
      </label>
      <p class="note" style="padding-top:8px">${
        s.kind === 'card'
          ? '카드는 부채로 계산됩니다. 이 카드로 결제한 금액이 쌓여 결제 예정액이 됩니다.'
          : '지금 이 계좌에 들어 있는 금액을 넣으면, 이후 기록에 따라 잔액이 자동으로 계산됩니다.'
      }</p>
      ${
        bal !== null
          ? `<div class="card pad" style="margin-top:4px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;color:var(--text-2)">현재 잔액</span>
              <b class="num">${won(bal)}원</b>
            </div>`
          : ''
      }

      <div style="margin-top:16px">
        <button class="btn" data-act="save-acc" ${s.name.trim() ? '' : 'disabled'}>저장하기</button>
      </div>
      <div style="height:calc(4px + var(--safe-bottom))"></div>
    </div>
  </section>`;
}

/* ---------- 예산 시트 ---------- */

function sheetBudget() {
  const s = sheetState;
  const sum = S.monthSummary(viewYm);
  const rec = S.recurringSummary(viewYm);
  const limit = Number(s.limit) || 0;

  return `
  <section class="sheet" role="dialog" aria-label="예산 설정">
    <div style="padding:10px 16px 16px">
      <div class="handle"></div>
      <div class="sheet-bar" style="padding:0 0 14px">
        <button class="icon-btn" data-act="close-sheet" aria-label="닫기">${icon('close', 19, 2)}</button>
        <h2>${D.monthLabel(viewYm)} 예산</h2>
        <div style="width:44px"></div>
      </div>

      <label class="field">
        ${icon('won', 17)}
        <input type="text" inputmode="numeric" value="${esc(s.limit)}" placeholder="2600000" data-act="budget-input" aria-label="예산 금액">
        <span style="color:var(--text-2);font-size:13px">원</span>
      </label>

      ${
        limit > 0
          ? `<div class="calc-box" style="margin-top:12px">
              <div class="head">${icon('calc', 15, 1.9)} 이 예산이면</div>
              <div class="calc-grid">
                <div><span>고정지출</span><b class="num">${won(rec.monthTotal)}원</b></div>
                <div><span>쓸 수 있는 돈</span><b class="num">${won(limit - rec.monthTotal)}원</b></div>
              </div>
              <div class="calc-note">지금까지 <b class="num">${won(sum.expense)}원</b>을 썼으니 남은 예산은 <b class="num">${won(
              limit - sum.expense
            )}원</b>입니다.</div>
            </div>`
          : '<p class="note" style="padding-top:10px">한 달에 쓸 금액을 정하면 홈에서 남은 금액을 계산해 드립니다. 고정지출은 자동으로 빠집니다.</p>'
      }

      <div style="margin-top:16px;display:flex;gap:10px">
        ${
          S.budgetOf(viewYm)
            ? '<button class="btn secondary" style="flex:1" data-act="clear-budget">해제</button>'
            : ''
        }
        <button class="btn" style="flex:2" data-act="save-budget">저장하기</button>
      </div>
      <div style="height:calc(4px + var(--safe-bottom))"></div>
    </div>
  </section>`;
}

/* =========================================================================
   이벤트
   ========================================================================= */

function repaintSheet() {
  const r = parseRoute();
  const root = r.segs[0];
  let html = '';
  if (root === 'entry') html = sheetEntry();
  else if (root === 'rec') html = sheetRecurring();
  else if (root === 'account') html = sheetAccount();
  else if (root === 'budget') html = sheetBudget();
  else if (root === 'tx') html = sheetDetail(r.segs[1]);
  $('#sheet').innerHTML = `<div class="backdrop" data-act="close-sheet"></div>${html}`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const s = sheetState;

  switch (act) {
    case 'nav':
      e.preventDefault();
      go(el.dataset.to);
      break;

    case 'back':
      back();
      break;

    case 'close-sheet':
      back();
      break;

    case 'month': {
      viewYm = D.shiftMonth(viewYm, Number(el.dataset.d));
      renderScreen(parseRoute());
      break;
    }

    case 'detail':
      go('/tx/' + el.dataset.id);
      break;

    case 'edit':
      go('/entry?id=' + el.dataset.id);
      break;

    case 'delete': {
      const id = el.dataset.id;
      if (confirm('이 기록을 삭제할까요?')) {
        S.removeTx(id);
        toast('삭제했습니다');
        if (parseRoute().segs[0]) back();
        else renderScreen(parseRoute());
      }
      break;
    }

    case 'filter':
      historyFilter.type = el.dataset.type;
      historyFilter.categoryId = '';
      renderScreen(parseRoute());
      break;

    case 'clear-cat':
      historyFilter.categoryId = '';
      renderScreen(parseRoute());
      break;

    case 'filter-cat':
      historyFilter.categoryId = el.dataset.id;
      historyFilter.type = 'expense';
      go('/history');
      break;

    case 'stats-period':
      statsPeriod = el.dataset.p;
      renderScreen(parseRoute());
      break;

    case 'stats-nav':
      // 연 모드에서는 12개월씩 — 해가 통째로 넘어갑니다
      viewYm = D.shiftMonth(viewYm, Number(el.dataset.d) * (statsPeriod === 'year' ? 12 : 1));
      renderScreen(parseRoute());
      break;

    case 'asset-tab':
      assetTab = el.dataset.t;
      renderScreen(parseRoute());
      break;

    case 'rec-tab':
      recurTab = el.dataset.t;
      renderScreen(parseRoute());
      break;

    /* ---- 입력 시트 ---- */
    case 'entry-type': {
      const t = el.dataset.t;
      s.type = t;
      if (t !== 'transfer') {
        const cats = S.categories(t === 'income' ? 'income' : 'expense');
        if (!cats.find((c) => c.id === s.categoryId)) s.categoryId = (cats[0] || {}).id || null;
      }
      repaintSheet();
      break;
    }

    case 'pick-cat':
      s.categoryId = el.dataset.id;
      repaintSheet();
      break;

    case 'pick-acc':
      s.accountId = el.dataset.id;
      if (s.toAccountId === s.accountId) {
        const other = S.accounts().find((a) => a.id !== s.accountId);
        s.toAccountId = other ? other.id : null;
      }
      repaintSheet();
      break;

    case 'pick-to-acc':
      s.toAccountId = el.dataset.id;
      repaintSheet();
      break;

    case 'key': {
      const k = el.dataset.k;
      if (k === 'back') {
        if (s.amount) s.amount = s.amount.slice(0, -1);
        else if (s.pending) s.pending = 0;
      } else if (k === 'plus') {
        const cur = Number(s.amount) || 0;
        if (cur > 0) {
          s.pending = (s.pending || 0) + cur;
          s.amount = '';
        }
      } else {
        if (s.amount.length < 12) s.amount = (s.amount === '0' ? '' : s.amount) + k;
      }
      repaintSheet();
      break;
    }

    case 'save-entry': {
      const total = entryTotal();
      if (total <= 0) return;
      if (s.type === 'transfer' && (!s.accountId || !s.toAccountId || s.accountId === s.toAccountId)) {
        toast('보내는 곳과 받는 곳을 다르게 골라 주세요');
        return;
      }
      const payload = {
        type: s.type,
        amount: total,
        date: s.date,
        categoryId: s.type === 'transfer' ? null : s.categoryId,
        accountId: s.accountId,
        toAccountId: s.type === 'transfer' ? s.toAccountId : null,
        memo: s.memo
      };
      if (s.mode === 'edit') {
        S.updateTx(s.id, payload);
        toast('수정했습니다');
      } else {
        S.addTx(payload);
        toast(`${won(total)}원 기록했습니다`);
      }
      back();
      break;
    }

    /* ---- 고정지출 시트 ---- */
    case 'rec-cycle':
      s.cycle = el.dataset.v;
      if (s.cycle === 'weekly' && s.cycleDay > 6) s.cycleDay = D.parse(s.startDate).getDay();
      if (s.cycle !== 'weekly' && s.cycleDay < 1) s.cycleDay = D.parse(s.startDate).getDate();
      repaintSheet();
      break;

    case 'rec-cat':
      s.categoryId = el.dataset.id;
      repaintSheet();
      break;

    case 'rec-acc':
      s.accountId = el.dataset.id;
      repaintSheet();
      break;

    case 'rec-noend':
      s.noEnd = !s.noEnd;
      if (s.noEnd) s.error = '';
      if (!s.noEnd && !s.endDate) s.endDate = D.addMonths(s.startDate, 12);
      repaintSheet();
      break;

    case 'rec-auto':
      s.autoPost = !s.autoPost;
      repaintSheet();
      break;

    case 'save-rec': {
      const draft = recDraft();
      if (!draft.name.trim()) return toast('이름을 입력해 주세요');
      if (draft.amount <= 0) return toast('금액을 입력해 주세요');
      if (draft.endDate && draft.endDate < draft.startDate) {
        s.error = 'date';
        repaintSheet();
        return;
      }
      if (s.mode === 'edit') {
        S.updateRecurring(s.id, draft);
        toast('수정했습니다');
      } else {
        S.addRecurring(draft);
        const n = S.totalOccurrences(draft);
        toast(n === null ? '고정지출을 등록했습니다' : `총 ${n}회 · ${won(S.periodTotal(draft))}원으로 등록했습니다`);
      }
      back();
      break;
    }

    case 'delete-rec':
      if (confirm('이 고정지출을 삭제할까요? 이미 기록된 거래는 남습니다.')) {
        S.removeRecurring(el.dataset.id);
        toast('삭제했습니다');
        back();
      }
      break;

    /* ---- 계좌 시트 ---- */
    case 'acc-kind':
      s.kind = el.dataset.v;
      repaintSheet();
      break;

    case 'save-acc': {
      if (!s.name.trim()) return;
      const payload = {
        name: s.name,
        kind: s.kind,
        opening: Number(s.opening) || 0,
        isLiability: s.kind === 'card'
      };
      if (s.mode === 'edit') {
        S.updateAccount(s.id, payload);
        toast('수정했습니다');
      } else {
        S.addAccount(payload);
        toast('계좌를 추가했습니다');
      }
      back();
      break;
    }

    case 'delete-acc': {
      const res = S.removeAccount(el.dataset.id);
      if (!res.ok) toast(res.reason);
      else {
        toast('삭제했습니다');
        back();
      }
      break;
    }

    /* ---- 예산 시트 ---- */
    case 'save-budget':
      S.setBudget(viewYm, Number(sheetState.limit) || 0);
      toast('예산을 저장했습니다');
      back();
      break;

    case 'clear-budget':
      S.setBudget(viewYm, 0);
      toast('예산을 해제했습니다');
      back();
      break;

    /* ---- 설정 ---- */
    case 'theme':
      S.setMeta({ theme: el.dataset.v });
      applyTheme();
      renderScreen(parseRoute());
      break;

    case 'export':
      exportData();
      break;

    case 'import':
      $('#import-file').click();
      break;

    case 'wipe':
      if (confirm('모든 거래·계좌·고정지출을 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) {
        S.wipeAll();
        toast('모두 삭제했습니다');
        go('/', true);
        render();
      }
      break;

    default:
      break;
  }
});

/* 입력 필드 (input 이벤트) */
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const s = sheetState;
  const digits = (v) => v.replace(/[^\d]/g, '');

  switch (el.dataset.act) {
    case 'memo':
      s.memo = el.value;
      break;
    case 'pick-date':
      s.date = el.value || D.today();
      repaintSheet();
      break;
    case 'rec-amount':
      s.amount = digits(el.value);
      el.value = s.amount;
      scheduleRepaint();
      break;
    case 'rec-name':
      s.name = el.value;
      scheduleRepaint();
      break;
    case 'rec-start': {
      s.startDate = el.value || D.today();
      // 시작일을 바꾸면 결제일도 그날로 맞춥니다 (9일에 시작 → 매월 9일)
      const sd = D.parse(s.startDate);
      s.cycleDay = s.cycle === 'weekly' ? sd.getDay() : sd.getDate();
      s.error = '';
      repaintSheet();
      break;
    }
    case 'rec-end':
      s.endDate = el.value || null;
      s.error = '';
      repaintSheet();
      break;
    case 'rec-day':
      s.cycleDay = Number(el.value);
      repaintSheet();
      break;
    case 'acc-name':
      s.name = el.value;
      break;
    case 'acc-opening':
      s.opening = digits(el.value);
      el.value = s.opening;
      break;
    case 'budget-input':
      s.limit = digits(el.value);
      el.value = s.limit;
      scheduleRepaint();
      break;
    default:
      break;
  }
});

/* 텍스트 입력 중에는 포커스를 잃지 않도록 다시 그리기를 미룹니다 */
let repaintTimer = null;
function scheduleRepaint() {
  clearTimeout(repaintTimer);
  repaintTimer = setTimeout(() => {
    const active = document.activeElement;
    const act = active && active.dataset ? active.dataset.act : null;
    const pos = active && active.selectionStart;
    repaintSheet();
    if (act) {
      const next = document.querySelector(`[data-act="${act}"]`);
      if (next) {
        next.focus();
        try {
          next.setSelectionRange(pos, pos);
        } catch (err) {
          /* date/select 등은 무시 */
        }
      }
    }
  }, 260);
}

/* 파일 가져오기 */
document.addEventListener('change', (e) => {
  if (e.target.id !== 'import-file') return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const res = S.importJSON(String(reader.result));
    toast(res.ok ? `${res.count}건을 가져왔습니다` : res.reason);
    render();
  };
  reader.readAsText(file);
  e.target.value = '';
});

function exportData() {
  const json = S.exportJSON();
  const name = `moneybook-${D.today()}.json`;
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('백업 파일을 저장했습니다');
  } catch (err) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(
        () => toast('클립보드에 백업 내용을 복사했습니다'),
        () => toast('내보내기에 실패했습니다')
      );
    } else {
      toast('내보내기에 실패했습니다');
    }
  }
}

/* ---------------- 시작 ---------------- */

window.addEventListener('hashchange', render);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((S.meta().theme || 'system') === 'system') {
    applyTheme();
    render();
  }
});

document.addEventListener('gesturestart', (e) => e.preventDefault());

S.subscribe(() => {
  /* 저장이 끝나면 현재 화면만 다시 그립니다 (시트는 자체적으로 갱신) */
});

export function boot() {
  S.load();
  applyTheme();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js', { scope: './' })
        .catch((err) => console.warn('[PWA] 서비스 워커 등록 실패', err));
    });
  }

  // 매니페스트 바로가기로 열렸을 때
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  if (action === 'new-expense') go('/entry?type=expense', true);
  else if (action === 'new-income') go('/entry?type=income', true);
  else if (action === 'recurring') go('/recurring', true);
}

boot();
