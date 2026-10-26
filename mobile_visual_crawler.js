/* Execute in the EG Nexus OS page context. It returns a JSON audit for the current 390x844 viewport. */
window.runEgnexusMobileCrawl = async function () {
  const results = [];
  const visible = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const rect = (el) => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
  const touchTargets = [...document.querySelectorAll('button,[role="button"],a,input,select,textarea')].filter(visible).map(el => ({text:(el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0,80), ...rect(el)})).filter(x => x.w < 40 || x.h < 40);
  const overlaps = [];
  const candidates = [...document.querySelectorAll('button,[role="button"],a,input,select,textarea')].filter(visible);

  const candCache = candidates.map((c, i) => {
    const r = rect(c);
    return {
      c, r, i,
      type: c.type,
      text: (c.innerText || c.id || '').trim().slice(0, 60)
    };
  });
  const sortedByX = [...candCache].sort((a, b) => a.r.x - b.r.x);
  const hits = [];

  for (let i = 0; i < sortedByX.length; i++) {
    const ci = sortedByX[i];
    if (ci.type === 'hidden') continue;
    const a = ci.r;

    for (let j = i + 1; j < sortedByX.length; j++) {
      const cj = sortedByX[j];
      const b = cj.r;

      if (b.x >= a.right) break;
      if (cj.type === 'hidden') continue;

      const hit = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      if (hit > 4) {
        if (ci.i < cj.i) {
          hits.push({ a: ci.text, b: cj.text, hit, idxA: ci.i, idxB: cj.i });
        } else {
          hits.push({ a: cj.text, b: ci.text, hit, idxA: cj.i, idxB: ci.i });
        }
      }
    }
  }

  hits.sort((h1, h2) => {
    if (h1.idxA !== h2.idxA) return h1.idxA - h2.idxA;
    return h1.idxB - h2.idxB;
  });

  for (const h of hits) {
    overlaps.push({ a: h.a, b: h.b, hit: h.hit });
  }
  results.push({state: document.location.hash || 'current', visibleViews:[...document.querySelectorAll('[id^="view-"]')].filter(visible).map(x=>x.id), modalVisible: [...document.querySelectorAll('[role="dialog"],#settingsSubModal,#nexusDialog')].some(visible), overlaps: overlaps.slice(0,30), undersizedTouchTargets: touchTargets.slice(0,30), bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth});
  return results;
};
