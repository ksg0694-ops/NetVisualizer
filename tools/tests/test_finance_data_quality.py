from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / "tools"))

from finance_data_quality import (  # noqa: E402
    approved_refund_delete_candidates,
    audit_transactions,
    confirmed_bonus_reclassification_candidates,
    confirmed_historical_refund_delete_candidates,
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
    transaction_type: str = "수입",
    subcategory: str = "미분류",
) -> dict:
    return {
        "id": row_id,
        "user_id": "owner",
        "date": date,
        "time": time,
        "type": transaction_type,
        "category": category,
        "subcategory": subcategory,
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

    def test_confirmed_historical_repair_is_date_bounded(self) -> None:
        rows = [
            transaction("legacy-old", date="2026-05-07", amount=50000),
            transaction(
                "welfare-old",
                date="2026-05-07",
                category="복지포인트",
                amount=50000,
            ),
            transaction("legacy-too-old", date="2025-12-31", amount=30000),
            transaction(
                "welfare-too-old",
                date="2025-12-31",
                category="복지포인트",
                amount=30000,
            ),
        ]

        self.assertEqual(len(welfare_refund_overlap_candidates(rows)), 2)
        self.assertEqual(approved_refund_delete_candidates(rows), [])
        self.assertEqual(
            [row["id"] for row in confirmed_historical_refund_delete_candidates(rows)],
            ["legacy-old"],
        )
        audit = audit_transactions(rows)
        self.assertEqual(audit["approved_repair"]["candidate_rows"], 0)
        self.assertEqual(audit["unapproved_welfare_overlap"]["candidate_rows"], 1)
        self.assertEqual(audit["unapproved_welfare_overlap"]["absolute_income_impact"], 30000)
        self.assertEqual(audit["confirmed_historical_repair"]["candidate_rows"], 1)
        self.assertEqual(audit["confirmed_historical_repair"]["absolute_income_impact"], 50000)

    def test_confirmed_bonus_pair_is_retained_and_reclassified(self) -> None:
        rows = [
            transaction(
                "bonus-legacy",
                date="2026-04-09",
                category="금융수입",
                subcategory="금융수입",
                memo="성과급",
                amount=800000,
            ),
            transaction(
                "bonus-confirmed",
                date="2026-04-09",
                category="상여금",
                subcategory="상여금",
                memo="성과급",
                amount=800000,
            ),
        ]

        audit = audit_transactions(rows)

        self.assertEqual(audit["uniqueness"]["classification_conflict_groups"], 0)
        self.assertEqual(audit["uniqueness"]["confirmed_bonus_repeat_groups"], 1)
        self.assertEqual(audit["confirmed_bonus_repeat"]["retained_rows"], 2)
        self.assertEqual(
            [row["id"] for row in confirmed_bonus_reclassification_candidates(rows)],
            ["bonus-legacy"],
        )

    def test_confirmed_bonus_pair_is_not_an_exact_duplicate_candidate(self) -> None:
        rows = [
            transaction(
                "bonus-1",
                date="2026-04-09",
                category="상여금",
                subcategory="상여금",
                memo="성과급",
                amount=800000,
            ),
            transaction(
                "bonus-2",
                date="2026-04-09",
                category="상여금",
                subcategory="상여금",
                memo="성과급",
                amount=800000,
            ),
        ]

        audit = audit_transactions(rows)

        self.assertEqual(audit["uniqueness"]["exact_duplicate_groups"], 0)
        self.assertEqual(audit["uniqueness"]["confirmed_bonus_repeat_groups"], 1)
        self.assertEqual(audit["confirmed_bonus_repeat"]["reclassification_candidates"], 0)

    def test_transfer_duplicates_are_reported_outside_calculation_candidates(self) -> None:
        rows = [
            transaction(
                "transfer-1",
                date="2026-02-07",
                category="이체",
                memo="계좌이동",
                amount=2000000,
                transaction_type="이체",
            ),
            transaction(
                "transfer-2",
                date="2026-02-07",
                category="이체",
                memo="계좌이동",
                amount=2000000,
                transaction_type="이체",
            ),
        ]

        audit = audit_transactions(rows)

        self.assertEqual(audit["uniqueness"]["exact_duplicate_groups"], 0)
        self.assertEqual(audit["uniqueness"]["excluded_transfer_duplicate_groups"], 1)
        self.assertEqual(audit["uniqueness"]["excluded_transfer_absolute_amount"], 2000000)


if __name__ == "__main__":
    unittest.main()
