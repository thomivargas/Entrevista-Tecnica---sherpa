import path from "path";
import {
  crearCarpetaDownloads,
  iniciarBrowser,
  iniciarSesion,
  cargaManuscritos,
} from "./playwrightUtils";
import { desbloquearTodasLasPaginas } from "./manuscritos";

const downloadsDir = path.resolve(__dirname, "../downloads");

/**
 * Función principal del script:
 * - Crea la carpeta de descargas si no existe.
 * - Inicia el navegador y abre una nueva página.
 * - Realiza el login en la web objetivo.
 * - Espera a que se cargue la lista de manuscritos.
 * - Desbloquea y descarga todos los manuscritos disponibles.
 * - Maneja errores y asegura el cierre del navegador.
 */
async function main() {
  crearCarpetaDownloads();
  const { browser, page } = await iniciarBrowser();

  try {
    await iniciarSesion(page);
    await cargaManuscritos(page);
    await desbloquearTodasLasPaginas(page, downloadsDir);
    console.log("🟢 Script Ejecutado.");
  } catch (err) {
    console.error("🔴 Error durante la ejecución del Script:", err);
  } finally {
    await browser.close();
  }
}

main();
