from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from zoneinfo import ZoneInfo

import requests


ALLOWED_TYPES = {"수입", "지출", "이체"}
APPROVED_REFUND_MEMO = "복리후생환불"
LEGACY_REFUND_CATEGORY = "기타수입"
TARGET_REFUND_CATEGORY = "복지포인트"
APPROVED_PERIOD_START = "2026-06-25"
APPROVED_PERIOD_END = "2026-07-23"
CONFIRMED_HISTORICAL_PERIOD_START = "2026-01-01"
CONFIRMED_HISTORICAL_PERIOD_END = "2026-06-30"
CONFIRMED_BONUS_DATE = "2026-04-09"
CONFIRMED_BONUS_AMOUNT = 800000
LEGACY_BONUS_CATEGORY = "금융수입"
CONFIRMED_BONUS_CATEGORY = "상여금"
PAGE_SIZE = 1000
TRANSACTION_SELECT = ",".join(
    [
        "id",
        "user_id",
        "date",
        "time",
        "type",
        "category",
        "subcategory",
        "memo",
        "amount",
        "currency",
        "method",
        "source",
        "source_message_id",
        "dedupe_key",
        "created_at",
        "updated_at",
    ]
)


class AuditError(RuntimeError):
    pass


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise AuditError(f"missing_env_{name.lower()}")
    return value


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value if value is not None else ""))
    return " ".join(text.split()).strip()


def normalize_identity_text(value: Any) -> str:
    text = normalize_text(value).lower()
    return "".join(character for character in text if character.isalnum())


def amount_value(value: Any) -> int:
    return int(Decimal(str(value or 0)))


def time_value(value: Any) -> str:
    return normalize_text(value).split("+")[0]


def event_identity(row: Mapping[str, Any]) -> tuple[Any, ...]:
    """Classification-agnostic identity for one exported financial event."""
    return (
        normalize_text(row.get("date")),
        time_value(row.get("time")),
        normalize_text(row.get("type")),
        amount_value(row.get("amount")),
        normalize_identity_text(row.get("memo")),
        normalize_identity_text(row.get("method")),
        normalize_text(row.get("currency")).upper() or "KRW",
    )


def exact_business_key(row: Mapping[str, Any]) -> tuple[Any, ...]:
    return (
        *event_identity(row),
        normalize_text(row.get("category")),
        normalize_text(row.get("subcategory")),
    )


def approved_refund_match_key(row: Mapping[str, Any]) -> tuple[Any, ...]:
    """Guarded legacy matcher; time is omitted for one known copied timestamp."""
    return (
        normalize_text(row.get("date")),
        normalize_text(row.get("type")),
        amount_value(row.get("amount")),
        normalize_identity_text(row.get("memo")),
        normalize_identity_text(row.get("method")),
        normalize_text(row.get("currency")).upper() or "KRW",
    )


def group_rows(rows: Iterable[Mapping[str, Any]], key_builder) -> dict[tuple[Any, ...], list[Mapping[str, Any]]]:
    grouped: dict[tuple[Any, ...], list[Mapping[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[key_builder(row)].append(row)
    return grouped


def welfare_refund_overlap_candidates(rows: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    refund_rows = [
        row
        for row in rows
        if normalize_text(row.get("type")) == "수입"
        and normalize_identity_text(row.get("memo")) == normalize_identity_text(APPROVED_REFUND_MEMO)
        and normalize_text(row.get("category")) in {LEGACY_REFUND_CATEGORY, TARGET_REFUND_CATEGORY}
    ]
    grouped = group_rows(refund_rows, approved_refund_match_key)
    candidates: list[Mapping[str, Any]] = []
    for group in grouped.values():
        categories = {normalize_text(row.get("category")) for row in group}
        if TARGET_REFUND_CATEGORY not in categories or LEGACY_REFUND_CATEGORY not in categories:
            continue
        candidates.extend(
            row for row in group if normalize_text(row.get("category")) == LEGACY_REFUND_CATEGORY
        )
    return sorted(candidates, key=lambda row: str(row.get("id") or ""))


def approved_refund_delete_candidates(rows: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    return [
        row
        for row in welfare_refund_overlap_candidates(rows)
        if APPROVED_PERIOD_START <= normalize_text(row.get("date")) <= APPROVED_PERIOD_END
    ]


def confirmed_historical_refund_delete_candidates(
    rows: Sequence[Mapping[str, Any]],
) -> list[Mapping[str, Any]]:
    return [
        row
        for row in welfare_refund_overlap_candidates(rows)
        if CONFIRMED_HISTORICAL_PERIOD_START
        <= normalize_text(row.get("date"))
        <= CONFIRMED_HISTORICAL_PERIOD_END
    ]


def is_confirmed_bonus_repeat(group: Sequence[Mapping[str, Any]]) -> bool:
    if len(group) != 2:
        return False
    categories = {normalize_text(row.get("category")) for row in group}
    return (
        normalize_text(group[0].get("date")) == CONFIRMED_BONUS_DATE
        and normalize_text(group[0].get("type")) == "수입"
        and amount_value(group[0].get("amount")) == CONFIRMED_BONUS_AMOUNT
        and categories.issubset({LEGACY_BONUS_CATEGORY, CONFIRMED_BONUS_CATEGORY})
        and CONFIRMED_BONUS_CATEGORY in categories
    )


def confirmed_bonus_repeat_groups(
    rows: Sequence[Mapping[str, Any]],
) -> list[list[Mapping[str, Any]]]:
    identity_groups = group_rows(rows, event_identity).values()
    return [list(group) for group in identity_groups if is_confirmed_bonus_repeat(group)]


def confirmed_bonus_reclassification_candidates(
    rows: Sequence[Mapping[str, Any]],
) -> list[Mapping[str, Any]]:
    candidates = [
        row
        for group in confirmed_bonus_repeat_groups(rows)
        for row in group
        if normalize_text(row.get("category")) != CONFIRMED_BONUS_CATEGORY
        or normalize_text(row.get("subcategory")) != CONFIRMED_BONUS_CATEGORY
    ]
    return sorted(candidates, key=lambda row: str(row.get("id") or ""))


def hashed_key(key: tuple[Any, ...]) -> str:
    serialized = json.dumps(key, ensure_ascii=False, separators=(",", ":"), default=str)
    return sha256(serialized.encode("utf-8")).hexdigest()[:12]


def audit_transactions(rows: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    raw_exact_groups = [
        group for group in group_rows(rows, exact_business_key).values() if len(group) > 1
    ]
    identity_groups = [group for group in group_rows(rows, event_identity).values() if len(group) > 1]
    confirmed_bonus_groups = [group for group in identity_groups if is_confirmed_bonus_repeat(group)]
    transfer_exact_groups = [
        group for group in raw_exact_groups if normalize_text(group[0].get("type")) == "이체"
    ]
    exact_groups = [
        group
        for group in raw_exact_groups
        if normalize_text(group[0].get("type")) != "이체"
        and not is_confirmed_bonus_repeat(group)
    ]
    raw_conflicts = [
        group
        for group in identity_groups
        if len({normalize_text(row.get("category")) for row in group}) > 1
        or len({normalize_text(row.get("subcategory")) for row in group}) > 1
    ]
    conflicts = [group for group in raw_conflicts if not is_confirmed_bonus_repeat(group)]
    overlap_candidates = welfare_refund_overlap_candidates(rows)
    repair_candidates = approved_refund_delete_candidates(rows)
    historical_repair_candidates = confirmed_historical_refund_delete_candidates(rows)
    bonus_reclassification_candidates = confirmed_bonus_reclassification_candidates(rows)
    repair_candidate_ids = {normalize_text(row.get("id")) for row in repair_candidates}
    historical_repair_candidate_ids = {
        normalize_text(row.get("id")) for row in historical_repair_candidates
    }
    unapproved_overlap = [
        row
        for row in overlap_candidates
        if normalize_text(row.get("id")) not in repair_candidate_ids
        and normalize_text(row.get("id")) not in historical_repair_candidate_ids
    ]
    dates = sorted(normalize_text(row.get("date")) for row in rows if normalize_text(row.get("date")))
    today = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
    ids = [normalize_text(row.get("id")) for row in rows if normalize_text(row.get("id"))]
    source_counts = Counter(normalize_text(row.get("source")) or "legacy" for row in rows)
    month_counts = Counter(
        normalize_text(row.get("date"))[:7]
        for row in rows
        if len(normalize_text(row.get("date"))) >= 7
    )
    missing_required = sum(
        1
        for row in rows
        if not normalize_text(row.get("id"))
        or not normalize_text(row.get("date"))
        or not normalize_text(row.get("type"))
        or not normalize_text(row.get("currency"))
    )
    exact_examples = [
        {
            "key_hash": hashed_key(exact_business_key(group[0])),
            "date": normalize_text(group[0].get("date")),
            "type": normalize_text(group[0].get("type")),
            "rows": len(group),
            "extra_rows": len(group) - 1,
            "absolute_extra_amount": abs(amount_value(group[0].get("amount"))) * (len(group) - 1),
        }
        for group in sorted(exact_groups, key=lambda item: str(exact_business_key(item[0])))[:20]
    ]
    conflict_examples = [
        {
            "key_hash": hashed_key(event_identity(group[0])),
            "date": normalize_text(group[0].get("date")),
            "type": normalize_text(group[0].get("type")),
            "rows": len(group),
            "categories": sorted({normalize_text(row.get("category")) for row in group}),
            "absolute_amount": abs(amount_value(group[0].get("amount"))),
        }
        for group in sorted(conflicts, key=lambda item: str(event_identity(item[0])))[:20]
    ]
    approved_impact = sum(abs(amount_value(row.get("amount"))) for row in repair_candidates)
    severity = (
        "critical"
        if exact_groups
        or conflicts
        or historical_repair_candidates
        or bonus_reclassification_candidates
        else "low"
    )
    return {
        "generated_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat(),
        "status": (
            "issues_found"
            if exact_groups
            or conflicts
            or historical_repair_candidates
            or bonus_reclassification_candidates
            or missing_required
            else "clean"
        ),
        "severity": severity,
        "grain": "one financial event per transaction row",
        "profile": {
            "rows": len(rows),
            "unique_ids": len(set(ids)),
            "first_date": dates[0] if dates else None,
            "last_date": dates[-1] if dates else None,
            "source_counts": dict(sorted(source_counts.items())),
            "month_counts": dict(sorted(month_counts.items())),
        },
        "validity": {
            "missing_required_rows": missing_required,
            "invalid_type_rows": sum(
                1 for row in rows if normalize_text(row.get("type")) not in ALLOWED_TYPES
            ),
            "zero_amount_rows": sum(1 for row in rows if amount_value(row.get("amount")) == 0),
            "future_date_rows": sum(
                1 for row in rows if normalize_text(row.get("date")) > today
            ),
            "missing_dedupe_key_rows": sum(
                1 for row in rows if not normalize_text(row.get("dedupe_key"))
            ),
        },
        "uniqueness": {
            "exact_duplicate_groups": len(exact_groups),
            "exact_duplicate_extra_rows": sum(len(group) - 1 for group in exact_groups),
            "exact_duplicate_absolute_impact": sum(
                abs(amount_value(group[0].get("amount"))) * (len(group) - 1)
                for group in exact_groups
            ),
            "identity_duplicate_groups": len(identity_groups),
            "classification_conflict_groups": len(conflicts),
            "classification_conflict_rows": sum(len(group) for group in conflicts),
            "exact_examples": exact_examples,
            "conflict_examples": conflict_examples,
            "excluded_transfer_duplicate_groups": len(transfer_exact_groups),
            "excluded_transfer_extra_rows": sum(
                len(group) - 1 for group in transfer_exact_groups
            ),
            "excluded_transfer_absolute_amount": sum(
                abs(amount_value(group[0].get("amount"))) * (len(group) - 1)
                for group in transfer_exact_groups
            ),
            "confirmed_bonus_repeat_groups": len(confirmed_bonus_groups),
            "confirmed_bonus_repeat_rows": sum(len(group) for group in confirmed_bonus_groups),
        },
        "approved_repair": {
            "rule": "matched_welfare_refund_legacy_category",
            "period_start": APPROVED_PERIOD_START,
            "period_end": APPROVED_PERIOD_END,
            "candidate_rows": len(repair_candidates),
            "absolute_income_impact": approved_impact,
        },
        "unapproved_welfare_overlap": {
            "candidate_rows": len(unapproved_overlap),
            "absolute_income_impact": sum(
                abs(amount_value(row.get("amount"))) for row in unapproved_overlap
            ),
            "month_counts": dict(
                sorted(
                    Counter(
                        normalize_text(row.get("date"))[:7]
                        for row in unapproved_overlap
                        if len(normalize_text(row.get("date"))) >= 7
                    ).items()
                )
            ),
        },
        "confirmed_historical_repair": {
            "rule": "matched_welfare_refund_legacy_category",
            "period_start": CONFIRMED_HISTORICAL_PERIOD_START,
            "period_end": CONFIRMED_HISTORICAL_PERIOD_END,
            "candidate_rows": len(historical_repair_candidates),
            "absolute_income_impact": sum(
                abs(amount_value(row.get("amount"))) for row in historical_repair_candidates
            ),
            "month_counts": dict(
                sorted(
                    Counter(
                        normalize_text(row.get("date"))[:7]
                        for row in historical_repair_candidates
                        if len(normalize_text(row.get("date"))) >= 7
                    ).items()
                )
            ),
        },
        "confirmed_bonus_repeat": {
            "date": CONFIRMED_BONUS_DATE,
            "amount_each": CONFIRMED_BONUS_AMOUNT,
            "matched_groups": len(confirmed_bonus_groups),
            "retained_rows": sum(len(group) for group in confirmed_bonus_groups),
            "reclassification_candidates": len(bonus_reclassification_candidates),
            "target_category": CONFIRMED_BONUS_CATEGORY,
        },
    }


class SupabaseAuditClient:
    def __init__(self, url: str, service_role_key: str, owner_user_id: str) -> None:
        self.url = url.rstrip("/")
        self.owner_user_id = owner_user_id
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json",
            }
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        response = self.session.request(method, f"{self.url}/rest/v1/{path}", timeout=45, **kwargs)
        if not response.ok:
            raise AuditError(f"supabase_http_{response.status_code}")
        return response

    def list_transactions(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        start = 0
        while True:
            response = self._request(
                "GET",
                "transactions",
                params={
                    "select": TRANSACTION_SELECT,
                    "user_id": f"eq.{self.owner_user_id}",
                    "order": "date.asc,time.asc,id.asc",
                },
                headers={"Range": f"{start}-{start + PAGE_SIZE - 1}"},
            )
            batch = response.json()
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            start += PAGE_SIZE
        return rows

    def delete_transaction_ids(self, transaction_ids: Sequence[str]) -> int:
        deleted = 0
        for start in range(0, len(transaction_ids), 100):
            batch = list(transaction_ids[start : start + 100])
            response = self._request(
                "DELETE",
                "transactions",
                params={
                    "user_id": f"eq.{self.owner_user_id}",
                    "id": f"in.({','.join(batch)})",
                },
                headers={"Prefer": "return=representation"},
            )
            deleted += len(response.json())
        return deleted

    def update_transaction_ids(
        self,
        transaction_ids: Sequence[str],
        values: Mapping[str, Any],
    ) -> int:
        updated = 0
        for start in range(0, len(transaction_ids), 100):
            batch = list(transaction_ids[start : start + 100])
            response = self._request(
                "PATCH",
                "transactions",
                params={
                    "user_id": f"eq.{self.owner_user_id}",
                    "id": f"in.({','.join(batch)})",
                },
                json=dict(values),
                headers={"Prefer": "return=representation"},
            )
            updated += len(response.json())
        return updated


def build_client_from_env() -> SupabaseAuditClient:
    return SupabaseAuditClient(
        require_env("SUPABASE_URL"),
        require_env("SUPABASE_SERVICE_ROLE_KEY"),
        require_env("NETVISUALIZER_OWNER_USER_ID"),
    )


def write_summary(path: str, summary: Mapping[str, Any]) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit NetVisualizer transaction data quality.")
    parser.add_argument("--repair-approved-income-overlap", action="store_true")
    parser.add_argument("--repair-confirmed-historical-income", action="store_true")
    parser.add_argument("--output", default="")
    return parser.parse_args(argv)


def run(args: argparse.Namespace) -> int:
    client = build_client_from_env()
    before_rows = client.list_transactions()
    before = audit_transactions(before_rows)
    result: dict[str, Any] = {"before": before, "repair": {"requested": False}}

    if args.repair_approved_income_overlap:
        candidates = approved_refund_delete_candidates(before_rows)
        candidate_ids = [normalize_text(row.get("id")) for row in candidates]
        if any(not transaction_id for transaction_id in candidate_ids):
            raise AuditError("repair_candidate_missing_id")
        deleted = client.delete_transaction_ids(candidate_ids) if candidate_ids else 0
        if deleted != len(candidate_ids):
            raise AuditError("repair_delete_count_mismatch")
        after_rows = client.list_transactions()
        after = audit_transactions(after_rows)
        if after["approved_repair"]["candidate_rows"] != 0:
            raise AuditError("repair_postcheck_failed")
        if len(before_rows) - len(after_rows) != deleted:
            raise AuditError("repair_row_count_mismatch")
        result["repair"] = {
            "requested": True,
            "deleted_rows": deleted,
            "absolute_income_impact": before["approved_repair"]["absolute_income_impact"],
        }
        result["after"] = after

    if args.repair_confirmed_historical_income:
        current_rows = client.list_transactions()
        current = audit_transactions(current_rows)
        refund_candidates = confirmed_historical_refund_delete_candidates(current_rows)
        bonus_candidates = confirmed_bonus_reclassification_candidates(current_rows)
        refund_ids = [normalize_text(row.get("id")) for row in refund_candidates]
        bonus_ids = [normalize_text(row.get("id")) for row in bonus_candidates]
        if any(not transaction_id for transaction_id in [*refund_ids, *bonus_ids]):
            raise AuditError("confirmed_repair_candidate_missing_id")
        bonus_rule = current["confirmed_bonus_repeat"]
        if bonus_rule["matched_groups"] != 1 or bonus_rule["retained_rows"] != 2:
            raise AuditError("confirmed_bonus_repeat_precheck_failed")
        reclassified = (
            client.update_transaction_ids(
                bonus_ids,
                {
                    "category": CONFIRMED_BONUS_CATEGORY,
                    "subcategory": CONFIRMED_BONUS_CATEGORY,
                },
            )
            if bonus_ids
            else 0
        )
        if reclassified != len(bonus_ids):
            raise AuditError("confirmed_bonus_update_count_mismatch")
        deleted = client.delete_transaction_ids(refund_ids) if refund_ids else 0
        if deleted != len(refund_ids):
            raise AuditError("confirmed_refund_delete_count_mismatch")
        after_rows = client.list_transactions()
        after = audit_transactions(after_rows)
        if after["confirmed_historical_repair"]["candidate_rows"] != 0:
            raise AuditError("confirmed_refund_postcheck_failed")
        if after["confirmed_bonus_repeat"]["reclassification_candidates"] != 0:
            raise AuditError("confirmed_bonus_postcheck_failed")
        if after["confirmed_bonus_repeat"]["retained_rows"] != 2:
            raise AuditError("confirmed_bonus_row_count_changed")
        if len(current_rows) - len(after_rows) != deleted:
            raise AuditError("confirmed_repair_row_count_mismatch")
        result["confirmed_historical_repair"] = {
            "requested": True,
            "deleted_welfare_rows": deleted,
            "removed_duplicate_income": current["confirmed_historical_repair"][
                "absolute_income_impact"
            ],
            "reclassified_bonus_rows": reclassified,
            "retained_bonus_rows": after["confirmed_bonus_repeat"]["retained_rows"],
        }
        result["after_confirmed_historical_repair"] = after

    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output:
        write_summary(args.output, result)
    return 0


def main() -> int:
    try:
        return run(parse_args())
    except Exception as error:
        code = str(error) if isinstance(error, AuditError) else error.__class__.__name__
        print(json.dumps({"status": "failed", "error_code": code[:120]}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
