# Rule: `deployment/start-script-missing` (LG-DPL-R003)

- **Category:** `deployment`
- **Default Severity:** `medium`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

Containerized deployments and self-hosted Node.js servers run `npm start` to execute `next start`. Without this script, production containers fail to launch.

## What LaunchGuard Checks

Checks `package.json` for a `start` script under `scripts`.

## How to Fix

Add `"start": "next start"` to `scripts` in `package.json`.
