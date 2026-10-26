const VALID_PHASE5_STEP_TYPES_ARR = ['GOTO_URL', 'CLICK_ELEMENT', 'TYPE_INPUT', 'EXTRACT_DOM', 'VERIFY_RULE'];
const VALID_PHASE5_STEP_TYPES_SET = new Set(['GOTO_URL', 'CLICK_ELEMENT', 'TYPE_INPUT', 'EXTRACT_DOM', 'VERIFY_RULE']);

const arrUnsafe = ['__proto__', 'constructor', 'prototype'];
const setUnsafe = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeConnectionId_Arr(id) {
  return typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) && !arrUnsafe.includes(id);
}

function isSafeConnectionId_Set(id) {
  return typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) && !setUnsafe.has(id);
}

function isSafeConnectionId_Inline(id) {
  return typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) && id !== '__proto__' && id !== 'constructor' && id !== 'prototype';
}

function testPhase5_Arr(upper) {
  return VALID_PHASE5_STEP_TYPES_ARR.includes(upper) ? upper : 'fallback';
}

function testPhase5_Set(upper) {
  return VALID_PHASE5_STEP_TYPES_SET.has(upper) ? upper : 'fallback';
}

console.time('isSafeConnectionId_Arr');
for(let i=0; i<1000000; i++) {
  isSafeConnectionId_Arr('valid_id');
  isSafeConnectionId_Arr('__proto__');
}
console.timeEnd('isSafeConnectionId_Arr');

console.time('isSafeConnectionId_Set');
for(let i=0; i<1000000; i++) {
  isSafeConnectionId_Set('valid_id');
  isSafeConnectionId_Set('__proto__');
}
console.timeEnd('isSafeConnectionId_Set');

console.time('isSafeConnectionId_Inline');
for(let i=0; i<1000000; i++) {
  isSafeConnectionId_Inline('valid_id');
  isSafeConnectionId_Inline('__proto__');
}
console.timeEnd('isSafeConnectionId_Inline');

console.time('testPhase5_Arr');
for(let i=0; i<10000000; i++) {
  testPhase5_Arr('GOTO_URL');
  testPhase5_Arr('UNKNOWN');
}
console.timeEnd('testPhase5_Arr');

console.time('testPhase5_Set');
for(let i=0; i<10000000; i++) {
  testPhase5_Set('GOTO_URL');
  testPhase5_Set('UNKNOWN');
}
console.timeEnd('testPhase5_Set');
