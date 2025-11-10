#!/usr/bin/env python3
"""Simple smoke tests for the ThinkOrbit Academy auth service.

Checks:
- GET /config returns 200 and JSON containing client_id
- POST /login with an invalid token returns 401 (or non-200 is accepted as handled)

Run this from the repo root: python3 tests/smoke.py
"""
import json
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

BASE = "http://localhost:8000"

def check_config():
    url = BASE + "/config"
    print(f"GET {url} ...", end=' ')
    try:
        r = urlopen(url, timeout=5)
        body = r.read().decode('utf-8')
        obj = json.loads(body)
        client_id = obj.get('client_id')
        if client_id:
            print(f"OK (client_id present)")
            return True
        else:
            print(f"FAIL (no client_id)")
            return False
    except (HTTPError, URLError) as e:
        print(f"ERROR: {e}")
        return False

def check_login():
    url = BASE + "/login"
    print(f"POST {url} with invalid token ...", end=' ')
    data = json.dumps({"id_token": "invalid-token-for-smoke-test"}).encode('utf-8')
    req = Request(url, data=data, headers={"Content-Type":"application/json"}, method='POST')
    try:
        r = urlopen(req, timeout=5)
        body = r.read().decode('utf-8')
        print(f"UNEXPECTED OK (status=200). Response: {body[:200]}")
        return False
    except HTTPError as e:
        # We expect verification to fail and return 401 or similar
        if e.code == 401:
            print("OK (received 401 for invalid token)")
            return True
        else:
            print(f"OK (received {e.code})")
            return True
    except URLError as e:
        print(f"ERROR: {e}")
        return False

def main():
    ok = True
    if not check_config():
        ok = False
    if not check_login():
        ok = False
    if not ok:
        print("Smoke tests failed")
        sys.exit(2)
    print("Smoke tests passed")
    sys.exit(0)

if __name__ == '__main__':
    main()
