# Entrevista Técnica

Este proyecto es una **automatización con Node.js y Playwright** que simula el proceso de desbloqueo y descarga de manuscritos de una web protegida por desafíos tipo *captcha* y lógicas encadenadas.  
Está pensado como prueba técnica para la posición de desarrollador/a con foco en scraping y automatización.

---

## Funcionalidad

- Automatiza el login en la plataforma de pruebas.
- Navega por la lista paginada de manuscritos.
- Descarga los PDFs de cada manuscrito disponible.
- Extrae códigos de desbloqueo ocultos en los PDFs.
- Usa esos códigos para desbloquear el siguiente manuscrito de la cadena.
- Resuelve desafíos de API donde hace falta (vía requests automáticos y lógica de resolución).
- Repara los PDFs descargados para evitar errores de lectura.
- Organiza todas las descargas en la carpeta `/downloads`.

---

## ¿Cómo funciona?

1. **Inicia el navegador** usando Playwright.
2. **Realiza login automático** con las credenciales provistas.
3. **Espera que la web cargue** todos los manuscritos y su paginación.
4. Para cada manuscrito:
    - Si el PDF está disponible, lo descarga y extrae el código de acceso.
    - Si está bloqueado, usa el código anterior para desbloquearlo automáticamente.
    - Si el desbloqueo requiere resolver un desafío (API/Modal), lo resuelve haciendo una request y completando el flujo de desbloqueo.
5. **Avanza de página** y repite el proceso hasta descargar todos los manuscritos disponibles.

---

## Tecnologías y librerías

- [Node.js](https://nodejs.org/)
- [Playwright](https://playwright.dev/)
- [pdf-parse](https://www.npmjs.com/package/pdf-parse)
- [axios](https://axios-http.com/)
- [clipboardy](https://www.npmjs.com/package/clipboardy)
- [Ghostscript](https://ghostscript.com/) (para reparar PDFs)

---

## Cómo correr el proyecto

1. **Clonar el repo:**
   ```bash
   git clone https://github.com/thomivargas/Entrevista-Tecnica.git
   cd Entrevista-Tecnica
   npm run shared
  
