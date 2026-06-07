"""Sync Applyhome subscription rows from the approved Applyhome API.

The NetVisualizer app reads normalized rows from Supabase. This script calls the
approved ApplyhomeInfoDetailSvc endpoint, then maps its output into
real_estate_subscription_sites. The community MCP path is still used as the
local secret home and can be used as a legacy source when needed.

Default behavior is dry-run. Pass --apply to upsert into Supabase.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BLOCK_COORDS = {
    "S2": {"latitude": 37.6292, "longitude": 126.8727, "color": "#4F46E5", "priority_order": 1},
    "S3": {"latitude": 37.6250, "longitude": 126.8668, "color": "#10B981", "priority_order": 2},
    "S4": {"latitude": 37.6208, "longitude": 126.8612, "color": "#2563EB", "priority_order": 3},
}

DEFAULT_KEYWORDS = ["고양창릉", "고양 창릉", "창릉"]

APPLYHOME_APT_DETAIL_URL = (
    "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail"
)

FIXTURE_ROWS = [
    {
        "주택명": "고양창릉 S-02",
        "공급위치": "경기도 고양시 고양창릉 공공주택지구",
        "공급규모": "1057",
        "주택구분코드명": "나눔형 공공분양",
        "분양구분코드명": "공공분양",
        "청약접수시작일": "20260601",
        "특별공급접수시작일": "",
        "해당지역1순위접수시작일": "",
    },
    {
        "주택명": "고양창릉 S-03",
        "공급위치": "경기도 고양시 고양창릉 공공주택지구",
        "공급규모": "1306",
        "주택구분코드명": "나눔형 공공분양",
        "분양구분코드명": "공공분양",
        "청약접수시작일": "20260601",
        "특별공급접수시작일": "",
        "해당지역1순위접수시작일": "",
    },
    {
        "주택명": "고양창릉 S-04",
        "공급위치": "경기도 고양시 고양창릉 공공주택지구",
        "공급규모": "1024",
        "주택구분코드명": "공공분양",
        "분양구분코드명": "공공분양",
        "청약접수시작일": "20260601",
        "특별공급접수시작일": "",
        "해당지역1순위접수시작일": "",
    },
]


def suppress_http_key_logging() -> None:
    """Keep third-party HTTP clients from logging serviceKey query strings."""
    for logger_name in ("httpx", "httpcore"):
        logging.getLogger(logger_name).setLevel(logging.WARNING)


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def get_applyhome_service_key() -> str:
    key = (
        os.getenv("ODCLOUD_SERVICE_KEY", "")
        or os.getenv("DATA_GO_KR_API_KEY", "")
        or os.getenv("ODCLOUD_API_KEY", "")
    )
    if not key:
        raise RuntimeError(
            "Set ODCLOUD_SERVICE_KEY or DATA_GO_KR_API_KEY in the ignored MCP .env file."
        )
    return key


def read_text(row: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def to_int(value: Any) -> int | None:
    cleaned = re.sub(r"[^0-9-]", "", str(value or ""))
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def parse_date(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None

    compact = re.sub(r"[^0-9]", "", text)
    if len(compact) >= 8:
        return f"{compact[:4]}-{compact[4:6]}-{compact[6:8]}"
    return None


def parse_month(value: Any) -> str | None:
    date = parse_date(value)
    if date:
        return f"{date[:7]}-01"

    text = str(value or "")
    match = re.search(r"(20\d{2})[^0-9]?(0?[1-9]|1[0-2])", text)
    if not match:
        return None
    return f"{match.group(1)}-{match.group(2).zfill(2)}-01"


def infer_block(row: dict[str, Any]) -> str:
    haystack = " ".join(
        [
            read_text(row, ["주택명", "HOUSE_NM", "houseNm", "house_name"]),
            read_text(row, ["공급위치", "HSSPLY_ADRES", "hssplyAdres", "address"]),
        ]
    )
    match = re.search(r"\bS[-\s]?0?([234])\b", haystack, flags=re.IGNORECASE)
    return f"S{match.group(1)}" if match else "APT"


def row_matches(row: dict[str, Any], keywords: list[str]) -> bool:
    haystack = " ".join(str(value or "") for value in row.values())
    compact = haystack.replace(" ", "")
    return any(keyword in haystack or keyword.replace(" ", "") in compact for keyword in keywords)


def row_is_on_or_after(row: dict[str, Any], from_date: str | None) -> bool:
    if not from_date:
        return True
    row_date = parse_date(
        read_text(
            row,
            [
                "모집공고일",
                "RCRIT_PBLANC_DE",
                "rcritPblancDe",
                "청약접수시작일",
                "RCEPT_BGNDE",
                "SPSPLY_RCEPT_BGNDE",
                "GNRL_RNK1_CRSPAREA_RCPTDE",
            ],
        )
    )
    return bool(row_date and row_date >= from_date)


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    block = infer_block(row)
    coords = BLOCK_COORDS.get(block, {})
    site_name = read_text(row, ["주택명", "HOUSE_NM", "houseNm", "house_name"]) or f"{block} 청약 단지"
    location = read_text(row, ["공급위치", "HSSPLY_ADRES", "hssplyAdres", "address"])
    supply_count = to_int(read_text(row, ["공급규모", "TOT_SUPLY_HSHLDCO", "totSuplyHshldco"]))
    housing_type = read_text(row, ["주택구분코드명", "HOUSE_SECD_NM", "houseSecdNm"])
    sale_type = read_text(row, ["분양구분코드명", "RENT_SECD_NM", "rentSecdNm"])
    notice_date = parse_date(read_text(row, ["모집공고일", "RCRIT_PBLANC_DE", "rcritPblancDe"]))
    main_start_date = parse_date(
        read_text(row, ["청약접수시작일", "RCEPT_BGNDE", "SUBSCRPT_RCEPT_BGNDE", "subscrptRceptBgnde"])
    )
    special_start_date = parse_date(
        read_text(row, ["특별공급접수시작일", "SPSPLY_RCEPT_BGNDE", "spsplyRceptBgnde"])
    )
    general_start_date = parse_date(
        read_text(
            row,
            [
                "해당지역1순위접수시작일",
                "경기지역1순위접수시작일",
                "기타지역1순위접수시작일",
                "GNRL_RNK1_CRSPAREA_RCPTDE",
                "gnrlRnk1CrspareaRcptde",
            ],
        )
    )
    source_notice_no = read_text(row, ["공고번호", "PBLANC_NO", "pblancNo"])
    source_house_manage_no = read_text(row, ["주택관리번호", "HOUSE_MANAGE_NO", "houseManageNo"])

    return {
        "block": block,
        "site_name": site_name,
        "region": "경기" if "경기" in location else None,
        "district": "고양시" if "고양" in location else None,
        "supply_count": supply_count,
        "housing_type": housing_type or sale_type or None,
        "sale_type": sale_type or None,
        "priority": "가장 중요" if block == "S2" else "매우 중요",
        "priority_order": coords.get("priority_order", 99),
        "budget_note": "가장 중요" if block == "S2" else "매우 중요",
        "key_point": (
            "청약홈 공식 API에서 수집된 고양창릉 본청약 후보"
            if block == "S2"
            else "청약홈 공식 API에서 수집된 고양창릉 주요 물량"
        ),
        "target_budget": 800000000,
        "expected_notice_month": parse_month(main_start_date or notice_date) or "2026-06-01",
        "main_subscription_date": main_start_date,
        "special_supply_start_date": special_start_date,
        "special_supply_end_date": parse_date(
            read_text(row, ["특별공급접수종료일", "SPSPLY_RCEPT_ENDDE", "spsplyRceptEndde"])
        ),
        "general_supply_start_date": general_start_date,
        "general_supply_end_date": parse_date(
            read_text(
                row,
                [
                    "해당지역1순위접수종료일",
                    "경기지역1순위접수종료일",
                    "기타지역1순위접수종료일",
                    "GNRL_RNK1_CRSPAREA_ENDDE",
                    "gnrlRnk1CrspareaEndde",
                ],
            )
        ),
        "winner_announcement_date": parse_date(
            read_text(row, ["당첨자발표일", "PRZWNER_PRESNATN_DE", "przwnerPresnatnDe"])
        ),
        "contract_start_date": parse_date(
            read_text(row, ["계약시작일", "CNTRCT_CNCLS_BGNDE", "cntrctCnclsBgnde"])
        ),
        "contract_end_date": parse_date(
            read_text(row, ["계약종료일", "CNTRCT_CNCLS_ENDDE", "cntrctCnclsEndde"])
        ),
        "latitude": coords.get("latitude"),
        "longitude": coords.get("longitude"),
        "color": coords.get("color", "#4F46E5"),
        "status": "scheduled" if main_start_date else "planned",
        "source": "applyhome_official_api",
        "source_url": "https://www.data.go.kr/data/15098547/openapi.do",
        "source_notice_no": source_notice_no or None,
        "source_house_manage_no": source_house_manage_no or None,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_mcp_rows(mcp_path: Path, page: int, per_page: int) -> list[dict[str, Any]]:
    suppress_http_key_logging()
    src_path = mcp_path / "src"
    if not src_path.exists():
        raise RuntimeError(f"real-estate-mcp src path not found: {src_path}")
    sys.path.insert(0, str(src_path))

    from real_estate.mcp_server.tools.subscription import get_apt_subscription_info

    result = await get_apt_subscription_info(page=page, per_page=per_page)
    if "error" in result:
        raise RuntimeError(f"{result.get('error')}: {result.get('message')}")
    items = result.get("items") or []
    if not isinstance(items, list):
        raise RuntimeError("MCP response items is not a list")
    return [item for item in items if isinstance(item, dict)]


def fetch_applyhome_rows(
    mcp_path: Path,
    page: int,
    per_page: int,
    max_pages: int,
) -> list[dict[str, Any]]:
    load_env_file(mcp_path / ".env")
    service_key = get_applyhome_service_key()
    all_rows: list[dict[str, Any]] = []
    current_page = page
    final_page = page + max(max_pages, 1) - 1

    while current_page <= final_page:
        params = {
            "page": current_page,
            "perPage": per_page,
            "returnType": "JSON",
            "serviceKey": service_key,
        }
        request_url = f"{APPLYHOME_APT_DETAIL_URL}?{urllib.parse.urlencode(params)}"

        try:
            with urllib.request.urlopen(request_url, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            safe_body = body.replace(service_key, "<redacted>")
            raise RuntimeError(f"Applyhome API failed: HTTP {exc.code} {safe_body}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Applyhome API network error: {exc.reason}") from exc

        if not isinstance(payload, dict):
            raise RuntimeError("Applyhome API response is not an object")

        rows = payload.get("data") or []
        if not isinstance(rows, list):
            raise RuntimeError("Applyhome API response data is not a list")
        all_rows.extend(row for row in rows if isinstance(row, dict))

        total_count = to_int(payload.get("totalCount")) or len(all_rows)
        current_count = to_int(payload.get("currentCount")) or len(rows)
        if current_count < per_page or len(all_rows) >= total_count:
            break
        current_page += 1

    return all_rows


def upsert_supabase(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("SUPABASE_KEY", "")
        or os.getenv("SUPABASE_ANON_KEY", "")
    )
    if not url or not key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).")

    endpoint = f"{url}/rest/v1/real_estate_subscription_sites"
    query = urllib.parse.urlencode({"on_conflict": "block,site_name"})
    request = urllib.request.Request(
        f"{endpoint}?{query}",
        data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase upsert failed: HTTP {exc.code} {body}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mcp-path",
        default=os.getenv("REALESTATE_MCP_PATH", "tools/external/real-estate-mcp"),
        help="Path to the cloned tae0y/real-estate-mcp repo.",
    )
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--per-page", type=int, default=1000)
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument(
        "--source",
        choices=("official", "legacy-mcp"),
        default="official",
        help="official uses ApplyhomeInfoDetailSvc; legacy-mcp uses tae0y/real-estate-mcp.",
    )
    parser.add_argument("--keyword", action="append", dest="keywords", help="Filter keyword.")
    parser.add_argument("--from-date", help="Only include rows whose notice date is on or after YYYY-MM-DD.")
    parser.add_argument("--fixture", action="store_true", help="Use built-in fixture rows instead of MCP API.")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true", help="Upsert normalized rows into Supabase.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    keywords = args.keywords or DEFAULT_KEYWORDS
    mcp_path = Path(args.mcp_path).resolve()

    try:
        if args.fixture:
            raw_rows = FIXTURE_ROWS
            source = "fixture"
        elif args.source == "legacy-mcp":
            raw_rows = asyncio.run(fetch_mcp_rows(mcp_path, args.page, args.per_page))
            source = "real-estate-mcp"
        else:
            raw_rows = fetch_applyhome_rows(mcp_path, args.page, args.per_page, args.max_pages)
            source = "applyhome-official-api"

        filtered_rows = [
            row for row in raw_rows if row_matches(row, keywords) and row_is_on_or_after(row, args.from_date)
        ]
        normalized_rows = [normalize_row(row) for row in filtered_rows]

        result: dict[str, Any] = {
            "source": source,
            "raw_count": len(raw_rows),
            "matched_count": len(normalized_rows),
            "keywords": keywords,
            "from_date": args.from_date,
            "dry_run": not args.apply,
            "rows": normalized_rows,
        }

        if args.apply and normalized_rows:
            result["upserted"] = upsert_supabase(normalized_rows)

        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
