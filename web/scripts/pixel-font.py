"""
Subsets the Cubic 11 pixel font to the characters the site's UI can show in it.

    python web/scripts/pixel-font.py PATH/TO/Cubic_11.ttf [LICENSE.txt]

Download Cubic_11.ttf (and OFL.txt) from https://github.com/ACh-K/Cubic-11. Writes
web/shared/fonts/cubic-11-subset.woff2, the character list next to it (checked by
tests/pixel-font.test.ts) and a copy of the licence (subsets are derivatives and must
keep it). Re-run whenever UI strings, skill frontmatter or doc titles change.
Requires fonttools and brotli.
"""
import re
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

WEB = Path(__file__).resolve().parent.parent
REPO = WEB.parent
OUT_DIR = WEB / "shared" / "fonts"
FONT_OUT = OUT_DIR / "cubic-11-subset.woff2"
CHARSET_OUT = OUT_DIR / "pixel-charset.txt"
LICENSE_OUT = OUT_DIR / "Cubic-11-OFL.txt"

# Keep in sync with collectRequiredChars() in tests/pixel-font.test.ts.
LOCALE_GLOB = "shared/i18n/locales/*.ts"
SKILLS_GLOB = "data/skills/*.md"
DOC_SOURCES = re.compile(r"file: '([^']+\.md)'")
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---", re.S)
H1 = re.compile(r"^# (.+)$", re.M)
EXTRA = "".join(chr(c) for c in range(0x20, 0x7F)) + "·—→←↑↓↵…「」『』（）：；，。、！？"


def required_text() -> str:
    parts = [EXTRA]
    parts += [p.read_text(encoding="utf8") for p in sorted(WEB.glob(LOCALE_GLOB))]
    for p in sorted(WEB.glob(SKILLS_GLOB)):
        match = FRONTMATTER.match(p.read_text(encoding="utf8").replace("\r\n", "\n"))
        if match:
            parts.append(match.group(1))
    registry = (WEB / "features" / "docs" / "registry.ts").read_text(encoding="utf8")
    for rel in DOC_SOURCES.findall(registry):
        h1 = H1.search((REPO / rel).read_text(encoding="utf8"))
        if h1:
            parts.append(h1.group(1))
    return "".join(parts)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    if not source.is_file():
        raise SystemExit(f"font not found: {source}")

    cmap = TTFont(source).getBestCmap()
    wanted = sorted({ch for ch in required_text() if not ch.isspace() or ch == " "})
    covered = [ch for ch in wanted if ord(ch) in cmap]
    missing = [ch for ch in wanted if ord(ch) not in cmap]

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]  # keep copyright / licence name records
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text="".join(covered))
    subsetter.subset(font)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(FONT_OUT), options)
    CHARSET_OUT.write_text("".join(covered), encoding="utf8")
    if len(sys.argv) > 2:
        shutil.copyfile(sys.argv[2], LICENSE_OUT)

    print(f"{len(covered)} chars -> {FONT_OUT.relative_to(WEB)} ({FONT_OUT.stat().st_size / 1024:.1f} KB)")
    if missing:
        listed = " ".join(f"{ch}(U+{ord(ch):04X})" for ch in missing)
        print(f"not in font, falls back to system font: {listed}")


if __name__ == "__main__":
    main()
