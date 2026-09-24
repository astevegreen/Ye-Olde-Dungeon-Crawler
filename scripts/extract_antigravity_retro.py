#!/usr/bin/env python3
"""
extract_antigravity_retro.py

Extracts condensed session retrospectives from Google Antigravity logs located in:
  C:\\Users\\astev\\.gemini\\antigravity\\brain\\<session-id>\\.system_generated\\logs\\transcript_full.jsonl

Extracts:
- Human user messages (full text from <USER_REQUEST>, metadata tags removed)
- Assistant text replies (fenced code blocks removed, tool calls/outputs excluded),
  trimmed to the first ~300 characters each
- Timestamps for each exchange

Saves one condensed .md file per session into a retro/ directory, named by date
with an '_antigravity' tag to sit alongside Claude session logs without collision.
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

DEFAULT_BRAIN_DIR = Path(r"C:\Users\astev\.gemini\antigravity\brain")
DEFAULT_OUTPUT = Path("retro")


def clean_user_content(content: str) -> str:
    """Extract prompt text inside <USER_REQUEST> tags, stripping metadata wrappers."""
    if not isinstance(content, str):
        return ""

    m = re.search(r"<USER_REQUEST>([\s\S]*?)</USER_REQUEST>", content)
    if m:
        text = m.group(1).strip()
    else:
        text = content.strip()

    # Clean any stray metadata/settings tags
    text = re.sub(r"<ADDITIONAL_METADATA>[\s\S]*?</ADDITIONAL_METADATA>", "", text).strip()
    text = re.sub(r"<USER_SETTINGS_CHANGE>[\s\S]*?</USER_SETTINGS_CHANGE>", "", text).strip()
    return text


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

    snippet = text[:limit]
    last_space = snippet.rfind(" ")
    if last_space > limit - 50:
        snippet = snippet[:last_space]
    return snippet.rstrip() + "..."


def parse_antigravity_session(session_dir: Path, trim_limit: int = 300):
    """
    Parse a single Antigravity session directory from brain.
    Extracts only human user messages (USER_EXPLICIT/USER_INPUT) and assistant text replies (MODEL/PLANNER_RESPONSE).
    Skips tool calls, tool results (GENERIC), thinking blocks, and system messages.
    """
    log_file = session_dir / ".system_generated" / "logs" / "transcript_full.jsonl"
    if not log_file.exists():
        log_file = session_dir / ".system_generated" / "logs" / "transcript.jsonl"
        if not log_file.exists():
            return None

    entries = []
    session_id = session_dir.name
    first_timestamp = None
    last_timestamp = None

    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue

            ts = data.get("created_at")
            if ts:
                if first_timestamp is None:
                    first_timestamp = ts
                last_timestamp = ts

            src = data.get("source")
            t = data.get("type")

            # Extract user message: USER_EXPLICIT + USER_INPUT
            if src == "USER_EXPLICIT" and t == "USER_INPUT":
                raw_c = data.get("content", "")
                user_text = clean_user_content(raw_c)
                if user_text:
                    entries.append({
                        "role": "User",
                        "timestamp": ts,
                        "text": user_text,
                    })

            # Extract assistant reply: MODEL + PLANNER_RESPONSE with non-empty text content
            elif src == "MODEL" and t == "PLANNER_RESPONSE":
                raw_c = data.get("content")
                if raw_c and isinstance(raw_c, str) and raw_c.strip():
                    cleaned = strip_code_blocks(raw_c)
                    if cleaned:
                        trimmed = trim_reply(cleaned, limit=trim_limit)
                        entries.append({
                            "role": "Assistant",
                            "timestamp": ts,
                            "text": trimmed,
                        })

    if not entries:
        return None

    return {
        "session_id": session_id,
        "first_timestamp": first_timestamp or "Unknown",
        "last_timestamp": last_timestamp or "Unknown",
        "entries": entries,
    }


def format_markdown(session_data: dict, session_idx: int = 1, total_for_date: int = 1) -> str:
    """Format session data into clean markdown."""
    start_date = session_data["first_timestamp"][:10] if session_data["first_timestamp"] != "Unknown" else "Unknown"
    title_suffix = f" (Session {session_idx} of {total_for_date})" if total_for_date > 1 else ""

    lines = [
        f"# Session Retro: Antigravity - {start_date}{title_suffix}",
        f"- **Assistant:** Antigravity",
        f"- **Session ID:** `{session_data['session_id']}`",
        f"- **Start Time:** {session_data['first_timestamp']}",
        f"- **End Time:** {session_data['last_timestamp']}",
        f"- **Exchanges:** {len(session_data['entries'])} turns ({sum(1 for e in session_data['entries'] if e['role'] == 'User')} user prompts, {sum(1 for e in session_data['entries'] if e['role'] == 'Assistant')} assistant replies)",
        "",
        "---",
        "",
    ]

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


def process_antigravity_sessions(brain_dir: Path, output_dir: Path, trim_limit: int = 300):
    """Process all session directories in brain_dir and write condensed .md to output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)

    parsed_sessions = []
    for d in sorted(brain_dir.iterdir()):
        if not d.is_dir() or d.name == "tempmediaStorage":
            continue
        s = parse_antigravity_session(d, trim_limit=trim_limit)
        if s:
            parsed_sessions.append(s)

    # Sort chronologically by start timestamp
    parsed_sessions.sort(key=lambda x: x["first_timestamp"])

    # Group by start date
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
                filename = f"{date_str}_antigravity.md"
            else:
                filename = f"{date_str}_antigravity_{idx}.md"

            out_path = output_dir / filename
            md_content = format_markdown(s, session_idx=idx, total_for_date=total_for_date)

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
    parser = argparse.ArgumentParser(description="Extract condensed Antigravity session retrospectives.")
    parser.add_argument("--brain-dir", type=Path, default=DEFAULT_BRAIN_DIR,
                        help="Path to Antigravity brain directory")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT,
                        help="Path to directory where condensed .md files will be saved")
    parser.add_argument("--trim-limit", type=int, default=300,
                        help="Character limit to trim assistant text replies (default: 300)")

    args = parser.parse_args()

    print(f"Reading Antigravity sessions from: {args.brain_dir}")
    print(f"Output directory:                  {args.output_dir}")
    print(f"Trimming assistant replies to ~{args.trim_limit} characters...")
    print("-" * 65)

    result = process_antigravity_sessions(args.brain_dir, args.output_dir, trim_limit=args.trim_limit)

    for item in result["files"]:
        print(f"  {item['filename']:<28} | {item['size_bytes']:>6} bytes ({item['size_bytes']/1024:>5.1f} KB) | "
              f"{item['user_count']:>2} user, {item['asst_count']:>2} asst | ~{item['approx_tokens']:>5} tokens")

    print("-" * 65)
    print(f"Total files:        {len(result['files'])}")
    print(f"Total size added:   {result['total_bytes']:,} bytes ({result['total_bytes'] / 1024:.2f} KB)")
    print(f"Total characters:   {result['total_chars']:,}")
    print(f"Total words:        {result['total_words']:,}")
    print(f"Estimated tokens:   ~{result['total_tokens_char_based']:,} (char-based: chars/4) to ~{result['total_tokens_word_based']:,} (word-based: words*1.33)")


if __name__ == "__main__":
    main()
