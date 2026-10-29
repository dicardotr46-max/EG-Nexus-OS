## 2026-10-29 - Debounce on Search Inputs
**Learning:** In a monolithic architecture like EG Nexus OS where all state and rendering logic lives in a single `index.html`, synchronous DOM re-renders triggered by `oninput` events on search fields (e.g., `renderHomeChatList`, `renderAppsCatalog`) can cause significant main-thread blocking and UI stuttering on mobile devices.
**Action:** Implement and use a standard global `debounce` utility to wrap expensive rendering functions attached to `oninput` handlers, ensuring they only fire after the user pauses typing.
