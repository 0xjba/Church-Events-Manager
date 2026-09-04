import type { ThemeConfig } from 'antd';

/**
 * Ant Design carries the admin surface (tables, forms, modals), so its tokens
 * are pinned to the same palette as the Tailwind layer in index.css. Values are
 * the hex equivalents of those HSL tokens; change both together.
 */
export const palette = {
  primary: '#132F53',
  primaryHover: '#1F4372',
  primaryActive: '#0A1D38',
  brass: '#95651E',
  success: '#189662',
  warning: '#9E4F10',
  danger: '#B22420',
  info: '#1A5C7F',
  text: '#151C27',
  textSecondary: '#565F6D',
  border: '#E4E1DA',
  surface: '#FFFFFF',
  background: '#F8F7F3',
  sunken: '#F2F0EA',
} as const;

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.danger,
    colorInfo: palette.info,
    colorText: palette.text,
    colorTextSecondary: palette.textSecondary,
    colorBorder: palette.border,
    colorBorderSecondary: palette.border,
    colorBgLayout: palette.background,
    colorBgContainer: palette.surface,
    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,
    controlHeight: 38,
    controlHeightLG: 44,
    fontSize: 14,
    fontFamily:
      "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
    },
    Table: {
      headerBg: palette.sunken,
      headerColor: palette.textSecondary,
      headerSplitColor: 'transparent',
      rowHoverBg: '#F2F0EA',
      borderColor: palette.border,
      cellPaddingBlock: 12,
      cellPaddingBlockSM: 8,
    },
    Modal: {
      borderRadiusLG: 12,
      titleFontSize: 17,
    },
    Card: {
      paddingLG: 20,
    },
    Input: { paddingBlock: 8 },
    Select: { optionSelectedBg: '#E4EBF5' },
    Segmented: { itemSelectedBg: palette.surface },
    Tabs: { horizontalItemPadding: '10px 0', horizontalMargin: '0 0 16px 0' },
  },
};
