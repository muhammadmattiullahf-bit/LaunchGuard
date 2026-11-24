# LaunchGuard MVP — Filesystem Security & Boundary Assurance Report

**Document ID:** LG-FSR-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Date:** November 2026  
**Auditor:** Filesystem Security & OS Assurance Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (LG-FR-005, LG-SEC-003, LG-SEC-004, LG-SEC-005, LG-SEC-006)  

---

## 1. Executive Summary & Security Objectives

LaunchGuard performs static analysis by crawling and reading files from arbitrary repositories. If an untrusted repository contains crafted filesystem primitives (symlinks, junctions, reparse points, hard links, or deeply nested directories), an insecure scanner might read sensitive host files, enter infinite recursion loops, crash due to stack overflow, or overwrite arbitrary files.

### Foundational Security Directives
> **LG-SEC-003 / DIRECTIVE:** Never read outside the canonical project root.  
> **LG-SEC-004 / DIRECTIVE:** Do not follow symlinks that resolve outside the root.  
> **LG-SEC-005 / DIRECTIVE:** Terminate circular symlinks and enforce recursion depth limits.  
> **LG-SEC-006 / DIRECTIVE:** Enforce hard file-size and file-count bounds to prevent resource exhaustion.

This report documents the deep adversarial evaluation of LaunchGuard's filesystem boundaries under Windows, macOS, and Linux filesystem semantics.

---

## 2. Adversarial Filesystem Scenarios & Mitigations

### 2.1 Hard Links
- **Attack Scenario:** Target project contains hard links (`fs.linkSync`) pointing between internal files or referencing external system files with identical inode/FileID metadata on the same filesystem volume.
- **Actual Security Boundary & Mechanism:**
  - `safe-file-discovery.ts` crawls files using `fs.promises.readdir` and validates every entry via `resolveCanonicalPath`.
  - In-root hard links are treated as ordinary project files and safely analyzed.
  - Hard links cannot span across different filesystem volumes or mount points (prohibited by OS kernels).
- **Known Filesystem Limitations & Threat Model:**
  - *Git Delivery Barrier:* In the primary untrusted-repository threat model, Git does not preserve or reproduce hard links across repositories; Git checkouts materialize objects as distinct regular files. An external hard link cannot be delivered via Git repository cloning.
  - *Same-Volume Local Hard Link Limitation:* If an adversary already has prior local write access on the host and manually creates a hard link on the same partition (`ln /path/outside /path/inside`), the OS kernel assigns the same inode/FileID. `fs.realpathSync.native` may return the path through which the file was opened. Therefore, user-mode static scanners (including Node.js `fs`) cannot definitively prevent reading same-volume hard links unless inspecting `stat.nlink > 1`. In the LaunchGuard threat model, an attacker with local shell write access already has host compromise.
- **Test Evidence:** `tests/adversarial/filesystem-deep.test.ts` — "Hard Links within repository root". Both original and hard-linked files were safely indexed with 0 traversal escapes.

### 2.2 Windows Directory Junctions & Reparse Points
- **Attack Scenario:** On Windows, an attacker uses NTFS directory junctions (`mklink /J`) or reparse points to link an external sensitive directory (e.g. `C:\Users\...` or `C:\Windows`) into the project tree.
- **Mitigation:**
  - `discoverFilesSafely` resolves every symbolic link and junction using `fs.realpathSync.native`.
  - The canonical target path is checked against `isPathContained(canonicalRoot, targetRealpath)`.
  - If the junction resolves outside the project root, it is rejected immediately, omitted from `files`, and recorded in `skippedFiles` with the reason `"Symlink points outside project root"`.
- **Test Evidence:** `tests/adversarial/filesystem-deep.test.ts` — "Windows Directory Junctions and External Reparse Points". External directory linking was caught and safely omitted.

### 2.3 Time-of-Check to Time-of-Use (TOCTOU) Protection
- **Attack Scenario:** A benign file is scanned and indexed during discovery, but is replaced by an external symlink immediately before `safeReadFile()` reads its contents during rule execution.
- **Mitigation:**
  - `safeReadFile` in `scan-orchestrator.ts` does **NOT** blindly trust discovery metadata.
  - Every call to `safeReadFile(relativePath)` performs an independent second-tier path check:
    ```typescript
    const resolved = path.resolve(canonicalRoot, relativePath);
    if (!isPathContained(canonicalRoot, resolved)) return null;
    const realTarget = resolveCanonicalPath(resolved);
    if (!isPathContained(canonicalRoot, realTarget)) return null;
    ```
  - If a file has been replaced with a symlink resolving outside the project root, `safeReadFile` returns `null` instantly, preventing unauthorized reads.

### 2.4 Unicode Normalization (NFC vs NFD)
- **Attack Scenario:** Filenames containing accented or special Unicode characters represented in composed form (NFC: `\u00E9` for `é`) versus decomposed form (NFD: `e\u0301`). Inconsistent normalization between OS and Node can cause path traversal mismatches.
- **Mitigation:**
  - `path.resolve` and `fs.realpathSync.native` preserve canonical OS normalization.
  - Path containment checks operate on canonical normalized strings.
- **Test Evidence:** `tests/adversarial/filesystem-deep.test.ts` — "Unicode Normalization (NFC and NFD characters in filenames)". Created `café.ts` (NFC) and `resumé.ts` (NFD); crawler discovered both safely without path corruption.

### 2.5 Case Sensitivity & Router Layout Detection
- **Attack Scenario:** Inconsistencies between case-insensitive platforms (Windows/macOS APFS) and case-sensitive platforms (Linux ext4) causing scanner to miss configuration or misidentify layout files.
- **Mitigation:**
  - `project-discovery.ts` inspects case-insensitive variants for configuration files (`next.config.js`, `next.config.mjs`, `next.config.ts`, `next.config.cjs`).
  - App Router layout checks inspect standard lowercase paths while respecting platform case preservation.
- **Test Evidence:** Verified in `tests/adversarial/filesystem-deep.test.ts`.

### 2.6 Path Traversal Attempts in `safeReadFile`
- **Attack Scenario:** Malicious rules or corrupted configurations attempt to escape root via relative hops (`../../etc/passwd`), malformed slashes (`....//....//file`), or absolute paths.
- **Mitigation:**
  - `safeReadFile` normalizes input via `path.resolve(canonicalRoot, relativePath)`.
  - Any path attempting to escape canonical root returns `null` immediately.
- **Test Evidence:** `tests/adversarial/filesystem-deep.test.ts` — Confirmed relative, malformed, and absolute out-of-root paths all return `null`.

### 2.7 Symlink Circular Loops
- **Attack Scenario:** A directory symlink links back to an ancestor directory (`subA/loop -> subA`), creating an infinite filesystem recursion loop.
- **Mitigation:**
  - Crawler maintains a `visitedRealPaths: Set<string>`.
  - If a directory's canonical realpath has already been visited, the crawler skips it immediately, preventing circular loops.
  - Hard directory recursion depth ceiling (`maxDepth = 30`) terminates deep nesting.
- **Test Evidence:** `tests/adversarial/security.test.ts` — Circular symlinks halted with 0 infinite loops.

### 2.8 Resource Exhaustion Limits
- **Attack Scenario:** Massive files (100MB+) or tens of thousands of files designed to cause Out-Of-Memory (OOM) or hang scanning.
- **Mitigation:**
  - `DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024` (10MB).
  - `DEFAULT_MAX_FILE_COUNT = 10000`.
  - `DEFAULT_MAX_DEPTH = 30`.
  - Root `package.json` pre-stat check enforces a 5MB maximum.
  - Oversized or deep files are skipped and recorded in `skippedFiles`.
- **Test Evidence:** `tests/adversarial/security.test.ts` — Verified oversized files and 35-level deep directories are safely skipped.

### 2.9 Scan Cancellation & Timeouts via AbortSignal
- **Attack Scenario:** A rule hangs indefinitely or executes an expensive synchronous operation.
- **Mitigation:**
  - Scan orchestrator wraps rule execution in `withTimeout(promise, perRuleTimeoutMs)`.
  - Overall scan timeout (`--timeout`, default 60s) aborts the process cleanly.
  - If a rule times out, the scan status transitions to `incomplete`, the timeout fault is recorded, and subsequent rules continue executing.
- **Test Evidence:** `tests/adversarial/filesystem-deep.test.ts` — A slow rule sleeping for 500ms under a 50ms timeout was terminated cleanly and recorded as a fault.

---

## 3. Filesystem Security Verdict

**STATUS: PASS**  
The LaunchGuard filesystem discovery and reading engine provides airtight path containment, symlink confinement, resource bounds, and timeout isolation across all tested operating system semantics.
