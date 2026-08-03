# VendedorPRO · Ferretería Oviedo  ·  v2.0

Convierte el reporte transaccional de ventas por vendedor en un **feedback de coaching por vendedor**: KPIs reales separados por canal (Factura/PRO vs Boleta/mostrador), oportunidades de venta por proyecto que se escaparon, y consejos concretos generados con IA para subir el ticket promedio.

## Novedades v2.0

- **Dos objetivos explícitos**, declarados en una banda negra arriba del dashboard y repetidos en cada tarjeta y en la ficha:
  - **Al menos 35% de ventas proyecto** (3,5 de cada 10 documentos con 3 subfamilias distintas o más). Se cuenta **por documento y no por monto**, para que no rinda pegarle un producto barato de otro rubro a una venta grande y "convertirla" en proyecto.
  - **Menos de 35% de documentos con un solo producto.** Menor es mejor. Es el indicador más directo de si el vendedor ofreció algo o no: el cliente pidió una cosa, se llevó esa cosa, y no hubo segunda pregunta.

  Los dos son el mismo número a propósito — **"35 y 35"** se recuerda, dos cifras distintas no.

- **"Lo que estaba sobre la mesa"**, el número en positivo: cuánta venta se dejó pasar en los documentos de un solo producto, en pesos y en % sobre la venta del período. Se calcula **sin supuestos externos**: `ventas que faltaba cruzar para llegar al 35%` × `valor promedio del acompañante en la venta real de esa misma persona` (todo lo que va después del producto principal en sus documentos de 2 productos o más). Aparece en la ficha de cada vendedor y, en vista gerencia, con el desglose por vendedor y el total de la tienda.
- **Glosario de KPI** desplegable al pie del dashboard: qué mide cada número, cuál es su objetivo y de dónde sale.
- **Acceso con usuario y clave, y bitácora de uso.** Cada ingreso queda registrado. Un usuario con rol `admin` ve el botón **Bitácora**: ingresos por persona, días distintos en que entró, cuántas veces generó coaching con IA, actividad diaria de los últimos 30 días e intentos de acceso fallidos.
- **Reporte por hiper familia** (vista gerencia): venta y margen del equipo por rubro, margen % de referencia y la venta de cada vendedor, con el mayor de cada fila destacado.
- **Dos vistas con un switch en la barra superior.** *Vista vendedor* no muestra margen en pesos en ninguna parte — ni en las tarjetas, ni en la ficha, ni en el coaching de IA. *Vista gerencia* agrega margen $, scorecard, comparativa y el diagnóstico de mix vs. precio.
- **Ventas huérfanas:** subfamilias donde el producto salió solo en el documento, con los complementos que faltó ofrecer. Es la munición concreta para la conversación de coaching.
- **Devoluciones por vendedor** (antes sólo existían a nivel global) y su efecto en el margen neto.
- **Scorecard de compensación simulado:** venta 20% · margen % 35% · proyecto 25% · un solo producto 10% · devoluciones 10%.
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
   - `USUARIOS` y `SESSION_SECRET` = ver la sección **Acceso y bitácora** más abajo.
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

## Acceso y bitácora

### 1. Variable `SESSION_SECRET`

Un string largo y aleatorio. Firma el token de sesión, que dura 12 horas. Generar uno:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Variable `USUARIOS`

Un JSON con la lista de personas que pueden entrar. Ejemplo:

```json
[
  {"usuario":"fmunoz","claveHash":"<sha256>","nombre":"Francisco Muñoz","rol":"admin","tienda":"Central"},
  {"usuario":"greyes","claveHash":"<sha256>","nombre":"Gabriel Reyes","rol":"jefe","tienda":"Isabel Riquelme"}
]
```

- `rol`: `admin` ve el botón **Bitácora**; `jefe` ve todo lo demás.
- `claveHash`: la clave en SHA-256, para no dejarla en texto plano en el panel de Netlify. Se genera así:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('la-clave').digest('hex'))"
```

También se acepta `"clave":"texto-plano"` para probar rápido, pero **no lo dejes así en producción**.

### 3. Netlify Blobs

La bitácora se guarda en Netlify Blobs (store `vendedorpro-log`), un blob por evento. No requiere configuración: viene habilitado por defecto en los sitios de Netlify. Si no estuviera disponible, la app entra igual y sólo se pierde el registro.

### Qué se registra

| Evento | Cuándo |
|---|---|
| `login` | Ingreso exitoso |
| `login_fallido` | Usuario o clave incorrectos (guarda el usuario intentado y la IP) |
| `reporte` | Se cargó un Excel, con el número de documentos |
| `ficha` | Se abrió la ficha de un vendedor, con su nombre |
| `coaching` | Se generó coaching con IA para un vendedor |

En la bitácora, la columna que más dice es **días distintos**: entrar diez veces el mismo día no es lo mismo que abrir el reporte diez días distintos con su gente.

### Hasta dónde llega esta seguridad

Es un control de acceso de trabajo, no un sistema de identidad. La clave se valida en el servidor contra un hash y la sesión va firmada, así que no se puede entrar editando el navegador. Pero no hay recuperación de clave, ni segundo factor, ni bloqueo por intentos fallidos, y todos los usuarios ven los mismos datos —el rol sólo controla el acceso a la bitácora, no filtra la información por tienda. Para lo que se necesita hoy (saber quién entra y con qué frecuencia) alcanza; si más adelante hay que separar lo que ve cada tienda, eso es otro trabajo.

---

## Ajustes rápidos (todo en `index.html`, objeto `CONFIG`)

| Parámetro | Qué hace | Default |
|---|---|---|
| `folioNcMax` | Folios bajo este número = nota de crédito | `100000` |
| `folioBoletaMin` | Folios sobre este número = boleta; entremedio = factura | `1000000` |
| `minBoletas` | Mínimo de boletas para que un vendedor entre al coaching | `5` |
| `subProyecto` | Subfamilias distintas mínimas para que un documento cuente como proyecto | `3` |
| `hiperIntegral` | Hiperfamilias mínimas para clasificar como "Proyecto integral" | `2` |
| `metas.proyecto` | Objetivo de % de ventas proyecto | `0.35` |
| `metas.unSku` | Objetivo de % de documentos con un solo producto (**menor mejor**) | `0.35` |
| `metas.margenPct` | Meta de margen %, **única para todo el equipo** | `0.30` |
| `metas.devolucion` | Tope de devoluciones sobre venta (el KPI llega a 0 al doble del tope) | `0.01` |
| `metas.ventaFactor` | Meta de venta = venta del período × esto (**placeholder**, reemplazar por presupuesto) | `1.05` |
| `pesos` | Pesos del scorecard (deben sumar 1) | `.20/.35/.25/.10/.10` |
| `vistaInicial` | `"vendedor"` u `"gerencia"` | `"vendedor"` |

> **Ambos objetivos son de estiramiento.** Con la data de julio 2026 el equipo va en 19% de ventas proyecto (objetivo 35%) y en 55% de documentos con un solo producto (objetivo: bajo 35%). Ninguno de los dos se alcanza en el primer período: eso es deliberado, pero significa que si el scorecard se usara para pagar hoy, esos dos componentes rendirían poco para todos. Si prefieres pagar contra un tramo intermedio y dejar el 35%/30% como objetivo declarado del año, agrega una meta de tramo en `CONFIG.metas` y apunta `scoreDe()` a ella.

> Subir `subProyecto` de 3 a 4 hace el KPI bastante más exigente. Con 3, alrededor del 19% de los documentos califica; con 4 baja a ~8%.

Las sugerencias de complemento de las **ventas huérfanas** están en el objeto `COMPLEMENTOS` (por subfamilia). Si no encuentra la subfamilia, cae al árbol `PROYECTOS`.

**Si más adelante el export del ERP/BIWiser incluye una columna "Tipo Documento"**, el parser la detecta y la usa directo, sin depender de las series de folio.

Las reglas de **venta por proyecto** (qué material dispara qué proyecto y qué acompañantes esperar) están en el arreglo `PROYECTOS` del mismo archivo — fáciles de ampliar o afinar.

---

## Estructura

```
index.html                  SPA completa (login + parser + análisis + UI + PDF)
netlify/functions/coach.js  Proxy a la API de Claude (coaching)
netlify/functions/auth.js   Login, sesión firmada y bitácora en Netlify Blobs
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
