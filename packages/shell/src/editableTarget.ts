/**
 * Check whether a keyboard event target is an editable element
 * (input, textarea, select, or contentEditable).
 *
 * When true, navigation keyboard shortcuts should be suppressed
 * so the user can type freely. Dismiss/close actions (Escape)
 * should still fire regardless.
 */
export function editableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}
