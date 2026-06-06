"""Small operational helpers — invoked via `docker exec lycee-api python -m app.cli ...`."""

from __future__ import annotations

import argparse
import getpass
import sys

from .auth import hash_password


def main() -> int:
    parser = argparse.ArgumentParser(prog="lycee-cli")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_hash = sub.add_parser("hash-admin-password", help="Read a password from stdin and print its argon2 hash")
    p_hash.add_argument("--password", help="Inline password (avoid: visible in shell history). Omit to be prompted.")

    args = parser.parse_args()

    if args.cmd == "hash-admin-password":
        pw = args.password
        if not pw:
            pw = getpass.getpass("Admin password: ")
        if not pw or len(pw) < 8:
            print("Password too short (min 8 chars).", file=sys.stderr)
            return 2
        print(hash_password(pw))
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
