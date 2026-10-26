import unittest
from unittest.mock import patch
import json
import os
import tempfile
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

if __name__ == '__main__':
    unittest.main()
