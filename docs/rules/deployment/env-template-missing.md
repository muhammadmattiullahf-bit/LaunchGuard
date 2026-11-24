# Rule: `deployment/env-template-missing` (LG-DPL-R001)

- **Category:** `deployment`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

When local `.env` files are present without an accompanying template (like `.env.example`), team members and deployment pipelines lack documentation on which environment variables are required.

## What LaunchGuard Checks

Checks for the existence of `.env.example`, `.env.template`, or `.env.sample` when `.env*` files are detected.

## How to Fix

Create a `.env.example` file committing placeholder values for all expected environment variables.
