import type { ThemeConfig } from 'antd';

// One place for the look of the whole app. Components read these tokens,
// so changing a color here restyles every page consistently.
export const brand = {
  primary: '#6d5efc', // violet: calm, focused, a little playful
  accent: '#ff7a59', // coral: warmth and call-to-action energy
  success: '#16b97d',
  ink: '#1d1b3a',
  muted: '#6b6f8a',
  surface: '#ffffff',
  canvas: '#f7f6ff',
};

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorSuccess: brand.success,
    colorError: '#ef4465',
    colorTextBase: brand.ink,
    colorBgLayout: brand.canvas,
    colorBorderSecondary: '#ebe9fb',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    borderRadius: 14,
    borderRadiusLG: 18,
    controlHeight: 40,
    controlHeightLG: 48,
    boxShadowSecondary: '0 10px 30px -12px rgba(60, 50, 140, 0.18)',
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: '0 8px 20px -8px rgba(109,94,252,.6)' },
    Card: { headerFontSize: 17, paddingLG: 24 },
    Menu: { itemBorderRadius: 999, horizontalItemBorderRadius: 999, itemSelectedColor: brand.primary, itemSelectedBg: '#efedff' },
    Tabs: { itemSelectedColor: brand.primary, inkBarColor: brand.primary },
    Input: { activeShadow: '0 0 0 3px rgba(109,94,252,.15)' },
  },
};
