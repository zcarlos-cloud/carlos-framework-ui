import { sm2 } from 'sm-crypto';

/**
 * 使用 SM2 公钥加密密码
 *
 * @param password 明文密码
 * @param publicKey SM2 公钥（Hex 格式，130 字符含 04 前缀）
 * @returns SM2 密文（Hex 格式，C1C3C2）
 */
export function encryptPassword(password: string, publicKey: string): string {
  // cipherMode: 1 = C1C3C2（国标），与后端 Hutool 默认模式一致
  return sm2.doEncrypt(password, publicKey, 1);
}

/**
 * 公钥响应结构
 */
export interface PasswordPublicKey {
  /** 密钥 ID */
  keyId: string;
  /** SM2 公钥（Hex） */
  publicKey: string;
  /** 加密算法 */
  algorithm: string;
  /** 私钥有效期（秒） */
  ttlSeconds: number;
}
