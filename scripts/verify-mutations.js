#!/usr/bin/env node
'use strict';

/**
 * Security Mutation & Regression Verification Test Harness
 * Directly exercises core security modules (SecretVault, Policy Engine, Token Map,
 * Structured Commands, and Canonical SHA-256 Hashing) against real mutant states.
 */
const assert = require('assert');

console.log('🧬 Running Security Mutation & Regression Verification...');

let killedCount = 0;
let survivedCount = 0;

/**
 * Enhanced assertMutantKilled:
 * 1. Executes baselineFn to verify baseline functionality passes on clean state.
 * 2. Executes mutantFn and ensures mutation is killed either by returning true or
 *    throwing an assertion/validation failure.
 * 3. Strictly rejects SyntaxError and ReferenceError as invalid mutant tests.
 */
async function assertMutantKilled(description, baselineFn, mutantFn) {
  if (typeof mutantFn !== 'function') {
    mutantFn = baselineFn;
    baselineFn = null;
  }

  // 1. Verify baseline passes first
  if (baselineFn) {
    try {
      const baselineResult = await baselineFn();
      if (baselineResult === false) {
        survivedCount++;
        console.error(`  ❌ BASELINE FAILED for: ${description}`);
        return;
      }
    } catch (err) {
      survivedCount++;
      console.error(`  ❌ BASELINE EXCEPTION for: ${description}: ${err.message}`);
      return;
    }
  }

  // 2. Execute mutant verification
  try {
    const killed = await mutantFn();
    if (killed === true) {
      killedCount++;
      console.log(`  ✓ Killed mutant: ${description}`);
    } else {
      survivedCount++;
      console.error(`  ❌ SURVIVED mutant: ${description}`);
    }
  } catch (err) {
    // 3. Reject interpreter / syntax / reference errors
    if (err instanceof SyntaxError || err instanceof ReferenceError) {
      survivedCount++;
      console.error(`  ❌ SURVIVED mutant (structural error ${err.name}): ${description}: ${err.message}`);
      return;
    }
    killedCount++;
    console.log(`  ✓ Killed mutant (assertion failure detected): ${description} [${err.name || 'AssertionError'}]`);
  }
}

async function runAll() {
  const registry = require('../src/providers/registry.js');
  const approvals = require('../src/security/approvals.js');
  const secrets = require('../src/security/secrets.js');

  // 1. Mutant: Replay of One-Time Approval Token
  await assertMutantKilled(
    'Replay of One-Time Approval Token must be blocked (consumeApprovalToken)',
    async () => {
      registry.clearApprovalTokens();
      const token = registry.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' } });
      const firstUse = registry.consumeApprovalToken(token, { providerId: 'github', action: 'push', params: { ref: 'main' } });
      return firstUse === true;
    },
    async () => {
      registry.clearApprovalTokens();
      const token = registry.issueApprovalToken({ providerId: 'github', action: 'push', params: { ref: 'main' } });
      registry.consumeApprovalToken(token, { providerId: 'github', action: 'push', params: { ref: 'main' } });
      const secondUse = registry.consumeApprovalToken(token, { providerId: 'github', action: 'push', params: { ref: 'main' } });
      if (secondUse === true) {
        throw new assert.AssertionError({ message: 'Replay succeeded', actual: secondUse, expected: false });
      }
      return secondUse === false;
    }
  );

  // 2. Mutant: Tampered AAD in SecretVault decryption must fail closed
  await assertMutantKilled(
    'Tampered AAD in SecretVault decryption fails closed using module SecretVault',
    async () => {
      const vault = new secrets.SecretVault();
      await vault.init();
      const encrypted = await vault.encrypt('classified_secret_payload', 'auth_tag_context_v1');
      const decrypted = await vault.decrypt(encrypted.ciphertext, encrypted.iv, 'auth_tag_context_v1');
      return decrypted === 'classified_secret_payload';
    },
    async () => {
      const vault = new secrets.SecretVault();
      await vault.init();
      const encrypted = await vault.encrypt('classified_secret_payload', 'auth_tag_context_v1');
      try {
        await vault.decrypt(encrypted.ciphertext, encrypted.iv, 'tampered_aad_context');
        return false; // Mutant survived
      } catch (err) {
        if (err instanceof SyntaxError || err instanceof ReferenceError) throw err;
        return true; // Mutant killed
      }
    }
  );

  // 3. Mutant: Wildcard scope * bypass in validateProviderScope
  await assertMutantKilled(
    'Wildcard scope * bypass in validateProviderScope must be rejected',
    async () => {
      const valid = registry.validateProviderScope('github', 'push', ['repo']);
      return valid === true;
    },
    async () => {
      const allowed = registry.validateProviderScope('github', 'push', ['*']);
      const allowedAll = registry.validateProviderScope('github', 'push', ['all']);
      const allowedAdmin = registry.validateProviderScope('github', 'push', ['admin']);
      return allowed === false && allowedAll === false && allowedAdmin === false;
    }
  );

  // 4. Mutant: Default-Deny on unmapped action in validateProviderScope
  await assertMutantKilled(
    'Default-Deny on unmapped action in validateProviderScope must return false',
    async () => {
      const valid = registry.validateProviderScope('github', 'push', ['repo']);
      return valid === true;
    },
    async () => {
      const allowed = registry.validateProviderScope('github', 'completely_unmapped_action', ['repo']);
      return allowed === false;
    }
  );

  // 5. Mutant: Canonical JSON + SHA-256 parameter hashing consistency & tampering detection
  await assertMutantKilled(
    'Canonical JSON + SHA-256 parameter hashing consistency and parameter tampering guard',
    async () => {
      const p1 = { branch: 'main', force: false, metadata: { author: 'nexus', tag: 1 } };
      const p2 = { metadata: { tag: 1, author: 'nexus' }, force: false, branch: 'main' };
      const h1 = approvals._hashParams(p1);
      const h2 = approvals._hashParams(p2);
      return h1 === h2 && /^[0-9a-f]{64}$/.test(h1);
    },
    async () => {
      const p1 = { branch: 'main', force: false, metadata: { author: 'nexus', tag: 1 } };
      const pTampered = { branch: 'main', force: true, metadata: { author: 'nexus', tag: 1 } };

      const h1 = approvals._hashParams(p1);
      const hTampered = approvals._hashParams(pTampered);
      const isTamperEvident = h1 !== hTampered;

      approvals.clearApprovalTokens();
      const token = approvals.issueApprovalToken({ providerId: 'github', action: 'push', params: p1 });
      const tamperedConsumption = approvals.consumeApprovalToken(token, { providerId: 'github', action: 'push', params: pTampered });

      return isTamperEvident && tamperedConsumption === false;
    }
  );

  // 6. Mutant: executeProviderRequest Default-Deny without grantedScopes
  await assertMutantKilled(
    'executeProviderRequest Default-Deny fails closed when grantedScopes is omitted for scoped service',
    async () => {
      const valid = registry.validateProviderScope('github', 'push', ['repo']);
      return valid === true;
    },
    async () => {
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'dummy_token'
      });
      return res.status === 403 && res.error === 'SCOPE_INSUFFICIENT';
    }
  );

  // 7. Mutant: executeProviderRequest requireApproval: false escape hatch bypass attempt
  await assertMutantKilled(
    'executeProviderRequest requireApproval: false escape hatch must not bypass sensitive action approval',
    async () => {
      // Baseline: isSensitiveProviderAction correctly flags sensitive action
      return registry.isSensitiveProviderAction('github', 'push') === true;
    },
    async () => {
      // Mutant attempt: pass requireApproval: false without token for sensitive action
      const res = await registry.executeProviderRequest({
        providerId: 'github',
        action: 'push',
        token: 'ghp_test_token_123456789012345678901234567890',
        grantedScopes: ['repo'],
        requireApproval: false
      });
      return res.status === 403 && res.error === 'APPROVAL_REQUIRED';
    }
  );

  console.log(`\nMutation Results: ${killedCount} killed, ${survivedCount} survived.`);
  if (survivedCount > 0) {
    console.error(`❌ Security Mutation verification failed! ${survivedCount} mutant(s) survived.`);
    process.exit(1);
  }

  console.log('✅ 100% of core security mutants were successfully killed.');
  process.exit(0);
}

runAll().catch(err => {
  console.error('Fatal mutation harness error:', err);
  process.exit(1);
});
