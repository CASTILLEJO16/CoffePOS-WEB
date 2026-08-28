import Config from '../models/Config.js';

export async function getAllConfig(req, res) {
  try {
    const clientId = req.user?.clientId;
    const configRows = await Config.find({ $or: [{ clientId }, { clientId: null }, { clientId: { $exists: false } }] });
    // Priorizar clientId específico si hay duplicados
    const configMap = {};
    configRows.forEach(row => {
      // si es global y ya hay específico, no sobrescribir
      if (row.clientId && String(row.clientId) === String(clientId)) {
        configMap[row.clave] = row.valor;
      } else if (!configMap[row.clave]) {
        configMap[row.clave] = row.valor;
      }
    });
    // También buscar específicos
    const specific = await Config.find({ clientId });
    specific.forEach(row => { configMap[row.clave] = row.valor; });
    res.json({ success: true, data: configMap });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateConfig(req, res) {
  try {
    console.log('[ConfigController] Recibiendo configuración:', req.body);
    const configuraciones = req.body.configuraciones || req.body;
    console.log('[ConfigController] Configuraciones a procesar:', configuraciones);

    const clientId = req.user?.clientId;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId requerido' });
    for (const [clave, valor] of Object.entries(configuraciones)) {
      console.log(`[ConfigController] Guardando ${clave} = ${valor} para ${clientId}`);
      await Config.findOneAndUpdate(
        { clave, clientId },
        { valor: String(valor), clientId },
        { upsert: true, new: true }
      );
    }
    
    console.log('[ConfigController] Configuración guardada exitosamente');
    res.json({ success: true });
  } catch (error) {
    console.error('[ConfigController] Error guardando configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
