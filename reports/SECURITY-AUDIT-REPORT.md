# LaunchGuard MVP — Adversarial Security Audit Report

**Document ID:** LG-SEC-REP-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Verification Date:** November 2026  
**Security Lead & Auditor:** LaunchGuard Security Engineering Subagent  
**Baseline Document:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (Sections 10, 16)  

---

## 1. Security Scope & Threat Model

LaunchGuard is designed to be executed locally by developers and in automated CI/CD pipelines against potentially untrusted Next.js codebases (e.g., public pull requests, third-party starter templates, cloned repositories). 

### Foundational Security Directive
> **Principle P-02 / DIRECTIVE:** LaunchGuard shall NEVER execute code, build scripts, configuration files, or package-manager commands belonging to the target project being scanned.

The threat model explicitly considers an attacker who has committed malicious files to a target repository with the goal of:
1. Executing arbitrary code on the developer's workstation or CI runner.
2. Escaping the project directory to read sensitive host files (e.g., `~/.ssh/id_rsa`, `/etc/shadow`, environment variables).
3. Causing denial of service via excessive memory consumption, infinite loops, or deep recursion.
4. Poisoning terminal output or report files via ANSI injection, format string exploits, or secret exfiltration.

---

## 2. Adversarial Review of 15 Threat Vectors

### Vector 1: Path Traversal Attempts
- **Threat:** Target code, configuration files, or compromised rule logic attempt to read files outside the project root using relative traversal (`../../sensitive.txt`) or absolute paths (`/etc/passwd`).
- **Mitigation:** 
  - `src/core/discovery/safe-file-discovery.ts` uses `resolveCanonicalPath` and `isPathContained` to verify every file path before opening.
  - The `readFile(relativePath)` helper passed to rule execution contexts normalizes paths and returns `null` if any path resolves outside the canonical root.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 1: Path Traversal Attempts in Target Project". Tested traversal via relative `../` and absolute paths outside the temporary project root; both cleanly returned `null`.

### Vector 2: Symlink Escape Attempts
- **Threat:** A repository contains symbolic links (or Windows directory junctions) pointing to locations outside the repository root.
- **Mitigation:**
  - `safe-file-discovery.ts` resolves symlink realpaths using `fs.realpathSync.native`.
  - If a symlink resolves to a target where `isPathContained(canonicalRoot, targetRealpath)` is false, it is immediately skipped and logged in `skippedFiles` with the reason `"Symlink points outside project root"`.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 2 & 3: Symlink Escape and Circular Symlinks". External symlinks were safely excluded from discovered files and recorded in `skippedFiles`.

### Vector 3: Circular Symlinks and Infinite Recursion
- **Threat:** Symlinks pointing back to ancestor directories creating infinite filesystem loops.
- **Mitigation:**
  - The discovery crawler maintains a `visitedRealPaths: Set<string>` of canonical paths.
  - Any directory realpath already present in the set is skipped immediately.
  - A hard directory traversal depth ceiling of `DEFAULT_MAX_DEPTH = 30` prevents deep recursive structures from exhausting stack frames.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — Verified circular junctions in subdirectories are terminated without infinite recursion.

### Vector 4: Hidden Files and Directories
- **Threat:** Uncontrolled scanning of internal metadata directories (`.git`, `.next`, IDE configs) leaking internal metadata or consuming resources.
- **Mitigation:**
  - Standard skip set enforced by default: `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `.turbo`, `.vercel`, `coverage`, `.idea`, `.vscode`.
  - Hidden project configuration files like `.launchguardrc.json`, `.eslintrc.*`, and `.env.example` are specifically allowed when directly relevant to audit rules.

### Vector 5: Oversized Files and Resource Exhaustion
- **Threat:** Attacker places gigabyte-scale files in the repository to trigger Out-Of-Memory (OOM) errors during reading or regex parsing.
- **Mitigation:**
  - `DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024` (10MB). Files exceeding this limit are skipped during discovery and logged in `skippedFiles`.
  - Root `package.json` has a strict pre-stat check enforcing a 5MB maximum (`OVERSIZED_PACKAGE_JSON`).
  - `safeReadFile` enforces a default 5MB file buffer ceiling.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 5 & 6: Resource Limits". A 100KB file under a 50KB limit was skipped with `"File size ... exceeds limit"`.

### Vector 6: Excessive Directory Depth Recursion
- **Threat:** Repository creates directory nesting exceeding filesystem or stack limits (e.g., 100+ nested directories).
- **Mitigation:**
  - `discoverFilesSafely` tracks recursion depth; directories nested beyond `maxDepth` (default 30) are halted and recorded in `skippedFiles`.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — Directory tree nested 35 levels deep was safely halted at level 30.

### Vector 7: Malformed and Oversized Configuration
- **Threat:** Target repository includes a maliciously formatted `.launchguardrc.json` (e.g., invalid JSON, prototype pollution keys, excessively nested structures, or unknown options).
- **Mitigation:**
  - Configuration loader reads `.launchguardrc.json` using pure `JSON.parse`.
  - Enforces schema validation checking types and rejecting unknown keys.
  - Validates that rule suppressions contain a non-empty `reason` string (LG-FR-011).
  - Malformed configuration aborts execution with exit code 2 (usage error).
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 7: Malformed and Oversized Configuration Handling".

### Vector 8: Maliciously Crafted Source Files
- **Threat:** Source files containing malicious regex backtrack triggers (ReDoS), extremely long lines, or binary characters.
- **Mitigation:**
  - Discovery checks file extensions, skipping binary and unreadable files.
  - Rules use bounded regex patterns.
  - Secret redactor truncates evidence snippets to 200 characters.

### Vector 9: Secret Detection and Redaction Subsystem
- **Threat:** LaunchGuard discovers exposed secrets (API keys, private keys, tokens) and echoes them unredacted into terminal outputs, log files, or CI artifacts.
- **Mitigation:**
  - `src/core/redaction/redactor.ts` operates as a mandatory pre-emission filter.
  - Comprehensive regex suite detects:
    - OpenAI API keys (`sk-[A-Za-z0-9]{32,}`)
    - GitHub Personal Access Tokens (`gh[pousr]_[A-Za-z0-9_]{36,}`)
    - AWS Access Key IDs (`AKIA[0-9A-Z]{16}`) and Secret Keys
    - JSON Web Tokens (`eyJ...`)
    - RSA / OpenSSH Private Keys
    - Database Connection URIs (`postgres://user:pass@host/db`)
    - Generic password assignments
  - Redacted strings are masked as `[REDACTED:<TYPE>]` before report creation.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — Verified secrets in terminal, JSON, and SARIF reports are completely replaced with redaction placeholders.

### Vector 10: Terminal Output Control Sequence Injection
- **Threat:** Target source code contains ANSI escape sequences (e.g., cursor repositioning, clearing lines, OSC hyperlinking, command triggering) that execute inside the developer's terminal emulator when printed.
- **Mitigation:**
  - `sanitizeTerminalString` in `src/reporters/terminal-reporter.ts` strips all ANSI escape codes (`/\x1b\[[0-9;]*[a-zA-Z]/g`), OSC sequences, and control characters (`[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]`).
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 10: Terminal Output Control Sequence Sanitization". Injected ANSI sequences were completely removed.

### Vector 11: JSON and SARIF Output Safety
- **Threat:** Unescaped strings in findings corrupting JSON syntax or causing injection into downstream SARIF viewers.
- **Mitigation:**
  - Output formatters use standard `JSON.stringify` with standard UTF-8 escaping.
  - Evidence fields are sanitized and redacted prior to serialization.

### Vector 12: Error Messages Leaking Sensitive Data
- **Threat:** Error messages disclosing environment variables, user home directory structures, or file contents.
- **Mitigation:**
  - All error messages reference normalized relative paths where applicable.
  - Secrets discovered during scanning are never included in error messages.

### Vector 13: Target-Project Code Execution Prevention
- **Threat:** The auditor executes scripts defined in the target project's `package.json` (`build`, `prepare`, `postinstall`), imports target TypeScript/JavaScript files, or evaluates `next.config.js`.
- **Mitigation:**
  - LaunchGuard never calls `child_process.exec`, `child_process.spawn`, or package managers on the target.
  - LaunchGuard never calls `import()`, `require()`, `eval()`, or `vm.runInContext()` on target files.
  - All configurations (`next.config.*`, `package.json`) are parsed using static regex heuristics and JSON parsers.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 13: Target-Project Code Execution Prevention". A malicious `package.json` and `next.config.js` containing arbitrary file-write payloads were scanned; zero code was executed and zero files were written.

### Vector 14: Unexpected Filesystem Overwrites via `--output`
- **Threat:** Attacker tricks LaunchGuard into overwriting critical system files or following symlinks via the `--output` CLI flag.
- **Mitigation:**
  - `src/cli/cli.ts` verifies destination path with `fs.lstatSync`. If destination is an existing symbolic link, writing is prohibited and execution terminates with exit code 2.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 14: Output Destination Symlink Writing Prohibited".

### Vector 15: Timeout and Fault Isolation
- **Threat:** A malfunctioning or malicious rule hangs indefinitely or crashes the scanning process.
- **Mitigation:**
  - Every rule execution is isolated inside a try/catch boundary. An exception in one rule records a `RuleFault` and allows the scan to proceed.
  - Configurable scan timeout (`--timeout`) with AbortSignal aborts long-running scans.
- **Verification Evidence:** `tests/adversarial/security.test.ts` — "Security Audit 15: Timeout and Fault Isolation". A crashing rule was caught, recorded as a fault, and other rules completed successfully.

---

## 3. Supply Chain & Zero Runtime Dependencies Posture

LaunchGuard eliminates external software supply-chain vulnerabilities by utilizing **zero runtime npm dependencies**.
- The entire CLI, Core Engine, Safe Discovery, Parser, Rule Engine, and Reporters are built exclusively with Node.js built-ins.
- This design eliminates risks associated with dependency hijacking, typosquatting, transitive vulnerabilities, and lockfile tampering.

---

## 4. Security Audit Verdict

**STATUS: PASS**  
The LaunchGuard MVP implementation satisfies all security directives and requirements defined in `DOC-001` (LG-SEC-001 through LG-SEC-023). It is safe to execute against untrusted repositories.
