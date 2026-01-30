import * as React from 'react';
import { ThemeContext } from '~/context/ThemeContext';
import { Theme } from '~/utilities/const';

type ThemeContextProps = {
  /** Whether the current theme is MUI */
  isMUITheme: boolean;
  /** Whether dark mode is active (MUI theme only) */
  isDarkMode: boolean;
  /** Toggle dark mode (MUI theme only) */
  toggleDarkMode: () => void;
};

export const useThemeContext = (): ThemeContextProps => {
  const { theme, isDarkMode, toggleDarkMode } = React.useContext(ThemeContext);

  return {
    isMUITheme: theme === Theme.MUI,
    isDarkMode,
    toggleDarkMode,
  };
};
