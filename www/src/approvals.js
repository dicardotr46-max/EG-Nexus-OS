/* istanbul ignore file */
/**
 * EG-Nexus-OS — Approvals Barrel Bridge
 * Re-exports ./security/approvals.js for flat and nested module path compatibility.
 */
(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./security/approvals.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./security/approvals'], factory);
  } else {
    var base = (root && (root.NexusApprovals || (root.NexusCore && root.NexusCore.approvals))) || {};
    var exp = factory(base);
    if (root) {
      root.NexusApprovals = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(mod) {
  return mod;
});
