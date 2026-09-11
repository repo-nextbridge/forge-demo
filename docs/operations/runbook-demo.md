# A Demo sobe assim — o runbook **desta** caixa

> **Operador.** Como a instância pública da Demo nasce, renasce e é conferida. É o runbook **da Demo**, não
> um runbook de instância: cada caixa Forge escreve o seu, e essa é justamente a liberdade que o produto
> vende. Se você opera outra instância, este documento é um **exemplar** — copie a forma, não os valores.

**O que ele é:** o **mapa** — o que fazer, em que ordem, e o que dá errado sem dizer.
**O que ele não é:** uma segunda cópia da referência de configuração. Os 144 nomes de variável, o que cada
uma faz e onde é lida vivem em `docs/reference/configuration.md` **no repositório do produto** — página
**gerada**, que este documento **aponta** e nunca duplica. Uma cópia aqui envelheceria em silêncio, que é o
defeito que este arco inteiro passou o mês pagando.

**Irmãos, para você não procurar no lugar errado:**

| documento | de quem é | do que trata |
|---|---|---|
| `README.md` (este repo) | da Demo | subir a caixa **na bancada**, e o porquê de cada peça |
| **este arquivo** | da Demo | a caixa **online**: a ordem do deploy, o que preencher, o reset semanal |
| `docs/operations/runbook-gcp.md` (produto) | da **plataforma** | a caixa de referência da Forge no GCP |
| `docs/operations/deploy-staging.md` (produto) | da **plataforma** | `main` → Staging/QA |

---

<!-- BEGIN staging-gap -->
## ⏳ Este documento está incompleto DE PROPÓSITO — leia isto antes da §2

Hoje a Demo é **uma** caixa: ela pina um release e nasce. A sequência da §2 descreve esse mundo, e **esse
mundo vai acabar**.

Quando a Demo ganhar o **staging dela** (card no roadmap do Renan, no vault — ainda **não** existe como card
no `docs/roadmap/kanban.md` do produto), a sequência ganha **um degrau novo entre o passo 3 e o passo 5**: o
release desce primeiro para o **staging da Demo**, é conferido lá, e só então desce para a caixa que o
cliente vê. O passo 4 (assar o que é da Demo) passa a acontecer duas vezes, ou uma vez e ser promovido — é
exatamente a decisão que aquele card tem de tomar, e ela **não está tomada aqui**.

⇒ Se você está lendo isto depois que aquele card foi feito e a §2 ainda tem sete passos, **a §2 está
desatualizada**, não a sua memória. `bin/runbook.guard.mjs` mantém esta seção viva: apagá-la deixa a suíte
vermelha.
<!-- END staging-gap -->

---

## 1. O que a Demo é, em uma frase

Uma instância Forge como qualquer outra — quatro imagens do produto pinadas por digest em `forge.lock`, mais
o que **é dela**: a vitrine forkada do café, o totem do balcão, dois apps próprios, dois temas, o dataset.
Nenhuma linha de kernel. `README.md` abre com essa tabela e ela continua valendo.

---

## 2. A ORDEM DO DEPLOY

Ditada pelo Renan em 04/09 e conferida contra `docs/conventions/deploy-lifecycle.md` (produto).

| # | o quê | onde | portão |
|---|---|---|---|
| 1 | a `main` do produto assa e sobe em **Staging/QA** | produto | **Portão 2** — o QA **humano** aprova |
| 2 | **corta o release**: tag `vX.Y.Z` + deploy na **Referência/Prod** | produto | **Portão 3** |
| 3 | a Demo **PINA** esse release — ⚠️ **e é aqui que o modo pré-release morre** | esta caixa | §2.1 |
| 4 | a Demo assa o que é **dela**: a vitrine do café, o totem, os apps | esta caixa | `bin/build-coffee.sh`, `bin/build-totem.sh`, `bin/pack-apps.sh` |
| 5 | a Demo **nasce** | esta caixa | `bash bin/box-up.sh` — §3 |
| 6 | **reset + reseed** | esta caixa | `bin/box-down.sh` + `bin/box-up.sh` — §5 |
| 7 | o **cron semanal** é configurado | a máquina | §5.1 |

> ⏳ O degrau que falta cai **entre o 3 e o 5** — veja o bloco acima.

### 2.1 ⚠️ O passo 3 é o que a sequência implica e ninguém tinha escrito

Hoje `forge.lock` diz `"origin": "local build"`, e os quatro digests são de imagens construídas na estação
de trabalho do Renan a partir de uma **branch**. `bin/build-local.sh:22` carrega a obrigação por escrito:

> *"THE FIRST REAL DEPLOY **RE-STAMPS IT** with registry digests. That is not a reminder, it is **part of
> that deploy's definition of done**"*

**Se o passo 3 for pulado, a Demo online roda as imagens da bancada — e nada quebra.** O pin continua sendo
por digest (`bin/images-from-lock.sh` recusa tag, e não afrouxa aqui), a caixa sobe, a loja vende. Só que
ninguém consegue reproduzir aquela caixa, porque os bytes não existem em registry nenhum.

**Como fazer o passo, e como PROVAR que foi feito:**

1. Pegue o `forge.lock` publicado com o release cortado no passo 2 e copie dele os quatro digests e o
   `forgeVersion`; **apague o bloco `provenance` inteiro**.
2. Prova, e é de uma linha só: `jq -e '.provenance // empty' forge.lock` tem de sair **vazio**, e
   `jq -r '.images[]' forge.lock` tem de listar quatro refs `@sha256:` de um registry — não do daemon local.
3. `source bin/images-from-lock.sh` e confira a linha que ele imprime: `<versão> × <composição> [apps]`.
4. Depois de `box-up`, `bash bin/verify-composition.sh` compara o que a lock **pediu** com o que o container
   **declara**.

⚠️ **`node.minMajor` viaja na lock.** É o piso de Node do release, e é o número que `bin/require-node.sh`
lê. Uma lock de release **antigo** pode não trazê-lo: a caixa então diz isso e **não inventa piso nenhum**.
Re-carimbar traz o check de volta.

---

## 3. O que preencher antes do primeiro `box-up`

### 3.1 As obrigatórias — e esta lista é **derivada**, não digitada

"Obrigatória" aqui tem uma definição operacional e só uma: **o `docker compose` desta caixa se recusa a
interpolar sem ela**. É a forma `${VAR:?mensagem}` em `compose.yml` / `compose.override.yml`, e ela para o
`up` pelo nome, antes de qualquer container subir.

`bin/runbook.guard.mjs` lê os dois compose e **reprova a suíte** se esta tabela divergir — nos dois sentidos.
Não edite as linhas à mão para "consertar" um vermelho: o compose é a fonte.

<!-- BEGIN required-env (derivado — bin/runbook.guard.mjs grada esta tabela contra compose.yml + compose.override.yml) -->
| variável | de onde vem | pode ficar vazia? |
|---|---|---|
| `DATABASE_URL` | segredo | não |
| `FORGE_ADMIN_DOMAIN` | .env | não |
| `FORGE_ADMIN_IMAGE` | forge.lock | não |
| `FORGE_ADMIN_TENANT` | .env | sim |
| `FORGE_BENCH_BIND` | .env | sim |
| `FORGE_CHECKOUT_IMAGE` | forge.lock | não |
| `FORGE_DOMAIN` | .env | não |
| `FORGE_IMAGE` | forge.lock | não |
| `FORGE_PUBLIC_ORIGIN` | .env | não |
| `FORGE_STOREFRONT_IMAGE` | forge.lock | não |
| `FORGE_TOTEM_STORE_ID` | .env | não |
| `FORGE_VAULT_KEY` | segredo | não |
| `POSTGRES_PASSWORD` | segredo | não |
<!-- END required-env -->

**Como ler a coluna do meio — obrigatória ≠ digitada por você:**

- **`forge.lock`** (4): você **nunca** digita. `source bin/images-from-lock.sh` as exporta a partir do pin.
  Inventar um valor aí é rodar uma imagem que release nenhum publicou.
- **segredo** (3): nascem no **cofre**, nunca no disco. `env-source.sh` as exporta para o shell; na bancada o
  `secret()` dele lê um `.secrets` gitignorado, e **online é aí que entra o gerenciador de segredos de
  verdade** — trocar o backend é aquela função e nenhuma outra linha.
  · `POSTGRES_PASSWORD` ← segredo `forge-postgres-password` (`env-source.sh:49`)
  · `FORGE_VAULT_KEY` ← segredo `forge-vault-key` (`env-source.sh:56`) — rotacionar re-chaveia os segredos de
    conexão dos apps; perder significa redigitar todos.
  · `DATABASE_URL` **não é digitada**: `env-source.sh:52` a monta a partir de `POSTGRES_USER` /
    `POSTGRES_PASSWORD` / `POSTGRES_DB` — as duas com default são o único par que você pode ignorar.
  ⛔ **A exceção, e ela nasceu de uma armadilha medida em 08/09:** `FORGE_REVALIDATE_SECRET` **não** vem do
  cofre — esta caixa a **cunha** (`bin/box-up.sh`, passo 3c-bis) direto no `.env`, e nada a escreve de volta.
  Na bancada as duas existiam com **valores diferentes**, e as duas estavam vivas: o `box-up` sourceia o
  `env-source.sh` e **depois** o `.env` (`bin/box-up.sh:587-589`), então os containers seguravam o do `.env`;
  quem só rodava `source env-source.sh` segurava o do `.secrets` — e o compose **prefere o valor do shell**,
  então um `docker compose up` dali colocaria um terceiro estado na caixa. Sintoma: `node bin/warm-box.mjs`
  respondendo **401** contra uma vitrine que segurava o outro. Agora o `env-source.sh` exporta o do **`.env`**
  quando ele existe e **avisa** quando o cofre discorda — apague a cópia do cofre.
- **`.env`** (6): as suas. Três são endereços e identidades (`FORGE_DOMAIN`, `FORGE_ADMIN_DOMAIN`,
  `FORGE_PUBLIC_ORIGIN`); `FORGE_TOTEM_STORE_ID` é uma armadilha — leia a §3.3(c); e as **duas** restantes o
  compose deixa VAZIAS de propósito, logo abaixo.

⚠️ **DUAS entram com `${VAR?…}`, sem os dois-pontos: têm de EXISTIR e podem ser branco.** Não é pedantismo —
é a diferença entre "você ainda não decidiu" e "você decidiu que é vazio", e nas duas o vazio *é* a
configuração:

- **`FORGE_ADMIN_TENANT`** — vazia põe o admin em **modo host** (um container servindo as duas marcas,
  resolvidas pelo hostname). Preencher "porque estava vazio" tira a caixa do modo em que ela roda. Nesse modo
  quem serve o login é a credencial de plataforma (`FORGE_ADMIN_PLATFORM_TOKEN`), não o token singular.
- **`FORGE_BENCH_BIND`** — a **interface** em que a caixa publica as cinco portas. Vazia = **todas as
  interfaces**, que é o que um *deployment* diz e é byte a byte o que esta caixa publicava antes de a
  variável existir. `.env.example` traz `127.0.0.1`, porque **toda porta desta bancada é http puro** e as
  frentes rodam `NODE_ENV=production`: o cookie sai `Secure`, e o navegador **descarta em silêncio** um
  cookie `Secure` em qualquer origem http que não seja `localhost`. Publicada na rede,
  `http://<nome-tailnet>:8200` responde **200 e perde o carrinho**; `:8201` mostra o login do admin, aceita a
  senha e volta pro `/login` com o pote vazio. `localhost` continua funcionando (é contexto seguro) e o
  `tailscale serve` também (ele termina TLS e fala com `http://127.0.0.1:<porta>`). Medido em 08/09/2026 —
  as quatro portas http respondiam 200 de fora da máquina.

### 3.2 Os segredos que **a própria caixa** cria

Nem todo segredo é seu para criar. Estes o `box-up` **minta e arquiva** via `put_secret`
(`bin/box-up.sh:377` — na bancada, no `.secrets`; online, no backend que você implementou):

| segredo | quem cria | passo |
|---|---|---|
| `forge-seed-token[-<tenant>]` | `provision-ref` | 3 |
| `forge-admin-service-token[-<tenant>]` | `provision-ref` | 3 |
| `forge-admin-platform-token` | `admin-platform-token` | 4 |

⇒ **antes do primeiro `box-up` você precisa de dois**, e só dois: `forge-postgres-password` e
`forge-vault-key`. O resto nasce durante o nascimento.

### 3.3 ⛔ As armadilhas do `.env` — cada uma medida

**(a) O `.env.example` não é a lista completa, e não tem como ser.**
Medido em 04/09: o produto lê **144** variáveis (`docs/reference/configuration.md`, gerada), das quais **7**
são "must be set" e **45** declaram default. O `.env.example` desta caixa nomeia **46** — 29 do produto e 17
que só existem aqui (portas, tailnet, totem, ritmo do seed, drivers). **115 das 144 do produto não aparecem
nele.** Quem copia o arquivo e o preenche inteiro *acha* que configurou tudo. Não configurou: configurou o
que esta caixa precisa **hoje**, que é uma coisa diferente e é a coisa certa. A lista de §3.1 é o que
**impede** a caixa de subir; o `.env.example` é o que ela **usa**; a página gerada do produto é o que o
produto **lê**. Três conjuntos, três perguntas.

**(b) Uma env pode existir, estar documentada e NÃO ser repassada pelo compose — e aí ela não faz nada sem
dizer.** É o defeito **F11**, cinco encarnações nesta caixa. O valor está certo no `.env`, o nome está certo
na doc, o processo dentro do container simplesmente nunca o recebe, e o comportamento que falta não emite
sinal nenhum: `FORGE_ADMIN_SIBLINGS` correto no arquivo e o menu de marcas renderizando **vazio**, que é
exatamente como ele renderizava antes da feature existir.
⇒ **Ao adicionar uma variável nova, o teste é de TRÊS lugares: derivada, declarada e ENTREGUE.** É a forma
que `bin/box-config.guard.mjs` já grada para o caso A44 — o segundo teste dele existe só para provar que a
variável **chega ao container** do admin.

**(c) ⛔ `FORGE_TOTEM_STORE_ID` vem VAZIO no `.env.example` e o compose recusa vazio.**
Medido em 04/09, com `docker compose config`: `${FORGE_TOTEM_STORE_ID:?…}` (`compose.override.yml:108`)
recusa uma variável **presente e em branco** com `required variable … is missing a value`. E o compose
interpola o arquivo **inteiro** a cada comando. ⇒ numa caixa virgem, `cp .env.example .env` seguido de
`bash bin/box-up.sh` **morre no passo 1** (`postgres` + `redis`), reclamando de uma variável do **totem**,
que só é conhecível no passo 6 — o id da loja do balcão é um ULID que nasce naquele momento.
**O que fazer:** antes do primeiro `box-up`, escreva o sentinela que o script já conhece —
`FORGE_TOTEM_STORE_ID=sto_PENDING_SEED`. `bin/box-up.sh:1322` o trata como "ainda não", o passo 6 resolve o
id de verdade e **reescreve o `.env`** (`:1018`), e o passo 7 sobe o totem.
⚠️⚠️ **ESSA ⚠️ ESTAVA VENCIDA E FOI MEDIDA EM 05/09.** Ela dizia *"nenhum arquivo desta caixa escreve esse
sentinela — ele só é lido"*; o `.env.example` **já o escreve** (`FORGE_TOTEM_STORE_ID=sto_PENDING_SEED`, e o
parágrafo dele explica a medição). ⇒ **a linha acima virou mecanismo**: `cp .env.example .env` já entrega o
sentinela e o passo 6 o reescreve. O que sobra de instrução é só não *apagar* a linha.

**(d) `FORGE_COFFEE_STORE_ID` — a mesma técnica, terceiro consumidor, e a única com falha SILENCIOSA.**
A vitrine do café é um **fork nosso**, então ela pode dar a **UMA** loja páginas institucionais próprias — a
vitrine de referência não pode (um `sto_…` no mapa dela seria o dado de um cliente dentro da imagem de todo
mundo). O id é o mesmo ULID que nasce a cada `box-up`, então ele **não pode ser escrito no fonte**: é
exatamente o defeito que a regra de borda do café (`caddy/extra-local/coffee.caddy`) teve, quando escrita à
mão parou de casar e **toda** requisição do café caiu na vitrine vanilla sem ninguém perceber (a página continuava com a cara
certa — o tema vem da linha da loja). O passo **3c** do `box-up`, que já gera aquela regra, agora também
escreve `FORGE_COFFEE_STORE_ID` no `.env`; o `compose.override.yml` a entrega ao container.

⚠️ **Desde 09/09 essa variável decide MAIS que as páginas institucionais: ela diz QUAL LOJA o fork é.**
`storefront-coffee/src/middleware.ts` a pergunta **antes** de resolver o host, porque a imagem é a vitrine de
**uma** loja — `/` nela é a home daquela loja, e não a da loja que o host por acaso nomeia. Medido na bancada
em 09/09, antes disso: o `FORGE_STORE_HOSTS` do próprio container do café mapeia **todo** hostname da caixa
(`localhost`, `127.0.0.1`, o nome desta máquina, o do tailnet) para a loja de **tênis**, e nenhum hostname do café
resolve coisa alguma — `read.store.by_host` dá **uma** loja por autoridade e quem a reivindica é a loja
**raiz** da caixa (`bin/store-host.mjs`). ⇒ loja errada quando o host resolve, 404 quando não resolve. Não
aparece na bancada porque a bancada tem **uma origem só**, cuja raiz é da loja de tênis; em produção cada loja
tem host próprio e `/` é a primeira coisa que o comprador abre.

⚠️ **Aqui a interpolação é MOLE (`:-`) de propósito, ao contrário da do totem.** Um totem sem loja é a loja
errada e não deve subir; uma vitrine sem essa variável é a vitrine **como era antes do eixo existir** — todas
as páginas respondem 200 (agora resolvendo a loja pelo host, como antes) e as institucionais saem com o corpo
compartilhado com a vitrine de referência. ⇒ **a ausência não tem sintoma**, e é por isso que ela é gradada
fora da caixa: `bin/coffee-store-id.guard.mjs` prova as quatro pernas de uma vez (derivada no `box-up`,
declarada no `.env.example`, entregue pelo compose, lida pelo fork) e recusa qualquer `sto_…` escrito à mão no
fonte do fork.

**(e) ⛔ `FORGE_BENCH_BIND` — a porta que responde 200 e perde o carrinho, e o silêncio é do NAVEGADOR.**
Medido em 08/09/2026, na bancada viva: `docker ps` mostrava as cinco portas em `0.0.0.0`, e
`http://<nome-tailnet>:8200/health`, `:8201/login`, `:8202/login` e `:8203/` respondiam **200** de fora da
máquina. Toda porta desta caixa é **http puro** (`caddy/Caddyfile.local` não tem TLS) e toda frente roda
`NODE_ENV=production` ⇒ `secureCookie()` é verdadeiro (kit: `cookies.ts:85`; admin: `session.ts:21`) e o
navegador **descarta em silêncio** um cookie `Secure` em qualquer origem http que não seja `localhost`.
Resultado: a loja aceita o "adicionar ao carrinho" e o carrinho volta vazio; o admin aceita a senha e volta
pro `/login` com o pote vazio. O `bin/box-up.sh` já carregava a medição em navegador dessa segunda metade.
⚠️ **E não dá para desligar o `Secure`**: `FORGE_STOREFRONT_SECURE_COOKIE` / `FORGE_ADMIN_SECURE_COOKIE` são
**opt-in** (`NODE_ENV === 'production' || … === '1'`) e esta caixa não passa nenhuma das duas a container
nenhum. A **interface** é o único lugar onde isso fecha — é a mesma espécie que a `pk23/p5` fechou na
`:3033` do produto.
**O que fazer:** nada, se você copiou o `.env.example` (ele traz `FORGE_BENCH_BIND=127.0.0.1`). Num `.env`
antigo, acrescente a linha — sem ela o compose **recusa por nome** antes do primeiro container
(`${FORGE_BENCH_BIND?…}`, sem dois-pontos). `localhost` continua por http (é contexto seguro) e o tailnet
continua inteiro pelo `tailscale serve`, que termina TLS e fala com `http://127.0.0.1:<porta>` (lido do
`tailscale serve status --json` desta máquina). Num deployment a resposta é **vazio** = todas as interfaces,
que é byte a byte o que esta caixa publicava antes da variável existir.
⚠️ **E o `--tailnet` passou a RECUSAR** quando o `tailscale serve` não publica nada e as portas estão em
loopback: o antigo "cai de volta nas portas diretas" agora seria escrever endereços que ninguém atende.

---

## 4. O nascimento

`bash bin/box-up.sh` — **um comando para digitar, quinze passos para acontecer**. A tabela dos quinze, com o
porquê da ordem de cada um, está no `README.md` ("What `bin/box-up.sh` does, in order") e não se repete aqui.
O que um operador precisa saber **antes** de rodar:

**Custo.** **19 min 17 s** para um nascimento completo, medido na corrida de 04/09 **na bancada por
`localhost`**, com os defaults e **exit 0**. Desses, **113 s** são espera de teto de rate limit — e **102 s**
são **52 chamadas** na face `ext_public` (o formulário de avaliação da PDP, 0,5/s). Sem essa face, ~17 min.
⚠️ **Esse número não inclui um passo 14 que estoura o teto.** Numa caixa **promovida**, onde o plano do
aquecedor cresce (ver abaixo), some até **15 min** de teto ao orçamento: ~34 min de janela, não 19.
**Meça a sua, não herde a minha.** ⚠️ Desde 05/09 esse teto **não** faz mais o `box-up` sair 1 — o passo 14
virou **relatório** (abaixo); ele continua custando os 15 min de relógio.
⚠️ **Se você viu "~12 min" em algum lugar, era estimativa, não medição** — o número saía da aritmética de duas
corridas, uma das quais **morreu** na fase da janela e nunca fez o passado, a janela nem a verificação. O
`README.md` carregou esse número até 04/09; foi corrigido. Prefira sempre o medido, e o que a corrida imprime
de si mesma ao que um parágrafo diz dela.
⛔ **Não exporte `FORGE_SEED_RATE_PER_SECOND=0.5`** — foi o jeito de escapar de um 429 numa noite e é o
único valor que restaura os 74 minutos curando nada: aquele botão freia a face **credential**, que nunca foi
a face que recusou. O seed avisa em voz alta se achar a variável setada.

**O que a caixa recusa, e por quê recusar é a resposta certa:**

| recusa | onde | o que ela evita |
|---|---|---|
| Node abaixo do piso do release | `bin/require-node.sh`, **antes de tudo** | uma caixa verde nascida em node não suportado — aconteceu, três vezes, e ninguém percebeu |
| `forge.lock` com imagem por **tag** | `bin/images-from-lock.sh` | o dono da tag repontar os bytes debaixo da sua instância |
| semear de um dataset que **não é o das imagens** | passo 0c, `bin/box-up.sh:1029` | 2 790 produtos de um checkout velho, caixa verde, painel de estoque nascido vazio |
| promover sem dizer **para onde** | `bin/box-up.sh:114` (o destino) e `:669` (o tailnet sem nome) | `FORGE_PUBLIC_ORIGIN=http://:8200`, que é a origem de toda URL de imagem |

**★★ pk26/d1 · O ENDEREÇO DESTA CAIXA AGORA É *DADO*, NÃO SÓ VARIÁVEL DE AMBIENTE (passo 6b).** Até aqui o
mapa host→loja vivia **só** no `FORGE_STORE_HOSTS` do `.env`, que **apenas os fronts** leem — o kernel não
sabia em que endereço esta caixa se publica, e `read.store.by_host` respondia **404 em todos os nomes**
(medido em 04/09, 08/09 e de novo hoje: `localhost`, `localhost:8200`, `127.0.0.1`, `127.0.0.1:8200`,
`ms-s1`, `ms-s1:8200`). Tudo que resolve endereço **pela porta** errava em silêncio enquanto a loja abria
perfeita: o aquecedor enchia `/s/<id>/…`, o inventário de URLs não achava a loja-raiz, e um 404 do
`store.by_host` parecia caixa quebrada.

O passo **6b** (`bin/store-host.mjs`) fecha isso: a loja que o mapa põe na **raiz** reivindica o
`FORGE_PUBLIC_ORIGIN` através de `tenant.store.update --host`, e o passo **espera a projeção** (o diretório
global é alimentado por um consumidor do relay, ~1 s depois do comando) antes de dizer que deu certo.

- **O override continua existindo, e não é uma segunda verdade.** Quem decide os endereços é o `box-up` —
  passo 3b no nascimento, a promoção depois — e ele escreve os **dois** registros; nada lê o diretório para
  escrever o mapa. O override não sai porque **uma loja reivindica UM endereço só** (a chave é única entre
  todos os tenants) e o mapa desta bancada carrega de seis a dez grafias.
- **Caixa não promovida declara `http://localhost:8200`** — que é verdade, é por-caixa, e a **promoção
  reescreve os três registros no mesmo gesto** (mapa, `FORGE_PUBLIC_ORIGIN` e diretório); `--localhost`
  desfaz. Um renascimento devolve os três ao `localhost` juntos.
- **Só a loja-raiz reivindica.** As outras três (outlet, café, balcão) são alcançadas por caminho
  (`/s/<id>/…`); reivindicar o mesmo endereço seria recusado com `host_taken`, e o campo é também a **URL
  pública** que o admin mostra em Settings ▸ General.
- **Idempotente:** rodar de novo não escreve nada se o valor já é esse. **"Ninguém reivindicou"** é recusa,
  não sucesso: o passo roda uma vez por tenant, o que **não** é dono responde `not-mine`, e zero de N mata o
  nascimento nomeando o motivo.
- **O passo 15 (`verify-config`) pergunta a mesma coisa, por conta própria** — todos os outros testes da
  seção da loja mandam `Host:` para a **borda**, então gradúam o que os **fronts** resolvem; a linha nova é a
  única que fala com o kernel. Nenhum dos dois roda o outro.

**O que a caixa PUBLICA ≠ o que ela escuta.** Quando a Demo está atrás de um `tailscale serve` (ou de
qualquer terminador de TLS), a porta que o navegador digita **não** é a porta do container. `box-up`
**lê** o que está publicado (`tailscale serve status --json`, `bin/box-up.sh:487-518`) em vez de supor.
Medido em 03/09, antes disso: o diretório tinha reivindicação para `<tailnet>:8201` (a porta interna) e
**404** para `<tailnet>:8443` (a porta que o navegador usa) — o login abria a tela e recusava o POST com
`unknown_admin_host`. **Ler nunca é configurar**: o script jamais roda `tailscale up` ou `serve`; entrar na
rede continua sendo gesto do operador.

**⚠️ O passo 14 (aquecimento) é um RELATÓRIO, não um portão — decisão do Renan em 05/09:** *"D1 - Pode ser
só relatório"*. Ele **não** faz mais o `box-up` sair 1, e a razão é que ele saía vermelho **em todo
nascimento**, por construção. Medido em 04/09, duas corridas completas pelo tailnet, mesmo resultado: o plano
do aquecedor não é feito de páginas — são ~420 páginas e ~20 400 **imagens**, descobertas do `srcset` de cada
HTML — `planned=20822`, `warmed=4964`, `15865 urls nunca visitadas`. O teto que cortava é o **default** da
**vitrine**, `DEFAULT_MAX_DURATION_MS = 15 * 60_000` (`apps/storefront/src/lib/warm/warm.ts:51`, no produto).
⚠️ Não confunda com o `--deadline-ms` **desta caixa**: esse é o prazo de **espera pela resposta**, outro
número.

**★★ E desde a pk21 esse teto DERIVA DO PLANO — decisão do Renan em 07/09:** *"deriva do plano"*. A prosa
acima dizia que a caixa "não sobrescreve" o teto da vitrine; era **falso**, e bastou abrir a rota para ver:
`/api/warm?max_duration_ms=` sobrescreve o default (`apps/storefront/src/app/api/warm/route.ts:183`). O que
faltava era um **número para mandar**, e o único honesto é derivado:
`teto = (urls PLANEJADAS + as que o passo de verify revisita) × (ms por url que a corrida MEDIU)`.
Os dois fatores saem da corrida que foi cortada — o plano que ela enumerou pela porta, e o relógio dela
dividido pelas urls que aqueceu. Como **o plano não é conhecível antes da corrida** (as páginas vêm da porta e
as imagens vêm dos **bytes** que essas páginas servem), a **primeira** corrida é a *observação* — roda no
default do produto, que passa a ser uma sondagem e não uma promessa — e a **segunda** roda no teto derivado.
Numa caixa cujo plano já cabe, a primeira não é cortada e **não existe segunda**. Deriva **uma vez** e
relata; não fica perseguindo.
📌 **O que isso NÃO conserta:** o vermelho **falso** do parágrafo seguinte. O único efeito é incidental e não
é vendido como conserto — a corrida derivada é uma **segunda visita**, feita depois, e o relatório impresso é
o da **última** corrida.
E ele também **inventava** vermelho: `failed=198` num nascimento contra `failed=0` para as mesmas urls na
caixa **ociosa** minutos depois — é a carga que o próprio aquecedor impõe a uma caixa que ainda está
assentando. ★ **Um passo sempre vermelho é um passo que as pessoas aprendem a pular**, e aí ele deixa de
valer para o dia em que estiver certo.

⛔ **Nada foi apagado nem silenciado.** O passo roda igual e agora diz **mais**: **quais** urls não
responderam (com o status ou o timeout de cada uma) e **quais nunca foram visitadas** — que é outro fato e
outro conserto. O relatório antigo dizia *"198 of 419 pages did not answer"* e **não nomeava nenhuma**.
O `box-up` imprime `⚠️ REPORT — THE BOX IS UP AND … DID NOT COME OUT FULLY WARM` e **sai 0**; se ele nem
conseguiu perguntar, imprime `⚠️ REPORT — WARMTH IS UNKNOWN FOR …`, que é outra frase.

**★★ pk25/d1 — E O RELATÓRIO PAROU DE CHAMAR DE «warm» A ÁRVORE ERRADA.** São **duas árvores de cache**: o
visitante que digita o endereço da caixa cai em `/botas/chelsea`; a corrida aquecia `/s/<id>/botas/chelsea`.
A vitrine decide isso perguntando `read.store.by_host`, que **até a pk26/d1** respondia **404 nos oito nomes**
desta caixa — o mapa host→loja vivia só no `FORGE_STORE_HOSTS` dos **fronts**, e o kernel não o enxergava.
O passo dizia isso numa linha `⚠` e terminava em `VERDICT: warm`, saída 0; ⇒ os *"95% aquecido"* de subidas
passadas eram da árvore que ninguém navega. Desde a pk25/d1 o passo lê **as duas fontes** — a porta e o
`.env` desta caixa — e, quando a caixa serve uma loja na **raiz** que a corrida aqueceu **path-scoped**, isso
é um **shortfall**: continua **não sendo portão** (o `box-up` não reprova o nascimento por calor), mas o
veredicto **não diz mais warm** e nomeia as duas árvores. ⛔ **O aquecedor não consegue fechar isso sozinho:**
quem decide o endereço é a **vitrine** (`resolveTargets` deriva a base só de `storeForOrigin` —
`apps/storefront/src/lib/warm/targets.ts:88`) e a rota `/api/warm` **não tem parâmetro de loja-raiz**.

**★★★ pk26/d1 — E O QUE FECHA É DADO, que agora o nascimento escreve: o passo 6b.** A loja-raiz reivindica o
endereço desta caixa no diretório do kernel (`tenant.store.update` → `host`), então `read.store.by_host`
responde, a vitrine dá **URLs limpas** à loja da raiz e o passo 14 aquece a árvore que o visitante navega.
⇒ **O `⚠ … did NOT come out fully warm` por causa do endereço some sozinho** numa caixa nascida depois
disto; se ele aparecer, a leitura mudou de *"a feature ainda não existe"* para **"o passo 6b não pegou nesta
caixa"** — e a linha do passo 14 diz isso com essas palavras.

⛔ **Uma metade do passo 14 continua vermelha:** uma loja que o `seed/box.json` **declara** e a caixa **não
tem** (`bin/warm-box.mjs` sai **3** → `⛔ … IS MISSING A STORE THIS REPOSITORY DECLARES`). Isso não é
aquecimento, é *"o nascimento não construiu"* — e o passo 14 é o **único** que enxerga: o 12 e o 14-bis
percorrem as lojas que a **porta reporta**, então uma loja que nunca nasceu é uma loja sobre a qual nenhum
dos dois pergunta.
⇒ **Veredicto anterior do Renan sobre a LENTIDÃO (outro assunto):** *"nascer caixa ou aquecer será feito de
madrugada. Então nada a corrigir"*. ⛔ Não abra fatia para isso.
⚠️ E enquanto o passo 14 roda, a caixa **cobra o preço**: 41% de CPU na vitrine servindo o próprio
aquecedor, e páginas a ~1,9 s pela rede (contra ~90 ms com a caixa parada). **Antes de acusar código de
lentidão, pergunte se a caixa estava nascendo.**

### 4.1 ⛔ Um nascimento VERMELHO guarda a testemunha antes que o passo seguinte a apague

**Medido no nascimento de 05/09 04:01.** O seed curado morreu em `catalog.collection.pin → HTTP 502` depois
de ~300 chamadas boas. Um 502 é a **borda** dizendo *"o upstream não me respondeu"* — quem sabe o porquê é o
**kernel**, e a mensagem manda o operador rodar `bash bin/box-up.sh --tailnet`, cuja última ação **recria**
sete serviços, o kernel entre eles. `docker inspect`, depois do fato: o container que serviu o seed nasceu
**04:01:44** e o que ficou no lugar dele, **04:02:06**. Vinte e dois segundos. E o `bin/box-down.sh` seguinte
remove os containers de vez. ⇒ **a cura que o erro receita destrói a prova.**

Hoje o `box-up` copia os logs para o **disco do host** antes disso, em dois pontos (`die()` e imediatamente
antes do recreate da promoção — a ordem é vigiada por `bin/evidence-order.guard.mjs`):

```
postmortem/2026-09-05T04-01-44Z__8-a-data-curada/
  MANIFEST.md      motivo, instante e, por container: id, QUANDO FOI CRIADO, estado, tamanho do log
  kernel.log       docker logs --timestamps, stdout E stderr
  kernel.inspect.json
```

À mão, e é o que rodar **antes de qualquer outra coisa** quando um nascimento sai vermelho por outro motivo:

```bash
node bin/capture-evidence.mjs --reason seed-red
```

⚠️ **A captura nunca muda o veredicto da corrida** — um nascimento que já falhou não melhora com uma segunda
falha em cima, e uma promoção que funcionou não pode ficar vermelha por causa de um post-mortem desnecessário.
⚠️ **E apontada para uma caixa que não existe ela ACUSA**, em vez de gravar uma pasta vazia: medido, o
`docker ps -a --filter label=…` responde **exit 0 com lista vazia** para um projeto inexistente, então a
implementação óbvia criaria um diretório de nada e diria que deu certo.
⚠️ `postmortem/` é **gitignorado** — log de container carrega token, hostname e dado de comprador.

**A mensagem do seed também deixou de calar.** Uma chamada recusada agora diz o comando, **a porta** (método
e URL), **em que ponto da sequência** (nº da chamada + o resumo por face), **quanto tempo** levou, **quem
respondeu** (`Server: Caddy` num 5xx é a borda, não o kernel) e — quando o corpo vem vazio — **diz que veio
vazio**, porque uma linha em branco e "esta ferramenta não imprime corpo" são indistinguíveis.
⚠️ **Não existe `request-id` nesta porta** (medido nas duas faces: só `content-length`, `content-type`,
`date`, `via` e os `ratelimit-*`), então a única correlação com o log do kernel é o **relógio** — por isso a
mensagem carrega um instante ISO e a captura pede `--timestamps`.

**Repetir um 5xx?** Só **leitura**, e no máximo 2 vezes. Uma escrita **não** é repetida: um 502 não diz se o
comando *rodou*. ⓘ O kernel **tem** o mecanismo — `idempotency-key` é header de toda a face de escrita
(`apps/api/src/adapter.ts:46` → `packages/core/src/dispatcher.ts:349,465`) — mas **quinze comandos o
recusam** com `validation_failed` (todos os que mintam segredo), e este seed chama um deles
(`extension.install`). Ligar isso em massa quebraria um nascimento verde num passo que nada tem a ver com
502. Fica **nomeado, não contrabandeado**.

---

## 5. O reset (passo 6) — e a promoção **entra no mesmo laço**

```bash
bash bin/box-down.sh                    # estado morre, o cache de 3,6 GB de fotos vive
bash bin/box-up.sh                      # o nascimento (localhost) — `--no-warm` se um cron for aquecer
bash bin/box-up.sh --promote tailnet    # ← a PROMOÇÃO, e a §5 inteira é sobre ela
```

★ **pk24/§B5 — a promoção deixou de ser um modo da bancada e virou um PASSO NOMEADO, com destino.** Até aqui
a única promoção que este repositório implementava era a do **tailnet**: o argumento se chamava `--tailnet`,
o hostname só podia vir de `FORGE_TAILNET_HOST` e as portas publicadas só podiam vir de
`tailscale serve status --json`. **Online não há tailnet** — e o que a caixa precisa lá é a mesma coisa: a
origem de onde todo front deriva URL de imagem, o mapa host→loja e a porta de admin de cada tenant
reivindicada **pela porta**. Então o destino agora é argumento:

| invocação | destino |
|---|---|
| `bash bin/box-up.sh --promote tailnet` | esta máquina no tailnet (lê `tailscale serve`; exige `FORGE_TAILNET_HOST`) |
| `bash bin/box-up.sh --promote demo.exemplo.com` | **qualquer endereço** em que esta caixa responda de verdade |
| `bash bin/box-up.sh --promote localhost` | a promoção desfeita — e ela **lê da própria caixa** quais nomes soltar (o mapa host→loja é o registro que a ida escreveu), então uma caixa promovida por um pipeline pode ser despromovida por um |
| `--tailnet` / `--localhost` | apelidos, mantidos: são o que todo runbook e comentário daqui digita |

★★ **pk29/D1 — e o NASCIMENTO agora diz quando a promoção ficou por fazer.** No nascimento de 09/09 tudo
ficou verde e o dono abriu `https://<tailnet>:8443/login` e viu **`?error=unknown_host`** — «This address is
not registered on this instance». Medido: `forge_control.admin_directory` tinha só `localhost:8201` e
`localhost:8202`. O mecanismo estava certo (a caixa **nasce em `localhost` por decisão**, §0b do `box-up.sh`);
o que faltava era o nascimento **dizer** que tinha ficado pela metade.

⛔ **A promoção continua NÃO sendo forçada** — nada mudou na decisão, e um nascimento local continua verde. O
que mudou é que o resumo termina com um **relatório** quando, e só quando, `tailscale serve` publica de fato
uma porta num nome que o mapa host→loja da caixa **não reivindica**:

```
[box-up] ⚠️  REPORT — THE BOX IS UP ON `localhost` AND THIS MACHINE IS PUBLISHED UNDER ANOTHER NAME.
         Read off `tailscale serve` just now, and not claimed by any tenant of this box: https://<tailnet>:8443 …
             bash bin/box-up.sh --promote tailnet
```

⚠️ **Ele é derivado dos dois lados e nunca de uma variável estar setada.** `FORGE_TAILNET_HOST` mora no `.env`
desta máquina esteja ou não algo servindo — um aviso disparado por ela apareceria em todo nascimento local e
seria aprendido como ruído em uma semana. `bin/promotion-gap.guard.mjs` roda a função de verdade e prova as
duas direções: **alta** com porta publicada e não reivindicada, **muda** em qualquer outro caso.

★★★ **pk30/§2 — e a VOLTA parou de culpar as portas por outra coisa.** Medido nesta caixa em 09/09:
`bash bin/box-up.sh --promote localhost` saiu **não-zero na primeira passada** dizendo

```
[box-up] the promotion is INCOMPLETE: 0 of 0 admin door(s) claimed. See the REFUSED line(s) above.
```

e **`0 de 0` não podia ser a causa**: na volta esses dois contadores são **zero por construção** — o laço que
os preenche está dentro do ramo da **ida** (a volta não reivindica porta nenhuma, ela **solta**). Aquela frase
era um texto fixo impresso por cima de uma falha de **outro** exame — o **endereço da loja** no diretório do
kernel — e mandava o operador ler linhas `REFUSED` que nunca foram impressas.

⇒ O veredicto agora é **derivado do destino** (`bin/promotion-verdict.mjs`), e o rigor não muda:

| destino | quantas portas de admin ele DEVE reivindicar | o que o faz vermelho |
|---|---|---|
| `tailnet` / `<hostname>` | uma por tenant × cada grafia do nome | reivindicar **menos** do que devia — continua vermelho, nomeando as portas |
| `localhost` (a volta) | **zero** — as portas de `localhost` são escritas no **nascimento**, do `seed/box.json` | o **endereço da loja** não estar no diretório |

O endereço da loja é graduado nas **duas** direções, porque as duas o movem; e fatos que não descrevem uma
promoção saem **2** (*"não deu para graduar"*), que nenhum chamador pode publicar como verde.
⚠️ **Por que isto importa mais do que parece:** `--promote localhost` é o caminho de **voltar atrás**, e um
caminho de volta que falha na primeira tentativa é o que um operador usa **com pressa, no pior momento**.

⚠️ **`--promote` sem destino RECUSA e nomeia os destinos** — nunca cai num default. Um passo que só funciona
porque alguém sabia qual variável exportar não é um passo pronto.
⚠️ **O que continua sendo fronteira, e a corrida diz em voz alta:** só o **tailnet** publica uma tabela que
esta caixa consegue ler. Num destino atrás de um balanceador/ingress/CDN as portas anunciadas são as **da
própria caixa** — se quem está na frente publica outra, é **aquele** endereço que tem de ser promovido.

⛔ **UM NASCIMENTO DES-PROMOVE O ADMIN.** Depois de `box-down` + `box-up` sem argumento, a caixa volta
**meio promovida**, e cada metade disso é código deliberado:

- o banco é destruído ⇒ o `admin_directory` volta a ter só o que `seed/box.json` reivindica —
  `localhost:8201` e `localhost:8202`;
- o passo 3b reescreve `FORGE_STORE_HOSTS` e **inclui** `$FORGE_TAILNET_HOST` ⇒ a **loja** continua
  respondendo no endereço público;
- o passo 3d reescreve `FORGE_ADMIN_SIBLINGS` de volta para `localhost`;
- `FORGE_PUBLIC_ORIGIN` e `FORGE_GATE_ADMIN_URL` não são reescritos no nascimento ⇒ continuam apontando para
  o endereço público.

⇒ **a loja abre no endereço público e o admin recusa o login com `unknown_admin_host`.**

O passo 15 (`bin/verify-config.mjs`) **acusa** isso e o `box-up` sai **vermelho** nomeando o tenant e o
hostname. O conserto é rodar a **promoção** de novo — e é por isso que a linha do reset semanal tem de
carregar `bash bin/box-up.sh --promote <destino>` depois do nascimento. **Um reset agendado sem ela perde o
admin toda madrugada de domingo.**

**A ordem do fim é `renascer → purgar a borda → aquecer → conferir`, e a intuitiva é a errada.** Uma CDN
purgada **antes** do teardown passa os ~17 minutos do nascimento se reenchendo da origem que está sendo
destruída, e sai do reset segurando exatamente aquilo que a purga existia para tirar. Os passos 13/14/15
fazem essa ordem, e `bin/reset-complete.guard.mjs` prova que o `box-up` de fato os **chama** nessa ordem e
transforma a falha deles em código de saída.

⚠️ **O prefixo órfão do bucket.** Na bancada a mídia é um volume docker que o `box-down` destrói pelo nome.
**Online um bucket não é um volume**: cada nascimento escreve ~18 500 objetos sob chaves novas e os da semana
passada **ficam** — pagos, e apontados por nada. Nada quebra; só cresce. A facilidade está **declarada** em
`seed/box.json` → `online_only` → `media-store`, com o driver em `FORGE_MEDIA_STORE_DRIVER`; enquanto esse
driver for `none`, o passo 13 imprime um no-op que **diz** que é no-op — e o lixo continua lá.

### 5.1 O cron semanal (passo 7) — as pré-condições são **medidas**, não supostas

⛔ **`0 4 * * 0 bash bin/box-up.sh` ingênuo destrói o banco e morre em seguida.**

★ **pk24/§B1 — e o nascimento agendado não precisa mais pagar o aquecimento.** `bash bin/box-up.sh --no-warm`
tira o **passo 14** e **só** ele: o 14-bis (abrir toda porta de toda loja) continua rodando, porque provar que
a caixa está de pé não é calor. O aquecedor continua chamável sozinho, que é exatamente o que um segundo cron
faz: `FORGE_SEED_TOKEN=<token de seed> node bin/warm-box.mjs --tenant <tenant> --api <origem>`.
⚠️ **O que se perde ao pular:** o passo 14 é o **único** que enxerga uma loja que `seed/box.json` declara e a
caixa não tem (12 e 14-bis andam pelas lojas que a **porta** reporta). A corrida diz isso no roteiro dela.

⚠️ **E se for chamar o aquecedor à mão, chame-o de onde a caixa está.** `bin/warm-box.mjs` aprende **qual
loja esta caixa serve na RAIZ** lendo o `.env` **desta pasta** (`--env` muda o arquivo, `--root-store` nomeia
a loja direto). Ele só usa esse arquivo se o `FORGE_PUBLIC_ORIGIN` declarado ali for **a mesma origem** que
está sendo aquecida — apontar a caixa local para uma origem remota faria o mapa de uma caixa descrever outra.
Quando ele não consegue saber, **diz que não sabe** e o veredicto deixa de ser "warm": uma corrida que não
sabe qual árvore o visitante alcança pode ter aquecido páginas que ninguém abre.

1. **Cron não tem `node`.** `env -i` com `PATH` mínimo não acha `node` nem `pnpm`; só o diretório do nvm tem
   o par compatível. Metade do nascimento são processos de host (`seed.mjs`, `verify-seed.mjs`,
   `warm-box.mjs`, `verify-config.mjs`), então a unidade **tem** de receber esse diretório no `PATH`. A
   recusa por versão de Node existe por causa desse caso: sem ela, a unidade morreria **depois** de o
   `box-down` já ter destruído o banco.
2. **Promova depois de nascer.** `bash bin/box-up.sh --promote <tailnet|localhost|hostname>` — a linha do
   cron carrega o destino, não a memória de quem escreveu o cron. Ver §5.
3. **`jq` também.** `bin/box-up.sh:344` exige — e note que `bin/require-node.sh` roda **antes** desse check e
   já depende de `jq`: numa máquina sem ele, a recusa fala de node nomeando jq.
4. **Sourceie os segredos.** A unidade precisa do mesmo `env-source.sh` (ou do backend real) exportado antes
   do `box-up`; sem `DATABASE_URL` o passo 0 morre pelo nome, que é o comportamento certo.
5. **Janela.** ~19 min de nascimento + o teto de 15 min do aquecimento — ou ~19 min secos com `--no-warm`,
   e o aquecimento numa segunda entrada de cron. Madrugada, como o dono decidiu.

---

## 6. Como conferir que deu certo — e por que a resposta é um **veredicto**, não um checklist

A forma óbvia de "religar tudo que só existe online" é uma lista de coisas para religar. **A lista é a
doença**: ela envelhece em silêncio, alguém ajusta a caixa viva e esquece de acrescentar o item, e o próximo
reset apaga aquilo sem nada dizer. Numa lista, o item esquecido é **invisível**; num veredicto, ele é **a
resposta que falta**.

| o que conferir | comando | o que ele grada |
|---|---|---|
| o **dado** | passo 12 · `bin/verify-seed.mjs` | o que a caixa **segura**, não o que mandaram construir |
| a **configuração** | passo 15 · `bin/verify-config.mjs` | o que a caixa **é** — a metade que um renascimento come |
| a **composição** | `bash bin/verify-composition.sh` | o que a lock pediu × o que o container declara |
| as **portas** | passo 14-bis | toda porta de toda loja, aberta de verdade |
| este runbook | `bash bin/test.sh` | a lista da §3.1 contra o compose, nos dois sentidos |
| a **coluna health** | `docker ps` | pk28/d2 — desde 09/09 ela é um veredicto, e não era |
| a **home do admin** | passo 12 · `bin/verify-seed.mjs`, **por tenant** | pk30/§11 — a ordem dos widgets, contra o que o dataset declara |
| os **blocos dos apps** | passo 12 · `bin/verify-seed.mjs`, **por tenant** | pk31/§6 — todo bloco que um app instalado **declara** está vivo em alguma loja |
| os **apps desta caixa nos FRONTS desta caixa** | `bash bin/test.sh` (`bin/front-app-reach.guard.mjs`) | pk32/d1 — todo componente de front que um app **nosso** declara, alcançável pelo front que tem de desenhá-lo |

★★ **pk30/§11 — a ORDEM DOS WIDGETS da home do admin, e ela era decidida pela ordem de instalação dos apps.**
Achado dele em 10/09, usando os dois admins: *"o bloco de últimas assinaturas na demo ainda está vindo no topo,
o admin de café está certo mas o de sapato está errado."* Instalar um app **auto-coloca** os widgets dele no
**fim** de `admin:admin.home.widgets` — então a posição de um widget **É** a ordem em que o app dele foi
instalado. `forgeco` instalou `subscriptions` primeiro, `forgecafe` instalou por último, e **nenhum dos dois
tinha decidido nada**: um deles calhou de bater com o que ele queria.
⇒ A ordem agora é **declarada** (`admin_widgets` do dataset montado — a mesma chave que o passo do kernel lê) e
**aplicada a TODOS os tenants** no passo 11. Essa metade nenhum one-shot conseguia fazer: `dist/seed-demo.js`
roda só para o tenant **do dataset**, então o quadro do café nunca tinha sido tocado por nada.
⚠️ O veredicto é **por tenant** e grada o **prefixo**: a cauda mantém a ordem relativa que tinha, porque
ninguém decidiu sobre ela. Uma declaração sobre um quadro **vazio** é vermelho **nomeando o tenant**, nunca uma
linha dizendo que não havia o que comparar.

★★ **pk31/§6 — OS BLOCOS DOS APPS, e a linha nova existe por causa de uma resposta ERRADA nossa, não de uma
caixa errada.** A pergunta era se o `confirmation_note` do app `subscriptions` — a frase que quem assina lê no
recibo — tinha sido colocado na demo. Respondemos **contando**: o app declara 5 blocos, o café mostrava 4,
logo faltava esse. **Medido no banco da caixa de 11/09: ele estava colocado e habilitado nas QUATRO lojas dos
dois tenants**, e o `read.extensions` o publica em `storefront:checkout.confirmation`. O 5º bloco é o
`latest_subscriptions`, que é `admin:` e nasce **uma vez por TENANT** com loja nula — 4 + 1 **é** 5.
⇒ O que faltava era **a pergunta**: os blocos default de um app são escritos pelo **kernel**
(`extension.install`), e toda outra seção do verificador grada algo que um seed **deste** repo escreve — então
ninguém nunca tinha lido essa tabela. A regra é **derivada** do próprio `read.extension_composition` (que
responde o hook declarado mesmo sem colocação) e o veredicto é **por BLOCO e por TENANT**, não por loja: *um
bloco que não está vivo em NENHUMA loja é uma capacidade que a caixa carrega e não mostra a ninguém*.
⚠️ **Por tenant de propósito**, e o Outlet é o motivo: `seed/outlet.mjs` **remove** a prateleira que o install
deixa em `storefront:list.*` (ele pediu uma PLP limpa). Isso é decisão, não defeito — e uma regra por loja
precisaria de uma **lista de exceções digitada** para se calar. "Vivo em algum lugar" não precisa de nenhuma, e
um bloco colocado em lugar nenhum continua sem conseguir se esconder.

★★★ **pk32/d1 — UM APP DESTA CAIXA SÓ APARECE NUM FRONT DESTA CAIXA SE ALGUÉM LIGAR OS DOIS, e até 11/09
nada dizia quando ninguém tinha ligado.** A UI de um app tem **duas metades**: a **declaração** (a colocação, a
composição, o config) é **dado** — atravessa a porta e chega a **qualquer** front, nosso ou dele, sem build
nenhum; a **implementação** (o componente React) tem de estar **compilada no bundle de quem desenha**. Um app de
plataforma atravessa a segunda metade porque viaja como **pacote** (`bin/vendor-packages.sh` põe o tarball
dentro do fork). Um app **desta caixa** viaja como **diretório de fonte** (`composition.json` →
`instanceApps[].source: ./apps/<id>`), então **um fork que não o nomeia não consegue importá-lo** — e um bloco
que ele não importa é um bloco que ele silenciosamente não desenha.

⇒ **O que o operador precisa saber, e são TRÊS gestos, não um.** Derivados do fork que já faz isto: o `totem/`
alcança o `apps/demo-gate` com os três, e cada um tem um jeito próprio de falhar:

| gesto | onde | o que acontece sem ele |
|---|---|---|
| 1 · a dependência | `<fork>/package.json` → `"@forge/ext-<id>": "file:../apps/<id>"` (npm instala um **symlink**) | o import não resolve; nada renderiza |
| 2 · `transpilePackages` | `<fork>/next.config.mjs` | o app viaja como `.tsx` + CSS Modules ⇒ o build morre no 1º `export type` (*"Module parse failed: Unexpected token"*) |
| 3 · `outputFileTracingRoot` | `<fork>/next.config.mjs` → `'..'` | o build passa **verde** e a **imagem** sai sem o módulo: o tracer nunca copia arquivo de cima da raiz dele |
| 4 · o registro | `<fork>/src/lib/extensions/generated/` — **GERADO** | o app está instalado e compilável e **ninguém o desenha** |

⛔ **E um tarball NÃO é o caminho** — a tentativa óbvia, medida em 11/09 e descartada: um app desta caixa escreve
as dependências no vocabulário do monorepo (`workspace:*`, `catalog:`) e `npm pack` despacha isso literal, então
instalar o tarball morre com `npm error code EUNSUPPORTEDPROTOCOL · Unsupported URL Type "workspace:"`. A
dependência de **diretório** não tem esse problema (o npm faz link e nunca resolve as specs dela) e já está
commitada e travada no `totem/package-lock.json`. ⇒ **o gêmeo front-side do `bin/pack-apps.sh` não é um script
de empacotar: não há o que empacotar.** O kernel precisa de artefato porque **lê** manifestos de um diretório
montado no boot; um front precisa de um **módulo que o bundler resolva**, e isso são as quatro linhas acima.

⚠️ **O que ainda NÃO fecha, e está dito em voz alta:** o gesto 4 é uma **superfície gerada** e **nada neste
repositório a regera** — `bin/build-coffee.sh` e `bin/build-totem.sh` não mencionam codegen, e entre os 18
tarballs de `storefront-coffee/vendor/` não há `codegen`. Então o `storefront-coffee` hoje **não alcança** o
`demo-setup` (as três marcas da loja) nem o `demo-gate` (a portaria), e as duas coisas estão **declaradas como
divergência** no topo de `bin/front-app-reach.guard.mjs`, com o motivo e quem deve a ferramenta. A divergência é
**impressa em toda rodada** e uma que deixar de casar com um achado **fica vermelha** — é por isso que ela não
consegue virar permanente em silêncio. ⛔ Soldar o import à mão **não** é o conserto: foi o que
`totem/src/lib/gate/registry.tsx` fez, e a prosa daquele arquivo já estava mentindo quando a pk31/d1 a leu.

★★ **pk28/d2 — a coluna `(healthy)` do `docker ps` ERA decoração nos dois forks desta caixa, e agora não é.**
A sonda dos dois (`totem/Dockerfile`, `storefront-coffee/Dockerfile`) descartava a resposta —
`fetch(url).then(() => process.exit(0))` — e `then` resolve para 200, 404 e **500** igualmente, então o único
jeito de o contêiner ficar vermelho era a conexão ser recusada. **Medido em 09/09 na bancada viva:**
`forge-preseed-storefront-coffee-1` esteve `health=healthy` / `FailingStreak=0` por **15 horas** enquanto o
middleware dele estourava em toda requisição — **118 stack traces em 20 min**, uma a cada ~10,2 s, que é o
`--interval` da própria sonda. Com o `Host` que a sonda usa (`curl -H 'Host: 127.0.0.1:3000'`) a resposta
medida era **HTTP 500**. ⇒ a sonda era o tráfego que **produzia** o erro e a autoridade que chamava o
contêiner de saudável.

⚠️ **E o conserto NÃO é `r.ok`.** Um `/` cru com um `Host` que loja nenhuma reivindica responde **404**
(medido no mesmo dia: `Host: cafe.localhost` → 404), então `r.ok` pintaria de vermelho um contêiner
perfeitamente saudável. A régua é a **metade do servidor**, `r.status < 500`: `200 → saudável`,
`404 → saudável`, **`500` e `503` → doente**, conexão recusada → doente. `bin/container-health.guard.mjs`
**executa** a linha real de cada Dockerfile contra um servidor local que responde cada um desses status — um
regex sozinho aprova uma comparação invertida, que se lê como conserto.

⇒ **Na prática, para quem opera:** um `(unhealthy)` nesses dois contêineres passou a querer dizer alguma
coisa — antes de 09/09, `(healthy)` ali não queria.

A regra única do passo 15 é **posse de um endereço**: *esta caixa se publica em UM endereço, e toda face que
ela declara tem de estar publicada ali*. Cada face é comparada com **o que a caixa responde** — nunca com uma
cópia do que ela deveria responder. A última checagem vira a regra contra o próprio arquivo: qualquer
`FORGE_*` que segure um endereço **desta** caixa e que a promoção **não** reescreva é **nomeada**, porque o
próximo reset a deixaria apontando para a rede em que a caixa costumava estar. Ninguém precisa ter lembrado.

⛔ **pk25/d1 — e até 08/09 esse passo era vermelho em TODA caixa https, sem culpa da caixa.** O sintoma:
`✗ localhost — claimed for sto_… and the shop answers nothing there`, em **5 dos 8** nomes, enquanto
`curl -H "Host: <cada um dos oito>" https://<origem>/` respondia **200 nos oito**. A causa não era a caixa: o
probe manda o nome reivindicado no header `Host` de propósito (é **roteamento** que ele testa), e o Node
**deriva o ServerName do TLS desse mesmo header** quando nenhum é dado — então o handshake era negociado como
«localhost» contra um certificado emitido para a borda, morria, e `req.on('error')` virava *"answers
nothing"*. Ele foi escrito e medido em 04/09 contra uma origem **http**, onde não há TLS para errar. O
conserto negocia o TLS contra a **origem** e deixa o header carregando o nome sob teste; ⚠️ **o controle
negativo continua de pé** — um nome que o mapa **não** declara volta 404 e segue **vermelho** (medido).
★ **Se você viu esses `✗` em scrollbacks antigos: eram falsos.** Online a origem é https por definição, então
o veredicto final do nascimento estava reprovando toda caixa online.

⚠️ **A sonda é `node:http`, nunca `fetch`** — o undici **descarta em silêncio** um header `host`. Medido:
`fetch(origem, {headers:{host:'nope.invalid'}})` respondeu **200** onde `node:http` respondeu **404**. Uma
sonda feita com `fetch` teria gradado todo hostname como resolvido, em toda caixa, para sempre.
