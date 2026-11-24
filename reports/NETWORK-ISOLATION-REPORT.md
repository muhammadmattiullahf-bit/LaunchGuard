# LaunchGuard MVP — Network Isolation & Air-Gap Verification Report

**Document ID:** LG-NIR-001  
**Target Version:** LaunchGuard v0.1.0 (MVP)  
**Date:** November 2026  
**Auditor:** Security & Network Assurance Subagent  
**Baseline Documents:** `DOC-001-LAUNCGUARD-PROJECT-CHARTER-AND-PRD.md` (Principle P-01, LG-FR-019, LG-SEC-010), ADR-006  

---

## 1. Executive Summary & Policy Baseline

LaunchGuard is designed to operate as a **local-first, privacy-conscious audit engine**. Under **Principle P-01**, **LG-FR-019**, and the approved **ADR-006**, the MVP is strictly mandated to operate 100% offline with zero outbound network calls and zero telemetry.

### Foundational Security Directives
> **LG-SEC-010 / DIRECTIVE:** LaunchGuard shall initiate zero outbound network connections during a local scan by default.  
> **ADR-006 / APPROVED:** All MVP audit rules operate entirely offline. Dependency auditing is restricted to local manifest and lockfile hygiene. Zero analytics, telemetry, or remote pings are permitted.

This report documents the empirical validation of LaunchGuard's network isolation under runtime instrumentation.

---

## 2. Test Methodology & Instrumentation

To verify that LaunchGuard never attempts network access during discovery, configuration loading, rule execution, scoring, or reporting, an active monkey-patching harness was constructed in `tests/adversarial/network-isolation.test.ts`.

### 2.1 Instrumented APIs
The test harness intercepted and spied upon every native Node.js networking subsystem:

1. **Domain Name System (DNS):**
   - `dns.lookup`
   - `dns.resolve`
   - `dns.promises.lookup`
2. **Hypertext Transfer Protocols (HTTP / HTTPS):**
   - `http.request`
   - `http.get`
   - `https.request`
   - `https.get`
   - `globalThis.fetch` (WHATWG Fetch API)
3. **Transport Layer Protocols (TCP / TLS):**
   - `net.connect`
   - `net.createConnection`
   - `net.Socket.prototype.connect`
   - `tls.connect`

### 2.2 Trap Mechanism
Each instrumented function was wrapped with a logging spy and configured to throw an immediate `Unauthorized network call: <API>` exception if invoked.

### 2.3 What This Test Observes vs Cannot Observe
- **What is Observable:**
  - Any standard JavaScript or TypeScript call initiating outbound sockets, DNS queries, HTTP/S requests, or Fetch calls from the CLI or Core Engine.
  - Any transitive library or package attempting to phone home or check updates.
- **What is NOT Observable by JavaScript Spies:**
  - Low-level kernel raw sockets or unmanaged native C++ addons bypassing the Node.js standard library.
  - *Mitigation:* A static dependency audit confirms that LaunchGuard uses **zero native C++ addons** and imports only standard Node.js built-ins.
  - External child processes (e.g. `curl`, `wget`, `npm`).
  - *Mitigation:* Security Audit test 13 verifies that LaunchGuard never spawns subprocesses or invokes package manager commands.

---

## 3. Actual Test Execution Evidence

### Test Execution Command
```bash
node --test tests/adversarial/network-isolation.test.ts
```

### Observed Execution Log
```text
✔ Network Isolation: Scans initiate 0 outbound DNS, HTTP, HTTPS, TCP or TLS connections (99ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Verification Scenarios
1. **Full CLI Scan Execution:** Invoked `launchguard scan <path>` against a Next.js fixture with active network interception. The CLI completed with exit code 0; exactly 0 network calls were recorded.
2. **Programmatic Orchestration Scan:** Invoked `executeScan` across all 27 registered MVP rules. The resulting report metadata explicitly confirmed `report.scan.networkUsed === false`.
3. **Registry and Advisory Checks:** Confirmed that `dependencies/lockfile-missing`, `dependencies/multiple-lockfiles`, and `dependencies/wildcard-version-range` inspect local `package.json` and lockfiles strictly via `fs.promises.readFile` with zero network lookups against `registry.npmjs.org` or external CVE databases.

---

## 4. Future Network Policy (Milestone M7)

Under **ADR-006**, external vulnerability advisory lookups (e.g. querying OSV.dev or GitHub Advisory Database) are explicitly classified as **Post-MVP Milestone M7**.

When Milestone M7 is developed in the future:
1. Network access will remain **OFF by default**.
2. Network execution will require the proposed explicit CLI consent flag:
   ```bash
   launchguard scan --allow-network
   ```
3. A transparent privacy specification must document that only dependency package names and version ranges are transmitted (never source code, file paths, or secrets).

---

## 5. Network Isolation Verdict

**STATUS: PASS**  
The LaunchGuard v0.1.0 MVP exhibits complete network isolation. Zero network connections, DNS requests, or telemetry pings occur during operation.
