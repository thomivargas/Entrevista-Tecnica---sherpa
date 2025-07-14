import fs from "fs";
import pdf from "pdf-parse";
import { Page } from "playwright";
import { exec } from "child_process";

export async function extraerCodigoPDF(ruta: string): Promise<string | null> {
  const dataBuffer = fs.readFileSync(ruta);

  try {
    const data = await pdf(dataBuffer);
    const codigo = data.text.match(/acceso:\s*([A-Z0-9\-]+)/i);
    return codigo ? codigo[1] : null;
  } catch (err) {
    console.error("🔴 Error al parsear PDF:", err);
  }
}

export async function descargarPDF(
  page: Page,
  pdfPath: string,
  titulo: string
) {
  if (!fs.existsSync(pdfPath)) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("Descargar PDF")'),
    ]);
    await download.saveAs(pdfPath);
    console.log(`⬇️ PDF guardado en: ${pdfPath}`);
  } else {
    console.log(`📄 Ya existe PDF en: ${pdfPath}`);
  }
}

async function repararPDF(
  inputPath: string,
  outputPath?: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Si no se especifica outputPath, usa inputPath (sobre-escribe)
    const finalOutput = outputPath || inputPath;
    const cmd = `gswin64c -o "${finalOutput}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress "${inputPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error("🔴 Error reparando PDF:", stderr);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export async function repararYReemplazarPDF(pdfPath: string): Promise<boolean> {
  const pdfTmp = pdfPath + ".tmp";
  const reparado = await repararPDF(pdfPath, pdfTmp);
  if (reparado && fs.existsSync(pdfTmp) && fs.statSync(pdfTmp).size > 1000) {
    fs.renameSync(pdfTmp, pdfPath);
    console.log("🛠️ PDF reparado y reemplazado correctamente");
    return true;
  } else {
    if (fs.existsSync(pdfTmp)) fs.unlinkSync(pdfTmp);
    console.error("🔴 No se reparo el PDF, se mantiene el original.");
    return false;
  }
}
