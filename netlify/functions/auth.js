// netlify/functions/auth.js
// Acceso con usuario/clave + bitácora de ingresos.
//
// Variables de entorno en Netlify:
//   USUARIOS         JSON con la lista de usuarios (ver README)
//   SESSION_SECRET   string largo y aleatorio, para firmar el token de sesión
//
// La bitácora vive en Netlify Blobs (store "vendedorpro-log"), un blob por
// evento con clave ev/AAAA-MM-DD/timestamp-random. Un blob por evento evita
// que dos ingresos simultáneos se pisen entre sí.

const crypto = require("crypto");

const HORAS_SESION = 12;
const STORE = "vendedorpro-log";

/* ---------- utilidades ---------- */
const sha256 = s => crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
const hmac = s => crypto.createHmac("sha256", process.env.SESSION_SECRET || "sin-secreto")
                        .update(s).digest("hex");

function firmarToken(u) {
  const exp = Date.now() + HORAS_SESION * 3600 * 1000;
  const cuerpo = `${u.usuario}|${u.rol}|${exp}`;
  return Buffer.from(`${cuerpo}|${hmac(cuerpo)}`).toString("base64");
}

function leerToken(token) {
  try {
    const partes = Buffer.from(token, "base64").toString("utf8").split("|");
    if (partes.length !== 4) return null;
    const [usuario, rol, exp, firma] = partes;
    if (hmac(`${usuario}|${rol}|${exp}`) !== firma) return null;
    if (Date.now() > Number(exp)) return null;
    return { usuario, rol };
  } catch { return null; }
}

function usuarios() {
  try { return JSON.parse(process.env.USUARIOS || "[]"); }
  catch { return null; }   // null = JSON mal formado, se distingue de lista vacía
}

/* Compara la clave contra `claveHash` (sha256, recomendado) o `clave` (texto plano).
   Comparación de tiempo constante para no filtrar información por el tiempo de respuesta. */
function claveOk(u, clave) {
  const esperado = u.claveHash ? u.claveHash.toLowerCase() : (u.clave ? sha256(u.clave) : null);
  if (!esperado) return false;
  const a = Buffer.from(sha256(clave)), b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- bitácora ---------- */
async function abrirStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore(STORE);
  } catch { return null; }   // sin Blobs la app sigue funcionando, sólo sin bitácora
}

async function registrar(ev) {
  const store = await abrirStore();
  if (!store) return false;
  const ts = new Date();
  const dia = ts.toISOString().slice(0, 10);
  const clave = `ev/${dia}/${ts.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  await store.setJSON(clave, { ...ev, ts: ts.toISOString() });
  return true;
}

async function leerBitacora(desde) {
  const store = await abrirStore();
  if (!store) return { disponible: false, eventos: [] };
  const { blobs } = await store.list({ prefix: "ev/" });
  const claves = blobs.map(b => b.key)
    .filter(k => !desde || k.slice(3, 13) >= desde)
    .sort().reverse()
    .slice(0, 3000);
  const eventos = [];
  const lote = 40;
  for (let i = 0; i < claves.length; i += lote) {
    const parte = await Promise.all(claves.slice(i, i + lote).map(k =>
      store.get(k, { type: "json" }).catch(() => null)));
    parte.forEach(e => { if (e) eventos.push(e); });
  }
  return { disponible: true, eventos };
}

/* ---------- handler ---------- */
const json = (code, body) => ({
  statusCode: code,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let p;
  try { p = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "JSON inválido" }); }

  /* --- login --- */
  if (p.accion === "login") {
    const lista = usuarios();
    if (lista === null)
      return json(500, { error: "La variable USUARIOS de Netlify no tiene un JSON válido." });
    if (!lista.length)
      return json(500, { error: "Falta configurar la variable USUARIOS en Netlify." });
    if (!process.env.SESSION_SECRET)
      return json(500, { error: "Falta configurar la variable SESSION_SECRET en Netlify." });

    const nombreUsuario = String(p.usuario || "").trim().toLowerCase();
    const u = lista.find(x => String(x.usuario || "").trim().toLowerCase() === nombreUsuario);

    if (!u || !claveOk(u, p.clave || "")) {
      await registrar({
        usuario: nombreUsuario || "(vacío)", nombre: "—", rol: "—",
        evento: "login_fallido", ip: event.headers["x-nf-client-connection-ip"] || ""
      });
      return json(401, { error: "Usuario o clave incorrectos." });
    }

    const guardado = await registrar({
      usuario: u.usuario, nombre: u.nombre || u.usuario, rol: u.rol || "jefe",
      tienda: u.tienda || "", evento: "login",
      ip: event.headers["x-nf-client-connection-ip"] || ""
    });

    return json(200, {
      token: firmarToken({ usuario: u.usuario, rol: u.rol || "jefe" }),
      usuario: u.usuario, nombre: u.nombre || u.usuario,
      rol: u.rol || "jefe", tienda: u.tienda || "",
      bitacora: guardado
    });
  }

  /* --- registrar un evento de uso (reporte abierto, coaching generado) --- */
  if (p.accion === "evento") {
    const s = leerToken(p.token || "");
    if (!s) return json(401, { error: "Sesión expirada" });
    const lista = usuarios() || [];
    const u = lista.find(x => x.usuario === s.usuario) || {};
    await registrar({
      usuario: s.usuario, nombre: u.nombre || s.usuario, rol: s.rol,
      tienda: u.tienda || "", evento: String(p.evento || "uso").slice(0, 40),
      detalle: String(p.detalle || "").slice(0, 120)
    });
    return json(200, { ok: true });
  }

  /* --- bitácora, sólo admin --- */
  if (p.accion === "bitacora") {
    const s = leerToken(p.token || "");
    if (!s) return json(401, { error: "Sesión expirada" });
    if (s.rol !== "admin") return json(403, { error: "Sólo un administrador puede ver la bitácora." });
    const { disponible, eventos } = await leerBitacora(p.desde);
    if (!disponible)
      return json(200, { disponible: false, eventos: [], nota: "Netlify Blobs no está disponible en este sitio, así que no hay bitácora guardada." });
    return json(200, { disponible: true, eventos });
  }

  return json(400, { error: "Acción desconocida" });
};
