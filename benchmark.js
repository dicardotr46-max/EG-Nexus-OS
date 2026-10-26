// Mocking the environment
global.fetchWithPhase4Timeout = async (url, opts, timeout) => {
  await new Promise(r => setTimeout(r, 10)); // simulated network latency
  return {
    status: 200,
    json: async () => ({ ok: true, result: {} })
  };
};

global.sanitizeTelegramBotToken = (token) => token;
global.normalizePhase4Digits = (id) => id;
global.splitStringByCodePoints = (str, len) => {
  // simulate splitting into 5 chunks
  return Array(5).fill("chunk");
};

// Paste the original function here, rename to original
async function originalSendTelegramTextSafe(botToken, chatId, fullText) {
  const cleanToken = sanitizeTelegramBotToken(botToken);
  if (!cleanToken) return { ok: false, description: 'Empty Bot Token', retryable: false };
  const rawIds = normalizePhase4Digits(String(chatId || ''))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (rawIds.length === 0) return { ok: false, description: 'Empty Chat ID', retryable: false };

  const text = String(fullText || '').trim();
  if (!text) return { ok: false, description: 'Empty message', retryable: false };

  const chunks = splitStringByCodePoints(text, 3800);
  let lastResult = { ok: true };

  for (const targetChatId of rawIds) {
    for (const part of chunks) {
      const sendOnce = async () => {
        const res = await fetchWithPhase4Timeout(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: part
          })
        }, 9500);
        const parsed = await res.json().catch(() => ({ ok: false, description: 'Invalid JSON response' }));
        parsed._httpStatus = res.status;
        return parsed;
      };

      lastResult = await sendOnce();
      if (!lastResult.ok && (lastResult.error_code === 429 || lastResult._httpStatus === 429) && lastResult.parameters?.retry_after) {
        const waitSec = Math.min(Number(lastResult.parameters.retry_after) || 2, 8);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        lastResult = await sendOnce();
      }
      if (!lastResult.ok) {
        const code = Number(lastResult.error_code || lastResult._httpStatus || 0);
        lastResult.retryable = (code === 429 || code >= 500 || code === 0);
        return lastResult;
      }
    }
  }
  return lastResult;
}

// Optimization candidate: Concurrent over both
async function optimized1(botToken, chatId, fullText) {
  const cleanToken = sanitizeTelegramBotToken(botToken);
  if (!cleanToken) return { ok: false, description: 'Empty Bot Token', retryable: false };
  const rawIds = normalizePhase4Digits(String(chatId || ''))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (rawIds.length === 0) return { ok: false, description: 'Empty Chat ID', retryable: false };

  const text = String(fullText || '').trim();
  if (!text) return { ok: false, description: 'Empty message', retryable: false };

  const chunks = splitStringByCodePoints(text, 3800);

  const promises = [];
  for (const targetChatId of rawIds) {
    for (const part of chunks) {
      const sendWithRetry = async () => {
        const sendOnce = async () => {
          const res = await fetchWithPhase4Timeout(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: targetChatId, text: part })
          }, 9500);
          const parsed = await res.json().catch(() => ({ ok: false, description: 'Invalid JSON response' }));
          parsed._httpStatus = res.status;
          return parsed;
        };

        let res = await sendOnce();
        if (!res.ok && (res.error_code === 429 || res._httpStatus === 429) && res.parameters?.retry_after) {
          const waitSec = Math.min(Number(res.parameters.retry_after) || 2, 8);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          res = await sendOnce();
        }
        if (!res.ok) {
          const code = Number(res.error_code || res._httpStatus || 0);
          res.retryable = (code === 429 || code >= 500 || code === 0);
        }
        return res;
      };
      promises.push(sendWithRetry());
    }
  }

  const results = await Promise.all(promises);
  const failed = results.find(r => !r.ok);
  if (failed) return failed;
  return results[results.length - 1] || { ok: true };
}


async function runBenchmark() {
  const token = "dummyToken";
  const chatIds = "1,2,3,4,5"; // 5 chat ids
  const text = "dummy text"; // will be split into 5 chunks by mock

  // Total requests: 5 chats * 5 chunks = 25 requests.
  // Each takes 10ms.
  // Original should take ~250ms
  // Optimized should take ~10ms

  const startOriginal = Date.now();
  await originalSendTelegramTextSafe(token, chatIds, text);
  const endOriginal = Date.now();
  console.log(`Original: ${endOriginal - startOriginal}ms`);

  const startOpt = Date.now();
  await optimized1(token, chatIds, text);
  const endOpt = Date.now();
  console.log(`Optimized 1 (fully concurrent): ${endOpt - startOpt}ms`);
}

runBenchmark();
