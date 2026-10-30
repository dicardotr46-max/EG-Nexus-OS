## 2025-02-18 - Debounce Optimization for Monolithic UI
**Learning:** In a monolithic architecture like EG Nexus OS where search inputs directly trigger complex DOM rebuilds (like `renderHomeChatList` and `renderAppsCatalog`), adding a simple global debounce wrapper prevents the main thread from blocking during rapid typing.
**Action:** Always check rapid `oninput` handlers in similar monolithic setups and wrap them in a `debounce` utility if they execute heavy filtering or DOM manipulation.
