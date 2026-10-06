export const REG_USER_NAME = /^[\u4E00-\u9FA5a-zA-Z0-9_-]{4,16}$/;

/** Phone reg */
export const REG_PHONE =
  /^[1](([3][0-9])|([4][01456789])|([5][012356789])|([6][2567])|([7][0-8])|([8][0-9])|([9][012356789]))[0-9]{8}$/;

/**
 * Password reg
 *
 * 6-18 characters, including letters, numbers, underscores, and common special characters
 */
export const REG_PWD = /^[\w!@#$%^&*()\-+=.,;:?]{6,18}$/;

/** Email reg */
export const REG_EMAIL = /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;

/**
 * 密码「特殊字符」集合（修改密码时的复杂度判定用）
 *
 * ⚠️ 必须与后端 `OrgUserService.checkPasswordComplexity` 的字符类逐字一致：
 * `[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]`
 *
 * 若前端放宽（例如写成 [^a-zA-Z0-9]），`abcDEF~`、`abcDEF `（尾部空格）、`abcDEF中`
 * 会被前端判为「命中 3 类」而放行、却被后端拒绝，用户只看到一句
 * 「密码复杂度不符合要求」，无从得知到底是哪个字符不合法。
 *
 * 注意与 REG_PWD 区分：REG_PWD 是登录表单的 6-18 位格式校验，规则不同，勿混用。
 */
export const REG_PWD_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/** Six digit code reg */
export const REG_CODE_SIX = /^\d{6}$/;

/** Four digit code reg */
export const REG_CODE_FOUR = /^\d{4}$/;

/** Url reg */
export const REG_URL =
  /(((^https?:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+(?::\d+)?|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)$/;

/**
 * OAuth2 重定向地址
 *
 * **不要**用 `REG_URL` 校验 redirectUris：那条规则要求 `http(s)://` 或 `www.` 开头，
 * 而重定向地址允许任意 scheme —— 移动端(应用类型=3)的 `myapp://callback`、
 * 桌面端的 `com.example.app://cb` 都是合法的，用 REG_URL 会把它们全部拦下。
 *
 * 这里只要求「RFC 3986 的 scheme + `://` + 无空白」：足以拦住最常见的笔误
 * （漏写 scheme 的 `localhost:9527/callback`、带空格的地址），又不会误伤自定义 scheme。
 */
export const REG_REDIRECT_URI = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+$/;

/**
 * 业务编码（模块编码 / 配置编码 / 字典编码 / 消息类型编码 / 权限码 …）
 *
 * 只拦「明显不合法」：必须以字母开头，只含字母、数字、下划线、点、连字符，长度 2-64。
 *
 * **不要**把各表的列宽塞进这里：`type_code` 是 VARCHAR(32)、`template_code` 是
 * VARCHAR(50)、`config_code` 又是另一个值，长度上限请用 `createMaxLengthRule(列宽)`
 * 单独挂，两者职责分开，超长时报错才能指出「最多 N 个字符」。
 *
 * 后端这些编码字段目前**基本没有格式校验**（见各 `*CreateParam`），唯一性也只由
 * 数据库唯一索引兜底。这条规则的价值是让用户当场看到错误，而不是提交后拿到一句
 * 无信息量的「新增失败」。
 */
export const REG_BIZ_CODE = /^[a-zA-Z][a-zA-Z0-9_.-]{1,63}$/;

/**
 * 语言标识（BCP-47 的极简子集：`zh` / `zh-CN` / `en_US`）
 *
 * ⚠️ 必须与后端逐字一致，改一处就要改另一处：
 * `SysI18nController.LANG_PATTERN` 与 `SysI18nCreateParam.lang` 的 `@Pattern`
 * 都是 `^[a-zA-Z]{2}([-_][a-zA-Z]{2})?$`
 */
export const REG_I18N_LANG = /^[a-zA-Z]{2}([-_][a-zA-Z]{2})?$/;
