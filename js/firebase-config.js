// ============================================================================
// CONFIGURAÇÃO DO FIREBASE — 2° Família em Campo
// ============================================================================
// Reaproveita o projeto Firebase "cadastro-final-cc77f" que já está em
// produção. Isolamento garantido de duas formas:
//   1) O app de cadastro já existente usa Realtime Database (databaseURL);
//      este placar usa Cloud Firestore — são bancos de dados diferentes,
//      não há como um afetar os dados do outro.
//   2) Mesmo dentro do Firestore, as coleções abaixo têm prefixo próprio
//      (familiaEmCampo2_) para nunca colidir com nada.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyBI5S5ciZioheWabi0W0Ii_r0e3RsYm3iw",
  authDomain: "cadastro-final-cc77f.firebaseapp.com",
  projectId: "cadastro-final-cc77f",
  storageBucket: "cadastro-final-cc77f.firebasestorage.app",
  messagingSenderId: "229086987694",
  appId: "1:229086987694:web:52f1a32f4b1a9f5be2743f",
};

// Nome exclusivo para esta instância do app Firebase. Evita conflito caso
// outro app Firebase já esteja inicializado na mesma página/domínio.
export const FIREBASE_APP_NAME = "familiaEmCampo2";

// Prefixo das coleções no Firestore — mantém os dados deste evento isolados
// mesmo que você reutilize um projeto Firebase já existente.
export const COLLECTIONS = {
  times: "familiaEmCampo2_times",
  atividades: "familiaEmCampo2_atividades",
  lancamentos: "familiaEmCampo2_lancamentos",
  cronometro: "familiaEmCampo2_cronometro",
};

// Documento único (singleton) onde o estado do cronômetro fica salvo, para
// sincronizar em tempo real entre o painel admin e o placar público.
export const CRONOMETRO_DOC_ID = "estado";

// Times padrão do evento — criados automaticamente (se ainda não existirem)
// quando o admin faz login pela primeira vez.
export const TIMES_PADRAO = [
  { id: "azul", nome: "Time Azul", cor: "#1E88E5", corClara: "#64B5F6", emoji: "🐬", ordem: 1 },
  { id: "verde", nome: "Time Verde", cor: "#2E7D32", corClara: "#81C784", emoji: "🐸", ordem: 2 },
  { id: "laranja", nome: "Time Laranja", cor: "#EF6C00", corClara: "#FFB74D", emoji: "🦁", ordem: 3 },
  { id: "amarelo", nome: "Time Amarelo", cor: "#F9A825", corClara: "#FFF176", emoji: "🐥", ordem: 4 },
];
