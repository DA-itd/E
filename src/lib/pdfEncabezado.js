// src/lib/pdfEncabezado.js
// Helper compartido para dibujar el encabezado (logo TecNM + logo ITD +
// título) en cualquier PDF del sistema (reporte de inscripciones,
// reporte de encuesta, etc.), para que todos los PDF se vean iguales.

const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '/'}`;

// Rutas con respaldo múltiple (local y remoto) para asegurar que nunca fallen
export const RUTAS_LOGO_TECNM = [
  `${BASE}logos/logo-tecnm.jpg`,
  `/logos/logo-tecnm.jpg`,
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg',
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.png',
  'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg',
];

export const RUTAS_LOGO_ITD = [
  `${BASE}logo_itdurango.png`,
  `/logo_itdurango.png`,
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logo_itdurango.png',
  'https://raw.githubusercontent.com/DA-itd/E/main/logo_itdurango.png',
  'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true',
];

// Caché en memoria para que no descargue los logos cada vez que generas un PDF
let cacheLogoTecnm = null;
let cacheLogoItd = null;

// Optimiza y reduce drásticamente el peso de imágenes rasterizadas para jsPDF
// Evita que imágenes grandes o con canal alfa sin comprimir inflen el PDF a varios megabytes
export async function optimizarImagenParaPDF(dataUrl, maxW = 300, maxH = 200, calidad = 0.82) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !dataUrl) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let w = img.width || maxW;
          let h = img.height || maxH;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          // Fondo blanco sólido para que logotipos transparentes (PNG) no se oscurezcan
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          // Exportar en JPEG optimizado (reduce de ~200KB-1MB a apenas ~8-14KB)
          const opt = canvas.toDataURL('image/jpeg', calidad);
          resolve(opt);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

export async function cargarImagenBase64(rutas) {
  const lista = Array.isArray(rutas) ? rutas : [rutas];

  for (const url of lista) {
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (res && res.ok) {
        const blob = await res.blob();
        if (blob.size > 100) {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return base64;
        }
      }
    } catch {
      // Probar siguiente alternativa silenciosamente
    }
  }
  return null;
}

// Dibuja el logo del TecNM (izquierda), el del ITD (derecha) y el título
// centrado en la parte superior del PDF. Devuelve el startY sugerido para
// la tabla que sigue (autoTable), dejando espacio debajo del encabezado.
export async function dibujarEncabezadoPDF(doc, titulo, subtitulos = []) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const leftMargin = 14;
  const rightMargin = 14;

  // 1. Cargar logos con caché y compresión optimizada para PDF ultra-ligero
  if (!cacheLogoTecnm) {
    const rawTecnm = await cargarImagenBase64(RUTAS_LOGO_TECNM);
    cacheLogoTecnm = await optimizarImagenParaPDF(rawTecnm, 280, 140, 0.8);
  }
  if (!cacheLogoItd) {
    const rawItd = await cargarImagenBase64(RUTAS_LOGO_ITD);
    cacheLogoItd = await optimizarImagenParaPDF(rawItd, 220, 260, 0.8);
  }

  // 2. Dibujar Logo TecNM (izquierda) con alias 'LOGO_TECNM' para que jsPDF lo reutilice
  // en todas las páginas sin duplicar datos ni aumentar el tamaño del archivo
  if (cacheLogoTecnm) {
    try {
      const formatoTecnm = cacheLogoTecnm.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cacheLogoTecnm, formatoTecnm, leftMargin, 8, 32, 14, 'LOGO_TECNM', 'FAST');
    } catch (e) {
      console.warn('Error al dibujar logo TecNM en PDF:', e);
    }
  }

  // 3. Dibujar Logo ITD (derecha) con alias 'LOGO_ITD' para evitar duplicación entre páginas
  if (cacheLogoItd) {
    try {
      const formatoItd = cacheLogoItd.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cacheLogoItd, formatoItd, pageWidth - rightMargin - 17, 5, 17, 20, 'LOGO_ITD', 'FAST');
    } catch (e) {
      console.warn('Error al dibujar logo ITD en PDF:', e);
    }
  }

  // Ancho disponible entre los dos logos para que nunca se encimen
  const anchoDisponible = pageWidth - (leftMargin + 34 + rightMargin + 18);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 57, 106);

  const lineasTitulo = doc.splitTextToSize(titulo, anchoDisponible);
  let y = 13;
  for (const lt of lineasTitulo) {
    doc.text(lt, centerX, y, { align: 'center' });
    y += 5;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  for (const linea of subtitulos) {
    if (!linea) continue;
    const lineasSub = doc.splitTextToSize(String(linea), anchoDisponible);
    for (const ls of lineasSub) {
      doc.text(ls, centerX, y, { align: 'center' });
      y += 4.5;
    }
  }

  y = Math.max(y, 25);
  doc.setDrawColor(27, 57, 106);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y + 1, pageWidth - rightMargin, y + 1);

  return y + 6;
}
