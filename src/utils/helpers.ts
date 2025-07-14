import path from "path";
import { Manuscrito } from "../interfaces/Manuscrito";
/**
 * Convierte un siglo en números romanos a un número entero.
 */
export function sigloARoman(siglo: string): number {
  const romanos: { [key: string]: number } = {
    XIV: 14,
    XV: 15,
    XVI: 16,
    XVII: 17,
    XVIII: 18,
  };
  return romanos[siglo.replace("Siglo ", "").trim()] || 0;
}
/**
 * Ordena los manuscritos de menor a mayor siglo.
 */
export function ordenarManuscritosPorSiglo(
  manuscritos: Manuscrito[]
): Manuscrito[] {
  return [...manuscritos].sort(
    (a, b) => sigloARoman(a.siglo) - sigloARoman(b.siglo)
  );
}
/**
 * Devuelve el path completo del PDF destino, reemplazando espacios por guión bajo.
 */
export function obtenerPdfPath(downloadsDir: string, title: string): string {
  return path.join(downloadsDir, `${title.replace(/\s+/g, "_")}.pdf`);
}
