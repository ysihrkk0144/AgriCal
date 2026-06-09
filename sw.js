// =====================================================
// Service Worker — 愛知 農作業カレンダー
// キャッシュ戦略: Cache First（オフライン対応）
// バージョンを上げると古いキャッシュを自動削除
// =====================================================
const CACHE_VERSION = 'agri-calendar-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap',
];

// インストール: 必須アセットを先読みキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート: 古いバージョンのキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ: Cache First → ネットワーク → オフラインフォールバック
self.addEventListener('fetch', event => {
  // POSTなどキャッシュ対象外は素通り
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // キャッシュヒット: バックグラウンドで最新版を取得・更新
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // キャッシュなし: ネットワーク取得
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // 完全オフライン時はindex.htmlを返す
        return caches.match('./index.html');
      });
    })
  );
});
