/** ¿Puede alguna compra de la tienda terminar rechazada por el CRM? Sólo lectura. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const cargar = (r: string) => { const e: Record<string,string> = {}; for (const l of readFileSync(r,"utf8").split("\n")) { const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g,"").trim(); } return e; };
const web = cargar(".env.local"), crm = cargar("/Users/lucasbarman/Desktop/Multiscope SA/Coding_Multiscope/CRM_FlowThings/.env.local");
const dbW = createClient(web.NEXT_PUBLIC_SUPABASE_URL, web.SUPABASE_SERVICE_ROLE_KEY);
const dbC = createClient(crm.NEXT_PUBLIC_SUPABASE_URL, crm.SUPABASE_SERVICE_ROLE_KEY);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").trim().toLowerCase().replace(/\s+/g," ");

const { data: pw } = await dbW.from("productos").select("id, sku, nombre, activo, variantes(id, atributos, activo)").eq("activo", true);
const { data: pc } = await dbC.from("productos").select("id, sku, nombre, activo, eliminado");
const { data: vc } = await dbC.from("variantes_producto").select("producto_id, nombre, activo");
const crmPorSku = new Map((pc ?? []).filter(p=>!p.eliminado).map(p => [String(p.sku), p]));
const varsPorProd = new Map<string, any[]>();
for (const v of vc ?? []) { const a = varsPorProd.get(v.producto_id) ?? []; a.push(v); varsPorProd.set(v.producto_id, a); }

const sinProducto: string[] = [], soloCrm: string[] = [], soloWeb: string[] = [], desalineadas: string[] = [];
for (const p of (pw ?? []) as any[]) {
  const varsW = (p.variantes ?? []).filter((v: any) => v.activo);
  const c = crmPorSku.get(String(p.sku));
  if (!c) { sinProducto.push(`${p.sku} — ${String(p.nombre).slice(0,38)}`); continue; }
  const varsC = (varsPorProd.get(c.id) ?? []).filter((v: any) => v.activo !== false);
  const nombresW = varsW.map((v: any) => Object.values(v.atributos ?? {}).join(" / "));
  const nombresC = varsC.map((v: any) => String(v.nombre));
  if (varsC.length > 0 && varsW.length === 0)
    soloCrm.push(`${p.sku} — ${String(p.nombre).slice(0,34)} · CRM: ${nombresC.join(", ")}`);
  else if (varsW.length > 0 && varsC.length === 0)
    soloWeb.push(`${p.sku} — ${String(p.nombre).slice(0,34)} · web: ${nombresW.join(", ")}`);
  else if (varsW.length > 0) {
    const faltan = nombresW.filter((n: string) => !nombresC.some(m => norm(m) === norm(n)));
    if (faltan.length) desalineadas.push(`${p.sku} — web "${faltan.join('", "')}" no existe en el CRM (CRM tiene: ${nombresC.join(", ")})`);
  }
}
const bloque = (t: string, xs: string[], explic: string) => { console.log(`\n=== ${t}: ${xs.length}`); if (xs.length) console.log(`    (${explic})`); for (const x of xs.slice(0,14)) console.log("  " + x); if (xs.length>14) console.log(`  … y ${xs.length-14} más`); };
console.log(`productos activos en la tienda: ${pw?.length}`);
bloque("SKU que no existe en el CRM", sinProducto, "el CRM rechaza la venta entera");
bloque("Con variantes en el CRM y NINGUNA en la web", soloCrm, "la web vende sin variante y el CRM rechaza — el freno nuevo no lo ve");
bloque("Con variantes en la web y ninguna en el CRM", soloWeb, "el CRM ignora la variante; registra contra el producto base");
bloque("Variantes de la web que no matchean con el CRM", desalineadas, "el CRM rechaza el item aunque el comprador haya elegido");
