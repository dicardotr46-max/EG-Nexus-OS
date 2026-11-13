/* istanbul ignore file */
/**
 * EG-Nexus-OS — State Barrel Bridge
 * Re-exports ./core/state.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./core/state.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./core/state'], factory);
  } else {
    var base = (root && (root.NexusState || (root.NexusCore && root.NexusCore.state))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusState = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
