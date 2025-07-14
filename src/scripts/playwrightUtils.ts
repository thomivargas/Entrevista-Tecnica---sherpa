import fs from "fs";
import path from "path";
import { chromium, Page, Browser } from "playwright";

// Carpeta de descargas
export const downloadsDir = path.resolve(__dirname, "../downloads");

// Crea la carpeta de descargas si no existe.
export function crearCarpetaDownloads() {
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
}

/**
 * Inicia una instancia de Chromium (no headless) y retorna el navegador y una nueva página.
 * @returns { browser, page }
 */
export async function iniciarBrowser(): Promise<{
  browser: Browser;
  page: Page;
}> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, page };
}

/**
 * Realiza el login en la página usando credenciales predefinidas.
 * @param page Página de Playwright sobre la cual interactuar.
 */
export async function iniciarSesion(page: Page) {
  await page.goto(
    "https://pruebatecnica-sherpa-production.up.railway.app/login"
  );
  await page.fill('input[id="email"]', "monje@sherpa.local");
  await page.fill('input[id="password"]', "cript@123");
  await page.click('button[type="submit"]');
}

/**
 * Espera a que se cargue completamente la lista de manuscritos en la web.
 * Espera a que desaparezca el spinner y estén visibles los títulos.
 * @param page Página de Playwright sobre la cual interactuar.
 */
export async function cargaManuscritos(page: Page) {
  await page.waitForSelector(".animate-spin", { state: "detached" });
  await page.waitForSelector("div.p-4 h3");
}
