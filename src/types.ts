export type UserDataItem = {
  category: string;
  key: string;
  label: string;
  value: string;
  /** Пояснение: что за метрика и как использовать (для тултипа и CSV). */
  description?: string;
};
