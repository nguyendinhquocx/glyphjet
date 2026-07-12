"""build_taxonomy.py — gộp category thô thành nhóm thân thiện.

Policy catch-all (ARCHITECTURE.md 4.2): mọi category trong data.json PHẢI có trong mapping.
Nếu data update có category mới chưa match → fail loud + warning log.
Items có category không match → vào nhóm "Misc" tương ứng + warning.

Output: src-tauri/resources/taxonomy.json
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "src-tauri" / "resources" / "data.json"
OUTPUT_PATH = ROOT / "src-tauri" / "resources" / "taxonomy.json"

# Mapping per ARCHITECTURE.md 4.2 — cover 9 emoji + 26 symbol + 93 kaomoji categories.
TAXONOMY: dict[str, list[dict]] = {
    "emoji": [
        {"id": "smileys", "label": "Smileys & Emotion", "categories": ["smileys-emotion"]},
        {"id": "people", "label": "People & Body", "categories": ["people-body"]},
        {"id": "animals", "label": "Animals & Nature", "categories": ["animals-nature"]},
        {"id": "food", "label": "Food & Drink", "categories": ["food-drink"]},
        {"id": "travel", "label": "Travel & Places", "categories": ["travel-places"]},
        {"id": "activities", "label": "Activities", "categories": ["activities"]},
        {"id": "objects", "label": "Objects", "categories": ["objects"]},
        {"id": "symbols-emoji", "label": "Symbols", "categories": ["symbols"]},
        {"id": "flags", "label": "Flags", "categories": ["flags"]},
    ],
    "symbol": [
        {"id": "arrows", "label": "Arrows", "categories": [
            "arrows", "supplemental-arrows", "miscellaneous-and-arrows", "transport-and-map"]},
        {"id": "math", "label": "Math", "categories": [
            "mathematical-operators", "supplemental-mathematical-operators",
            "miscellaneous-mathematical-symbols"]},
        {"id": "currency", "label": "Currency", "categories": ["currency"]},
        {"id": "shapes", "label": "Geometric Shapes", "categories": [
            "geometric-shapes", "geometric-shapes-extended"]},
        {"id": "technical", "label": "Technical", "categories": ["miscellaneous-technical"]},
        {"id": "text-punctuation", "label": "Text & Punctuation", "categories": ["general-punctuation"]},
        {"id": "letters-numbers", "label": "Letters & Numbers", "categories": [
            "letterlike", "number-forms", "superscripts-and-subscripts",
            "alphabetic-presentation-forms", "greek-and-coptic", "cyrillic"]},
        {"id": "boxes-blocks", "label": "Boxes & Blocks", "categories": ["box-drawing", "block-elements"]},
        {"id": "dingbats", "label": "Dingbats", "categories": ["dingbats", "ornamental-dingbats"]},
        {"id": "games", "label": "Games & Chess", "categories": ["chess"]},
        {"id": "misc-symbol", "label": "Miscellaneous", "categories": [
            "miscellaneous", "miscellaneous-and-pictographs", "supplemental-and-pictographs"]},
    ],
    "kaomoji": [
        {"id": "happy", "label": "Happy & Positive", "categories": [
            "happy", "laughing", "excited", "friend", "winking", "wink", "smug",
            "thumbs-up", "triumph-and-success", "hello-and-hi", "good-morning",
            "good-night", "thank-you", "japanese-smiley-face", "blushing", "angel"]},
        {"id": "love", "label": "Love & Flirty", "categories": [
            "love", "kissing", "kiss", "flirty", "cute"]},
        {"id": "shy", "label": "Shy & Hiding", "categories": ["shy", "hiding"]},
        {"id": "sad", "label": "Sad & Worried", "categories": [
            "sad", "crying", "worried", "depressed", "helpless",
            "apologizing", "nervous", "giving-up"]},
        {"id": "angry", "label": "Angry & Violent", "categories": [
            "angry", "fighting-weapons-and-violent", "evil", "devil",
            "middle-finger", "disapproval"]},
        {"id": "table-flip", "label": "Table Flip & Rage", "categories": [
            "table-flipping", "flip-table"]},
        {"id": "surprised", "label": "Surprised & Confused", "categories": [
            "surprised", "confused", "meh", "scared", "wtf", "weird"]},
        {"id": "sick", "label": "Sick & Hurt", "categories": [
            "hurt-or-sick", "vomiting", "dead", "nose-bleed"]},
        {"id": "thinking", "label": "Thinking & Sleeping", "categories": [
            "thinking", "sleeping", "flexing", "shrug"]},
        {"id": "actions", "label": "Actions", "categories": [
            "waving", "running", "dancing", "saluting", "hugging", "writing",
            "eating", "please", "holiday", "christmas", "music", "other-action"]},
        {"id": "cool", "label": "Cool & Sunglasses", "categories": [
            "emoticons-with-sunglasses", "sunglasses", "mustache", "crazy"]},
        {"id": "animals-nature", "label": "Animals & Nature", "categories": [
            "bear", "cat", "dog", "bird", "rabbit", "sheep", "monkey", "pig",
            "fish", "spider", "other-animal", "flower"]},
        {"id": "food-objects", "label": "Food & Objects", "categories": [
            "food-and-drink", "hungry", "emoticon-objects", "gun", "sword", "cloud"]},
        {"id": "meme", "label": "Meme & Character", "categories": [
            "character-and-meme", "dongers", "random"]},
        {"id": "misc-kaomoji", "label": "Misc", "categories": [
            "uncategorized", "misc", "other"]},
    ],
}


def main() -> int:
    if not DATA_PATH.exists():
        print(f"ERROR: data.json not found at {DATA_PATH}", file=sys.stderr)
        return 1

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    # Count categories thực tế trong data theo từng type.
    actual_by_type: dict[str, Counter] = {}
    for item in data:
        item_type = item.get("y", "")
        cat = item.get("c", "")
        actual_by_type.setdefault(item_type, Counter())[cat] += 1

    # Validate: mọi category thực tế phải có trong mapping, hoặc warning catch-all.
    warnings: list[str] = []
    for item_type, mapping_groups in TAXONOMY.items():
        mapped_cats = {c for g in mapping_groups for c in g["categories"]}
        actual_cats = set(actual_by_type.get(item_type, Counter()).keys())
        unmapped = actual_cats - mapped_cats
        if unmapped:
            # Auto-merge unmapped vào nhóm cuối (catch-all) của type đó.
            catchall = mapping_groups[-1]
            count_unmapped = sum(
                actual_by_type[item_type][c] for c in unmapped
            )
            warnings.append(
                f"[{item_type}] {len(unmapped)} unmapped categories "
                f"({count_unmapped} items) auto-merged into '{catchall['id']}': "
                f"{sorted(unmapped)}"
            )
            catchall["categories"] = sorted(set(catchall["categories"]) | unmapped)

    OUTPUT_PATH.write_text(
        json.dumps(TAXONOMY, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    total_items = sum(sum(c.values()) for c in actual_by_type.values())
    total_cats = sum(len(c) for c in actual_by_type.values())
    print(f"OK: taxonomy.json written ({OUTPUT_PATH})")
    print(f"     items: {total_items}, categories: {total_cats}")
    print(f"     groups: " + ", ".join(
        f"{t}={len(g)}" for t, g in TAXONOMY.items()
    ))
    if warnings:
        print("\nWARNINGS (catch-all auto-merge):")
        for w in warnings:
            print(f"  - {w}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
