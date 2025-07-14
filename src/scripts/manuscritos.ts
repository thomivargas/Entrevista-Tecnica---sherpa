import fs from "fs";
import path from "path";
import { Page } from "playwright";
import { descargarPDF } from "./pdfUtils";
import { cerrarModal, resolverDesafioApi } from "./apiUtils";
import { repararYReemplazarPDF, extraerCodigoPDF } from "./pdfUtils";
import clipboardy from "clipboardy";

interface Manuscrito {
  titulo: string;
  siglo: string;
  botonBool: boolean;
  inputBool: boolean;
  verDocBoll: boolean;
}

const descargadosGlobal = new Set<string>();

function sigloARoman(siglo: string): number {
  const romanos: { [key: string]: number } = {
    XIV: 14,
    XV: 15,
    XVI: 16,
    XVII: 17,
    XVIII: 18,
  };
  return romanos[siglo.replace("Siglo ", "").trim()] || 0;
}

function ordenarManuscritosPorSiglo(manuscritos: Manuscrito[]): Manuscrito[] {
  return [...manuscritos].sort(
    (a, b) => sigloARoman(a.siglo) - sigloARoman(b.siglo)
  );
}

async function obtenerManuscritos(page: Page): Promise<Manuscrito[]> {
  return await page.$$eval("div.p-4", (nodes) => {
    const lista = nodes.map((node) => {
      const titulo = node.querySelector("h3")?.textContent?.trim() || "";
      const siglo =
        node.querySelector("span.text-sm")?.textContent?.trim() || "";
      const botones = Array.from(node.querySelectorAll("button"));
      const botonDescarga = botones.some((b) =>
        b.textContent?.includes("Descargar PDF")
      );
      const verDocBoll = botones.some((b) =>
        b.textContent?.includes("Ver Documentación")
      );
      const inputCodigo = node.querySelector(
        'input[placeholder="Ingresá el código"]'
      );
      const inputBool = !!inputCodigo;
      return { titulo, siglo, botonBool: botonDescarga, inputBool, verDocBoll };
    });
    const unicos = new Map();
    lista.forEach((obj) => {
      if (obj.titulo) unicos.set(obj.titulo, obj);
    });
    return Array.from(unicos.values());
  });
}

async function irAPagina(page: Page, numPagina: number) {
  const botonPagina = await page.$(`button:has-text("${numPagina}")`);
  if (botonPagina) {
    await botonPagina.click();
    await page.waitForSelector(".animate-spin", { state: "detached" });
    await page.waitForSelector("div.p-4 h3");
    console.log(`➡️ Navegaste a página ${numPagina}`);
  }
}

async function procesarDescargaYCodigo(
  page: Page,
  pdfPath: string,
  titulo: string
) {
  await descargarPDF(page, pdfPath, titulo);
  await repararYReemplazarPDF(pdfPath);
  const codigo = await extraerCodigoPDF(pdfPath);
  console.log(`🛡️ Manuscrito ${titulo}`);
  console.log(`🔑 Código: ${codigo}`);
  return codigo;
}

async function desbloquearSiguienteManuscrito(
  page: Page,
  siguiente: Manuscrito,
  codigo: string
) {
  if (!siguiente || !siguiente.inputBool) return;
  console.log(`🔓 Desbloqueando: ${siguiente.titulo}`);
  const elementos = await page.$$("div.p-4");
  for (const el of elementos) {
    const h3 = await el.$("h3");
    const text = h3 ? (await h3.textContent())?.trim() : "";
    const input = await el.$('input[placeholder="Ingresá el código"]');
    if (text === siguiente.titulo && input) {
      await input.fill(codigo);
      const boton = await el.$('button[type="submit"]:not([disabled])');
      await boton?.click();
      await page.waitForSelector(".animate-spin", { state: "detached" });
      await page.waitForSelector("div.p-4 h3");
      break;
    }
  }
}

async function clickearBotonVerDocumentacion(page: Page, titulo: string) {
  const elementos = await page.$$("div.p-4");
  for (const el of elementos) {
    const h3 = await el.$("h3");
    const text = h3 ? (await h3.textContent())?.trim() : "";
    if (text === titulo) {
      const boton = await el.$('button:has-text("Ver Documentación")');
      if (boton) {
        await boton.click();
        return true;
      }
    }
  }
}

async function procesarModalYDesbloquear(
  page: Page,
  actual: Manuscrito,
  pdfPath: string,
  codigoAnterior: string
) {
  // Procesar el modal API
  await clickearBotonVerDocumentacion(page, actual.titulo);
  const password = await resolverDesafioApi(
    page,
    actual.titulo,
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
  await cerrarModal(page);

  // Esperá a que el botón de descarga esté disponible
  await page.waitForSelector('button:has-text("Descargar PDF")');
  // Ahora descargá el PDF normalmente
  await descargarPDF(page, pdfPath, actual.titulo);
  await repararYReemplazarPDF(pdfPath);
  console.log(`🛡️ Manuscrito ${actual.titulo}`);
  console.log(`🔑 Código: ${codigo}`);
  return codigo;
}

export async function desbloquearTodos(
  page: Page,
  downloadsDir: string,
  descargados = descargadosGlobal,
  codigoInicial: string | null = null
): Promise<string | null> {
  let codigoActual: string | null = codigoInicial;

  while (true) {
    let manuscritos = await obtenerManuscritos(page);
    manuscritos = ordenarManuscritosPorSiglo(manuscritos);

    // Filtrá pendientes
    let pendientes = manuscritos.filter((m) => {
      const pdfPath = path.join(
        downloadsDir,
        `${m.titulo.replace(/\s+/g, "_")}.pdf`
      );
      return !fs.existsSync(pdfPath);
    });
    pendientes = ordenarManuscritosPorSiglo(pendientes);

    if (pendientes.length === 0) break;

    let procesadoAlMenosUno = false;
    for (const actual of pendientes) {
      const pdfPath = path.join(
        downloadsDir,
        `${actual.titulo.replace(/\s+/g, "_")}.pdf`
      );

      if (actual.botonBool && !descargados.has(actual.titulo)) {
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
        actual.verDocBoll &&
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

    // Si no procesaste ninguno, salí del loop
    if (!procesadoAlMenosUno) break;
  }
  return codigoActual;
}

// Y en desbloquearTodasLasPaginas:
export async function desbloquearTodasLasPaginas(
  page: Page,
  downloadsDir: string
) {
  const paginas = await obtenerPaginas(page);
  let ultimoCodigo: string | null = null;
  for (const pag of paginas) {
    if (pag > 1) await irAPagina(page, pag);
    ultimoCodigo = await desbloquearTodos(
      page,
      downloadsDir,
      new Set<string>(),
      ultimoCodigo
    );
  }
}

async function obtenerPaginas(page: Page): Promise<number[]> {
  return await page.$$eval("button,div", (nodes) =>
    nodes
      .map((n) => n.textContent?.trim())
      .filter((t) => /^\d+$/.test(t))
      .map(Number)
  );
}
