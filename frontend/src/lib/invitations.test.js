/**
 * El primer test de frontend del proyecto.
 *
 * La auditoria marco "cero tests de frontend" como uno de los tres huecos de
 * mas riesgo, y propuso empezar por logica pura: no necesita montar React, no
 * necesita mockear nada, y Jest ya viene con CRA. Este archivo es ese arranque.
 *
 * Se corre con `npm test --prefix frontend`.
 */

import { tokenDe } from './invitations';

describe('tokenDe', () => {
  const TOKEN = 'aB3-xY_9zQ1kLmNoPqRsTuVw';

  it('saca el token de un link completo', () => {
    expect(tokenDe(`https://futbol.pro/invitacion/${TOKEN}`)).toBe(TOKEN);
  });

  it('acepta el codigo pelado', () => {
    expect(tokenDe(TOKEN)).toBe(TOKEN);
  });

  it('ignora los espacios de mas', () => {
    // Copiar desde WhatsApp suele traer un espacio o un salto de linea.
    expect(tokenDe(`  https://futbol.pro/invitacion/${TOKEN}  `)).toBe(TOKEN);
    expect(tokenDe(`\n${TOKEN}\n`)).toBe(TOKEN);
  });

  it('corta la query y el ancla', () => {
    expect(tokenDe(`https://futbol.pro/invitacion/${TOKEN}?utm=wa`)).toBe(TOKEN);
    expect(tokenDe(`https://futbol.pro/invitacion/${TOKEN}#arriba`)).toBe(TOKEN);
  });

  it('funciona con localhost y con puerto', () => {
    expect(tokenDe(`http://localhost:3000/invitacion/${TOKEN}`)).toBe(TOKEN);
  });

  it('funciona aunque falte el protocolo', () => {
    // WhatsApp a veces se come el https:// al copiar.
    expect(tokenDe(`futbol.pro/invitacion/${TOKEN}`)).toBe(TOKEN);
  });

  it('devuelve vacio con nada', () => {
    expect(tokenDe('')).toBe('');
    expect(tokenDe('   ')).toBe('');
    expect(tokenDe(null)).toBe('');
    expect(tokenDe(undefined)).toBe('');
  });

  it('NO inventa un token desde una url que no es de invitacion', () => {
    // Es el caso que importa: mandar a la persona a un 404 confuso es peor que
    // decirle que el link esta mal.
    expect(tokenDe('https://futbol.pro/partidos/abc123')).toBe('');
    expect(tokenDe('https://google.com')).toBe('');
  });

  it('rechaza texto que no puede ser un token', () => {
    expect(tokenDe('hola que tal')).toBe('');
    expect(tokenDe('no-es-un/token')).toBe('');
  });
});
