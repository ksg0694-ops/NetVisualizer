from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / "tools"))

from finance_data_quality import (  # noqa: E402
    approved_refund_delete_candidates,
    audit_transactions,
    welfare_refund_overlap_candidates,
)


def transaction(
    row_id: str,
    *,
    date: str = "2026-06-29",
    time: str = "13:31:33",
    category: str = "기타수입",
    memo: str = "복리후생환불",
    amount: int = 10000,
) -> dict:
    return {
        "id": row_id,
        "user_id": "owner",
        "date": date,
        "time": time,
        "type": "수입",
        "category": category,
        "subcategory": "미분류",
        "memo": memo,
        "amount": amount,
        "currency": "KRW",
        "method": "월급통장",
        "source": "manual",
        "source_message_id": None,
        "dedupe_key": None,
    }


class FinanceDataQualityTests(unittest.TestCase):
    def test_audit_separates_exact_duplicates_from_classification_conflicts(self) -> None:
        rows = [
            transaction("legacy-1"),
            transaction("legacy-2"),
            transaction("welfare-1", category="복지포인트"),
            transaction("normal-1", memo="환급경기파주", amount=1000),
        ]

        audit = audit_transactions(rows)

        self.assertEqual(audit["uniqueness"]["exact_duplicate_groups"], 1)
        self.assertEqual(audit["uniqueness"]["exact_duplicate_extra_rows"], 1)
        self.assertEqual(audit["uniqueness"]["classification_conflict_groups"], 1)
        self.assertEqual(audit["approved_repair"]["candidate_rows"], 2)
        self.assertEqual(audit["approved_repair"]["absolute_income_impact"], 20000)

    def test_approved_repair_is_guarded_by_matching_welfare_row(self) -> None:
        rows = [
            transaction("legacy-1", amount=10000),
            transaction("welfare-1", category="복지포인트", amount=10000),
            transaction("legacy-unmatched", amount=12000),
            transaction("unrelated", memo="환급경기파주", amount=1000),
        ]

        candidate_ids = [row["id"] for row in approved_refund_delete_candidates(rows)]

        self.assertEqual(candidate_ids, ["legacy-1"])

    def test_approved_match_allows_known_timestamp_copy_variation(self) -> None:
        rows = [
            transaction("legacy", time="13:17:09", amount=10100),
            transaction("welfare", time="13:17:00", category="복지포인트", amount=10100),
        ]

        self.assertEqual(
            [row["id"] for row in approved_refund_delete_candidates(rows)],
            ["legacy"],
        )

    def test_approved_repair_excludes_unreviewed_historical_overlap(self) -> None:
        rows = [
            transaction("legacy-old", date="2026-05-07", amount=50000),
            transaction(
                "welfare-old",
                date="2026-05-07",
                category="복지포인트",
                amount=50000,
            ),
        ]

        self.assertEqual(len(welfare_refund_overlap_candidates(rows)), 1)
        self.assertEqual(approved_refund_delete_candidates(rows), [])
        audit = audit_transactions(rows)
        self.assertEqual(audit["approved_repair"]["candidate_rows"], 0)
        self.assertEqual(audit["unapproved_welfare_overlap"]["candidate_rows"], 1)
        self.assertEqual(audit["unapproved_welfare_overlap"]["absolute_income_impact"], 50000)


if __name__ == "__main__":
    unittest.main()
