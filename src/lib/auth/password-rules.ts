/** Aturan password baru I:UM — diterapkan nyata, bukan sekadar teks UI. */
export type PasswordRule = {
  id: "length" | "case" | "digit";
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: "Minimal 8 karakter", test: (v) => v.length >= 8 },
  {
    id: "case",
    label: "Mengandung huruf besar dan kecil",
    test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  { id: "digit", label: "Mengandung angka", test: (v) => /[0-9]/.test(v) },
] as const;

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
