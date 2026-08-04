"use strict";

const CACHE_NAME = "bcdevis-pwa-v5.3.6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./body-anatomy.js",
  "./catalog.js",
  "./quote-core.js",
  "./manifest.webmanifest",
  "./assets/clinique-bellecour-logo-officiel.jpeg",
  "./assets/clinique-bellecour-logo-officiel.png",
  "./assets/icon-save.svg",
  "./assets/pwa-icon-192.png",
  "./assets/pwa-icon-512.png",
  "./assets/red-hat-display-regular.ttf",
  "./assets/red-hat-display-medium.ttf",
  "./assets/red-hat-display-semibold.ttf",
  "./assets/red-hat-display-bold.ttf",
  "./assets/red-hat-display-extrabold.ttf",
  "./assets/red-hat-display-black.ttf",
  "./assets/red-hat-display-italic-variable.ttf",
  "./assets/roboto-latin.woff2",
  "./assets/roboto-slab-latin.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refreshed = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      if (cached) {
        refreshed.catch(() => {});
        return cached;
      }
      return refreshed;
    })
  );
});
