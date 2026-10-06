# 密码传输加密功能学习文档

## 目录

1. [背景与目标](#背景与目标)
2. [核心概念](#核心概念)
3. [整体架构](#整体架构)
4. [后端实现详解](#后端实现详解)
5. [前端实现详解](#前端实现详解)
6. [关键代码走读](#关键代码走读)
7. [安全设计要点](#安全设计要点)
8. [常见问题](#常见问题)
9. [扩展思考](#扩展思考)

---

## 背景与目标

### 为什么要做传输加密

在传统的 Web 登录场景中，用户在前端输入密码后，密码会以明文形式通过 HTTP 请求发送到后端。即使使用 HTTPS，依然存在以下风险：

- **中间人攻击**：如果 HTTPS 配置不当（如使用了过期的 TLS 版本、不安全的证书），攻击者可能截获密码。
- **日志泄露**：反向代理、网关、应用服务器可能在日志中记录请求参数，明文密码会被记录下来。
- **浏览器插件风险**：恶意浏览器插件可以读取表单数据。
- **合规要求**：等保、密评、金融行业规范要求敏感数据传输必须加密。

### 目标

- 前端在发送密码前，使用非对称加密算法（SM2）对密码加密。
- 后端收到密文后，使用对应的私钥解密，再进行密码校验。
- 每次登录使用独立的临时密钥对，私钥用后即焚。
- 兼容现有的 SSO/OAuth2 登录流程。

---

## 核心概念

### 非对称加密

非对称加密使用一对密钥：

- **公钥（Public Key）**：可以公开，用于加密数据。
- **私钥（Private Key）**：必须保密，用于解密数据。

重要特性：

- 用公钥加密的数据，只能用对应的私钥解密。
- 私钥不能从公钥推导出来。
- 公钥可以任意分发，不影响安全性。

### SM2 国密算法

SM2 是中国国家密码管理局发布的非对称加密算法，基于椭圆曲线密码学（ECC）。

| 特性 | 说明 |
|------|------|
| 密钥长度 | 256 位 |
| 安全强度 | 相当于 RSA 2048 位 |
| 性能 | 比 RSA 快 |
| 合规性 | 满足国密/等保/密评要求 |
| 密文格式 | C1C3C2（国标推荐） |

### 为什么不用前端写死公钥

| 方式 | 问题 |
|------|------|
| 前端写死公钥 | 无法轮换；一旦被替换，攻击者可伪造登录；无法做审计 |
| 后端动态下发 | 每次登录独立密钥；私钥用完即焚；可结合风控策略 |

---

## 整体架构

### 时序图

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  前端   │         │  carlos-ui  │         │  carlos-auth │         │    Redis    │
└────┬────┘         └──────┬──────┘         └───────┬──────┘         └──────┬──────┘
     │                      │                        │                       │
     │  1. 访问 IdP 登录页   │                        │                       │
     │─────────────────────▶│                        │                       │
     │                      │                        │                       │
     │  2. 加载 sm-crypto 库 │                        │                       │
     │◀─────────────────────│                        │                       │
     │                      │                        │                       │
     │  3. GET /auth/public-key                       │                       │
     │──────────────────────────────────────────────▶│                       │
     │                      │                        │                       │
     │                      │                        │  4. 生成 SM2 密钥对   │
     │                      │                        │                       │
     │                      │                        │  5. 私钥存入 Redis    │
     │                      │                        │──────────────────────▶│
     │                      │                        │                       │
     │  6. 返回 {keyId, publicKey}                    │                       │
     │◀──────────────────────────────────────────────│                       │
     │                      │                        │                       │
     │  7. 用户输入账号密码  │                        │                       │
     │                      │                        │                       │
     │  8. 用 publicKey 加密 password                 │                       │
     │                      │                        │                       │
     │  9. POST /login (username, encryptedPwd, keyId, encrypted=true)
     │──────────────────────────────────────────────▶│                       │
     │                      │                        │                       │
     │                      │                        │  10. 根据 keyId 取私钥 │
     │                      │                        │──────────────────────▶│
     │                      │                        │                       │
     │                      │                        │  11. 解密得到明文密码  │
     │                      │                        │                       │
     │                      │                        │  12. 删除 Redis 私钥  │
     │                      │                        │──────────────────────▶│
     │                      │                        │                       │
     │                      │                        │  13. Spring Security 认证 │
     │                      │                        │                       │
     │  14. 302 重定向 /oauth2/authorize             │                       │
     │◀──────────────────────────────────────────────│                       │
```

### 两种登录入口

| 登录入口 | 前端位置 | 加密方式 |
|---------|---------|---------|
| IdP 统一登录页（SSO 主流程） | `carlos-auth-service/src/main/resources/templates/login.html` | sm-crypto 直接加密表单 |
| carlos-ui 直接登录（预留） | `src/service/api/auth.ts` 的 `fetchLogin` | sm-crypto 加密后 JSON 提交 |

---

## 后端实现详解

### 1. 公钥下发接口

**文件**：`carlos-auth-service/src/main/java/com/carlos/auth/login/PublicKeyController.java`

核心逻辑：

```java
@GetMapping("/public-key")
public Result<PublicKeyVO> getPublicKey(HttpServletRequest request) {
    // 1. 生成 SM2 密钥对
    Sm2KeyPair keyPair = EncryptUtil.generateSm2KeyPair();
    String keyId = generateKeyId();

    // 2. 私钥写入 Redis，TTL 300 秒
    String privateKeyRedisKey = AuthRedisKey.passwordPrivateKey(keyId);
    RedisUtil.setValue(privateKeyRedisKey, keyPair.getPrivateKey(), KEY_TTL_SECONDS, TimeUnit.SECONDS);

    // 3. 返回公钥
    return Result.success(PublicKeyVO.builder()
        .keyId(keyId)
        .publicKey(keyPair.getPublicKey())
        .algorithm("SM2")
        .ttlSeconds(KEY_TTL_SECONDS)
        .build());
}
```

### 2. 解密工具方法

```java
public static String decryptPassword(String keyId, String cipher) {
    // 1. 从 Redis 取私钥
    String privateKey = RedisUtil.getValue(AuthRedisKey.passwordPrivateKey(keyId));
    if (privateKey == null || privateKey.isBlank()) {
        return null;
    }

    try {
        // 2. 用私钥解密
        SM2 sm2 = SmUtil.sm2(privateKey, null);
        return sm2.decryptStr(cipher, KeyType.PrivateKey);
    } catch (Exception e) {
        return null;
    } finally {
        // 3. 无论成功失败都删除私钥（单次使用）
        RedisUtil.delete(privateKeyRedisKey);
    }
}
```

### 3. 密码解密过滤器

**文件**：`carlos-auth-service/src/main/java/com/carlos/auth/security/filter/PasswordDecryptFilter.java`

作用：

- 拦截 `POST /login` 表单提交
- 识别 `encrypted=true` 和 `keyId`
- 解密密码
- 包装请求，把 `password` 参数替换为明文
- 解密失败返回 401

过滤器链位置：

```java
http.addFilterBefore(new PasswordDecryptFilter(), UsernamePasswordAuthenticationFilter.class)
```

这样 Spring Security 的表单认证过滤器拿到的就是明文密码了。

### 4. Spring Security 配置

**文件**：`OAuth2AuthorizationServerConfig.java`

两处改动：

```java
.authorizeHttpRequests(authorize -> authorize
    .requestMatchers(
        // ... 其他公开接口
        "/auth/public-key"
    ).permitAll()
)

.csrf(csrf -> csrf
    .ignoringRequestMatchers(
        // ... 其他忽略接口
        "/auth/public-key"
    )
)
```

### 5. JSON 登录接口兼容

**文件**：`UserLoginService.java`

对于 `/auth/user/login` JSON 接口，原本的 `decryptPasswordIfNeeded` 方法已支持 `encrypted=true`。

本次扩展为：

```java
public void decryptPasswordIfNeeded(LoginRequest loginRequest) {
    // 优先使用动态密钥解密
    if (keyId != null && !keyId.isBlank()) {
        String decrypted = PublicKeyController.decryptPassword(keyId, cipher);
        // ...
        return;
    }

    // 回退：使用配置文件中的静态 SM2 密钥
    String decrypted = EncryptUtil.sm2Decrypt(cipher);
}
```

---

## 前端实现详解

### 1. IdP 登录页

**文件**：`carlos-auth-service/src/main/resources/templates/login.html`

引入 SM2 库：

```html
<script src="https://cdn.jsdelivr.net/npm/sm-crypto@0.3.13/dist/sm2.js" crossorigin="anonymous"></script>
```

预取公钥：

```javascript
async function loadPublicKey(force = false) {
    if (!force && passwordKey.keyId && passwordKey.publicKey) {
        return passwordKey;
    }

    const resp = await fetch('/auth/public-key', { method: 'GET' });
    const result = await resp.json();
    const data = result.data || result;

    passwordKey = { keyId: data.keyId, publicKey: data.publicKey, loading: false };
    document.getElementById('pwdKeyId').value = data.keyId;
    return passwordKey;
}
```

表单提交前加密：

```javascript
async function doPasswordLogin(event) {
    event.preventDefault();

    const username = document.getElementById('pwdUsername').value;
    const passwordInput = document.getElementById('pwdPassword');
    const password = passwordInput.value;

    // 1. 风控预校验
    // ...

    // 2. 获取公钥
    await loadPublicKey();

    // 3. 加密密码（C1C3C2）
    const encryptedPassword = window.sm2.doEncrypt(password, passwordKey.publicKey, 1);

    // 4. 回填密文、keyId、加密标识
    passwordInput.value = encryptedPassword;
    document.getElementById('pwdKeyId').value = passwordKey.keyId;
    document.getElementById('pwdEncrypted').value = 'true';

    // 5. 提交表单
    document.getElementById('passwordForm').submit();
}
```

HTML 表单新增隐藏域：

```html
<input type="hidden" id="pwdKeyId" name="keyId" value="">
<input type="hidden" id="pwdEncrypted" name="encrypted" value="false">
```

### 2. carlos-ui 直接登录

**文件**：`src/service/api/auth.ts`

```typescript
export async function fetchLogin(username: string, password: string) {
    // 1. 获取公钥
    const { data: keyData, error: keyError } = await fetchPublicKey();
    if (keyError || !keyData) {
        throw new Error('获取加密公钥失败');
    }

    // 2. 加密密码
    const encryptedPassword = encryptPassword(password, keyData.publicKey);

    // 3. 发送加密后的登录请求
    return request<Api.Auth.LoginToken>({
        url: '/auth/user/login',
        method: 'post',
        data: {
            username,
            password: encryptedPassword,
            keyId: keyData.keyId,
            clientId: 'carlos-client',
            encrypted: true
        }
    });
}
```

**文件**：`src/utils/crypto.ts`

```typescript
import { sm2 } from 'sm-crypto';

export function encryptPassword(password: string, publicKey: string): string {
    // 1 = C1C3C2，与后端 Hutool 默认模式一致
    return sm2.doEncrypt(password, publicKey, 1);
}
```

---

## 关键代码走读

### 走读 1：公钥接口为什么可以公开

```java
@GetMapping("/public-key")
public Result<PublicKeyVO> getPublicKey(...) { ... }
```

- 只返回公钥，不返回私钥。
- 公钥本来就是设计为公开的。
- 没有敏感信息泄露风险。
- 但接口做了 CSRF 忽略和 permitAll，可以正常被前端 AJAX 调用。

### 走读 2：为什么私钥要删除

```java
finally {
    RedisUtil.delete(privateKeyRedisKey);
}
```

- 一个 keyId 只对应一次登录尝试。
- 防止攻击者用同一个 keyId 反复提交不同密码。
- 防止私钥在 Redis 中残留过长时间。

### 走读 3：过滤器为什么要包装 HttpServletRequest

```java
DecryptedRequestWrapper wrapper = new DecryptedRequestWrapper(request, plainPassword);
filterChain.doFilter(wrapper, response);
```

- `HttpServletRequest` 的参数是不可变的。
- 要让下游的 `UsernamePasswordAuthenticationFilter` 拿到明文密码，必须包装请求。
- 包装后 `getParameter("password")` 返回明文。

### 走读 4：cipherMode = 1 的含义

前端：

```javascript
window.sm2.doEncrypt(password, publicKey, 1)
```

- `1` 表示 C1C3C2 格式。
- C1 = 随机点坐标
- C3 = SM3 哈希值
- C2 = 实际密文
- 这是国标推荐的默认格式，Hutool 后端默认也使用此格式。

---

## 安全设计要点

### 1. HTTPS 是基础

传输加密不能替代 HTTPS。必须同时满足：

- 全站强制 HTTPS。
- 使用 TLS 1.2 或更高版本。
- 证书有效且配置正确。

### 2. 密钥生命周期

| 阶段 | 处理 |
|------|------|
| 生成 | 每次公钥请求生成新密钥对 |
| 存储 | 私钥仅存 Redis，TTL 300 秒 |
| 使用 | 一次登录尝试消耗一个 keyId |
| 销毁 | 解密后立即删除，无论成败 |

### 3. 兼容性

- 未加密请求继续走明文认证逻辑，不影响旧客户端。
- `/auth/user/login` JSON 接口保持 `encrypted` 字段语义。
- 无 `keyId` 时回退到配置文件静态 SM2 密钥。

### 4. 防重放

- 同一个 `keyId` 只能用一次。
- 私钥删除后，再次提交相同密文无法解密。

### 5. 风控配合

- 登录前仍调用 `/auth/user/pre-check` 做风控决策。
- 可以结合验证码、MFA、IP 限流等策略。

---

## 常见问题

### Q1：前端 sm-crypto 加密后，后端 Hutool 解密失败怎么办？

可能原因：

1. **公钥格式不一致**：sm-crypto 期望 Hex 格式公钥（130 字符，含 04 前缀），后端 `generateSm2KeyPair()` 返回的正是此格式。
2. **cipherMode 不一致**：前端 `doEncrypt(..., 1)` 是 C1C3C2，后端 `SmUtil.sm2(...)` 默认也是 C1C3C2。
3. **编码问题**：密码应使用 UTF-8 编码。

排查方法：

- 用同一对密钥，在前端加密一个固定字符串，在后端直接调用 `decryptPassword` 解密。
- 对比前后端密文长度和结构。

### Q2：公钥接口被刷怎么办？

建议：

- 对 `/auth/public-key` 做 IP 限流。
- 对单个 IP 设置请求频率上限，如 30 次/分钟。
- 登录页预取公钥，避免用户每次点击都请求。

### Q3：用户输入密码后一直不提交，公钥过期了怎么办？

- 公钥 TTL 为 300 秒。
- 如果用户停留超过 300 秒再提交，后端会返回解密失败。
- 前端可以捕获错误，自动重新获取公钥并提示用户重新输入。

### Q4：这个加密能防住 SQL 注入、XSS 吗？

不能。传输加密只解决密码在传输过程中的保密性问题：

- SQL 注入：靠参数化查询/ORM。
- XSS：靠输入过滤和输出转义。
- 密码存储安全：靠 Argon2id 哈希。

---

## 扩展思考

### 1. 改用 RSA 怎么做

如果项目没有国密合规要求，可以改用 RSA：

后端：

```java
KeyPair keyPair = SecureUtil.generateKeyPair("RSA", 2048);
RSA rsa = new RSA(keyPair.getPrivate().getEncoded(), keyPair.getPublic().getEncoded());
String publicKey = rsa.getPublicKeyBase64();
String privateKey = rsa.getPrivateKeyBase64();
```

前端：

```javascript
import JSEncrypt from 'jsencrypt';
const encrypt = new JSEncrypt();
encrypt.setPublicKey(publicKey);
const encrypted = encrypt.encrypt(password);
```

### 2. 结合后端 BFF 代理

更安全的做法：

- 前端不直接调用 `/auth/public-key`，而是调用自己的 BFF（Backend For Frontend）。
- BFF 再去调用 carlos-auth 获取公钥。
- 这样前端不直接感知认证中心的细节。

### 3. 密码输入框的额外保护

- 使用虚拟键盘输入密码。
- 对密码输入框做防键盘记录处理。
- 使用 WebAuthn/Passkey 替代密码。

### 4. 审计与监控

- 记录每次 `/auth/public-key` 请求。
- 监控解密失败次数，异常升高时告警。
- 结合风控引擎识别暴力破解。

---

## 总结

本次改造实现了：

1. **动态 SM2 公钥下发**：每次登录独立密钥。
2. **前端密码加密**：IdP 登录页和 carlos-ui 都支持。
3. **后端解密**：表单登录走 Filter，JSON 登录走 Service。
4. **私钥单次使用**：解密后立即删除，防重放。
5. **向后兼容**：未加密请求仍可正常处理。

核心安全收益：

- 密码在网络传输中不再是明文。
- 即使 HTTPS 被攻破，攻击者拿到的是一次性密文。
- 满足国密合规要求。

---

*文档生成时间：2026-07-10*
