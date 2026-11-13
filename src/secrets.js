/* istanbul ignore file */
/**
 * EG-Nexus-OS — Secrets Barrel Bridge
 * Re-exports ./security/secrets.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./security/secrets.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./security/secrets'], factory);
  } else {
    var base = (root && (root.NexusSecrets || (root.NexusCore && root.NexusCore.secrets))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusSecrets = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
