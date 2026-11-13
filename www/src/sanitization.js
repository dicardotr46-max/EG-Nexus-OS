/* istanbul ignore file */
/**
 * EG-Nexus-OS — Sanitization Barrel Bridge
 * Re-exports ./core/sanitization.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./core/sanitization.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./core/sanitization'], factory);
  } else {
    var base = (root && (root.NexusSanitization || (root.NexusCore && root.NexusCore.sanitization))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusSanitization = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
