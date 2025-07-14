import fs from "fs";
import { Page } from "playwright";
import clipboardy from "clipboardy";
import { Manuscrito } from "../interfaces/Manuscrito";
import { cerrarModal, resolverDesafioApi } from "./apiUtils";
import { obtenerPdfPath, ordenarManuscritosPorSiglo } from "../utils/helpers";
import {
  repararYReemplazarPDF,
  extraerCodigoPDF,
  descargarPDF,
} from "./pdfUtils";

/**
 * Obtiene los manuscritos listados en la página actual y retorna su información clave.
 * Elimina duplicados basándose en el título.
 */
async function obtenerManuscritos(page: Page): Promise<Manuscrito[]> {
  return await page.$$eval("div.p-4", (nodes) =>
    nodes
      .map((node) => {
        const titulo = node.querySelector("h3")?.textContent?.trim() || "";
        const siglo =
          node.querySelector("span.text-sm")?.textContent?.trim() || "";
        const botones = Array.from(node.querySelectorAll("button"));
        const botonDescargarPDFBool = botones.some((b) =>
          b.textContent?.includes("Descargar PDF")
        );
        const botonVerDocBoll = botones.some((b) =>
          b.textContent?.includes("Ver Documentación")
        );
        const inputCodigo = node.querySelector(
          'input[placeholder="Ingresá el código"]'
        );
        const inputBool = !!inputCodigo;
        return {
          titulo,
          siglo,
          botonDescargarPDFBool,
          inputBool,
          botonVerDocBoll,
        };
      })
      .filter(
        (item: Manuscrito, idx: number, arr: Manuscrito[]) =>
          arr.findIndex((i) => i.titulo === item.titulo) === idx
      )
  );
}
/**
 * Cambia a la página solicitada y espera que el contenido esté listo.
 */
async function cambiarDePagina(page: Page, numPagina: number) {
  const btn = await page.$(`button:has-text("${numPagina}")`);
  if (btn) {
    await btn.click();
    await page.waitForSelector(".animate-spin", { state: "detached" });
    await page.waitForSelector("div.p-4 h3");
    console.log(`➡️ Página ${numPagina}`);
  }
}
/**
 * Descarga el PDF, lo repara y extrae el código de acceso.
 * Si ocurre un error, lo maneja y retorna null.
 */
async function procesarDescargaYCodigo(
  page: Page,
  pdfPath: string,
  titulo: string
): Promise<string | null> {
  try {
    await descargarPDF(page, pdfPath, titulo);
    await repararYReemplazarPDF(pdfPath);
    const codigo = await extraerCodigoPDF(pdfPath);
    console.log(`🛡️ Manuscrito ${titulo}`);
    console.log(`🔑 Código: ${codigo}`);
    return codigo;
  } catch (e) {
    console.error(`🔴 [ERROR] falló la Descarga/Extración de ${titulo}:`, e);
    return null;
  }
}
/**
 * Usa el código extraído para desbloquear el siguiente manuscrito.
 */
async function desbloquearSiguienteManuscrito(
  page: Page,
  manuscrito: Manuscrito,
  codigo: string
) {
  if (!manuscrito || !manuscrito.inputBool) return;
  console.log(`🔓 Desbloqueando: ${manuscrito.titulo}`);
  const cards = await page.$$("div.p-4");
  for (const card of cards) {
    const h3 = await card.$("h3");
    const text = h3 ? (await h3.textContent())?.trim() : "";
    const input = await card.$('input[placeholder="Ingresá el código"]');
    if (text === manuscrito.titulo && input) {
      await input.fill(codigo);
      const submit = await card.$('button[type="submit"]:not([disabled])');
      await submit?.click();
      await page.waitForSelector(".animate-spin", { state: "detached" });
      await page.waitForSelector("div.p-4 h3");
      break;
    }
  }
}
/**
 * Busca el botón "Ver Documentación" de un manuscrito por título y lo cliquea.
 */
async function clickearBotonVerDocumentacion(page: Page, titulo: string) {
  const cards = await page.$$("div.p-4");
  for (const card of cards) {
    const h3 = await card.$("h3");
    const text = h3 ? (await h3.textContent())?.trim() : "";
    if (text === titulo) {
      const btn = await card.$('button:has-text("Ver Documentación")');
      if (btn) {
        await btn.click();
        return true;
      }
    }
  }
  return false;
}
/**
 * Desbloquea manuscritos que requieren resolver un desafío de API (con modal).
 * Completa el proceso automático: abre modal, obtiene password, rellena input, desbloquea y copia el nuevo código.
 */
async function procesarModalYDesbloquear(
  page: Page,
  manuscrito: Manuscrito,
  pdfPath: string,
  codigoAnterior: string
) {
  // Procesar el modal API
  await clickearBotonVerDocumentacion(page, manuscrito.titulo);
  const password = await resolverDesafioApi(
    page,
    manuscrito.titulo,
    codigoAnterior
  );

  await cerrarModal(page);

  // Ahora, rellená el input y desbloqueá
  await page.waitForSelector('input[placeholder="Ingresá el código"]');
  const input = await page.$('input[placeholder="Ingresá el código"]');
  await input?.fill(password);

  const boton = await page.$('button[type="submit"]:not([disabled])');
  await boton?.click();

  await page.waitForSelector('button:has-text("Cerrar")', { timeout: 5000 });
  const btnCopiar = await page.$('button:has-text("Copiar")');
  if (btnCopiar) await btnCopiar.click();

  // Leer el clipboard
  await page.waitForTimeout(500);
  let codigo = await clipboardy.read();
  const match = codigo.match(/contraseña:\s*([A-Z0-9]+)/i);
  if (!match || !match[1]) return password;

  await cerrarModal(page);
  await page.waitForSelector('button:has-text("Descargar PDF")');

  return await procesarDescargaYCodigo(page, pdfPath, manuscrito.titulo);
}
/**
 * Desbloquea y descarga todos los manuscritos de la página actual.
 * Mantiene control de los títulos descargados y del último código obtenido.
 */
export async function desbloquearTodos(
  page: Page,
  downloadsDir: string,
  descargados: Set<string> = new Set(),
  codigoInicial: string | null = null
): Promise<string | null> {
  let codigoActual: string | null = codigoInicial;

  while (true) {
    let manuscritos = await obtenerManuscritos(page);
    manuscritos = ordenarManuscritosPorSiglo(manuscritos);

    let pendientes = manuscritos.filter((m) => {
      const pdfPath = obtenerPdfPath(downloadsDir, m.titulo);
      return !fs.existsSync(pdfPath);
    });
    pendientes = ordenarManuscritosPorSiglo(pendientes);
    if (pendientes.length === 0) break;

    let procesadoAlMenosUno = false;

    for (const actual of pendientes) {
      const pdfPath = obtenerPdfPath(downloadsDir, actual.titulo);

      if (actual.botonDescargarPDFBool && !descargados.has(actual.titulo)) {
        await page.waitForSelector('button:has-text("Descargar PDF")');
        codigoActual = await procesarDescargaYCodigo(
          page,
          pdfPath,
          actual.titulo
        );
        descargados.add(actual.titulo);
        procesadoAlMenosUno = true;
        continue;
      }
      if (actual.inputBool && codigoActual && !descargados.has(actual.titulo)) {
        await desbloquearSiguienteManuscrito(page, actual, codigoActual);
        await page.waitForSelector('button:has-text("Descargar PDF")');
        codigoActual = await procesarDescargaYCodigo(
          page,
          pdfPath,
          actual.titulo
        );
        descargados.add(actual.titulo);
        procesadoAlMenosUno = true;
        continue;
      }
      if (
        actual.botonVerDocBoll &&
        codigoActual &&
        !descargados.has(actual.titulo)
      ) {
        codigoActual = await procesarModalYDesbloquear(
          page,
          actual,
          pdfPath,
          codigoActual
        );
        descargados.add(actual.titulo);
        procesadoAlMenosUno = true;
        continue;
      }

      // Intentá igual la descarga, como backup
      if (!descargados.has(actual.titulo)) {
        try {
          await page.waitForSelector('button:has-text("Descargar PDF")', {
            timeout: 2000,
          });
          await descargarPDF(page, pdfPath, actual.titulo);
          await repararYReemplazarPDF(pdfPath);
          await extraerCodigoPDF(pdfPath);
          descargados.add(actual.titulo);
          procesadoAlMenosUno = true;
        } catch (e) {
          descargados.add(actual.titulo);
        }
      }
    }
    if (!procesadoAlMenosUno) break;
  }
  return codigoActual;
}
/**
 * Itera por todas las páginas de manuscritos, cambiando de página y desbloqueando todo.
 */
export async function desbloquearTodasLasPaginas(
  page: Page,
  downloadsDir: string
) {
  const paginas = await obtenerNumeroDePaginas(page);
  let ultimoCodigo: string | null = null;
  for (const pag of paginas) {
    if (pag > 1) await cambiarDePagina(page, pag);
    ultimoCodigo = await desbloquearTodos(
      page,
      downloadsDir,
      new Set<string>(),
      ultimoCodigo
    );
  }
}
/**
 * Obtiene la lista de números de páginas disponibles en la paginación.
 */
async function obtenerNumeroDePaginas(page: Page): Promise<number[]> {
  return await page.$$eval("button,div", (nodes) =>
    nodes
      .map((n) => n.textContent?.trim())
      .filter((t) => /^\d+$/.test(t))
      .map(Number)
  );
}
