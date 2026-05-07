self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const IMAGES = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#f0f4f8"/>
  <circle cx="100" cy="65" r="30" fill="#cbd5e1"/>
  <circle cx="100" cy="65" r="18" fill="#f0f4f8"/>
  <rect x="60" y="105" width="80" height="8" rx="4" fill="#cbd5e1"/>
  <rect x="77" y="119" width="46" height="5" rx="2.5" fill="#e2e8f0"/>
</svg>`,

  dark: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#1e293b"/>
  <circle cx="100" cy="65" r="30" fill="#334155"/>
  <circle cx="100" cy="65" r="18" fill="#1e293b"/>
  <rect x="60" y="105" width="80" height="8" rx="4" fill="#334155"/>
  <rect x="77" y="119" width="46" height="5" rx="2.5" fill="#253347"/>
</svg>`,

  colorful: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#fdf4ff"/>
  <circle cx="100" cy="65" r="30" fill="#e879f9"/>
  <circle cx="100" cy="65" r="18" fill="#fdf4ff"/>
  <rect x="60" y="105" width="80" height="8" rx="4" fill="#c026d3"/>
  <rect x="77" y="119" width="46" height="5" rx="2.5" fill="#e879f9"/>
</svg>`,
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith("image_demo_asset")) {
    return;
  }
  const delay = parseInt(url.searchParams.get("delay") || "0", 10);
  const theme = url.searchParams.get("theme") || "light";
  const svg = IMAGES[theme] || IMAGES.light;

  event.respondWith(
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          new Response(svg, {
            headers: { "Content-Type": "image/svg+xml" },
          }),
        );
      }, delay);
    }),
  );
});
