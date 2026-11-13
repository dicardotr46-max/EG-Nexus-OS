/* istanbul ignore file */
/**
 * EG-Nexus-OS — Providers Registry Barrel Bridge
 * Re-exports ./providers/registry.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./providers/registry.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./providers/registry'], factory);
  } else {
    var base = (root && (root.NexusProviders || (root.NexusCore && root.NexusCore.providers))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusProviders = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
