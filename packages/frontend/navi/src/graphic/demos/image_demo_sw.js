self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith("image_demo_asset")) {
    return;
  }
  const delay = parseInt(url.searchParams.get("delay") || "0", 10);
  const hue = parseInt(url.searchParams.get("hue") || "210", 10);

  event.respondWith(
    new Promise((resolve) => {
      setTimeout(() => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(${hue}, 40%, 60%)" stroke-width="1" opacity="0.4"/>
    </pattern>
  </defs>
  <rect width="800" height="480" fill="hsl(${hue}, 55%, 75%)"/>
  <rect width="800" height="480" fill="url(#grid)"/>
  <rect x="200" y="120" width="400" height="240" rx="12" fill="hsl(${hue}, 45%, 65%)" opacity="0.6"/>
  <text x="400" y="230" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="52" fill="hsl(${hue}, 30%, 30%)">🖼</text>
  <text x="400" y="295" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="18" fill="hsl(${hue}, 30%, 30%)">image loaded</text>
</svg>`;
        resolve(
          new Response(svg, {
            headers: { "Content-Type": "image/svg+xml" },
          }),
        );
      }, delay);
    }),
  );
});
