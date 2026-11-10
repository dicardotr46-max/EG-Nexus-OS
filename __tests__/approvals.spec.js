const vm = require('vm');
const { extractFunction } = require('./test_helpers');

describe('Approval Gates & MCP Tool-Call Security', () => {
  let context;
  let domElements;
  let toastMessages;

  function createMockElement(id, initialHidden = false) {
    const classSet = new Set(initialHidden ? ['hidden'] : []);
    const el = {
      id,
      classList: {
        add: jest.fn(c => classSet.add(c)),
        remove: jest.fn(c => classSet.delete(c)),
        contains: jest.fn(c => classSet.has(c)),
        _classes: classSet
      },
      innerText: '',
      innerHTML: '',
      className: '',
      checked: false,
      value: ''
    };
    return el;
  }

  beforeEach(() => {
    domElements = {
      approvalGateText: createMockElement('approvalGateText'),
      approvalGateBanner: createMockElement('approvalGateBanner', true),
      mcpTestOutput: createMockElement('mcpTestOutput', true),
      mcpActiveToggle: createMockElement('mcpActiveToggle'),
      mcpTokenInput: createMockElement('mcpTokenInput')
    };

    toastMessages = [];

    context = vm.createContext({
      uiState: {
        pendingApprovalQueue: [],
        _isResolvingApproval: false
      },
      appState: {
        appConnections: {}
      },
      document: {
        getElementById: jest.fn(id => domElements[id] || null)
      },
      showToast: jest.fn(msg => { toastMessages.push(msg); }),
      requestPhase5ConfirmModal: jest.fn().mockResolvedValue(true),
      escapeHtml: jest.fn(s => String(s)),
      getAppConnectionToken: jest.fn(() => 'test-token'),
      NexusMCP: {
        definitions: {
          neon: {
            tools: [{ name: 'run_sql', description: 'Execute SQL' }]
          },
          empty_mcp: {
            tools: []
          }
        }
      },
      setTimeout: jest.fn((cb) => cb()),
      Boolean,
      Array,
      String,
      Error
    });

    vm.runInContext(extractFunction('triggerApprovalGate'), context);
    vm.runInContext(extractFunction('resolveApprovalGate'), context);
    vm.runInContext(extractFunction('testMcpServerTool'), context);
  });

  describe('Approval Gates for Tool-Calls', () => {
    it('should push approval request to queue, update UI banner, and set pending reason text', () => {
      const onApprove = jest.fn();
      context.triggerApprovalGate('اجرای دستور سیستمی rm -rf /tmp/cache', onApprove);

      expect(context.uiState.pendingApprovalQueue).toHaveLength(1);
      expect(context.uiState.pendingApprovalQueue[0].reason).toBe('اجرای دستور سیستمی rm -rf /tmp/cache');
      expect(domElements.approvalGateText.innerText).toBe('اجرای دستور سیستمی rm -rf /tmp/cache');
      expect(domElements.approvalGateBanner.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('should execute onApprove callback when resolveApprovalGate(true) is called', () => {
      const onApprove = jest.fn();
      context.triggerApprovalGate('Transfer funds $500', onApprove);

      context.resolveApprovalGate(true);

      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(context.uiState.pendingApprovalQueue).toHaveLength(0);
      expect(domElements.approvalGateBanner.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should NOT execute onApprove and show toast when resolveApprovalGate(false) is rejected', () => {
      const onApprove = jest.fn();
      context.triggerApprovalGate('Delete database table', onApprove);

      context.resolveApprovalGate(false);

      expect(onApprove).not.toHaveBeenCalled();
      expect(context.uiState.pendingApprovalQueue).toHaveLength(0);
      expect(toastMessages).toContain('عملیات حساس توسط شما لغو شد 🛡️');
      expect(domElements.approvalGateBanner.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should handle sequential approvals in the queue', () => {
      const approveFirst = jest.fn();
      const approveSecond = jest.fn();

      context.triggerApprovalGate('First action: Git push', approveFirst);
      context.triggerApprovalGate('Second action: Telegram broadcast', approveSecond);

      expect(context.uiState.pendingApprovalQueue).toHaveLength(2);
      expect(domElements.approvalGateText.innerText).toBe('First action: Git push');

      // Resolve first
      context.resolveApprovalGate(true);
      expect(approveFirst).toHaveBeenCalledTimes(1);
      expect(approveSecond).not.toHaveBeenCalled();
      expect(context.uiState.pendingApprovalQueue).toHaveLength(1);
      // Next action becomes active
      expect(domElements.approvalGateText.innerText).toBe('Second action: Telegram broadcast');

      // Resolve second
      context.resolveApprovalGate(true);
      expect(approveSecond).toHaveBeenCalledTimes(1);
      expect(context.uiState.pendingApprovalQueue).toHaveLength(0);
      expect(domElements.approvalGateBanner.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should debounce rapid resolution clicks via _isResolvingApproval guard', () => {
      const onApprove = jest.fn();
      context.triggerApprovalGate('Action 1', onApprove);

      // Simulate rapid double click before timeout resets _isResolvingApproval
      context.uiState._isResolvingApproval = true;
      context.resolveApprovalGate(true);

      expect(onApprove).not.toHaveBeenCalled();
      expect(context.uiState.pendingApprovalQueue).toHaveLength(1);
    });
  });

  describe('testMcpServerTool security and gating', () => {
    it('should hard block testMcpServerTool when MCP is disabled in appState', async () => {
      context.appState.appConnections = {
        neon: { mcpEnabled: false }
      };
      domElements.mcpActiveToggle.checked = false;

      await context.testMcpServerTool('neon');

      expect(toastMessages).toContain('⚠️ این سرور MCP غیرفعال است؛ ابتدا آن را فعال و ذخیره کنید');
      expect(domElements.mcpTestOutput.innerHTML).toContain('سرور MCP غیرفعال است');
      expect(domElements.mcpTestOutput.classList.remove).toHaveBeenCalledWith('hidden');
      // Did NOT proceed to confirmation modal or execution
      expect(context.requestPhase5ConfirmModal).not.toHaveBeenCalled();
    });

    it('should hard block when appConnection does not exist in appState', async () => {
      context.appState.appConnections = {};
      domElements.mcpActiveToggle.checked = false;

      await context.testMcpServerTool('unregistered_mcp');

      expect(toastMessages).toContain('⚠️ این سرور MCP غیرفعال است؛ ابتدا آن را فعال و ذخیره کنید');
      expect(context.requestPhase5ConfirmModal).not.toHaveBeenCalled();
    });

    it('should request user confirmation modal when MCP is actively enabled', async () => {
      context.appState.appConnections = {
        neon: { mcpEnabled: true }
      };
      domElements.mcpActiveToggle.checked = true;

      await context.testMcpServerTool('neon');

      expect(context.requestPhase5ConfirmModal).toHaveBeenCalledTimes(1);
      const modalArg = context.requestPhase5ConfirmModal.mock.calls[0][0];
      expect(modalArg.title).toContain('تست سلامت سرور MCP');
    });

    it('should cancel MCP test execution if user rejects the confirmation modal', async () => {
      context.appState.appConnections = {
        neon: { mcpEnabled: true }
      };
      domElements.mcpActiveToggle.checked = true;
      context.requestPhase5ConfirmModal.mockResolvedValueOnce(false);

      await context.testMcpServerTool('neon');

      expect(domElements.mcpTestOutput.innerHTML).toContain('بررسی سلامت توسط کاربر لغو شد');
    });

    it('should fail gracefully if MCP tool definition has no tools registered', async () => {
      context.appState.appConnections = {
        empty_mcp: { mcpEnabled: true }
      };
      domElements.mcpActiveToggle.checked = true;

      await context.testMcpServerTool('empty_mcp');

      expect(domElements.mcpTestOutput.innerHTML).toContain('هیچ ابزاری برای این سرور MCP تعریف نشده است');
    });
  });
});
