export interface ClockPort {
  readonly now: () => Date;
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (handle: number) => void;
}

export interface KeyValueStoragePort {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

export interface DocumentEffectsPort {
  readonly setTitle: (title: string) => void;
  readonly setRootClass: (className: string, enabled: boolean) => void;
  readonly setRootStyle: (property: string, value: string | null) => void;
}

export interface UrlSyncPort {
  readonly readSearchParam: (name: string) => string | null;
  readonly writeSearchParam: (name: string, value: string | null) => void;
}

export interface HotkeyBinding {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly handler: () => void;
}

export interface HotkeyPort {
  readonly bind: (binding: HotkeyBinding) => () => void;
}

export interface PopupPort {
  readonly open: (url: string, target: string, features?: string) => void;
}

export interface EventStreamEvent {
  readonly type: string;
  readonly data: string;
}

export interface EventStreamPort {
  readonly open: (url: string, options: {
    readonly events: readonly string[];
    readonly onEvent: (event: EventStreamEvent) => void;
    readonly onError?: () => void;
  }) => { readonly close: () => void };
}

export const browserClock: ClockPort = {
  now: () => new Date(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
};

export const memoryStorage = (initial: Readonly<Record<string, string>> = {}): KeyValueStoragePort => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

export const browserStorage = (): KeyValueStoragePort => ({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
});

export const browserDocumentEffects = (): DocumentEffectsPort => ({
  setTitle: (title) => {
    document.title = title;
  },
  setRootClass: (className, enabled) => document.documentElement.classList.toggle(className, enabled),
  setRootStyle: (property, value) => {
    if (value === null) document.documentElement.style.removeProperty(property);
    else document.documentElement.style.setProperty(property, value);
  },
});

export const browserUrlSync = (): UrlSyncPort => ({
  readSearchParam: (name) => new URL(window.location.href).searchParams.get(name),
  writeSearchParam: (name, value) => {
    const url = new URL(window.location.href);
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
    window.history.replaceState(window.history.state, '', url);
  },
});

export const browserPopup = (): PopupPort => ({
  open: (url, target, features) => {
    window.open(url, target, features);
  },
});

export const browserEventStream = (): EventStreamPort => ({
  open: (url, options) => {
    const source = new EventSource(url);
    const removers = options.events.map((eventType) => {
      const listener = (event: MessageEvent<string>): void => options.onEvent({ type: eventType, data: event.data });
      source.addEventListener(eventType, listener);
      return (): void => source.removeEventListener(eventType, listener);
    });
    if (options.onError) source.onerror = () => options.onError?.();
    return {
      close: () => {
        for (const remove of removers) remove();
        source.close();
      },
    };
  },
});
