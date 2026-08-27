import Config from '../models/Config.js';

export async function getAllConfig(req, res) {
  try {
    const configRows = await Config.find({});
    const configMap = {};
    configRows.forEach(row => {
      configMap[row.clave] = row.valor;
    });
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

    for (const [clave, valor] of Object.entries(configuraciones)) {
      console.log(`[ConfigController] Guardando ${clave} = ${valor}`);
      await Config.findOneAndUpdate(
        { clave },
        { valor: String(valor) },
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
