"""AppleScriptに渡すUnicodeパスを、AEを操作せず確認する。"""
import ast
import json
from pathlib import Path
from types import SimpleNamespace
import unittest


class MacPathTest(unittest.TestCase):
    def test_script_path_preserves_unicode_and_escapes_quotes(self):
        source = Path(__file__).resolve().parents[1] / "tools/run_ae_mac.py"
        tree = ast.parse(source.read_text())
        definition = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "do_script")
        calls = []
        namespace = {
            "osa": lambda text, *args: calls.append(text),
            "time": SimpleNamespace(sleep=lambda _: None),
            "json": json,
            "APP_PATH": "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app",
        }
        exec(compile(ast.Module(body=[definition], type_ignores=[]), str(source), "exec"), namespace)
        namespace["do_script"]('/tool/日本語 フォルダ/a"b.jsx', 30)
        self.assertIn("日本語 フォルダ", calls[1], "AppleScript does not support JSON unicode escapes")
        self.assertIn('a\\"b.jsx', calls[1])
        self.assertIn("activate", calls[0])


if __name__ == "__main__":
    unittest.main()
