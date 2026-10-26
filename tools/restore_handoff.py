#!/usr/bin/env python3
"""Restore FILE blocks without overwriting different files. Offline only."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath


def parse_bundle(source):
    fence = chr(96) * 6
    pattern = re.compile(
        r"^## FILE: ([^\r\n]+)\r?\n\r?\n"
        + fence
        + r"[^\r\n]*\r?\n(.*?)^"
        + fence
        + r"\r?$",
        re.MULTILINE | re.DOTALL,
    )
    files = {}
    for match in pattern.finditer(source):
        name, body = match.group(1), match.group(2)
        path = PurePosixPath(name)
        if (
            path.is_absolute()
            or "\\" in name
            or any(part in ("", ".", "..") for part in name.split("/"))
            or ":" in name
            or name in files
        ):
            raise ValueError("Unsafe or duplicate FILE path: " + name)
        files[name] = body.replace("\r\n", "\n").encode("utf-8")
    if "MANIFEST.json" not in files:
        raise ValueError("Missing manifest")
    manifest = json.loads(files["MANIFEST.json"])
    declared = manifest["files"]
    expected = set(declared) | {"MANIFEST.json"}
    if set(files) != expected or len(files) != manifest["totalFileCount"]:
        raise ValueError("FILE count or path set differs from manifest")
    for name, item in declared.items():
        data = files[name]
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("Content checksum mismatch: " + name)
    return files


def restore(files, destination):
    destination = destination.absolute()
    # Reject symlink parents before resolve; never follow them into another tree.
    for parent in [destination, *destination.parents]:
        if parent.is_symlink():
            raise ValueError("Symlink destination is not allowed")
    planned = []
    for name, data in files.items():
        target = destination.joinpath(*PurePosixPath(name).parts)
        for parent in [target, *target.parents]:
            if parent.is_symlink():
                raise ValueError("Symlink target is not allowed: " + name)
            if parent != target and parent.exists() and not parent.is_dir():
                raise ValueError("Parent is not a directory: " + name)
        if target.exists():
            if not target.is_file() or target.read_bytes() != data:
                raise ValueError("Refusing to overwrite a different file: " + name)
        planned.append((target, data))
    # Validate everything before writing, so conflicts do not cause partial restores.
    for target, data in planned:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            with target.open("xb") as output:
                output.write(data)
    return len(planned)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    files = parse_bundle(args.bundle.read_text(encoding="utf-8"))
    count = restore(files, args.output)
    print(json.dumps({"status": "RESTORED", "files": count, "output": str(args.output.absolute())}))


if __name__ == "__main__":
    main()
