# VendedorPRO · Ferretería Oviedo  ·  v2.0

Convierte el reporte transaccional de ventas por vendedor en un **feedback de coaching por vendedor**: KPIs reales separados por canal (Factura/PRO vs Boleta/mostrador), oportunidades de venta por proyecto que se escaparon, y consejos concretos generados con IA para subir el ticket promedio.

## Novedades v2.0

- **KPI de proyecto**, el número que se mide y se paga: *de cada 10 ventas, cuántas llevaron 3 subfamilias distintas o más*. Se cuenta **por documento y no por monto**, para que no rinda pegarle un producto barato de otro rubro a una venta grande y "convertirla" en proyecto.
- **Dos vistas con un switch en la barra superior.** *Vista vendedor* no muestra margen en pesos en ninguna parte — ni en las tarjetas, ni en la ficha, ni en el coaching de IA. *Vista gerencia* agrega margen $, scorecard, comparativa y el diagnóstico de mix vs. precio.
- **Ventas huérfanas:** subfamilias donde el producto salió solo en el documento, con los complementos que faltó ofrecer. Es la munición concreta para la conversación de coaching.
- **Devoluciones por vendedor** (antes sólo existían a nivel global) y su efecto en el margen neto.
- **Scorecard de compensación simulado:** venta 25% · margen % 40% · proyecto 25% · devoluciones 10%.
- **Mix vs. precio:** separa cuánto de la brecha de margen viene de qué rubros elige empujar y cuánto de a qué precio cierra. **No sirve para poner metas distintas** — todos venden del mismo piso, con el mismo catálogo y sin cartera asignada; sirve para saber qué conversación tener.

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
| `subProyecto` | Subfamilias distintas mínimas para que un documento cuente como proyecto | `3` |
| `hiperIntegral` | Hiperfamilias mínimas para clasificar como "Proyecto integral" | `2` |
| `metas.proyecto` | Meta de % de ventas proyecto | `0.25` |
| `metas.margenPct` | Meta de margen %, **única para todo el equipo** | `0.21` |
| `metas.devolucion` | Tope de devoluciones sobre venta | `0.02` |
| `metas.ventaFactor` | Meta de venta = venta del período × esto (**placeholder**, reemplazar por presupuesto) | `1.05` |
| `pesos` | Pesos del scorecard (deben sumar 1) | `.25/.40/.25/.10` |
| `vistaInicial` | `"vendedor"` u `"gerencia"` | `"vendedor"` |

> Subir `subProyecto` de 3 a 4 hace el KPI bastante más exigente. Con 3, alrededor del 19% de los documentos califica; con 4 baja a ~8%.

Las sugerencias de complemento de las **ventas huérfanas** están en el objeto `COMPLEMENTOS` (por subfamilia). Si no encuentra la subfamilia, cae al árbol `PROYECTOS`.

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
- **Antes de usar el scorecard para pagar:** correrlo 3 meses en paralelo al esquema actual, mostrando el resultado al vendedor sin efecto en su renta, y reemplazar `metas.ventaFactor` por el presupuesto real. Con un solo período no se puede saber si el ranking es estable o un artefacto del mes.
- La meta de margen % es **única para todo el equipo** a propósito. No hay cartera ni categorías asignadas: el mix que arma cada vendedor es resultado de su gestión, no la cancha que le tocó.
