# ⚡ Telemetría Automatizada de Molinos (19 Molinos HMI Siemens) - Planta Beneficio ZA

Sistema para la captura, procesamiento multimodal con Inteligencia Artificial, almacenamiento y visualización en tiempo real de telemetría de 19 molinos (Barras 1 a 9, Bolas 1 a 9 y Bolas 10) a partir de fotografías tomadas a pantallas Siemens HMI y enviadas por WhatsApp o cargadas manualmente vía Web.

---

## 📌 Arquitectura y Funcionalidades

1. **Dashboard en Tiempo Real (`/` o `/telemetria.html`):**
   - Visualización por tarjetas individuales de los 19 molinos.
   - Estado de alarmas, fallas y semáforo de preaviso preventivo (margen de seguridad del 5%).
   - Monitoreo de 170 sensores (vibraciones VR1-VR6, presiones RAP/CAP/ROP, temperaturas devanados y descansos).
   - Generador automático de reportes de turno de guardia (07:00, 15:00, 23:00) formateados para WhatsApp.
   - Envío automático de resumen por correo Gmail a `supervisores.planta@ejemplo.com`.

2. **Carga Inteligente por Lote (Batch Drag & Drop):**
   - Modal interactivo para arrastrar y procesar una o múltiples fotografías a la vez.
   - Identificación autónoma del molino y fecha/hora del display HMI.
   - Detección y bloqueo automático de capturas duplicadas.

3. **Dos Opciones de Despliegue en Ramas Dedicadas:**
   - **`feature/code-node-microservice`**: Microservicio completo en Node.js + Express + SQLite + Visión IA + Nodemailer + Webhook Green API WhatsApp.
   - **`feature/nocode-make-sheets`**: Blueprint de Make.com + Plantilla Excel/Google Sheets + Apps Script + Green API + Gmail.

---

## 🚀 Puesta en Marcha Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor
npm start
```
Acceder en el navegador a: `http://localhost:3000`

---

## 🧪 Pruebas Automatizadas

```bash
node tests/test_hmi_extraction.js
```
Ejecuta la suite de 24 pruebas de integración (carga de catálogo, fotos HMI reales, preavisos 5%, deduplicación y despacho de correos).

---

## ☁️ Despliegue en la Nube (Vercel)

El proyecto está preparado para serverless en Vercel con Node.js 22.x:
1. Conectar el repositorio de GitHub: `WFigueroa16/telemetria-molinos-hmi`.
2. Framework Preset: `Other`.
3. Node.js Version: `22.x`.
4. Deploy.
