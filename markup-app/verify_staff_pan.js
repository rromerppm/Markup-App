const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ permissions: ["clipboard-read", "clipboard-write"] }).catch(() => chromium.launch());
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("http://localhost:3000/staff/cmqlkt539000l28ezrplr8bj9");
  await page.waitForSelector("img[alt^='Page']");
  await page.waitForTimeout(500);

  const outer = await page.evaluateHandle(() => document.querySelector("img[alt^='Page']").parentElement.parentElement);
  const obox = await outer.asElement().boundingBox();
  const getPan = () => page.evaluate(() => document.querySelector("div[style*='translate']")?.getAttribute("style"));
  const before = await getPan();
  await page.mouse.move(obox.x + obox.width * 0.5, obox.y + obox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(obox.x + obox.width * 0.5 + 90, obox.y + obox.height * 0.5 + 50, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await getPan();
  console.log("STAFF PAGE pan before:", before);
  console.log("STAFF PAGE pan after: ", after);
  console.log("PAN WORKS ON STAFF PAGE:", before !== after);

  // test copy link button
  const copyBtn = page.locator("button:has-text('Copy link')");
  await copyBtn.click();
  await page.waitForTimeout(300);
  const btnText = await copyBtn.textContent();
  console.log("copy button text after click:", btnText);
  try {
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    console.log("clipboard contents:", clip);
  } catch (e) { console.log("clipboard read failed (expected in some sandboxes):", e.message); }

  await page.screenshot({ path: "verify_staff_view.png" });
  await browser.close();
})();
