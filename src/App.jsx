import { useState, useEffect, useRef } from "react";

const DENSITY = 0.9;
function pctToMgml(pct) { return +(pct * DENSITY * 10).toFixed(1); }
function mgmlToPct(mgml) { return +(mgml / (DENSITY * 10)).toFixed(2); }

function UnitToggle({ value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <span style={{ fontSize:10, color:"#5a7040", letterSpacing:"0.08em", textTransform:"uppercase" }}>Unidad</span>
      <div style={{ display:"flex", gap:3, background:"#0e1408", border:"1px solid #2a3a1a", borderRadius:6, padding:3 }}>
        {[{id:"pct",label:"%"},{id:"mgml",label:"mg/ml"}].map(opt => (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            padding:"4px 10px", borderRadius:4, border:"none", cursor:"pointer",
            fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700,
            background: value===opt.id ? "#2a4a20" : "transparent",
            color: value===opt.id ? "#a8c870" : "#3a5030", transition:"all 0.15s"
          }}>{opt.label}</button>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN — completar después de crear cuenta EmailJS
// ─────────────────────────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = "service_wr5j7zc";   // ej: "service_abc123"
const EMAILJS_TEMPLATE_ID = "template_19583x8";  // ej: "template_xyz789"
const EMAILJS_PUBLIC_KEY  = "8rWDPanuVWEQXtyE4";   // ej: "aBcDeFgHiJkL"
const MI_MAIL             = "cannapampa@gmail.com";

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE APPS SCRIPT — completar con tu Web App URL
// ─────────────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxND_KRuHNGwywz5AZYFHMNmqt9uMj2DCUHESxFUxbO9DycqkzZ487qTjFVbIm04xR0/exec"; // ej: "https://script.google.com/macros/s/.../exec"

// ── Math ──────────────────────────────────────────────────────────────────────

function solve({ thc1, cbd1, thc2, cbd2, volume, targetTHC, fixedCannabinoide, targetCBD }) {
  const dTHC = thc1 - thc2;
  const dCBD = cbd1 - cbd2;
  let x, y, resultTHC, resultCBD;
  if (fixedCannabinoide === "THC") {
    if (Math.abs(dTHC) < 0.0001) return { feasible: false, warning: "Mismos %THC en ambos aceites." };
    x = volume * (targetTHC - thc2) / dTHC;
    y = volume - x;
    if (x < -0.001 || y < -0.001) return { feasible: false, warning: `THC ${targetTHC}% fuera del rango alcanzable.` };
    resultTHC = targetTHC;
    resultCBD = (cbd1 * x + cbd2 * y) / volume;
  } else {
    if (Math.abs(dCBD) < 0.0001) return { feasible: false, warning: "Mismos %CBD en ambos aceites." };
    x = volume * (targetCBD - cbd2) / dCBD;
    y = volume - x;
    if (x < -0.001 || y < -0.001) return { feasible: false, warning: `CBD ${targetCBD}% fuera del rango alcanzable.` };
    resultCBD = targetCBD;
    resultTHC = (thc1 * x + thc2 * y) / volume;
  }
  return { feasible: true, x: +Math.max(0,x).toFixed(1), y: +Math.max(0,y).toFixed(1), resultTHC: +resultTHC.toFixed(2), resultCBD: +resultCBD.toFixed(2) };
}

function blend(thc1, cbd1, thc2, cbd2, pct1) {
  const t1 = pct1 / 100, t2 = 1 - t1;
  return { thc: +(thc1*t1 + thc2*t2).toFixed(2), cbd: +(cbd1*t1 + cbd2*t2).toFixed(2) };
}
// ── Math 3 aceites ────────────────────────────────────────────────────────────
// Resuelve: f1+f2+f3=1, THC1*f1+THC2*f2+THC3*f3=tTHC, CBD1*f1+CBD2*f2+CBD3*f3=tCBD
// Sistema 3x3, solución exacta por sustitución
function solve3({ oils, volume, targetTHC, targetCBD }) {
  const [o1, o2, o3] = oils;
  // f3 = 1 - f1 - f2
  // (THC1-THC3)*f1 + (THC2-THC3)*f2 = tTHC - THC3
  // (CBD1-CBD3)*f1 + (CBD2-CBD3)*f2 = tCBD - CBD3
  const a = o1.thc - o3.thc, b = o2.thc - o3.thc, e = targetTHC - o3.thc;
  const c = o1.cbd - o3.cbd, d = o2.cbd - o3.cbd, f = targetCBD - o3.cbd;
  const det = a*d - b*c;
  if (Math.abs(det) < 0.0001) return { feasible: false, warning: "Los aceites no forman un triángulo resolvible (determinante 0)." };
  const f1 = (e*d - b*f) / det;
  const f2 = (a*f - e*c) / det;
  const f3 = 1 - f1 - f2;
  if (f1 < -0.001 || f2 < -0.001 || f3 < -0.001)
    return { feasible: false, warning: "El target THC/CBD está fuera del triángulo alcanzable con estos 3 aceites." };
  const ml1 = +(Math.max(0,f1)*volume).toFixed(1);
  const ml2 = +(Math.max(0,f2)*volume).toFixed(1);
  const ml3 = +(Math.max(0,f3)*volume).toFixed(1);
  const rTHC = +(o1.thc*f1 + o2.thc*f2 + o3.thc*f3).toFixed(2);
  const rCBD = +(o1.cbd*f1 + o2.cbd*f2 + o3.cbd*f3).toFixed(2);
  return { feasible: true, ml1, ml2, ml3,
    pct1: +(f1*100).toFixed(1), pct2: +(f2*100).toFixed(1), pct3: +(f3*100).toFixed(1),
    resultTHC: rTHC, resultCBD: rCBD };
}

// Genera el triángulo alcanzable: vértices + puntos intermedios para el canvas
function trianglePoints(oils) {
  // 3 vértices + puntos a lo largo de cada lado (para visualización)
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // lado 1→2
    pts.push({ thc: oils[0].thc*(1-t)+oils[1].thc*t, cbd: oils[0].cbd*(1-t)+oils[1].cbd*t, edge:"12" });
    // lado 2→3
    pts.push({ thc: oils[1].thc*(1-t)+oils[2].thc*t, cbd: oils[1].cbd*(1-t)+oils[2].cbd*t, edge:"23" });
    // lado 1→3
    pts.push({ thc: oils[0].thc*(1-t)+oils[2].thc*t, cbd: oils[0].cbd*(1-t)+oils[2].cbd*t, edge:"13" });
  }
  return pts;
}



// ── PDF generator (jsPDF via CDN) ─────────────────────────────────────────────

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function buildPDFData({ userEmail, thc1, cbd1, thc2, cbd2, mode, sliderPct1, sliderVol, calcResult, calcVolume, fixedCann, targetTHC, targetCBD }) {
  const now = new Date();
  const fecha = now.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const hora  = now.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });

  let mezcla = {};
  if (mode === "rango") {
    const { thc, cbd } = blend(thc1, cbd1, thc2, cbd2, sliderPct1);
    mezcla = {
      modo: "Explorador de rango",
      proporcion1: sliderPct1,
      proporcion2: 100 - sliderPct1,
      ml1: +(sliderVol * sliderPct1 / 100).toFixed(1),
      ml2: +(sliderVol * (100 - sliderPct1) / 100).toFixed(1),
      volumen: sliderVol,
      thcFinal: thc,
      cbdFinal: cbd,
    };
  } else {
    mezcla = {
      modo: "Calculadora por objetivo",
      proporcion1: calcResult?.feasible ? +(calcResult.x / calcVolume * 100).toFixed(1) : "-",
      proporcion2: calcResult?.feasible ? +(calcResult.y / calcVolume * 100).toFixed(1) : "-",
      ml1: calcResult?.feasible ? calcResult.x : "-",
      ml2: calcResult?.feasible ? calcResult.y : "-",
      volumen: calcVolume,
      thcFinal: calcResult?.feasible ? calcResult.resultTHC : "-",
      cbdFinal: calcResult?.feasible ? calcResult.resultCBD : "-",
      objetivo: fixedCann === "THC" ? `THC ${targetTHC}%` : `CBD ${targetCBD}%`,
    };
  }
  return { fecha, hora, userEmail, thc1, cbd1, thc2, cbd2, mezcla };
}

async function generatePDF(data) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = 210, ML = 18, TW = W - 36;

  // Paleta
  const VERDE_OSC = [20, 35, 10];
  const VERDE     = [95, 140, 40];
  const VERDE_MID = [80, 120, 55];
  const VERDE_CLR = [168, 200, 112];
  const TEAL      = [38, 153, 122];
  const BLANCO    = [255, 255, 255];
  const GRIS_OSC  = [30, 30, 30];
  const GRIS_MID  = [128, 128, 128];

  const m = data.mezcla;
  const fecha = data.fecha;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...VERDE_OSC);
  doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...VERDE);
  doc.rect(0, 22, W, 1.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(15);
  doc.setTextColor(...BLANCO);
  doc.text("Aceite de Cannabis Medicinal", ML, 10);
  doc.setFillColor(...VERDE_CLR);
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.setTextColor(...VERDE_CLR);
  doc.text("Blend", ML, 17);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.setTextColor(100, 140, 60);
  doc.text(fecha, W-ML, 17, { align:"right" });

  // ── SECCIÓN TITLE helper ──────────────────────────────────────────────────
  function sectionTitle(y, text) {
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
    doc.setTextColor(...VERDE);
    doc.text(text, ML, y);
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.3);
    doc.line(ML, y+1.5, ML+TW, y+1.5);
    return y + 11;
  }

  // ── OBJETIVO ────────────────────────────────────────────────────────────────
  let y = 32;
  y = sectionTitle(y, "OBJETIVO");

  // Bloque verde oscuro
  doc.setFillColor(33, 56, 15);
  doc.roundedRect(ML, y, TW, 26, 2, 2, "F");
  doc.setDrawColor(...VERDE_CLR); doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, TW, 26, 2, 2, "S");
  doc.setFillColor(...VERDE_CLR);
  doc.rect(ML, y+3, 2.5, 20, "F");

  // Label PREPARAR
  doc.setFont("helvetica","bold"); doc.setFontSize(7);
  doc.setTextColor(...VERDE_CLR);
  doc.text("PREPARAR", ML+6, y+6);

  // 3 columnas: Volumen | THC | CBD
  const colW3 = TW / 3;
  const thcMgml = typeof m.thcFinal === "number" ? pctToMgml(m.thcFinal) : "-";
  const cbdMgml = typeof m.cbdFinal === "number" ? pctToMgml(m.cbdFinal) : "-";
  const items3 = [
    { val: m.volumen + " ml", label: "Volumen",        col: [217, 242, 178], sub: null },
    { val: m.thcFinal + "%",  label: "THC",            col: [...VERDE_CLR],  sub: thcMgml + " mg/ml" },
    { val: m.cbdFinal + "%",  label: "CBD",            col: [115, 224, 184], sub: cbdMgml + " mg/ml" },
  ];
  items3.forEach(({ val, label, col, sub }, i) => {
    const cx = ML + colW3*i + colW3/2;
    if (i > 0) {
      doc.setDrawColor(75, 128, 38); doc.setLineWidth(0.3);
      doc.line(ML+colW3*i, y+8, ML+colW3*i, y+22);
    }
    doc.setFont("helvetica","bold"); doc.setFontSize(sub ? 14 : 16);
    doc.setTextColor(...col);
    doc.text(val, cx, sub ? y+17 : y+19, { align:"center" });
    if (sub) {
      doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
      doc.setTextColor(115, 175, 130);
      doc.text(sub, cx, y+22, { align:"center" });
    }
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.setTextColor(140, 184, 96);
    doc.text(label, cx, y+26, { align:"center" });
  });
  y += 34;

  // ── ACEITES BASE ────────────────────────────────────────────────────────────
  y = sectionTitle(y, "ACEITES BASE");

  // Header tabla
  const c1 = [ML, ML+TW*0.5, ML+TW*0.75];
  doc.setFillColor(...VERDE_MID);
  doc.rect(ML, y-4, TW, 7, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  doc.setTextColor(...BLANCO);
  doc.text("Aceite base", c1[0]+2, y);
  doc.text("THC %", c1[1]+2, y);
  doc.text("CBD %", c1[2]+2, y);
  y += 4;

  // Filas aceites
  const aceites = data.aceites || [
    { nombre: data.name1 || "Aceite 1", thc: data.thc1, cbd: data.cbd1 },
    { nombre: data.name2 || "Aceite 2", thc: data.thc2, cbd: data.cbd2 },
  ];
  if (data.thc3 !== undefined && data.thc3 > 0 || data.cbd3 > 0) {
    aceites.push({ nombre: data.name3 || "Aceite 3", thc: data.thc3, cbd: data.cbd3 });
  }
  aceites.forEach((a, i) => {
    doc.setFillColor(i%2===0 ? 245:252, i%2===0 ? 248:254, i%2===0 ? 238:248);
    doc.rect(ML, y-3, TW, 7, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.setTextColor(...GRIS_OSC);
    doc.text(a.nombre, c1[0]+2, y+1);
    doc.text(a.thc+"%", c1[1]+2, y+1);
    doc.text(a.cbd+"%", c1[2]+2, y+1);
    y += 7;
  });
  y += 6;

  // ── VOLÚMENES A MEZCLAR ─────────────────────────────────────────────────────
  y = sectionTitle(y, "VOLÚMENES A MEZCLAR");

  // Header
  const mls = data.mlsExtra || [];
  const hasTres = mls.length > 0;
  const c2 = hasTres
    ? [ML, ML+TW*0.4, ML+TW*0.62, ML+TW*0.82]
    : [ML, ML+TW*0.4, ML+TW*0.65, ML+TW*0.82];
  const headers2 = hasTres
    ? ["Aceite base","Volumen","Proporción",""]
    : ["Aceite base","Volumen","Proporción",""];

  doc.setFillColor(...VERDE_MID);
  doc.rect(ML, y-4, TW, 7, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  doc.setTextColor(...BLANCO);
  ["Aceite base","Volumen","Proporción"].forEach((h,i) => doc.text(h, c2[i]+2, y));
  y += 4;

  // Filas mezcla
  const mezRows = [];
  if (hasTres) {
    mezRows.push([data.name1||"Aceite 1", m.ml1+" ml", m.pct1+"%"]);
    mezRows.push([data.name2||"Aceite 2", m.ml2+" ml", m.pct2+"%"]);
    mezRows.push([data.name3||"Aceite 3", mls[0]+" ml", mls[1]+"%"]);
  } else {
    mezRows.push([data.name1||"Aceite 1", m.ml1+" ml", m.proporcion1+"%"]);
    mezRows.push([data.name2||"Aceite 2", m.ml2+" ml", m.proporcion2+"%"]);
  }
  mezRows.forEach((row, i) => {
    doc.setFillColor(i%2===0 ? 245:252, i%2===0 ? 248:254, i%2===0 ? 238:248);
    doc.rect(ML, y-3, TW, 7, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.setTextColor(...GRIS_OSC);
    row.forEach((cell,j) => doc.text(String(cell), c2[j]+2, y+1));
    y += 7;
  });
  // Fila total
  doc.setFillColor(225, 240, 200);
  doc.rect(ML, y-3, TW, 7, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.setTextColor(...VERDE_OSC);
  doc.text("TOTAL", c2[0]+2, y+1);
  doc.text(m.volumen+" ml", c2[1]+2, y+1);
  doc.text("100%", c2[2]+2, y+1);
  y += 13;

  // ── RESULTADO ESPERADO ──────────────────────────────────────────────────────
  y = sectionTitle(y, "RESULTADO ESPERADO");
  const hw = (TW - 6) / 2;
  [
    { label:"THC resultante", val:m.thcFinal+"%", mgml: typeof m.thcFinal==="number"?pctToMgml(m.thcFinal)+"":" ", col:VERDE_MID },
    { label:"CBD resultante", val:m.cbdFinal+"%", mgml: typeof m.cbdFinal==="number"?pctToMgml(m.cbdFinal)+"":" ", col:TEAL },
  ].forEach(({ label, val, mgml, col }, i) => {
    const bx = ML + i*(hw+6);
    doc.setFillColor(...col);
    doc.roundedRect(bx, y, hw, 22, 2, 2, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
    doc.setTextColor(...BLANCO);
    doc.text(label, bx+hw/2, y+6, { align:"center" });
    doc.setFont("helvetica","bold"); doc.setFontSize(15);
    doc.text(val, bx+hw/2, y+14, { align:"center" });
    doc.setFont("helvetica","normal"); doc.setFontSize(7);
    doc.setTextColor(220, 240, 200);
    doc.text("≈ " + mgml + " mg/ml", bx+hw/2, y+20, { align:"center" });
  });

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const fy = 267;
  doc.setFillColor(...VERDE_OSC);
  doc.rect(0, fy, W, 30, "F");
  doc.setFillColor(...VERDE);
  doc.rect(0, fy, W, 1.5, "F");
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5);
  doc.setTextColor(140, 184, 96);
  const disc = [
    "Esta herramienta realiza cálculos orientativos de mezcla y no constituye una prescripción médica ni una recomendación terapéutica.",
    "Los resultados dependen de los datos ingresados por el usuario, quien asume la responsabilidad por su utilización.",
    "La preparación y el uso de derivados de cannabis medicinal deben realizarse conforme a la normativa vigente y bajo supervisión profesional."
  ];
  disc.forEach((line, i) => {
    doc.text(line, W/2, fy+7+(i*6), { align:"center" });
  });

  return doc;
}


// ── EmailJS sender ────────────────────────────────────────────────────────────

async function loadEmailJS() {
  if (window.emailjs) return window.emailjs;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { window.emailjs.init(EMAILJS_PUBLIC_KEY); resolve(window.emailjs); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function sendReport({ userEmail, pdfDoc, pdfData }) {
  const emailjs = await loadEmailJS();
  const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];
  const { fecha, hora, mezcla, thc1, cbd1, thc2, cbd2 } = pdfData;

  const params = {
    to_email:    userEmail,
    cc_email:    MI_MAIL,
    subject:     `Informe Cannabis Oil Blender · ${fecha}`,
    fecha, hora,
    aceite1_thc: thc1, aceite1_cbd: cbd1,
    aceite2_thc: thc2, aceite2_cbd: cbd2,
    ml1: mezcla.ml1, ml2: mezcla.ml2,
    volumen: mezcla.volumen,
    thc_final: mezcla.thcFinal, cbd_final: mezcla.cbdFinal,
    pdf_base64: pdfBase64,
  };

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
}

// ── Google Sheets log ─────────────────────────────────────────────────────────

async function logToSheets(pdfData, userEmail) {
  if (APPS_SCRIPT_URL === "TU_APPS_SCRIPT_URL") return; // skip until configured
  const { fecha, hora, mezcla, thc1, cbd1, thc2, cbd2 } = pdfData;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha, hora, email: userEmail,
        thc1, cbd1, thc2, cbd2,
        modo: mezcla.modo,
        proporcion1: mezcla.proporcion1, proporcion2: mezcla.proporcion2,
        ml1: mezcla.ml1, ml2: mezcla.ml2,
        volumen: mezcla.volumen,
        thc_final: mezcla.thcFinal, cbd_final: mezcla.cbdFinal,
      }),
    });
  } catch (e) { console.warn("Sheets log failed", e); }
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, unit="%", min=0, max=100, step="0.1" }) {
  const [display, setDisplay] = useState(String(value));

  // sync if parent changes value externally (e.g. chemotype button or unit change)
  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  // reset display to "0" when unit changes to avoid stale/blocked input
  useEffect(() => {
    setDisplay("0");
    onChange(0);
  }, [unit]);

  function handleChange(e) {
    const raw = e.target.value;
    setDisplay(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(parsed);
  }

  function handleFocus(e) {
    // clear field if value is 0 so user types fresh
    if (parseFloat(display) === 0) setDisplay("");
  }

  function handleBlur(e) {
    // restore 0 if left empty
    if (display === "" || isNaN(parseFloat(display))) {
      setDisplay("0");
      onChange(0);
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7a8a6a", fontWeight:600 }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", background:"#1a2010", border:"1px solid #3a4a2a", borderRadius:6 }}>
        <input type="number" min={min} max={max} step={step} value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ flex:1, minWidth:0, width:0, background:"transparent", border:"none", outline:"none",
            color:"#d4e8b0", fontSize:15, padding:"10px 4px 10px 8px", fontFamily:"'DM Mono',monospace",
            MozAppearance:"textfield", WebkitAppearance:"none" }} />
        <span style={{ paddingRight:7, paddingLeft:2, color:"#5a7040", fontSize:10, fontWeight:700, flexShrink:0, whiteSpace:"nowrap", maxWidth:52 }}>{unit}</span>
      </div>
    </div>
  );
}

function OilCard({ num, thc, cbd, onTHC, onCBD, color, name, onName, inputUnit="pct" }) {
  const [editing, setEditing] = useState(false);
  const displayName = name || `Aceite ${num}`;
  return (
    <div style={{ background:"#131a0d", border:`1px solid ${color}44`, borderRadius:12, padding:18, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ marginBottom:12 }}>
        {editing ? (
          <input autoFocus value={displayName}
            onChange={e => onName && onName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => e.key==="Enter" && setEditing(false)}
            style={{ background:"transparent", border:"none", borderBottom:`1px solid ${color}66`,
              outline:"none", color, fontSize:11, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", width:"100%", fontFamily:"'DM Sans',sans-serif" }} />
        ) : (
          <div onClick={() => onName && setEditing(true)}
            style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color,
              fontWeight:700, cursor:onName?"text":"default", display:"flex", alignItems:"center", gap:4 }}>
            {displayName}
            {onName && <span style={{ fontSize:9, opacity:0.4 }}>✎</span>}
          </div>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <NumInput label="THC" value={thc} onChange={onTHC} unit={inputUnit==="mgml"?"mg/ml":"%"} max={inputUnit==="mgml"?200:100} />
        <NumInput label="CBD" value={cbd} onChange={onCBD} unit={inputUnit==="mgml"?"mg/ml":"%"} max={inputUnit==="mgml"?200:100} />
      </div>
    </div>
  );
}

function Toggle({ value, onChange, opts, colors }) {
  return (
    <div style={{ display:"flex", gap:4, background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:8, padding:4 }}>
      {opts.map((opt,i) => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          flex:1, padding:"8px 0", borderRadius:6, border:"none", cursor:"pointer",
          fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
          background: value===opt ? (colors?.[i]||"#8fba3a") : "transparent",
          color: value===opt ? "#0d1408" : "#5a7040", transition:"all 0.2s"
        }}>{opt}</button>
      ))}
    </div>
  );
}

// ── Modal informe ─────────────────────────────────────────────────────────────

const DISCLAIMER_TEXT = [
  "Antes de generar el informe, tenga en cuenta que esta herramienta realiza únicamente cálculos teóricos de mezcla a partir de los datos ingresados por el usuario. Los resultados son orientativos y no constituyen una prescripción médica ni una recomendación terapéutica.",
  "La exactitud de los resultados depende de la información proporcionada por el usuario. La aplicación no verifica la composición, concentración ni calidad de los aceites utilizados.",
  "Esta herramienta está destinada exclusivamente a personas mayores de 18 años. La preparación y el uso de derivados de cannabis medicinal deben realizarse conforme a la normativa vigente y bajo supervisión profesional.",
  "Al continuar, usted declara ser mayor de 18 años y haber leído y comprendido este aviso."
];

function ReportModal({ onClose, pdfDataArgs }) {
  const [step, setStep] = useState("disclaimer"); // disclaimer | form
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | generating | sending | done | error
  const [errMsg, setErrMsg] = useState("");

  const isConfigured = EMAILJS_SERVICE_ID !== "TU_SERVICE_ID";

  async function handleGenerate() {
    if (!email.includes("@")) { setErrMsg("Ingresá un email válido."); return; }
    setErrMsg("");
    setStatus("generating");
    try {
      const pdfData = buildPDFData({ ...pdfDataArgs, userEmail: email });
      const pdfDoc  = await generatePDF(pdfData);

      // Siempre descargar localmente
      const fechaFile = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).replace(/\//g,"-"); pdfDoc.save(`blend-formulacion-${fechaFile}.pdf`);

      // Log en Sheets (sin envío de mail)
      await logToSheets(pdfData, email);
      setStatus("done");
    } catch (e) {
      console.error(e);
      setErrMsg("Error al generar. El PDF se descargó igual.");
      setStatus("error");
    }
  }

  const statusMsg = {
    generating: "Generando PDF...",
    sending:    "Registrando...",
    done:       "✓ PDF descargado correctamente",
    error:      errMsg || "Algo falló.",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#131a0d", border:"1px solid #4a7a20", borderRadius:16,
        padding:28, width:"100%", maxWidth:400, position:"relative" }}>

        {/* Header */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, borderRadius:"16px 16px 0 0",
          background:"linear-gradient(90deg,#8fba3a,#3a9a7a)" }} />
        <button onClick={onClose} style={{ position:"absolute", top:12, right:14,
          background:"none", border:"none", color:"#5a7040", fontSize:18, cursor:"pointer" }}>✕</button>

        <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase",
          color:"#5a8030", marginBottom:6 }}>Informe PDF</div>
        <div style={{ fontSize:18, fontWeight:700, color:"#a8c870", marginBottom:20 }}>
          {step === "disclaimer" ? "Aviso importante" : "Generar y enviar"}
        </div>

        {step === "disclaimer" ? (
          <>
            <div style={{ marginBottom:20 }}>
              {DISCLAIMER_TEXT.map((p, i) => (
                <p key={i} style={{
                  fontSize: i === DISCLAIMER_TEXT.length-1 ? 12 : 12,
                  color: i === DISCLAIMER_TEXT.length-1 ? "#a8c870" : "#8aaa70",
                  lineHeight: 1.65,
                  marginBottom: i === DISCLAIMER_TEXT.length-1 ? 0 : 12,
                  fontWeight: i === DISCLAIMER_TEXT.length-1 ? 600 : 400,
                  fontStyle: i === DISCLAIMER_TEXT.length-1 ? "italic" : "normal",
                  margin: `0 0 ${i === DISCLAIMER_TEXT.length-1 ? 0 : 12}px 0`,
                }}>{p}</p>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button onClick={onClose} style={{
                padding:"12px 0", background:"transparent",
                border:"1px solid #3a4a2a", borderRadius:8, color:"#5a7040",
                fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Cancelar
              </button>
              <button onClick={() => setStep("form")} style={{
                padding:"12px 0", background:"linear-gradient(135deg,#4a7a1a,#2a6a3a)",
                border:"none", borderRadius:8, color:"#f0f8e0",
                fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Entendido →
              </button>
            </div>
          </>
        ) : status === "idle" || status === "error" ? (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase",
                color:"#7a8a6a", fontWeight:600, display:"block", marginBottom:6 }}>
                Email del destinatario
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nombre@mail.com"
                style={{ width:"100%", background:"#1a2010", border:"1px solid #3a4a2a",
                  borderRadius:6, padding:"10px 14px", color:"#d4e8b0", fontSize:15,
                  fontFamily:"'DM Mono',monospace", outline:"none" }} />
            </div>

            {!isConfigured && (
              <div style={{ background:"#1a2a0a", border:"1px solid #3a5010",
                borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#8aaa50" }}>
                ⚠ EmailJS no configurado aún. El PDF se descargará localmente.
              </div>
            )}

            {errMsg && (
              <div style={{ color:"#c06060", fontSize:12, marginBottom:10 }}>{errMsg}</div>
            )}

            <button onClick={handleGenerate} style={{
              width:"100%", padding:"13px 0", background:"linear-gradient(135deg,#6a9a2a,#3a8a5a)",
              border:"none", borderRadius:8, color:"#f0f8e0", fontSize:15, fontWeight:700,
              cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.02em" }}>
              "Descargar PDF"
            </button>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            {status !== "done" && (
              <div style={{ fontSize:28, marginBottom:12,
                animation:"spin 1s linear infinite" }}>⟳</div>
            )}
            {status === "done" && <div style={{ fontSize:32, marginBottom:12 }}>✓</div>}
            <div style={{ fontSize:14, color: status==="done" ? "#8fba3a" : "#a8c870",
              lineHeight:1.6 }}>{statusMsg[status]}</div>
            {status === "done" && (
              <button onClick={onClose} style={{ marginTop:18, padding:"10px 28px",
                background:"#2a3a1a", border:"1px solid #4a6a20", borderRadius:8,
                color:"#a8c870", cursor:"pointer", fontSize:14 }}>Cerrar</button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Quimiotipo helpers ────────────────────────────────────────────────────────

// Para cada quimiotipo, barre los 101 puntos de la mezcla y elige el mejor
function bestPctForChemotype(type, thc1, cbd1, thc2, cbd2) {
  let bestPct = 50, bestScore = -Infinity;
  for (let p = 0; p <= 100; p++) {
    const { thc, cbd } = blend(thc1, cbd1, thc2, cbd2, p);
    let score;
    if (type === "QT1") score = thc - cbd;               // maximizar THC sobre CBD
    if (type === "QT2") score = -(Math.abs(thc - cbd));  // minimizar diferencia THC/CBD
    if (type === "QT3") score = cbd - thc;               // maximizar CBD sobre THC
    if (score > bestScore) { bestScore = score; bestPct = p; }
  }
  return bestPct;
}

const CHEMOTYPES = [
  { id:"QT1", label:"Q. Tipo I",  sub:"THC alto",  color:"#c47a2a", bg:"#2a1a08", border:"#7a4010" },
  { id:"QT2", label:"Q. Tipo II", sub:"Balanceado", color:"#8fba3a", bg:"#0e1a08", border:"#4a7a20" },
  { id:"QT3", label:"Q. Tipo III",sub:"CBD alto",   color:"#3a9a7a", bg:"#081a14", border:"#1a6a4a" },
];

function ChemotypeButtons({ thc1, cbd1, thc2, cbd2, onSelect }) {
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
        color:"#3a5030", marginBottom:7, fontWeight:600 }}>Ir a quimiotipo →</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        {CHEMOTYPES.map(({ id, label, sub, color, bg, border }) => {
          const pct = bestPctForChemotype(id, thc1, cbd1, thc2, cbd2);
          const { thc, cbd } = blend(thc1, cbd1, thc2, cbd2, pct);
          return (
            <button key={id} onClick={() => onSelect(pct)}
              style={{ background:bg, border:`1px solid ${border}`, borderRadius:7,
                padding:"8px 4px", cursor:"pointer", textAlign:"center",
                transition:"border-color 0.15s", fontFamily:"'DM Sans',sans-serif" }}>
              <div style={{ fontSize:10, fontWeight:700, color }}>{sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Quimiotipo shortcuts para 3 aceites ──────────────────────────────────────

function ChemotypeButtons3({ oils, onSelect }) {
  // For each chemotype, find the point inside the triangle that best fits
  // by sampling a grid of (f1,f2,f3) combinations where f1+f2+f3=1
  function bestFor(type) {
    let bestScore = -Infinity, bestTHC = 0, bestCBD = 0;
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps - i; j++) {
        const f1 = i/steps, f2 = j/steps, f3 = 1 - f1 - f2;
        if (f3 < 0) continue;
        const thc = oils[0].thc*f1 + oils[1].thc*f2 + oils[2].thc*f3;
        const cbd = oils[0].cbd*f1 + oils[1].cbd*f2 + oils[2].cbd*f3;
        let score;
        if (type === "QT1") score = thc - cbd;
        if (type === "QT2") score = -(Math.abs(thc - cbd));
        if (type === "QT3") score = cbd - thc;
        if (score > bestScore) { bestScore = score; bestTHC = +thc.toFixed(2); bestCBD = +cbd.toFixed(2); }
      }
    }
    return { targetTHC: bestTHC, targetCBD: bestCBD };
  }

  const chemotypes = [
    { id:"QT1", sub:"THC alto",   color:"#c47a2a", bg:"#2a1a08", border:"#7a4010" },
    { id:"QT2", sub:"Balanceado", color:"#8fba3a", bg:"#0e1a08", border:"#4a7a20" },
    { id:"QT3", sub:"CBD alto",   color:"#3a9a7a", bg:"#081a14", border:"#1a6a4a" },
  ];

  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase",
        color:"#3a5030", marginBottom:7, fontWeight:600 }}>Ir a quimiotipo →</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        {chemotypes.map(({ id, sub, color, bg, border }) => {
          const { targetTHC, targetCBD } = bestFor(id);
          return (
            <button key={id} onClick={() => onSelect({ targetTHC, targetCBD })}
              style={{ background:bg, border:`1px solid ${border}`, borderRadius:7,
                padding:"8px 4px", cursor:"pointer", textAlign:"center",
                fontFamily:"'DM Sans',sans-serif" }}>
              <div style={{ fontSize:10, fontWeight:700, color }}>{sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Slider rango ──────────────────────────────────────────────────────────────

function RangeSlider({ pct1, onChange, thc1, cbd1, thc2, cbd2 }) {
  const { thc, cbd } = blend(thc1, cbd1, thc2, cbd2, pct1);
  const pct2 = 100 - pct1;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6,
        fontSize:11, fontFamily:"'DM Mono',monospace", color:"#5a7040" }}>
        <span style={{color:"#8fba3a"}}>100% A1</span>
        <span style={{color:"#6a9a50"}}>50 · 50</span>
        <span style={{color:"#3a9a7a"}}>100% A2</span>
      </div>
      <style>{`
        .blend-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;
          background:linear-gradient(90deg,#8fba3a 0%,#5a9a5a 50%,#3a9a7a 100%);outline:none;cursor:pointer;}
        .blend-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;
          background:#d4e8b0;border:3px solid #0a0f06;box-shadow:0 0 0 2px #8fba3a88;cursor:pointer;}
        .blend-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;
          background:#d4e8b0;border:3px solid #0a0f06;cursor:pointer;}
      `}</style>
      <input type="range" min={0} max={100} step={1} value={100 - pct1}
        onChange={e => onChange(100 - +e.target.value)} className="blend-slider" />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, gap:8 }}>
        {[{label:"Aceite 1",val:pct1,color:"#8fba3a"},{label:"Aceite 2",val:pct2,color:"#3a9a7a"}].map(({label,val,color})=>(
          <div key={label} style={{ flex:1, background:"#131a0d", border:`1px solid ${color}33`,
            borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{val}<span style={{fontSize:14}}>%</span></div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
        {[{label:"THC",val:thc,color:"#a8c870"},{label:"CBD",val:cbd,color:"#60b89a"}].map(({label,val,color})=>(
          <div key={label} style={{ background:"#0e1a09", border:"1px solid #2a3a1a", borderRadius:8, padding:"10px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontSize:12, color:"#6a8a50", fontWeight:600 }}>{label}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color }}>{val}%</span>
            </div>
            <div style={{ textAlign:"right", fontSize:10, color:"#3a5a30", fontFamily:"'DM Mono',monospace", marginTop:2 }}>≈ {pctToMgml(val)} mg/ml</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeResult({ pct1, thc1, cbd1, thc2, cbd2 }) {
  const [vol, setVol] = useState(100);
  const ml1 = +(vol * pct1 / 100).toFixed(1);
  const ml2 = +(vol * (100-pct1) / 100).toFixed(1);
  const { thc, cbd } = blend(thc1, cbd1, thc2, cbd2, pct1);
  return (
    <div style={{ background:"#0e1a09", border:"1px solid #2a3a1a", borderRadius:10, padding:16, marginTop:12 }}>
      <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
        color:"#7a8a6a", marginBottom:12, fontWeight:600 }}>Volumen final</div>
      <NumInput label="Cantidad total" value={vol} onChange={setVol} unit="ml" min={1} max={50000} step="1" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
        {[{label:"Aceite 1",val:ml1,color:"#8fba3a"},{label:"Aceite 2",val:ml2,color:"#3a9a7a"}].map(({label,val,color})=>(
          <div key={label} style={{ background:"#0a1206", borderRadius:8, padding:"12px 14px",
            textAlign:"center", border:`1px solid ${color}22` }}>
            <div style={{ fontSize:10, color:"#5a7040", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:28, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{val}</div>
            <div style={{ fontSize:12, color:"#4a6030" }}>ml</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:10, background:"#0a0f06", borderRadius:8, padding:"8px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-around", marginBottom:3 }}>
          <span style={{ fontSize:12, color:"#5a7040" }}>THC <strong style={{color:"#a8c870",fontFamily:"'DM Mono',monospace"}}>{thc}%</strong></span>
          <span style={{ fontSize:12, color:"#5a7040" }}>CBD <strong style={{color:"#60b89a",fontFamily:"'DM Mono',monospace"}}>{cbd}%</strong></span>
          <span style={{ fontSize:12, color:"#5a7040" }}>Total <strong style={{color:"#c8dca0",fontFamily:"'DM Mono',monospace"}}>{vol} ml</strong></span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-around" }}>
          <span style={{ fontSize:10, color:"#2a4a20", fontFamily:"'DM Mono',monospace" }}>≈ {pctToMgml(thc)} mg/ml</span>
          <span style={{ fontSize:10, color:"#2a4a20", fontFamily:"'DM Mono',monospace" }}>≈ {pctToMgml(cbd)} mg/ml</span>
          <span style={{ fontSize:10 }}> </span>
        </div>
      </div>
    </div>
  );
}

// ── Calc tab ──────────────────────────────────────────────────────────────────

function CalcTab({ thc1, cbd1, thc2, cbd2 }) {
  const [volume, setVolume] = useState(100);
  const [targetTHC, setTargetTHC] = useState(12);
  const [targetCBD, setTargetCBD] = useState(5);
  const [fixedCann, setFixedCann] = useState("THC");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(solve({ thc1,cbd1,thc2,cbd2,volume,targetTHC,targetCBD,fixedCannabinoide:fixedCann }));
  }, [thc1,cbd1,thc2,cbd2,volume,targetTHC,targetCBD,fixedCann]);

  const ratio = result?.feasible ? (result.x / volume * 100) : 50;
  return (
    <>
      <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:20, marginBottom:14 }}>
        <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#7a8a6a", marginBottom:16, fontWeight:600 }}>Parámetros</div>
        <div style={{ display:"grid", gap:14 }}>
          <NumInput label="Volumen final" value={volume} onChange={setVolume} unit="ml" min={1} max={50000} step="1" />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <label style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#7a8a6a", fontWeight:600 }}>Fijar</label>
            <Toggle value={fixedCann} onChange={setFixedCann} opts={["THC","CBD"]} colors={["#8fba3a","#3a9a7a"]} />
          </div>
          {fixedCann==="THC"
            ? <NumInput label="THC objetivo" value={targetTHC} onChange={setTargetTHC} />
            : <NumInput label="CBD objetivo" value={targetCBD} onChange={setTargetCBD} />}
        </div>
      </div>

      <div style={{ background:result?.feasible?"#0e1a09":"#1a0e0e",
        border:`1px solid ${result?.feasible?"#4a7a20":"#7a2020"}`,
        borderRadius:12, padding:22, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
          background:result?.feasible?"linear-gradient(90deg,#8fba3a,#3a9a7a)":"linear-gradient(90deg,#c04040,#803030)" }} />

        {result?.feasible ? (
          <>
            <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#4a7a20", marginBottom:18, fontWeight:700 }}>Resultado</div>
            <div style={{ marginBottom:18 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:11, color:"#5a7040" }}>
                <span>Aceite 1</span><span>Aceite 2</span>
              </div>
              <div style={{ height:10, borderRadius:5, background:"#1a2a10", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${ratio}%`, background:"linear-gradient(90deg,#8fba3a,#6a9a20)", transition:"width 0.4s", borderRadius:5 }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:11, color:"#5a7040" }}>
                <span>{ratio.toFixed(1)}%</span><span>{(100-ratio).toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[{label:"Aceite 1",val:result.x,color:"#8fba3a"},{label:"Aceite 2",val:result.y,color:"#3a9a7a"}].map(({label,val,color})=>(
                <div key={label} style={{ background:"#0a1206", borderRadius:8, padding:14, textAlign:"center", border:`1px solid ${color}22` }}>
                  <div style={{ fontSize:10, color:"#5a7040", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:28, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{val}</div>
                  <div style={{ fontSize:12, color:"#4a6030" }}>ml</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#0a1206", borderRadius:8, padding:14 }}>
              <div style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4a6030", marginBottom:10 }}>Concentración resultante</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[{label:"THC",val:result.resultTHC,fixed:fixedCann==="THC"},{label:"CBD",val:result.resultCBD,fixed:fixedCann==="CBD"}].map(({label,val,fixed})=>(
                  <div key={label} style={{ marginBottom:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                      <span style={{ fontSize:13, color:"#7a9a50", fontWeight:600 }}>{label}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color:fixed?"#a8c870":"#5a9a7a" }}>{val}%</span>
                    </div>
                    <div style={{ textAlign:"right", fontSize:10, color:"#3a5a30", fontFamily:"'DM Mono',monospace" }}>≈ {pctToMgml(val)} mg/ml</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"12px 0" }}>
            <div style={{ fontSize:26, marginBottom:10 }}>⚠</div>
            <div style={{ color:"#c06060", fontSize:14, lineHeight:1.6 }}>{result?.warning}</div>
          </div>
        )}
      </div>

      {/* Botón informe en calc */}
      {result?.feasible && (
        <CalcReportButton thc1={thc1} cbd1={cbd1} thc2={thc2} cbd2={cbd2}
          calcResult={result} calcVolume={volume} fixedCann={fixedCann}
          targetTHC={targetTHC} targetCBD={targetCBD} />
      )}
    </>
  );
}

function CalcReportButton({ thc1, cbd1, thc2, cbd2, calcResult, calcVolume, fixedCann, targetTHC, targetCBD }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width:"100%", marginTop:12, padding:"13px 0",
        background:"linear-gradient(135deg,#2a4a10,#1a3a28)",
        border:"1px solid #4a7a20", borderRadius:10, color:"#a8c870",
        fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
        letterSpacing:"0.05em" }}>
        ↓ Generar informe PDF
      </button>
      {open && (
        <ReportModal onClose={() => setOpen(false)} pdfDataArgs={{
          thc1, cbd1, thc2, cbd2, mode:"calc",
          sliderPct1:50, sliderVol:100,
          calcResult, calcVolume, fixedCann, targetTHC, targetCBD
        }} />
      )}
    </>
  );
}


// ── Canvas: triángulo interactivo con touch/drag ──────────────────────────────

function TriangleChart({ oils, result, onTouch }) {
  const canvasRef = useRef(null);
  const PAD = {top:16,right:14,bottom:34,left:36};

  function getAxes(W, H) {
    const thcVals = oils.map(o=>o.thc), cbdVals = oils.map(o=>o.cbd);
    const thcMin = Math.max(0, Math.min(...thcVals)-3), thcMax = Math.min(100, Math.max(...thcVals)+3);
    const cbdMin = Math.max(0, Math.min(...cbdVals)-3), cbdMax = Math.min(100, Math.max(...cbdVals)+3);
    const pw = W-PAD.left-PAD.right, ph = H-PAD.top-PAD.bottom;
    const tx = v => PAD.left + (v-thcMin)/(thcMax-thcMin)*pw;
    const ty = v => PAD.top + ph - (v-cbdMin)/(cbdMax-cbdMin)*ph;
    // inverse: canvas px → data value
    const ix = px => thcMin + (px-PAD.left)/pw*(thcMax-thcMin);
    const iy = py => cbdMin + (PAD.top+ph-py)/ph*(cbdMax-cbdMin);
    return { tx, ty, ix, iy, thcMin, thcMax, cbdMin, cbdMax, pw, ph };
  }

  function drawChart(canvas, result) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W*dpr) { canvas.width = W*dpr; canvas.height = H*dpr; }
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
    const { tx, ty, thcMin, thcMax, cbdMin, cbdMax, ph } = getAxes(W,H);

    ctx.fillStyle="#0a0f06"; ctx.fillRect(0,0,W,H);

    // grid
    ctx.strokeStyle="#1a2a10"; ctx.lineWidth=1;
    const thcR=thcMax-thcMin, cbdR=cbdMax-cbdMin;
    const tStep=thcR<=6?1:thcR<=15?2:5, cStep=cbdR<=6?1:cbdR<=15?2:5;
    for(let v=Math.ceil(thcMin);v<=thcMax;v+=tStep){ctx.beginPath();ctx.moveTo(tx(v),PAD.top);ctx.lineTo(tx(v),PAD.top+ph);ctx.stroke();}
    for(let v=Math.ceil(cbdMin);v<=cbdMax;v+=cStep){ctx.beginPath();ctx.moveTo(PAD.left,ty(v));ctx.lineTo(PAD.left+(W-PAD.left-PAD.right),ty(v));ctx.stroke();}

    // axis labels
    ctx.fillStyle="#5a7040"; ctx.font="10px 'DM Mono',monospace"; ctx.textAlign="center";
    for(let v=Math.ceil(thcMin);v<=thcMax;v+=tStep) ctx.fillText(v+"%",tx(v),H-PAD.bottom+14);
    ctx.textAlign="right";
    for(let v=Math.ceil(cbdMin);v<=cbdMax;v+=cStep) ctx.fillText(v+"%",PAD.left-4,ty(v)+4);
    ctx.fillStyle="#4a6030"; ctx.textAlign="center";
    ctx.fillText("THC %",PAD.left+(W-PAD.left-PAD.right)/2,H-4);
    ctx.save(); ctx.translate(11,PAD.top+ph/2); ctx.rotate(-Math.PI/2); ctx.fillText("CBD %",0,0); ctx.restore();

    // triangle fill + border
    const colors=["#8fba3a","#3a9a7a","#e8a030"];
    ctx.beginPath();
    ctx.moveTo(tx(oils[0].thc),ty(oils[0].cbd));
    ctx.lineTo(tx(oils[1].thc),ty(oils[1].cbd));
    ctx.lineTo(tx(oils[2].thc),ty(oils[2].cbd));
    ctx.closePath();
    ctx.fillStyle="#4a7a2022"; ctx.fill();
    ctx.strokeStyle="#5a9a4099"; ctx.lineWidth=1.5; ctx.stroke();

    // vertices
    oils.forEach((o,i)=>{
      ctx.beginPath(); ctx.arc(tx(o.thc),ty(o.cbd),7,0,Math.PI*2);
      ctx.fillStyle="#0a0f06"; ctx.fill();
      ctx.strokeStyle=colors[i]; ctx.lineWidth=2.5; ctx.stroke();
      ctx.fillStyle=colors[i]; ctx.font="bold 11px 'DM Sans',sans-serif";
      ctx.textAlign=tx(o.thc)>PAD.left+(W-PAD.left-PAD.right)/2?"right":"left";
      ctx.fillText("A"+(i+1), tx(o.thc)+(tx(o.thc)>PAD.left+(W-PAD.left-PAD.right)/2?-12:12), ty(o.cbd)-9);
    });

    // pin
    if(result?.feasible){
      const rx=tx(result.resultTHC), ry=ty(result.resultCBD);
      ctx.strokeStyle="#f0d06066"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(rx,PAD.top); ctx.lineTo(rx,PAD.top+ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD.left,ry); ctx.lineTo(PAD.left+(W-PAD.left-PAD.right),ry); ctx.stroke();
      ctx.setLineDash([]);
      // pin shadow
      ctx.beginPath(); ctx.arc(rx,ry,9,0,Math.PI*2);
      ctx.fillStyle="#f0d06033"; ctx.fill();
      ctx.beginPath(); ctx.arc(rx,ry,6,0,Math.PI*2);
      ctx.fillStyle="#f0d060"; ctx.fill();
      ctx.strokeStyle="#0a0f06"; ctx.lineWidth=2; ctx.stroke();
    } else if (onTouch) {
      // hint: tap anywhere inside
      ctx.fillStyle="#3a5a2066"; ctx.font="11px 'DM Sans',sans-serif"; ctx.textAlign="center";
      ctx.fillText("Tocá dentro del triángulo", PAD.left+(W-PAD.left-PAD.right)/2, PAD.top+ph/2);
    }
  }

  useEffect(() => {
    drawChart(canvasRef.current, result);
  }, [oils, result]);

  function handleInteraction(clientX, clientY) {
    if (!onTouch) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const { ix, iy } = getAxes(W, H);
    const thc = +ix(px).toFixed(2), cbd = +iy(py).toFixed(2);
    onTouch(thc, cbd);
  }

  return (
    <div style={{position:"relative"}}>
      <canvas ref={canvasRef}
        style={{width:"100%", height:240, borderRadius:8, display:"block", cursor: onTouch?"crosshair":"default", touchAction:"none"}}
        onClick={e => handleInteraction(e.clientX, e.clientY)}
        onMouseMove={e => { if(e.buttons===1) handleInteraction(e.clientX, e.clientY); }}
        onTouchStart={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
      />
      {onTouch && (
        <div style={{position:"absolute",bottom:6,right:8,fontSize:9,color:"#2a4a20",
          fontFamily:"'DM Mono',monospace",pointerEvents:"none"}}>
          toque / arrastre
        </div>
      )}
    </div>
  );
}

// ── Tab 3 aceites ─────────────────────────────────────────────────────────────

function ThreeOilTab() {
  const [oils, setOils] = useState([
    {thc:17, cbd:0.3},
    {thc:3,  cbd:10},
    {thc:1,  cbd:18},
  ]);
  const [volume, setVolume] = useState(100);
  const [targetTHC, setTHC] = useState(8);
  const [targetCBD, setCBD] = useState(8);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(solve3({ oils, volume, targetTHC, targetCBD }));
  }, [oils, volume, targetTHC, targetCBD]);

  function updateOil(i, field, val) {
    const next = oils.map((o,idx) => idx===i ? {...o,[field]:val} : o);
    setOils(next);
  }

  const oilColors = ["#8fba3a","#3a9a7a","#e8a030"];

  return (
    <div>
      {/* 3 oil cards */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14}}>
        {oils.map((o,i)=>(
          <div key={i} style={{background:"#131a0d", border:`1px solid ${oilColors[i]}44`,
            borderRadius:10, padding:12, position:"relative", overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,
              background:`linear-gradient(90deg,${oilColors[i]},transparent)`}}/>
            <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",
              color:oilColors[i],marginBottom:10,fontWeight:700}}>A{i+1}</div>
            <div style={{display:"grid",gap:8}}>
              <NumInput label="THC" value={o.thc} onChange={v=>updateOil(i,"thc",v)} />
              <NumInput label="CBD" value={o.cbd} onChange={v=>updateOil(i,"cbd",v)} />
            </div>
          </div>
        ))}
      </div>

      {/* Triangle chart */}
      <div style={{background:"#131a0d",border:"1px solid #2a3a1a",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",
          color:"#7a8a6a",marginBottom:10,fontWeight:600}}>Espacio alcanzable</div>
        <TriangleChart oils={oils} result={result} targetTHC={targetTHC} targetCBD={targetCBD}/>
        <div style={{fontSize:11,color:"#3a5030",marginTop:8,textAlign:"center"}}>
          Todo punto dentro del triángulo es alcanzable con estos 3 aceites
        </div>
      </div>

      {/* Target inputs */}
      <div style={{background:"#131a0d",border:"1px solid #2a3a1a",borderRadius:12,padding:16,marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",
          color:"#7a8a6a",marginBottom:14,fontWeight:600}}>Target</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <NumInput label="THC objetivo" value={targetTHC} onChange={setTHC}/>
          <NumInput label="CBD objetivo" value={targetCBD} onChange={setCBD}/>
        </div>
        <NumInput label="Volumen final" value={volume} onChange={setVolume} unit="ml" min={1} max={50000} step="1"/>
      </div>

      {/* Result */}
      <div style={{background:result?.feasible?"#0e1a09":"#1a0e0e",
        border:`1px solid ${result?.feasible?"#4a7a20":"#7a2020"}`,
        borderRadius:12,padding:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,
          background:result?.feasible
            ?"linear-gradient(90deg,#8fba3a,#3a9a7a,#e8a030)"
            :"linear-gradient(90deg,#c04040,#803030)"}}/>

        {result?.feasible ? (
          <>
            <div style={{fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",
              color:"#4a7a20",marginBottom:16,fontWeight:700}}>Resultado</div>

            {/* Proportion bar */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",height:12,borderRadius:6,overflow:"hidden",gap:1}}>
                {[
                  {pct:result.pct1,color:"#8fba3a"},
                  {pct:result.pct2,color:"#3a9a7a"},
                  {pct:result.pct3,color:"#e8a030"},
                ].map(({pct,color},i)=>(
                  <div key={i} style={{width:`${pct}%`,background:color,transition:"width 0.4s",minWidth:pct>0?2:0}}/>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:"#5a7040",fontFamily:"'DM Mono',monospace"}}>
                <span style={{color:"#8fba3a"}}>A1 {result.pct1}%</span>
                <span style={{color:"#3a9a7a"}}>A2 {result.pct2}%</span>
                <span style={{color:"#e8a030"}}>A3 {result.pct3}%</span>
              </div>
            </div>

            {/* ml cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[
                {label:"Aceite 1",val:result.ml1,color:"#8fba3a"},
                {label:"Aceite 2",val:result.ml2,color:"#3a9a7a"},
                {label:"Aceite 3",val:result.ml3,color:"#e8a030"},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:"#0a1206",borderRadius:8,padding:"10px 8px",
                  textAlign:"center",border:`1px solid ${color}22`}}>
                  <div style={{fontSize:9,color:"#5a7040",letterSpacing:"0.08em",
                    textTransform:"uppercase",marginBottom:4}}>{label}</div>
                  <div style={{fontSize:22,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{val}</div>
                  <div style={{fontSize:11,color:"#4a6030"}}>ml</div>
                </div>
              ))}
            </div>

            {/* Cannabinoids result */}
            <div style={{background:"#0a1206",borderRadius:8,padding:12}}>
              <div style={{fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#4a6030",marginBottom:8}}>Concentración resultante</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{label:"THC",val:result.resultTHC,color:"#a8c870"},{label:"CBD",val:result.resultCBD,color:"#60b89a"}].map(({label,val,color})=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,color:"#7a9a50",fontWeight:600}}>{label}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,color}}>{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{textAlign:"center",padding:"12px 0"}}>
            <div style={{fontSize:26,marginBottom:10}}>⚠</div>
            <div style={{color:"#c06060",fontSize:13,lineHeight:1.6}}>{result?.warning}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreeOilReportButton({ oils3, result3, vol3, target3THC, target3CBD }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width:"100%", marginTop:12, padding:"13px 0",
        background:"linear-gradient(135deg,#2a4a10,#1a3a28)",
        border:"1px solid #4a7a20", borderRadius:10, color:"#a8c870",
        fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
        letterSpacing:"0.05em" }}>
        ↓ Generar informe PDF
      </button>
      {open && (
        <ReportModal onClose={() => setOpen(false)} pdfDataArgs={{
          thc1: oils3[0].thc, cbd1: oils3[0].cbd,
          thc2: oils3[1].thc, cbd2: oils3[1].cbd,
          mode:"calc", sliderPct1: result3.pct1, sliderVol: vol3,
          calcResult:{ feasible:true, x:result3.ml1, y:result3.ml2,
            resultTHC:result3.resultTHC, resultCBD:result3.resultCBD },
          calcVolume:vol3, fixedCann:"THC",
          targetTHC:target3THC, targetCBD:target3CBD,
        }} />
      )}
    </>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

// ── PDF FLOR ───────────────────────────────────────────────────────────────────

async function generatePDFFlor(data) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit:"mm", format:"a4" });
  const W = 210, ML = 18, TW = W - 36;

  const VERDE_OSC=[20,35,10], VERDE=[95,140,40], VERDE_MID=[80,120,55],
        VERDE_CLR=[168,200,112], TEAL=[38,153,122], BLANCO=[255,255,255],
        GRIS_OSC=[30,30,30];

  function sectionTitle(y, text) {
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
    doc.setTextColor(...VERDE);
    doc.text(text, ML, y);
    doc.setDrawColor(...VERDE); doc.setLineWidth(0.3);
    doc.line(ML, y+1.5, ML+TW, y+1.5);
    return y + 11;
  }

  // HEADER
  doc.setFillColor(...VERDE_OSC); doc.rect(0,0,W,22,"F");
  doc.setFillColor(...VERDE); doc.rect(0,22,W,1.5,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(...BLANCO);
  doc.text("Aceite de Cannabis Medicinal", ML, 10);
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...VERDE_CLR);
  doc.text("Blend", ML, 17);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,140,60);
  doc.text(data.fecha, W-ML, 17, { align:"right" });

  let y = 32;

  // OBJETIVO
  y = sectionTitle(y, "OBJETIVO");
  doc.setFillColor(33,56,15);
  doc.roundedRect(ML, y, TW, 26, 2, 2, "F");
  doc.setDrawColor(...VERDE_CLR); doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, TW, 26, 2, 2, "S");
  doc.setFillColor(...VERDE_CLR); doc.rect(ML, y+3, 2.5, 20, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...VERDE_CLR);
  doc.text("PREPARAR", ML+6, y+6);
  const cols = [
    { val: data.volumen+" ml", label:"Volumen" },
    { val: data.targetMgml+" mg/ml", label: data.objetivo+" objetivo" },
    { val: data.florG+" g", label:"Flor a usar" },
  ];
  const cw = TW/3;
  cols.forEach((c,i) => {
    const cx = ML + cw*i + cw/2;
    if (i>0) { doc.setDrawColor(75,128,38); doc.setLineWidth(0.3); doc.line(ML+cw*i, y+8, ML+cw*i, y+22); }
    doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(...VERDE_CLR);
    doc.text(c.val, cx, y+17, { align:"center" });
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(140,184,96);
    doc.text(c.label, cx, y+23, { align:"center" });
  });
  y += 34;

  // EXTRACCIÓN
  y = sectionTitle(y, "MÉTODO DE EXTRACCIÓN");
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...GRIS_OSC);
  doc.text(`${data.extraccionLabel}  ·  Eficiencia ${data.eficiencia}%`, ML, y);
  y += 12;

  // PERFIL FLOR
  y = sectionTitle(y, "PERFIL DE LA FLOR");
  const c2 = [ML, ML+TW*0.6];
  doc.setFillColor(...VERDE_MID); doc.rect(ML, y-4, TW, 7, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...BLANCO);
  doc.text("Cannabinoide", c2[0]+2, y);
  doc.text("Potencia en flor", c2[1]+2, y);
  y += 4;
  data.perfilFlor.forEach((p,i) => {
    doc.setFillColor(i%2===0?245:252, i%2===0?248:254, i%2===0?238:248);
    doc.rect(ML, y-3, TW, 7, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...GRIS_OSC);
    doc.text(p.id, c2[0]+2, y+1);
    doc.text(p.mgg+" mg/g", c2[1]+2, y+1);
    y += 7;
  });
  y += 8;

  // PERFIL FINAL ACEITE
  y = sectionTitle(y, "PERFIL FINAL DEL ACEITE");
  const c3 = [ML, ML+TW*0.34, ML+TW*0.56, ML+TW*0.78];
  doc.setFillColor(...VERDE_MID); doc.rect(ML, y-4, TW, 7, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...BLANCO);
  ["Cannabinoide","mg/ml","%","Proporción"].forEach((h,i) => doc.text(h, c3[i]+2, y));
  y += 4;
  data.perfilFinal.forEach((r,i) => {
    doc.setFillColor(i%2===0?245:252, i%2===0?248:254, i%2===0?238:248);
    doc.rect(ML, y-3, TW, 7, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...GRIS_OSC);
    doc.text(r.id, c3[0]+2, y+1);
    doc.text(r.mgml+"", c3[1]+2, y+1);
    doc.text(r.pct+"%", c3[2]+2, y+1);
    doc.text(r.prop+"%", c3[3]+2, y+1);
    y += 7;
  });
  y += 6;

  // mg por gota nota
  doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(...VERDE_MID);
  doc.text(`Estimación: 1 gota ≈ 0.05 ml (20 gotas/ml).`, ML, y);

  // FOOTER
  const fy = 267;
  doc.setFillColor(...VERDE_OSC); doc.rect(0, fy, W, 30, "F");
  doc.setFillColor(...VERDE); doc.rect(0, fy, W, 1.5, "F");
  doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(140,184,96);
  const disc = [
    "Esta herramienta realiza cálculos orientativos de mezcla y no constituye una prescripción médica ni una recomendación terapéutica.",
    "Los resultados dependen de los datos ingresados por el usuario, quien asume la responsabilidad por su utilización.",
    "La preparación y el uso de derivados de cannabis medicinal deben realizarse conforme a la normativa vigente y bajo supervisión profesional."
  ];
  disc.forEach((l,i) => doc.text(l, W/2, fy+7+(i*6), { align:"center" }));

  return doc;
}

function FlorReportButton({ florData }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("disclaimer");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleGenerate() {
    if (!email.includes("@")) { setErrMsg("Ingresá un email válido."); return; }
    setErrMsg(""); setStatus("generating");
    try {
      const now = new Date();
      const fecha = now.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"});
      const data = { ...florData, fecha, userEmail: email };
      const doc = await generatePDFFlor(data);
      const fechaFile = fecha.replace(/\//g,"-");
      doc.save(`blend-flor-${fechaFile}.pdf`);
      await logToSheets({ fecha, hora: now.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),
        mezcla:{ modo:"Desde flor", volumen: florData.volumen, thcFinal:"-", cbdFinal:"-",
          ml1:florData.florG, ml2:"-", proporcion1:"-", proporcion2:"-" },
        thc1:"-", cbd1:"-", thc2:"-", cbd2:"-" }, email);
      setStatus("done");
    } catch(e) { console.error(e); setErrMsg("Error al generar. Probá de nuevo."); setStatus("error"); }
  }

  const statusMsg = { generating:"Generando PDF...", done:"✓ PDF descargado correctamente", error: errMsg||"Algo falló." };

  return (
    <>
      <button onClick={() => { setOpen(true); setStep("disclaimer"); setStatus("idle"); }} style={{
        width:"100%", marginTop:12, padding:"13px 0",
        background:"linear-gradient(135deg,#2a4a10,#1a3a28)",
        border:"1px solid #4a7a20", borderRadius:10, color:"#a8c870",
        fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
        letterSpacing:"0.05em" }}>
        ↓ Generar informe PDF
      </button>
      {open && (
        <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:1000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => e.target===e.currentTarget && setOpen(false)}>
          <div style={{ background:"#131a0d", border:"1px solid #4a7a20", borderRadius:16,
            padding:28, width:"100%", maxWidth:400, position:"relative" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, borderRadius:"16px 16px 0 0",
              background:"linear-gradient(90deg,#8fba3a,#3a9a7a)" }} />
            <button onClick={() => setOpen(false)} style={{ position:"absolute", top:12, right:14,
              background:"none", border:"none", color:"#5a7040", fontSize:18, cursor:"pointer" }}>✕</button>
            <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase",
              color:"#5a8030", marginBottom:6 }}>Informe PDF</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#a8c870", marginBottom:20 }}>
              {step === "disclaimer" ? "Aviso importante" : "Generar informe"}
            </div>

            {step === "disclaimer" ? (
              <>
                <div style={{ marginBottom:20 }}>
                  {DISCLAIMER_TEXT.map((p,i) => (
                    <p key={i} style={{
                      fontSize:12, color: i===DISCLAIMER_TEXT.length-1?"#a8c870":"#8aaa70",
                      lineHeight:1.65, fontWeight: i===DISCLAIMER_TEXT.length-1?600:400,
                      fontStyle: i===DISCLAIMER_TEXT.length-1?"italic":"normal",
                      margin:`0 0 ${i===DISCLAIMER_TEXT.length-1?0:12}px 0` }}>{p}</p>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button onClick={() => setOpen(false)} style={{ padding:"12px 0", background:"transparent",
                    border:"1px solid #3a4a2a", borderRadius:8, color:"#5a7040", fontSize:14, fontWeight:600,
                    cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancelar</button>
                  <button onClick={() => setStep("form")} style={{ padding:"12px 0",
                    background:"linear-gradient(135deg,#4a7a1a,#2a6a3a)", border:"none", borderRadius:8,
                    color:"#f0f8e0", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Entendido →</button>
                </div>
              </>
            ) : status === "idle" || status === "error" ? (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase",
                    color:"#7a8a6a", fontWeight:600, display:"block", marginBottom:6 }}>Email del destinatario</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@mail.com"
                    style={{ width:"100%", background:"#1a2010", border:"1px solid #3a4a2a", borderRadius:6,
                      padding:"10px 14px", color:"#d4e8b0", fontSize:15, fontFamily:"'DM Mono',monospace", outline:"none" }} />
                </div>
                {errMsg && <div style={{ color:"#c06060", fontSize:12, marginBottom:10 }}>{errMsg}</div>}
                <button onClick={handleGenerate} style={{ width:"100%", padding:"13px 0",
                  background:"linear-gradient(135deg,#6a9a2a,#3a8a5a)", border:"none", borderRadius:8,
                  color:"#f0f8e0", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  Descargar PDF
                </button>
              </>
            ) : (
              <div style={{ textAlign:"center", padding:"24px 0" }}>
                {status !== "done" && <div style={{ fontSize:28, marginBottom:12 }}>⟳</div>}
                {status === "done" && <div style={{ fontSize:32, marginBottom:12 }}>✓</div>}
                <div style={{ fontSize:14, color: status==="done"?"#8fba3a":"#a8c870", lineHeight:1.6 }}>{statusMsg[status]}</div>
                {status === "done" && <button onClick={() => setOpen(false)} style={{ marginTop:18,
                  padding:"10px 28px", background:"#2a3a1a", border:"1px solid #4a6a20", borderRadius:8,
                  color:"#a8c870", cursor:"pointer", fontSize:14 }}>Cerrar</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Extracción desde flor ──────────────────────────────────────────────────────

const TIPOS_EXTRACCION = [
  { id:"oliva",  label:"Aceite de oliva", E:0.70 },
  { id:"mct",    label:"Aceite MCT/coco", E:0.75 },
  { id:"alcohol",label:"Alcohólica",      E:0.85 },
  { id:"manteca",label:"Manteca/cocción", E:0.60 },
];

const CANNABINOIDES = [
  { id:"THC", color:"#a8c870" },
  { id:"CBD", color:"#60b89a" },
  { id:"CBG", color:"#e8a030" },
  { id:"CBN", color:"#c890d0" },
];

const GOTAS_POR_ML = 20; // 1 gota ≈ 0.05 ml

function FlorTab() {
  // perfil de la flor: mg/g de cada cannabinoide
  const [perfil, setPerfil] = useState({ THC: 100, CBD: 0, CBG: 0, CBN: 0 });
  const [activos, setActivos] = useState({ THC: true, CBD: false, CBG: false, CBN: false });
  const [objetivo, setObjetivo] = useState("THC");      // cannabinoide objetivo C*
  const [targetMgml, setTargetMgml] = useState(20);      // concentración objetivo mg/ml
  const [volumen, setVolumen] = useState(30);            // ml de aceite final
  const [extraccion, setExtraccion] = useState("oliva");

  const E = TIPOS_EXTRACCION.find(t => t.id === extraccion)?.E || 0.70;
  const P_obj = perfil[objetivo] || 0;

  // masa de flor según cannabinoide objetivo: m = (C* × V) / (P* × E)
  const florG = (P_obj > 0 && E > 0)
    ? (targetMgml * volumen) / (P_obj * E)
    : 0;

  // perfil final del aceite: para cada cannabinoide activo, C = (m × P × E) / V
  const resultados = CANNABINOIDES
    .filter(c => activos[c.id])
    .map(c => {
      const mgml = florG > 0 ? (florG * perfil[c.id] * E) / volumen : 0;
      return { id: c.id, color: c.color, mgml: +mgml.toFixed(2), pct: +(mgml/10/0.9).toFixed(2) };
    });

  const totalMgml = resultados.reduce((s, r) => s + r.mgml, 0);

  function setPerfilVal(id, val) { setPerfil(p => ({ ...p, [id]: val })); }
  function toggleActivo(id) {
    setActivos(a => {
      const next = { ...a, [id]: !a[id] };
      // si desactivo el objetivo, muevo el objetivo a otro activo
      if (id === objetivo && !next[id]) {
        const otro = CANNABINOIDES.find(c => next[c.id]);
        if (otro) setObjetivo(otro.id);
      }
      return next;
    });
  }

  return (
    <div>
      {/* Tipo de extracción */}
      <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:16, marginBottom:12 }}>
        <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
          color:"#7a8a6a", marginBottom:12, fontWeight:600 }}>Tipo de extracción</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {TIPOS_EXTRACCION.map(t => (
            <button key={t.id} onClick={() => setExtraccion(t.id)} style={{
              padding:"10px 8px", borderRadius:8, cursor:"pointer", textAlign:"left",
              background: extraccion===t.id ? "#1a2e10" : "#0e1408",
              border: `1px solid ${extraccion===t.id ? "#4a7a20" : "#2a3a1a"}`,
              fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s" }}>
              <div style={{ fontSize:12, fontWeight:700, color: extraccion===t.id ? "#a8c870" : "#6a8a50" }}>{t.label}</div>
              <div style={{ fontSize:10, color:"#4a6030", fontFamily:"'DM Mono',monospace", marginTop:2 }}>Eficiencia {(t.E*100).toFixed(0)}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* Perfil de la flor */}
      <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:16, marginBottom:12 }}>
        <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
          color:"#7a8a6a", marginBottom:6, fontWeight:600 }}>Perfil de la flor</div>
        <div style={{ fontSize:11, color:"#4a6030", marginBottom:12 }}>
          Potencia de cada cannabinoide en la flor (mg/g). Activá los que quieras incluir.
        </div>
        <div style={{ display:"grid", gap:8 }}>
          {CANNABINOIDES.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => toggleActivo(c.id)} style={{
                width:42, padding:"8px 0", borderRadius:6, cursor:"pointer", flexShrink:0,
                background: activos[c.id] ? c.color : "transparent",
                border: `1px solid ${activos[c.id] ? c.color : "#2a3a1a"}`,
                color: activos[c.id] ? "#0d1408" : "#3a5030",
                fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700 }}>
                {c.id}
              </button>
              <div style={{ flex:1, opacity: activos[c.id] ? 1 : 0.35, pointerEvents: activos[c.id]?"auto":"none" }}>
                <NumInput label="" value={perfil[c.id]} onChange={v => setPerfilVal(c.id, v)} unit="mg/g" max={400} step="1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cannabinoide objetivo + concentración */}
      <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:16, marginBottom:12 }}>
        <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
          color:"#7a8a6a", marginBottom:12, fontWeight:600 }}>Objetivo de formulación</div>

        <label style={{ fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase",
          color:"#7a8a6a", fontWeight:600, display:"block", marginBottom:6 }}>Cannabinoide objetivo</label>
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
          {CANNABINOIDES.filter(c => activos[c.id]).map(c => (
            <button key={c.id} onClick={() => setObjetivo(c.id)} style={{
              padding:"7px 16px", borderRadius:6, cursor:"pointer",
              background: objetivo===c.id ? c.color : "transparent",
              border: `1px solid ${objetivo===c.id ? c.color : "#2a3a1a"}`,
              color: objetivo===c.id ? "#0d1408" : "#5a7040",
              fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700 }}>
              {c.id}
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <NumInput label={objetivo + " objetivo"} value={targetMgml} onChange={setTargetMgml} unit="mg/ml" max={100} step="0.5" />
          <NumInput label="Volumen aceite" value={volumen} onChange={setVolumen} unit="ml" min={1} max={5000} step="1" />
        </div>
      </div>

      {/* Slider de concentración objetivo */}
      <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:16, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"#6a8a50", fontWeight:600 }}>{objetivo} objetivo</span>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700, color:"#a8c870" }}>{targetMgml} mg/ml</span>
        </div>
        <style>{`
          .flor-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;
            background:linear-gradient(90deg,#2a4a20,#8fba3a);outline:none;cursor:pointer;}
          .flor-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;
            background:#d4e8b0;border:3px solid #0a0f06;box-shadow:0 0 0 2px #8fba3a88;cursor:pointer;}
          .flor-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;
            background:#d4e8b0;border:3px solid #0a0f06;cursor:pointer;}
        `}</style>
        <input type="range" min={0} max={50} step={0.5} value={targetMgml}
          onChange={e => setTargetMgml(+e.target.value)} className="flor-slider" />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:10, color:"#3a5030", fontFamily:"'DM Mono',monospace" }}>
          <span>0</span><span>25</span><span>50 mg/ml</span>
        </div>
      </div>

      {/* RESULTADO */}
      <div style={{ background: florG>0 ? "#0e1a09":"#1a0e0e",
        border:`1px solid ${florG>0?"#4a7a20":"#7a2020"}`,
        borderRadius:12, padding:20, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
          background: florG>0 ? "linear-gradient(90deg,#8fba3a,#3a9a7a)" : "linear-gradient(90deg,#c04040,#803030)" }} />

        {florG > 0 ? (
          <>
            {/* Flor necesaria — destacado */}
            <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
              color:"#4a7a20", marginBottom:14, fontWeight:700 }}>Resultado</div>

            <div style={{ background:"#0a1206", borderRadius:10, padding:"16px", marginBottom:14,
              textAlign:"center", border:"1px solid #2a4a1a" }}>
              <div style={{ fontSize:10, color:"#5a7040", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>
                Flor a utilizar
              </div>
              <div style={{ fontSize:38, fontWeight:700, color:"#a8c870", fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                {florG.toFixed(2)}
              </div>
              <div style={{ fontSize:13, color:"#5a7040", marginTop:2 }}>gramos</div>
            </div>

            {/* Perfil final del aceite */}
            <div style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase",
              color:"#4a6030", marginBottom:10 }}>Perfil final del aceite ({volumen} ml)</div>

            <div style={{ display:"grid", gap:8, marginBottom:14 }}>
              {resultados.map(r => (
                <div key={r.id} style={{ background:"#0a1206", borderRadius:8, padding:"10px 14px",
                  display:"flex", alignItems:"center", justifyContent:"space-between", border:`1px solid ${r.color}22` }}>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:r.color }}>{r.id}</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:700, color:r.color }}>{r.mgml} mg/ml</div>
                    <div style={{ fontSize:10, color:"#3a5a30", fontFamily:"'DM Mono',monospace" }}>
                      {r.pct}% · {(r.mgml/GOTAS_POR_ML).toFixed(2)} mg/gota
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Proporción entre cannabinoides — tabla */}
            {resultados.length > 1 && totalMgml > 0 && (
              <div style={{ background:"#0a1206", borderRadius:8, padding:14 }}>
                <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4a6030", marginBottom:10 }}>
                  Proporción entre cannabinoides
                </div>
                {resultados.map((r, i) => (
                  <div key={r.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"7px 0", borderBottom: i < resultados.length-1 ? "1px solid #1a2a10" : "none" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:r.color, display:"inline-block" }} />
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:r.color }}>{r.id}</span>
                    </span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:700, color:"#c8dca0" }}>
                      {(r.mgml/totalMgml*100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Botón informe PDF */}
            <FlorReportButton florData={{
              volumen, targetMgml, objetivo,
              florG: florG.toFixed(2),
              extraccionLabel: TIPOS_EXTRACCION.find(t=>t.id===extraccion)?.label || "",
              eficiencia: (E*100).toFixed(0),
              perfilFlor: CANNABINOIDES.filter(c=>activos[c.id]).map(c=>({id:c.id, mgg:perfil[c.id]})),
              perfilFinal: resultados.map(r=>({
                id:r.id, mgml:r.mgml, pct:r.pct,
                prop: totalMgml>0 ? (r.mgml/totalMgml*100).toFixed(0) : "0"
              })),
            }} />
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"12px 0" }}>
            <div style={{ fontSize:26, marginBottom:10 }}>⚠</div>
            <div style={{ color:"#c06060", fontSize:13, lineHeight:1.6 }}>
              Cargá la potencia del cannabinoide objetivo ({objetivo}) en la flor para calcular.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // shared oil state
  const [thc1, setThc1] = useState(0);
  const [cbd1, setCbd1] = useState(0);
  const [thc2, setThc2] = useState(0);
  const [cbd2, setCbd2] = useState(0);
  const [thc3, setThc3] = useState(0);
  const [cbd3, setCbd3] = useState(0);
  const [name1, setName1] = useState("Aceite 1");
  const [name2, setName2] = useState("Aceite 2");
  const [name3, setName3] = useState("Aceite 3");

  const [mainMode, setMainMode] = useState("flor"); // "flor" | "mezcla"
  const [oilMode, setOilMode] = useState(2);   // 2 or 3
  const [inputUnit, setInputUnit] = useState("mgml");
  const [tab, setTab]         = useState("rango");
  const [pct1, setPct1]       = useState(50);
  const [sliderVol, setSliderVol] = useState(100);
  const [showRangeReport, setShowRangeReport] = useState(false);

  // 3-oil calc state (lives here so it persists when toggling)
  const [target3THC, setTarget3THC] = useState(8);
  const [target3CBD, setTarget3CBD] = useState(8);
  const [vol3, setVol3]             = useState(100);
  const [result3, setResult3]       = useState(null);

  const oils3 = [
    {thc:thc1,cbd:cbd1},
    {thc:thc2,cbd:cbd2},
    {thc:thc3,cbd:cbd3},
  ];

  useEffect(() => {
    if (oilMode === 3) {
      setResult3(solve3({ oils: oils3, volume: vol3, targetTHC: target3THC, targetCBD: target3CBD }));
    }
  }, [thc1,cbd1,thc2,cbd2,thc3,cbd3,vol3,target3THC,target3CBD,oilMode]);

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f06", fontFamily:"'DM Sans',sans-serif",
      color:"#c8dca0", padding:"28px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;}
      `}</style>

      <div style={{ maxWidth:500, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#4a6030", marginBottom:5 }}>Calculadora de formulación</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#a8c870", letterSpacing:"-0.02em" }}>
            Aceite de Cannabis Medicinal
          </h1>
          <div style={{ fontSize:12, color:"#4a7030", marginTop:3, fontFamily:"'DM Mono',monospace" }}>Blend</div>
        </div>

        {/* Modo principal: Flor / Mezcla */}
        <div style={{ display:"flex", gap:4, background:"#0e1408", border:"1px solid #2a3a1a",
          borderRadius:10, padding:4, marginBottom:16 }}>
          {[{id:"flor",label:"Desde flor"},{id:"mezcla",label:"Mezcla de aceites"}].map(o => (
            <button key={o.id} onClick={() => setMainMode(o.id)} style={{
              flex:1, padding:"10px 0", borderRadius:7, border:"none", cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700,
              background: mainMode===o.id ? "#2a4a20" : "transparent",
              color: mainMode===o.id ? "#a8c870" : "#4a6030",
              transition:"all 0.2s"
            }}>{o.label}</button>
          ))}
        </div>

        {/* ═══ MODO FLOR ═══ */}
        {mainMode === "flor" && <FlorTab />}

        {/* ═══ MODO MEZCLA ═══ */}
        {mainMode === "mezcla" && <>

        {/* 2/3 toggle — between title and oil cards */}
        <div style={{ display:"flex", gap:4, background:"#0e1408", border:"1px solid #2a3a1a",
          borderRadius:8, padding:3, marginBottom:12, width:"fit-content" }}>
          {[2,3].map(n => (
            <button key={n} onClick={() => setOilMode(n)} style={{
              padding:"5px 18px", borderRadius:5, border:"none", cursor:"pointer",
              fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700,
              background: oilMode===n ? (n===2?"#2a4a20":"#3a2008") : "transparent",
              color: oilMode===n ? (n===2?"#a8c870":"#e8a030") : "#3a5030",
              transition:"all 0.2s"
            }}>{n} aceites</button>
          ))}
        </div>

        {/* Unit toggle */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
          <UnitToggle value={inputUnit} onChange={setInputUnit} />
        </div>

        {/* Oil cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom: oilMode===3 ? 8 : 10 }}>
          <OilCard num="1" thc={thc1} cbd={cbd1} onTHC={setThc1} onCBD={setCbd1} color="#8fba3a" name={name1} onName={setName1} inputUnit={inputUnit} />
          <OilCard num="2" thc={thc2} cbd={cbd2} onTHC={setThc2} onCBD={setCbd2} color="#3a9a7a" name={name2} onName={setName2} inputUnit={inputUnit} />
        </div>
        {oilMode === 3 && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <OilCard num="3" thc={thc3} cbd={cbd3} onTHC={setThc3} onCBD={setCbd3} color="#e8a030" name={name3} onName={setName3} inputUnit={inputUnit} />
            <div style={{ background:"#0d1209", border:"1px dashed #2a3a1a", borderRadius:12,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:11, color:"#2a3a1a", fontFamily:"'DM Mono',monospace" }}>A3 cargado</span>
            </div>
          </div>
        )}

        {/* Main tabs — only rango+calc when 2 oils; only calc (target) when 3 oils */}
        {oilMode === 2 && (
          <>
            <Toggle value={tab} onChange={setTab} opts={["rango","calc"]} colors={["#3a7a6a","#6a9a3a"]} />
            <div style={{ height:14 }} />

            {tab === "rango" && (
              <div style={{ background:"#131a0d", border:"1px solid #2a3a1a", borderRadius:12, padding:20 }}>
                <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
                  color:"#7a8a6a", marginBottom:18, fontWeight:600 }}>Explorar combinaciones</div>
                <RangeSlider pct1={pct1} onChange={setPct1} thc1={thc1} cbd1={cbd1} thc2={thc2} cbd2={cbd2} />
                <ChemotypeButtons thc1={thc1} cbd1={cbd1} thc2={thc2} cbd2={cbd2} onSelect={setPct1} />
                <VolumeResult pct1={pct1} thc1={thc1} cbd1={cbd1} thc2={thc2} cbd2={cbd2} />
                <button onClick={() => setShowRangeReport(true)} style={{
                  width:"100%", marginTop:14, padding:"13px 0",
                  background:"linear-gradient(135deg,#2a4a10,#1a3a28)",
                  border:"1px solid #4a7a20", borderRadius:10, color:"#a8c870",
                  fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                  letterSpacing:"0.05em" }}>
                  ↓ Generar informe PDF
                </button>
                {showRangeReport && (
                  <ReportModal onClose={() => setShowRangeReport(false)} pdfDataArgs={{
                    thc1, cbd1, thc2, cbd2, mode:"rango",
                    sliderPct1:pct1, sliderVol,
                    calcResult:null, calcVolume:100, fixedCann:"THC", targetTHC:0, targetCBD:0
                  }} />
                )}
              </div>
            )}

            {tab === "calc" && (
              <CalcTab thc1={thc1} cbd1={cbd1} thc2={thc2} cbd2={cbd2} />
            )}
          </>
        )}

        {/* 3-oil mode: triangle + target calc */}
        {oilMode === 3 && (
          <div>
            {/* Triangle chart */}
            <div style={{ background:"#131a0d", border:"1px solid #2a3a1a",
              borderRadius:12, padding:16, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
                color:"#7a8a6a", marginBottom:10, fontWeight:600 }}>Espacio alcanzable</div>
              <TriangleChart oils={oils3} result={result3}
                onTouch={(thc, cbd) => { setTarget3THC(+thc.toFixed(1)); setTarget3CBD(+cbd.toFixed(1)); }} />
              <div style={{ fontSize:11, color:"#3a5030", marginTop:6, textAlign:"center" }}>
                Tocá o arrastrá dentro del triángulo · o usá los campos abajo
              </div>
            </div>

            {/* Chemotype shortcuts */}
            <ChemotypeButtons3 oils={oils3} onSelect={({targetTHC, targetCBD}) => {
              setTarget3THC(targetTHC); setTarget3CBD(targetCBD);
            }} />

            {/* Target inputs */}
            <div style={{ background:"#131a0d", border:"1px solid #2a3a1a",
              borderRadius:12, padding:16, marginBottom:14 }}>
              <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
                color:"#7a8a6a", marginBottom:14, fontWeight:600 }}>Target exacto</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <NumInput label="THC objetivo" value={target3THC} onChange={setTarget3THC} />
                <NumInput label="CBD objetivo" value={target3CBD} onChange={setTarget3CBD} />
              </div>
              <NumInput label="Volumen final" value={vol3} onChange={setVol3} unit="ml" min={1} max={50000} step="1" />
            </div>

            {/* Result */}
            <div style={{ background:result3?.feasible?"#0e1a09":"#1a0e0e",
              border:`1px solid ${result3?.feasible?"#4a7a20":"#7a2020"}`,
              borderRadius:12, padding:20, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
                background:result3?.feasible
                  ?"linear-gradient(90deg,#8fba3a,#3a9a7a,#e8a030)"
                  :"linear-gradient(90deg,#c04040,#803030)" }} />

              {result3?.feasible ? (
                <>
                  <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase",
                    color:"#4a7a20", marginBottom:16, fontWeight:700 }}>Resultado</div>

                  {/* Proportion bar */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden" }}>
                      {[{p:result3.pct1,c:"#8fba3a"},{p:result3.pct2,c:"#3a9a7a"},{p:result3.pct3,c:"#e8a030"}].map(({p,c},i)=>(
                        <div key={i} style={{ width:`${p}%`, background:c, minWidth:p>0?2:0 }} />
                      ))}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:5,
                      fontSize:10, fontFamily:"'DM Mono',monospace" }}>
                      <span style={{color:"#8fba3a"}}>A1 {result3.pct1}%</span>
                      <span style={{color:"#3a9a7a"}}>A2 {result3.pct2}%</span>
                      <span style={{color:"#e8a030"}}>A3 {result3.pct3}%</span>
                    </div>
                  </div>

                  {/* ml cards */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                    {[{l:"Aceite 1",v:result3.ml1,c:"#8fba3a"},{l:"Aceite 2",v:result3.ml2,c:"#3a9a7a"},{l:"Aceite 3",v:result3.ml3,c:"#e8a030"}].map(({l,v,c})=>(
                      <div key={l} style={{ background:"#0a1206", borderRadius:8, padding:"10px 6px",
                        textAlign:"center", border:`1px solid ${c}22` }}>
                        <div style={{ fontSize:9, color:"#5a7040", textTransform:"uppercase",
                          letterSpacing:"0.06em", marginBottom:4 }}>{l}</div>
                        <div style={{ fontSize:22, fontWeight:700, color:c,
                          fontFamily:"'DM Mono',monospace" }}>{v}</div>
                        <div style={{ fontSize:11, color:"#4a6030" }}>ml</div>
                      </div>
                    ))}
                  </div>

                  {/* Cannabinoids */}
                  <div style={{ background:"#0a1206", borderRadius:8, padding:12 }}>
                    <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#4a6030", marginBottom:8 }}>Concentración resultante</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {[{label:"THC",val:result3.resultTHC,color:"#a8c870"},{label:"CBD",val:result3.resultCBD,color:"#60b89a"}].map(({label,val,color})=>(
                        <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:12, color:"#7a9a50", fontWeight:600 }}>{label}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color }}>{val}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign:"center", padding:"12px 0" }}>
                  <div style={{ fontSize:26, marginBottom:10 }}>⚠</div>
                  <div style={{ color:"#c06060", fontSize:13, lineHeight:1.6 }}>{result3?.warning}</div>
                </div>
              )}

              {/* PDF 3-oil */}
              {result3?.feasible && (
                <ThreeOilReportButton oils3={oils3} result3={result3} vol3={vol3}
                  target3THC={target3THC} target3CBD={target3CBD} />
              )}
            </div>
          </div>
        )}

        </>}

        <div style={{ textAlign:"center", marginTop:24, borderTop:"1px solid #1a2a10", paddingTop:16 }}>
          <p style={{ fontSize:11, color:"#4a6030", lineHeight:1.6, margin:"0 0 10px 0", fontStyle:"italic" }}>
            Calculadora orientativa. No constituye una prescripción médica ni una recomendación terapéutica. El uso de cannabis medicinal requiere supervisión profesional.
          </p>
          <div style={{ fontSize:10, color:"#1a2a10", letterSpacing:"0.1em" }}>
            Aceite de Cannabis Medicinal Blend
          </div>
        </div>
      </div>
    </div>
  );
}
