#!/usr/bin/env python3
"""
extract_retro.py

Extracts condensed session retrospectives from Claude Code .jsonl session logs:
- Human user messages (full text)
- Assistant text replies (fenced code blocks removed, tool calls/outputs excluded),
  trimmed to the first ~300 characters each
- Timestamps for each exchange

Saves one condensed .md file per session into a retro/ directory, named by date.
Skips tool-results directories.
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

DEFAULT_SOURCE = Path(r"C:\Users\astev\.claude\projects\C--Antigravity-YODC")
DEFAULT_OUTPUT = Path("retro")


def strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks (```...```) and normalize whitespace."""
    # Strip markdown code fences (including unclosed ones at end of string)
    cleaned = re.sub(r"```[\s\S]*?(?:```|$)", "", text)
    # Collapse multiple blank lines to at most two
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    # Also strip any trailing horizontal rules (--- or ***) that immediately preceded the stripped code block
    cleaned = re.sub(r"(?:\n\s*[-*_]{3,}\s*)+\Z", "", cleaned)
    return cleaned.strip()


def trim_reply(text: str, limit: int = 300) -> str:
    """Trim text to approximately `limit` characters at a clean word boundary."""
    text = text.strip()
    if len(text) <= limit:
        return text

    # Attempt word boundary within the last 50 chars of the limit
    snippet = text[:limit]
    last_space = snippet.rfind(" ")
    if last_space > limit - 50:
        snippet = snippet[:last_space]
    return snippet.rstrip() + "..."


def parse_session(jsonl_file: Path, trim_limit: int = 300):
    """
    Parse a single Claude Code session .jsonl file.
    Extracts only human user messages and assistant text replies.
    Skips tool calls, tool results, thinking blocks, attachments, and system messages.
    """
    entries = []
    session_id = jsonl_file.stem
    custom_title = None
    first_timestamp = None
    last_timestamp = None

    with open(jsonl_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue

            ts = data.get("timestamp")
            if ts:
                if first_timestamp is None:
                    first_timestamp = ts
                last_timestamp = ts

            t = data.get("type")
            if t == "custom-title":
                custom_title = data.get("customTitle")

            # Extract user message: only actual human prompts (origin.kind == 'human')
            if t == "user" and data.get("origin") == {"kind": "human"}:
                msg = data.get("message", {})
                content = msg.get("content")
                user_text = ""
                if isinstance(content, str):
                    user_text = content.strip()
                elif isinstance(content, list):
                    parts = []
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                parts.append(block.get("text", "").strip())
                            elif block.get("type") == "image":
                                parts.append("[Image attached]")
                    user_text = "\n\n".join(p for p in parts if p)

                if user_text:
                    entries.append({
                        "role": "User",
                        "timestamp": ts,
                        "text": user_text,
                    })

            # Extract assistant reply: text blocks only (no tool calls, no code blocks)
            elif t == "assistant":
                msg = data.get("message", {})
                content = msg.get("content")
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            raw_text = block.get("text", "")
                            cleaned = strip_code_blocks(raw_text)
                            if cleaned:
                                trimmed = trim_reply(cleaned, limit=trim_limit)
                                entries.append({
                                    "role": "Assistant",
                                    "timestamp": ts,
                                    "text": trimmed,
                                })
                elif isinstance(content, str) and content.strip():
                    cleaned = strip_code_blocks(content)
                    if cleaned:
                        trimmed = trim_reply(cleaned, limit=trim_limit)
                        entries.append({
                            "role": "Assistant",
                            "timestamp": ts,
                            "text": trimmed,
                        })

    return {
        "file_name": jsonl_file.name,
        "session_id": session_id,
        "title": custom_title,
        "first_timestamp": first_timestamp or "Unknown",
        "last_timestamp": last_timestamp or "Unknown",
        "entries": entries,
    }


def format_markdown(session_data: dict, session_idx: int = 1, total_for_date: int = 1) -> str:
    """Format session data into clean markdown."""
    start_date = session_data["first_timestamp"][:10] if session_data["first_timestamp"] != "Unknown" else "Unknown"
    title_suffix = f" (Session {session_idx} of {total_for_date})" if total_for_date > 1 else ""

    lines = [
        f"# Session Retro: {start_date}{title_suffix}",
        f"- **Session ID:** `{session_data['session_id']}`",
    ]
    if session_data["title"]:
        lines.append(f"- **Title:** {session_data['title']}")
    lines.extend([
        f"- **Start Time:** {session_data['first_timestamp']}",
        f"- **End Time:** {session_data['last_timestamp']}",
        f"- **Exchanges:** {len(session_data['entries'])} turns ({sum(1 for e in session_data['entries'] if e['role'] == 'User')} user prompts, {sum(1 for e in session_data['entries'] if e['role'] == 'Assistant')} assistant replies)",
        "",
        "---",
        "",
    ])

    for entry in session_data["entries"]:
        role = entry["role"]
        ts = entry["timestamp"]
        text = entry["text"]
        lines.extend([
            f"### {role} ({ts})",
            "",
            text,
            "",
            "---",
            "",
        ])

    return "\n".join(lines)


def process_sessions(source_dir: Path, output_dir: Path, trim_limit: int = 300):
    """Process all session .jsonl files in source_dir and write condensed .md to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find only top-level .jsonl files (skipping tool-results directories)
    jsonl_files = [p for p in source_dir.iterdir() if p.is_file() and p.suffix == ".jsonl"]

    parsed_sessions = []
    for jf in jsonl_files:
        s = parse_session(jf, trim_limit=trim_limit)
        parsed_sessions.append(s)

    # Sort chronologically by start timestamp
    parsed_sessions.sort(key=lambda x: x["first_timestamp"])

    # Group by start date to determine filenames
    date_groups = defaultdict(list)
    for s in parsed_sessions:
        date_str = s["first_timestamp"][:10] if s["first_timestamp"] != "Unknown" else "unknown"
        date_groups[date_str].append(s)

    written_files = []
    total_bytes = 0
    total_chars = 0
    total_words = 0

    for date_str, sessions in sorted(date_groups.items()):
        total_for_date = len(sessions)
        for idx, s in enumerate(sessions, start=1):
            if total_for_date == 1:
                filename = f"{date_str}.md"
            else:
                filename = f"{date_str}_{idx}.md"

            out_path = output_dir / filename
            md_content = format_markdown(s, session_idx=idx, total_for_date=total_for_date)
            
            # Write out markdown with utf-8 encoding
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(md_content)

            file_size = out_path.stat().st_size
            char_count = len(md_content)
            word_count = len(md_content.split())
            approx_tokens = round(char_count / 4)

            total_bytes += file_size
            total_chars += char_count
            total_words += word_count

            written_files.append({
                "filename": filename,
                "path": out_path,
                "size_bytes": file_size,
                "chars": char_count,
                "words": word_count,
                "approx_tokens": approx_tokens,
                "user_count": sum(1 for e in s["entries"] if e["role"] == "User"),
                "asst_count": sum(1 for e in s["entries"] if e["role"] == "Assistant"),
            })

    total_tokens = round(total_chars / 4)
    word_based_tokens = round(total_words * 1.33)

    return {
        "output_dir": output_dir,
        "files": written_files,
        "total_bytes": total_bytes,
        "total_chars": total_chars,
        "total_words": total_words,
        "total_tokens_char_based": total_tokens,
        "total_tokens_word_based": word_based_tokens,
    }


def main():
    parser = argparse.ArgumentParser(description="Extract condensed Claude Code session retrospectives.")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE,
                        help="Path to directory containing Claude Code session .jsonl files")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT,
                        help="Path to directory where condensed .md files will be saved")
    parser.add_argument("--trim-limit", type=int, default=300,
                        help="Character limit to trim assistant text replies (default: 300)")

    args = parser.parse_args()

    print(f"Reading sessions from: {args.source_dir}")
    print(f"Output directory:      {args.output_dir}")
    print(f"Trimming assistant replies to ~{args.trim_limit} characters...")
    print("-" * 60)

    result = process_sessions(args.source_dir, args.output_dir, trim_limit=args.trim_limit)

    for item in result["files"]:
        print(f"  {item['filename']:<16} | {item['size_bytes']:>7} bytes ({item['size_bytes']/1024:>5.1f} KB) | "
              f"{item['user_count']:>2} user, {item['asst_count']:>3} asst | ~{item['approx_tokens']:>5} tokens")

    print("-" * 60)
    print(f"Total files:        {len(result['files'])}")
    print(f"Total folder size:  {result['total_bytes']:,} bytes ({result['total_bytes'] / 1024:.2f} KB)")
    print(f"Total characters:   {result['total_chars']:,}")
    print(f"Total words:        {result['total_words']:,}")
    print(f"Estimated tokens:   ~{result['total_tokens_char_based']:,} (char-based: chars/4) to ~{result['total_tokens_word_based']:,} (word-based: words*1.33)")


if __name__ == "__main__":
    main()
