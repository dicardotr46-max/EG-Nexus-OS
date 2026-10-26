#!/usr/bin/env python3
"""EG Nexus OS static inventory and mobile QA manifest generator.

The browser portion is intentionally emitted as JSON/JS-friendly test cases so it
can be executed by the Manus browser runner or a Playwright adapter. Static
results never claim a feature is real merely because it has an onclick handler.
"""
from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path

TARGETS = {
    'bottom_mode_bar': ['Chat', 'Swarm', 'Deep Research', 'Brain', 'Standard', 'Diff-Only ON'],
    'message_actions': ['ذخیره در Brain', 'کپی متن', 'تلگرام', 'صدا', 'اجرا در بوم زنده', 'تبدیل به Skill'],
    'navigation': ['Clash Royale Viral Studio', 'Settings', 'Monitor', 'Skills'],
    'core_modules': ['Brain', 'Canvas', 'Skill', 'Telegram', 'TTS', 'Voice', 'Cloud', 'Routine'],
}
STUB_WORDS = re.compile(r'\b(?:TODO|FIXME|stub|dummy|placeholder|not implemented|coming soon)\b', re.IGNORECASE)
TOAST_ONLY = re.compile(r"showToast\s*\([^;]+\)\s*;?\s*\}?\s*$", re.DOTALL)

class ElementParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.stack = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        item = {'tag': tag, 'id': d.get('id', ''), 'onclick': d.get('onclick', ''), 'text': '', 'attrs': d}
        if tag in {'button', 'a', 'input', 'select', 'textarea'}:
            self.elements.append(item)
            self.stack.append(item)
    def handle_endtag(self, tag):
        if tag in {'button', 'a', 'input', 'select', 'textarea'} and self.stack:
            self.stack.pop()
    def handle_data(self, data):
        if self.stack:
            self.stack[-1]['text'] += data

def extract_scripts(src):
    return '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', src, re.DOTALL))

def get_defined_functions(js):
    return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', js)) | set(re.findall(r'window\.([A-Za-z_$][\w$]*)\s*=', js))

def analyze_interactive_elements(parser, defined_functions):
    buttons = []
    for e in parser.elements:
        if e['tag'] in {'button', 'a'} or e['onclick']:
            onclick = e['onclick']
            calls = re.findall(r'\b([A-Za-z_$][\w$]*)\s*\(', onclick)
            called = [c for c in calls if c not in {'if', 'alert', 'confirm', 'prompt'}]
            buttons.append({'tag': e['tag'], 'id': e['id'], 'text': ' '.join(e['text'].split())[:160], 'onclick': onclick[:300], 'handlers': called, 'missing_handlers': [c for c in called if c not in defined_functions and c not in {'window', 'document'}]})
    return buttons

def find_stub_markers(src):
    markers = []
    for m in STUB_WORDS.finditer(src):
        line = src.count('\n', 0, m.start()) + 1
        markers.append({'line': line, 'text': src[max(0, m.start() - 100):m.start() + 180].replace('\n', ' ')})
    return markers

def check_target_hits(src):
    return {k: {label: bool(re.search(re.escape(label), src, re.IGNORECASE)) for label in vals} for k, vals in TARGETS.items()}

def identify_toast_heavy_functions(defined_functions, js):
    function_flags = []
    for name in sorted(defined_functions):
        m = re.search(r'function\s+' + re.escape(name) + r'\s*\([^)]*\)\s*\{', js)
        if not m:
            continue
        body = js[m.end():m.end() + 1200]
        if 'showToast' in body and not any(x in body for x in ['innerHTML', 'classList', 'fetch(', 'localStorage', 'saveState', 'window.open', 'speechSynthesis', 'canvas', 'navigator.clipboard', 'appState']):
            function_flags.append({'function': name, 'reason': 'toast-heavy first 1200 chars; manual review required'})
    return function_flags

def generate_report(p, src, js, fn, buttons, target_hits, markers, function_flags, out_path):
    report = {'file': str(p), 'lines': src.count('\n') + 1, 'script_bytes': len(js), 'function_count': len(fn), 'interactive_element_count': len(buttons), 'target_hits': target_hits, 'missing_handlers': sum(len(x['missing_handlers']) for x in buttons), 'stub_markers': markers, 'toast_heavy_candidates': function_flags, 'elements': buttons}
    Path(out_path).write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: report[k] for k in ['file', 'lines', 'function_count', 'interactive_element_count', 'missing_handlers', 'stub_markers', 'toast_heavy_candidates']}, ensure_ascii=False, indent=2))

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument('html', nargs='?', default='index.html')
    ap.add_argument('--out', default='audit-static.json')
    return ap.parse_args()

def main():
    args = parse_args()
    p = Path(args.html)
    src = p.read_text(errors='replace')
    js = extract_scripts(src)
    parser = ElementParser()
    parser.feed(src)
    fn = get_defined_functions(js)
    buttons = analyze_interactive_elements(parser, fn)
    markers = find_stub_markers(src)
    target_hits = check_target_hits(src)
    function_flags = identify_toast_heavy_functions(fn, js)
    generate_report(p, src, js, fn, buttons, target_hits, markers, function_flags, args.out)

if __name__ == '__main__':
    main()
