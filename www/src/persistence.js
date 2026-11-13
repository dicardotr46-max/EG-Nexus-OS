/* istanbul ignore file */
/**
 * EG-Nexus-OS — Persistence Barrel Bridge
 * Re-exports ./core/persistence.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./core/persistence.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./core/persistence'], factory);
  } else {
    var base = (root && (root.NexusPersistence || (root.NexusCore && root.NexusCore.persistence))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusPersistence = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
