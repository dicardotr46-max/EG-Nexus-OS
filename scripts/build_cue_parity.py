#!/usr/bin/env python3
"""Build and inject Cue v26.18.15 parity into index.html."""

import json
import re
import sys
from pathlib import Path

def inner_svg(s: str) -> str:
    """Extract inner elements from SVG string for clean nesting."""
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'<!DOCTYPE[^>]*>', '', s)
    s = re.sub(r'^\s*<svg[^>]*>', '', s, flags=re.S)
    s = re.sub(r'</svg>\s*$', '', s, flags=re.S)
    return s.strip()

def build_parity(target_html_path: Path):
    root_dir = Path(__file__).resolve().parent.parent
    vectors_path = root_dir / 'scripts' / 'cue_avatar_vectors.json'
    parity_module_path = root_dir / 'scripts' / 'cue_parity_module.js'
    
    with open(vectors_path, 'r', encoding='utf-8') as f:
        vectors_data = json.load(f)
        
    shapes_dict = {k: inner_svg(v) for k, v in vectors_data['shapes'].items()}
    faces_dict = {k: inner_svg(v) for k, v in vectors_data['faces'].items()}
    faces_white_dict = {k: inner_svg(v) for k, v in vectors_data['faces_white'].items()}

    shapes_json = json.dumps(shapes_dict)
    faces_json = json.dumps(faces_dict)
    faces_white_json = json.dumps(faces_white_dict)

    with open(parity_module_path, 'r', encoding='utf-8') as f:
        parity_js = f.read()

    parity_js = parity_js.replace('__SHAPES_JSON__', shapes_json)
    parity_js = parity_js.replace('__FACES_JSON__', faces_json)
    parity_js = parity_js.replace('__FACES_WHITE_JSON__', faces_white_json)

    with open(target_html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    print(f"Read target HTML ({target_html_path.name}): {len(html)} chars, {html.count(chr(10))} lines")

    # =========================================================================
    # 1. Forui Dark Design Tokens in :root CSS & Body Styling
    # =========================================================================
    old_css_root = """:root { --sa-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); --sa-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); --sa-left: env(safe-area-inset-left, 0px); --sa-right: env(safe-area-inset-right, 0px); }"""
    
    new_css_root = """:root {
  --cue-bg: #090a0c;
  --cue-card: #121316;
  --cue-card-hover: #181a1f;
  --cue-border: rgba(255, 255, 255, 0.06);
  --cue-accent: #2563eb;
  --cue-muted: #8e929b;
  --sa-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  --sa-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  --sa-left: env(safe-area-inset-left, 0px);
  --sa-right: env(safe-area-inset-right, 0px);
}
.bg-cue-bg { background-color: var(--cue-bg) !important; }
.bg-cue-card { background-color: var(--cue-card) !important; }
.hover\\:bg-cue-cardHover:hover { background-color: var(--cue-card-hover) !important; }
.border-cue-border { border-color: var(--cue-border) !important; }
.text-cue-muted { color: var(--cue-muted) !important; }
.text-cue-accent { color: var(--cue-accent) !important; }
.bg-cue-accent { background-color: var(--cue-accent) !important; }"""

    if old_css_root in html:
        html = html.replace(old_css_root, new_css_root, 1)
        print("Updated :root CSS variables and utility classes.")

    html = re.sub(r'html,\s*body\s*\{\s*min-height:\s*100%;\s*background:\s*#0b0b0e;\s*\}',
                  'html, body { min-height: 100%; background: var(--cue-bg, #090a0c); }',
                  html)

    # =========================================================================
    # 2. Home Header '+' Menu (Exact Cue 3-part menu)
    # =========================================================================
    html = re.sub(r'onclick="togglePlusMenu\(event\)"',
                  'onclick="togglePlusMenu(event);triggerCueHaptic(15);"',
                  html, count=1)

    old_plus_menu_pattern = re.compile(r'<!-- Floating \+ Menu[^>]*>.*?<div id="plusFloatingMenu"[^>]*>.*?</div>', re.S)
    new_plus_menu = """<!-- Floating + Menu (Exact Cue 3-Part Create Popup) -->
      <div id="plusFloatingMenu" class="hidden absolute right-0 top-12 w-56 bg-cue-card border border-cue-border rounded-3xl shadow-2xl py-2 z-50" dir="ltr">
        <button onclick="openAgentCreateModal()" class="w-full px-4 py-3 flex items-center gap-3.5 text-left text-sm font-medium text-white hover:bg-white/5 transition">
          <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 3v3"/>
          </svg>
          <span>Agent</span>
        </button>
        <button onclick="openScanCreateModal()" class="w-full px-4 py-3 flex items-center gap-3.5 text-left text-sm font-medium text-white hover:bg-white/5 transition">
          <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path d="M4 7V5a1 1 0 011-1h2M18 4h2a1 1 0 011 1v2M4 17v2a1 1 0 001 1h2M18 20h2a1 1 0 001-1v-2"/><circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Scan &amp; create</span>
        </button>
        <button onclick="openGroupChatCreateModal()" class="w-full px-4 py-3 flex items-center gap-3.5 text-left text-sm font-medium text-white hover:bg-white/5 transition">
          <span class="w-5 text-center text-lg font-bold text-slate-300">#</span>
          <span>Group Chat</span>
        </button>
      </div>"""

    if old_plus_menu_pattern.search(html):
        html = old_plus_menu_pattern.sub(new_plus_menu, html, count=1)
        print("Updated plusFloatingMenu to exact Cue 3-part popup.")

    # =========================================================================
    # 3. Home Search Box with Connect Apps Showcase & Categories
    # =========================================================================
    old_search_box = """    <!-- Collapsible Home Search Bar -->
    <div id="homeSearchBox" class="hidden mb-3">
      <input id="homeSearchInput" oninput="renderHomeChatList()" type="text" placeholder="Search agents or group chats..." class="w-full bg-cue-card border border-cue-border rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
    </div>"""

    new_search_box = """    <!-- Collapsible Home Search Bar & Connect Apps Showcase (Exact Cue Parity) -->
    <div id="homeSearchBox" class="hidden mb-3.5 space-y-2.5" dir="ltr">
      <div class="relative">
        <input id="homeSearchInput" oninput="handleHomeSearchInput(this.value)" type="text" placeholder="Search tasks, agents, or apps..." class="w-full bg-cue-card border border-cue-border rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500" />
        <svg class="w-4 h-4 text-cue-muted absolute left-3.5 top-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/></svg>
      </div>
      <!-- Category filter tabs in Search: Added apps, Recommended, Health, Finance, Travel, Productivity -->
      <div id="searchCategoryBar" class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button onclick="selectSearchCategory('Added apps')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-white text-black whitespace-nowrap">Added apps</button>
        <button onclick="selectSearchCategory('Recommended')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap">Recommended</button>
        <button onclick="selectSearchCategory('Health')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap">Health</button>
        <button onclick="selectSearchCategory('Finance')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap">Finance</button>
        <button onclick="selectSearchCategory('Travel')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap">Travel</button>
        <button onclick="selectSearchCategory('Productivity')" class="px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap">Productivity</button>
      </div>
      <div id="homeSearchAppsShowcase" class="space-y-1.5 max-h-48 overflow-y-auto"></div>
    </div>"""

    if old_search_box in html:
        html = html.replace(old_search_box, new_search_box, 1)
        print("Updated homeSearchBox with category bar and connect apps showcase.")

    # =========================================================================
    # 4. Chat Toolbar: Speed/Quality Mode Switch & Join Queue Button
    # =========================================================================
    old_chat_mode_toolbar_pattern = re.compile(
        r'<!-- Mode Bar Slot.*?</div>\s*(?=<!-- Bottom Input Pill)',
        re.S
    )

    new_chat_mode_toolbar = """<!-- Mode Bar Slot with Speed/Quality Toggle and Join Queue (Exact Cue Parity) -->
    <div id="chatModeToolbar" class="px-3.5 pt-1.5 pb-1 flex items-center justify-between gap-2 text-[11px] text-cue-muted" dir="ltr">
      <div class="flex items-center gap-1.5" id="phase2ModePillsSlot">
        <!-- Dual Effort Mode Switch Button: Speed Mode vs Quality Mode -->
        <button id="effortModeSwitchBtn" onclick="toggleEffortSpeedQualityMode()" title="Toggle Speed / Quality Effort Mode" class="px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 font-bold transition flex items-center gap-1">
          <span id="effortModeSwitchIcon">⚡</span>
          <span id="effortModeSwitchLabel">Speed Mode</span>
        </button>
        <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium" id="activeDiffBadge">Diff-Only ON</span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- Join Queue Button with authentic chat_input_join_queue vector -->
        <button id="chat_input_join_queue" onclick="joinChatTaskQueue()" title="Join Queue" class="px-2.5 py-0.5 rounded-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-bold flex items-center gap-1.5 transition">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" class="shrink-0">
            <path d="M3 10H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 5.33398H10.6667" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.66406 11.666L7.66406 13.666L9.66406 15.666" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14.999 4.33268V12.3327C14.999 12.6863 14.8585 13.0254 14.6085 13.2755C14.3584 13.5255 14.0193 13.666 13.6656 13.666H8.66565" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Join Queue</span>
        </button>
        <button id="stopOrchestratorBtn" onclick="stopActiveOrchestration()" class="hidden px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">⏹ Stop</button>
      </div>
    </div>
    """

    if old_chat_mode_toolbar_pattern.search(html):
        html = old_chat_mode_toolbar_pattern.sub(new_chat_mode_toolbar, html, count=1)
        print("Updated chatModeToolbar with Speed/Quality switch and Join Queue.")

    # =========================================================================
    # 5. Dual Chat Input (Hold to speak, tap to type) & Wave indicator
    # =========================================================================
    old_chat_input_pattern = re.compile(
        r'<!-- Bottom Input Pill.*?</div>\s*</div>\s*(?=</section>)',
        re.S
    )

    new_chat_input_bar = """<!-- Bottom Dual Input Pill: Hold to speak, tap to type (Exact Cue Parity) -->
    <div id="chatInputBar" class="p-3 bg-cue-bg" dir="ltr">
      <!-- Live Audio Wave Indicator during long-press hold recording -->
      <div id="voiceRecordingWaveBar" class="hidden mb-2 px-4 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs text-rose-200 backdrop-blur">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
          <span class="font-bold">Hold to speak active...</span>
          <div class="flex items-center gap-1 h-4 px-2">
            <span class="w-1 bg-rose-400 rounded-full animate-bounce h-3"></span>
            <span class="w-1 bg-rose-400 rounded-full animate-bounce h-4" style="animation-delay: 0.1s"></span>
            <span class="w-1 bg-rose-400 rounded-full animate-bounce h-2" style="animation-delay: 0.2s"></span>
            <span class="w-1 bg-rose-400 rounded-full animate-bounce h-4" style="animation-delay: 0.3s"></span>
            <span class="w-1 bg-rose-400 rounded-full animate-bounce h-3" style="animation-delay: 0.15s"></span>
          </div>
          <span id="voiceRecordTimer" class="font-mono text-[11px] text-rose-300">00:03</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="cancelVoiceRecording()" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold">Cancel</button>
          <button onclick="commitVoiceRecording()" class="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px]">Send Voice</button>
        </div>
      </div>
      <div class="flex items-center gap-2 bg-[#181820] border border-white/10 rounded-full px-3.5 py-2">
        <label class="cursor-pointer text-slate-300 hover:text-white p-1">
          <input id="chatFileInput" type="file" multiple class="hidden" onchange="handleChatFileUpload(event)" />
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
        </label>
        <input id="chatInput" type="text" dir="auto" placeholder="Hold to speak, tap to type"
          onpointerdown="handleChatInputPointerDown(event)"
          onpointerup="handleChatInputPointerUp(event)"
          onpointercancel="handleChatInputPointerCancel(event)"
          oninput="saveActiveChatDraft(this.value)"
          onkeydown="if(event.key==='Enter')sendUserMessage()"
          class="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none" />
        <button id="voiceMicBtn" onclick="toggleVoiceInputPlaceholder()" class="text-slate-300 hover:text-white p-1" title="Voice Input">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
            <rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/>
          </svg>
        </button>
        <button onclick="sendUserMessage()" class="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  """

    if old_chat_input_pattern.search(html):
        html = old_chat_input_pattern.sub(new_chat_input_bar, html, count=1)
        print("Updated chatInputBar with dual input and audio wave indicator.")

    # =========================================================================
    # 6. Settings Redesign (Ali, Plus, Upgrade, Weekly Usage with progress bar, 6 cards)
    # =========================================================================
    old_view_settings_pattern = re.compile(
        r'<section id="view-settings"[^>]*>.*?</section>',
        re.S
    )

    new_view_settings = """<section id="view-settings" class="hidden flex-1 flex flex-col max-w-md mx-auto w-full min-h-screen px-4 pt-4 pb-10" dir="ltr">
    <header class="flex items-center justify-between mb-4">
      <button onclick="showView('view-home')" aria-label="بازگشت به خانه" class="w-10 h-10 rounded-full bg-cue-card border border-cue-border flex items-center justify-center text-slate-200 hover:bg-cue-cardHover transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <h1 class="text-base font-bold text-white">Settings</h1>
      <div class="w-10"></div>
    </header>

    <!-- Top User Profile Card: Ali, Plus Badge, Upgrade Button -->
    <div class="bg-cue-card border border-cue-border rounded-3xl p-4 flex items-center justify-between mb-3.5">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-orange-400 shadow-inner flex items-center justify-center text-black font-extrabold text-base">A</div>
        <div>
          <div class="flex items-center gap-2">
            <span id="profileNameDisplay" class="text-base font-bold text-white">Ali</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold uppercase tracking-wider">Plus</span>
          </div>
          <div class="text-xs text-cue-muted">Dream Profile &amp; Long-Term Memory</div>
        </div>
      </div>
      <button onclick="openUpgradeModal()" class="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition">Upgrade</button>
    </div>

    <!-- Weekly Usage Card with Live Progress Bar (1% left / getWeeklyUsageQuota(), Reset in X days) -->
    <div onclick="openWeeklyUsageDetails()" role="button" tabindex="0" aria-label="سهمیه هفتگی و میزان مصرف" class="bg-cue-card border border-cue-border rounded-3xl p-4 mb-3.5 cursor-pointer hover:bg-cue-cardHover transition">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-extrabold text-white">Weekly Usage</span>
        <span id="settingsWeeklyLeftBadge" class="text-xs font-bold text-emerald-400 font-mono">1% left</span>
      </div>
      <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
        <div id="settingsWeeklyProgressBar" style="width: 1%" class="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-300"></div>
      </div>
      <div class="flex items-center justify-between text-[11px] text-cue-muted">
        <span id="settingsWeeklyQuotaText">12,500 / 1,000,000 tokens used</span>
        <span id="settingsWeeklyResetText" class="text-slate-300 font-medium">Reset in 5 days</span>
      </div>
    </div>

    <!-- 6 Core Settings Cards in Grid/List: Apps, Skills, Email, Phone, Computer, Wallet -->
    <div class="bg-cue-card border border-cue-border rounded-3xl divide-y divide-white/[0.06] overflow-hidden mb-3.5">
      <!-- 1. Apps -->
      <button onclick="openAppsView('settings')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-base">📦</div>
          <span class="text-sm font-medium text-white">Apps</span>
        </div>
        <div class="flex items-center gap-2">
          <span id="settingsAppsCountBadge" class="text-xs text-cue-muted">0 added</span>
          <span class="text-slate-400">›</span>
        </div>
      </button>

      <!-- 2. Skills -->
      <button onclick="openSkillsView()" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-base">🧩</div>
          <span class="text-sm font-medium text-white">Skills</span>
        </div>
        <span class="text-slate-400">›</span>
      </button>

      <!-- 3. Email -->
      <button onclick="openSettingsPanel('email')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-base">✉️</div>
          <span class="text-sm font-medium text-white">Email</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-cue-muted font-mono">agent@nexus.local</span>
          <span class="text-slate-400">›</span>
        </div>
      </button>

      <!-- 4. Phone -->
      <button onclick="openSettingsPanel('phone')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center text-base">📱</div>
          <span class="text-sm font-medium text-white">Phone</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-cue-muted font-mono">+1 (555) 019-CUE</span>
          <span class="text-slate-400">›</span>
        </div>
      </button>

      <!-- 5. Computer -->
      <button onclick="openSettingsPanel('computer')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-base">🖥️</div>
          <span class="text-sm font-medium text-white">Computer</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">RUNNING</span>
          <span class="text-slate-400">›</span>
        </div>
      </button>

      <!-- 6. Wallet -->
      <button onclick="openSettingsPanel('wallet')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-base">💳</div>
          <span class="text-sm font-medium text-white">Wallet &amp; API Keys</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-cue-muted font-mono">$248.50</span>
          <span class="text-slate-400">›</span>
        </div>
      </button>
    </div>

    <!-- Self-Review, Backup & Cache -->
    <div class="bg-cue-card border border-cue-border rounded-3xl divide-y divide-white/[0.06] overflow-hidden mb-3.5">
      <button onclick="openSettingsPanel('diagnostics')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <span class="text-lg">🛡️</span>
          <span class="text-sm font-medium text-white">Self-Review &amp; Diagnostics</span>
        </div>
        <span class="text-xs text-emerald-400 font-bold">Active ›</span>
      </button>
      <button onclick="openSettingsPanel('backup')" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <span class="text-lg">💾</span>
          <span class="text-sm font-medium text-white">Backup &amp; 5-Phase Roadmap</span>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button onclick="clearAppTempCache()" class="w-full px-4 py-3.5 flex items-center justify-between hover:bg-cue-cardHover transition">
        <div class="flex items-center gap-3.5">
          <span class="text-lg">🧹</span>
          <span class="text-sm font-medium text-white">Clear cache</span>
        </div>
        <span id="cacheSizeLabel" class="text-xs text-cue-muted">0.0 KB ›</span>
      </button>
    </div>

    <!-- Footer Version Card -->
    <div class="bg-cue-card border border-cue-border rounded-3xl overflow-hidden">
      <div class="px-4 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-3.5">
          <span class="text-lg">✳️</span>
          <span class="text-sm font-medium text-white">Version</span>
        </div>
        <span class="text-xs text-cue-muted font-mono">v26.18.15 (100% Cue Parity)</span>
      </div>
    </div>
  </section>"""

    if old_view_settings_pattern.search(html):
        html = old_view_settings_pattern.sub(new_view_settings, html, count=1)
        print("Replaced view-settings with updated Cue structure.")

    # =========================================================================
    # 7. Avatar Customizer Modal (cueAvatarCustomizerModal)
    # =========================================================================
    old_change_avatar_modal_pattern = re.compile(
        r'<!-- Change Avatar Modal.*?<div id="changeAvatarModal".*?(?=<!-- Create Group Chat Modal)',
        re.S
    )

    new_avatar_customizer_modal = """<!-- Avatar Customizer Modal (Exact Cue 26.18.15 Parity: 10 Shapes, 10 Faces, Color Swatches) -->
  <div id="cueAvatarCustomizerModal" class="hidden fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
    <div class="bg-cue-card border border-cue-border rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4" dir="ltr">
      <!-- Header: Cancel (left), Change Avatar (title), Confirm (right) -->
      <div class="flex items-center justify-between border-b border-cue-border pb-3">
        <button onclick="closeCueAvatarCustomizerModal()" class="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300">Cancel</button>
        <h3 class="text-sm font-bold text-white tracking-wide">Change Avatar</h3>
        <button onclick="confirmCueAvatarCustomizerModal()" class="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg">Confirm</button>
      </div>
      <!-- Center preview displaying live composite avatar -->
      <div class="flex flex-col items-center pt-1 relative">
        <div id="avatarModalLivePreview" class="p-2 transition transform hover:scale-105"></div>
        <!-- Color Swatch Selector: Gold, Blue, Purple, Emerald, Rose, Slate -->
        <div id="cueColorSwatchesContainer" class="flex items-center gap-2.5 mt-3 px-3 py-1.5 rounded-full bg-black/40 border border-cue-border"></div>
      </div>
      <!-- Section label: 10 Shapes (Shape 1..10) -->
      <div class="flex items-center justify-between text-[11px] text-cue-muted px-1 font-semibold uppercase tracking-wider">
        <span>Shapes (1-10)</span>
        <span id="activeShapeLabel" class="text-blue-400 capitalize">Square</span>
      </div>
      <div id="avatarShapesGrid" class="grid grid-cols-5 gap-2 justify-items-center"></div>
      <!-- Section label: 10 Faces (Face 1..10) -->
      <div class="flex items-center justify-between text-[11px] text-cue-muted px-1 font-semibold uppercase tracking-wider pt-1">
        <span>Faces (1-10)</span>
        <span id="activeFaceLabel" class="text-blue-400 capitalize">Wink</span>
      </div>
      <div id="avatarFacesGrid" class="grid grid-cols-5 gap-2 justify-items-center pb-2"></div>
    </div>
  </div>
  <!-- Keep changeAvatarModal alias container -->
  <div id="changeAvatarModal" class="hidden"></div>
  """

    if old_change_avatar_modal_pattern.search(html):
        html = old_change_avatar_modal_pattern.sub(new_avatar_customizer_modal, html, count=1)
        print("Replaced changeAvatarModal with cueAvatarCustomizerModal.")

    html = html.replace('onclick="openChangeAvatarModal(\'create\')"', 'onclick="openCueAvatarCustomizerModal(\'create\')"')
    html = html.replace('onclick="openChangeAvatarModal(\'edit\')"', 'onclick="openCueAvatarCustomizerModal(\'edit\')"')

    # =========================================================================
    # 8. Additional Parity Modals: Upgrade, Weekly Usage, Health Connect, Budget
    # =========================================================================
    additional_modals = """
  <!-- 1. Subscription Upgrade Modal (Plus to Pro Max) -->
  <div id="upgradeModal" class="hidden fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
    <div class="bg-cue-card border border-cue-border rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4" dir="ltr">
      <div class="flex items-center justify-between border-b border-cue-border pb-2.5">
        <h3 class="text-sm font-extrabold text-white">Upgrade Subscription</h3>
        <button onclick="closeUpgradeModal()" class="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center">✕</button>
      </div>
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-base font-bold text-white">Nexus Pro Max Tier</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">$20 / mo</span>
        </div>
        <p class="text-xs text-slate-300">Unlimited BYOK token routing, 8,192 reasoning token budget, dedicated Cloud PC workstation, and multi-agent group chats.</p>
      </div>
      <div class="space-y-1.5 text-xs text-slate-300">
        <div class="flex items-center gap-2"><span class="text-emerald-400 font-bold">✓</span><span>100% Sovereign Cloud PC with full SSH root access</span></div>
        <div class="flex items-center gap-2"><span class="text-emerald-400 font-bold">✓</span><span>Dedicated Agent Email &amp; Virtual Phone allocation</span></div>
        <div class="flex items-center gap-2"><span class="text-emerald-400 font-bold">✓</span><span>Zero task queue delay &amp; priority scheduling</span></div>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="closeUpgradeModal()" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold">Cancel</button>
        <button onclick="confirmSubscriptionUpgrade()" class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">Upgrade Now</button>
      </div>
    </div>
  </div>

  <!-- 2. Weekly Usage Quota Breakdown Modal -->
  <div id="weeklyUsageModal" class="hidden fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
    <div class="bg-cue-card border border-cue-border rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4" dir="ltr">
      <div class="flex items-center justify-between border-b border-cue-border pb-2.5">
        <h3 class="text-sm font-extrabold text-white">Weekly Usage Quota</h3>
        <button onclick="closeWeeklyUsageModal()" class="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center">✕</button>
      </div>
      <div class="p-3.5 rounded-2xl bg-black/40 border border-cue-border space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-300">
          <span>Weekly Rolling Budget:</span>
          <span class="font-mono text-white font-bold">1,000,000 tokens</span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-300">
          <span>Consumed This Week:</span>
          <span id="modalWeeklyUsedTokens" class="font-mono text-emerald-400 font-bold">12,500 tokens (1%)</span>
        </div>
        <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden my-1">
          <div style="width: 1%" class="h-full bg-emerald-400 rounded-full"></div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-cue-muted">
          <span>Quota Refills:</span>
          <span class="text-blue-400 font-medium">Every Monday (Reset in 5 days)</span>
        </div>
      </div>
      <button onclick="closeWeeklyUsageModal()" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">Got it</button>
    </div>
  </div>

  <!-- 3. Health Connect Biometric Dashboard Modal -->
  <div id="healthConnectModal" class="hidden fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
    <div class="bg-cue-card border border-cue-border rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto" dir="ltr">
      <div class="flex items-center justify-between border-b border-cue-border pb-2.5">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">❤️</div>
          <div>
            <h3 class="text-sm font-bold text-white">Google Health (Health Connect)</h3>
            <span class="text-[10px] text-emerald-400 font-medium">54 Permissions Active • Synchronized</span>
          </div>
        </div>
        <button onclick="closeHealthConnectDashboard()" class="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center">✕</button>
      </div>
      <!-- 5 Biometric Metrics Cards -->
      <div class="grid grid-cols-2 gap-2.5">
        <!-- Metric 1: Sleep -->
        <div class="p-3 rounded-2xl bg-black/40 border border-cue-border space-y-1">
          <span class="text-[10px] text-cue-muted uppercase tracking-wider font-semibold">Sleep Duration</span>
          <div class="text-lg font-extrabold text-white">7h 42m</div>
          <div class="text-[10px] text-blue-400">Deep: 1h 50m • REM: 2h 10m</div>
        </div>
        <!-- Metric 2: Resting Heart Rate -->
        <div class="p-3 rounded-2xl bg-black/40 border border-cue-border space-y-1">
          <span class="text-[10px] text-cue-muted uppercase tracking-wider font-semibold">Resting HR</span>
          <div class="text-lg font-extrabold text-rose-400">62 <span class="text-xs text-cue-muted font-normal">bpm</span></div>
          <div class="text-[10px] text-emerald-400">Normal Range (54 - 78)</div>
        </div>
        <!-- Metric 3: Blood Oxygen SpO2 -->
        <div class="p-3 rounded-2xl bg-black/40 border border-cue-border space-y-1">
          <span class="text-[10px] text-cue-muted uppercase tracking-wider font-semibold">Blood Oxygen (SpO2)</span>
          <div class="text-lg font-extrabold text-cyan-400">98%</div>
          <div class="text-[10px] text-emerald-400">Optimal (95% - 100%)</div>
        </div>
        <!-- Metric 4: Daily Steps -->
        <div class="p-3 rounded-2xl bg-black/40 border border-cue-border space-y-1">
          <span class="text-[10px] text-cue-muted uppercase tracking-wider font-semibold">Steps Today</span>
          <div class="text-lg font-extrabold text-amber-400">8,420</div>
          <div class="text-[10px] text-slate-300">Goal: 10,000 (84%)</div>
        </div>
      </div>
      <!-- Metric 5: Active Calories -->
      <div class="p-3 rounded-2xl bg-black/40 border border-cue-border flex items-center justify-between">
        <div>
          <span class="text-[10px] text-cue-muted uppercase tracking-wider font-semibold">Total Calories Burned</span>
          <div class="text-xl font-extrabold text-emerald-400">2,180 <span class="text-xs text-cue-muted font-normal">kcal</span></div>
        </div>
        <div class="text-right text-[11px] text-slate-300">
          <div>Active: 620 kcal</div>
          <div class="text-cue-muted">Resting: 1,560 kcal</div>
        </div>
      </div>
      <div class="flex gap-2 pt-1">
        <button onclick="syncHealthConnectData()" class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition">Sync Health Data</button>
        <button onclick="manageHealthPermissions()" class="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition">Permissions</button>
      </div>
    </div>
  </div>

  <!-- 4. Quality Mode Reasoning Budget Confirmation Modal -->
  <div id="confirmSwitchToQualityModeModal" class="hidden fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
    <div class="bg-cue-card border border-cue-border rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4" dir="ltr">
      <div class="flex items-center justify-between border-b border-cue-border pb-2.5">
        <h3 class="text-sm font-extrabold text-white">Switch to Quality Mode</h3>
        <button onclick="cancelQualityModeSwitch()" class="w-8 h-8 rounded-full bg-white/5 text-slate-300 flex items-center justify-center">✕</button>
      </div>
      <div class="p-3.5 rounded-2xl bg-purple-950/25 border border-purple-500/30 space-y-1.5 text-xs text-purple-200">
        <div class="font-bold text-white text-sm">🧠 Deep Reasoning Mode (8,192 Thinking Budget)</div>
        <p class="text-slate-300">Quality Mode activates high-effort thinking tokens for complex architectural code, mathematical proofs, and deep audits. This expends higher token budget per request.</p>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="cancelQualityModeSwitch()" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold">Keep Speed Mode</button>
        <button onclick="confirmQualityModeSwitch()" class="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">Confirm &amp; Enable</button>
      </div>
    </div>
  </div>
"""
    if 'id="upgradeModal"' not in html:
        html = html.replace('</body>', additional_modals + '\n</body>', 1)
        print("Injected additional modals: upgradeModal, weeklyUsageModal, healthConnectModal, confirmSwitchToQualityModeModal.")

    # =========================================================================
    # 9. Inject JavaScript Module in <script id="nexus-main-script">
    # =========================================================================
    phase2_marker = "// === [محل قرارگیری خودکار ماژول‌های فاز ۲، فاز ۳، فاز ۴ و فاز ۵ در زیر این خط] ==="
    if phase2_marker in html:
        html = html.replace(phase2_marker, parity_js + "\n    " + phase2_marker, 1)
        print("Injected Cue Parity JavaScript logic before Phase 2 marker.")
    else:
        print("ERROR: phase2_marker not found!")

    # =========================================================================
    # 10. Update Apps Directory Categories & Apps Catalog
    # =========================================================================
    old_render_cats = """    function renderAppsCategories() {
      const cats = ['All', 'Health', 'Finance', 'Travel', 'Productivity', 'Creative', 'Dev & AI'];
      const bar = document.getElementById('appsCategoryBar');
      if (!bar) return;
      bar.innerHTML = cats.map(c => `
        <button onclick="uiState.activeAppsCategory='${c}';renderAppsCategories();renderAppsCatalog()" class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${uiState.activeAppsCategory === c ? 'bg-[#262632] text-white' : 'text-cue-muted hover:text-white'}">${c}</button>
      `).join('');
    }"""

    new_render_cats = """    function renderAppsCategories() {
      const cats = ['Added apps', 'Recommended', 'Health', 'Finance', 'Travel', 'Productivity'];
      const bar = document.getElementById('appsCategoryBar');
      if (!bar) return;
      if (!uiState.activeAppsCategory) uiState.activeAppsCategory = 'Recommended';
      bar.innerHTML = cats.map(c => {
        const isSel = (uiState.activeAppsCategory === c) || (c === 'Added apps' && uiState.activeAppsViewMode === 'added');
        return `
          <button onclick="selectAppsCategory('${c}')" class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${isSel ? 'bg-white text-black' : 'bg-cue-card border border-cue-border text-cue-muted hover:text-white'}">${c}</button>
        `;
      }).join('');
    }

    function selectAppsCategory(cat) {
      triggerCueHaptic(10);
      if (cat === 'Added apps') {
        uiState.activeAppsViewMode = 'added';
        uiState.activeAppsCategory = 'Added apps';
      } else {
        uiState.activeAppsViewMode = 'catalog';
        uiState.activeAppsCategory = cat;
      }
      renderAppsCategories();
      renderAppsCatalog();
    }
    window.selectAppsCategory = selectAppsCategory;"""

    if old_render_cats in html:
        html = html.replace(old_render_cats, new_render_cats, 1)
        print("Updated renderAppsCategories with exact Cue categories.")

    # Update renderAppsCatalog filtering for 'Recommended'
    old_catalog_filter = """        if (uiState.activeAppsCategory !== 'All') {
          list = list.filter(a => a.category === uiState.activeAppsCategory);
        }"""
    new_catalog_filter = """        if (uiState.activeAppsCategory === 'Recommended') {
          const recIds = new Set(['google_health', 'oura', 'outlook_mail', 'outlook_cal', 'notion', 'plaid', 'stripe', 'coinbase', 'robinhood']);
          list = list.filter(a => recIds.has(a.id) || a.recommended);
        } else if (uiState.activeAppsCategory !== 'All' && uiState.activeAppsCategory !== 'Added apps') {
          list = list.filter(a => a.category === uiState.activeAppsCategory);
        }"""

    if old_catalog_filter in html:
        html = html.replace(old_catalog_filter, new_catalog_filter, 1)
        print("Updated renderAppsCatalog to handle Recommended category.")

    # Update Google Health name and Stripe Link in APPS_CATALOG
    html = html.replace("{ id: 'google_health', name: 'Google Health',", "{ id: 'google_health', name: 'Google Health (Health Connect)', recommended: true,")
    html = html.replace("{ id: 'stripe', name: 'Stripe',", "{ id: 'stripe', name: 'Stripe Link', recommended: true,")
    html = html.replace("{ id: 'oura', name: 'Oura',", "{ id: 'oura', name: 'Oura', recommended: true,")
    html = html.replace("{ id: 'outlook_mail', name: 'Outlook Mail',", "{ id: 'outlook_mail', name: 'Outlook Mail', recommended: true,")
    html = html.replace("{ id: 'outlook_cal', name: 'Outlook Calendar',", "{ id: 'outlook_cal', name: 'Outlook Calendar', recommended: true,")
    html = html.replace("{ id: 'notion', name: 'Notion',", "{ id: 'notion', name: 'Notion', recommended: true,")
    html = html.replace("{ id: 'plaid', name: 'Plaid',", "{ id: 'plaid', name: 'Plaid', recommended: true,")
    html = html.replace("{ id: 'coinbase', name: 'Coinbase Wallet',", "{ id: 'coinbase', name: 'Coinbase Wallet', recommended: true,")
    html = html.replace("{ id: 'robinhood', name: 'Robinhood Trading',", "{ id: 'robinhood', name: 'Robinhood', recommended: true,")

    # In openAppDetailView: if appId === 'google_health', open Health Connect dashboard
    old_detail_head = """    function openAppDetailView(appId) {
      const app = APPS_CATALOG.find(a => a.id === appId);
      if (!app) return;"""

    new_detail_head = """    function openAppDetailView(appId) {
      triggerCueHaptic(10);
      if (appId === 'google_health') {
        openHealthConnectDashboard();
      }
      const app = APPS_CATALOG.find(a => a.id === appId);
      if (!app) return;"""

    if old_detail_head in html:
        html = html.replace(old_detail_head, new_detail_head, 1)
        print("Updated openAppDetailView for google_health.")

    # =========================================================================
    # 11. Overlapping Group Chat Avatars in renderChatHeader & buildAvatarSVG
    # =========================================================================
    old_render_chat_header = """      if (chat.isGroup) {
        avBox.innerHTML = buildGroupClusterSVG(chat.memberIds, 48);
      } else {"""

    new_render_chat_header = """      if (chat.isGroup) {
        const count = Array.isArray(chat.memberIds) ? chat.memberIds.length : 0;
        document.getElementById('chatHeaderTitle').innerText = chat.title || `New Group Chat (${count})`;
        avBox.innerHTML = `
          <div id="agentAvatarOverlapContainer" class="flex items-center -space-x-2.5 hover:space-x-0.5 transition-all">
            ${(chat.memberIds || []).slice(0, 5).map(id => {
              const mem = (appState.agentsCatalog || []).find(a => a && a.id === id);
              return `<div class="rounded-full ring-2 ring-[#090a0c] bg-cue-card shrink-0">${buildAvatarSVG(mem?.avatar, 34)}</div>`;
            }).join('')}
            ${(chat.memberIds || []).length > 5 ? `<div class="w-7 h-7 rounded-full bg-cue-card border border-cue-border text-[10px] font-bold text-slate-300 flex items-center justify-center ring-2 ring-[#090a0c]">+${(chat.memberIds || []).length - 5}</div>` : ''}
          </div>
        `;
      } else {"""

    if old_render_chat_header in html:
        html = html.replace(old_render_chat_header, new_render_chat_header, 1)
        print("Updated renderChatHeader with agentAvatarOverlapContainer.")

    # Also update buildAvatarSVG to use Cue vectors with expression override
    old_build_avatar_svg = """    function buildAvatarSVG(avatar, sizePx = 48) {
      const safeAv = sanitizeAvatarSpec(avatar);
      const safeSize = Math.max(12, Math.min(256, Math.round(Number(sizePx) || 48)));
      return `<svg width="${safeSize}" height="${safeSize}" viewBox="0 0 100 100" class="shrink-0 select-none avatar-svg" aria-hidden="true" style="width:${safeSize}px;height:${safeSize}px">
        <g fill="${safeAv.color}">${getBodyShapePath(safeAv.shape)}</g>
        <g>${getFaceFeaturesSVG(safeAv.face, false)}</g>
      </svg>`;
    }"""

    new_build_avatar_svg = """    function buildAvatarSVG(avatar, sizePx = 48, expressionOverride = null) {
      const safeAv = sanitizeAvatarSpec(avatar);
      const safeSize = Math.max(12, Math.min(256, Math.round(Number(sizePx) || 48)));
      const shapeKey = (typeof CUE_SHAPE_ALIASES !== 'undefined' && CUE_SHAPE_ALIASES[safeAv.shape]) || safeAv.shape || 'square';
      const isGenerating = typeof uiState !== 'undefined' && uiState.isOrchestratorRunning;
      const faceKey = expressionOverride || (isGenerating ? 'focused' : ((typeof CUE_FACE_ALIASES !== 'undefined' && CUE_FACE_ALIASES[safeAv.face]) || safeAv.face || 'wink'));
      const color = safeAv.color || '#3E97F6';
      
      const rawShape = (typeof CUE_AVATAR_SHAPES_SVGS !== 'undefined' && CUE_AVATAR_SHAPES_SVGS[shapeKey]) || '';
      const rawFace = (typeof CUE_AVATAR_FACES_SVGS !== 'undefined' && CUE_AVATAR_FACES_SVGS[faceKey]) || '';
      
      if (rawShape && rawFace) {
        const coloredShape = rawShape.replace(/fill="#[A-Fa-f0-9]+"/g, `fill="${color}"`);
        return `<svg width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" class="shrink-0 select-none avatar-svg ${isGenerating ? 'animate-pulse' : ''}" aria-hidden="true" style="width:${safeSize}px;height:${safeSize}px">
          <g class="avatar-shape">${coloredShape}</g>
          <g class="avatar-face">${rawFace}</g>
        </svg>`;
      }
      
      return `<svg width="${safeSize}" height="${safeSize}" viewBox="0 0 100 100" class="shrink-0 select-none avatar-svg" aria-hidden="true" style="width:${safeSize}px;height:${safeSize}px">
        <g fill="${safeAv.color}">${getBodyShapePath(safeAv.shape)}</g>
        <g>${getFaceFeaturesSVG(safeAv.face, false)}</g>
      </svg>`;
    }"""

    if old_build_avatar_svg in html:
        html = html.replace(old_build_avatar_svg, new_build_avatar_svg, 1)
        print("Updated buildAvatarSVG to use Cue vectors with live response expression override.")

    # Search Category and Showcase Helpers
    search_helpers = """
    function handleHomeSearchInput(query) {
      renderHomeChatList();
      renderHomeSearchApps(query);
    }
    window.handleHomeSearchInput = handleHomeSearchInput;

    function selectSearchCategory(cat) {
      triggerCueHaptic(10);
      const buttons = document.querySelectorAll('#searchCategoryBar button');
      buttons.forEach(btn => {
        if (btn.innerText.trim() === cat) {
          btn.className = 'px-3 py-1 rounded-full text-[11px] font-semibold bg-white text-black whitespace-nowrap';
        } else {
          btn.className = 'px-3 py-1 rounded-full text-[11px] font-semibold bg-cue-card border border-cue-border text-cue-muted hover:text-white whitespace-nowrap';
        }
      });
      renderHomeSearchApps('', cat);
    }
    window.selectSearchCategory = selectSearchCategory;

    function renderHomeSearchApps(query = '', category = 'Recommended') {
      const container = document.getElementById('homeSearchAppsShowcase');
      if (!container) return;
      let apps = APPS_CATALOG;
      if (category === 'Added apps') {
        apps = apps.filter(a => isAppGenuinelyConnected(a.id));
      } else if (category === 'Recommended') {
        const recIds = new Set(['google_health', 'oura', 'outlook_mail', 'outlook_cal', 'notion', 'plaid', 'stripe', 'coinbase', 'robinhood']);
        apps = apps.filter(a => recIds.has(a.id) || a.recommended);
      } else if (category) {
        apps = apps.filter(a => a.category === category);
      }
      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        apps = apps.filter(a => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
      }
      if (apps.length === 0) {
        container.innerHTML = '<div class="text-[11px] text-cue-muted text-center py-2">No matching apps.</div>';
        return;
      }
      container.innerHTML = apps.slice(0, 5).map(app => `
        <div onclick="openAppDetailView('${escapeJsAttr(app.id)}')" class="p-2.5 rounded-xl bg-cue-card border border-cue-border flex items-center justify-between cursor-pointer hover:bg-cue-cardHover transition">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 flex items-center justify-center shrink-0">
              ${getAppIconSVG(app.id, 'added')}
            </div>
            <div>
              <span class="text-xs font-bold text-white block">${escapeHtml(app.name)}</span>
              <span class="text-[10px] text-cue-muted block">${escapeHtml(app.category)}</span>
            </div>
          </div>
          <button onclick="event.stopPropagation();openAppDetailView('${escapeJsAttr(app.id)}')" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white">Add</button>
        </div>
      `).join('');
    }
    window.renderHomeSearchApps = renderHomeSearchApps;
    """

    # Add search helpers right before toggleHomeSearch
    if 'function toggleHomeSearch()' in html:
        html = html.replace('function toggleHomeSearch()', search_helpers + '\n    function toggleHomeSearch()', 1)
        print("Injected search helpers.")

    with open(target_html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Done! Written {target_html_path.name}: {len(html)} chars, {html.count(chr(10))} lines.")

def main():
    root_dir = Path(__file__).resolve().parent.parent
    target = root_dir / 'index.html'
    if len(sys.argv) > 1:
        target = Path(sys.argv[1]).resolve()
    build_parity(target)

if __name__ == '__main__':
    main()
