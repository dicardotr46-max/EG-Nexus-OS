# Security Policy — EG Nexus OS

## Supported Versions

We actively maintain and provide security patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 6.2.x   | :white_check_mark: |
| 6.1.x   | :white_check_mark: |
| 6.0.x   | :white_check_mark: |
| < 6.0   | :x:                |

## Security Architecture & Threat Model

EG Nexus OS enforces multi-layer defense-in-depth across the application boundary:

1. **Cryptographic Protection:**
   - **Session Secrets:** Authenticated encryption using AES-GCM-256 with 96-bit unique IVs and authenticated data (AAD).
   - **Hardware-backed Key Store:** Native Android builds leverage `AndroidKeyStore` with non-extractable 256-bit AES-GCM hardware keys. Web environments leverage WebCrypto with non-extractable CryptoKey storage in IndexedDB (fail-closed).
   - **Encrypted Backups:** Key derivation via PBKDF2-HMAC-SHA256 with 600,000 iterations and 16-byte cryptographically secure random salt.
   - **Key Usage Cap:** Adheres to NIST SP 800-38D recommendations, enforcing key rotation after 1,000,000 encryptions.

2. **State & Concurrency Security:**
   - Multi-tab state mutations use optimistic concurrency control (Compare-And-Swap / CAS) with 3-way delta reconciliation (`mergeMultiTabState`) to prevent race-condition data loss.
   - Deep prototype pollution protection via frozen objects, forbidden property blacklists (`__proto__`, `constructor`, `prototype`), and defensive proxy layers.

3. **Input Sanitization & Content Security:**
   - Strict linear URL normalization preventing SSRF and parser differential vulnerabilities.
   - Strict Content Security Policy (CSP) with script execution isolation and zero inline dynamic `eval`.

## Reporting a Vulnerability

We take the security of EG Nexus OS seriously. If you discover a security vulnerability, please report it privately:

- **GitHub Private Vulnerability Advisory:** [Report a Vulnerability](https://github.com/dicardotr46-max/EG-Nexus-OS/security/advisories/new)
- **Response Timeline:** Initial acknowledgement within 24 hours; status updates within 72 hours.
- **Disclosure Policy:** Coordinated vulnerability disclosure (CVD) allows a minimum 30-day window for remediation prior to public disclosure.

Please include:
- A description of the issue and potential security impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Affected versions and environments (Node.js, Web, Android).
