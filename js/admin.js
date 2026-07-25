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
import { firebaseConfig, FIREBASE_APP_NAME, COLLECTIONS, TIMES_PADRAO } from "./firebase-config.js";

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
const lancarMensagem = document.getElementById("lancar-mensagem");
const historicoLista = document.getElementById("historico-lista");
const btnReset = document.getElementById("btn-reset");
const resumoTimes = document.getElementById("resumo-times");

let timeSelecionadoId = null;
let timesCache = [];

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
// Lançar pontos (transação atômica: soma no time + grava histórico)
// ------------------------------------------------------------------
formLancar.addEventListener("submit", async (e) => {
  e.preventDefault();
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

  const btnEnviar = formLancar.querySelector("button[type=submit]");
  btnEnviar.disabled = true;
  try {
    await lancarPontos(timeSelecionadoId, atividadeNome, pontos, auth.currentUser?.email || "admin");
    lancarMensagem.textContent = `+${pontos} pts para ${timeInfo?.emoji || ""} ${timeInfo?.nome || ""}! 🎉`;
    lancarMensagem.classList.add("sucesso");
    inputPontos.value = "";
  } catch (err) {
    console.error(err);
    lancarMensagem.textContent = "Erro ao lançar pontos. Tente novamente.";
    lancarMensagem.classList.add("erro");
  } finally {
    btnEnviar.disabled = false;
  }
});

async function lancarPontos(timeId, atividadeNome, pontos, adminEmail) {
  const timeRef = doc(db, COLLECTIONS.times, timeId);
  const lancamentoRef = doc(collection(db, COLLECTIONS.lancamentos));
  await runTransaction(db, async (tx) => {
    const timeSnap = await tx.get(timeRef);
    if (!timeSnap.exists()) throw new Error("Time não encontrado");
    const atual = timeSnap.data().pontos || 0;
    tx.update(timeRef, { pontos: atual + pontos });
    tx.set(lancamentoRef, {
      timeId,
      atividade: atividadeNome,
      pontos,
      adminEmail,
      criadoEm: serverTimestamp(),
    });
  });
}

// ------------------------------------------------------------------
// Histórico de lançamentos + desfazer
// ------------------------------------------------------------------
function nomeDoTime(timeId) {
  const t = timesCache.find((x) => x.id === timeId);
  return t ? `${t.emoji} ${t.nome}` : timeId;
}

function renderHistorico(lancamentos) {
  if (lancamentos.length === 0) {
    historicoLista.innerHTML = '<li class="historico-vazio">Nenhum ponto lançado ainda.</li>';
    return;
  }
  historicoLista.innerHTML = "";
  lancamentos.forEach((l) => {
    const li = document.createElement("li");
    const hora = l.criadoEm?.toDate ? l.criadoEm.toDate().toLocaleTimeString("pt-BR") : "--:--";
    li.innerHTML = `
      <div class="historico-info">
        <strong>${nomeDoTime(l.timeId)}</strong>
        <span>+${l.pontos} pts · ${l.atividade}</span>
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
    tx.update(timeRef, { pontos: atual - pontos });
    tx.delete(lancamentoRef);
  });
}

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
}
