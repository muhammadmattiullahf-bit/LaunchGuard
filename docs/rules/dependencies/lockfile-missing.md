# Rule: `dependencies/lockfile-missing` (LG-DEP-R001)

- **Category:** `dependencies`
- **Default Severity:** `low`
- **Default Confidence:** `high`
- **Release Class:** `mvp`

## Why This Matters

A package lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`) pins the exact transitive dependency tree installed. Without a lockfile, different builds or developers may install conflicting versions, leading to unreproducible errors or supply-chain drift.

## What LaunchGuard Checks

Checks for the existence of at least one supported package manager lockfile at the project root.

## How to Fix

Generate a lockfile by running `npm install`, `pnpm install`, or `yarn install` and commit it to version control.
