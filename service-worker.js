/**
 * ACP Pedidos — Service Worker
 * Responsável por:
 *   1. Cache dos arquivos essenciais do PWA (shell)
 *   2. Estratégia Stale-While-Revalidate para assets
 * 
 * NÃO implementa lógica de áudio.
 * Áudio é gerenciado exclusivamente pelo atendente.js na página principal.
 */

const CACHE_NAME = 'acp-atendente-v1';

// Arquivos essenciais que formam o "shell" do app
const SHELL_ASSETS = [
    '/atendente.html',
    '/atendente.js',
    '/atendente.css',
    '/index.css',
    '/logo_automovel.png',
    '/manifest.json'
];

// ─── Install: pré-cacheia o shell do app ───────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando e cacheando shell do app...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_ASSETS);
        }).then(() => {
            // Ativa imediatamente sem esperar tabs antigas fecharem
            return self.skipWaiting();
        })
    );
});

// ─── Activate: limpa caches antigos ───────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando e limpando caches antigos...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Removendo cache antigo:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Toma controle imediato de todas as abas abertas
            return self.clients.claim();
        })
    );
});

// ─── Fetch: Stale-While-Revalidate para assets locais ─────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ignora requisições externas (Supabase, CDN, etc.)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Ignora requisições não-GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Busca atualização em background mesmo servindo do cache
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Sem rede e sem cache: falha silenciosa
                return cachedResponse;
            });

            // Retorna cache imediato se disponível, senão aguarda rede
            return cachedResponse || fetchPromise;
        })
    );
});
