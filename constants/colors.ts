
export const LIGHT_COLORS = {
  primary: '#9B7EDC',
  secondary: '#B9A0E8',
  lightAccent: '#EDE5FA',
  background: '#F8F5FC',
  card: '#FFFFFF',
  surface: '#F3EDF9',
  textPrimary: '#302542',
  textSecondary: '#756A83',
  textOnPrimary: '#FFFFFF',
  border: '#E4D9F2',
  shadow: '#302542',
  warning: '#F0AD4E',
  success: '#8A75B5',
  danger: '#D9534F',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const DARK_COLORS = {
  primary: '#B69AF0',
  secondary: '#8C72C7',
  lightAccent: '#45365E',
  background: '#17141F',
  card: '#24202F',
  surface: '#30283D',
  textPrimary: '#F4EFFB',
  textSecondary: '#C1B6D1',
  textOnPrimary: '#FFFFFF',
  border: '#443A53',
  shadow: '#000000',
  warning: '#F0AD4E',
  success: '#A895D6',
  danger: '#FF7777',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ThemeColors = {
  [K in keyof typeof LIGHT_COLORS]: string;
};

// Keeps existing imports working while we update the screens.
export const COLORS = LIGHT_COLORS;
