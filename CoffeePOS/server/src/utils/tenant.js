/**
 * Helpers de aislamiento multi-tenant (por cafetería / clientId)
 */

/**
 * Indica si la petición viene del developer (DeveloperPanel)
 */
export function isDeveloperRequest(req) {
  const role = req.user?.role || req.user?.rol;
  return req.user?.isDeveloper === true || role === 'developer';
}

/**
 * Compara dos clientId (ObjectId o string) de forma segura
 */
export function sameClientId(a, b) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

/**
 * Verifica que un documento pertenezca a la cafetería del usuario que hace la petición.
 * El developer puede acceder a todo.
 * @param {Object} req - request de Express (con req.user)
 * @param {*} docClientId - clientId del documento
 */
export function belongsToRequester(req, docClientId) {
  if (isDeveloperRequest(req)) return true;
  return sameClientId(docClientId, req.user?.clientId);
}
