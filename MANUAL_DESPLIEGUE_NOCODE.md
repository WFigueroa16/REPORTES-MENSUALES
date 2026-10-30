# Manual de Despliegue: Solución No-Code (Make + Green API + Google Sheets)

Este documento detalla los pasos exactos para poner en marcha el sistema automatizado de monitoreo de molinos utilizando **Make.com**, la pasarela **Green API** para WhatsApp y **Google Sheets**.

---

## 1. Archivos Incluidos en este Entorno

1. **`make_blueprint_molinos.json`**: Escenario completo listo para importar en Make.
2. **`plantilla_google_sheets_molinos.xlsx`**: Libro con las hojas `Molinos`, `Lecturas`, `Revision` y `Dashboard_Turno`.
3. **`codigo_google_apps_script.js`**: Script para cálculo de demoras y reportes por turno.

---

## 2. Paso a Paso de Configuración

### Fase A: Preparar Google Sheets
1. Ve a [Google Drive](https://drive.google.com) y sube el archivo `plantilla_google_sheets_molinos.xlsx`.
2. Haz clic derecho y selecciona **Abrir con > Hojas de cálculo de Google**.
3. Copia el **ID de la hoja de cálculo** desde la barra de direcciones de tu navegador:
   `https://docs.google.com/spreadsheets/d/`**`[ID_DE_TU_HOJA]`**`/edit`
4. *(Opcional)* Ve a **Extensiones > Apps Script**, pega el código de `codigo_google_apps_script.js` y guarda el proyecto. Configura un disparador (*trigger*) por tiempo para que ejecute `verificarMolinosSilenciosos` cada 1 hora.

---

### Fase B: Configurar Green API (WhatsApp Gateway)
1. Regístrate en [Green API](https://green-api.com/).
2. Crea una instancia y escanea el código QR usando una **línea secundaria prepago**.
3. Agrega este número secundario al grupo de WhatsApp de los operadores de molienda.
4. En el panel de Green API, anota:
   * **`idInstance`** (ej. `110182xxxx`)
   * **`apiTokenInstance`** (ej. `d6179...`)
5. En la sección **Ajustes de Webhook**:
   * Marca únicamente `incomingMessageReceived`.
   * En la URL de webhook pegarás la URL que te dará Make en la siguiente fase.

---

### Fase C: Importar el Escenario en Make.com
1. Inicia sesión en [Make.com](https://make.com) y crea un nuevo escenario (*Create a new scenario*).
2. En la barra inferior, haz clic en el botón de tres puntos **`...`** y selecciona **Import Blueprint**.
3. Selecciona el archivo `make_blueprint_molinos.json` de esta carpeta.
4. Configura los módulos:
   * **Módulo 1 (Custom Webhook):** Haz clic en *Add* y copia la URL generada. Pégala en el panel de Green API en la configuración del Webhook.
   * **Módulo 3 (Claude 3.5 Sonnet Vision):** En los Headers, reemplaza `{{var.anthropic_api_key}}` por tu clave de API de Anthropic (`sk-ant-...`) o usa tu clave de Gemini si prefieres el endpoint de Google.
   * **Módulos 7a y 6b (Google Sheets):** Selecciona tu cuenta de Google y enlaza la hoja de cálculo usando el ID que copiaste en la Fase A.
5. Haz clic en **Save** y luego enciende el switch de activación del escenario (**ON**).

---

## 3. Pruebas y Validación

1. En el grupo de WhatsApp, envía una de las fotos de ejemplo (por ejemplo la del **Molino 032-208**).
2. Observa el historial de ejecuciones de Make:
   * El webhook recibirá el mensaje con la URL de la foto.
   * Claude analizará la imagen y extraerá los 22 sensores con comas convertidas a decimales (`69.3`, `112.0`).
   * La hoja `Lecturas` se poblará automáticamente con una fila por sensor.
   * La temperatura `STE` (`69.3 °C`) se marcará como `PREAVISO` antes de romper la alarma (`70.0 °C`).

---

## 4. Envío Automático de Reportes a través de Gmail

Tienes dos opciones para despachar los reportes por correo mediante Gmail:

### Opción 1: Reporte por Guardia con Google Apps Script (Recomendado y Gratis)
1. En tu Google Sheets, abre **Extensiones > Apps Script**.
2. En `codigo_google_apps_script.js`, actualiza la línea `EMAIL_SUPERVISORES` con los correos destinatarios.
3. Haz clic en el ícono de reloj (**Activadores / Triggers**) a la izquierda y pulsa **Añadir activador**:
   * Función: `enviarReporteTurnoPorGmail`.
   * Fuente del evento: **Según tiempo**.
   * Tipo: **Temporizador por horas** o programar 3 activadores específicos a las **07:00, 15:00 y 23:00**.
4. ¡Listo! Al terminar cada guardia, Google Sheets despachará un correo HTML con el cuadro semafórico de los 19 molinos sin costo alguno.

### Opción 2: Módulo Gmail en Make.com
* En el Blueprint importado verás el módulo **8b (Gmail: Send an Email)**.
* Conéctalo a tu cuenta de Gmail con un clic (OAuth de Google).
* Cada vez que se detecte un sensor en falla crítica, se disparará una alerta inmediata a los correos configurados.
