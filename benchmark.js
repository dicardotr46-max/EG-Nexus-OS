const N = 10000;
const validCatalog = Array.from({length: N}, (_, i) => ({ id: `ag_${i}`, name: `Agent ${i}` }));
const memberIds = Array.from({length: 100}, (_, i) => `ag_${Math.floor(Math.random() * N)}`);
const turns = 1000;

console.time('Baseline (find inside loop)');
for (let t = 0; t < turns; t++) {
  const agentId = memberIds[t % memberIds.length];
  const agent = validCatalog.find(a => a.id === agentId) || { id: 'ag_default' };
  const nextAgentId = memberIds[(t + 1) % memberIds.length];
  const nextAgent = validCatalog.find(a => a.id === nextAgentId) || null;
}
console.timeEnd('Baseline (find inside loop)');

console.time('Optimized (Map pre-computation)');
const agentsMap = new Map();
for (let i = 0; i < validCatalog.length; i++) {
  agentsMap.set(validCatalog[i].id, validCatalog[i]);
}
for (let t = 0; t < turns; t++) {
  const agentId = memberIds[t % memberIds.length];
  const agent = agentsMap.get(agentId) || { id: 'ag_default' };
  const nextAgentId = memberIds[(t + 1) % memberIds.length];
  const nextAgent = agentsMap.get(nextAgentId) || null;
}
console.timeEnd('Optimized (Map pre-computation)');
