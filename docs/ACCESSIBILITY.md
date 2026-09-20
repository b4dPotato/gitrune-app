# Accessibility

Gitrune targets WCAG 2.2 AA for its desktop interface. This is a target, not a current certification.

## Current expectations

- Actions use semantic buttons and icon-only controls have accessible names.
- Theme tokens are shared across screens and interface zoom supports 75%–150%.
- Destructive operations use explicit confirmation dialogs.
- Status and operation feedback should remain understandable without relying only on color.

## Required certification work

- Complete keyboard navigation for every list, menu, graph, and modal.
- Trap and restore focus in dialogs and mark background content inert.
- Add appropriate live regions for errors, progress, and status changes.
- Verify target sizes, focus visibility, built-in theme contrast, custom-theme fallbacks, 200% zoom, forced-colors mode, and reduced motion.
- Add automated axe checks and complete a manual NVDA test pass on Windows.

Accessibility bugs should describe the assistive technology, input method, Windows version, affected screen, and expected interaction. Do not include sensitive repository content in reports.
