/**
 * Service worker do Pesca App.
 *
 * Gerado para public/sw.js por scripts/stamp-sw.mjs (substitui __SW_VERSION__).
 *
 * Estratégias:
 * - /_next/static/*         → cache-first (arquivos com hash, imutáveis)
 * - navegações (HTML)       → stale-while-revalidate com fallback /offline;
 *                             a busca ignora a query string, então
 *                             /pescaria?id=qualquer usa a mesma casca cacheada
 * - payloads RSC (?_rsc=)   → só rede; se falhar o Next faz navegação completa
 *                             e caímos na regra acima
 * - tiles OSM               → cache-first com limite
 * - Open-Meteo / Nominatim  → network-first com fallback ao último resultado
 * - sync / periodicsync     → avisa a página (fila) e checa lembretes no IndexedDB
 */
const SW_VERSION = "__SW_VERSION__";
const PREFIX = "pesca";
const SHELL_CACHE = `${PREFIX}-shell-${SW_VERSION}`;
const STATIC_CACHE = `${PREFIX}-static`;
const TILE_CACHE = `${PREFIX}-tiles`;
const API_CACHE = `${PREFIX}-api`;

const SHELL_ROUTES = ["/", "/perfis", "/planejar", "/spots", "/pescaria", "/captura", "/historico", "/album", "/estatisticas", "/comparar", "/configuracoes", "/offline"];
const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-96.png",
  // Sem o avatar em cache, a tela de perfis abriria vazia offline.
  "/avatars/pescador.png",
];
const TILE_LIMIT = 500;
const API_LIMIT = 80;

const SYNC_TAG = "sync-queue";
const REMINDER_TAG = "check-reminders";
const DB_NAME = "pesca-app";

/* ------------------------------------------------------------------ */
/* Instalação: pré-cache das telas e dos chunks que elas referenciam    */
/* ------------------------------------------------------------------ */

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  const stat = await caches.open(STATIC_CACHE);

  await Promise.all(SHELL_ASSETS.map((u) => shell.add(u).catch(() => {})));

  await Promise.all(
    SHELL_ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: "same-origin", cache: "no-cache" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await shell.put(route, res);
        const assets = new Set();
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\<>)]+/g)) assets.add(m[0]);
        await Promise.all(
          [...assets].map(async (u) => {
            if (await stat.match(u)) return;
            try {
              const r = await fetch(u);
              if (r.ok) await stat.put(u, r);
            } catch {}
          }),
        );
      } catch {}
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(`${PREFIX}-shell-`) && k !== SHELL_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ */
/* Fetch                                                                */
/* ------------------------------------------------------------------ */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (url.origin === self.location.origin) {
    if (url.pathname === "/sw.js") return;
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (url.pathname.startsWith("/_next/")) return; // image optimizer, dev, etc.
    const isRSC = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
    if (isRSC) return;
    if (request.mode === "navigate" || request.destination === "document") {
      event.respondWith(navigation(request));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(request, TILE_CACHE, TILE_LIMIT));
    return;
  }
  if (url.hostname.endsWith("open-meteo.com") || url.hostname === "nominatim.openstreetmap.org") {
    event.respondWith(networkFirst(request, API_CACHE, API_LIMIT));
  }
});

async function navigation(request) {
  const url = new URL(request.url);
  const shell = await caches.open(SHELL_CACHE);
  const cached = (await shell.match(url.pathname)) || (await shell.match(request, { ignoreSearch: true }));

  const network = fetch(request)
    .then(async (res) => {
      if (res.ok && res.type === "basic") await shell.put(url.pathname, res.clone());
      return res;
    });

  if (cached) {
    network.catch(() => {});
    return cached;
  }
  try {
    return await network;
  } catch {
    return (
      (await shell.match("/offline")) ||
      new Response("Sem conexão.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    await cache.put(request, res.clone());
    if (limit) trim(cache, limit);
  }
  return res;
}

async function networkFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) {
      await cache.put(request, res.clone());
      if (limit) trim(cache, limit);
    }
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) await cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    network.catch(() => {});
    return hit;
  }
  const res = await network;
  return res || new Response("", { status: 504 });
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (const key of keys.slice(0, keys.length - limit)) await cache.delete(key);
}

/* ------------------------------------------------------------------ */
/* Mensagens, notificações e sync                                      */
/* ------------------------------------------------------------------ */

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Pesca", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(broadcast({ type: "SYNC_REQUEST" }));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === REMINDER_TAG) event.waitUntil(checkRemindersFromIdb());
});

async function broadcast(message) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of all) client.postMessage(message);
}

/* Lê as pescarias direto do IndexedDB (mesmo banco do Dexie) para lembrar
   mesmo com o app fechado, onde o navegador suporta periodic sync. */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function checkRemindersFromIdb() {
  let db;
  try {
    db = await openDb();
  } catch {
    return;
  }
  if (!db.objectStoreNames.contains("trips")) return;

  // Só lembra as pescarias do perfil que está aberto no aparelho.
  let profileId = null;
  if (db.objectStoreNames.contains("settings")) {
    try {
      const row = await idbRequest(db.transaction("settings", "readonly").objectStore("settings").get("currentProfileId"));
      profileId = row ? row.value : null;
    } catch {
      profileId = null;
    }
  }

  const now = Date.now();
  const tx = db.transaction("trips", "readwrite");
  const store = tx.objectStore("trips");
  const trips = await idbRequest(store.getAll());
  for (const trip of trips) {
    if (profileId && trip.profileId && trip.profileId !== profileId) continue;
    if (trip.status !== "planejada" || trip.reminderMinutesBefore == null || trip.reminderFiredAt) continue;
    const planned = new Date(trip.plannedAt).getTime();
    const due = planned - trip.reminderMinutesBefore * 60000;
    if (now < due || now > planned + 2 * 3600000) continue;
    const when = new Date(trip.plannedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    await self.registration.showNotification("Pescaria chegando! 🎣", {
      body: `${trip.title || trip.locationName || "Sua pescaria"} — ${when}`,
      tag: `trip-${trip.id}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: `/pescaria?id=${trip.id}` },
    });
    trip.reminderFiredAt = new Date().toISOString();
    store.put(trip);
  }
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
    tx.onerror = resolve;
    tx.onabort = resolve;
  });
  db.close();
}
