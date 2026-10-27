let rateWindowHitsOld = [];

function checkRateLimitOld(now, maxPerMin = 30) {
  while (rateWindowHitsOld.length > 0 && now - rateWindowHitsOld[0] > 60000) {
    rateWindowHitsOld.shift();
  }

  if (rateWindowHitsOld.length >= maxPerMin) return false;
  rateWindowHitsOld.push(now);
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
    // We need to simulate random traffic patterns where we burst and wait to see garbage collection or array resizing costs
    let t = 100000;
    const iters = 5000000;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
        if (i % 35 === 0) {
           t += 61000; // wait out the window
        } else {
           t += 100; // fast hits
        }
        fn(t, 30);
    }
    const end = performance.now();
    console.log(`${name} time: ${(end - start).toFixed(2)} ms`);
}

rateWindowHitsOld = [];
runBench(checkRateLimitOld, "Old (.shift())");

rateWindowHitsO1 = [];
rateWindowIdx = 0;
runBench(checkRateLimitO1, "O1 (Circular Buffer)");
