/** The storage namespace */
declare namespace StorageType {
  interface Session {
    /** The theme color */
    themeColor: string;
    // /**
    //  * the theme settings
    //  */
    // themeSettings: App.Theme.ThemeSetting;
  }

  interface Local {
    /** The i18n language */
    lang: App.I18n.LangType;
    /** The token */
    token: string;
    /** Fixed sider with mix-menu */
    mixSiderFixed: CommonType.YesOrNo;
    /** The refresh token */
    refreshToken: string;
    /**
     * 访问令牌的到期时间戳（毫秒）
     *
     * 由 `saveAuthStorage` 从后端返回的 `expiresIn` 换算而来，供「长时间不产生请求的页面」
     * 提前续期用（见 `@/hooks/business/warm-flow-token`）。后端未返回 `expiresIn` 时不存在。
     */
    tokenExpiresAt: number;
    /** The theme color */
    themeColor: string;
    /** The theme settings */
    themeSettings: App.Theme.ThemeSetting;
    /**
     * The override theme flags
     *
     * The value is the build time of the project
     */
    overrideThemeFlag: string;
    /** The global tabs */
    globalTabs: App.Global.Tab[];
    /** The backup theme setting before is mobile */
    backupThemeSettingBeforeIsMobile: {
      layout: UnionKey.ThemeLayoutMode;
      siderCollapse: boolean;
    };
  }
}
