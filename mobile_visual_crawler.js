/* Execute in the EG Nexus OS page context. It returns a JSON audit for the current 390x844 viewport. */
window.runEgnexusMobileCrawl = async function () {
  const results = [];
  const visible = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const rect = (el) => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
  const touchTargets = [...document.querySelectorAll('button,[role="button"],a,input,select,textarea')].filter(visible).map(el => ({text:(el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0,80), ...rect(el)})).filter(x => x.w < 40 || x.h < 40);
  const overlaps = [];
  const candidates = [...document.querySelectorAll('button,[role="button"],a,input,select,textarea')].filter(visible);
  for (let i=0;i<candidates.length;i++) for (let j=i+1;j<candidates.length;j++) {
    const a=rect(candidates[i]), b=rect(candidates[j]);
    const hit = Math.max(0, Math.min(a.right,b.right)-Math.max(a.x,b.x)) * Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
    if (hit > 4 && candidates[i].type !== 'hidden' && candidates[j].type !== 'hidden') overlaps.push({a:(candidates[i].innerText||candidates[i].id||'').trim().slice(0,60),b:(candidates[j].innerText||candidates[j].id||'').trim().slice(0,60),hit});
  }
  results.push({state: document.location.hash || 'current', visibleViews:[...document.querySelectorAll('[id^="view-"]')].filter(visible).map(x=>x.id), modalVisible: [...document.querySelectorAll('[role="dialog"],#settingsSubModal,#nexusDialog')].some(visible), overlaps: overlaps.slice(0,30), undersizedTouchTargets: touchTargets.slice(0,30), bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth});
  return results;
};
