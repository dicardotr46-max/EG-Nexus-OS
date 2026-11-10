import unittest
from unittest.mock import patch
import json
import os
import tempfile
import hashlib
import subprocess
from pathlib import Path
from full_app_audit import extract_scripts, ElementParser, main

class TestFullAppAudit(unittest.TestCase):
    def test_extract_scripts(self):
        html_content = """
        <html>
            <body>
                <script>
                    function test() { console.log('hello'); }
                </script>
                <div>No script here</div>
                <script type="module">
                    export default { test: 1 };
                </script>
            </body>
        </html>
        """
        extracted = extract_scripts(html_content)
        self.assertIn("function test() { console.log('hello'); }", extracted)
        self.assertIn("export default { test: 1 };", extracted)
        self.assertNotIn("No script here", extracted)

    def test_element_parser(self):
        html_content = """
        <html>
            <body>
                <button id="btn1" onclick="doSomething()">Click Me</button>
                <a href="#" id="link1" onclick="navigate()">Link Text</a>
                <div>Not interactive</div>
                <input id="input1" type="text" />
            </body>
        </html>
        """
        parser = ElementParser()
        parser.feed(html_content)

        # Check lengths
        self.assertEqual(len(parser.elements), 3)

        # Check properties of button
        btn = parser.elements[0]
        self.assertEqual(btn['tag'], 'button')
        self.assertEqual(btn['id'], 'btn1')
        self.assertEqual(btn['onclick'], 'doSomething()')
        self.assertEqual(btn['text'].strip(), 'Click Me')

        # Check properties of link
        link = parser.elements[1]
        self.assertEqual(link['tag'], 'a')
        self.assertEqual(link['id'], 'link1')
        self.assertEqual(link['onclick'], 'navigate()')
        self.assertEqual(link['text'].strip(), 'Link Text')

        # Check properties of input
        inp = parser.elements[2]
        self.assertEqual(inp['tag'], 'input')
        self.assertEqual(inp['id'], 'input1')
        self.assertEqual(inp['onclick'], '')
        self.assertEqual(inp['text'].strip(), '')

    def test_main_integration(self):
        # Create a dummy HTML file for integration testing
        dummy_html = """
        <html>
            <body>
                <button id="test-btn" onclick="testFunction(); missingFunction()">Brain</button>
                <script>
                    function testFunction() {
                        showToast('Testing');
                    }
                    // A function that matches the toast-only regex format conceptually (will be flagged)
                    function toastOnlyFunc() {
                        showToast('Only a toast here');
                    }
                </script>
                <!-- A stub comment TODO: implement this -->
            </body>
        </html>
        """

        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as tf:
            tf.write(dummy_html)
            dummy_html_path = tf.name

        dummy_json_path = dummy_html_path + '.json'

        try:
            # We need to make sure we don't print too much during tests
            with patch('sys.argv', ['full_app_audit.py', dummy_html_path, '--out', dummy_json_path]):
                with patch('builtins.print'):  # suppress print output in tests
                    main()

            # Verify the generated JSON
            self.assertTrue(os.path.exists(dummy_json_path))

            with open(dummy_json_path, 'r') as f:
                report = json.load(f)

            self.assertEqual(report['file'], dummy_html_path)
            self.assertTrue(report['lines'] > 0)
            self.assertTrue(report['script_bytes'] > 0)
            self.assertEqual(report['function_count'], 2)  # testFunction, toastOnlyFunc
            self.assertEqual(report['interactive_element_count'], 1)  # the button

            # Check target hits
            self.assertTrue(report['target_hits']['bottom_mode_bar']['Brain'])

            # Check missing handlers (missingFunction is not defined)
            self.assertEqual(report['missing_handlers'], 1)

        finally:
            # Cleanup
            if os.path.exists(dummy_html_path):
                os.remove(dummy_html_path)
            if os.path.exists(dummy_json_path):
                os.remove(dummy_json_path)

    def test_generated_scripts_syntax(self):
        """Verify JavaScript syntax of generated Worker and Termux scripts (including multiline allowedFolders)."""
        repo_dir = Path(__file__).resolve().parent
        index_html_path = repo_dir / "index.html"
        self.assertTrue(index_html_path.exists(), "index.html must exist in repo root")

        node_script = r"""
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
let inS = false, start = -1, blocks = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!inS && (l === '<script>' || l.startsWith('<script id='))) {
    inS = true; start = i;
  } else if (inS && l === '</script>') {
    blocks.push(lines.slice(start + 1, i).join('\n'));
    inS = false;
  }
}

global.window = global;
global.window.addEventListener = () => {};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
};
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'node' };

const code = blocks.join('\n;\n');
try { eval(code); } catch (e) {
  // Ignore harmless top-level browser init errors
}

const target = process.argv[1] || 'worker';
if (target === 'worker' && typeof global.generateCloudflareWorkerScript === 'function') {
  process.stdout.write(global.generateCloudflareWorkerScript());
} else if (target === 'termux' && typeof global.generateTermuxBridgeScript === 'function') {
  process.stdout.write(global.generateTermuxBridgeScript());
} else if (target === 'termux_multiline' && typeof global.generateTermuxBridgeScript === 'function') {
  if (!global.appState) global.appState = {};
  if (!global.appState.localComputerConfig) global.appState.localComputerConfig = {};
  global.appState.localComputerConfig.allowedFolders = '/sdcard/Nexus1\n/sdcard/Nexus2\r\n/sdcard/Nexus3';
  process.stdout.write(global.generateTermuxBridgeScript());
}
process.exit(0);
"""
        targets = [
            ("worker", ["node", "--check", "--input-type=module"]),
            ("termux", ["node", "--check"]),
            ("termux_multiline", ["node", "--check"])
        ]

        for target_name, check_cmd in targets:
            # 1. Generate code using node
            gen_res = subprocess.run(
                ["node", "-e", node_script, target_name],
                cwd=str(repo_dir),
                capture_output=True,
                text=True
            )
            self.assertEqual(
                gen_res.returncode, 0,
                f"Failed to generate {target_name} script: {gen_res.stderr}"
            )
            script_code = gen_res.stdout
            self.assertTrue(len(script_code) > 1000, f"{target_name} output must be substantial")

            # 2. Syntax check with node --check via stdin
            check_res = subprocess.run(
                check_cmd,
                input=script_code,
                capture_output=True,
                text=True
            )
            self.assertEqual(
                check_res.returncode, 0,
                f"Syntax error in generated {target_name} script:\n{check_res.stderr}"
            )

    def test_file_parity_sha256(self):
        """Verify 100% SHA-256 equality between root files and www/ mirror."""
        repo_dir = Path(__file__).resolve().parent

        pairs = [
            (repo_dir / "index.html", repo_dir / "www" / "index.html"),
            (repo_dir / "sw.js", repo_dir / "www" / "sw.js")
        ]

        for root_file, www_file in pairs:
            self.assertTrue(root_file.exists(), f"Missing file: {root_file}")
            self.assertTrue(www_file.exists(), f"Missing mirror file: {www_file}")

            hash_root = hashlib.sha256(root_file.read_bytes()).hexdigest()
            hash_www = hashlib.sha256(www_file.read_bytes()).hexdigest()

            self.assertEqual(
                hash_root, hash_www,
                f"Parity mismatch between {root_file.name} and www/{www_file.name}!\n"
                f"Root SHA: {hash_root}\n"
                f"WWW  SHA: {hash_www}"
            )

    def test_git_tracked_pycache_hygiene(self):
        """Verify no __pycache__ or .pyc files are tracked in git."""
        repo_dir = Path(__file__).resolve().parent

        res = subprocess.run(
            ["git", "ls-files"],
            cwd=str(repo_dir),
            capture_output=True,
            text=True
        )
        self.assertEqual(res.returncode, 0, f"git ls-files failed: {res.stderr}")

        tracked_files = [line.strip() for line in res.stdout.splitlines() if line.strip()]

        pycache_files = [f for f in tracked_files if "__pycache__" in f or f.endswith(".pyc")]
        self.assertEqual(
            pycache_files, [],
            f"Git hygiene failure: compiled Python files are tracked in git:\n{pycache_files}"
        )

if __name__ == '__main__':
    unittest.main()
