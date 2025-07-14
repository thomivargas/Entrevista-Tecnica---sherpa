import axios from "axios";
import { Page } from "playwright";
import clipboardy from "clipboardy";

// Cierra el modal (ajustá el selector según tu caso)
export async function cerrarModal(page: Page) {
  let btnCerrar = await page.$('button:text("Cerrar")');
  if (!btnCerrar)
    btnCerrar = await page.$('//button[contains(text(), "Cerrar")]');
  if (!btnCerrar) btnCerrar = await page.$('button[aria-label="Cerrar modal"]');

  if (btnCerrar) {
    await btnCerrar.scrollIntoViewIfNeeded();
    // Primer intento: evaluate
    await btnCerrar.evaluate((btn) => (btn as HTMLElement).click());
    await page.waitForTimeout(500);
    // Segundo intento: click force
    if (await page.$('div[role="dialog"]')) {
      await btnCerrar.click({ force: true });
      await page.waitForTimeout(500);
    }
    // Tercer intento: Escape
    if (await page.$('div[role="dialog"]')) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } else {
    const overlay = await page.$("div.bg-black.bg-opacity-80");
    if (overlay) {
      await overlay.click({ force: true });
      await page.waitForTimeout(500);
    } else {
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
    }
  }
}

function obtenerCodigo(vault: string[], targets: number[]): string {
  return targets.map((idx) => vault[idx]).join("");
}

export async function resolverDesafioApi(
  page: Page,
  bookTitle: string,
  unlockCode: string
): Promise<string> {
  try {
    // Botón "Copiar"
    const btnCopiar = await page.$('button:has-text("Copiar")');
    if (!btnCopiar) throw new Error("No se encontró el botón Copiar");
    await btnCopiar.click();

    // Leer el clipboard
    await page.waitForTimeout(500);
    let endpoint = await clipboardy.read();
    if (!endpoint) throw new Error("No se copió ninguna URL del modal");

    // Agregar los parámetros
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${separator}bookTitle=${encodeURIComponent(
      bookTitle
    )}&unlockCode=${encodeURIComponent(unlockCode)}`;
    console.log("🌐 Haciendo GET a:", url);

    // Hacer request con Axios
    let codigo: string | null = null;
    try {
      const res = await axios.get(url);
      const data = res.data;

      codigo = obtenerCodigo(data?.challenge?.vault, data?.challenge?.targets);
    } catch (error: any) {
      // Si es un 400, devolvé el unlockCode anterior
      if (error.response && error.response.status === 400) {
        console.warn(
          "⚠️ La API devolvió 400, devolviendo unlockCode anterior:",
          unlockCode
        );
        codigo = unlockCode;
      } else {
        throw error; // Otros errores los tirás normalmente
      }
    }

    return codigo;
  } catch (error) {
    console.error("Error en llamar a la api:", error);
  }
}
