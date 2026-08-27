/**
 * Permisos del front.
 *
 * REGLA: el front NO deriva permisos, lee booleanos que el backend calculo.
 * Las capacidades por grupo (`can_manage`, `can_invite`, `can_rate_seed`,
 * `can_create_match`) vienen en el payload de `/api/groups`; las del partido, en
 * `match.can_manage`. Ver el hook `use-capacidades`.
 *
 * Aca quedan solo las dos preguntas que son de verdad sobre el rol GLOBAL. Las
 * otras cuatro que vivian en este archivo se borraron: no las importaba nadie, y
 * una de ellas (`canManageMatch`) ademas mentia — preguntaba solo por el rol de
 * grupo y se olvidaba del organizador del propio partido, que el backend si
 * autoriza.
 */

export function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Rol global de organizador.
 *
 * Ojo: NO sirve para decidir si alguien puede crear un partido o un torneo —
 * eso depende del rol dentro de cada grupo. Usalo solo para lo que de verdad es
 * global, como el alta de grupos.
 */
export function isOrganizerRole(user) {
  return user?.role === 'organizador' || user?.role === 'admin';
}
