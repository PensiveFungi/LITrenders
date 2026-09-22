#!/usr/bin/env python3
"""
Regenerate assets/js/data/rhymes.js from the Android app's RhymeData.kt.

Usage, from anywhere:

    python3 tools/extract-rhymes.py /path/to/FreestyleAcademy > assets/js/data/rhymes.js

or, if you are inside the app repo:

    python3 /path/to/freestyle-academy-web/tools/extract-rhymes.py . > rhymes.js

It parses by matching parentheses rather than by regex lookahead, so the last
group in the file is never silently dropped. It fails loudly instead of
producing a half-empty dictionary.
"""

import json
import re
import sys
from pathlib import Path

KT_RELATIVE = Path("app/src/main/java/com/freestyle/academy/data/RhymeData.kt")

HEADER = '''/* =========================================================================
   rhymes.js — rhyme dictionary, generated from RhymeData.kt
   Do not hand-edit: regenerate with tools/extract-rhymes.py
   Groups: {groups}   Words: {words}
   ========================================================================= */

'''

FOOTER = '''

/** Keys sorted the way LibraryScreen sorts them (rhymes.keys.sorted()). */
export function sortedRhymeKeys(rhymes) {
  return Object.keys(rhymes).sort((a, b) => a.localeCompare(b, 'es'));
}
'''


def find_matching_paren(text: str, open_index: int) -> int:
    """Index of the ')' matching the '(' at open_index, ignoring parens in strings."""
    depth = 0
    in_string = False
    i = open_index
    while i < len(text):
        ch = text[i]
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced parentheses in RhymeData.kt")


def extract(source: str) -> dict:
    try:
        start = source.index("initialRhymes")
    except ValueError:
        raise SystemExit("error: 'initialRhymes' not found — is this RhymeData.kt?")

    body = source[start:]
    groups: dict[str, list[str]] = {}

    for match in re.finditer(r'"([^"]+)"\s*to\s*listOf\s*\(', body):
        key = match.group(1)
        open_paren = body.index("(", match.end() - 1)
        close_paren = find_matching_paren(body, open_paren)
        block = body[open_paren + 1:close_paren]
        words = re.findall(r'"((?:[^"\\]|\\.)*)"', block)
        words = [w.replace('\\"', '"') for w in words if w.strip()]
        if not words:
            print(f"warning: group {key} is empty, skipping", file=sys.stderr)
            continue
        if key in groups:
            print(f"warning: duplicate group {key}, keeping the first", file=sys.stderr)
            continue
        groups[key] = words

    return groups


def main() -> None:
    repo_root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser()
    kt_path = repo_root / KT_RELATIVE
    if not kt_path.is_file():
        raise SystemExit(f"error: {kt_path} not found. Pass the FreestyleAcademy repo root.")

    groups = extract(kt_path.read_text(encoding="utf-8"))
    if not groups:
        raise SystemExit("error: no rhyme groups parsed — refusing to write an empty file.")

    total_words = sum(len(v) for v in groups.values())
    print(
        f"Parsed {len(groups)} groups, {total_words} words from {kt_path}",
        file=sys.stderr,
    )
    for key, words in sorted(groups.items()):
        print(f"  -{key}: {len(words)}", file=sys.stderr)

    out = HEADER.format(groups=len(groups), words=total_words)
    out += "export const INITIAL_RHYMES = "
    out += json.dumps(groups, ensure_ascii=False, indent=2)
    out += ";"
    out += FOOTER
    sys.stdout.write(out)


if __name__ == "__main__":
    main()
