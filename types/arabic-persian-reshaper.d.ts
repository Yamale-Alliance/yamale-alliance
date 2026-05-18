declare module "arabic-persian-reshaper" {
  export const ArabicShaper: {
    convertArabic: (text: string) => string;
    convertArabicBack: (text: string) => string;
  };
  export const PersianShaper: {
    convertPersian: (text: string) => string;
  };
}
