const dbService = require('./telemetryDbService');
const millCatalog = require('./millCatalogService');

/**
 * Limpia y normaliza cadenas numéricas con coma o punto decimal
 */
function parseNumeroSeguro(val) {
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (!val) return null;
  
  let str = String(val).trim();
  // Eliminar unidades y caracteres extraños
  str = str.replace(/°C|mm\/seg|mm\/s|psi|bar/gi, '').trim();
  // Si tiene coma como separador decimal: "42,9" -> "42.9"
  str = str.replace(',', '.');
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function normalizarTimestamp(str) {
  if (!str) return null;
  const s = String(str).trim();
  const matchDmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (matchDmy) {
    const d = matchDmy[1].padStart(2, '0');
    const mo = matchDmy[2].padStart(2, '0');
    const y = matchDmy[3];
    const h = matchDmy[4].padStart(2, '0');
    const mi = matchDmy[5].padStart(2, '0');
    const sec = (matchDmy[6] || '00').padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${sec}`;
  }
  return s;
}

/**
 * Motor de Reglas de Negocio para Telemetría de Molinos
 */
class BusinessRulesEngine {
  /**
   * Corrige posibles errores de digitación de coma (ej. 522 en vez de 52.2)
   */
  corregirErrorDecimal(acronimo, valor, configSensor) {
    if (valor === null || valor === undefined) return { valor, corregido: false };

    // Si es una temperatura y está en rango [200, 999] pero la alarma es menor a 100°C
    if (configSensor && configSensor.unidad === '°C') {
      if (valor > 150 && valor < 1000 && configSensor.umbral_alarma && configSensor.umbral_alarma < 100) {
        const valorAjustado = Number((valor / 10).toFixed(1));
        return {
          valor: valorAjustado,
          corregido: true,
          motivo: `Valor ${valor}°C corregido automáticamente a ${valorAjustado}°C (omisión de coma decimal en HMI).`
        };
      }
    }

    return { valor, corregido: false };
  }

  /**
   * Evalúa la condición operativa del sensor (NORMAL, PREAVISO, ALARMA, FALLA)
   */
  evaluarCondicion(valor, config) {
    if (valor === null || !config) return 'NORMAL';

    const sentido = (config.sentido || 'MAX').toUpperCase();
    const alr = config.umbral_alarma;
    const fll = config.umbral_falla;
    const preavisoMargen = config.margen_preaviso || 0.05;

    if (sentido === 'MAX') {
      if (fll !== null && valor >= fll) return 'FALLA';
      if (alr !== null && valor >= alr) return 'ALARMA';
      // Preaviso si está dentro del 5% inferior de la alarma
      if (alr !== null && valor >= (alr * (1 - preavisoMargen))) return 'PREAVISO';
      return 'NORMAL';
    } else {
      // Sentido MIN (Presiones)
      if (fll !== null && valor <= fll) return 'FALLA';
      if (alr !== null && valor <= alr) return 'ALARMA';
      // Preaviso si está dentro del 5% superior de la alarma
      if (alr !== null && valor <= (alr * (1 + preavisoMargen))) return 'PREAVISO';
      return 'NORMAL';
    }
  }

  /**
   * Valida y procesa un paquete de telemetría extraído por el OCR
   */
  validarYEnriquecer(datosExtraidos, permitirSobrescritura = false) {
    const { codigo_molino, timestamp_pantalla, sensores = [], estados_discretos = {} } = datosExtraidos;
    const tsNormalizado = normalizarTimestamp(timestamp_pantalla);
    const resultado = {
      valido: true,
      esDuplicado: false,
      codigo_molino,
      timestamp_hmi: tsNormalizado,
      sensoresValidados: [],
      incidencias: [],
      resumenCondiciones: { normal: 0, preaviso: 0, alarma: 0, falla: 0 }
    };

    // 1. Validar existencia del molino
    const molinoInfo = millCatalog.obtenerInfoMolino(codigo_molino);
    if (!molinoInfo) {
      resultado.valido = false;
      resultado.incidencias.push({
        motivo: 'MOLINO_DESCONOCIDO',
        detalle: `El código extraído '${codigo_molino}' no pertenece a los 19 molinos catalogados.`
      });
      return resultado;
    }

    // 2. Validar timestamp
    if (!tsNormalizado) {
      resultado.valido = false;
      resultado.incidencias.push({
        motivo: 'TIMESTAMP_INVALIDO',
        detalle: 'No fue posible extraer la fecha y hora de la pantalla del tablero HMI.'
      });
      return resultado;
    }

    // 3. Chequear deduplicación
    if (!permitirSobrescritura && dbService.existeCaptura(codigo_molino, tsNormalizado)) {
      resultado.esDuplicado = true;
      resultado.incidencias.push({
        motivo: 'CAPTURA_DUPLICADA',
        detalle: `Ya existe una captura registrada para ${codigo_molino} a las ${tsNormalizado}.`
      });
      return resultado;
    }

    // 4. Obtener sensores configurados para este molino
    const configsMolino = dbService.obtenerSensoresPorMolino(codigo_molino);
    const configMap = new Map();
    configsMolino.forEach(c => configMap.set(c.acronimo, c));

    // 5. Procesar cada sensor extraído
    for (const s of sensores) {
      const acronimo = millCatalog.normalizarAcronimo(s.acronimo || s.nombre || s.descripcion);
      const conf = configMap.get(acronimo);

      let rawVal = s.valor_actual !== undefined ? s.valor_actual : (s.actual !== undefined ? s.actual : s.valor);
      let valorNumerico = parseNumeroSeguro(rawVal);

      // Chequeo de error decimal (ej. 522 -> 52.2)
      const ajuste = this.corregirErrorDecimal(acronimo, valorNumerico, conf);
      if (ajuste.corregido) {
        valorNumerico = ajuste.valor;
        resultado.incidencias.push({
          motivo: 'CORRECCION_DECIMAL',
          detalle: ajuste.motivo
        });
      }

      // Umbrales (priorizar los configurados en el catálogo maestro si existen)
      const alr = (conf && conf.umbral_alarma !== null) ? conf.umbral_alarma : parseNumeroSeguro(s.alarma);
      const fll = (conf && conf.umbral_falla !== null) ? conf.umbral_falla : parseNumeroSeguro(s.falla);
      const sentido = (conf && conf.sentido) ? conf.sentido : (s.sentido || 'MAX');
      const unidad = (conf && conf.unidad) ? conf.unidad : (s.unidad || '');

      const condicion = this.evaluarCondicion(valorNumerico, {
        sentido,
        umbral_alarma: alr,
        umbral_falla: fll,
        margen_preaviso: 0.05
      });

      if (condicion === 'FALLA') resultado.resumenCondiciones.falla++;
      else if (condicion === 'ALARMA') resultado.resumenCondiciones.alarma++;
      else if (condicion === 'PREAVISO') resultado.resumenCondiciones.preaviso++;
      else resultado.resumenCondiciones.normal++;

      resultado.sensoresValidados.push({
        acronimo,
        nombre_sensor: s.descripcion || s.nombre || (conf ? conf.nombre_completo : acronimo),
        valor: valorNumerico,
        unidad,
        alarma: alr,
        falla: fll,
        sentido,
        condicion
      });
    }

    return resultado;
  }
}

module.exports = new BusinessRulesEngine();
