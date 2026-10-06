declare module 'sm-crypto' {
  export interface Sm2 {
    doEncrypt(msg: string, publicKey: string, cipherMode?: number): string;
    doDecrypt(encryptData: string, privateKey: string, cipherMode?: number): string;
  }

  export const sm2: Sm2;
}
