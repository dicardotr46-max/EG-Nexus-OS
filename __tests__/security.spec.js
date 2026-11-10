const vm = require('vm');
const {
  extractFunction,
  API_KEY_NAMES,
  SESSION_SECRETS_KEY,
  SESSION_SECRETS_SCHEMA_VERSION,
  isSafeConnectionId,
  emptyApiKeys,
  createStorageMock
} = require('./test_helpers');

describe('Security & Secrets Management', () => {
  let context;
  let sessionStorageMock;

  beforeEach(() => {
    sessionStorageMock = createStorageMock();

    context = vm.createContext({
      API_KEY_NAMES,
      SESSION_SECRETS_KEY,
      SESSION_SECRETS_SCHEMA_VERSION,
      isSafeConnectionId,
      emptyApiKeys,
      sessionStorage: sessionStorageMock,
      appState: {},
      Date,
      JSON,
      Object,
      Array,
      String,
      Boolean,
      Uint8Array,
      TextEncoder,
      TextDecoder,
      Math,
      parseInt,
      _sessionCryptoKey: null,
      _sessionCryptoKeyPromise: null,
      _sessionKeyRaw: null,
      _cachedSessionSecrets: null
    });

    ['_initMemorySessionKey', '_uint8ToHex', '_hexToUint8', '_syncTransform', '_getOrCreateWebCryptoKey'].forEach(fnName => {
      const fnCode = extractFunction(fnName);
      if (fnCode) vm.runInContext(fnCode, context);
    });

    vm.runInContext(extractFunction('readSessionSecrets'), context);
    vm.runInContext(extractFunction('writeSessionSecrets'), context);
    vm.runInContext(extractFunction('applySessionSecrets'), context);
    vm.runInContext(extractFunction('getConnectionAccounts'), context);
    vm.runInContext(extractFunction('getAppConnectionToken'), context);
  });

  describe('writeSessionSecrets and readSessionSecrets lifecycle', () => {
    it('should return uninitialized default schema when sessionStorage is empty', () => {
      const secrets = context.readSessionSecrets();

      expect(secrets.version).toBe(SESSION_SECRETS_SCHEMA_VERSION);
      expect(secrets.initialized).toBe(false);
      expect(secrets.apiKeys).toEqual(emptyApiKeys());
      expect(secrets.connectionTokens).toEqual({});
      expect(secrets.accountTokens).toEqual({});
      expect(secrets.bridgeToken).toBe('');
    });

    it('should write and read back API keys cleanly, trimming whitespace', () => {
      const ok = context.writeSessionSecrets({
        apiKeys: {
          openai: '  sk-proj-test-openai-key  ',
          anthropic: 'sk-ant-test-anthropic-key',
          google: 'AIzaSyGoogleSecretKey'
        }
      });

      expect(ok).toBe(true);

      const secrets = context.readSessionSecrets();
      expect(secrets.initialized).toBe(true);
      expect(secrets.apiKeys.openai).toBe('sk-proj-test-openai-key');
      expect(secrets.apiKeys.anthropic).toBe('sk-ant-test-anthropic-key');
      expect(secrets.apiKeys.google).toBe('AIzaSyGoogleSecretKey');
      expect(secrets.apiKeys.groq).toBe('');
    });

    it('should write and read connection tokens and local bridgeToken', () => {
      context.writeSessionSecrets({
        apiKeys: {},
        connectionTokens: {
          telegram: 'bot123456:secretToken',
          github: 'ghp_accessToken'
        },
        bridgeToken: 'termux-bridge-token-xyz'
      });

      const secrets = context.readSessionSecrets();
      expect(secrets.connectionTokens.telegram).toBe('bot123456:secretToken');
      expect(secrets.connectionTokens.github).toBe('ghp_accessToken');
      expect(secrets.bridgeToken).toBe('termux-bridge-token-xyz');
    });

    it('should guard against prototype pollution and unsafe connection IDs', () => {
      context.writeSessionSecrets({
        apiKeys: {},
        connectionTokens: {
          'valid-service': 'token1',
          '__proto__': 'malicious_polluted_val',
          'constructor': 'malicious_polluted_val',
          'invalid;id<script>': 'malicious_val'
        }
      });

      const secrets = context.readSessionSecrets();
      expect(Object.keys(secrets.connectionTokens)).toEqual(['valid-service']);
      expect(secrets.connectionTokens['valid-service']).toBe('token1');
      expect(Object.prototype.hasOwnProperty.call(secrets.connectionTokens, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(secrets.connectionTokens, 'constructor')).toBe(false);
      expect(secrets.connectionTokens['invalid;id<script>']).toBeUndefined();
    });

    it('should handle legacy migration when full appState is passed', () => {
      const legacyState = {
        apiKeys: {
          openai: 'sk-legacy-key',
          groq: 'gsk_legacy_groq'
        },
        appConnections: {
          telegram: { token: 'bot999:migrated' },
          gmail: {
            accounts: [
              { id: 'user_1', token: 'ya29.migrated_user1' }
            ]
          }
        },
        localComputerConfig: {
          bridgeToken: 'legacy-bridge-secret'
        }
      };

      const ok = context.writeSessionSecrets(legacyState);
      expect(ok).toBe(true);

      const secrets = context.readSessionSecrets();
      expect(secrets.initialized).toBe(true);
      expect(secrets.apiKeys.openai).toBe('sk-legacy-key');
      expect(secrets.apiKeys.groq).toBe('gsk_legacy_groq');
      expect(secrets.connectionTokens.telegram).toBe('bot999:migrated');
      expect(secrets.accountTokens['gmail_user_1']).toBe('ya29.migrated_user1');
      expect(secrets.bridgeToken).toBe('legacy-bridge-secret');
    });

    it('should non-destructively merge new secrets without wiping existing stored secrets', () => {
      context.writeSessionSecrets({
        apiKeys: { openai: 'sk-first-key' },
        connectionTokens: { github: 'ghp_token_first' }
      });

      context.writeSessionSecrets({
        apiKeys: { anthropic: 'sk-second-key' },
        connectionTokens: { sentry: 'sentry_token_second' }
      });

      const secrets = context.readSessionSecrets();
      expect(secrets.apiKeys.openai).toBe('sk-first-key');
      expect(secrets.apiKeys.anthropic).toBe('sk-second-key');
      expect(secrets.connectionTokens.github).toBe('ghp_token_first');
      expect(secrets.connectionTokens.sentry).toBe('sentry_token_second');
    });

    it('should quarantine corrupted session JSON with timestamp and return safe default without crashing', () => {
      const corruptPayload = '{"apiKeys": { UNTERMINATED_CORRUPT_JSON...';
      sessionStorageMock.setItem(SESSION_SECRETS_KEY, corruptPayload);

      const secrets = context.readSessionSecrets();

      // Corrupt payload quarantined
      const allStoredKeys = Object.keys(sessionStorageMock._getStore());
      const quarantineKey = allStoredKeys.find(k => k.startsWith(SESSION_SECRETS_KEY + '_corrupted_'));

      expect(quarantineKey).toBeDefined();
      expect(sessionStorageMock.getItem(quarantineKey)).toBe(corruptPayload);
      expect(sessionStorageMock.getItem(SESSION_SECRETS_KEY)).toBeNull();

      // Returns safe fallback schema
      expect(secrets.initialized).toBe(false);
      expect(secrets.apiKeys).toEqual(emptyApiKeys());
    });

    it('should return default schema when parsed session data is not an object (e.g. array or primitive)', () => {
      sessionStorageMock.setItem(SESSION_SECRETS_KEY, JSON.stringify([1, 2, 3]));
      const secretsFromArray = context.readSessionSecrets();
      expect(secretsFromArray.initialized).toBe(false);

      sessionStorageMock.setItem(SESSION_SECRETS_KEY, JSON.stringify('malformed string'));
      const secretsFromString = context.readSessionSecrets();
      expect(secretsFromString.initialized).toBe(false);
    });
  });

  describe('applySessionSecrets re-hydration', () => {
    it('should re-hydrate session secrets into memory appState', () => {
      context.writeSessionSecrets({
        apiKeys: {
          openai: 'sk-persisted-openai',
          anthropic: 'sk-persisted-claude'
        },
        connectionTokens: {
          github: 'ghp_persisted_github_token'
        },
        accountTokens: {
          gmail_account_1: 'ya29.hydrated_token'
        },
        bridgeToken: 'hydrated-bridge-secret'
      });

      const inMemoryState = {
        apiKeys: emptyApiKeys(),
        appConnections: {
          github: { accounts: [], mcpEnabled: true, connectedAt: '2026-01-01' },
          gmail: {
            accounts: [{ id: 'account_1', email: 'me@example.com', token: '' }]
          }
        },
        localComputerConfig: { bridgeUrl: 'http://localhost:8765' }
      };

      const hydrated = context.applySessionSecrets(inMemoryState);

      expect(hydrated.apiKeys.openai).toBe('sk-persisted-openai');
      expect(hydrated.apiKeys.anthropic).toBe('sk-persisted-claude');
      expect(hydrated.appConnections.github.token).toBe('ghp_persisted_github_token');
      expect(hydrated.appConnections.gmail.accounts[0].token).toBe('ya29.hydrated_token');
      expect(hydrated.localComputerConfig.bridgeToken).toBe('hydrated-bridge-secret');
    });
  });

  describe('Google OAuth multi-account token isolation based on ${appId}_${accountId}', () => {
    beforeEach(() => {
      context.writeSessionSecrets({
        apiKeys: {},
        accountTokens: {
          'gmail_user_work': 'token_work_gmail_scope',
          'gmail_user_personal': 'token_personal_gmail_scope',
          'youtube_user_work': 'token_work_youtube_scope',
          'gcal_user_work': 'token_work_gcal_scope'
        }
      });
    });

    it('should retrieve correct token for selected account in multi-account connection', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [
              { id: 'user_work', email: 'work@company.com' },
              { id: 'user_personal', email: 'me@gmail.com' }
            ],
            selectedAccountId: 'user_work'
          }
        }
      };

      const tokenWork = context.getAppConnectionToken('gmail');
      expect(tokenWork).toBe('token_work_gmail_scope');

      // Switch active account
      context.appState.appConnections.gmail.selectedAccountId = 'user_personal';
      const tokenPersonal = context.getAppConnectionToken('gmail');
      expect(tokenPersonal).toBe('token_personal_gmail_scope');
    });

    it('should strictly isolate tokens between different Google apps for same user ID', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          },
          youtube: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          },
          gcal: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          }
        }
      };

      // Each service gets its own isolated scoped token, preventing scope mismatch
      expect(context.getAppConnectionToken('gmail')).toBe('token_work_gmail_scope');
      expect(context.getAppConnectionToken('youtube')).toBe('token_work_youtube_scope');
      expect(context.getAppConnectionToken('gcal')).toBe('token_work_gcal_scope');
    });

    it('should return empty string if requested service has no token without cross-polluting from other services', () => {
      context.appState = {
        appConnections: {
          gworkspace: {
            accounts: [{ id: 'user_work', email: 'work@company.com' }],
            selectedAccountId: 'user_work'
          }
        }
      };

      // Even though 'user_work' has tokens for gmail and youtube, gworkspace has no token
      const gworkspaceToken = context.getAppConnectionToken('gworkspace');
      expect(gworkspaceToken).toBe('');
    });

    it('should map accounts with isolated tokens in getConnectionAccounts', () => {
      context.appState = {
        appConnections: {
          gmail: {
            accounts: [
              { id: 'user_work', email: 'work@company.com', name: 'Work Account' },
              { id: 'user_personal', email: 'personal@gmail.com', name: 'Personal Account' }
            ]
          }
        }
      };

      const accounts = context.getConnectionAccounts('gmail');
      expect(accounts).toHaveLength(2);

      const work = accounts.find(a => a.id === 'user_work');
      expect(work.token).toBe('token_work_gmail_scope');
      expect(work.email).toBe('work@company.com');

      const personal = accounts.find(a => a.id === 'user_personal');
      expect(personal.token).toBe('token_personal_gmail_scope');
      expect(personal.email).toBe('personal@gmail.com');
    });
  });
});
