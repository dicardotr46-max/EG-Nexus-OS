let rateWindowHitsCurrent = [];
let rateWindowHeadCurrent = 0;

function checkRateLimitCurrent(now, maxPerMin = 30) {
  while (rateWindowHitsCurrent.length > rateWindowHeadCurrent && now - rateWindowHitsCurrent[rateWindowHeadCurrent] > 60000) {
    rateWindowHeadCurrent++;
  }

  if (rateWindowHeadCurrent >= 64) {
    rateWindowHitsCurrent = rateWindowHitsCurrent.slice(rateWindowHeadCurrent);
    rateWindowHeadCurrent = 0;
  }

  if (rateWindowHitsCurrent.length - rateWindowHeadCurrent >= maxPerMin) return false;
  rateWindowHitsCurrent.push(now);
  return true;
}

let rateWindowHitsO1 = [];
let rateWindowIdx = 0;

function checkRateLimitO1(now, maxPerMin = 30) {
  if (rateWindowHitsO1.length < maxPerMin) {
    rateWindowHitsO1.push(now);
    return true;
  }

  if (now - rateWindowHitsO1[rateWindowIdx] <= 60000) {
    return false;
  }

  rateWindowHitsO1[rateWindowIdx] = now;
  rateWindowIdx = (rateWindowIdx + 1) % maxPerMin;
  return true;
}

// Performance benchmark
function runBench(fn, name) {
    let t = 100000;
    const iters = 5000000;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
        if (i % 35 === 0) {
           t += 61000;
        } else {
           t += 100;
        }
        fn(t, 30);
    }
    const end = performance.now();
    console.log(`${name} time: ${(end - start).toFixed(2)} ms`);
}

rateWindowHitsCurrent = [];
rateWindowHeadCurrent = 0;
runBench(checkRateLimitCurrent, "Current");

rateWindowHitsO1 = [];
rateWindowIdx = 0;
runBench(checkRateLimitO1, "O1 (Circular Buffer)");
