// Lógica compartilhada do cronômetro — usada pelo admin (que controla) e
// pelo placar público (que só exibe). O estado fica salvo no Firestore como
// um "alvo" (terminaEmMs) em vez de decrementar segundo a segundo, para que
// qualquer dispositivo que abrir a página calcule o tempo restante sozinho.

export function segundosRestantes(estadoCronometro) {
  if (!estadoCronometro) return 0;
  if (estadoCronometro.estado === "rodando") {
    return Math.max(0, Math.round((estadoCronometro.terminaEmMs - Date.now()) / 1000));
  }
  return Math.max(0, estadoCronometro.segundosRestantes || 0);
}

export function formatarTempo(segundosTotais) {
  const seg = Math.max(0, Math.round(segundosTotais));
  const m = Math.floor(seg / 60)
    .toString()
    .padStart(2, "0");
  const s = (seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
