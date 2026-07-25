import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, FIREBASE_APP_NAME, COLLECTIONS, CRONOMETRO_DOC_ID } from "./firebase-config.js";
import { segundosRestantes, formatarTempo } from "./cronometro.js";

const app = initializeApp(firebaseConfig, FIREBASE_APP_NAME);
const db = getFirestore(app);

const grid = document.getElementById("times-grid");
const vazio = document.getElementById("estado-vazio");
const somToggle = document.getElementById("som-toggle");
const cronometroBox = document.getElementById("cronometro-box");
const cronometroNumero = document.getElementById("cronometro-numero");

let somLigado = true;
somToggle.addEventListener("click", () => {
  somLigado = !somLigado;
  somToggle.textContent = somLigado ? "🔊" : "🔇";
});

// ------------------------------------------------------------------
// Som de "ponto marcado" via Web Audio (sem depender de arquivo externo)
// ------------------------------------------------------------------
let audioCtx;
function tocarDing() {
  if (!somLigado) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const agora = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, agora + i * 0.09);
      gain.gain.setValueAtTime(0.0001, agora + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.25, agora + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.09 + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(agora + i * 0.09);
      osc.stop(agora + i * 0.09 + 0.4);
    });
  } catch (e) {
    /* áudio indisponível — ignora silenciosamente */
  }
}

// ------------------------------------------------------------------
// Confete (canvas simples, sem libs externas)
// ------------------------------------------------------------------
const canvas = document.getElementById("confete-canvas");
const ctx = canvas.getContext("2d");
function ajustarCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
ajustarCanvas();
window.addEventListener("resize", ajustarCanvas);

let particulas = [];
const CORES_CONFETE = ["#1E88E5", "#2E7D32", "#EF6C00", "#F9A825", "#FFFFFF", "#E91E63"];

function explodirConfete(origemX) {
  const qtd = 90;
  for (let i = 0; i < qtd; i++) {
    particulas.push({
      x: origemX,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -14 - 4,
      g: 0.35 + Math.random() * 0.15,
      cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)],
      tamanho: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.4,
      vida: 130 + Math.random() * 40,
    });
  }
}

function loopConfete() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particulas.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.rot += p.vrot;
    p.vida -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.cor;
    ctx.fillRect(-p.tamanho / 2, -p.tamanho / 2, p.tamanho, p.tamanho * 0.6);
    ctx.restore();
  });
  particulas = particulas.filter((p) => p.vida > 0 && p.y < window.innerHeight + 50);
  requestAnimationFrame(loopConfete);
}
loopConfete();

// ------------------------------------------------------------------
// Fundo animado: balões/estrelas flutuando
// ------------------------------------------------------------------
const fundo = document.getElementById("fundo-flutuante");
const EMOJIS_FUNDO = ["🎈", "⭐", "🎉", "🎊", "✨"];
function criarElementoFlutuante() {
  const el = document.createElement("div");
  el.className = "flutuante";
  el.textContent = EMOJIS_FUNDO[Math.floor(Math.random() * EMOJIS_FUNDO.length)];
  const esquerda = Math.random() * 100;
  const duracao = 12 + Math.random() * 10;
  const tamanho = 1.2 + Math.random() * 1.8;
  el.style.left = esquerda + "vw";
  el.style.fontSize = tamanho + "rem";
  el.style.animationDuration = duracao + "s";
  fundo.appendChild(el);
  setTimeout(() => el.remove(), duracao * 1000 + 500);
}
setInterval(criarElementoFlutuante, 900);
for (let i = 0; i < 8; i++) setTimeout(criarElementoFlutuante, i * 300);

// ------------------------------------------------------------------
// Placar em tempo real
// ------------------------------------------------------------------
const scoreCache = new Map(); // id -> pontos exibidos atualmente (para animação de contagem)
const cardCache = new Map(); // id -> elemento DOM

function medalhaPara(posicao) {
  if (posicao === 0) return "👑";
  if (posicao === 1) return "🥈";
  if (posicao === 2) return "🥉";
  return "";
}

function animarContagem(elSpan, de, para, duracaoMs = 900) {
  const inicio = performance.now();
  function passo(agora) {
    const t = Math.min(1, (agora - inicio) / duracaoMs);
    const easeOut = 1 - Math.pow(1 - t, 3);
    const valor = Math.round(de + (para - de) * easeOut);
    elSpan.textContent = valor;
    if (t < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

function criarCard(time) {
  const card = document.createElement("div");
  card.className = "time-card";
  card.style.setProperty("--cor-time", time.cor);
  card.style.setProperty("--cor-clara", time.corClara || time.cor);
  card.innerHTML = `
    <div class="time-medalha"></div>
    <div class="time-mascote">${time.emoji || "🏆"}</div>
    <div class="time-nome">${time.nome}</div>
    <div class="time-pontos"><span class="numero">0</span></div>
    <div class="time-barra-wrap"><div class="time-barra"></div></div>
  `;
  return card;
}

function render(times) {
  vazio.style.display = times.length === 0 ? "flex" : "none";
  grid.style.display = times.length === 0 ? "none" : "grid";

  const maxPontos = Math.max(1, ...times.map((t) => t.pontos || 0));

  times.forEach((time, posicao) => {
    let card = cardCache.get(time.id);
    if (!card) {
      card = criarCard(time);
      cardCache.set(time.id, card);
      grid.appendChild(card);
      scoreCache.set(time.id, 0);
    }

    // Reordena visualmente conforme ranking (flex/grid order)
    card.style.order = posicao;
    card.classList.toggle("lider", posicao === 0 && (time.pontos || 0) > 0);

    const nomeEl = card.querySelector(".time-nome");
    if (nomeEl.textContent !== time.nome) nomeEl.textContent = time.nome;

    const medalhaEl = card.querySelector(".time-medalha");
    medalhaEl.textContent = medalhaPara(posicao);

    const numeroEl = card.querySelector(".numero");
    const pontosAtuais = scoreCache.get(time.id) || 0;
    const novosPontos = time.pontos || 0;

    if (novosPontos !== pontosAtuais) {
      animarContagem(numeroEl, pontosAtuais, novosPontos);
      scoreCache.set(time.id, novosPontos);
      if (novosPontos > pontosAtuais) {
        card.classList.remove("pulso");
        void card.offsetWidth; // reinicia animação
        card.classList.add("pulso");
        const rect = card.getBoundingClientRect();
        explodirConfete(rect.left + rect.width / 2);
        tocarDing();
      }
    }

    const barra = card.querySelector(".time-barra");
    const pct = Math.max(4, (novosPontos / maxPontos) * 100);
    barra.style.width = pct + "%";
  });
}

// ------------------------------------------------------------------
// Cronômetro (controlado pelo admin, sincronizado em tempo real)
// ------------------------------------------------------------------
function tocarAlarme() {
  if (!somLigado) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const agora = audioCtx.currentTime;
    [700, 700, 700].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, agora + i * 0.28);
      gain.gain.setValueAtTime(0.0001, agora + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.2, agora + i * 0.28 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.28 + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(agora + i * 0.28);
      osc.stop(agora + i * 0.28 + 0.25);
    });
  } catch (e) {
    /* áudio indisponível — ignora silenciosamente */
  }
}

let estadoCronometroAtual = null;
let ultimoSegundosExibido = null;

function renderCronometro() {
  if (!estadoCronometroAtual) {
    cronometroBox.classList.add("oculto");
    return;
  }
  cronometroBox.classList.remove("oculto");
  const restantes = segundosRestantes(estadoCronometroAtual);
  cronometroNumero.textContent = formatarTempo(restantes);

  const rodando = estadoCronometroAtual.estado === "rodando";
  cronometroBox.classList.toggle("acabando", rodando && restantes > 0 && restantes <= 10);

  if (rodando && ultimoSegundosExibido > 0 && restantes === 0) {
    cronometroBox.classList.add("esgotado");
    tocarAlarme();
  }
  if (!rodando || restantes > 0) {
    cronometroBox.classList.remove("esgotado");
  }
  ultimoSegundosExibido = restantes;
}
setInterval(renderCronometro, 250);

onSnapshot(doc(db, COLLECTIONS.cronometro, CRONOMETRO_DOC_ID), (snap) => {
  estadoCronometroAtual = snap.exists() ? snap.data() : null;
  renderCronometro();
});

// Se em alguns segundos nenhum dado chegar (ex: firebase-config.js ainda com
// placeholders, ou sem internet), avisa em vez de deixar a tela em branco.
let primeiraRespostaRecebida = false;
setTimeout(() => {
  if (!primeiraRespostaRecebida) {
    vazio.style.display = "flex";
    grid.style.display = "none";
    vazio.querySelector("p").textContent =
      "Não foi possível conectar ao Firebase. Verifique as credenciais em js/firebase-config.js.";
  }
}, 7000);

const q = query(collection(db, COLLECTIONS.times), orderBy("pontos", "desc"));
onSnapshot(
  q,
  (snap) => {
    primeiraRespostaRecebida = true;
    const times = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render(times);
  },
  (erro) => {
    primeiraRespostaRecebida = true;
    console.error("Erro ao carregar placar:", erro);
    vazio.style.display = "flex";
    grid.style.display = "none";
    vazio.querySelector("p").textContent =
      "Não foi possível conectar ao Firebase. Verifique js/firebase-config.js";
  }
);
