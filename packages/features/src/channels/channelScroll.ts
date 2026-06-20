/** Pixel slack within which the scrollback is treated as pinned to the bottom. */
export const SCROLL_BOTTOM_PIN_THRESHOLD_PX = 48;

export function isScrollElementPinnedToBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_PIN_THRESHOLD_PX;
}

export function scrollElementToBottom(element: HTMLElement, behavior: ScrollBehavior): void {
  element.scrollTo({
    top: element.scrollHeight,
    behavior,
  });
}
