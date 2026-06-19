const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("http://localhost:3000/markup/cmqlkt539000m28ezs05y64yn");
  await page.waitForSelector("img[alt^='Page']");
  await page.waitForTimeout(500);
  console.log(await page.evaluate(() => document.body.innerText.slice(0, 400)));

  // Now actually test panning on this (already locked) page
  const outer = await page.evaluateHandle(() => document.querySelector("img[alt^='Page']").parentElement.parentElement);
  const obox = await outer.asElement().boundingBox();
  const getPan = () => page.evaluate(() => document.querySelector("div[style*='translate']")?.getAttribute("style"));
  const before = await getPan();
  await page.mouse.move(obox.x + obox.width * 0.5, obox.y + obox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(obox.x + obox.width * 0.5 + 100, obox.y + obox.height * 0.5 + 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await getPan();
  console.log("pan before:", before);
  console.log("pan after: ", after);
  console.log("PAN WORKS WHILE LOCKED:", before !== after);
  await browser.close();
})();
