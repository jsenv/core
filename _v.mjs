import { chromium } from "playwright";
const URL = "http://localhost:3456/packages/frontend/navi/src/control/demos/32_wheel_demo.html";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 2800 }, deviceScaleFactor: 3 });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const h = page.locator("h3", { hasText: "1 separator, 2 columns" });
await h.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
// screenshot the ZZ group tightly
const box = await page.evaluate(() => {
  const heads=[...document.querySelectorAll("h3")];
  const hh=heads.find(e=>e.textContent.includes("1 separator, 2 columns"));
  let row=hh.nextElementSibling; while(row&&!row.classList.contains("row"))row=row.nextElementSibling;
  const zz=[...row.querySelectorAll(".navi_wheel_group")].find(g=>g.textContent.includes("ZZ"));
  const r=zz.getBoundingClientRect();
  return { x:r.left-4, y:r.top+r.height/2-16, w:r.width+8, h:34 };
});
await page.screenshot({ path: "_zz.png", clip: box });
console.log("saved");
await browser.close();
