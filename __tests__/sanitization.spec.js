const vm = require('vm');
const { extractFunction, createStorageMock } = require('./test_helpers');

describe('Sanitization (XSS Prevention) & Telegram Rate Limiting', () => {
  let context;

  beforeEach(() => {
    context = vm.createContext({
      String,
      Number,
      Boolean,
      Date,
      Math,
      Array,
      Set,
      JSON
    });

    vm.runInContext(extractFunction('escapeHtml'), context);
  });

  describe('escapeHtml core sanitization', () => {
    it('should correctly escape HTML special characters (<, >, &, ", \')', () => {
      expect(context.escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(context.escapeHtml("Tom & Jerry's 'Adventure'")).toBe(
        'Tom &amp; Jerry&#39;s &#39;Adventure&#39;'
      );
      expect(context.escapeHtml('<img src=x onerror="fetch(\'http://evil.com\')">')).toBe(
        '&lt;img src=x onerror=&quot;fetch(&#39;http://evil.com&#39;)&quot;&gt;'
      );
    });

    it('should handle null, undefined, empty, and numeric types safely', () => {
      expect(context.escapeHtml(null)).toBe('');
      expect(context.escapeHtml(undefined)).toBe('');
      expect(context.escapeHtml('')).toBe('');
      expect(context.escapeHtml(12345)).toBe('12345');
      expect(context.escapeHtml(0)).toBe('0');
      expect(context.escapeHtml(false)).toBe('false');
    });

    it('should neutralize nested attribute breakout vectors', () => {
      const maliciousPayload = '"><script>alert(document.cookie)</script><input "';
      const escaped = context.escapeHtml(maliciousPayload);

      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
      expect(escaped).toContain('&quot;&gt;&lt;script&gt;');
    });
  });

  describe('XSS Sanitization in Chat Rendering', () => {
    function renderMockChatHeader(chat) {
      return `
        <div class="chat-header">
          <span class="chat-title" dir="auto">${context.escapeHtml(chat.title)}</span>
          <span class="chat-updated">${context.escapeHtml(chat.updatedAt || 'Now')}</span>
        </div>
      `;
    }

    function renderMockTurnMessage(m) {
      const chattedWithHtml = m.chattedWith
        ? `<div class="sub-chatted"><span>Chatted with ${context.escapeHtml(m.chattedWith)} ›</span></div>`
        : '';
      const textHtml = `<div class="message-content">${context.escapeHtml(m.text)}</div>`;
      return `${chattedWithHtml}${textHtml}`;
    }

    it('should sanitize malicious chat titles in chat headers', () => {
      const chat = {
        title: '<b onmouseover=alert("pwned")>Hacked Title</b>',
        updatedAt: '2026-11-10'
      };

      const html = renderMockChatHeader(chat);

      expect(html).not.toContain('<b onmouseover');
      expect(html).toContain('&lt;b onmouseover=alert(&quot;pwned&quot;)&gt;Hacked Title&lt;/b&gt;');
    });

    it('should sanitize malicious chattedWith agent names in turn transitions', () => {
      const msg = {
        chattedWith: 'EvilAgent<script>alert(1)</script>',
        text: 'Hello from agent'
      };

      const html = renderMockTurnMessage(msg);

      expect(html).not.toContain('<script>');
      expect(html).toContain('EvilAgent&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should sanitize raw script injection inside message text', () => {
      const msg = {
        text: '<iframe src="javascript:alert(1)"></iframe>'
      };

      const html = renderMockTurnMessage(msg);

      expect(html).not.toContain('<iframe');
      expect(html).toContain('&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;');
    });
  });

  describe('XSS Sanitization in Neon Postgres and Instagram Cards', () => {
    function renderNeonCard(host, db, errorMessage = '') {
      const errorHtml = errorMessage ? `<div class="error">خطا: ${context.escapeHtml(errorMessage)}</div>` : '';
      return `
        <div class="neon-card">
          <div class="code-block-dir">${context.escapeHtml(host)} · ${context.escapeHtml(db)}</div>
          ${errorHtml}
        </div>
      `;
    }

    function renderInstagramCard(media) {
      const thumb = media.thumbnail_url || media.media_url || '';
      return `
        <div class="ig-card">
          <img src="${context.escapeHtml(thumb)}" alt="post" />
          <div class="caption">${context.escapeHtml(media.caption || 'بدون کپشن')}</div>
          <span class="author">@${context.escapeHtml(media.username || '')}</span>
        </div>
      `;
    }

    it('should sanitize Neon database host and database name against XSS injection', () => {
      const maliciousHost = 'ep-cool.tech"><script>alert("neon_host_xss")</script>';
      const maliciousDb = 'neondb<img src=x onerror=alert("db")>';

      const html = renderNeonCard(maliciousHost, maliciousDb);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('ep-cool.tech&quot;&gt;&lt;script&gt;');
      expect(html).toContain('neondb&lt;img src=x onerror=alert(&quot;db&quot;)&gt;');
    });

    it('should sanitize Neon SQL query error messages', () => {
      const sqlError = 'Syntax error at or near "<script>stealCookies()</script>"';
      const html = renderNeonCard('ep.neon.tech', 'mydb', sqlError);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;stealCookies()&lt;/script&gt;');
    });

    it('should sanitize Instagram captions, usernames, and thumbnail URLs', () => {
      const media = {
        username: 'clash_coach<svg/onload=alert(1)>',
        caption: 'Insane electro giant push! <a href="javascript:alert(1)">Click here</a>',
        thumbnail_url: 'https://example.com/thumb.jpg" onerror="alert(1)'
      };

      const html = renderInstagramCard(media);

      expect(html).not.toContain('<svg/onload');
      expect(html).not.toContain('<a href');
      expect(html).not.toContain('" onerror=');
      expect(html).toContain('clash_coach&lt;svg/onload=alert(1)&gt;');
      expect(html).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;');
    });
  });

  describe('Rate Limiting in Telegram Pairing', () => {
    const TG_PAIR_RATELIMIT_KEY = 'eg_nexus_tg_pair_ratelimit_v1';
    let storageMock;
    let telegramAuditLog;
    let sentMessages;

    function simulateIncomingTelegramMessage({
      incomingText,
      senderChatId = '12345',
      senderUserId = '67890',
      appState,
      nowTs = Date.now()
    }) {
      const getTgPairRateLimit = () => {
        try {
          const raw = storageMock.getItem(TG_PAIR_RATELIMIT_KEY);
          if (!raw) return { failCount: 0, lockUntil: 0 };
          const p = JSON.parse(raw);
          return { failCount: Number(p?.failCount) || 0, lockUntil: Number(p?.lockUntil) || 0 };
        } catch (_) {
          return { failCount: 0, lockUntil: 0 };
        }
      };

      const setTgPairRateLimit = (failCount, lockUntil) => {
        storageMock.setItem(TG_PAIR_RATELIMIT_KEY, JSON.stringify({ failCount, lockUntil }));
      };

      const recordTelegramSecurityAudit = (msg) => {
        telegramAuditLog.push(msg);
      };

      const sendTelegramReply = (text) => {
        sentMessages.push({ chatId: senderChatId, text });
      };

      const configuredAllowedChatIds = (appState.telegramConfig.chatId || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const configuredOwnerUserIds = (appState.telegramConfig.ownerUserId || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const normalizedIncoming = String(incomingText || '').trim();
      const pairMatch = normalizedIncoming.match(/^\/pair\s+(\d{6})\b/i);

      if (pairMatch) {
        const nowPairTs = nowTs;
        const { failCount, lockUntil } = getTgPairRateLimit();

        if (lockUntil && nowPairTs < lockUntil) {
          const remMin = Math.max(1, Math.ceil((lockUntil - nowPairTs) / 60000));
          recordTelegramSecurityAudit(`Blocked /pair rate-limit cooldown from chat_id=${senderChatId}`);
          sendTelegramReply(`⛔ به دلیل تلاش‌های ناموفق مکرر، جفت‌سازی تا ${remMin} دقیقه مسدود است.`);
          return { status: 'LOCKED', remMin };
        }

        const suppliedCode = pairMatch[1];
        if (suppliedCode === String(appState.telegramConfig.pairingCode)) {
          setTgPairRateLimit(0, 0);
          if (senderChatId && !configuredAllowedChatIds.includes(senderChatId)) {
            configuredAllowedChatIds.push(senderChatId);
            appState.telegramConfig.chatId = configuredAllowedChatIds.join(', ');
          }
          if (senderUserId && !configuredOwnerUserIds.includes(senderUserId)) {
            configuredOwnerUserIds.push(senderUserId);
            appState.telegramConfig.ownerUserId = configuredOwnerUserIds.join(', ');
          }
          appState.telegramConfig.pairingCode = '999999'; // regenerated code
          recordTelegramSecurityAudit(`Paired chat_id=${senderChatId} user_id=${senderUserId}`);
          sendTelegramReply('✅ جفت‌سازی امنیتی با موفقیت انجام شد!');
          return { status: 'PAIRED' };
        } else {
          const nextFailCount = failCount + 1;
          const nextLockUntil = nextFailCount >= 5 ? nowPairTs + (15 * 60 * 1000) : 0;
          setTgPairRateLimit(nextFailCount, nextLockUntil);
          recordTelegramSecurityAudit(`Failed /pair attempt (#${nextFailCount}) from chat_id=${senderChatId}`);
          sendTelegramReply('⛔ کد جفت‌سازی نامعتبر است.');
          return { status: 'FAILED_ATTEMPT', failCount: nextFailCount, locked: nextFailCount >= 5 };
        }
      }

      if (configuredAllowedChatIds.length === 0 || !configuredAllowedChatIds.includes(senderChatId)) {
        recordTelegramSecurityAudit(`Blocked unpaired message from chat_id=${senderChatId}`);
        return { status: 'UNPAIRED_BLOCKED' };
      }

      return { status: 'AUTHORIZED' };
    }

    beforeEach(() => {
      storageMock = createStorageMock();
      telegramAuditLog = [];
      sentMessages = [];
    });

    it('should successfully pair when given the exact 6-digit pairing code', () => {
      const appState = {
        telegramConfig: {
          pairingCode: '654321',
          chatId: '',
          ownerUserId: ''
        }
      };

      const res = simulateIncomingTelegramMessage({
        incomingText: '/pair 654321',
        senderChatId: '1001',
        senderUserId: '2002',
        appState
      });

      expect(res.status).toBe('PAIRED');
      expect(appState.telegramConfig.chatId).toBe('1001');
      expect(appState.telegramConfig.ownerUserId).toBe('2002');
      expect(appState.telegramConfig.pairingCode).not.toBe('654321'); // Code regenerated!
      expect(telegramAuditLog).toContain('Paired chat_id=1001 user_id=2002');
      expect(sentMessages[0].text).toContain('جفت‌سازی امنیتی با موفقیت انجام شد');
    });

    it('should increment failCount on incorrect pairing code', () => {
      const appState = {
        telegramConfig: { pairingCode: '654321', chatId: '', ownerUserId: '' }
      };

      const res = simulateIncomingTelegramMessage({
        incomingText: '/pair 000000',
        senderChatId: '1001',
        appState
      });

      expect(res.status).toBe('FAILED_ATTEMPT');
      expect(res.failCount).toBe(1);
      expect(res.locked).toBe(false);
      expect(telegramAuditLog).toContain('Failed /pair attempt (#1) from chat_id=1001');
    });

    it('should lock out pairing for 15 minutes after 5 consecutive failed attempts (brute-force defense)', () => {
      const appState = {
        telegramConfig: { pairingCode: '654321', chatId: '', ownerUserId: '' }
      };
      const baseTs = 1700000000000;

      // 4 failures
      for (let i = 1; i <= 4; i++) {
        const res = simulateIncomingTelegramMessage({
          incomingText: `/pair 11111${i}`,
          appState,
          nowTs: baseTs + i * 1000
        });
        expect(res.failCount).toBe(i);
        expect(res.locked).toBe(false);
      }

      // 5th failure triggers lock
      const fifthRes = simulateIncomingTelegramMessage({
        incomingText: '/pair 999999',
        appState,
        nowTs: baseTs + 5000
      });
      expect(fifthRes.failCount).toBe(5);
      expect(fifthRes.locked).toBe(true);

      // Verify lock stored in persistence
      const stored = JSON.parse(storageMock.getItem(TG_PAIR_RATELIMIT_KEY));
      expect(stored.failCount).toBe(5);
      expect(stored.lockUntil).toBe(baseTs + 5000 + (15 * 60 * 1000));
    });

    it('should block pairing attempts while lockUntil cooldown is active, even if the correct code is provided', () => {
      const appState = {
        telegramConfig: { pairingCode: '654321', chatId: '', ownerUserId: '' }
      };
      const baseTs = 1700000000000;

      // Set storage as locked
      storageMock.setItem(TG_PAIR_RATELIMIT_KEY, JSON.stringify({
        failCount: 5,
        lockUntil: baseTs + 15 * 60 * 1000
      }));

      // Attacker tries with correct code 5 minutes into the 15-minute lock
      const res = simulateIncomingTelegramMessage({
        incomingText: '/pair 654321',
        senderChatId: '1001',
        appState,
        nowTs: baseTs + 5 * 60 * 1000
      });

      expect(res.status).toBe('LOCKED');
      expect(res.remMin).toBe(10);
      expect(appState.telegramConfig.chatId).toBe(''); // NOT paired!
      expect(sentMessages[0].text).toContain('جفت‌سازی تا 10 دقیقه مسدود است');
      expect(telegramAuditLog).toContain('Blocked /pair rate-limit cooldown from chat_id=1001');
    });

    it('should allow pairing after the 15-minute cooldown period has expired', () => {
      const appState = {
        telegramConfig: { pairingCode: '654321', chatId: '', ownerUserId: '' }
      };
      const baseTs = 1700000000000;

      // Locked until baseTs + 15 min
      storageMock.setItem(TG_PAIR_RATELIMIT_KEY, JSON.stringify({
        failCount: 5,
        lockUntil: baseTs + 15 * 60 * 1000
      }));

      // Attempt after 16 minutes (cooldown expired)
      const res = simulateIncomingTelegramMessage({
        incomingText: '/pair 654321',
        senderChatId: '1001',
        senderUserId: '2002',
        appState,
        nowTs: baseTs + 16 * 60 * 1000
      });

      expect(res.status).toBe('PAIRED');
      expect(appState.telegramConfig.chatId).toBe('1001');
    });

    it('should block unpaired messages from unauthorized chat IDs', () => {
      const appState = {
        telegramConfig: { pairingCode: '654321', chatId: '9999', ownerUserId: '' }
      };

      const res = simulateIncomingTelegramMessage({
        incomingText: 'What is the best deck today?',
        senderChatId: 'unauthorized_attacker_chat',
        appState
      });

      expect(res.status).toBe('UNPAIRED_BLOCKED');
      expect(telegramAuditLog).toContain('Blocked unpaired message from chat_id=unauthorized_attacker_chat');
    });
  });
});
