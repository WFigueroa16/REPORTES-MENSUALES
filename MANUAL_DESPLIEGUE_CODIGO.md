# Manual de Despliegue: Microservicio Node.js de Telemetría (Código Propio)

Este entorno contiene la solución basada en backend nativo en **Node.js + SQLite + Vision AI**, diseñada para integrarse directamente al servidor web existente en `server.js` sin costos recurrentes por operaciones de Make.

---

## 1. Arquitectura y Componentes Desarrollados

* **`services/telemetryDbService.js`**: Capa de persistencia en SQLite (`beneficio_za.sqlite`) con modo WAL de alta concurrencia. Almacena catálogo de 19 molinos, capturas HMI, lecturas de sensores y bandeja de revisión.
* **`services/millCatalogService.js`**: Parser que sincroniza automáticamente los **170 sensores** y límites desde la hoja `Calc` de `parametros molinos.xlsx`.
* **`services/businessRulesEngine.js`**: Motor de reglas que ejecuta:
  * Sentido de control (`MAX` para temperaturas/vibraciones; `MIN` para presiones).
  * Margen de preaviso dinámico (5% antes de alarma).
  * Corrección automática de omisión de coma decimal (`522` $\rightarrow$ `52.2`).
  * Deduplicación por hash SHA-256 y timestamp de pantalla.
* **`services/visionExtractorService.js`**: Extractor multimodal (Claude 3.5 Sonnet / Gemini 1.5 Flash) con soporte para Structured Outputs.
* **`services/reportService.js`**: Consolidador de turno (Guardias de 07:00, 15:00 y 23:00) y formateador para WhatsApp.
* **`controllers/telemetryController.js`**: Endpoints REST para ingesta de Webhooks y consultas.
* **`public/telemetria.html`**: Panel web de control en tiempo real con semáforos, tarjetas y visor de sensores.
* **`tests/test_hmi_extraction.js`**: Suite de pruebas con las 3 fotografías reales del usuario (100% aprobada).

---

## 2. Endpoints Disponibles en el Servidor

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| **`POST`** | `/api/telemetria/webhook/greenapi` | Webhook receptor de WhatsApp (Green API). |
| **`POST`** | `/api/telemetria/subir-foto` | Procesamiento manual de fotos (Base64 o URL). |
| **`GET`** | `/api/telemetria/dashboard` | Retorna el estado en vivo de los 19 molinos en JSON. |
| **`GET`** | `/api/telemetria/reporte-turno` | Retorna el reporte de guardia formateado para WhatsApp. |
| **`GET`** | `/telemetria.html` | Dashboard visual en tiempo real en el navegador. |

---

## 3. Puesta en Marcha

1. **Configurar variables de entorno (Opcional si usas API en vivo):**
   ```bash
   # En tu archivo .env o terminal:
   set ANTHROPIC_API_KEY=sk-ant-api03-...
   # O si prefieres Google Gemini:
   set GEMINI_API_KEY=AIzaSy...
   ```

2. **Iniciar el servidor:**
   ```bash
   npm start
   # o bien:
   node server.js
   ```

3. **Abrir el Dashboard:**
   Navega a: `http://localhost:3000/telemetria.html`

4. **Conectar Green API al Webhook:**
   En el panel de Green API, configura la URL del webhook:
   `https://tu-dominio-o-ngrok/api/telemetria/webhook/greenapi`
   *(Solo activa la casilla `incomingMessageReceived`).*

5. **Ejecutar Pruebas Automatizadas:**
   ```bash
   node tests/test_hmi_extraction.js
   ```
