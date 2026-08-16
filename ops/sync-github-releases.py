#!/usr/bin/env python3
"""Create or update GitHub Releases from docs/version/release/*.md.

Requirements:
- git
- GitHub CLI (`gh`) authenticated, or GITHUB_TOKEN in GitHub Actions

Examples:
  python ops/sync-github-releases.py --all
  python ops/sync-github-releases.py --version 4.16.9 --target HEAD
  python ops/sync-github-releases.py --all --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT / "docs" / "version" / "release"
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
HEADING_RE = re.compile(r"^#\s+Release\s+v?(\d+\.\d+\.\d+)\s*[—-]\s*(.+?)\s*$", re.MULTILINE)
COMMIT_RANGE_RE = re.compile(
    r"Commit range\s*\|\s*`([0-9a-f]{7,40})`\s*\.\.\s*`([0-9a-f]{7,40})`",
    re.IGNORECASE,
)
RELEASED_RE = re.compile(
    r"\|\s*Released\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ReleaseNote:
    version: str
    title: str
    body: str
    path: Path
    documented_target: str | None
    released_date: str | None

    @property
    def tag(self) -> str:
        return f"v{self.version}"

    @property
    def release_title(self) -> str:
        return f"v{self.version} — {self.title}"


def run(
    *args: str,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = list(args)
    # Harmless on normal runners; also supports Windows workspaces whose
    # filesystem owner differs from the shell account running this script.
    if command and command[0] == "git":
        command[1:1] = ["-c", f"safe.directory={ROOT.as_posix()}"]
    return subprocess.run(
        command,
        cwd=ROOT,
        check=check,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=capture,
    )


def version_key(value: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in value.split("."))  # type: ignore[return-value]


def read_note(path: Path) -> ReleaseNote:
    body = path.read_text(encoding="utf-8")
    version = path.stem
    if not VERSION_RE.fullmatch(version):
        raise ValueError(f"Invalid release filename: {path.name}")
    heading = HEADING_RE.search(body)
    if not heading:
        raise ValueError(f"Missing '# Release vX.Y.Z — Title' heading: {path}")
    if heading.group(1) != version:
        raise ValueError(
            f"Heading version {heading.group(1)} does not match filename {version}: {path}",
        )
    commit_range = COMMIT_RANGE_RE.search(body)
    released = RELEASED_RE.search(body)
    return ReleaseNote(
        version=version,
        title=heading.group(2).strip(),
        body=body,
        path=path,
        documented_target=commit_range.group(2) if commit_range else None,
        released_date=released.group(1) if released else None,
    )


def all_notes() -> list[ReleaseNote]:
    notes = [read_note(path) for path in RELEASE_DIR.glob("*.md")]
    return sorted(notes, key=lambda note: version_key(note.version))


def commit_exists(commit: str) -> bool:
    return run("git", "cat-file", "-e", f"{commit}^{{commit}}", check=False).returncode == 0


def package_version_at(commit: str) -> str | None:
    result = run("git", "show", f"{commit}:package.json", check=False)
    if result.returncode != 0:
        return None
    try:
        return str(json.loads(result.stdout)["version"])
    except (KeyError, json.JSONDecodeError, TypeError):
        return None


def find_version_commit(version: str) -> str | None:
    """Find newest commit whose package.json declares the requested version."""
    history = run("git", "log", "--format=%H", "--", "package.json").stdout.splitlines()
    for commit in history:
        if package_version_at(commit) == version:
            return commit
    return None


def find_release_date_commit(released_date: str | None) -> str | None:
    if not released_date:
        return None
    result = run(
        "git",
        "rev-list",
        "-1",
        f"--before={released_date} 23:59:59 +0700",
        "--all",
        check=False,
    )
    return result.stdout.strip() or None


def resolve_target(note: ReleaseNote, explicit_target: str | None) -> str:
    candidates = [explicit_target, note.documented_target]
    for candidate in candidates:
        if candidate and commit_exists(candidate):
            return run("git", "rev-parse", candidate).stdout.strip()
    # Some legacy docs were reconstructed from an old history and contain
    # abbreviated hashes no longer reachable in the current repository.
    # Fall back to the last reachable commit on that documented release date.
    date_commit = find_release_date_commit(note.released_date)
    if date_commit and commit_exists(date_commit):
        return run("git", "rev-parse", date_commit).stdout.strip()
    version_commit = find_version_commit(note.version)
    if version_commit and commit_exists(version_commit):
        return run("git", "rev-parse", version_commit).stdout.strip()
    raise RuntimeError(
        f"Cannot resolve a git commit for {note.version}. "
        "Add a valid Commit range to its release note or pass --target.",
    )


def release_exists(tag: str) -> bool:
    return run("gh", "release", "view", tag, check=False).returncode == 0


def tag_exists(tag: str) -> bool:
    return run("git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}", check=False).returncode == 0


def sync_release(
    note: ReleaseNote,
    *,
    target: str,
    repo: str | None,
    latest: bool,
    dry_run: bool,
) -> None:
    repo_args = ["--repo", repo] if repo else []
    body_file = str(note.path)
    if dry_run:
        print(f"[dry-run] sync {note.tag} at {target[:12]} — {note.release_title}")
        return

    if release_exists(note.tag):
        command = [
            "gh",
            "release",
            "edit",
            note.tag,
            *repo_args,
            "--title",
            note.release_title,
            "--notes-file",
            body_file,
            "--latest" if latest else "--latest=false",
        ]
    else:
        # `gh release create --target` creates the annotated release tag on GitHub.
        command = [
            "gh",
            "release",
            "create",
            note.tag,
            *repo_args,
            "--target",
            target,
            "--title",
            note.release_title,
            "--notes-file",
            body_file,
            "--latest" if latest else "--latest=false",
        ]
    run(*command, capture=False)
    print(f"Synced {note.tag} at {target[:12]}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--all", action="store_true", help="Sync every documented release")
    scope.add_argument("--version", help="Sync one semantic version (without v prefix)")
    parser.add_argument(
        "--target",
        help="Explicit target commit (valid only with --version; defaults to docs/history)",
    )
    parser.add_argument("--repo", help="GitHub repository in OWNER/REPO form")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.all and args.target:
        print("--target can only be used with --version", file=sys.stderr)
        return 2

    notes = all_notes()
    selected = notes
    if args.version:
        version = args.version.removeprefix("v")
        selected = [note for note in notes if note.version == version]
        if not selected:
            print(f"Missing {RELEASE_DIR / f'{version}.md'}", file=sys.stderr)
            return 2

    latest_version = max((note.version for note in notes), key=version_key)
    failures: list[str] = []
    for note in selected:
        try:
            target = resolve_target(note, args.target)
            sync_release(
                note,
                target=target,
                repo=args.repo,
                latest=note.version == latest_version,
                dry_run=args.dry_run,
            )
        except Exception as exc:  # continue backfill and report all failures
            failures.append(f"{note.version}: {exc}")
            print(f"FAILED {note.version}: {exc}", file=sys.stderr)

    if failures:
        print("\nRelease sync failures:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"Release sync complete: {len(selected)} release(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
