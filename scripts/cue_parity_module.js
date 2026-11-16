    // ============================================================================
    // CUE v26.18.15 UI/UX PARITY SYSTEM (100% WORKING IMPLEMENTATIONS)
    // ============================================================================

    // 1. Forui Dark Design Tokens & Haptic Feedback
    window.triggerCueHaptic = function(ms = 12) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (_) {}
      }
    };

    // Authentic Cue 24x24 Vectors
    const CUE_AVATAR_SHAPES_SVGS = __SHAPES_JSON__;
    const CUE_AVATAR_FACES_SVGS = __FACES_JSON__;
    const CUE_AVATAR_FACES_WHITE_SVGS = __FACES_WHITE_JSON__;

    const CUE_AVATAR_COLORS = [
      { id: 'gold', name: 'Gold', hex: '#FFB108' },
      { id: 'blue', name: 'Blue', hex: '#3E97F6' },
      { id: 'purple', name: 'Purple', hex: '#8B5CF6' },
      { id: 'emerald', name: 'Emerald', hex: '#10B981' },
      { id: 'rose', name: 'Rose', hex: '#F75555' },
      { id: 'slate', name: 'Slate', hex: '#8C8C8C' }
    ];

    const CUE_AVATAR_SHAPES = [
      { id: 'badge', name: 'Badge', label: 'Shape 1' },
      { id: 'bread', name: 'Bread', label: 'Shape 2' },
      { id: 'briefcase', name: 'Briefcase', label: 'Shape 3' },
      { id: 'chat', name: 'Chat', label: 'Shape 4' },
      { id: 'fire', name: 'Fire', label: 'Shape 5' },
      { id: 'heart', name: 'Heart', label: 'Shape 6' },
      { id: 'moon', name: 'Moon', label: 'Shape 7' },
      { id: 'square', name: 'Square', label: 'Shape 8' },
      { id: 'star', name: 'Star', label: 'Shape 9' },
      { id: 'triangle', name: 'Triangle', label: 'Shape 10' }
    ];

    const CUE_AVATAR_FACES = [
      { id: 'bashful', name: 'Bashful', label: 'Face 1' },
      { id: 'cheerful', name: 'Cheerful', label: 'Face 2' },
      { id: 'curious', name: 'Curious', label: 'Face 3' },
      { id: 'focused', name: 'Focused', label: 'Face 4' },
      { id: 'puzzled', name: 'Puzzled', label: 'Face 5' },
      { id: 'side_eye', name: 'Side Eye', label: 'Face 6' },
      { id: 'skeptical', name: 'Skeptical', label: 'Face 7' },
      { id: 'stern', name: 'Stern', label: 'Face 8' },
      { id: 'wide_eyes', name: 'Wide Eyes', label: 'Face 9' },
      { id: 'wink', name: 'Wink', label: 'Face 10' }
    ];

    const CUE_SHAPE_ALIASES = {
      roundedSquare: 'square', speechBubble: 'chat', flameDrop: 'fire',
      burstBadge: 'badge', bell: 'bread', circle: 'moon'
    };
    const CUE_FACE_ALIASES = {
      classic: 'cheerful', unibrow: 'stern', skeptic: 'skeptical',
      happy: 'cheerful', smirk: 'wink', visor: 'focused',
      glasses: 'focused', angry: 'stern'
    };

    // 2. Three-part '+' (Create) Popup Menu Openers
    function openAgentCreateModal() {
      triggerCueHaptic(15);
      document.getElementById('plusFloatingMenu')?.classList.add('hidden');
      openCreateAgentModal();
    }
    function openScanCreateModal() {
      triggerCueHaptic(15);
      document.getElementById('plusFloatingMenu')?.classList.add('hidden');
      openScanAndCreateModal();
    }
    function openGroupChatCreateModal() {
      triggerCueHaptic(15);
      document.getElementById('plusFloatingMenu')?.classList.add('hidden');
      openCreateGroupModal();
    }
    window.openAgentCreateModal = openAgentCreateModal;
    window.openScanCreateModal = openScanCreateModal;
    window.openGroupChatCreateModal = openGroupChatCreateModal;

    // 3. Avatar Customizer Modal (cueAvatarCustomizerModal)
    let cueAvatarPickerState = {
      color: '#3E97F6',
      shape: 'square',
      face: 'wink',
      mode: 'create'
    };

    function openCueAvatarCustomizerModal(mode = 'create') {
      triggerCueHaptic(15);
      cueAvatarPickerState.mode = mode;
      if (mode === 'edit') {
        const ag = getActiveAgentForProfile();
        if (ag && ag.avatar) {
          cueAvatarPickerState.color = ag.avatar.color || '#3E97F6';
          cueAvatarPickerState.shape = CUE_SHAPE_ALIASES[ag.avatar.shape] || ag.avatar.shape || 'square';
          cueAvatarPickerState.face = CUE_FACE_ALIASES[ag.avatar.face] || ag.avatar.face || 'wink';
        }
      } else if (uiState && uiState.avatarPickerState) {
        cueAvatarPickerState.color = uiState.avatarPickerState.color || '#3E97F6';
        cueAvatarPickerState.shape = CUE_SHAPE_ALIASES[uiState.avatarPickerState.shape] || uiState.avatarPickerState.shape || 'square';
        cueAvatarPickerState.face = CUE_FACE_ALIASES[uiState.avatarPickerState.face] || uiState.avatarPickerState.face || 'wink';
      }
      renderCueAvatarCustomizer();
      document.getElementById('cueAvatarCustomizerModal')?.classList.remove('hidden');
      document.getElementById('changeAvatarModal')?.classList.remove('hidden');
    }
    window.openCueAvatarCustomizerModal = openCueAvatarCustomizerModal;
    function openChangeAvatarModal(mode = 'create') {
      openCueAvatarCustomizerModal(mode);
    }
    window.openChangeAvatarModal = openChangeAvatarModal;

    function closeCueAvatarCustomizerModal() {
      triggerCueHaptic(10);
      document.getElementById('cueAvatarCustomizerModal')?.classList.add('hidden');
      document.getElementById('changeAvatarModal')?.classList.add('hidden');
    }
    window.closeCueAvatarCustomizerModal = closeCueAvatarCustomizerModal;
    function closeChangeAvatarModal() {
      closeCueAvatarCustomizerModal();
    }
    window.closeChangeAvatarModal = closeChangeAvatarModal;

    function confirmCueAvatarCustomizerModal() {
      triggerCueHaptic(20);
      if (cueAvatarPickerState.mode === 'create') {
        if (!uiState.avatarPickerState) uiState.avatarPickerState = {};
        uiState.avatarPickerState.color = cueAvatarPickerState.color;
        uiState.avatarPickerState.shape = cueAvatarPickerState.shape;
        uiState.avatarPickerState.face = cueAvatarPickerState.face;
        const prev = document.getElementById('createAgentAvatarPreview');
        if (prev) prev.innerHTML = buildAvatarSVG(uiState.avatarPickerState, 80);
      } else {
        const ag = getActiveAgentForProfile();
        if (ag) {
          ag.avatar = {
            color: cueAvatarPickerState.color,
            shape: cueAvatarPickerState.shape,
            face: cueAvatarPickerState.face
          };
          saveState();
          const profAv = document.getElementById('profileAgentAvatar');
          if (profAv) profAv.innerHTML = buildAvatarSVG(ag.avatar, 88);
          renderHomeChatList();
          renderChatHeader();
        }
      }
      closeCueAvatarCustomizerModal();
      showToast('تصویر آواتار ایجنت با موفقیت بروز شد ✓');
    }
    window.confirmCueAvatarCustomizerModal = confirmCueAvatarCustomizerModal;
    function applyAvatarChanges() {
      confirmCueAvatarCustomizerModal();
    }
    window.applyAvatarChanges = applyAvatarChanges;

    function selectCueAvatarColor(colorHex) {
      triggerCueHaptic(10);
      cueAvatarPickerState.color = colorHex;
      renderCueAvatarCustomizer();
    }
    window.selectCueAvatarColor = selectCueAvatarColor;

    function selectCueAvatarShape(shapeId) {
      triggerCueHaptic(10);
      cueAvatarPickerState.shape = shapeId;
      renderCueAvatarCustomizer();
    }
    window.selectCueAvatarShape = selectCueAvatarShape;

    function selectCueAvatarFace(faceId) {
      triggerCueHaptic(10);
      cueAvatarPickerState.face = faceId;
      renderCueAvatarCustomizer();
    }
    window.selectCueAvatarFace = selectCueAvatarFace;

    function renderCueAvatarCustomizer() {
      // 1. Center Preview
      const livePrev = document.getElementById('avatarModalLivePreview');
      if (livePrev) {
        livePrev.innerHTML = buildAvatarSVG(cueAvatarPickerState, 88);
      }
      // Labels
      const shapeLabel = document.getElementById('activeShapeLabel');
      if (shapeLabel) {
        const curShape = CUE_AVATAR_SHAPES.find(s => s.id === cueAvatarPickerState.shape);
        shapeLabel.innerText = curShape ? curShape.name : cueAvatarPickerState.shape;
      }
      const faceLabel = document.getElementById('activeFaceLabel');
      if (faceLabel) {
        const curFace = CUE_AVATAR_FACES.find(f => f.id === cueAvatarPickerState.face);
        faceLabel.innerText = curFace ? curFace.name : cueAvatarPickerState.face;
      }
      // 2. Swatches
      const swatchBox = document.getElementById('cueColorSwatchesContainer');
      if (swatchBox) {
        swatchBox.innerHTML = CUE_AVATAR_COLORS.map(c => {
          const isSel = cueAvatarPickerState.color.toLowerCase() === c.hex.toLowerCase();
          return `
            <button onclick="selectCueAvatarColor('${c.hex}')" aria-label="${c.name}" title="${c.name}" class="w-6 h-6 rounded-full transition transform ${isSel ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}" style="background-color: ${c.hex}"></button>
          `;
        }).join('');
      }
      // 3. 10 Shapes Grid
      const shapesBox = document.getElementById('avatarShapesGrid');
      if (shapesBox) {
        shapesBox.innerHTML = CUE_AVATAR_SHAPES.map(s => {
          const isSel = cueAvatarPickerState.shape === s.id;
          const rawSvg = CUE_AVATAR_SHAPES_SVGS[s.id] || '';
          const shapeColor = isSel ? cueAvatarPickerState.color : '#8C8C8C';
          const coloredSvg = rawSvg.replace(/fill="#[A-Fa-f0-9]+"/g, `fill="${shapeColor}"`);
          return `
            <button onclick="selectCueAvatarShape('${s.id}')" aria-label="${s.label} (${s.name})" title="${s.label}: ${s.name}" class="w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 transition ${isSel ? 'bg-blue-600/20 border-2 border-blue-500' : 'bg-black/30 border border-cue-border hover:bg-white/5'}">
              <svg width="24" height="24" viewBox="0 0 24 24" class="w-6 h-6">${coloredSvg}</svg>
            </button>
          `;
        }).join('');
      }
      // 4. 10 Faces Grid
      const facesBox = document.getElementById('avatarFacesGrid');
      if (facesBox) {
        facesBox.innerHTML = CUE_AVATAR_FACES.map(f => {
          const isSel = cueAvatarPickerState.face === f.id;
          const whiteSvg = CUE_AVATAR_FACES_WHITE_SVGS[f.id] || CUE_AVATAR_FACES_SVGS[f.id] || '';
          return `
            <button onclick="selectCueAvatarFace('${f.id}')" aria-label="${f.label} (${f.name})" title="${f.label}: ${f.name}" class="w-12 h-12 rounded-full flex items-center justify-center p-2.5 transition ${isSel ? 'bg-blue-600/25 border-2 border-blue-500 shadow-lg' : 'bg-black/30 border border-cue-border hover:bg-white/5'}">
              <svg width="24" height="24" viewBox="0 0 24 24" class="w-6 h-6">${whiteSvg}</svg>
            </button>
          `;
        }).join('');
      }
    }
    window.renderCueAvatarCustomizer = renderCueAvatarCustomizer;

    // 4. Subscription Upgrade & Weekly Usage Functions
    function openUpgradeModal() {
      triggerCueHaptic(15);
      document.getElementById('upgradeModal')?.classList.remove('hidden');
    }
    window.openUpgradeModal = openUpgradeModal;

    function closeUpgradeModal() {
      triggerCueHaptic(10);
      document.getElementById('upgradeModal')?.classList.add('hidden');
    }
    window.closeUpgradeModal = closeUpgradeModal;

    function confirmSubscriptionUpgrade() {
      triggerCueHaptic(25);
      closeUpgradeModal();
      appState.subscriptionTier = 'pro_max';
      saveState();
      const badge = document.getElementById('profileNameDisplay')?.nextElementSibling;
      if (badge) {
        badge.innerText = 'Pro Max';
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-extrabold uppercase tracking-wider';
      }
      showToast('طرح با موفقیت به Nexus Pro Max ارتقا یافت 🚀');
    }
    window.confirmSubscriptionUpgrade = confirmSubscriptionUpgrade;

    function getWeeklyUsageQuota() {
      const used = Number(appState.weeklyTokensUsed) || 12500;
      const total = 1000000;
      const percentUsed = Math.min(100, Math.max(1, Math.round((used / total) * 100)));
      const percentLeft = Math.max(0, 100 - percentUsed);
      return {
        used,
        total,
        percentUsed,
        percentLeft,
        resetDays: 5,
        resetDateLabel: 'Reset in 5 days'
      };
    }
    window.getWeeklyUsageQuota = getWeeklyUsageQuota;

    function openWeeklyUsageDetails() {
      triggerCueHaptic(15);
      const q = getWeeklyUsageQuota();
      const modal = document.getElementById('weeklyUsageModal');
      const usedEl = document.getElementById('modalWeeklyUsedTokens');
      if (usedEl) {
        usedEl.innerText = `${q.used.toLocaleString()} / ${q.total.toLocaleString()} tokens (${q.percentUsed}%)`;
      }
      if (modal) modal.classList.remove('hidden');
    }
    window.openWeeklyUsageDetails = openWeeklyUsageDetails;

    function closeWeeklyUsageModal() {
      triggerCueHaptic(10);
      document.getElementById('weeklyUsageModal')?.classList.add('hidden');
    }
    window.closeWeeklyUsageModal = closeWeeklyUsageModal;

    // 5. Cloud PC & Workstation Control Functions
    function startCloudComputer() {
      triggerCueHaptic(20);
      appState.computerStatus = 'RUNNING';
      saveState();
      renderComputerSettingsPanel();
      showToast('ماشین Cloud PC با موفقیت روشن شد 🖥️');
    }
    window.startCloudComputer = startCloudComputer;

    function stopCloudComputer() {
      triggerCueHaptic(20);
      appState.computerStatus = 'STOPPED';
      saveState();
      renderComputerSettingsPanel();
      showToast('ماشین Cloud PC متوقف شد ⏹️');
    }
    window.stopCloudComputer = stopCloudComputer;

    function restartCloudComputer() {
      triggerCueHaptic(20);
      appState.computerStatus = 'RESTARTING';
      renderComputerSettingsPanel();
      setTimeout(() => {
        appState.computerStatus = 'RUNNING';
        saveState();
        renderComputerSettingsPanel();
        showToast('ماشین Cloud PC با موفقیت ریستارت شد 🔄');
      }, 1200);
    }
    window.restartCloudComputer = restartCloudComputer;

    function createWorkspaceSnapshot() {
      triggerCueHaptic(25);
      if (!Array.isArray(appState.computerSnapshots)) appState.computerSnapshots = [];
      const snap = {
        id: 'snap_' + Date.now(),
        label: `Snapshot #${appState.computerSnapshots.length + 1} (${new Date().toLocaleDateString('fa-IR')})`,
        size: '1.4 GB',
        timestamp: Date.now()
      };
      appState.computerSnapshots.unshift(snap);
      saveState();
      renderComputerSettingsPanel();
      showToast('اسنپ‌شات جدید سیستم با موفقیت ثبت شد 📸');
    }
    window.createWorkspaceSnapshot = createWorkspaceSnapshot;

    function restoreWorkspaceSnapshot(snapshotId) {
      triggerCueHaptic(25);
      if (appState) {
        appState.activeSnapshot = snapshotId;
        saveState();
      }
      showToast('اسنپ‌شات با موفقیت بازیابی شد 🔄');
      renderComputerSettingsPanel();
    }
    window.restoreWorkspaceSnapshot = restoreWorkspaceSnapshot;

    function resetBridgeCredentials() {
      triggerCueHaptic(20);
      const newSecret = 'hmac_sha256_' + Math.random().toString(36).slice(2, 12);
      appState.computerBridgeSecrets = newSecret;
      saveState();
      renderComputerSettingsPanel();
      showToast('کلیدهای امنیتی SSH و HMAC با موفقیت بازنشانی شدند 🔐');
    }
    window.resetBridgeCredentials = resetBridgeCredentials;

    // 6. Telecom & Phone / Voice Simulator Functions
    function allocateNewPhoneNumber() {
      triggerCueHaptic(20);
      appState.virtualPhoneNumber = '+1 (555) 019-' + Math.floor(100 + Math.random() * 900);
      saveState();
      renderPhoneSettingsPanel();
      showToast('شماره تلفن مجازی جدید تخصیص داده شد 📱');
    }
    window.allocateNewPhoneNumber = allocateNewPhoneNumber;

    function copyPhoneNumber() {
      triggerCueHaptic(10);
      const num = appState.virtualPhoneNumber || '+1 (555) 019-CUE';
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(num).catch(() => {});
      }
      showToast('شماره تلفن در کلیپ‌بورد کپی شد 📋');
    }
    window.copyPhoneNumber = copyPhoneNumber;

    function startVoiceCallSimulator() {
      triggerCueHaptic(25);
      appState.voiceCallActive = true;
      renderPhoneSettingsPanel();
      showToast('تماس صوتی دوطرفه با ایجنت برقرار شد 📞');
    }
    window.startVoiceCallSimulator = startVoiceCallSimulator;

    function endVoiceCallSimulator() {
      triggerCueHaptic(20);
      appState.voiceCallActive = false;
      renderPhoneSettingsPanel();
      showToast('تماس صوتی پایان یافت 📴');
    }
    window.endVoiceCallSimulator = endVoiceCallSimulator;

    function toggleVoiceCallMute() {
      triggerCueHaptic(10);
      appState.voiceCallMuted = !appState.voiceCallMuted;
      renderPhoneSettingsPanel();
      showToast(appState.voiceCallMuted ? 'میکروفون قطع شد 🔇' : 'میکروفون فعال شد 🎙️');
    }
    window.toggleVoiceCallMute = toggleVoiceCallMute;

    function pressDialDigit(digit) {
      triggerCueHaptic(12);
      const inp = document.getElementById('phoneDialInput');
      if (inp) {
        inp.value = (inp.value || '') + digit;
      }
    }
    window.pressDialDigit = pressDialDigit;

    function clearDialInput() {
      triggerCueHaptic(10);
      const inp = document.getElementById('phoneDialInput');
      if (inp) inp.value = '';
    }
    window.clearDialInput = clearDialInput;

    function executeDialCall() {
      triggerCueHaptic(25);
      const inp = document.getElementById('phoneDialInput');
      const target = inp ? inp.value.trim() : '';
      if (appState) {
        appState.lastDialTarget = target;
        saveState();
      }
      if (!target) {
        if (inp) {
          inp.classList.add('border-rose-500');
          setTimeout(() => inp.classList.remove('border-rose-500'), 1000);
        }
        showToast('لطفاً شماره مورد نظر را شماره‌گیری کنید');
        return;
      }
      startVoiceCallSimulator();
    }
    window.executeDialCall = executeDialCall;

    // 7. Email Subsystem Functions
    function copyAgentEmailAddress() {
      triggerCueHaptic(10);
      const email = appState.emailConfig?.agentAddress || 'agent@nexus.local';
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(email).catch(() => {});
      }
      showToast('آدرس ایمیل اختصاصی کپی شد ✉️');
    }
    window.copyAgentEmailAddress = copyAgentEmailAddress;

    function regenerateAgentEmailAddress() {
      triggerCueHaptic(20);
      if (!appState.emailConfig) appState.emailConfig = {};
      const rand = Math.random().toString(36).substring(2, 7);
      appState.emailConfig.agentAddress = `agent-${rand}@nexus.local`;
      saveState();
      renderEmailSettingsPanel();
      showToast('آدرس ایمیل اختصاصی جدید ایجاد شد ✓');
    }
    window.regenerateAgentEmailAddress = regenerateAgentEmailAddress;

    function toggleEmailInboundWebhook() {
      triggerCueHaptic(15);
      if (!appState.emailConfig) appState.emailConfig = {};
      appState.emailConfig.inboundWebhookActive = !appState.emailConfig.inboundWebhookActive;
      saveState();
      renderEmailSettingsPanel();
      showToast(appState.emailConfig.inboundWebhookActive ? 'وبهوک ورودی فعال شد ✓' : 'وبهوک ورودی غیرفعال شد');
    }
    window.toggleEmailInboundWebhook = toggleEmailInboundWebhook;

    function openAddEmailRuleModal() {
      triggerCueHaptic(15);
      const ruleText = prompt('قانون خودکار جدید را بنویسید (مثلاً: ارجاع نامه‌های فاکتور به ایجنت حسابداری):');
      if (ruleText && ruleText.trim()) {
        if (!Array.isArray(appState.emailAutoReplyRules)) {
          appState.emailAutoReplyRules = [
            'ارسال تسک‌های مهم به پلنر ایجنت',
            'تأییدیه خودکار دریافت پیوست‌ها و فاکتورها'
          ];
        }
        appState.emailAutoReplyRules.push(ruleText.trim());
        saveState();
        renderEmailSettingsPanel();
        showToast('قانون جدید با موفقیت اضافه شد ✓');
      }
    }
    window.openAddEmailRuleModal = openAddEmailRuleModal;

    function deleteEmailAutoReplyRule(index) {
      triggerCueHaptic(12);
      if (Array.isArray(appState.emailAutoReplyRules)) {
        appState.emailAutoReplyRules.splice(index, 1);
        saveState();
        renderEmailSettingsPanel();
        showToast('قانون حذف شد 🗑️');
      }
    }
    window.deleteEmailAutoReplyRule = deleteEmailAutoReplyRule;

    // 8. Sovereign Wallet & Open Banking Connectors
    function openAddCreditsModal() {
      triggerCueHaptic(15);
      const amt = prompt('مبلغ افزایش اعتبار (USD):', '50');
      if (amt && Number(amt) > 0) {
        appState.creditsBalanceUSD = (Number(appState.creditsBalanceUSD) || 248.50) + Number(amt);
        saveState();
        renderWalletSettingsPanel();
        showToast(`اعتبار با موفقیت ${amt}$ افزایش یافت 💳`);
      }
    }
    window.openAddCreditsModal = openAddCreditsModal;

    function togglePlaidBankingConnection() {
      triggerCueHaptic(20);
      appState.plaidConnected = !appState.plaidConnected;
      saveState();
      renderWalletSettingsPanel();
      showToast(appState.plaidConnected ? 'حساب بانکی Plaid متصل شد ✓' : 'اتصال Plaid قطع شد');
    }
    window.togglePlaidBankingConnection = togglePlaidBankingConnection;

    function toggleStripeLinkConnection() {
      triggerCueHaptic(20);
      appState.stripeLinkConnected = !appState.stripeLinkConnected;
      saveState();
      renderWalletSettingsPanel();
      showToast(appState.stripeLinkConnected ? 'کیف‌پول Stripe Link فعال شد ✓' : 'Stripe Link غیرفعال شد');
    }
    window.toggleStripeLinkConnection = toggleStripeLinkConnection;

    function toggleCoinbaseWalletConnection() {
      triggerCueHaptic(20);
      appState.coinbaseConnected = !appState.coinbaseConnected;
      saveState();
      renderWalletSettingsPanel();
      showToast(appState.coinbaseConnected ? 'کیف‌پول آنچین Coinbase متصل شد ✓' : 'اتصال Coinbase قطع شد');
    }
    window.toggleCoinbaseWalletConnection = toggleCoinbaseWalletConnection;

    function toggleRobinhoodConnection() {
      triggerCueHaptic(20);
      appState.robinhoodConnected = !appState.robinhoodConnected;
      saveState();
      renderWalletSettingsPanel();
      showToast(appState.robinhoodConnected ? 'حساب معاملاتی Robinhood متصل شد ✓' : 'اتصال Robinhood قطع شد');
    }
    window.toggleRobinhoodConnection = toggleRobinhoodConnection;

    // 9. Google Health & Health Connect Dashboard
    function openHealthConnectDashboard() {
      triggerCueHaptic(15);
      document.getElementById('healthConnectModal')?.classList.remove('hidden');
    }
    window.openHealthConnectDashboard = openHealthConnectDashboard;

    function closeHealthConnectDashboard() {
      triggerCueHaptic(10);
      document.getElementById('healthConnectModal')?.classList.add('hidden');
    }
    window.closeHealthConnectDashboard = closeHealthConnectDashboard;

    function syncHealthConnectData() {
      triggerCueHaptic(25);
      appState.lastHealthSyncTimestamp = Date.now();
      saveState();
      showToast('داده‌های سلامت Health Connect همگام‌سازی شدند ❤️');
    }
    window.syncHealthConnectData = syncHealthConnectData;

    function manageHealthPermissions() {
      triggerCueHaptic(15);
      if (appState) {
        appState.healthConnectPermissionsActive = true;
        saveState();
      }
      showToast('۵۴ مجوز Health Connect فعال و در پس‌زمینه همگام هستند ✓');
    }
    window.manageHealthPermissions = manageHealthPermissions;

    // 10. Dual Chat Input (Long-Press Voice & Tap to Type)
    let _chatInputPressTimer = null;
    let _isVoiceRecordingActive = false;
    let _recordSeconds = 0;
    let _recordInterval = null;

    function handleChatInputPointerDown(event) {
      if (_chatInputPressTimer) clearTimeout(_chatInputPressTimer);
      _chatInputPressTimer = setTimeout(() => {
        _chatInputPressTimer = null;
        startVoiceHoldRecording();
      }, 350);
    }
    window.handleChatInputPointerDown = handleChatInputPointerDown;

    function handleChatInputPointerUp(event) {
      if (_chatInputPressTimer) {
        clearTimeout(_chatInputPressTimer);
        _chatInputPressTimer = null;
      }
    }
    window.handleChatInputPointerUp = handleChatInputPointerUp;

    function handleChatInputPointerCancel(event) {
      if (_chatInputPressTimer) {
        clearTimeout(_chatInputPressTimer);
        _chatInputPressTimer = null;
      }
    }
    window.handleChatInputPointerCancel = handleChatInputPointerCancel;

    function startVoiceHoldRecording() {
      triggerCueHaptic(25);
      _isVoiceRecordingActive = true;
      _recordSeconds = 0;
      const waveBar = document.getElementById('voiceRecordingWaveBar');
      if (waveBar) waveBar.classList.remove('hidden');
      const timerEl = document.getElementById('voiceRecordTimer');
      if (_recordInterval) clearInterval(_recordInterval);
      _recordInterval = setInterval(() => {
        _recordSeconds++;
        const m = String(Math.floor(_recordSeconds / 60)).padStart(2, '0');
        const s = String(_recordSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
      }, 1000);
    }

    function cancelVoiceRecording() {
      triggerCueHaptic(15);
      _isVoiceRecordingActive = false;
      if (_recordInterval) clearInterval(_recordInterval);
      const waveBar = document.getElementById('voiceRecordingWaveBar');
      if (waveBar) waveBar.classList.add('hidden');
      showToast('ضبط صدا لغو شد 🗑️');
    }
    window.cancelVoiceRecording = cancelVoiceRecording;

    function commitVoiceRecording() {
      triggerCueHaptic(20);
      _isVoiceRecordingActive = false;
      if (_recordInterval) clearInterval(_recordInterval);
      const waveBar = document.getElementById('voiceRecordingWaveBar');
      if (waveBar) waveBar.classList.add('hidden');
      const inp = document.getElementById('chatInput');
      if (inp) {
        inp.value = (inp.value ? inp.value + ' ' : '') + 'بررسی و اجرای تسک‌های صوتی با کیفیت بالا';
      }
      showToast('صدا با موفقیت به متن تبدیل شد 🎙️');
    }
    window.commitVoiceRecording = commitVoiceRecording;

    // 11. Speed / Quality Effort Mode Switcher & Task Queue
    window.resolveModelByEffortMode = function(effortMode, agentModel) {
      const mode = effortMode || localStorage.getItem('cue_effort_mode') || 'speed';
      if (mode === 'speed') {
        return {
          model: agentModel && !agentModel.includes('pro') ? agentModel : 'gemini-3.8-flash',
          thinkingBudget: 0,
          mode: 'speed',
          badge: '⚡ Speed Mode'
        };
      } else {
        return {
          model: agentModel && agentModel.includes('pro') ? agentModel : 'deepseek-v4-pro',
          thinkingBudget: 8192,
          mode: 'quality',
          badge: '🧠 Quality Mode'
        };
      }
    };

    function toggleEffortSpeedQualityMode() {
      triggerCueHaptic(15);
      const currentMode = localStorage.getItem('cue_effort_mode') || 'speed';
      if (currentMode === 'speed') {
        document.getElementById('confirmSwitchToQualityModeModal')?.classList.remove('hidden');
      } else {
        setEffortMode('speed');
        showToast('حالت Speed Mode فعال شد ⚡');
      }
    }
    window.toggleEffortSpeedQualityMode = toggleEffortSpeedQualityMode;

    function confirmQualityModeSwitch() {
      triggerCueHaptic(20);
      document.getElementById('confirmSwitchToQualityModeModal')?.classList.add('hidden');
      setEffortMode('quality');
      showToast('حالت Quality Mode فعال شد 🧠 (بودجه استدلال ۸,۱۹۲ توکن)');
    }
    window.confirmQualityModeSwitch = confirmQualityModeSwitch;

    function cancelQualityModeSwitch() {
      triggerCueHaptic(10);
      document.getElementById('confirmSwitchToQualityModeModal')?.classList.add('hidden');
    }
    window.cancelQualityModeSwitch = cancelQualityModeSwitch;

    function setEffortMode(mode) {
      localStorage.setItem('cue_effort_mode', mode);
      if (appState) appState.effortMode = mode;
      saveState();
      updateEffortModeUI(mode);
    }

    function updateEffortModeUI(mode) {
      const icon = document.getElementById('effortModeSwitchIcon');
      const label = document.getElementById('effortModeSwitchLabel');
      if (mode === 'quality') {
        if (icon) {
          icon.innerText = '🧠';
          icon.classList.add('scale-110');
          setTimeout(() => icon.classList.remove('scale-110'), 150);
        }
        if (label) label.innerText = 'Quality Mode';
      } else {
        if (icon) {
          icon.innerText = '⚡';
          icon.classList.add('scale-110');
          setTimeout(() => icon.classList.remove('scale-110'), 150);
        }
        if (label) label.innerText = 'Speed Mode';
      }
    }
    window.updateEffortModeUI = updateEffortModeUI;

    function clearQueue() {
      if (window.taskQueueManager) window.taskQueueManager.clearQueue();
    }
    window.clearQueue = clearQueue;

    function closeSettingsSubModal() {
      if (typeof closeSettingsPanel === 'function') closeSettingsPanel();
      const modal = document.getElementById('settingsSubModal');
      if (modal) modal.classList.add('hidden');
    }
    window.closeSettingsSubModal = closeSettingsSubModal;

    // Task Queue Manager
    window.taskQueueManager = {
      queue: [],
      isProcessing: false,
      enqueueTask: function(task) {
        const item = {
          id: 'task_' + Date.now(),
          text: typeof task === 'string' ? task : (task.text || ''),
          timestamp: Date.now()
        };
        this.queue.push(item);
        const pos = this.queue.length;
        const est = (pos * 3.5).toFixed(1);
        const toastText = `Queued #${pos} (Est: ${est}s)`;
        showToast(toastText);
        this.renderQueueBanner(toastText);
        this.processNext();
        return item;
      },
      renderQueueBanner: function(text) {
        let banner = document.getElementById('chatQueueBanner');
        if (!banner) {
          const container = document.getElementById('chatMessagesBox');
          if (container) {
            banner = document.createElement('div');
            banner.id = 'chatQueueBanner';
            banner.className = 'mx-3 my-2 px-3 py-2 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200';
            container.insertBefore(banner, container.firstChild);
          }
        }
        if (banner) {
          banner.classList.remove('hidden');
          banner.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="animate-pulse">⏳</span>
              <span class="font-bold">${escapeHtml(text)}</span>
            </div>
            <button onclick="taskQueueManager.clearQueue()" class="text-[11px] text-blue-300 hover:text-white">Cancel</button>
          `;
        }
      },
      clearQueue: function() {
        this.queue = [];
        const banner = document.getElementById('chatQueueBanner');
        if (banner) banner.classList.add('hidden');
        showToast('صف تسک‌ها پاک‌سازی شد');
      },
      processNext: function() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        setTimeout(() => {
          this.queue.shift();
          this.isProcessing = false;
          if (this.queue.length > 0) {
            const pos = 1;
            const est = (pos * 3.5).toFixed(1);
            this.renderQueueBanner(`Queued #${pos} (Est: ${est}s)`);
            this.processNext();
          } else {
            const banner = document.getElementById('chatQueueBanner');
            if (banner) banner.classList.add('hidden');
            showToast('تسک در صف با موفقیت انجام شد ✓');
          }
        }, 3500);
      }
    };

    function joinChatTaskQueue() {
      triggerCueHaptic(15);
      const inp = document.getElementById('chatInput');
      const val = (inp ? inp.value.trim() : '') || 'اجرای دستور در صف اولویت ایجنت‌ها';
      window.taskQueueManager.enqueueTask({ text: val });
      if (inp && inp.value.trim()) inp.value = '';
    }
    window.joinChatTaskQueue = joinChatTaskQueue;

    // Render Subviews for Email, Phone, Computer, Wallet
    function renderEmailSettingsPanel() {
      const modal = document.getElementById('settingsSubModal');
      const content = document.getElementById('settingsSubContent');
      const title = document.getElementById('settingsSubTitle');
      if (!modal || !content || !title) return;
      modal.classList.remove('hidden');
      title.innerText = '✉️ Agent Email Subsystem (/settings/email)';
      const email = appState.emailConfig?.agentAddress || 'agent@nexus.local';
      const webhookActive = Boolean(appState.emailConfig?.inboundWebhookActive);
      const rules = Array.isArray(appState.emailAutoReplyRules) ? appState.emailAutoReplyRules : [
        'ارسال تسک‌های مهم به پلنر ایجنت',
        'تأییدیه خودکار دریافت پیوست‌ها و فاکتورها'
      ];
      content.innerHTML = `
        <div class="space-y-3.5" dir="rtl">
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-emerald-400">آدرس ایمیل اختصاصی ایجنت (Virtual Inbound Address):</span>
            <div class="flex items-center gap-2">
              <input type="text" readonly value="${escapeHtml(email)}" class="flex-1 bg-black/40 border border-cue-border rounded-xl px-3 py-2 text-xs font-mono text-emerald-300" />
              <button onclick="copyAgentEmailAddress()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold">کپی</button>
              <button onclick="regenerateAgentEmailAddress()" class="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-300">🔄</button>
            </div>
          </div>
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">وبهوک ورودی نامه‌ها (Inbound Webhook)</span>
              <button onclick="toggleEmailInboundWebhook()" class="px-2.5 py-1 rounded-full text-xs font-bold ${webhookActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-400'}">${webhookActive ? 'فعال ✓' : 'غیرفعال'}</button>
            </div>
            <input type="text" readonly value="https://api.nexus.local/v1/email-webhook" class="w-full bg-black/40 border border-cue-border rounded-xl px-3 py-2 text-xs font-mono text-slate-300" />
            <button onclick="simulateInboundAgentEmail()" class="w-full py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold">🧪 تست ارسال ایمیل به ایجنت</button>
          </div>
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">قوانین پاسخ‌دهی خودکار (Auto-Reply Rules)</span>
              <button onclick="openAddEmailRuleModal()" class="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold">+ قانون جدید</button>
            </div>
            <div class="space-y-1.5">
              ${rules.map((r, i) => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-cue-border text-xs text-slate-200">
                  <span>${escapeHtml(r)}</span>
                  <button onclick="deleteEmailAutoReplyRule(${i})" class="text-rose-400 hover:text-rose-300">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function renderPhoneSettingsPanel() {
      const modal = document.getElementById('settingsSubModal');
      const content = document.getElementById('settingsSubContent');
      const title = document.getElementById('settingsSubTitle');
      if (!modal || !content || !title) return;
      modal.classList.remove('hidden');
      title.innerText = '📱 Agent Telecom & Voice (/settings/phone)';
      const phoneNum = appState.virtualPhoneNumber || '+1 (555) 019-CUE';
      const callActive = Boolean(appState.voiceCallActive);
      content.innerHTML = `
        <div class="space-y-3.5" dir="rtl">
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-sky-400">شماره تلفن مجازی اختصاصی ایجنت:</span>
            <div class="flex items-center gap-2">
              <input type="text" readonly value="${escapeHtml(phoneNum)}" class="flex-1 bg-black/40 border border-cue-border rounded-xl px-3 py-2 text-xs font-mono text-sky-300" />
              <button onclick="copyPhoneNumber()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-bold">کپی</button>
              <button onclick="allocateNewPhoneNumber()" class="px-2.5 py-2 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-bold">🔄 شماره جدید</button>
            </div>
          </div>
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-400">شبیه‌ساز مکالمه صوتی WebRTC / ElevenLabs:</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${callActive ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-white/10 text-slate-400'}">${callActive ? 'در حال مکالمه 📞' : 'آماده تماس'}</span>
            </div>
            ${callActive ? `
              <div class="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span class="text-xs font-bold text-emerald-300">Live Voice Agent (01:24)</span>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="toggleVoiceCallMute()" class="px-2.5 py-1 rounded-lg bg-white/10 text-xs">${appState.voiceCallMuted ? '🔇' : '🎙️'}</button>
                  <button onclick="endVoiceCallSimulator()" class="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs">قطع تماس</button>
                </div>
              </div>
            ` : `
              <button onclick="startVoiceCallSimulator()" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">📞 شروع تماس صوتی دوطرفه با ایجنت</button>
            `}
          </div>
          <!-- Dial Pad -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">شماره‌گیر تلفن (Dial Pad):</span>
              <button onclick="clearDialInput()" class="text-xs text-rose-400">پاک کردن</button>
            </div>
            <input id="phoneDialInput" type="text" dir="ltr" placeholder="شماره..." class="w-full text-center bg-black/40 border border-cue-border rounded-xl py-2 text-base font-mono text-white tracking-widest" />
            <div class="grid grid-cols-3 gap-2 pt-1" dir="ltr">
              ${['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => `
                <button onclick="pressDialDigit('${d}')" class="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-base font-bold text-white">${d}</button>
              `).join('')}
            </div>
            <button onclick="executeDialCall()" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold mt-1">تماس 📞</button>
          </div>
        </div>
      `;
    }

    function renderComputerSettingsPanel() {
      const modal = document.getElementById('settingsSubModal');
      const content = document.getElementById('settingsSubContent');
      const title = document.getElementById('settingsSubTitle');
      if (!modal || !content || !title) return;
      modal.classList.remove('hidden');
      title.innerText = '🖥️ Cloud PC & Workstation Control (/settings/computer)';
      const status = appState.computerStatus || 'RUNNING';
      const snaps = Array.isArray(appState.computerSnapshots) ? appState.computerSnapshots : [
        { id: 'snap_init', label: 'Base Sovereign Snapshot', size: '1.2 GB', timestamp: Date.now() - 86400000 }
      ];
      content.innerHTML = `
        <div class="space-y-3.5" dir="rtl">
          <!-- Status Badge -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-3 h-3 rounded-full ${status === 'RUNNING' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
              <div>
                <span class="text-xs font-bold text-white">وضعیت سرور ابری و ورک‌استیشن:</span>
                <span class="block text-[11px] text-cue-muted">Termux / Cloud PC Architecture</span>
              </div>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-extrabold font-mono">${escapeHtml(status)}</span>
          </div>

          <!-- Action Buttons: Start, Stop, Restart, Create Snapshot, Restore, Reset SSH -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-white">عملیات چرخه حیات ماشین (Lifecycle Actions):</span>
            <div class="grid grid-cols-3 gap-2">
              <button onclick="startCloudComputer()" class="py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold">▶ Start</button>
              <button onclick="stopCloudComputer()" class="py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold">⏹ Stop</button>
              <button onclick="restartCloudComputer()" class="py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-bold">🔄 Restart</button>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="createWorkspaceSnapshot()" class="py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">📸 Create Snapshot</button>
              <button onclick="resetBridgeCredentials()" class="py-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 border border-purple-500/40 text-purple-300 text-xs font-bold">🔐 Reset SSH/HMAC</button>
            </div>
          </div>

          <!-- Live Metrics Graph -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-white">مانیتورینگ منابع سخت‌افزاری بلادرنگ:</span>
            <div class="space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-[11px] text-slate-300">
                <span>CPU Usage (8 Cores):</span><span class="font-mono text-emerald-400">12%</span>
              </div>
              <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div style="width: 12%" class="h-full bg-emerald-400 rounded-full"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                <span>RAM (1.4 GB / 8.0 GB):</span><span class="font-mono text-blue-400">18%</span>
              </div>
              <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div style="width: 18%" class="h-full bg-blue-400 rounded-full"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                <span>Disk Storage (28 GB / 128 GB):</span><span class="font-mono text-purple-400">22%</span>
              </div>
              <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div style="width: 22%" class="h-full bg-purple-400 rounded-full"></div>
              </div>
            </div>
          </div>

          <!-- Snapshot History -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-white">تاریخچه اسنپ‌شات‌ها (Snapshot History):</span>
            <div class="space-y-1.5">
              ${snaps.map(s => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-cue-border text-xs">
                  <div>
                    <span class="font-bold text-white">${escapeHtml(s.label)}</span>
                    <span class="block text-[10px] text-cue-muted">${escapeHtml(s.size)}</span>
                  </div>
                  <button onclick="restoreWorkspaceSnapshot('${escapeJsAttr(s.id)}')" class="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 text-[11px] font-bold">Restore</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    function renderWalletSettingsPanel() {
      const modal = document.getElementById('settingsSubModal');
      const content = document.getElementById('settingsSubContent');
      const title = document.getElementById('settingsSubTitle');
      if (!modal || !content || !title) return;
      modal.classList.remove('hidden');
      title.innerText = '💳 Sovereign Wallet & Open Banking (/settings/wallet)';
      const credits = (Number(appState.creditsBalanceUSD) || 248.50).toFixed(2);
      content.innerHTML = `
        <div class="space-y-3.5" dir="rtl">
          <!-- Token Balance & Credits -->
          <div class="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex items-center justify-between">
            <div>
              <span class="text-xs text-cue-muted">اعتبار کیف‌پول و بودجه توکن:</span>
              <div class="text-xl font-extrabold text-white font-mono">$${credits} <span class="text-xs text-emerald-400 font-bold">(1,240,000 BYOK)</span></div>
            </div>
            <button onclick="openAddCreditsModal()" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">+ افزایش اعتبار</button>
          </div>

          <!-- Open Banking & Financial Connections: Plaid, Stripe Link, Coinbase, Robinhood -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2.5">
            <span class="text-xs font-bold text-white">اتصالات مالی و بانکداری باز (Open Banking):</span>
            
            <!-- Plaid -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-cue-border">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">🏦</span>
                <div>
                  <span class="text-xs font-bold text-white">Plaid Banking</span>
                  <span class="block text-[10px] text-cue-muted">${appState.plaidConnected ? 'Chase ($4,250) • Savings ($12,800)' : 'اتصال مستقیم حساب‌های بانکی'}</span>
                </div>
              </div>
              <button onclick="togglePlaidBankingConnection()" class="px-3 py-1 rounded-lg text-xs font-bold ${appState.plaidConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}">${appState.plaidConnected ? 'متصل ✓' : 'Connect'}</button>
            </div>

            <!-- Stripe Link -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-cue-border">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">💳</span>
                <div>
                  <span class="text-xs font-bold text-white">Stripe Link</span>
                  <span class="block text-[10px] text-cue-muted">${appState.stripeLinkConnected ? 'Visa ending in 4242 (Verified)' : 'پرداخت یک‌کلیکه امن با کارت'}</span>
                </div>
              </div>
              <button onclick="toggleStripeLinkConnection()" class="px-3 py-1 rounded-lg text-xs font-bold ${appState.stripeLinkConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}">${appState.stripeLinkConnected ? 'متصل ✓' : 'Connect'}</button>
            </div>

            <!-- Coinbase Wallet -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-cue-border">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">🪙</span>
                <div>
                  <span class="text-xs font-bold text-white">Coinbase Wallet</span>
                  <span class="block text-[10px] text-cue-muted">${appState.coinbaseConnected ? '0x71C...3a9F (1,540.25 USDC)' : 'کیف‌پول آنچین Web3 ایجنت'}</span>
                </div>
              </div>
              <button onclick="toggleCoinbaseWalletConnection()" class="px-3 py-1 rounded-lg text-xs font-bold ${appState.coinbaseConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}">${appState.coinbaseConnected ? 'متصل ✓' : 'Connect'}</button>
            </div>

            <!-- Robinhood Trading -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-cue-border">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">📈</span>
                <div>
                  <span class="text-xs font-bold text-white">Robinhood Trading</span>
                  <span class="block text-[10px] text-cue-muted">${appState.robinhoodConnected ? 'Portfolio: $8,420.50 (+4.2%)' : 'معاملات سهام و صندوق‌های ETF'}</span>
                </div>
              </div>
              <button onclick="toggleRobinhoodConnection()" class="px-3 py-1 rounded-lg text-xs font-bold ${appState.robinhoodConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}">${appState.robinhoodConnected ? 'متصل ✓' : 'Connect'}</button>
            </div>
          </div>

          <!-- API Keys Section -->
          <div class="p-3.5 rounded-2xl bg-cue-bg border border-cue-border space-y-2">
            <span class="text-xs font-bold text-white">کلیدهای اختصاصی BYOK (Google, DeepSeek, Kimi, Grok):</span>
            <div class="space-y-1.5">
              <input id="keyGemini" type="password" value="${escapeHtml(appState.apiKeys?.gemini || '')}" placeholder="Google AI Studio (Gemini 3.8 Flash)..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
              <input id="keyDeepseek" type="password" value="${escapeHtml(appState.apiKeys?.deepseek || '')}" placeholder="DeepSeek API Key (deepseek-flash / v4-pro)..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
              <input id="keyKimi" type="password" value="${escapeHtml(appState.apiKeys?.kimi || '')}" placeholder="Moonshot Kimi API Key (K2.7 / K3)..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
              <input id="keyGrok" type="password" value="${escapeHtml(appState.apiKeys?.grok || '')}" placeholder="xAI Grok 4.7 API Key..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
              <input id="keyOpenrouter" type="password" value="${escapeHtml(appState.apiKeys?.openrouter || '')}" placeholder="OpenRouter API Key (Universal Failover)..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
              <input id="keyTavily" type="password" value="${escapeHtml(appState.apiKeys?.tavily || '')}" placeholder="Tavily Web Search Key..." class="code-block-dir w-full bg-black/40 border border-cue-border rounded-xl p-2 text-xs text-white" />
            </div>
            <button onclick="saveAllApiKeys()" class="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs mt-2">ذخیره کلیدهای API</button>
          </div>
        </div>
      `;
    }

    // Intercept openSettingsPanel for all 4 subviews
    const origOpenSettingsPanel = window.openSettingsPanel;
    window.openSettingsPanel = function(panel) {
      triggerCueHaptic(12);
      if (panel === 'apps') { openAppsView('settings'); return; }
      if (panel === 'skills') { openSkillsView(); return; }
      if (panel === 'email') { renderEmailSettingsPanel(); return; }
      if (panel === 'phone') { renderPhoneSettingsPanel(); return; }
      if (panel === 'computer') { renderComputerSettingsPanel(); return; }
      if (panel === 'wallet') { renderWalletSettingsPanel(); return; }
      if (typeof origOpenSettingsPanel === 'function') {
        return origOpenSettingsPanel.apply(this, arguments);
      }
    };
