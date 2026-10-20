/**
 * ==========================================================================
 * SISTEMA DE REGISTRO CONDUCTUAL EN CÁMARA OPERANTE (SKINNER BOX)
 * Arquitectura modular de estado, temporizadores, gráficos y exportación
 * ==========================================================================
 */

// 1. ESTADO DE LA APLICACIÓN (Single Source of Truth)
const state = {
  sujeto: "",
  observador: "",
  fecha: "",
  duracionMinutos: 15,
  tiempoTranscurridoSeg: 0,
  enPausa: false,
  intervaloId: null,
  eventosPalanca: [], // Marcas de tiempo en segundos: [12, 14, 45, ...]
  eventosAgua: []      // Marcas de tiempo en segundos: [30, 95, ...]
};

// Instancias de Chart.js
let barChartInstance = null;
let lineChartInstance = null;

// 2. REFERENCIAS DEL DOM (Cacheo de elementos)
const elements = {
  screens: {
    s1: document.getElementById('screen1'),
    s2: document.getElementById('screen2'),
    s3: document.getElementById('screen3')
  },
  status: {
    pill: document.getElementById('sessionStatusPill'),
    text: document.getElementById('sessionStatusText')
  },
  setup: {
    form: document.getElementById('setupForm'),
    subject: document.getElementById('inputSubject'),
    observer: document.getElementById('inputObserver'),
    date: document.getElementById('inputDate'),
    duration: document.getElementById('inputDuration')
  },
  active: {
    subject: document.getElementById('activeSubjectDisplay'),
    observer: document.getElementById('activeObserverDisplay'),
    elapsed: document.getElementById('elapsedDisplay'),
    remaining: document.getElementById('remainingDisplay'),
    btnPauseResume: document.getElementById('btnPauseResume'),
    pauseText: document.getElementById('btnPauseResumeText'),
    pauseDot: document.getElementById('pauseDot'),
    timeAlert: document.getElementById('timeAlert'),
    countPalanca: document.getElementById('countPalanca'),
    countAgua: document.getElementById('countAgua'),
    ratePalancaLive: document.getElementById('ratePalancaLive'),
    rateAguaLive: document.getElementById('rateAguaLive'),
    btnPalancaPlus: document.getElementById('btnPalancaPlus'),
    btnPalancaMinus: document.getElementById('btnPalancaMinus'),
    btnAguaPlus: document.getElementById('btnAguaPlus'),
    btnAguaMinus: document.getElementById('btnAguaMinus'),
    btnResetCounters: document.getElementById('btnResetCounters'),
    btnEndSession: document.getElementById('btnEndSession')
  },
  report: {
    container: document.getElementById('reportExportContainer'),
    folio: document.getElementById('reportFolio'),
    genDate: document.getElementById('reportGenDate'),
    subject: document.getElementById('resSubject'),
    observer: document.getElementById('resObserver'),
    date: document.getElementById('resDate'),
    duration: document.getElementById('resDuration'),
    totalPalanca: document.getElementById('resTotalPalanca'),
    totalAgua: document.getElementById('resTotalAgua'),
    rpmPalanca: document.getElementById('resRpmPalanca'),
    rpmAgua: document.getElementById('resRpmAgua'),
    btnDownloadPng: document.getElementById('btnDownloadPng'),
    downloadBtnText: document.getElementById('downloadBtnText'),
    btnNewSession: document.getElementById('btnNewSession')
  }
};

// 3. UTILIDADES FORMATO Y FECHA
const utils = {
  pad: (n) => n.toString().padStart(2, '0'),
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${this.pad(mins)}:${this.pad(secs)}`;
  },

  setCurrentDateTime() {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = this.pad(now.getMonth() + 1);
    const dy = this.pad(now.getDate());
    const hr = this.pad(now.getHours());
    const mn = this.pad(now.getMinutes());
    elements.setup.date.value = `${yr}-${mo}-${dy}T${hr}:${mn}`;
  },

  sanitizeFilename(str) {
    return str.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }
};

// 4. CONTROL DE PANTALLAS (SPA ROUTING)
function switchScreen(screenKey) {
  Object.values(elements.screens).forEach(screen => screen.classList.add('hidden'));

  if (screenKey === 's1') {
    elements.screens.s1.classList.remove('hidden');
    elements.status.text.textContent = "SISTEMA LISTO";
    elements.status.pill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-neutral-200 bg-neutral-50 text-neutral-600";
  } else if (screenKey === 's2') {
    elements.screens.s2.classList.remove('hidden');
    elements.status.text.textContent = `REGISTRANDO: ${state.sujeto}`;
    elements.status.pill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-amber-300 bg-amber-50 text-amber-900";
  } else if (screenKey === 's3') {
    elements.screens.s3.classList.remove('hidden');
    elements.status.text.textContent = "SESIÓN COMPLETADA";
    elements.status.pill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-neutral-200 bg-neutral-50 text-neutral-700";
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Feedback visual discreto para contadores
function triggerCountFeedback(el) {
  el.style.transform = 'scale(1.05)';
  setTimeout(() => {
    el.style.transform = 'scale(1)';
  }, 90);
}

// 5. GESTIÓN DEL CRONÓMETRO Y CONTADORES
function updateCountersDisplay() {
  elements.active.countPalanca.textContent = state.eventosPalanca.length;
  elements.active.countAgua.textContent = state.eventosAgua.length;

  const mins = Math.max(state.tiempoTranscurridoSeg / 60, 1 / 60);
  elements.active.ratePalancaLive.textContent = (state.eventosPalanca.length / mins).toFixed(1);
  elements.active.rateAguaLive.textContent = (state.eventosAgua.length / mins).toFixed(1);
}

function updateTimerDisplay() {
  elements.active.elapsed.textContent = utils.formatTime(state.tiempoTranscurridoSeg);

  const totalTargetSec = state.duracionMinutos * 60;
  const remainingSec = totalTargetSec - state.tiempoTranscurridoSeg;

  if (remainingSec >= 0) {
    elements.active.remaining.textContent = utils.formatTime(remainingSec);
    elements.active.remaining.classList.remove('text-red-600');
    elements.active.remaining.classList.add('text-neutral-600');
  } else {
    elements.active.remaining.textContent = `+${utils.formatTime(Math.abs(remainingSec))}`;
    elements.active.remaining.classList.remove('text-neutral-600');
    elements.active.remaining.classList.add('text-red-600');
  }

  if (state.tiempoTranscurridoSeg === totalTargetSec) {
    elements.active.timeAlert.classList.remove('hidden');
  }
}

function startTimer() {
  if (state.intervaloId) clearInterval(state.intervaloId);
  state.enPausa = false;
  updatePauseUI();

  state.intervaloId = setInterval(() => {
    if (!state.enPausa) {
      state.tiempoTranscurridoSeg++;
      updateTimerDisplay();
      updateCountersDisplay();
    }
  }, 1000);
}

function togglePause() {
  state.enPausa = !state.enPausa;
  updatePauseUI();
}

function updatePauseUI() {
  if (state.enPausa) {
    elements.active.pauseText.textContent = "Reanudar";
    elements.active.pauseDot.className = "w-2 h-2 rounded-full bg-emerald-500";
    elements.status.text.textContent = `PAUSADO: ${state.sujeto}`;
  } else {
    elements.active.pauseText.textContent = "Pausar";
    elements.active.pauseDot.className = "w-2 h-2 rounded-full bg-amber-500";
    elements.status.text.textContent = `REGISTRANDO: ${state.sujeto}`;
  }
}

// 6. ACCIONES CONDUCTUALES (PALANCA Y AGUA)
function registrarPalanca() {
  state.eventosPalanca.push(state.tiempoTranscurridoSeg);
  updateCountersDisplay();
  triggerCountFeedback(elements.active.countPalanca);
}

function corregirPalanca() {
  if (state.eventosPalanca.length > 0) {
    state.eventosPalanca.pop();
    updateCountersDisplay();
    triggerCountFeedback(elements.active.countPalanca);
  }
}

function registrarAgua() {
  state.eventosAgua.push(state.tiempoTranscurridoSeg);
  updateCountersDisplay();
  triggerCountFeedback(elements.active.countAgua);
}

function corregirAgua() {
  if (state.eventosAgua.length > 0) {
    state.eventosAgua.pop();
    updateCountersDisplay();
    triggerCountFeedback(elements.active.countAgua);
  }
}

function resetearSesion() {
  const confirmacion = window.confirm("¿Confirmar reinicio de contadores? Todas las marcas temporales registradas en esta sesión se eliminarán.");
  if (confirmacion) {
    state.eventosPalanca = [];
    state.eventosAgua = [];
    state.tiempoTranscurridoSeg = 0;
    elements.active.timeAlert.classList.add('hidden');
    updateCountersDisplay();
    updateTimerDisplay();
  }
}

// 7. CÁLCULO DE RESULTADOS Y PROCESAMIENTO
function finalizarSesion() {
  if (state.intervaloId) clearInterval(state.intervaloId);
  state.enPausa = true;

  const duracionFinalSeg = Math.max(state.tiempoTranscurridoSeg, 1);
  const duracionFinalMin = duracionFinalSeg / 60;

  const totP = state.eventosPalanca.length;
  const totA = state.eventosAgua.length;

  const rpmP = (totP / duracionFinalMin).toFixed(2);
  const rpmA = (totA / duracionFinalMin).toFixed(2);

  // Inyectar datos en reporte
  elements.report.subject.textContent = state.sujeto || "N/A";
  elements.report.observer.textContent = state.observador || "N/A";
  elements.report.date.textContent = state.fecha ? state.fecha.replace('T', ' ') : "N/A";
  elements.report.duration.textContent = `${utils.formatTime(duracionFinalSeg)} (${duracionFinalMin.toFixed(1)} min)`;

  elements.report.totalPalanca.textContent = totP;
  elements.report.totalAgua.textContent = totA;
  elements.report.rpmPalanca.textContent = rpmP;
  elements.report.rpmAgua.textContent = rpmA;

  const now = new Date();
  elements.report.genDate.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  elements.report.folio.textContent = `EXP-${Math.floor(100000 + Math.random() * 900000)}`;

  renderCharts(duracionFinalSeg);
  switchScreen('s3');
}

// 8. RENDERIZADO DE GRÁFICOS (CHART.JS CIENTÍFICO)
function renderCharts(duracionSeg) {
  if (barChartInstance) barChartInstance.destroy();
  if (lineChartInstance) lineChartInstance.destroy();

  Chart.defaults.font.family = "'JetBrains Mono', 'Inter', monospace";
  Chart.defaults.color = "#525252";

  // Gráfico 1: Barras Absolutas
  const ctxBar = document.getElementById('barChartCanvas').getContext('2d');
  barChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: ['Presión de Palanca (Canal 1)', 'Beber Agua (Canal 2)'],
      datasets: [{
        data: [state.eventosPalanca.length, state.eventosAgua.length],
        backgroundColor: ['#d97706', '#0284c7'],
        borderColor: ['#b45309', '#0369a1'],
        borderWidth: 1.5,
        borderRadius: 3,
        maxBarThickness: 60
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#171717',
          titleFont: { size: 11 },
          bodyFont: { size: 12 },
          padding: 8,
          cornerRadius: 4,
          callbacks: {
            label: (ctx) => ` Frecuencia: ${ctx.parsed.y} respuestas`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
          title: {
            display: true,
            text: 'Frecuencia Absoluta',
            font: { size: 10, weight: '600' }
          },
          grid: { color: '#e5e5e5' },
          border: { dash: [3, 3] }
        },
        x: {
          ticks: { font: { size: 11, weight: '600' } },
          grid: { display: false }
        }
      }
    }
  });

  // Gráfico 2: Registro Acumulativo de Skinner (Mecánico y Escalonado)
  const maxSeg = Math.max(duracionSeg, 60);
  let step = 15;
  if (maxSeg > 1800) step = 60;
  else if (maxSeg > 900) step = 30;

  const timePoints = [];
  for (let s = 0; s <= maxSeg; s += step) {
    timePoints.push(s);
  }
  if (timePoints[timePoints.length - 1] !== maxSeg) {
    timePoints.push(maxSeg);
  }

  const labelsFormatted = timePoints.map(s => `${(s / 60).toFixed(1)}m`);
  const cumulativePalanca = timePoints.map(t => state.eventosPalanca.filter(ts => ts <= t).length);
  const cumulativeAgua = timePoints.map(t => state.eventosAgua.filter(ts => ts <= t).length);

  const ctxLine = document.getElementById('lineChartCanvas').getContext('2d');
  lineChartInstance = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: labelsFormatted,
      datasets: [
        {
          label: 'Presión de Palanca',
          data: cumulativePalanca,
          borderColor: '#d97706',
          backgroundColor: 'transparent',
          borderWidth: 2,
          stepped: 'before',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#d97706'
        },
        {
          label: 'Beber Agua',
          data: cumulativeAgua,
          borderColor: '#0284c7',
          backgroundColor: 'transparent',
          borderWidth: 2,
          stepped: 'before',
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#0284c7'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 12,
            boxHeight: 2,
            font: { size: 10, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: '#171717',
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          padding: 8,
          cornerRadius: 4,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} acum.`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Tiempo de Sesión (Minutos transcurridos)',
            font: { size: 10, weight: '600' }
          },
          grid: { color: '#f0f0f0' },
          ticks: { font: { size: 9 }, maxTicksLimit: 15 }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
          title: {
            display: true,
            text: 'Respuestas Acumuladas',
            font: { size: 10, weight: '600' }
          },
          grid: { color: '#e5e5e5' },
          border: { dash: [3, 3] }
        }
      }
    }
  });
}

// 9. EXPORTACIÓN EN ALTA RESOLUCIÓN (html2canvas)
async function descargarPNG() {
  try {
    elements.report.downloadBtnText.textContent = "Generando captura...";
    elements.report.btnDownloadPng.disabled = true;

    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(elements.report.container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const subj = utils.sanitizeFilename(state.sujeto || "sujeto");
    const fch = utils.sanitizeFilename(state.fecha ? state.fecha.substring(0, 10) : "fecha");
    const filename = `reporte_${subj}_${fch}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Fallo al exportar reporte:", err);
    alert("No se pudo generar la descarga de imagen. Intente nuevamente.");
  } finally {
    elements.report.downloadBtnText.textContent = "Descargar Reporte en PNG (2x HD)";
    elements.report.btnDownloadPng.disabled = false;
  }
}

// 10. INICIALIZACIÓN Y LISTENERS
function initApp() {
  utils.setCurrentDateTime();

  // Envío Formulario Setup
  elements.setup.form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.sujeto = elements.setup.subject.value.trim();
    state.observador = elements.setup.observer.value.trim();
    state.fecha = elements.setup.date.value;
    state.duracionMinutos = parseInt(elements.setup.duration.value, 10) || 15;
    state.tiempoTranscurridoSeg = 0;
    state.eventosPalanca = [];
    state.eventosAgua = [];

    elements.active.subject.textContent = state.sujeto;
    elements.active.observer.textContent = state.observador;
    elements.active.timeAlert.classList.add('hidden');

    updateCountersDisplay();
    updateTimerDisplay();
    switchScreen('s2');
    startTimer();
  });

  // Botones Pantalla 2
  elements.active.btnPauseResume.addEventListener('click', togglePause);
  elements.active.btnPalancaPlus.addEventListener('click', registrarPalanca);
  elements.active.btnPalancaMinus.addEventListener('click', corregirPalanca);
  elements.active.btnAguaPlus.addEventListener('click', registrarAgua);
  elements.active.btnAguaMinus.addEventListener('click', corregirAgua);
  elements.active.btnResetCounters.addEventListener('click', resetearSesion);

  elements.active.btnEndSession.addEventListener('click', () => {
    if (confirm("¿Finalizar sesión de registro y computar gráficos de resultados?")) {
      finalizarSesion();
    }
  });

  // Botones Pantalla 3
  elements.report.btnDownloadPng.addEventListener('click', descargarPNG);
  elements.report.btnNewSession.addEventListener('click', () => {
    if (confirm("¿Regresar a la pantalla de configuración para un nuevo registro?")) {
      utils.setCurrentDateTime();
      switchScreen('s1');
    }
  });

  // Atajos de teclado en observación
  window.addEventListener('keydown', (e) => {
    if (!elements.screens.s2.classList.contains('hidden')) {
      const k = e.key.toLowerCase();
      if (k === 'p' || k === '1') {
        registrarPalanca();
      } else if (k === 'a' || k === '2') {
        registrarAgua();
      } else if (e.code === 'Space' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        togglePause();
      }
    }
  });
}

// Iniciar al cargar DOM
document.addEventListener('DOMContentLoaded', initApp);
