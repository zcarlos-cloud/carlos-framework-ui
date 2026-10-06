/**
 * Enum namespace
 *
 * Backend enum dictionary types
 */
declare namespace Enum {
  interface EnumItem {
    /** enum code value */
    code: string | number;
    /** enum description */
    desc: string;
    /** enum name */
    name: string;
    /** English description；未提供时后端回落为 desc */
    descEn?: string;
    /** 语义色档位（PRIMARY / SUCCESS / WARNING / DANGER / MUTED） */
    color?: string;
  }
}
