import fs from "fs";
import path from "path";
import { chromium, Page, Browser } from "playwright";

// Carpeta de descargas
export const downloadsDir = path.resolve(__dirname, "../downloads");

// Crea carpeta si no existe
export function crearCarpetaDownloads() {
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
}

// Inicia browser y retorna { browser, page }
export async function iniciarBrowser(): Promise<{
  browser: Browser;
  page: Page;
}> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, page };
}

// Inicia Sesion
export async function iniciarSesion(page: Page) {
  await page.goto(
    "https://pruebatecnica-sherpa-production.up.railway.app/login"
  );
  await page.fill('input[id="email"]', "monje@sherpa.local");
  await page.fill('input[id="password"]', "cript@123");
  await page.click('button[type="submit"]');
}

// Espera a que la lista de manuscritos esté visible y cargada (sin spinner)
export async function cargaManuscritos(page: Page) {
  await page.waitForSelector(".animate-spin", { state: "detached" });
  await page.waitForSelector("div.p-4 h3");
}
