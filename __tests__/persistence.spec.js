const vm = require('vm');
const {
  extractFunction,
  API_KEY_NAMES,
  emptyApiKeys,
  createStorageMock
} = require('./test_helpers');

describe('Persistence and State Storage', () => {
  let context;

  beforeEach(() => {
    const buildPersistedStateCode = extractFunction('buildPersistedState');
    context = vm.createContext({
      API_KEY_NAMES,
      emptyApiKeys,
      JSON,
      Array,
      Object
    });
    vm.runInContext(buildPersistedStateCode, context);
  });

  describe('buildPersistedState - 100% sensitive keys stripped', () => {
    it('should strip all provider API keys to empty strings', () => {
      const fullState = {
        apiKeys: {
          openai: 'sk-proj-supersecret123',
          anthropic: 'sk-ant-admin999',
          google: 'AIzaSySecretGoogleKey',
          groq: 'gsk_testGroqKey',
          deepseek: 'sk-deepseek-444',
          mistral: 'mistral-api-key',
          openrouter: 'sk-or-v1-999',
          perplexica: 'perp-key',
          cohere: 'cohere-test-key'
        },
        profileName: 'Ali'
      };

      const persisted = context.buildPersistedState(fullState);

      API_KEY_NAMES.forEach(key => {
        expect(persisted.apiKeys[key]).toBe('');
      });
      expect(persisted.profileName).toBe('Ali');
    });

    it('should strip connection tokens from all appConnections', () => {
      const fullState = {
        appConnections: {
          telegram: { token: 'bot123456:ABC-DEF-secret', connectedAt: '2026-01-01' },
          github: { token: 'ghp_secretGithubPersonalAccessToken', connectedAt: '2026-01-02' },
          neon: { token: 'neon_npt_secret_token_12345', endpoint: 'ep-cool.neon.tech' }
        }
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.appConnections.telegram.token).toBe('');
      expect(persisted.appConnections.github.token).toBe('');
      expect(persisted.appConnections.neon.token).toBe('');
      expect(persisted.appConnections.neon.endpoint).toBe('ep-cool.neon.tech');
    });

    it('should strip individual account tokens and refreshTokens in multi-account connections', () => {
      const fullState = {
        appConnections: {
          gmail: {
            token: '',
            accounts: [
              { id: 'acc_1', email: 'first@example.com', token: 'ya29.secret1', refreshToken: '1//refreshSecret1' },
              { id: 'acc_2', email: 'second@example.com', token: 'ya29.secret2', refreshToken: '1//refreshSecret2' }
            ]
          }
        }
      };

      const persisted = context.buildPersistedState(fullState);

      const accounts = persisted.appConnections.gmail.accounts;
      expect(accounts[0].token).toBe('');
      expect(accounts[0].refreshToken).toBe('');
      expect(accounts[0].email).toBe('first@example.com');
      expect(accounts[1].token).toBe('');
      expect(accounts[1].refreshToken).toBe('');
      expect(accounts[1].email).toBe('second@example.com');
    });

    it('should strip localComputerConfig bridgeToken', () => {
      const fullState = {
        localComputerConfig: {
          bridgeUrl: 'http://127.0.0.1:8765',
          bridgeToken: 'ultra-secret-termux-bridge-token-xyz',
          allowedFolders: '/sdcard/Download'
        }
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.localComputerConfig.bridgeToken).toBe('');
      expect(persisted.localComputerConfig.bridgeUrl).toBe('http://127.0.0.1:8765');
      expect(persisted.localComputerConfig.allowedFolders).toBe('/sdcard/Download');
    });

    it('should strip cloudConfig workerSecret, supabaseKey, and supabaseAuthToken', () => {
      const fullState = {
        cloudConfig: {
          workerUrl: 'https://my-worker.workers.dev',
          workerSecret: 'cf-secret-token-abc',
          supabaseUrl: 'https://xyz.supabase.co',
          supabaseKey: 'supabase-anon-or-service-role-key',
          supabaseAuthToken: 'bearer-jwt-token-777',
          workspaceId: 'ws_demo_1'
        }
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.cloudConfig.workerSecret).toBe('');
      expect(persisted.cloudConfig.supabaseKey).toBe('');
      expect(persisted.cloudConfig.supabaseAuthToken).toBe('');
      expect(persisted.cloudConfig.workerUrl).toBe('https://my-worker.workers.dev');
      expect(persisted.cloudConfig.workspaceId).toBe('ws_demo_1');
    });

    it('should strip telegramConfig botToken', () => {
      const fullState = {
        telegramConfig: {
          botToken: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ',
          chatId: '987654321',
          ownerUserId: '11223344',
          pairingCode: '654321'
        }
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.telegramConfig.botToken).toBe('');
      expect(persisted.telegramConfig.chatId).toBe('987654321');
      expect(persisted.telegramConfig.pairingCode).toBe('654321');
    });

    it('should enforce MAX_PERSISTED_MSGS_PER_CHAT (300 messages cap) per chat', () => {
      const fullState = {
        chats: [
          {
            id: 'chat_huge',
            title: 'Large conversation',
            messages: Array.from({ length: 450 }, (_, i) => ({
              id: `msg_${i}`,
              text: `Message index ${i}`,
              role: i % 2 === 0 ? 'user' : 'assistant'
            }))
          },
          {
            id: 'chat_normal',
            title: 'Normal conversation',
            messages: Array.from({ length: 50 }, (_, i) => ({
              id: `msg_norm_${i}`,
              text: `Normal message ${i}`
            }))
          }
        ]
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.chats[0].messages.length).toBe(300);
      expect(persisted.chats[0].messages[0].text).toBe('Message index 150');
      expect(persisted.chats[0].messages[299].text).toBe('Message index 449');
      expect(persisted.chats[1].messages.length).toBe(50);
    });

    it('should preserve non-sensitive agent metadata and user configuration intact', () => {
      const fullState = {
        agents: [
          {
            id: 'agent_clash',
            name: 'Clash Royale Meta Strategist',
            systemPrompt: 'You are an expert clash royale coach.',
            model: 'gemini-1.5-pro',
            temperature: 0.7,
            avatar: { color: '#3b82f6', shape: 'rounded', face: 'smile' }
          }
        ],
        effortMode: 'high',
        diffOnlyMode: true,
        dreamMemory: 'Persisted long-term insights'
      };

      const persisted = context.buildPersistedState(fullState);

      expect(persisted.agents).toHaveLength(1);
      expect(persisted.agents[0].name).toBe('Clash Royale Meta Strategist');
      expect(persisted.agents[0].systemPrompt).toBe('You are an expert clash royale coach.');
      expect(persisted.effortMode).toBe('high');
      expect(persisted.diffOnlyMode).toBe(true);
      expect(persisted.dreamMemory).toBe('Persisted long-term insights');
    });

    it('should handle empty, null, or malformed state inputs gracefully', () => {
      expect(() => context.buildPersistedState({})).not.toThrow();
      expect(() => context.buildPersistedState({ appConnections: null, cloudConfig: null })).not.toThrow();
      expect(() => context.buildPersistedState({ chats: 'invalid' })).not.toThrow();
    });
  });

  describe('Quota Exceeded handling and smart eviction', () => {
    function executeStorageSaveWithQuotaRecovery(appState, storageMock, quotaThresholdBytes = 1000) {
      const STORAGE_KEY = 'eg_nexus_state_v5';
      let savedOk = false;
      let toastMessage = '';
      const showToast = msg => { toastMessage = msg; };

      const nexusStorageSet = (key, val) => {
        if (typeof val === 'string' && val.length > quotaThresholdBytes) {
          const err = new Error('Quota exceeded');
          err.name = 'QuotaExceededError';
          err.code = 22;
          throw err;
        }
        storageMock.setItem(key, val);
        return true;
      };

      try {
        const setOk = nexusStorageSet(STORAGE_KEY, JSON.stringify(context.buildPersistedState(appState)));
        if (!setOk) throw new Error('nexusStorageSet returned false');
        savedOk = true;
      } catch (e) {
        const isQuota = Boolean(e && (
          e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22 ||
          e.code === 1014 ||
          /quota/i.test(String(e.message || e))
        ));

        if (isQuota) {
          try {
            const candidate = context.buildPersistedState(appState);
            // Retry 1: evict attachments except the last 4 messages
            (candidate.chats || []).forEach(c => {
              (c?.messages || []).slice(0, -4).forEach(m => { if (m) m.attachmentImage = ''; });
            });

            let retrySaved = false;
            try {
              retrySaved = nexusStorageSet(STORAGE_KEY, JSON.stringify(candidate));
              if (!retrySaved) throw new Error('retry 1 returned false');
            } catch (retryError) {
              const retryIsQuota = retryError && (
                retryError.name === 'QuotaExceededError' ||
                retryError.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                retryError.code === 22 ||
                retryError.code === 1014 ||
                String(retryError.message).includes('retry 1 returned false')
              );
              if (!retryIsQuota) throw retryError;
              // Retry 2: evict all attachments
              (candidate.chats || []).forEach(c => {
                (c?.messages || []).forEach(m => { if (m) m.attachmentImage = ''; });
              });
              retrySaved = nexusStorageSet(STORAGE_KEY, JSON.stringify(candidate));
            }
            if (retrySaved) {
              savedOk = true;
              showToast('ظرفیت ذخیره پر بود؛ نسخه دیسکی تصاویر سبک شد');
            }
          } catch (retryError) {}
        }
      }

      return { savedOk, toastMessage, storedState: storageMock.getItem(STORAGE_KEY) };
    }

    it('should save cleanly when storage is well within quota', () => {
      const storageMock = createStorageMock();
      const appState = {
        chats: [
          {
            id: 'c1',
            messages: [{ id: 'm1', text: 'Hello', attachmentImage: 'data:image/png;base64,small' }]
          }
        ]
      };

      const result = executeStorageSaveWithQuotaRecovery(appState, storageMock, 5000);

      expect(result.savedOk).toBe(true);
      expect(storageMock.setItem).toHaveBeenCalledTimes(1);
    });

    it('should evict older attachments (preserving last 4) in Stage 1 recovery', () => {
      const storageMock = createStorageMock();
      // 8 messages with heavy attachments
      const heavyAttachment = 'data:image/png;base64,' + 'A'.repeat(300);
      const appState = {
        chats: [
          {
            id: 'c1',
            messages: Array.from({ length: 8 }, (_, i) => ({
              id: `m_${i}`,
              text: `Message ${i}`,
              attachmentImage: heavyAttachment
            }))
          }
        ]
      };

      // Set threshold such that 8 heavy attachments fail (>3100 bytes), but 4 attachments pass (~1880 bytes)
      const result = executeStorageSaveWithQuotaRecovery(appState, storageMock, 2500);

      expect(result.savedOk).toBe(true);
      expect(result.toastMessage).toContain('ظرفیت ذخیره پر بود');

      const saved = JSON.parse(result.storedState);
      const msgs = saved.chats[0].messages;

      // First 4 messages should have their attachment cleared
      for (let i = 0; i < 4; i++) {
        expect(msgs[i].attachmentImage).toBe('');
        expect(msgs[i].text).toBe(`Message ${i}`); // Text preserved!
      }
      // Last 4 messages should retain their attachment
      for (let i = 4; i < 8; i++) {
        expect(msgs[i].attachmentImage).toBe(heavyAttachment);
        expect(msgs[i].text).toBe(`Message ${i}`); // Text preserved!
      }
    });

    it('should evict all attachments in Stage 2 recovery if Stage 1 still exceeds quota', () => {
      const storageMock = createStorageMock();
      const ultraHeavyAttachment = 'data:image/png;base64,' + 'B'.repeat(500);
      const appState = {
        chats: [
          {
            id: 'c1',
            messages: Array.from({ length: 6 }, (_, i) => ({
              id: `m_${i}`,
              text: `Important message text ${i}`,
              attachmentImage: ultraHeavyAttachment
            }))
          }
        ]
      };

      // Set threshold such that even 4 attachments fail, but 0 attachments pass (~400 bytes)
      const result = executeStorageSaveWithQuotaRecovery(appState, storageMock, 800);

      expect(result.savedOk).toBe(true);
      const saved = JSON.parse(result.storedState);
      const msgs = saved.chats[0].messages;

      // All attachments evicted to fit quota
      msgs.forEach((m, idx) => {
        expect(m.attachmentImage).toBe('');
        // Text is 100% preserved
        expect(m.text).toBe(`Important message text ${idx}`);
      });
    });

    it('should never lose conversation text, roles, or message history during quota recovery', () => {
      const storageMock = createStorageMock();
      const appState = {
        chats: [
          {
            id: 'c1',
            title: 'Critical Architecture Planning',
            messages: [
              { id: 'm1', role: 'user', text: 'Step 1: Deploy KV cluster', attachmentImage: 'heavy_data' },
              { id: 'm2', role: 'assistant', text: 'Step 2: Initialize SQLite replica', attachmentImage: 'heavy_data' }
            ]
          }
        ]
      };

      // Set threshold so full attachments (size ~420) fail, but evicted Stage 2 (size ~377) succeeds
      const result = executeStorageSaveWithQuotaRecovery(appState, storageMock, 400);

      expect(result.savedOk).toBe(true);
      const saved = JSON.parse(result.storedState);
      expect(saved.chats[0].title).toBe('Critical Architecture Planning');
      expect(saved.chats[0].messages[0].text).toBe('Step 1: Deploy KV cluster');
      expect(saved.chats[0].messages[0].role).toBe('user');
      expect(saved.chats[0].messages[1].text).toBe('Step 2: Initialize SQLite replica');
      expect(saved.chats[0].messages[1].role).toBe('assistant');
    });

    it('should return savedOk: false when storage fails completely even without attachments', () => {
      const storageMock = createStorageMock();
      const appState = {
        chats: [{ id: 'c1', messages: [{ id: 'm1', text: 'Some text that exceeds hard storage limit' }] }]
      };

      // Quota threshold lower than base JSON size
      const result = executeStorageSaveWithQuotaRecovery(appState, storageMock, 20);

      expect(result.savedOk).toBe(false);
    });
  });
});
