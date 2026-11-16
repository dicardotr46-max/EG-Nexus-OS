module.exports = {
  TextDecoder: globalThis.TextDecoder,
  TextEncoder: globalThis.TextEncoder,
  normalizeEncoding: (enc) => enc || 'utf-8',
  getBOMEncoding: () => null,
  labelToName: (label) => 'utf-8',
  legacyHookDecode: () => '',
  isomorphicDecode: (input) => Buffer.from(input).toString('utf-8'),
  isomorphicEncode: (input) => Buffer.from(input, 'utf-8')
};
