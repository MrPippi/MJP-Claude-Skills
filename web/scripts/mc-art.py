"""
Extracts the handful of vanilla textures the site uses from a full resource dump.

    python web/scripts/mc-art.py [SOURCE] [OUTPUT]

SOURCE defaults to web/public/mc (an unpacked client assets/minecraft folder, gitignored);
OUTPUT defaults to web/public/art (committed); favicons go to web/app/. Re-run after updating the dump.
Requires Pillow. Every source path is checked; a missing file aborts with its path.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

WEB = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else WEB / "public" / "mc"
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else WEB / "public" / "art"
# Next.js file-based metadata icons (served with the right basePath automatically).
APP_DIR = WEB / "app"
IVORY = (0xFA, 0xF9, 0xF5, 0xFF)

# Default plains foliage colour; oak_leaves.png ships greyscale and is tinted in-game.
FOLIAGE = (0x48, 0xB5, 0x18)

# Icon key (see web/shared/ui/pixel-icons.ts) → plain 16x16 texture.
PLAIN_ITEMS = {
    "pickaxe": "item/diamond_pickaxe.png",
    "redstone": "item/redstone.png",
    "emerald": "item/emerald.png",
    "book": "item/book.png",
    "sword": "item/iron_sword.png",
    "pearl": "item/ender_pearl.png",
    "egg": "item/creeper_spawn_egg.png",
    "sign": "item/oak_sign.png",
    "grass": "block/grass_block_side.png",
}

BLOCKS = {
    "grass_block_side": "block/grass_block_side.png",
    "dirt": "block/dirt.png",
    "stone": "block/stone.png",
    "oak_log": "block/oak_log.png",
}


def load(rel: str) -> Image.Image:
    path = SOURCE / "textures" / rel
    if not path.is_file():
        raise SystemExit(f"missing texture: {path}")
    return Image.open(path).convert("RGBA")


def first_frame(img: Image.Image) -> Image.Image:
    """Animated textures are vertical strips of square frames."""
    return img.crop((0, 0, img.width, img.width))


def centered(img: Image.Image, size: int = 16) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas


def face(rel: str, box: tuple[int, int, int, int], overlay: tuple[int, int, int, int] | None = None) -> Image.Image:
    """8x8 head front from an entity skin, optional hat layer, upscaled to 16x16."""
    skin = load(rel)
    head = skin.crop(box)
    if overlay:
        head.alpha_composite(skin.crop(overlay))
    return head.resize((16, 16), Image.NEAREST)


def chest_front() -> Image.Image:
    """Front view assembled from the chest entity atlas: lid (5px) + base (10px) + latch."""
    atlas = load("entity/chest/normal.png")
    front = Image.new("RGBA", (14, 15), (0, 0, 0, 0))
    front.alpha_composite(atlas.crop((14, 14, 28, 19)), (0, 0))
    front.alpha_composite(atlas.crop((14, 33, 28, 43)), (0, 5))
    front.alpha_composite(atlas.crop((1, 1, 3, 5)), (6, 3))
    return centered(front)


def tinted(rel: str, color: tuple[int, int, int]) -> Image.Image:
    img = load(rel)
    gray = ImageOps.grayscale(img)
    colored = ImageOps.colorize(gray, black=(0, 0, 0), white=color).convert("RGBA")
    colored.putalpha(img.getchannel("A"))
    return colored


def favicons(icon: Image.Image) -> None:
    """Browser tab icon (transparent, 4x) and Apple touch icon (opaque ivory, 10x centred in 180px)."""
    icon.resize((64, 64), Image.NEAREST).save(APP_DIR / "icon.png", optimize=True)
    touch = Image.new("RGBA", (180, 180), IVORY)
    touch.alpha_composite(icon.resize((160, 160), Image.NEAREST), (10, 10))
    touch.convert("RGB").save(APP_DIR / "apple-icon.png", optimize=True)
    print("  app/icon.png, app/apple-icon.png")


def save(img: Image.Image, rel: str) -> None:
    path = OUTPUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f"  {rel}")


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"source folder not found: {SOURCE}")
    print(f"{SOURCE} -> {OUTPUT}")
    for key, rel in PLAIN_ITEMS.items():
        save(load(rel), f"items/{key}.png")
    save(first_frame(load("block/command_block_front.png")), "items/command.png")
    save(chest_front(), "items/chest.png")
    save(face("entity/creeper/creeper.png", (8, 8, 16, 16)), "items/creeper.png")
    save(face("entity/player/wide/steve.png", (8, 8, 16, 16), (40, 8, 48, 16)), "items/head.png")
    for key, rel in BLOCKS.items():
        save(load(rel), f"blocks/{key}.png")
    save(tinted("block/oak_leaves.png", FOLIAGE), "blocks/oak_leaves.png")
    favicons(load(PLAIN_ITEMS["pickaxe"]))


if __name__ == "__main__":
    main()
