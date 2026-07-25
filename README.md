# 2° Família em Campo — Placar da Gincana

Sistema de pontuação para a gincana do Ministério Infantil, com 4 times:
🐬 **Azul**, 🐸 **Verde**, 🦁 **Laranja** e 🐥 **Amarelo**.

- `index.html` — **placar público**, animado e em tempo real. Abra na TV/telão/projetor do evento.
- `admin.html` — **painel do admin**, com login. Só quem estiver logado consegue lançar pontos.

Feito em HTML/CSS/JS puro (sem build, sem npm) usando o SDK do Firebase direto via CDN. Os dados ficam no **Cloud Firestore**, sincronizados em tempo real entre o placar e o painel.

## Isolamento do Firebase

Este sistema reaproveita o projeto Firebase **`cadastro-final-cc77f`**, que já está em produção
com outro app (cadastro, usando Realtime Database). O placar não interfere nele:

1. **Banco de dados diferente**: o cadastro existente usa Realtime Database (`databaseURL`); este
   placar usa **Cloud Firestore** — são produtos separados dentro do mesmo projeto, sem colisão possível.
2. **App Firebase com nome próprio** (`familiaEmCampo2`) em [js/firebase-config.js](js/firebase-config.js),
   então não conflita com nenhum outro `initializeApp()` que já exista.
3. **Coleções do Firestore com prefixo próprio** (`familiaEmCampo2_times`, `familiaEmCampo2_atividades`,
   `familiaEmCampo2_lancamentos`) — isolamento extra, mesmo que futuramente algo mais use Firestore neste projeto.

As credenciais já estão preenchidas em `js/firebase-config.js`. Falta só habilitar duas coisas no
Firebase Console (uma vez só):

## Passo a passo — configurar o Firebase (uma vez só)

1. Acesse https://console.firebase.google.com/project/cadastro-final-cc77f
2. Vá em **Compilação > Firestore Database**.
   - Se ainda não existir, clique em **Criar banco de dados** → modo **produção** → região mais
     próxima (ex: `southamerica-east1`). *(Não mexe no Realtime Database que já existe — é outro produto.)*
3. Vá em **Compilação > Authentication > Sign-in method** e ative o provedor **E-mail/senha**
   (se ainda não estiver ativo).
4. Ainda em Authentication, aba **Users**, clique em **Add user** e cadastre exatamente:
   - E-mail: `admin@gmail.com`
   - Senha: `admin123`

   (Esses valores já vêm preenchidos automaticamente no formulário de `admin.html` — só falta esse
   usuário existir de verdade no Firebase para o login funcionar. Quer trocar e-mail/senha depois?
   Basta editar o usuário em Authentication > Users e também os `value=""` em `admin.html`.)
5. Em **Firestore Database > Regras**: ⚠️ **não substitua o arquivo inteiro** — copie apenas os 3
   blocos `match /familiaEmCampo2_...` de [firestore.rules](firestore.rules) e cole **dentro** das
   regras que já existem lá (se o projeto ainda não tiver nenhuma regra de Firestore, aí pode colar
   o arquivo todo). Depois publique.

Pronto — não precisa rodar `npm install` nem nenhum build. Os arquivos já importam o Firebase
direto de `https://www.gstatic.com/firebasejs/...`.

## Como rodar localmente

Como o site usa ES Modules (`<script type="module">`), abrir o `index.html` direto com duplo-clique
(`file://`) pode ser bloqueado pelo navegador. Sirva a pasta com um servidor estático simples:

```bash
npx serve .
# ou
python -m http.server 8080
```

Depois acesse `http://localhost:xxxx/index.html` (placar) e `http://localhost:xxxx/admin.html` (admin).

Para o dia do evento, o mais simples é publicar no **Firebase Hosting** (grátis, poucos comandos:
`firebase init hosting` → `firebase deploy`) ou GitHub Pages.

## Como usar no dia do evento

1. Abra `admin.html` no celular/tablet do responsável pela gincana e faça login.
2. Abra `index.html` na TV/telão — é o placar que as crianças vão acompanhar.
3. Ao final de cada brincadeira, no painel admin:
   - Toque no time que pontuou.
   - Escolha a brincadeira (ou cadastre uma nova em "Atividades da gincana").
   - Toque num valor rápido (+1/+5/+10/+20) ou digite a pontuação.
   - Toque em **"🚀 Lançar pontos"** — o placar na TV atualiza sozinho, com confete e som.
4. Errou o último lançamento? Logo abaixo do botão "Lançar pontos" aparece uma caixa
   **"Último: ..."** com o botão **"↩️ Cancelar último ponto"** — cancela só esse, sem mexer no total
   dos outros. (Dá pra desfazer qualquer lançamento antigo também, em "Últimos lançamentos".)
5. **⏱️ Cronômetro**: escolha a duração da brincadeira (1/2/3/5 min), toque em "▶️ Iniciar". O tempo
   aparece contando no telão em tempo real (`index.html`), pulsa vermelho nos últimos 10s e apita quando
   zera. "⏸️ Pausar" congela o tempo, "🔄 Reiniciar" volta para a duração escolhida.
6. Quer recomeçar do zero? Use "Zerar pontuação de todos os times" na Zona de risco (pede confirmação dupla).

## Estrutura de dados (Firestore)

- `familiaEmCampo2_times/{azul|verde|laranja|amarelo}` → `{ nome, cor, emoji, ordem, pontos }`
  (criados automaticamente no primeiro login do admin, sem zerar pontos existentes).
- `familiaEmCampo2_atividades/{id}` → `{ nome, criadoEm }`
- `familiaEmCampo2_lancamentos/{id}` → `{ timeId, atividade, pontos, adminEmail, criadoEm }`
  (histórico completo — cada lançamento soma pontos ao time via transação atômica).
- `familiaEmCampo2_cronometro/estado` → `{ estado, duracaoSegundos, segundosRestantes, terminaEmMs }`
  (documento único, compartilhado entre admin e placar em tempo real).

⚠️ Se você já colou o conteúdo antigo de `firestore.rules` no Firebase Console, precisa colar de novo
(ou só adicionar o bloco novo `match /familiaEmCampo2_cronometro/...`) para o cronômetro funcionar.

## Arquivos

```
index.html          → placar público (telão)
admin.html           → painel do admin (login + lançar pontos)
css/placar.css       → estilo do placar
css/admin.css        → estilo do painel admin
js/firebase-config.js→ credenciais do Firebase (PREENCHER)
js/cronometro.js     → cálculo compartilhado do tempo restante do cronômetro
js/placar.js         → lógica do placar em tempo real
js/admin.js          → lógica de login, lançamento de pontos, cronômetro e histórico
firestore.rules      → regras de segurança do Firestore
```
