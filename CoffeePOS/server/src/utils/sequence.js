import Counter from '../models/Counter.js';

/**
 * Obtiene el siguiente número de una secuencia por cafetería, de forma atómica.
 * Dos cajeros cobrando al mismo tiempo nunca reciben el mismo número.
 *
 * La primera vez que se usa una secuencia, se inicializa con el máximo número
 * existente (getCurrentMax) para continuar la numeración de los datos previos.
 *
 * Nota: se ejecuta FUERA de transacciones a propósito (evita conflictos de
 * escritura entre ventas simultáneas). Si una venta falla después de pedir su
 * número, ese número queda sin usar (puede haber huecos, nunca duplicados).
 *
 * @param {string|ObjectId} clientId
 * @param {string} name - nombre de la secuencia (ej. 'numero_venta')
 * @param {() => Promise<number>} getCurrentMax - máximo actual en los datos existentes
 * @param {(n: number) => Promise<boolean>} [isTaken] - ¿ya existe un registro con ese número?
 *        Si el contador se quedó atrás (p. ej. otra versión del sistema siguió numerando
 *        sin usarlo), se pone al día solo con el máximo real y nunca entrega un número repetido.
 */
export async function nextSequence(clientId, name, getCurrentMax, isTaken = null) {
  const exists = await Counter.exists({ clientId, name });
  if (!exists) {
    const currentMax = Number(await getCurrentMax()) || 0;
    try {
      // $max: si otro proceso lo inicializó al mismo tiempo, se queda el mayor
      await Counter.updateOne(
        { clientId, name },
        { $max: { seq: currentMax } },
        { upsert: true }
      );
    } catch (e) {
      if (e.code !== 11000) throw e; // carrera en el upsert: el otro ya lo creó
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const counter = await Counter.findOneAndUpdate(
      { clientId, name },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    if (!isTaken || !(await isTaken(counter.seq))) return counter.seq;
    // Contador atrasado: alcanzar el máximo real y volver a pedir número
    const currentMax = Number(await getCurrentMax()) || 0;
    await Counter.updateOne({ clientId, name }, { $max: { seq: currentMax } });
  }
  throw new Error(`No se pudo generar un número de ${name} único`);
}
