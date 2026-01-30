import * as React from 'react';
import { createTheme } from '@mui/material';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import { Theme } from '~/utilities/const';
import '~/style/MUI-theme.scss';

const PF_DARK_CLASS = 'pf-v6-theme-dark';

type ThemeProviderProps = {
  theme?: Theme;
  children: React.ReactNode;
};

type ThemeContextValue = {
  theme: Theme;
  /** Whether dark mode is active (MUI theme only) */
  isDarkMode: boolean;
  /** Toggle dark mode (MUI theme only) */
  toggleDarkMode: () => void;
};

export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: Theme.Patternfly,
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  theme = Theme.Patternfly,
  children,
}) => {
  // Dark mode state - only used for MUI theme
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mui-dark-mode') === 'true';
  });

  const toggleDarkMode = React.useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Persist dark mode preference
  React.useEffect(() => {
    localStorage.setItem('mui-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  // Create MUI theme with dark mode
  const muiTheme = React.useMemo(
    () =>
      createTheme({
        cssVariables: true,
        palette: {
          mode: isDarkMode ? 'dark' : 'light',
        },
      }),
    [isDarkMode],
  );

  // Apply theme classes
  React.useEffect(() => {
    const root = document.documentElement;

    // Apply MUI theme class
    if (theme === Theme.MUI) {
      root.classList.add(Theme.MUI);
    } else {
      root.classList.remove(Theme.MUI);
    }

    // Apply PatternFly dark class when dark mode is active
    // Works for both MUI theme (PF components under the hood) and PF theme
    if (isDarkMode) {
      root.classList.add(PF_DARK_CLASS);
    } else {
      root.classList.remove(PF_DARK_CLASS);
    }
  }, [theme, isDarkMode]);

  const themeValue = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDarkMode,
      toggleDarkMode,
    }),
    [theme, isDarkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      {theme === Theme.MUI ? (
        <MUIThemeProvider theme={muiTheme}>{children}</MUIThemeProvider>
      ) : (
        children
      )}
    </ThemeContext.Provider>
  );
};
