import path from "path";
import {
  crearCarpetaDownloads,
  iniciarBrowser,
  iniciarSesion,
  cargaManuscritos,
} from "./playwrightUtils";
import { desbloquearTodasLasPaginas } from "./manuscritos";

const downloadsDir = path.resolve(__dirname, "../downloads");

async function main() {
  crearCarpetaDownloads();
  const { browser, page } = await iniciarBrowser();
  await iniciarSesion(page);
  await cargaManuscritos(page);
  await desbloquearTodasLasPaginas(page, downloadsDir);
  console.log("🟢 Script Ejecutado.");

  await browser.close();
}

main();
