# VendedorPRO · Ferretería Oviedo

Convierte el reporte transaccional de ventas por vendedor en un **feedback de coaching por vendedor**: KPIs reales separados por canal (Factura/PRO vs Boleta/mostrador), oportunidades de venta por proyecto que se escaparon, y consejos concretos generados con IA para subir el ticket promedio.

Misma arquitectura que el Cotizador: SPA estática (vanilla HTML/JS) + Netlify Function que proxea la API de Claude. La clave de Anthropic vive **solo en el servidor**.

---

## Cómo funciona

1. El usuario sube el Excel del reporte de ventas por vendedor.
2. Todo el análisis duro corre **en el navegador** (sin enviar datos a ningún lado):
   - Limpia subtotales y filas vacías, separa el SKU del nombre del producto.
   - Clasifica cada documento en **Factura / Boleta / Nota de crédito** por la serie de folio (corroborado por el signo del monto).
   - **Netea las devoluciones** (notas de crédito) del total.
   - Calcula por vendedor y por canal: venta, margen $/%, ticket promedio, líneas por boleta (UPT), % de venta vía factura, % de boletas de una sola línea.
   - Detecta **boletas con un material que dispara un proyecto** pero al que le faltaron los acompañantes (cross-sell), usando el árbol de familias de Oviedo.
3. Al pedir "Generar coaching con IA", se envían **solo los KPIs agregados de ese vendedor** (más 4 boletas de ejemplo) a la función `coach`, que llama a Claude y devuelve el reporte de coaching estructurado. Una llamada por vendedor.

---

## Despliegue en Netlify

### Opción A — arrastrar la carpeta
1. Entra a Netlify → **Add new site → Deploy manually**.
2. Arrastra esta carpeta completa.
3. Ve a **Site settings → Environment variables** y agrega:
   - `ANTHROPIC_API_KEY` = tu clave de la API de Anthropic.
   - (opcional) `COACH_MODEL` = `claude-sonnet-4-6` para cambiar el modelo.
4. Redeploy. Listo.

### Opción B — desde GitHub (recomendado, igual que el Cotizador)
1. Sube esta carpeta a un repo.
2. En Netlify: **Add new site → Import from Git** → elige el repo.
3. Build command: *(vacío)* · Publish directory: `.` · Functions directory: `netlify/functions` (ya viene en `netlify.toml`).
4. Agrega la variable `ANTHROPIC_API_KEY` como en la Opción A.
5. Deploy.

> La **API de Anthropic se factura aparte** de la suscripción de Claude.ai. Revisa que tengas créditos.

---

## Ajustes rápidos (todo en `index.html`, objeto `CONFIG`)

| Parámetro | Qué hace | Default |
|---|---|---|
| `folioNcMax` | Folios bajo este número = nota de crédito | `100000` |
| `folioBoletaMin` | Folios sobre este número = boleta; entremedio = factura | `1000000` |
| `minBoletas` | Mínimo de boletas para que un vendedor entre al coaching | `5` |

**Si más adelante el export del ERP/BIWiser incluye una columna "Tipo Documento"**, el parser la detecta y la usa directo, sin depender de las series de folio.

Las reglas de **venta por proyecto** (qué material dispara qué proyecto y qué acompañantes esperar) están en el arreglo `PROYECTOS` del mismo archivo — fáciles de ampliar o afinar.

---

## Estructura

```
index.html                  SPA completa (parser + análisis + UI + PDF)
netlify/functions/coach.js  Proxy a la API de Claude (coaching)
netlify.toml                Config de Netlify
package.json                Metadatos (Node >= 18)
.env.example                Plantilla de variables
```

## Notas

- El reporte de cada vendedor se imprime/exporta a PDF con el botón **Imprimir / PDF** (usa el diálogo de impresión del navegador, sin dependencias).
- Las "oportunidades por revisar" son candidatas de alta sensibilidad; el coaching con IA las revisa producto por producto antes de aconsejar, para no inventar ventas que no aplican.
- Este export corresponde a una sucursal (caja Santiago). Cuando el reporte traiga varias, el comparativo por local se puede agregar como siguiente iteración.
