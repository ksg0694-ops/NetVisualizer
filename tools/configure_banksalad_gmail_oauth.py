#!/usr/bin/env python3
"""Authorize personal Gmail read access and store OAuth values as GitHub secrets."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from google_auth_oauthlib.flow import InstalledAppFlow


GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def set_github_secret(repository: str, name: str, value: str) -> None:
    if not value:
        raise RuntimeError(f"OAuth did not return {name}")
    result = subprocess.run(
        ["gh", "secret", "set", name, "--repo", repository],
        input=value,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to register GitHub secret {name}")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("client_secret_json", type=Path)
    parser.add_argument("--repo", default="ksg0694-ops/NetVisualizer")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    if not args.client_secret_json.is_file():
        raise RuntimeError("OAuth client JSON file was not found")

    flow = InstalledAppFlow.from_client_secrets_file(
        str(args.client_secret_json),
        scopes=[GMAIL_READONLY_SCOPE],
    )
    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        access_type="offline",
        prompt="consent",
        authorization_prompt_message="Gmail 읽기 권한을 승인해주세요: {url}",
        success_message="Gmail 승인이 완료되었습니다. 이 창을 닫아도 됩니다.",
    )
    if not credentials.refresh_token:
        raise RuntimeError("Google did not issue an offline refresh token")

    set_github_secret(args.repo, "GMAIL_OAUTH_CLIENT_ID", credentials.client_id)
    set_github_secret(args.repo, "GMAIL_OAUTH_CLIENT_SECRET", credentials.client_secret)
    set_github_secret(args.repo, "GMAIL_OAUTH_REFRESH_TOKEN", credentials.refresh_token)
    print("Gmail OAuth secrets were registered without printing their values.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"OAuth setup failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None
