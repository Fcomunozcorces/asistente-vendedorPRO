# Instalar VendedorPRO — paso a paso

Tiempo estimado: 20 minutos. No hay que compilar nada ni instalar programas.

Vas a necesitar tener a mano el archivo **`USUARIOS_variable_netlify.txt`**, que viene
aparte de este paquete y contiene los accesos de las 7 personas. **Ese archivo no se
sube a ninguna parte** — sólo se copia y pega dentro del panel de Netlify.

---

## Paso 1 · Subir los archivos a GitHub

1. Entra a GitHub y crea un repositorio nuevo. Puede ser privado.
2. Descomprime este paquete y sube su contenido con **Add file → Upload files**.
3. **Ojo con dos archivos.** El subidor web de GitHub se salta en silencio los que
   empiezan con punto, por eso vienen renombrados. Créalos a mano con
   **Add file → Create new file** y copia el contenido:

   | Archivo del paquete | Nombre real que hay que crear |
   |---|---|
   | `_gitignore` | `.gitignore` |
   | `_env.example` | `.env.example` |

   Después borra del repo los dos archivos con guion bajo.

> `.env.example` es sólo una plantilla de referencia. Las claves de verdad nunca
> van en el repositorio: van en el panel de Netlify, en el paso 3.

---

## Paso 2 · Crear el sitio en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repo.
2. Deja la configuración así:
   - **Build command:** vacío
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`

   Ya viene todo en `netlify.toml`, así que normalmente lo detecta solo.
3. **Deploy site.** El primer despliegue va a fallar al entrar, porque todavía
   faltan las variables. Es lo esperado.

---

## Paso 3 · Configurar las cuatro variables

**Site configuration → Environment variables → Add a variable** (una por una).

| Variable | Qué poner | ¿Obligatoria? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Tu clave de la API de Anthropic | Sí, para el coaching con IA |
| `SESSION_SECRET` | El string largo que viene en `USUARIOS_variable_netlify.txt` | Sí, sin esto nadie entra |
| `USUARIOS` | El bloque JSON de una línea del mismo archivo | Sí, sin esto nadie entra |
| `COACH_MODEL` | `claude-sonnet-4-6` | No, es el valor por defecto |

**No marques la casilla "Contains secret values".** En el plan gratuito ese flag
entra en conflicto con la configuración de scope y la función deja de leer la variable.

> La API de Anthropic se factura aparte de la suscripción de Claude.ai. Revisa que
> tengas créditos o el coaching va a devolver error.

---

## Paso 4 · Volver a desplegar y probar

1. **Deploys → Trigger deploy → Deploy site.**
2. Abre la URL del sitio. Debe aparecer la pantalla de acceso.
3. Entra con `fmunoz`. Arriba a la derecha tienen que verse tu nombre, el sello
   **ADMIN** y el botón **Bitácora**.
4. Arrastra el Excel del reporte de ventas. En segundos aparecen las tarjetas.
5. Prueba las tres cosas:
   - **Ver ficha** en cualquier vendedor → hero de proyecto, los objetivos y las ventas huérfanas.
   - **Vista gerencia** arriba a la derecha → comparativa, venta no capturada, reporte por hiper familia, mix vs precio y scorecard.
   - **Bitácora** → tiene que aparecer al menos tu propio ingreso.
6. Prueba **Generar consejos con IA** en un vendedor. Si devuelve error, revisa
   `ANTHROPIC_API_KEY` y que la cuenta tenga créditos.

---

## Paso 5 · Antes de repartir los accesos

1. **Llena el campo `tienda`** de cada usuario dentro de la variable `USUARIOS`.
   Aparece junto al nombre en la barra y en la bitácora, que es justamente para
   lo que sirve. Cambia `"tienda":""` por `"tienda":"Isabel Riquelme"` en cada uno.
2. **Cambia la clave de `fmunoz`.** Hoy es igual al nombre de usuario y es la
   única cuenta que ve la bitácora. Para generar el hash nuevo, en cualquier
   terminal con Node:

   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('la-clave-nueva').digest('hex'))"
   ```

   y reemplaza el `claveHash` de `fmunoz` por lo que salga.
3. Después de cualquier cambio en las variables hay que **volver a desplegar**
   para que la función lo tome.

---

## Cuando llegue el reporte del mes siguiente

No hay que hacer nada: se entra al sitio y se arrastra el Excel nuevo. La app no
guarda las ventas en ninguna parte, todo el análisis corre en el navegador. Lo
único que queda guardado en el servidor es la bitácora de ingresos.

---

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| "Falta configurar la variable USUARIOS en Netlify" | La variable no existe, o se marcó como secret |
| "La variable USUARIOS de Netlify no tiene un JSON válido" | Se pegó cortado, o el editor cambió las comillas por comillas tipográficas |
| "Falta configurar la variable SESSION_SECRET" | Falta esa variable |
| "No hay conexión con el servidor de acceso" | Se abrió el `index.html` desde el disco en vez de la URL de Netlify |
| Entra pero la bitácora sale vacía | Netlify Blobs no está disponible en el sitio; la app funciona igual, sin registro |
| "No encontré la fila de encabezados" al subir el Excel | Es otro reporte. Tiene que traer las columnas Vendedor, Nº Doc, Producto, Valor Neto y Margen |
| El coaching con IA falla | `ANTHROPIC_API_KEY` mal puesta o sin créditos en la cuenta |

Los ajustes de umbrales, objetivos y pesos del scorecard están todos en el objeto
`CONFIG`, arriba del `<script>` en `index.html`. Están documentados en el `README.md`.
