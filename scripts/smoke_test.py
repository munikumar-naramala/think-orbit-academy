#!/usr/bin/env python3
"""Simple smoke tests for development backend.

This script performs a few checks against the local backend to ensure
basic endpoints respond. It does NOT attempt a real Google ID token
login (that requires a browser and valid ID token). Instead it checks
that the config and OpenAPI endpoints exist and that admin endpoints
are protected when not authenticated.

Usage: python3 scripts/smoke_test.py
"""
import sys
import os
import json
import time
from urllib.parse import urljoin

try:
    import requests
except Exception as e:
    print('Missing dependency `requests`. Install with: pip install requests')
    raise

BASE = os.environ.get('TOA_API_URL', 'http://localhost:8000')

def ok(msg):
    print('[OK]   ', msg)

def warn(msg):
    print('[WARN] ', msg)

def fail(msg):
    print('[FAIL] ', msg)

def check_config():
    url = urljoin(BASE, '/config')
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            j = r.json()
            if 'client_id' in j:
                ok('/config returned client_id')
            else:
                warn('/config returned 200 but missing client_id')
        else:
            warn(f'/config returned status {r.status_code}')
    except Exception as e:
        fail(f'/config failed: {e}')

def check_openapi():
    url = urljoin(BASE, '/openapi.json')
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            ok('/openapi.json reachable')
        else:
            warn(f'/openapi.json returned status {r.status_code}')
    except Exception as e:
        fail(f'/openapi.json failed: {e}')

def check_admin_users_protected():
    url = urljoin(BASE, '/admin/users')
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            warn('/admin/users returned 200 unauthenticated — expected protected endpoint')
            return False
        else:
            ok(f'/admin/users returned protected status {r.status_code}')
            return True
    except Exception as e:
        fail(f'/admin/users failed: {e}')
        return False

def check_admin_login_bad_request():
    url = urljoin(BASE, '/admin/login')
    try:
        r = requests.post(url, json={}, timeout=5)
        if r.status_code == 200:
            warn('/admin/login accepted empty body (unexpected)')
            return False
        else:
            ok(f'/admin/login returned status {r.status_code} for empty body')
            return True
    except Exception as e:
        fail(f'/admin/login failed: {e}')
        return False

def main():
    print('Smoke test starting against', BASE)
    check_config()
    check_openapi()
    a = check_admin_users_protected()
    b = check_admin_login_bad_request()
    print('\nSummary:')
    if a and b:
        ok('Smoke tests passed (protection/basic responses look good)')
        return 0
    else:
        warn('Smoke tests found issues — inspect server logs and endpoints')
        return 2

if __name__ == '__main__':
    sys.exit(main())
