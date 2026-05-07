const IMAGES = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0f4f8"/>
  <circle cx="200" cy="130" r="60" fill="#cbd5e1"/>
  <circle cx="200" cy="130" r="36" fill="#f0f4f8"/>
  <rect x="120" y="210" width="160" height="16" rx="8" fill="#cbd5e1"/>
  <rect x="155" y="238" width="90" height="10" rx="5" fill="#e2e8f0"/>
</svg>`,

  dark: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1e293b"/>
  <circle cx="200" cy="130" r="60" fill="#334155"/>
  <circle cx="200" cy="130" r="36" fill="#1e293b"/>
  <rect x="120" y="210" width="160" height="16" rx="8" fill="#334155"/>
  <rect x="155" y="238" width="90" height="10" rx="5" fill="#253347"/>
</svg>`,

  colorful: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#fdf4ff"/>
  <circle cx="200" cy="130" r="60" fill="#e879f9"/>
  <circle cx="200" cy="130" r="36" fill="#fdf4ff"/>
  <rect x="120" y="210" width="160" height="16" rx="8" fill="#c026d3"/>
  <rect x="155" y="238" width="90" height="10" rx="5" fill="#e879f9"/>
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
