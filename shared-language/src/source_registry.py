"""Read/verify Late Egyptian source governance and create publication gates.

A registered source is *not* evidence that its corpus was acquired or imported.
The registry is a research and ingestion policy, not a license override.
This module never performs network access and never copies copyrighted data.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

DEFAULT = Path(__file__).resolve().parents[1] / "sources/late_egyptian_registry.json"
RIGHTS = {"selected_open_data_only", "cc_by_sa_4", "permission_required", "per_file_cc_by_sa_or_cc0", "copyright_restricted"}
REQUIRED = ("id", "family", "label", "priority", "kind", "role", "version", "url", "rights", "availability", "ingestion", "publishable", "independence_group", "stage_policy")


def validate_registry(registry: dict) -> dict:
    if registry.get("schema") != 1 or registry.get("language") != "egy" or registry.get("stage") != "Late Egyptian":
        raise ValueError("Registry must be a v1 Late Egyptian source registry")
    sources = registry.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("Registry must contain source editions")
    names, priorities = set(), set()
    for source in sources:
        for field in REQUIRED:
            if field not in source or source[field] is None or source[field] == "":
                raise ValueError(f"Source missing field: {field}")
        if source["id"] in names or source["priority"] in priorities:
            raise ValueError("Duplicate source ID or priority")
        names.add(source["id"]); priorities.add(source["priority"])
        if source["rights"] not in RIGHTS:
            raise ValueError("Unknown source rights category")
        if type(source["publishable"]) is not bool:
            raise ValueError("publishable must be boolean")
        if source["publishable"] and source["rights"] not in {"cc_by_sa_4", "per_file_cc_by_sa_or_cc0"}:
            raise ValueError("Restricted source cannot be flagged publishable")
        if source["id"] == "LESKO-2ED" and (source["publishable"] or source["data_url"]):
            raise ValueError("Lesko is reference-only unless rights status is separately reauthorized")
        if source["id"] == "RAMSES" and source["publishable"]:
            raise ValueError("Ramsès bulk material needs documented permission")
    if len(sources) != 7 or {s["family"] for s in sources} != {"TLA", "Projet Ramsès", "AED/AES/ORAEC", "Lesko"}:
        raise ValueError("All agreed source families and both TLA editions must be present")
    if [s["priority"] for s in sources] != sorted(priorities):
        raise ValueError("Source priority order must be stable")
    return {"registered_editions": len(sources), "source_families": len({s["family"] for s in sources}),
            "eligible_after_verification": sum(s["publishable"] for s in sources),
            "not_automatically_redistributable": sum(not s["publishable"] for s in sources)}


def read_registry(path: Path = DEFAULT) -> dict:
    registry = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_registry(registry)
    return registry


def source_by_id(registry: dict, source_id: str) -> dict:
    return next((s for s in registry["sources"] if s["id"] == source_id), None)


def verified_source_manifest(registry: dict, pinned_files: dict[str, dict]) -> dict:
    """Build the Stage-0 pack compiler's source manifest from verified LOCAL bytes.

    pinned_files: {sourceId: {path: '/local/source', version: 'verified edition',
                              sha256: '64 lowercase hex', license: 'verified per-file license',
                              attribution: 'source contributors'}}.
    This is a fail-closed boundary: registry inclusion alone cannot publish data.
    """
    validate_registry(registry)
    if not pinned_files:
        raise ValueError("No actually acquired and pinned corpus files")
    output = []
    for source_id, info in pinned_files.items():
        source = source_by_id(registry, source_id)
        if source is None:
            raise ValueError("Unregistered corpus: " + source_id)
        if not source["publishable"]:
            raise PermissionError("Source edition requires additional rights before publication: " + source_id)
        if any(not info.get(k) for k in ("path", "version", "sha256", "license", "attribution")):
            raise ValueError("Missing file, pinned hash, version, rights or attribution: " + source_id)
        if not re.fullmatch(r"[0-9a-f]{64}", info["sha256"]):
            raise ValueError("Invalid sha256 pin")
        if source["rights"] == "cc_by_sa_4" and info["license"].strip().upper() not in {"CC-BY-SA-4.0", "CC BY-SA 4.0"}:
            raise ValueError("License mismatch for " + source_id)
        if source["rights"] == "per_file_cc_by_sa_or_cc0" and info["license"].strip().upper() not in {"CC0", "CC0-1.0", "CC-BY-SA-4.0", "CC BY-SA 4.0"}:
            raise ValueError("Unsupported selected ORAEC file license")
        path = Path(info["path"])
        if not path.is_file() or not path.stat().st_size:
            raise FileNotFoundError("Missing or empty data file: " + str(path))
        with path.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        if digest != info["sha256"]:
            raise ValueError("Source SHA-256 mismatch: " + source_id)
        output.append(dict(id=source_id, version=info["version"], license=info["license"],
                           attribution=info["attribution"], url=source["data_url"],
                           sha256=digest, lineage=source["independence_group"]))
    return {"schema": 1, "sources": output}


def main():
    parser=argparse.ArgumentParser(description="Audit the approved Late Egyptian source registry")
    parser.add_argument("command", choices=["status", "validate"])
    parser.add_argument("--registry", type=Path, default=DEFAULT)
    args=parser.parse_args()
    data=read_registry(args.registry)
    summary=validate_registry(data)
    if args.command == "status":
        for s in data["sources"]:
            tag="ELIGIBLE_AFTER_PINNING" if s["publishable"] else "NO_AUTOMATIC_DISTRIBUTION"
            print(f"{s['priority']:02d} {s['id']:<12} {tag:<28} {s['ingestion']}")
    print(json.dumps(summary, sort_keys=True))

if __name__ == "__main__":
    main()
