import { colors, fontSizes, radii, spacing, type ColorScheme } from '@kleps/tokens';
import { useColorScheme } from 'react-native';

export function useTheme(): ColorScheme {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}

export { fontSizes, radii, spacing };
