from __future__ import annotations

import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

import pyzipper
from openpyxl import Workbook


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / "tools"))

from banksalad_mail_sync import (  # noqa: E402
    NormalizedTransaction,
    ZipPasswordError,
    decrypt_workbook_from_zip,
    normalize_date,
    normalize_time,
    parse_workbook_bytes,
)


def build_test_workbook() -> bytes:
    workbook = Workbook()
    status = workbook.active
    status.title = "뱅샐현황"
    status.append(["고객명", "테스트"])
    status.append(["총자산", 1000000])

    ledger = workbook.create_sheet("가계부 내역")
    ledger.append(["날짜", "시간", "타입", "대분류", "소분류", "내용", "금액", "화폐", "결제수단", "메모"])
    ledger.append(["2026-08-01", "09:10", "지출", "식비", "외식", "점심", -12000, "KRW", "생활비통장", ""])
    ledger.append(["2026-08-01", "09:10", "지출", "식비", "외식", "점심", -12000, "KRW", "생활비통장", ""])
    ledger.append(["2026-08-01", "12:00", "수입", "급여", "월급", "급여", -4000000, "KRW", "월급통장", ""])
    ledger.append(["2026-08-02", "13:00", "이체", "내계좌이체", "통장이동", "생활비 이동", -500000, "KRW", "월급통장", ""])
    ledger.append(["not-a-date", "", "지출", "미분류", "미분류", "오류", -1, "KRW", "", ""])
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def build_encrypted_zip(workbook_bytes: bytes, password: str) -> bytes:
    output = io.BytesIO()
    with pyzipper.AESZipFile(output, "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as archive:
        archive.setpassword(password.encode("utf-8"))
        archive.writestr("2026-08-01~2026-08-02.xlsx", workbook_bytes)
    return output.getvalue()


class BankSaladParserTests(unittest.TestCase):
    def test_selects_ledger_normalizes_signs_and_removes_exact_duplicates(self) -> None:
        result = parse_workbook_bytes(build_test_workbook())

        self.assertEqual(result.sheet_name, "가계부 내역")
        self.assertEqual(result.rows_seen, 5)
        self.assertEqual(result.duplicate_rows, 1)
        self.assertEqual(result.invalid_rows, 1)
        self.assertEqual(len(result.transactions), 3)
        self.assertEqual(result.transactions[0].amount, -12000)
        self.assertEqual(result.transactions[1].type, "수입")
        self.assertEqual(result.transactions[1].amount, 4000000)
        self.assertEqual(result.transactions[2].type, "이체")
        self.assertEqual(result.transactions[2].amount, -500000)

    def test_transaction_fingerprints_are_stable(self) -> None:
        first = parse_workbook_bytes(build_test_workbook()).transactions[0]
        second = parse_workbook_bytes(build_test_workbook()).transactions[0]
        self.assertEqual(first.fingerprint(), second.fingerprint())
        self.assertEqual(len(first.fingerprint()), 64)

    def test_transaction_fingerprint_ignores_classification_changes(self) -> None:
        base = NormalizedTransaction(
            date="2026-06-29",
            time="13:31:33",
            type="수입",
            category="기타수입",
            subcategory="미분류",
            memo="복리후생환불",
            amount=10000,
            currency="KRW",
            method="월급통장",
        )
        reclassified = NormalizedTransaction(
            **{
                **base.__dict__,
                "category": "복지포인트",
                "subcategory": "복리후생",
            }
        )
        different_event = NormalizedTransaction(**{**base.__dict__, "amount": 12000})

        self.assertEqual(base.fingerprint(), reclassified.fingerprint())
        self.assertNotEqual(base.fingerprint(), different_event.fingerprint())

    def test_decrypts_password_protected_zip_without_extracting_to_disk(self) -> None:
        workbook_bytes = build_test_workbook()
        zip_bytes = build_encrypted_zip(workbook_bytes, "test-only-password")
        decrypted = decrypt_workbook_from_zip(zip_bytes, "test-only-password")
        self.assertEqual(parse_workbook_bytes(decrypted).sheet_name, "가계부 내역")

    def test_rejects_wrong_zip_password(self) -> None:
        zip_bytes = build_encrypted_zip(build_test_workbook(), "correct-test-password")
        with self.assertRaises(ZipPasswordError):
            decrypt_workbook_from_zip(zip_bytes, "wrong-test-password")

    def test_normalizes_common_date_and_time_shapes(self) -> None:
        self.assertEqual(normalize_date("2026년 8월 2일"), "2026-08-02")
        self.assertEqual(normalize_date("20260802"), "2026-08-02")
        self.assertEqual(normalize_time("9:05"), "09:05:00")
        self.assertEqual(normalize_time("905"), "09:05:00")


if __name__ == "__main__":
    unittest.main()
