import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, FIREBASE_APP_NAME, COLLECTIONS, TIMES_PADRAO, CRONOMETRO_DOC_ID } from "./firebase-config.js";
import { segundosRestantes, formatarTempo } from "./cronometro.js";

const DURACAO_PADRAO_SEGUNDOS = 120;

const app = initializeApp(firebaseConfig, FIREBASE_APP_NAME);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------------
// Elementos
// ------------------------------------------------------------------
const telaLogin = document.getElementById("tela-login");
const telaPainel = document.getElementById("tela-painel");
const formLogin = document.getElementById("form-login");
const loginErro = document.getElementById("login-erro");
const btnLogout = document.getElementById("btn-logout");
const usuarioLabel = document.getElementById("usuario-logado");

const timesSelecao = document.getElementById("times-selecao");
const selectAtividade = document.getElementById("select-atividade");
const formNovaAtividade = document.getElementById("form-nova-atividade");
const inputNovaAtividade = document.getElementById("input-nova-atividade");
const inputPontos = document.getElementById("input-pontos");
const botoesRapidos = document.querySelectorAll(".pt-rapido");
const formLancar = document.getElementById("form-lancar");
const btnLancar = formLancar.querySelector("button[type=submit]");
const btnTirar = document.getElementById("btn-tirar");
const lancarMensagem = document.getElementById("lancar-mensagem");
const historicoLista = document.getElementById("historico-lista");
const btnReset = document.getElementById("btn-reset");
const resumoTimes = document.getElementById("resumo-times");

const ultimoLancamentoBox = document.getElementById("ultimo-lancamento");
const ultimoLancamentoTexto = document.getElementById("ultimo-lancamento-texto");
const btnCancelarUltimo = document.getElementById("btn-cancelar-ultimo");

const cronometroDisplay = document.getElementById("cronometro-display");
const btnCronometroIniciar = document.getElementById("btn-cronometro-iniciar");
const btnCronometroPausar = document.getElementById("btn-cronometro-pausar");
const btnCronometroReiniciar = document.getElementById("btn-cronometro-reiniciar");
const botoesDuracaoRapida = document.querySelectorAll(".duracao-rapida");
const inputCronometroMin = document.getElementById("input-cronometro-min");
const inputCronometroSeg = document.getElementById("input-cronometro-seg");
const btnCronometroDefinir = document.getElementById("btn-cronometro-definir");

let timeSelecionadoId = null;
let timesCache = [];
let ultimosLancamentos = [];
let estadoCronometroAtual = null;

// ------------------------------------------------------------------
// Autenticação
// ------------------------------------------------------------------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErro.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  const btn = formLogin.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Entrando...";
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    loginErro.textContent = "Não foi possível entrar. Confira e-mail e senha.";
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    telaLogin.classList.add("oculto");
    telaPainel.classList.remove("oculto");
    usuarioLabel.textContent = user.email;
    await garantirTimesPadrao();
    iniciarListeners();
  } else {
    telaPainel.classList.add("oculto");
    telaLogin.classList.remove("oculto");
  }
});

// ------------------------------------------------------------------
// Garante que os 4 times existam (idempotente — nunca zera pontos existentes)
// ------------------------------------------------------------------
async function garantirTimesPadrao() {
  for (const t of TIMES_PADRAO) {
    const ref = doc(db, COLLECTIONS.times, t.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        nome: t.nome,
        cor: t.cor,
        corClara: t.corClara,
        emoji: t.emoji,
        ordem: t.ordem,
        pontos: 0,
      });
    }
  }
}

// ------------------------------------------------------------------
// Seleção de time (cards clicáveis)
// ------------------------------------------------------------------
function renderSelecaoTimes(times) {
  timesCache = times;
  timesSelecao.innerHTML = "";
  times
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .forEach((time) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "time-selecao-card";
      card.style.setProperty("--cor-time", time.cor);
      card.dataset.id = time.id;
      card.innerHTML = `<span class="emoji">${time.emoji}</span><span>${time.nome}</span>`;
      if (time.id === timeSelecionadoId) card.classList.add("selecionado");
      card.addEventListener("click", () => {
        timeSelecionadoId = time.id;
        document
          .querySelectorAll(".time-selecao-card")
          .forEach((c) => c.classList.toggle("selecionado", c.dataset.id === timeSelecionadoId));
      });
      timesSelecao.appendChild(card);
    });

  resumoTimes.innerHTML = times
    .slice()
    .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
    .map(
      (t) =>
        `<div class="resumo-item" style="--cor-time:${t.cor}"><span>${t.emoji} ${t.nome}</span><strong>${t.pontos || 0} pts</strong></div>`
    )
    .join("");
}

// ------------------------------------------------------------------
// Atividades (gincana)
// ------------------------------------------------------------------
formNovaAtividade.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = inputNovaAtividade.value.trim();
  if (!nome) return;
  await addDoc(collection(db, COLLECTIONS.atividades), { nome, criadoEm: serverTimestamp() });
  inputNovaAtividade.value = "";
});

function renderAtividades(atividades) {
  const valorAtual = selectAtividade.value;
  selectAtividade.innerHTML = '<option value="">🎁 Pontos bônus (sem brincadeira)</option>';
  atividades.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.nome;
    opt.textContent = "🎯 " + a.nome;
    selectAtividade.appendChild(opt);
  });
  if ([...selectAtividade.options].some((o) => o.value === valorAtual)) {
    selectAtividade.value = valorAtual;
  }
}

// ------------------------------------------------------------------
// Botões rápidos de pontuação
// ------------------------------------------------------------------
botoesRapidos.forEach((btn) => {
  btn.addEventListener("click", () => {
    inputPontos.value = btn.dataset.valor;
  });
});

// ------------------------------------------------------------------
// Dar / tirar pontos (transação atômica: soma no time + grava histórico)
// sinal = +1 para dar pontos, -1 para tirar pontos
// ------------------------------------------------------------------
async function registrarPontos(sinal) {
  lancarMensagem.textContent = "";
  lancarMensagem.className = "mensagem";

  if (!timeSelecionadoId) {
    lancarMensagem.textContent = "Selecione um time primeiro.";
    lancarMensagem.classList.add("erro");
    return;
  }
  const pontos = parseInt(inputPontos.value, 10);
  if (!pontos || pontos <= 0) {
    lancarMensagem.textContent = "Informe uma quantidade de pontos válida.";
    lancarMensagem.classList.add("erro");
    return;
  }
  const atividadeNome = selectAtividade.value || "Pontos bônus";
  const timeInfo = timesCache.find((t) => t.id === timeSelecionadoId);
  const nomeTime = `${timeInfo?.emoji || ""} ${timeInfo?.nome || ""}`.trim();

  btnLancar.disabled = true;
  btnTirar.disabled = true;
  try {
    const aplicado = await lancarPontos(
      timeSelecionadoId,
      atividadeNome,
      sinal * pontos,
      auth.currentUser?.email || "admin"
    );
    if (aplicado === 0) {
      lancarMensagem.textContent = `${nomeTime} já está com 0 pontos.`;
      lancarMensagem.classList.add("erro");
    } else if (aplicado < 0) {
      const removidos = -aplicado;
      const extra = removidos < pontos ? " (chegou a 0)" : "";
      lancarMensagem.textContent = `−${removidos} pts de ${nomeTime}${extra}.`;
      lancarMensagem.classList.add("sucesso");
    } else {
      lancarMensagem.textContent = `+${aplicado} pts para ${nomeTime}! 🎉`;
      lancarMensagem.classList.add("sucesso");
    }
    inputPontos.value = "";
  } catch (err) {
    console.error(err);
    lancarMensagem.textContent = "Erro ao lançar pontos. Tente novamente.";
    lancarMensagem.classList.add("erro");
  } finally {
    btnLancar.disabled = false;
    btnTirar.disabled = false;
  }
}

formLancar.addEventListener("submit", (e) => {
  e.preventDefault();
  registrarPontos(1);
});
btnTirar.addEventListener("click", () => registrarPontos(-1));

// Aplica um delta (positivo ou negativo) ao time, sem deixar a pontuação
// ficar negativa. Retorna quantos pontos foram realmente aplicados
// (0 se não houve mudança, ex.: tirar pontos de um time já zerado).
async function lancarPontos(timeId, atividadeNome, delta, adminEmail) {
  const timeRef = doc(db, COLLECTIONS.times, timeId);
  const lancamentoRef = doc(collection(db, COLLECTIONS.lancamentos));
  let aplicado = delta;
  await runTransaction(db, async (tx) => {
    const timeSnap = await tx.get(timeRef);
    if (!timeSnap.exists()) throw new Error("Time não encontrado");
    const atual = timeSnap.data().pontos || 0;
    const novo = Math.max(0, atual + delta);
    aplicado = novo - atual;
    if (aplicado === 0) return; // nada a fazer — não grava lançamento vazio
    tx.update(timeRef, { pontos: novo });
    tx.set(lancamentoRef, {
      timeId,
      atividade: atividadeNome,
      pontos: aplicado,
      adminEmail,
      criadoEm: serverTimestamp(),
    });
  });
  return aplicado;
}

// ------------------------------------------------------------------
// Histórico de lançamentos + desfazer
// ------------------------------------------------------------------
function nomeDoTime(timeId) {
  const t = timesCache.find((x) => x.id === timeId);
  return t ? `${t.emoji} ${t.nome}` : timeId;
}

// Mostra o valor com sinal: +10 para pontos dados, −10 para pontos tirados.
function formatarPontos(pontos) {
  return pontos < 0 ? `−${Math.abs(pontos)}` : `+${pontos}`;
}

function renderUltimoLancamento() {
  const ultimo = ultimosLancamentos[0];
  if (!ultimo) {
    ultimoLancamentoBox.classList.add("oculto");
    return;
  }
  ultimoLancamentoBox.classList.remove("oculto");
  ultimoLancamentoTexto.textContent = `Último: ${nomeDoTime(ultimo.timeId)} ${formatarPontos(ultimo.pontos)} pts (${ultimo.atividade})`;
  btnCancelarUltimo.disabled = false;
}

btnCancelarUltimo.addEventListener("click", async () => {
  const ultimo = ultimosLancamentos[0];
  if (!ultimo) return;
  if (!confirm(`Cancelar o último lançamento (${nomeDoTime(ultimo.timeId)} ${formatarPontos(ultimo.pontos)} pts)?`)) return;
  btnCancelarUltimo.disabled = true;
  try {
    await desfazerLancamento(ultimo.id);
  } catch (err) {
    console.error(err);
    alert("Erro ao cancelar o último ponto.");
    btnCancelarUltimo.disabled = false;
  }
});

function renderHistorico(lancamentos) {
  ultimosLancamentos = lancamentos;
  renderUltimoLancamento();

  if (lancamentos.length === 0) {
    historicoLista.innerHTML = '<li class="historico-vazio">Nenhum ponto lançado ainda.</li>';
    return;
  }
  historicoLista.innerHTML = "";
  lancamentos.forEach((l) => {
    const li = document.createElement("li");
    const hora = l.criadoEm?.toDate ? l.criadoEm.toDate().toLocaleTimeString("pt-BR") : "--:--";
    const classePts = l.pontos < 0 ? "pts-negativo" : "";
    li.innerHTML = `
      <div class="historico-info">
        <strong>${nomeDoTime(l.timeId)}</strong>
        <span class="${classePts}">${formatarPontos(l.pontos)} pts · ${l.atividade}</span>
        <small>${hora} · ${l.adminEmail || ""}</small>
      </div>
      <button type="button" class="btn-desfazer" data-id="${l.id}" title="Desfazer">↩️</button>
    `;
    historicoLista.appendChild(li);
  });

  historicoLista.querySelectorAll(".btn-desfazer").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Desfazer este lançamento? Os pontos serão subtraídos do time.")) return;
      btn.disabled = true;
      try {
        await desfazerLancamento(btn.dataset.id);
      } catch (err) {
        console.error(err);
        alert("Erro ao desfazer lançamento.");
        btn.disabled = false;
      }
    });
  });
}

async function desfazerLancamento(lancamentoId) {
  const lancamentoRef = doc(db, COLLECTIONS.lancamentos, lancamentoId);
  await runTransaction(db, async (tx) => {
    const lancSnap = await tx.get(lancamentoRef);
    if (!lancSnap.exists()) return;
    const { timeId, pontos } = lancSnap.data();
    const timeRef = doc(db, COLLECTIONS.times, timeId);
    const timeSnap = await tx.get(timeRef);
    const atual = timeSnap.data()?.pontos || 0;
    tx.update(timeRef, { pontos: Math.max(0, atual - pontos) });
    tx.delete(lancamentoRef);
  });
}

// ------------------------------------------------------------------
// Cronômetro (estado compartilhado no Firestore, sincroniza com o placar)
// ------------------------------------------------------------------
const cronometroRef = doc(db, COLLECTIONS.cronometro, CRONOMETRO_DOC_ID);

function renderCronometro() {
  cronometroDisplay.textContent = formatarTempo(segundosRestantes(estadoCronometroAtual));
  cronometroDisplay.classList.toggle("rodando", estadoCronometroAtual?.estado === "rodando");
}
setInterval(renderCronometro, 250);

async function definirDuracaoCronometro(segundos) {
  if (!segundos || segundos <= 0) return;
  await setDoc(cronometroRef, {
    estado: "parado",
    duracaoSegundos: segundos,
    segundosRestantes: segundos,
    terminaEmMs: null,
  });
}

botoesDuracaoRapida.forEach((btn) => {
  btn.addEventListener("click", () => definirDuracaoCronometro(parseInt(btn.dataset.segundos, 10)));
});

btnCronometroDefinir.addEventListener("click", () => {
  const min = parseInt(inputCronometroMin.value, 10) || 0;
  const seg = parseInt(inputCronometroSeg.value, 10) || 0;
  definirDuracaoCronometro(min * 60 + seg);
  inputCronometroMin.value = "";
  inputCronometroSeg.value = "";
});

btnCronometroIniciar.addEventListener("click", async () => {
  const duracao = estadoCronometroAtual?.duracaoSegundos || DURACAO_PADRAO_SEGUNDOS;
  const restantes = segundosRestantes(estadoCronometroAtual) || duracao;
  await setDoc(cronometroRef, {
    estado: "rodando",
    duracaoSegundos: duracao,
    segundosRestantes: restantes,
    terminaEmMs: Date.now() + restantes * 1000,
  });
});

btnCronometroPausar.addEventListener("click", async () => {
  if (estadoCronometroAtual?.estado !== "rodando") return;
  await setDoc(cronometroRef, {
    estado: "pausado",
    duracaoSegundos: estadoCronometroAtual?.duracaoSegundos || DURACAO_PADRAO_SEGUNDOS,
    segundosRestantes: segundosRestantes(estadoCronometroAtual),
    terminaEmMs: null,
  });
});

btnCronometroReiniciar.addEventListener("click", async () => {
  const duracao = estadoCronometroAtual?.duracaoSegundos || DURACAO_PADRAO_SEGUNDOS;
  await setDoc(cronometroRef, {
    estado: "parado",
    duracaoSegundos: duracao,
    segundosRestantes: duracao,
    terminaEmMs: null,
  });
});

// ------------------------------------------------------------------
// Resetar pontuação geral
// ------------------------------------------------------------------
btnReset.addEventListener("click", async () => {
  if (!confirm("Isso vai zerar a pontuação de TODOS os times e apagar o histórico. Confirma?")) return;
  if (!confirm("Tem certeza mesmo? Essa ação não pode ser desfeita.")) return;
  btnReset.disabled = true;
  try {
    for (const t of timesCache) {
      await setDoc(doc(db, COLLECTIONS.times, t.id), { pontos: 0 }, { merge: true });
    }
    const lancSnap = await getDocs(collection(db, COLLECTIONS.lancamentos));
    await Promise.all(lancSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.error(err);
    alert("Erro ao resetar pontuação.");
  } finally {
    btnReset.disabled = false;
  }
});

// ------------------------------------------------------------------
// Listeners em tempo real
// ------------------------------------------------------------------
let listenersIniciados = false;
function iniciarListeners() {
  if (listenersIniciados) return;
  listenersIniciados = true;

  onSnapshot(collection(db, COLLECTIONS.times), (snap) => {
    const times = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSelecaoTimes(times);
  });

  onSnapshot(query(collection(db, COLLECTIONS.atividades), orderBy("criadoEm", "asc")), (snap) => {
    const atividades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAtividades(atividades);
  });

  onSnapshot(
    query(collection(db, COLLECTIONS.lancamentos), orderBy("criadoEm", "desc"), limit(30)),
    (snap) => {
      const lancamentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderHistorico(lancamentos);
    }
  );

  onSnapshot(cronometroRef, (snap) => {
    estadoCronometroAtual = snap.exists() ? snap.data() : null;
    renderCronometro();
  });
}
