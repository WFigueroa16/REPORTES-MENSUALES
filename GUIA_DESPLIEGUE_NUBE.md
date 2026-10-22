# Guía de Despliegue en la Nube (24/7) - Beneficio ZA

Tu proyecto ya tiene el repositorio Git inicializado y el commit listo con todos los datos históricos de Setiembre y la base de datos incluida.

Sigue estos 3 sencillos pasos para publicarlo en la nube:

---

### Paso 1: Crear el repositorio en GitHub (1 minuto)

1. Ingresa a [https://github.com/new](https://github.com/new) en tu navegador.
2. En **Repository name**, ponle un nombre (ejemplo: `beneficio-za-web`).
3. Elige **Private** (Privado) si deseas que solo tú y tu equipo tengan acceso al código.
4. **NO** marques "Add a README file" ni ninguna otra casilla (ya tenemos los archivos listos).
5. Haz clic en el botón verde **Create repository**.

---

### Paso 2: Subir tu código a GitHub

GitHub te mostrará una pantalla con comandos. Solo necesitas ejecutar estos comandos en tu terminal (en la carpeta `E:\SHP PROJECT BASE DE DATOS`):

```powershell
git branch -M main
git remote add origin https://github.com/TU_USUARIO/beneficio-za-web.git
git push -u origin main
```
*(Reemplaza `TU_USUARIO` por tu usuario de GitHub).*

---

### Paso 3: Publicar gratis en Render.com (2 minutos)

1. Entra a [https://dashboard.render.com](https://dashboard.render.com) e inicia sesión con tu cuenta de GitHub (gratuito).
2. Haz clic en el botón azul **New +** en la esquina superior derecha y selecciona **Web Service**.
3. Elige la opción **Build and deploy from a Git repository** y haz clic en **Next**.
4. En la lista, busca tu repositorio `beneficio-za-web` y haz clic en **Connect**.
5. Render leerá automáticamente el archivo `render.yaml` que ya configuramos. Verifica que diga:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
6. Haz clic abajo en **Deploy Web Service**.

---

### 🎉 ¡Listo!
En un par de minutos, Render te proporcionará tu enlace público oficial:
👉 `https://beneficio-za-web.onrender.com`

- Tus usuarios podrán ingresar desde cualquier computadora, laptop, tablet o celular en cualquier momento del día.
- Toda la base de datos de Setiembre ya está integrada.
- Podrán registrar datos en tiempo real y descargar el Excel actualizado con el botón verde.
