'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }

    if (typeof window !== 'undefined' && window.localStorage.getItem('fieldeaze-theme') === 'dark') {
      return 'dark';
    }

    return 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';

    document.documentElement.classList.add('theme-switching');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setTheme(newTheme);

    requestAnimationFrame(() => {
      document.documentElement.classList.remove('theme-switching');
    });

    queueMicrotask(() => {
      try {
        localStorage.setItem('fieldeaze-theme', newTheme);
      } catch {
        // Ignore storage restrictions; the active theme still remains applied.
      }
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
