/* =========================================================================
   머니북 · icons.js
   인라인 SVG 아이콘. 선 굵기 1.75 · 24 그리드 · 둥근 끝 · 면 채우기 없음.
   ========================================================================= */

const P = {
  back: '<polyline points="15 18 9 12 15 6"/>',
  forward: '<polyline points="9 18 15 12 9 6"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  swap: '<polyline points="7 4 3 8 7 12"/><path d="M3 8h13a4 4 0 0 1 0 8h-1"/><polyline points="17 20 21 16 17 12"/>',
  repeat: '<polyline points="21 4 21 9 16 9"/><path d="M20.5 13a8 8 0 1 1-2-6.5L21 9"/>',
  card: '<rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M2 10.5h20"/><path d="M6 15h3"/>',
  list:
    '<line x1="9" y1="7" x2="20" y2="7"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="17" x2="20" y2="17"/><circle cx="4.5" cy="7" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="17" r="1.3"/>',
  chart: '<line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="10"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  calStart:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/>',
  calEnd:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="3" x2="16" y2="7"/>',
  trash: '<polyline points="4 7 20 7"/><path d="M7 7v12h10V7"/><path d="M10 4h4"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><line x1="14" y1="6" x2="18" y2="10"/>',
  backspace:
    '<path d="M21 5H9l-6 7 6 7h12z"/><line x1="18" y1="9" x2="13" y2="15"/><line x1="13" y1="9" x2="18" y2="15"/>',
  memo: '<path d="M4 5h16v11H9l-5 4z"/>',
  download: '<path d="M12 4v11"/><polyline points="8 11 12 15 16 11"/><path d="M5 17v3h14v-3"/>',
  upload: '<path d="M12 15V4"/><polyline points="8 8 12 4 16 8"/><path d="M5 15v4h14v-4"/>',
  receipt:
    '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><line x1="8.5" y1="8" x2="15.5" y2="8"/><line x1="8.5" y1="12" x2="13" y2="12"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9h14v-9"/><line x1="3" y1="19" x2="21" y2="19"/>',
  cash: '<rect x="2" y="7" width="20" height="11" rx="2.5"/><circle cx="12" cy="12.5" r="2.5"/>',
  invest: '<path d="M4 18l5-6 4 3 7-8"/><polyline points="16 7 20 7 20 11"/>',
  won: '<path d="M5 6l3.5 12L12 9.5 15.5 18 19 6"/><line x1="3.5" y1="10.5" x2="20.5" y2="10.5"/><line x1="3.5" y1="13.5" x2="20.5" y2="13.5"/>',
  calc:
    '<rect x="4" y="2.5" width="16" height="19" rx="3"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11.5" x2="9" y2="11.5"/><line x1="12" y1="11.5" x2="13" y2="11.5"/><line x1="16" y1="11.5" x2="16" y2="11.5"/><line x1="8" y1="16" x2="9" y2="16"/><line x1="12" y1="16" x2="13" y2="16"/>',

  /* 카테고리 */
  food:
    '<path d="M6 3v8a3 3 0 0 0 6 0V3"/><line x1="9" y1="11" x2="9" y2="21"/><path d="M17 3c-1.5 2-2 4-2 6s.6 3 2 3 2-1 2-3-.5-4-2-6z"/><line x1="17" y1="12" x2="17" y2="21"/>',
  cafe: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/>',
  bus:
    '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/><path d="M8 17l-2 4"/><path d="M16 17l2 4"/>',
  home: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  bag: '<path d="M5 7h14l-1.2 12H6.2z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>',
  health:
    '<rect x="3" y="6" width="18" height="13" rx="3"/><line x1="12" y1="9.5" x2="12" y2="15.5"/><line x1="9" y1="12.5" x2="15" y2="12.5"/>',
  play: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M8 6V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V6"/><line x1="3" y1="12" x2="21" y2="12"/>',
  gift: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M12 8c-2-3-5-4-6.5-2.5S6 9 12 8s6.5-1 5.5-2.5S14 5 12 8z"/>',
  trend: '<path d="M4 18l5-6 4 3 7-8"/><polyline points="16 7 20 7 20 11"/>',
  coin:
    '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.6-.9-1.6-1.3-2.7-1.3-1.6 0-2.6.8-2.6 1.9 0 2.7 5.5 1.4 5.5 4.1 0 1.2-1.1 2-2.8 2-1.2 0-2.3-.5-2.9-1.4"/>',
  refund: '<polyline points="9 14 4 14 4 9"/><path d="M4 14a8 8 0 1 0 2.5-6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M11 10l4 2-4 2z"/>',
  pulse: '<path d="M3 12h3l2-5 4 10 3-7 2 2h4"/>'
};

/** 인라인 SVG 문자열을 만듭니다. */
export function icon(name, size = 20, stroke = 1.75) {
  const d = P[name] || P.dots;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

export const ACCOUNT_ICON = { bank: 'bank', cash: 'cash', invest: 'invest', card: 'card' };
export const ACCOUNT_KIND_LABEL = { bank: '입출금', cash: '현금', invest: '투자', card: '카드' };
