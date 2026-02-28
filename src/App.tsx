import { useState, useMemo } from 'react';
import { ConfigProvider, Tooltip } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { theme } from 'antd';
import {
  collectUserData,
  fetchIpAndGeo,
  fetchWebRtcLocalIp,
  fetchBattery,
  fetchMediaDevices,
  fetchUserAgentHints,
  fetchPermissions,
  fetchKeyboardLayout,
  fetchAdBlockDetect,
  fetchScreenDetails,
  fetchStorageEstimate,
} from './utils/collectUserData';
import { exportToCsv } from './utils/exportCsv';
import { getMetricDescription } from './utils/metricDescriptions';
import type { UserDataItem } from './types';

function groupByCategory(items: UserDataItem[]): Map<string, UserDataItem[]> {
  const map = new Map<string, UserDataItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export default function App() {
  const [userData, setUserData] = useState<UserDataItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingIp, setLoadingIp] = useState(false);

  const grouped = useMemo(() => (userData ? groupByCategory(userData) : null), [userData]);

  const handleCollect = () => {
    setLoading(true);
    setLoadingIp(false);
    setUserData(null);
    requestAnimationFrame(() => {
      const data = collectUserData();
      setUserData(data);
      setLoading(false);

      setLoadingIp(true);
      Promise.all([
        fetchIpAndGeo(),
        fetchWebRtcLocalIp(),
        fetchBattery(),
        fetchMediaDevices(),
        fetchUserAgentHints(),
        fetchPermissions(),
        fetchKeyboardLayout(),
        fetchAdBlockDetect(),
        fetchScreenDetails(),
        fetchStorageEstimate(),
      ]).then((results) => {
        const extra = results.flat();
        setUserData((prev) => [...(prev ?? []), ...extra]);
        setLoadingIp(false);
      });
    });
  };

  const handleExportCsv = () => {
    if (!userData?.length) return;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    exportToCsv(userData, `user-data-${timestamp}.csv`);
  };

  return (
    <ConfigProvider locale={ruRU} theme={{ algorithm: theme.darkAlgorithm }}>
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-100 mb-1">
          Данные, которые видит сайт
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Нажмите кнопку — отобразится информация о браузере, экране, сети (включая IP через внешний запрос) и окружении. Данные можно экспортировать в CSV.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <button
            type="button"
            onClick={handleCollect}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Сбор…' : 'Показать данные'}
          </button>
          {userData && userData.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loadingIp}
              className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-70 font-medium transition-colors border border-slate-600"
            >
              Экспорт в CSV
            </button>
          )}
        </div>

        {loadingIp && (
          <p className="text-amber-400/90 text-sm mb-4">
            Загрузка IP и геолокации…
          </p>
        )}

        {userData && grouped && (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([category, items]) => (
              <section
                key={category}
                className="rounded-xl bg-slate-900/80 border border-slate-700/80 overflow-hidden"
              >
                <h2 className="px-4 py-3 text-sm font-medium text-emerald-400 bg-slate-800/60 border-b border-slate-700/80">
                  {category}
                </h2>
                <ul className="divide-y divide-slate-700/60">
                  {items.map((row) => {
                    const description = row.description ?? getMetricDescription(row.category, row.key);
                    const labelContent = (
                      <span
                        className={`text-slate-400 text-sm ${description ? 'cursor-help border-b border-dotted border-slate-500 border-opacity-50' : ''}`}
                      >
                        {row.label}
                        {description && (
                          <span className="inline-block ml-1.5 text-slate-500 opacity-70" aria-hidden>
                            ⓘ
                          </span>
                        )}
                      </span>
                    );
                    return (
                      <li
                        key={`${row.category}-${row.key}`}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        {description ? (
                          <Tooltip title={description} placement="topLeft" mouseEnterDelay={0.2}>
                            {labelContent}
                          </Tooltip>
                        ) : (
                          labelContent
                        )}
                        <span className="text-slate-100 text-sm font-mono break-all sm:text-right">
                          {row.value}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {userData && userData.length === 0 && !loadingIp && (
          <p className="text-slate-500 text-sm">Не удалось собрать данные.</p>
        )}
      </div>
    </div>
    </ConfigProvider>
  );
}
