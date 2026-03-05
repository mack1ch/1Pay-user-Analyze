import { md5 } from 'js-md5';
import type { UserDataItem } from '../types';

function item(category: string, key: string, label: string, value: string | number | boolean): UserDataItem {
  return { category, key, label, value: String(value ?? '—') };
}

function getWebGLInfo(): { vendor: string; renderer: string; extensions: string[]; params: Record<string, string | number> } | null {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return null;
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugExt ? gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) : null;
    const renderer = debugExt ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : null;
    const extList: string[] = [];
    const EXTENSIONS = 0x1f01;
    try {
      const supported = gl.getParameter(EXTENSIONS) as string;
      if (supported && typeof supported === 'string') extList.push(...supported.split(' '));
      else if (Array.isArray(supported)) extList.push(...supported);
    } catch {
      // some browsers don't expose full list
    }
    const params: Record<string, string | number> = {};
    try {
      params.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      params.MAX_VIEWPORT_DIMS = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) as number[]).join('x');
      const lineRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) as number[];
      if (lineRange?.length) params.ALIASED_LINE_WIDTH_RANGE = `${lineRange[0]}..${lineRange[1]}`;
      const VERSION = 0x1f02;
      const v = gl.getParameter(VERSION);
      if (v) params.VERSION = v as string;
      params.MAX_RENDERBUFFER_SIZE = gl.getParameter(0x84e8) as number;
      params.MAX_CUBE_MAP_TEXTURE_SIZE = gl.getParameter(0x851c) as number;
      params.MAX_VERTEX_ATTRIBS = gl.getParameter(0x8869) as number;
      const vuv = gl.getParameter(0x8dfb);
      if (vuv != null) params.MAX_VERTEX_UNIFORM_VECTORS = vuv as number;
      const fuv = gl.getParameter(0x8dfd);
      if (fuv != null) params.MAX_FRAGMENT_UNIFORM_VECTORS = fuv as number;
    } catch {
      // ignore
    }
    return {
      vendor: vendor ?? '—',
      renderer: renderer ?? '—',
      extensions: extList.length ? extList : (gl.getParameter(EXTENSIONS) as string)?.split(' ') ?? [],
      params,
    };
  } catch {
    return null;
  }
}

/**
 * Canvas fingerprint по методу BrowserLeaks (https://browserleaks.com/canvas).
 * Та же отрисовка и MD5 от toDataURL('image/png') для совместимости и лучшей различимости.
 */
function getCanvasFingerprint(): string {
  try {
    const c = document.createElement('canvas');
    c.width = 220;
    c.height = 30;
    const ctx = c.getContext('2d');
    if (!ctx) return '—';
    const txt = 'BrowserLeaks,com <canvas> 1.0';
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText(txt, 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText(txt, 4, 17);
    const dataUrl = c.toDataURL('image/png');
    return md5(dataUrl).toUpperCase();
  } catch {
    return '—';
  }
}

function getAudioFingerprint(): string {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, 4096, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.1);
    const offline = new OfflineAudioContext(1, 4096, sampleRate);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    src.connect(offline.destination);
    src.start(0);
    return offline.sampleRate + '-' + buffer.length;
  } catch {
    try {
      const ctx = new AudioContext();
      let hash = 0;
      hash = ((hash << 5) - hash + (ctx.sampleRate || 0)) | 0;
      hash = ((hash << 5) - hash + (ctx.baseLatency || 0) * 1000) | 0;
      return (hash >>> 0).toString(16);
    } catch {
      return '—';
    }
  }
}

const FONT_SAMPLE_LIST = [
  'Arial', 'Arial Black', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana',
  'Helvetica', 'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Lucida Console',
  'Palatino Linotype', 'Tahoma', 'Cambria', 'Calibri', 'Consolas', 'Monaco',
  'Menlo', 'Roboto', 'Open Sans', 'Segoe UI', 'system-ui',
];

function getFontsPresent(): string[] {
  const present: string[] = [];
  if (typeof document === 'undefined' || !document.body) return present;
  const test = document.createElement('span');
  test.style.position = 'absolute';
  test.style.left = '-9999px';
  test.style.fontSize = '72px';
  test.textContent = 'mmmmmmmmmmlli';
  document.body.appendChild(test);
  const baseWidth = test.offsetWidth;
  for (const font of FONT_SAMPLE_LIST) {
    test.style.fontFamily = `'${font}', monospace`;
    if (test.offsetWidth !== baseWidth) present.push(font);
  }
  document.body.removeChild(test);
  return present;
}

function getPreferredColorScheme(): string {
  if (typeof window === 'undefined' || !window.matchMedia) return '—';
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const light = window.matchMedia('(prefers-color-scheme: light)').matches;
  if (dark) return 'dark';
  if (light) return 'light';
  return 'no preference';
}

export function collectUserData(): UserDataItem[] {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const screen = typeof window !== 'undefined' ? window.screen : null;
  const doc = typeof document !== 'undefined' ? document : null;
  const loc = typeof location !== 'undefined' ? location : null;

  const data: UserDataItem[] = [];

  // ——— 1. Аппаратные метрики (Hardware) ———
  if (nav) {
    data.push(item('Браузер', 'userAgent', 'User Agent', nav.userAgent));
    data.push(item('Браузер', 'appVersion', 'App Version', (nav as Navigator & { appVersion?: string }).appVersion ?? '—'));
    data.push(item('Браузер', 'appName', 'App Name', (nav as Navigator & { appName?: string }).appName ?? '—'));
    data.push(item('Браузер', 'appCodeName', 'App Code Name', (nav as Navigator & { appCodeName?: string }).appCodeName ?? '—'));
    data.push(item('Браузер', 'product', 'Product', (nav as Navigator & { product?: string }).product ?? '—'));
    data.push(item('Браузер', 'productSub', 'Product Sub', (nav as Navigator & { productSub?: string }).productSub ?? '—'));
    data.push(item('Браузер', 'language', 'Язык', nav.language));
    data.push(item('Браузер', 'languages', 'Языки', nav.languages?.join(', ') ?? '—'));
    data.push(item('Браузер', 'platform', 'Платформа', nav.platform));
    data.push(item('Браузер', 'cookieEnabled', 'Cookies включены', nav.cookieEnabled));
    data.push(item('Браузер', 'doNotTrack', 'Do Not Track', nav.doNotTrack ?? '—'));
    data.push(item('Аппаратные', 'hardwareConcurrency', 'Логических процессоров (ядра)', nav.hardwareConcurrency ?? '—'));
    data.push(item('Аппаратные', 'deviceMemory', 'ОЗУ (GB, приблизительно)', (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? '—'));
    data.push(item('Браузер', 'maxTouchPoints', 'Точек касания', nav.maxTouchPoints));
    data.push(item('Браузер', 'vendor', 'Вендор', nav.vendor));
    data.push(item('Браузер', 'pdfViewerEnabled', 'PDF в браузере', (nav as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled ?? '—'));
    data.push(item('Браузер', 'onLine', 'Онлайн', nav.onLine));
    const plugs = (nav as Navigator & { plugins?: { length: number } }).plugins;
    if (plugs) data.push(item('Браузер', 'pluginsCount', 'Плагинов (plugins.length)', plugs.length));
    const mimes = (nav as Navigator & { mimeTypes?: { length: number } }).mimeTypes;
    if (mimes) data.push(item('Браузер', 'mimeTypesCount', 'MIME-типов (mimeTypes.length)', mimes.length));
  }

  // GPU / WebGL: Unmasked Vendor и Renderer + расширения + параметры
  const webgl = getWebGLInfo();
  if (webgl) {
    data.push(item('GPU (WebGL)', 'unmaskedVendor', 'Unmasked Vendor', webgl.vendor));
    data.push(item('GPU (WebGL)', 'unmaskedRenderer', 'Unmasked Renderer', webgl.renderer));
    const extStr = webgl.extensions.length ? webgl.extensions.join(', ') : '—';
    if (webgl.extensions.length > 0) {
      data.push(item('GPU (WebGL)', 'extensionsCount', 'Кол-во расширений WebGL', webgl.extensions.length));
      data.push(item('GPU (WebGL)', 'extensions', 'Расширения WebGL', extStr.length > 300 ? extStr.slice(0, 300) + '…' : extStr));
    }
    Object.entries(webgl.params).forEach(([k, v]) => {
      data.push(item('WebGL параметры', k, k, v));
    });
  }

  // Аудио-карта (AudioContext)
  try {
    const actx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    data.push(item('Аудио', 'sampleRate', 'Частота дискретизации', actx.sampleRate));
    data.push(item('Аудио', 'state', 'Состояние AudioContext', actx.state));
    data.push(item('Аудио', 'baseLatency', 'Базовая задержка (с)', actx.baseLatency));
    if (actx.close) actx.close();
  } catch {
    data.push(item('Аудио', 'audioContext', 'AudioContext', 'недоступен'));
  }

  // Датчики: наличие API
  const sensors = {
    DeviceMotionEvent: typeof DeviceMotionEvent !== 'undefined',
    DeviceOrientationEvent: typeof DeviceOrientationEvent !== 'undefined',
    AmbientLightSensor: typeof (window as unknown as { AmbientLightSensor?: unknown }).AmbientLightSensor !== 'undefined',
  };
  data.push(item('Датчики', 'deviceMotion', 'Акселерометр (DeviceMotion)', sensors.DeviceMotionEvent));
  data.push(item('Датчики', 'deviceOrientation', 'Гироскоп/ориентация (DeviceOrientation)', sensors.DeviceOrientationEvent));
  data.push(item('Датчики', 'ambientLight', 'Датчик освещённости (AmbientLightSensor)', sensors.AmbientLightSensor));

  // ——— Экран ———
  if (screen) {
    data.push(item('Экран', 'width', 'Ширина экрана', screen.width));
    data.push(item('Экран', 'height', 'Высота экрана', screen.height));
    data.push(item('Экран', 'availWidth', 'Доступная ширина', screen.availWidth));
    data.push(item('Экран', 'availHeight', 'Доступная высота', screen.availHeight));
    data.push(item('Экран', 'availTop', 'Отступ сверху', (screen as Screen & { availTop?: number }).availTop ?? '—'));
    data.push(item('Экран', 'availLeft', 'Отступ слева', (screen as Screen & { availLeft?: number }).availLeft ?? '—'));
    data.push(item('Экран', 'colorDepth', 'Глубина цвета', screen.colorDepth));
    data.push(item('Экран', 'pixelDepth', 'Глубина пикселя', screen.pixelDepth));
    data.push(item('Экран', 'orientation', 'Ориентация', screen.orientation?.type ?? '—'));
    data.push(item('Экран', 'devicePixelRatio', 'Масштабирование ОС (DPR)', typeof window !== 'undefined' ? window.devicePixelRatio : '—'));
  }

  // Цветовой охват и HDR
  if (typeof window !== 'undefined' && window.matchMedia) {
    data.push(item('Экран', 'colorGamutP3', 'Цветовой охват P3', window.matchMedia('(color-gamut: p3)').matches));
    data.push(item('Экран', 'colorGamutRec2020', 'Цветовой охват Rec.2020', window.matchMedia('(color-gamut: rec2020)').matches));
    data.push(item('Экран', 'colorGamutSrgb', 'sRGB', window.matchMedia('(color-gamut: srgb)').matches));
    data.push(item('Экран', 'hdr', 'HDR (dynamic-range: high)', window.matchMedia('(dynamic-range: high)').matches));
    data.push(item('Экран', 'invertedColors', 'Инвертированные цвета', window.matchMedia('(inverted-colors: inverted)').matches));
    data.push(item('Экран', 'forcedColors', 'Принудительные цвета (forced-colors)', window.matchMedia('(forced-colors: active)').matches));
  }
  if (screen && (screen as Screen & { isExtended?: boolean }).isExtended !== undefined) {
    data.push(item('Экран', 'isExtended', 'Несколько мониторов (isExtended)', (screen as Screen & { isExtended?: boolean }).isExtended ?? false));
  }

  // Окно (viewport)
  if (typeof window !== 'undefined') {
    data.push(item('Окно', 'innerWidth', 'Ширина окна', window.innerWidth));
    data.push(item('Окно', 'innerHeight', 'Высота окна', window.innerHeight));
    data.push(item('Окно', 'outerWidth', 'Внешняя ширина', window.outerWidth));
    data.push(item('Окно', 'outerHeight', 'Внешняя высота', window.outerHeight));
    data.push(item('Окно', 'screenX', 'Позиция X (screenX)', window.screenX));
    data.push(item('Окно', 'screenY', 'Позиция Y (screenY)', window.screenY));
    data.push(item('Окно', 'screenLeft', 'Позиция слева (screenLeft)', (window as Window & { screenLeft?: number }).screenLeft ?? window.screenX));
    data.push(item('Окно', 'screenTop', 'Позиция сверху (screenTop)', (window as Window & { screenTop?: number }).screenTop ?? window.screenY));
    let scrollbarW: number | string = '—';
    try {
      if (document.documentElement) {
        const w = document.documentElement.offsetWidth - document.documentElement.clientWidth;
        if (w >= 0 && w <= 30) scrollbarW = w;
      }
    } catch {
      // ignore
    }
    data.push(item('Окно', 'scrollbarWidth', 'Ширина скроллбара (прибл.)', scrollbarW));
    data.push(item('Окно', 'frameCount', 'Кол-во фреймов (window.length)', window.length));
    data.push(item('Окно', 'windowName', 'Имя окна (window.name)', (window.name || '') || '—'));
    data.push(item('Окно', 'inIframe', 'В iframe', window.self !== window.top));
  }

  // Время и часовой пояс
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    data.push(item('Время', 'timeZone', 'Часовой пояс', tz));
    data.push(item('Время', 'timeZoneOffset', 'Смещение (мин)', new Date().getTimezoneOffset()));
    data.push(item('Время', 'localTime', 'Локальное время', new Date().toLocaleString()));
  } catch {
    data.push(item('Время', 'timeZone', 'Часовой пояс', '—'));
  }

  // Предпочтения системы
  if (typeof window !== 'undefined' && window.matchMedia) {
    data.push(item('Предпочтения', 'colorScheme', 'Цветовая схема', getPreferredColorScheme()));
    data.push(item('Предпочтения', 'reducedMotion', 'Уменьшенное движение', window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'да' : 'нет'));
    data.push(item('Предпочтения', 'reducedTransparency', 'Уменьшенная прозрачность', window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'да' : 'нет'));
    data.push(item('Предпочтения', 'reducedData', 'Меньше данных (prefers-reduced-data)', window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'да' : 'нет'));
    data.push(item('Предпочтения', 'prefersContrast', 'Контраст (prefers-contrast)', window.matchMedia('(prefers-contrast: more)').matches ? 'more' : window.matchMedia('(prefers-contrast: less)').matches ? 'less' : 'no-preference'));
    data.push(item('Предпочтения', 'hoverNone', 'Без наведения (hover: none)', window.matchMedia('(hover: none)').matches));
    data.push(item('Предпочтения', 'pointerCoarse', 'Указатель грубый (touch)', window.matchMedia('(pointer: coarse)').matches));
    data.push(item('Предпочтения', 'pointerFine', 'Указатель точный (мышь)', window.matchMedia('(pointer: fine)').matches));
  }

  // Хранилище
  try {
    const ls = typeof localStorage !== 'undefined';
    const ss = typeof sessionStorage !== 'undefined';
    const idb = typeof indexedDB !== 'undefined';
    data.push(item('Хранилище', 'localStorage', 'localStorage', ls ? 'доступно' : 'нет'));
    data.push(item('Хранилище', 'sessionStorage', 'sessionStorage', ss ? 'доступно' : 'нет'));
    data.push(item('Хранилище', 'indexedDB', 'IndexedDB', idb ? 'доступно' : 'нет'));
    if (ls) {
      let count = 0;
      try {
        count = localStorage.length;
      } catch {
        count = -1;
      }
      data.push(item('Хранилище', 'localStorageKeys', 'Ключей в localStorage', count >= 0 ? count : '—'));
    }
  } catch {
    data.push(item('Хранилище', 'storage', 'Хранилище', '—'));
  }

  // История
  if (typeof history !== 'undefined') {
    data.push(item('История', 'historyLength', 'Записей в history', history.length));
  }

  // Сеть (Connection API)
  const conn = typeof navigator !== 'undefined' && (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
  if (conn) {
    data.push(item('Сеть', 'effectiveType', 'Тип соединения (4G/WiFi и т.д.)', conn.effectiveType ?? '—'));
    data.push(item('Сеть', 'downlink', 'Скорость (Mbps)', conn.downlink ?? '—'));
    data.push(item('Сеть', 'rtt', 'RTT (мс)', conn.rtt ?? '—'));
    data.push(item('Сеть', 'saveData', 'Режим экономии данных', conn.saveData ?? false));
  }

  // DNS Prefetching — поддержка
  try {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    data.push(item('Сеть', 'dnsPrefetch', 'Поддержка DNS Prefetch', link.rel === 'dns-prefetch'));
  } catch {
    data.push(item('Сеть', 'dnsPrefetch', 'Поддержка DNS Prefetch', '—'));
  }

  // ——— Отпечатки ———
  data.push(item('Отпечаток', 'canvasHash', 'Canvas Fingerprint', getCanvasFingerprint()));
  data.push(item('Отпечаток', 'audioFingerprint', 'Audio Fingerprint', getAudioFingerprint()));

  // Шрифты (ограниченный список)
  try {
    const fonts = getFontsPresent();
    data.push(item('Отпечаток', 'fontsDetected', 'Обнаружено шрифтов (выборка)', fonts.length));
    if (fonts.length > 0) data.push(item('Отпечаток', 'fontsList', 'Шрифты', fonts.join(', ')));
  } catch {
    data.push(item('Отпечаток', 'fontsDetected', 'Шрифты', '—'));
  }

  // ——— Ввод и периферия ———
  data.push(item('Ввод', 'maxTouchPoints', 'Точек касания', nav?.maxTouchPoints ?? '—'));
  data.push(item('Ввод', 'touchSupport', "Поддержка touch ('ontouchstart' in window)", typeof window !== 'undefined' && 'ontouchstart' in window));
  data.push(item('Ввод', 'pointerEvents', 'Pointer Events', typeof window !== 'undefined' && typeof PointerEvent !== 'undefined'));

  // Геймпады (синхронно — список подключённых)
  if (typeof navigator !== 'undefined' && navigator.getGamepads) {
    const pads = navigator.getGamepads();
    const connected = pads ? Array.from(pads).filter((p) => p != null && p.connected) : [];
    data.push(item('Ввод', 'gamepadsCount', 'Подключённых геймпадов', connected.length));
    connected.forEach((p, i) => {
      if (p) data.push(item('Ввод', `gamepad_${i}`, `Геймпад ${i} (ID)`, p.id || '—'));
    });
  }

  // ——— Бот / автоматизация (признаки, без гарантий) ———
  const w = typeof window !== 'undefined' ? window : null;
  const docGlobal = typeof document !== 'undefined' ? document : null;
  type WinBot = {
    __playwright?: unknown;
    __pw_?: unknown;
    puppeteer?: unknown;
    __puppeteer_evaluation_script__?: unknown;
    __puppeteer_evaluation_script_rejected__?: unknown;
    _phantom?: unknown;
    __phantom?: unknown;
    callPhantom?: unknown;
    __nightmare?: unknown;
    __phantomas?: unknown;
    Buffer?: unknown;
    cdc_?: unknown;
    driver?: unknown;
    chrome?: { runtime?: unknown };
  };
  const winBot = w as unknown as WinBot;
  const nd = navigator as Navigator & {
    webdriver?: boolean;
    __driver_evaluate?: unknown;
    __webdriver_evaluate?: unknown;
    __selenium_unwrapped?: unknown;
    __fxdriver_evaluate?: unknown;
    _Selenium_IDE_Recorder?: unknown;
    _selenium?: unknown;
    callSelenium?: unknown;
    driver?: unknown;
    plugins?: { length: number };
    languages?: string[];
  };

  const hasPlaywright = !!(winBot?.__playwright ?? (typeof w !== 'undefined' && w !== null && (w as unknown as Record<string, unknown>)['__playwright'] != null));
  let hasPwPrefix = false;
  try {
    if (w && typeof Object.keys === 'function') hasPwPrefix = Object.keys(w).some((k) => k.startsWith('__pw_'));
  } catch {
    // ignore
  }
  data.push(item('Бот / автоматизация', 'webdriver', 'navigator.webdriver (явный флаг)', !!nd.webdriver));
  data.push(item('Бот / автоматизация', 'playwright', 'Playwright (__playwright / __pw_*)', hasPlaywright || hasPwPrefix));
  data.push(item('Бот / автоматизация', 'puppeteer', 'Puppeteer (puppeteer / __puppeteer_eval*)', !!(winBot?.puppeteer ?? winBot?.__puppeteer_evaluation_script__ ?? winBot?.__puppeteer_evaluation_script_rejected__)));
  data.push(item('Бот / автоматизация', 'phantom', 'Phantom (callPhantom / _phantom / __phantom)', !!(winBot?.callPhantom ?? winBot?._phantom ?? winBot?.__phantom)));
  data.push(item('Бот / автоматизация', 'nightmare', 'Nightmare / Phantomas', !!(winBot?.__nightmare ?? winBot?.__phantomas)));
  data.push(item('Бот / автоматизация', 'selenium', 'Selenium (driver / __driver_* / _selenium)', !!(nd.__driver_evaluate ?? nd.__webdriver_evaluate ?? nd.__selenium_unwrapped ?? nd._selenium ?? nd.driver)));
  let hasChromeCdc = false;
  try {
    if (docGlobal && typeof Object.keys === 'function') hasChromeCdc = Object.keys(docGlobal).some((k) => k.startsWith('$cdc_') || k.startsWith('$chrome_'));
  } catch {
    // ignore
  }
  data.push(item('Бот / автоматизация', 'chromeCdc', 'Chrome CDC (document.$cdc_* / $chrome_*)', hasChromeCdc));
  data.push(item('Бот / автоматизация', 'pluginsZero', 'Плагинов 0 (типично для headless)', !!(nd.plugins && nd.plugins.length === 0)));
  data.push(item('Бот / автоматизация', 'languagesEmpty', 'Языков 0 или 1 (подозрительно)', !!(nd.languages && (nd.languages.length === 0 || nd.languages.length === 1))));
  const noChromeRt = typeof w !== 'undefined' && !(w as unknown as { chrome?: { runtime?: unknown } }).chrome?.runtime && /Chrome/.test(navigator.userAgent);
  data.push(item('Бот / автоматизация', 'noChromeRuntime', 'Нет window.chrome.runtime (Chrome headless)', noChromeRt));
  data.push(item('Бот / автоматизация', 'screenTinyOrZero', 'Экран 0x0 или 800x600 (headless)', !!(screen && (screen.width === 0 || (screen.width === 800 && screen.height === 600)))));
  data.push(item('Бот / автоматизация', 'noOuterChrome', 'Нет «рамки» браузера (outer≈inner)', !!(typeof window !== 'undefined' && Math.abs(window.outerWidth - window.innerWidth) <= 16 && Math.abs(window.outerHeight - window.innerHeight) <= 16)));
  if (webgl) {
    const r = (webgl.renderer || '').toLowerCase();
    const softRender = r.includes('swiftshader') || r.includes('mesa') || r.includes('llvmpipe') || r.includes('software');
    data.push(item('Бот / автоматизация', 'webglSoftware', 'WebGL софт-рендер (SwiftShader/Mesa)', softRender));
  }
  data.push(item('Бот / автоматизация', 'noPermissionsAPI', 'Нет Permissions API', typeof navigator !== 'undefined' && (navigator as Navigator & { permissions?: unknown }).permissions == null));

  // Сводка по признакам (эвристика, не диагноз)
  const botFlags = [
    !!nd.webdriver,
    hasPlaywright || hasPwPrefix,
    !!(winBot?.puppeteer ?? winBot?.__puppeteer_evaluation_script__),
    !!(winBot?.callPhantom ?? winBot?._phantom),
    !!(winBot?.__nightmare ?? winBot?.__phantomas),
    !!(nd.__driver_evaluate ?? nd.__webdriver_evaluate ?? nd._selenium ?? nd.driver),
    hasChromeCdc,
  ].filter(Boolean).length;
  const weakFlags = [
    nd.plugins?.length === 0,
    nd.languages && (nd.languages.length === 0 || nd.languages.length === 1),
    screen && (screen.width === 0 || (screen.width === 800 && screen.height === 600)),
    typeof window !== 'undefined' && Math.abs(window.outerWidth - window.innerWidth) <= 16,
    webgl ? /swiftshader|mesa|llvmpipe|software/.test((webgl.renderer || '').toLowerCase()) : false,
  ].filter(Boolean).length;
  let botSummary = 'низкая';
  if (botFlags >= 1) botSummary = 'высокая (есть явные флаги автоматизации)';
  else if (botFlags === 0 && weakFlags >= 3) botSummary = 'средняя (несколько косвенных признаков)';
  else if (weakFlags >= 1) botSummary = 'низкая (1–2 косвенных признака)';
  data.push(item('Бот / автоматизация', 'botRiskSummary', 'Вероятность бота (эвристика)', botSummary));

  // PWA
  if (typeof window !== 'undefined' && window.matchMedia) {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    data.push(item('Окружение', 'pwaStandalone', 'PWA (режим приложения)', standalone));
  }

  // ——— Мизерные: точность Math ———
  try {
    const sinVal = Math.sin(1e10);
    const cosVal = Math.cos(1e10);
    data.push(item('Мизерные', 'mathSinPrecision', 'Math.sin(1e10)', sinVal));
    data.push(item('Мизерные', 'mathCosPrecision', 'Math.cos(1e10)', cosVal));
    data.push(item('Мизерные', 'mathTanPrecision', 'Math.tan(1e10)', Math.tan(1e10)));
  } catch {
    data.push(item('Мизерные', 'mathPrecision', 'Math precision', '—'));
  }

  // Performance (без разрешений)
  if (typeof window !== 'undefined' && window.performance) {
    data.push(item('Производительность', 'timeOrigin', 'Performance timeOrigin', window.performance.timeOrigin));
    const mem = (window.performance as Performance & { memory?: { jsHeapSizeLimit?: number; totalJSHeapSize?: number; usedJSHeapSize?: number } }).memory;
    if (mem) {
      data.push(item('Производительность', 'jsHeapSizeLimit', 'JS Heap Limit (байт)', mem.jsHeapSizeLimit ?? '—'));
      data.push(item('Производительность', 'usedJSHeapSize', 'Used JS Heap (байт)', mem.usedJSHeapSize ?? '—'));
    }
  }

  // Intl (без разрешений)
  try {
    data.push(item('Intl', 'defaultLocale', 'Локаль по умолчанию', Intl.DateTimeFormat().resolvedOptions().locale));
    if (typeof Intl.supportedValuesOf === 'function') {
      const calendars = Intl.supportedValuesOf('calendar') as string[];
      data.push(item('Intl', 'calendarsCount', 'Поддерживаемых календарей', calendars?.length ?? '—'));
    }
  } catch {
    data.push(item('Intl', 'locale', 'Intl', '—'));
  }

  // Документ / страница
  if (doc) {
    data.push(item('Страница', 'title', 'Заголовок', doc.title));
    data.push(item('Страница', 'referrer', 'Referrer', doc.referrer || '—'));
    data.push(item('Страница', 'characterSet', 'Кодировка', doc.characterSet ?? '—'));
    data.push(item('Страница', 'contentType', 'Content-Type', doc.contentType ?? '—'));
    data.push(item('Страница', 'lastModified', 'Last-Modified', doc.lastModified || '—'));
    data.push(item('Страница', 'readyState', 'readyState', doc.readyState));
    data.push(item('Страница', 'hidden', 'Страница скрыта (hidden)', doc.hidden));
    data.push(item('Страница', 'visibilityState', 'visibilityState', doc.visibilityState ?? '—'));
    data.push(item('Страница', 'compatMode', 'Режим совместимости (compatMode)', doc.compatMode));
    if (doc.documentElement) {
      data.push(item('Страница', 'documentClientWidth', 'Ширина документа (clientWidth)', doc.documentElement.clientWidth));
      data.push(item('Страница', 'documentClientHeight', 'Высота документа (clientHeight)', doc.documentElement.clientHeight));
    }
    try {
      data.push(item('Страница', 'styleSheetsCount', 'Кол-во таблиц стилей', doc.styleSheets?.length ?? 0));
    } catch {
      data.push(item('Страница', 'styleSheetsCount', 'Кол-во таблиц стилей', '—'));
    }
  }
  if (loc) {
    data.push(item('Страница', 'href', 'URL', loc.href));
    data.push(item('Страница', 'host', 'Хост', loc.host));
    data.push(item('Страница', 'hostname', 'Hostname', loc.hostname));
    data.push(item('Страница', 'protocol', 'Протокол', loc.protocol));
  }

  return data;
}

// ——— Асинхронные сборщики ———

/** Storage API: квота и использование (без запроса разрешений). */
export async function fetchStorageEstimate(): Promise<UserDataItem[]> {
  const category = 'Хранилище';
  const nav = navigator as Navigator & { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number; usageDetails?: Record<string, number> }> } };
  if (!nav.storage?.estimate) return [item(category, 'storageEstimate', 'Storage.estimate', 'не поддерживается')];
  try {
    const e = await nav.storage.estimate();
    const out: UserDataItem[] = [];
    if (e.quota != null) out.push(item(category, 'storageQuota', 'Квота хранилища (байт)', e.quota));
    if (e.usage != null) out.push(item(category, 'storageUsage', 'Использовано (байт)', e.usage));
    return out.length ? out : [item(category, 'storageEstimate', 'Storage.estimate', '—')];
  } catch {
    return [item(category, 'storageEstimate', 'Storage.estimate', 'ошибка')];
  }
}

/** Батарея (Battery Status API). */
export async function fetchBattery(): Promise<UserDataItem[]> {
  const category = 'Аппаратные (Батарея)';
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; chargingTime: number; dischargingTime: number }> };
    if (!nav.getBattery) return [item(category, 'battery', 'Battery API', 'не поддерживается')];
    const bat = await nav.getBattery();
    const out: UserDataItem[] = [];
    out.push(item(category, 'level', 'Уровень заряда (%)', Math.round(bat.level * 100)));
    out.push(item(category, 'charging', 'Заряжается', bat.charging));
    out.push(item(category, 'chargingTime', 'Время до полной зарядки (с)', bat.chargingTime === Infinity ? '∞' : bat.chargingTime));
    out.push(item(category, 'dischargingTime', 'Время до разрядки (с)', bat.dischargingTime === Infinity ? '∞' : bat.dischargingTime));
    return out;
  } catch {
    return [item(category, 'battery', 'Battery API', 'недоступен или запрещён')];
  }
}

/** Медиа-устройства (камеры, микрофоны, аудиовыходы). */
export async function fetchMediaDevices(): Promise<UserDataItem[]> {
  const category = 'Медиа-устройства';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const video = devices.filter((d) => d.kind === 'videoinput');
    const audioIn = devices.filter((d) => d.kind === 'audioinput');
    const audioOut = devices.filter((d) => d.kind === 'audiooutput');
    const out: UserDataItem[] = [];
    out.push(item(category, 'cameras', 'Камер', video.length));
    out.push(item(category, 'microphones', 'Микрофонов', audioIn.length));
    out.push(item(category, 'audioOutputs', 'Аудиовыходов', audioOut.length));
    return out;
  } catch {
    return [item(category, 'mediaDevices', 'Медиа-устройства', 'недоступны')];
  }
}

/** UA Client Hints (полная версия движка, архитектура, битность). */
export async function fetchUserAgentHints(): Promise<UserDataItem[]> {
  const category = 'UA Client Hints';
  const ua = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ platform?: string; architecture?: string; bitness?: string; fullVersionList?: { brand: string; version: string }[]; fullVersion?: string }> } }).userAgentData;
  if (!ua?.getHighEntropyValues) return [item(category, 'hints', 'Client Hints', 'не поддерживается')];
  try {
    const v = await ua.getHighEntropyValues(['platform', 'architecture', 'bitness', 'fullVersionList', 'fullVersion']);
    const out: UserDataItem[] = [];
    if (v.platform != null) out.push(item(category, 'platform', 'Платформа', v.platform));
    if (v.architecture != null) out.push(item(category, 'architecture', 'Архитектура (x86/ARM)', v.architecture));
    if (v.bitness != null) out.push(item(category, 'bitness', 'Битность системы', v.bitness));
    if (v.fullVersion != null) out.push(item(category, 'fullVersion', 'Полная версия', v.fullVersion));
    if (v.fullVersionList?.length) out.push(item(category, 'fullVersionList', 'Версии брендов', v.fullVersionList.map((b) => `${b.brand} ${b.version}`).join(', ')));
    return out.length ? out : [item(category, 'hints', 'Client Hints', '—')];
  } catch {
    return [item(category, 'hints', 'Client Hints', 'ошибка или запрещено')];
  }
}

/** Permissions API: статус камера/геолокация/микрофон. */
export async function fetchPermissions(): Promise<UserDataItem[]> {
  const category = 'Разрешения (Permissions API)';
  if (!navigator.permissions?.query) return [item(category, 'permissions', 'Permissions API', 'не поддерживается')];
  const out: UserDataItem[] = [];
  for (const name of ['camera', 'geolocation', 'microphone', 'notifications'] as const) {
    try {
      const s = await navigator.permissions.query({ name });
      out.push(item(category, name, name, s.state));
    } catch {
      out.push(item(category, name, name, '—'));
    }
  }
  return out;
}

/** Раскладка клавиатуры (Keyboard Map API). */
export async function fetchKeyboardLayout(): Promise<UserDataItem[]> {
  const category = 'Ввод (Клавиатура)';
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  if (!kb?.getLayoutMap) return [item(category, 'keyboardMap', 'Раскладка', 'API недоступна')];
  try {
    const map = await kb.getLayoutMap();
    const sample: string[] = [];
    for (const [code, key] of map.entries()) {
      if (sample.length >= 15) break;
      sample.push(`${code}:${key}`);
    }
    const str = sample.length ? sample.join('; ') : '—';
    return [item(category, 'keyboardLayout', 'Раскладка (выборка)', str)];
  } catch {
    return [item(category, 'keyboardLayout', 'Раскладка', 'требуется взаимодействие или недоступно')];
  }
}

/** Детекция AdBlock по запросу к типичному рекламному домену. */
export async function fetchAdBlockDetect(): Promise<UserDataItem[]> {
  const category = 'Окружение';
  try {
    const r = await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', { method: 'HEAD', mode: 'no-cors' }).catch(() => null);
    const blocked = r === null || (r.type === 'opaque' && r.status === 0);
    return [item(category, 'adBlockSuspected', 'AdBlock (подозрение)', blocked ? 'возможно заблокировано' : 'запрос прошёл')];
  } catch {
    return [item(category, 'adBlockSuspected', 'AdBlock', 'не проверено')];
  }
}

/** Частота обновления экрана (getScreenDetails в Chrome). */
export async function fetchScreenDetails(): Promise<UserDataItem[]> {
  const category = 'Экран';
  const w = window as Window & { getScreenDetails?: () => Promise<{ screens: { refreshRate?: number }[] }> };
  if (!w.getScreenDetails) return [item(category, 'refreshRate', 'Частота обновления (Hz)', 'API недоступна (только Chrome)')];
  try {
    const details = await w.getScreenDetails();
    const rate = details.screens?.[0]?.refreshRate;
    return [item(category, 'refreshRate', 'Частота обновления (Hz)', rate ?? '—')];
  } catch {
    return [item(category, 'refreshRate', 'Частота обновления', '—')];
  }
}

/** Получить IP и геоданные + сравнение часового пояса браузера и IP. */
export async function fetchIpAndGeo(): Promise<UserDataItem[]> {
  const category = 'IP и геолокация';
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('API error');
    const j = await res.json() as {
      ip?: string;
      city?: string;
      region?: string;
      country_name?: string;
      country_code?: string;
      postal?: string;
      latitude?: number;
      longitude?: number;
      org?: string;
      timezone?: string;
    };
    const out: UserDataItem[] = [];
    if (j.ip != null) out.push(item(category, 'ip', 'Публичный IP', j.ip));
    if (j.city != null) out.push(item(category, 'city', 'Город', j.city));
    if (j.region != null) out.push(item(category, 'region', 'Регион', j.region));
    if (j.country_name != null) out.push(item(category, 'country', 'Страна', j.country_name));
    if (j.country_code != null) out.push(item(category, 'countryCode', 'Код страны', j.country_code));
    if (j.postal != null) out.push(item(category, 'postal', 'Индекс', j.postal));
    if (j.latitude != null) out.push(item(category, 'latitude', 'Широта', j.latitude));
    if (j.longitude != null) out.push(item(category, 'longitude', 'Долгота', j.longitude));
    if (j.org != null) out.push(item(category, 'org', 'Провайдер (ISP)', j.org));
    if (j.timezone != null) {
      out.push(item(category, 'timezone', 'Часовой пояс (по IP)', j.timezone));
      const tzMatch = browserTz === j.timezone;
      out.push(item('Сеть', 'timezoneVsIp', 'Совпадение часового пояса браузера и IP (прокси?)', tzMatch ? 'совпадает' : 'не совпадает'));
    }
    return out;
  } catch {
    return [item(category, 'ip', 'Публичный IP', 'не удалось получить (сеть или API недоступен)')];
  }
}

/** Локальный IP через WebRTC. */
export async function fetchWebRtcLocalIp(): Promise<UserDataItem[]> {
  const category = 'Сеть (WebRTC)';
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const done = (value: string) => {
        pc.close();
        resolve([item(category, 'localIp', 'Локальный IP (WebRTC)', value)]);
      };
      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));
      pc.onicecandidate = (e) => {
        const c = e.candidate?.candidate;
        if (!c) return;
        const m = c.match(/^candidate:\d+ \d+ (\w+) \d+ (\S+) \d+ typ host .*$/);
        if (m && m[2] && !m[2].endsWith('.local')) {
          done(m[2]);
        }
      };
      setTimeout(() => {
        if (pc.connectionState !== 'closed') {
          pc.close();
          resolve([item(category, 'localIp', 'Локальный IP (WebRTC)', 'не обнаружен или заблокирован')]);
        }
      }, 3000);
    } catch {
      resolve([item(category, 'localIp', 'Локальный IP (WebRTC)', 'недоступен')]);
    }
  });
}
