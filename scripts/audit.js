// Accessibility and responsive audit for the signed-in pages.
//
// For each role it signs in through the real login form, then for each page checks
// at 375, 768 and 1280 px that there is no horizontal overflow and that the Sign out button is
// on screen, and at 1280 px runs
// axe-core (WCAG 2.1 A and AA). It also checks that agents are kept out of the evals pages.
//
// Usage (the app must be running with the seeded database):
//   npm run build
//   AUTH_TRUST_HOST=true npm start -- -p 3100        (PowerShell: $env:AUTH_TRUST_HOST="true"; npm start -- -p 3100)
//   npm run audit
//
// Environment:
//   AUDIT_BASE  base URL (default http://localhost:3100)
//   AUDIT_OUT   folder for screenshots (default <tmp>/agentclinic-audit)
//   AUDIT_ONLY  only audit pages under this path prefix, e.g. /dashboard/triage (lighter on memory).
//               On Git Bash, prefix the command with MSYS_NO_PATHCONV=1 or the value is rewritten.
//
// Needs Chrome and the selenium-webdriver, chromedriver and axe-core packages that
// the axe-cli dev dependency brings in. Exits 1 if any check fails.
const fs = require("fs")
const os = require("os")
const path = require("path")
const { Builder, By, until } = require("selenium-webdriver")
const chrome = require("selenium-webdriver/chrome")
const chromedriver = require("chromedriver")

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8")

const BASE = process.env.AUDIT_BASE || "http://localhost:3100"
const OUT = process.env.AUDIT_OUT || path.join(os.tmpdir(), "agentclinic-audit")
const ONLY = process.env.AUDIT_ONLY || ""
const WIDTHS = [375, 768, 1280]
const PASSWORD = "password123" // demo password set by prisma/seed.ts

// Phase 10 pages. ticket-router is a seeded sample specialist owned by staff; a second specialist makes the
// picker appear, and pages are also opened with a specialist chosen, as a link from the picker would.
const SPECIALIST_PAGES = [
  "/dashboard/specialists",
  "/dashboard/specialists/new",
  "/dashboard/specialists/ticket-router",
  "/dashboard/specialists/ticket-router/edit",
  "/dashboard/specialists/ticket-router/import",
  "/dashboard/specialists/intake-triage",
  "/dashboard/onboarding",
  "/dashboard/onboarding?specialist=ticket-router",
  "/dashboard/evals?specialist=ticket-router",
  "/dashboard/metrics?specialist=ticket-router",
  "/dashboard/triage?specialist=ticket-router",
]

const ROLES = {
  agent: {
    email: "agent@clinic.local",
    pages: ["/dashboard/ailments", "/dashboard/ailments/new", "/dashboard/notifications", "/dashboard/profile"],
    detailLists: ["/dashboard/ailments"],
    forbidden: [
      "/dashboard/evals",
      "/dashboard/metrics",
      "/dashboard/triage",
      "/dashboard/specialists",
      "/dashboard/specialists/new",
      "/dashboard/specialists/ticket-router",
      "/dashboard/specialists/ticket-router/edit",
      "/dashboard/specialists/ticket-router/import",
      "/dashboard/onboarding",
    ],
  },
  staff: {
    email: "staff@clinic.local",
    pages: [
      "/dashboard",
      "/dashboard/ailments",
      "/dashboard/appointments",
      "/dashboard/therapies",
      "/dashboard/notifications",
      "/dashboard/evals",
      "/dashboard/metrics",
      "/dashboard/triage",
      ...SPECIALIST_PAGES,
    ],
    detailLists: ["/dashboard/ailments", "/dashboard/evals", "/dashboard/triage"],
    forbidden: [],
  },
  admin: {
    email: "admin@clinic.local",
    pages: [
      "/dashboard",
      "/dashboard/admin/users",
      "/dashboard/notifications",
      "/dashboard/evals",
      "/dashboard/metrics",
      "/dashboard/triage",
      ...SPECIALIST_PAGES,
    ],
    detailLists: ["/dashboard/evals", "/dashboard/triage"],
    forbidden: [],
  },
}

// Where a role that is turned away from a page should end up, and text that only eval pages contain.
const ALLOWED_LANDING = ["/dashboard", "/dashboard/ailments"]
const EVAL_CONTENT = ["Import outputs", "Onboarding steps", "Adoption across all specialists", "Describe your specialist", "Run an eval", "Eval Verdict", "golden scenarios", "Median loop time", "Quality across versions", "Regressions detected", "Fix backlog", "Open failure modes"]

// Links on a list page that point at a detail page: an id segment of 20+ lowercase letters and digits.
const DETAIL_LINK = /\/dashboard\/(ailments|evals|triage)\/[a-z0-9]{20,}$/

async function signIn(driver, email) {
  await driver.get(BASE + "/login")
  await driver.findElement(By.css("input[name=email]")).sendKeys(email)
  await driver.findElement(By.css("input[name=password]")).sendKeys(PASSWORD)
  await driver.findElement(By.css("button[type=submit]")).click()
  await driver.wait(until.urlContains("/dashboard"), 15000)
}

async function collectDetailPages(driver, listPaths) {
  const found = new Set()
  for (const list of listPaths) {
    await driver.get(BASE + list)
    for (const link of await driver.findElements(By.css("a[href^='/dashboard/']"))) {
      const href = (await link.getAttribute("href")).replace(BASE, "")
      if (DETAIL_LINK.test(href)) found.add(href)
    }
  }
  return [...found]
}

async function runAxe(driver) {
  await driver.executeScript(axeSource)
  return driver.executeAsyncScript(
    "const done = arguments[arguments.length-1];" +
      "axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})" +
      ".then(r=>done(r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,3).map(n=>n.target.join(' '))}))))" +
      ".catch(e=>done([{id:'axe-error',impact:'n/a',help:String(e),nodes:[]}]))"
  )
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build())
  const results = []
  const accessFailures = []

  for (const width of WIDTHS) {
    for (const [role, cfg] of Object.entries(ROLES)) {
      // Device-metrics emulation gives an exact viewport; a headless window cannot shrink below ~500px.
      const options = new chrome.Options()
        .addArguments("--headless=new", "--disable-gpu")
        .setMobileEmulation({ deviceMetrics: { width, height: 900, pixelRatio: 1 } })
      const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build()
      try {
        await signIn(driver, cfg.email)
        const viewport = await driver.executeScript("return window.innerWidth")
        if (viewport !== width) throw new Error(`viewport is ${viewport}px, expected ${width}px`)

        const everyPage = [...cfg.pages, ...(await collectDetailPages(driver, cfg.detailLists))]
        // AUDIT_ONLY limits the run to pages under a path prefix, which uses far less memory
        // than a full run (for example AUDIT_ONLY=/dashboard/triage after a change to those pages).
        const pages = ONLY ? everyPage.filter((p) => p.startsWith(ONLY)) : everyPage
        for (const page of pages) {
          await driver.get(BASE + page)
          await driver.sleep(400)
          const overflow = await driver.executeScript(
            "return document.documentElement.scrollWidth - document.documentElement.clientWidth"
          )
          // The layout hides horizontal overflow instead of scrolling, so also check that the
          // header's Sign out button is really on screen (it was once clipped off at 375px).
          const navClipped = await driver.executeScript(
            "const b=[...document.querySelectorAll('header button')].find(x=>x.textContent.trim()==='Sign out');" +
              "if(!b) return 0; const r=b.getBoundingClientRect(); return Math.max(0, Math.round(r.right - window.innerWidth))"
          )
          const violations = width === 1280 ? await runAxe(driver) : []
          const shot = await driver.takeScreenshot()
          const name = `${role}_${page.replace(/[^a-z0-9]+/gi, "_")}_${width}.png`
          fs.writeFileSync(path.join(OUT, name), shot, "base64")
          results.push({ role, page: page.replace(/[a-z0-9]{20,}/, ":id"), width, overflow, navClipped, violations })
        }

        if (width === 1280) {
          // A blocked role must land on a normal page of the app (not /login or an error page)
          // and must not be shown any eval content on the way.
          for (const page of cfg.forbidden) {
            await driver.get(BASE + page)
            await driver.sleep(800)
            const landed = new URL(await driver.getCurrentUrl()).pathname
            const text = await driver.executeScript("return document.body.innerText")
            if (!ALLOWED_LANDING.includes(landed)) {
              accessFailures.push(`${role} opening ${page} ended up on ${landed}, expected one of ${ALLOWED_LANDING.join(", ")}`)
            }
            if (EVAL_CONTENT.some((marker) => text.includes(marker))) {
              accessFailures.push(`${role} was shown eval content when opening ${page}`)
            }
          }
        }
      } finally {
        await driver.quit()
      }
    }
  }

  // An audit that checked nothing must not look like a pass (a mistyped AUDIT_ONLY, or the
  // sign-in landing somewhere unexpected, would otherwise end with "0 failing").
  if (results.length === 0) {
    console.error(
      `No pages were checked${ONLY ? ` (AUDIT_ONLY was ${JSON.stringify(ONLY)}; on Git Bash set MSYS_NO_PATHCONV=1 so "/dashboard/..." is not rewritten into a Windows path)` : ""}. This is a failure, not a pass.`
    )
    process.exit(1)
  }

  let failing = 0
  for (const r of results) {
    const bad = r.overflow > 0 || r.navClipped > 0 || r.violations.length > 0
    if (bad) failing++
    console.log(
      `${bad ? "FAIL" : "ok  "} ${r.role.padEnd(5)} ${r.page.padEnd(34)} ${String(r.width).padStart(4)}px` +
        ` overflow=${r.overflow} nav=${r.navClipped} axe=${r.width === 1280 ? r.violations.length : "-"}`
    )
  }
  for (const r of results) {
    if (r.overflow > 0) console.log(`\nOVERFLOW ${r.role} ${r.page} @${r.width}: +${r.overflow}px`)
    if (r.navClipped > 0) console.log(`\nNAV CLIPPED ${r.role} ${r.page} @${r.width}: Sign out is ${r.navClipped}px off screen`)
    for (const v of r.violations) {
      console.log(`\nAXE ${r.role} ${r.page}: [${v.impact}] ${v.id} - ${v.help}\n   ${v.nodes.join("\n   ")}`)
    }
  }
  for (const f of accessFailures) console.log(`\nACCESS ${f}`)

  failing += accessFailures.length
  console.log(`\n${results.length} page checks, ${failing} failing. Screenshots: ${OUT}`)
  process.exit(failing > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
