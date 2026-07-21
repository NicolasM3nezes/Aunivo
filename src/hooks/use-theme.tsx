'use client';

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  STORAGE_KEY,
  isMode,
  isThemeId,
  type Mode,
  type ThemeId,
} from '@/lib/themes';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  mode: Mode;
  setMode: (next: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_CHANGE_EVENT = 'aunivo-theme-change';

function applyModeToDocument(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

function readTheme(): ThemeId {
  const fromAttribute = document.documentElement.dataset.theme;
  if (isThemeId(fromAttribute)) return fromAttribute;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage can be unavailable in private or sandboxed contexts.
  }
  return DEFAULT_THEME;
}

function readMode(): Mode {
  const fromAttribute = document.documentElement.dataset.mode;
  if (isMode(fromAttribute)) return fromAttribute;

  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // localStorage can be unavailable in private or sandboxed contexts.
  }
  return DEFAULT_MODE;
}

function subscribe(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      document.documentElement.dataset.theme = isThemeId(event.newValue)
        ? event.newValue
        : DEFAULT_THEME;
      onStoreChange();
      return;
    }

    if (event.key === MODE_STORAGE_KEY) {
      const nextMode = isMode(event.newValue) ? event.newValue : DEFAULT_MODE;
      applyModeToDocument(nextMode);

      if (event.newValue === 'system') {
        try {
          localStorage.setItem(MODE_STORAGE_KEY, DEFAULT_MODE);
        } catch {
          // The DOM still receives the safe default when storage is blocked.
        }
      }
      onStoreChange();
    }
  }

  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const mode = useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE);

  const setTheme = useCallback((next: ThemeId) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The current tab still updates when persistence is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const setMode = useCallback((next: Mode) => {
    applyModeToDocument(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // The current tab still updates when persistence is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, mode, setMode, toggleMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context) return context;

  return {
    theme: DEFAULT_THEME,
    setTheme: () => {},
    mode: DEFAULT_MODE,
    setMode: () => {},
    toggleMode: () => {},
  };
}
