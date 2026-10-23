"""Claim an owner-scoped web request and acknowledge the existing Gmail import."""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from uuid import UUID

from banksalad_mail_sync import (
    SyncError, build_database_from_env, parse_args, run_gmail_sync, sanitize_error_code,
)


def update_request(database, request_id, payload, statuses):
    return database._request(
        "PATCH", "banksalad_sync_requests",
        params={"id": f"eq.{request_id}", "user_id": f"eq.{database.owner_user_id}",
                "status": f"in.({','.join(statuses)})"},
        headers={"Prefer": "return=representation"}, json=payload,
    ).json()


def run_request(database, request_id, importer=run_gmail_sync, fail=False):
    # Accept only canonical UUIDs, never arbitrary PostgREST filter syntax.
    if str(UUID(request_id)) != request_id:
        raise SyncError("invalid_request_id")
    if fail:
        update_request(database, request_id, {
            "status": "failed", "error_code": "workflow_failed",
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }, ["queued", "processing"])
        return 0
    claimed = update_request(database, request_id, {"status": "processing"}, ["queued"])
    if not claimed:
        return 0  # Replayed/expired/foreign-owner request must never import mail.
    totals = {"messages_processed": 0, "messages_failed": 0, "rows_inserted": 0}
    error_code = None
    try:
        result = importer(parse_args([]), totals)
        if result:
            error_code = "mail_import_failed"
    except Exception as error:
        result = 1
        error_code = sanitize_error_code(error)
    update_request(database, request_id, {
        **totals, "status": "failed" if result else "completed", "error_code": error_code,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }, ["processing"])
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        raise SystemExit(run_request(build_database_from_env(), os.environ.get("BANKSALAD_SYNC_REQUEST_ID", ""), fail="--fail" in sys.argv))
    except Exception as error:
        logging.error("Requested sync failed: %s", sanitize_error_code(error))
        raise SystemExit(1) from None
