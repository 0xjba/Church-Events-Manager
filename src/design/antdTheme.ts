import type { ThemeConfig } from 'antd';

/**
 * Ant Design carries the admin surface (tables, forms, modals), so its tokens
 * are pinned to the same palette as the Tailwind layer in index.css. Values are
 * the hex equivalents of those HSL tokens; change both together.
 */
export const palette = {
  primary: '#1B3458',
  primaryHover: '#264773',
  primaryActive: '#0F233E',
  brass: '#AE7829',
  success: '#287156',
  warning: '#BF6518',
  danger: '#B6342B',
  info: '#246489',
  text: '#131D30',
  textSecondary: '#5C697A',
  border: '#E5E0D7',
  surface: '#FFFEFB',
  background: '#FAF8F5',
  sunken: '#F4F1EC',
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
      "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
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
      rowHoverBg: '#F4F1EC',
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
    Select: { optionSelectedBg: '#E8EDF5' },
    Segmented: { itemSelectedBg: palette.surface },
    Tabs: { horizontalItemPadding: '10px 0', horizontalMargin: '0 0 16px 0' },
  },
};
