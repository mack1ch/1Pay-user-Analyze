import type { UserDataItem } from '../types';
import { getMetricDescription } from './metricDescriptions';

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(items: UserDataItem[], filename = 'user-data.csv'): void {
  const header = 'Категория,Параметр,Значение,Описание';
  const rows = items.map((i) => {
    const desc = i.description ?? getMetricDescription(i.category, i.key);
    return [escapeCsvValue(i.category), escapeCsvValue(i.label), escapeCsvValue(i.value), escapeCsvValue(desc)].join(',');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
