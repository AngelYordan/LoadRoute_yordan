import { RutaResponse, RutaMuestra } from '@/types/rutas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function formatearRutasParaExportar(rutas: RutaMuestra[]) {
  return rutas.map(ruta => ({
    'ID Envío': ruta.envioId,
    'Cantidad': ruta.cantidadPaquetes,
    'Origen': ruta.tramos[0]?.origen || '',
    'Destino': ruta.tramos[ruta.tramos.length - 1]?.destino || '',
    'Vuelos': ruta.tramos.map(t => `${t.vueloId} (${t.origen}->${t.destino})`).join(', '),
    'Llegada GMT (Minutos)': ruta.llegadaFinalGMT,
    'Días offset': ruta.tramos[ruta.tramos.length - 1]?.diaOffset || 0,
  }));
}

export function exportarAExcel(resultado: RutaResponse) {
  const wb = XLSX.utils.book_new();

  // Pestaña 1: Resumen y KPIs
  const resumen = [
    { Métrica: 'Total Vuelos Procesados', Valor: resultado.totalVuelos },
    { Métrica: 'Total Envíos Cargados', Valor: resultado.totalEnviosCargados },
    { Métrica: 'Envíos Asignados', Valor: resultado.resultadoSA?.enviosAsignados || 0 },
    { Métrica: 'Envíos No Aceptados', Valor: resultado.resultadoSA?.enviosNoAceptados || 0 },
    { Métrica: 'Costo Final', Valor: Math.round((resultado.resultadoSA?.costoFinal || 0) * 100) / 100 },
    { Métrica: 'Mejora Relativa (%)', Valor: `${Math.round((resultado.resultadoSA?.mejoraRelativa || 0) * 100) / 100}%` },
    { Métrica: 'Tiempo Ejecución (ms)', Valor: resultado.resultadoSA?.tiempoEjecucionMs || 0 }
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen KPIs');

  // Pestaña 2: Vuelos Cancelados
  if (resultado.cancelacionesPorDiaSA) {
    const cancelaciones: any[] = [];
    resultado.cancelacionesPorDiaSA.forEach((vuelosIds, diaIndex) => {
      vuelosIds.forEach(vueloId => {
        cancelaciones.push({
          'Día de Simulación': `Día ${diaIndex + 1}`,
          'Vuelo ID Cancelado': vueloId
        });
      });
    });
    if (cancelaciones.length > 0) {
      const wsCancelaciones = XLSX.utils.json_to_sheet(cancelaciones);
      XLSX.utils.book_append_sheet(wb, wsCancelaciones, 'Vuelos Cancelados');
    }
  }

  // Pestaña 3: Detalle Granular de Envíos Asignados
  if (resultado.resultadoSA?.rutasMuestra) {
    const rutasExport = formatearRutasParaExportar(resultado.resultadoSA.rutasMuestra);
    const wsRutas = XLSX.utils.json_to_sheet(rutasExport);
    XLSX.utils.book_append_sheet(wb, wsRutas, 'Detalle Envíos');
  }

  XLSX.writeFile(wb, 'LoadRoute_Reporte.xlsx');
}

export function exportarAPDF(resultado: RutaResponse) {
  const doc = new jsPDF();
  const title = 'Reporte de Simulación LoadRoute';
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.text(`Escenario: ${resultado.escenario}`, 14, 25);
  doc.text(`Fecha Generación: ${new Date().toLocaleString()}`, 14, 30);

  // Tabla de KPIs
  const kpis = [
    ['Total Vuelos Procesados', resultado.totalVuelos.toString()],
    ['Total Envíos Cargados', resultado.totalEnviosCargados.toString()],
    ['Envíos Asignados', (resultado.resultadoSA?.enviosAsignados || 0).toString()],
    ['Envíos No Aceptados', (resultado.resultadoSA?.enviosNoAceptados || 0).toString()],
    ['Costo Final', (Math.round((resultado.resultadoSA?.costoFinal || 0) * 100) / 100).toString()],
    ['Mejora Relativa', `${Math.round((resultado.resultadoSA?.mejoraRelativa || 0) * 100) / 100}%`],
  ];

  autoTable(doc, {
    startY: 35,
    head: [['Métrica', 'Valor']],
    body: kpis,
    theme: 'grid',
    headStyles: { fillColor: [15, 31, 61] } // Color base
  });

  // Cancelaciones
  if (resultado.cancelacionesPorDiaSA) {
    const cancelaciones: any[] = [];
    resultado.cancelacionesPorDiaSA.forEach((vuelosIds, diaIndex) => {
      vuelosIds.forEach(vueloId => cancelaciones.push([`Día ${diaIndex + 1}`, vueloId]));
    });

    if (cancelaciones.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Día Simulación', 'Vuelo Cancelado']],
        body: cancelaciones,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] } // Red para cancelaciones
      });
    }
  }

  doc.save('LoadRoute_Reporte.pdf');
}
