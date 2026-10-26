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

// Optimization candidate
async function optimizedSendTelegramTextSafe(botToken, chatId, fullText) {
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

  const chatPromises = rawIds.map(async (targetChatId) => {
    let currentLastResult = { ok: true };
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

      currentLastResult = await sendOnce();
      if (!currentLastResult.ok && (currentLastResult.error_code === 429 || currentLastResult._httpStatus === 429) && currentLastResult.parameters?.retry_after) {
        const waitSec = Math.min(Number(currentLastResult.parameters.retry_after) || 2, 8);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        currentLastResult = await sendOnce();
      }
      if (!currentLastResult.ok) {
        const code = Number(currentLastResult.error_code || currentLastResult._httpStatus || 0);
        currentLastResult.retryable = (code === 429 || code >= 500 || code === 0);
        return currentLastResult;
      }
    }
    return currentLastResult;
  });

  const results = await Promise.all(chatPromises);
  const failedResult = results.find(r => !r.ok);
  if (failedResult) {
    return failedResult;
  }
  return results.length > 0 ? results[results.length - 1] : lastResult;
}

async function runBenchmark() {
  const token = "dummyToken";
  const chatIds = "1,2,3,4,5"; // 5 chat ids
  const text = "dummy text"; // will be split into 5 chunks by mock

  // Total requests: 5 chats * 5 chunks = 25 requests.
  // Each takes 10ms.
  // Original should take ~250ms
  // Optimized should take ~50ms (concurrent chats, sequential chunks per chat)

  const startOriginal = Date.now();
  await originalSendTelegramTextSafe(token, chatIds, text);
  const endOriginal = Date.now();
  console.log(`Original: ${endOriginal - startOriginal}ms`);

  const startOpt = Date.now();
  await optimizedSendTelegramTextSafe(token, chatIds, text);
  const endOpt = Date.now();
  console.log(`Optimized (concurrent across chats, sequential chunks): ${endOpt - startOpt}ms`);
}

runBenchmark();
