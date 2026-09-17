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
## ⏳ O degrau entre o passo 3 e o passo 5 — o que já existe e o que ainda não

**Atualizado em 16/09 (pk43/d2): o degrau FECHOU.** Leia os três parágrafos abaixo antes da tabela da §2.

A Demo deixou de ser **uma** caixa. Ela tem duas — `stag` e `prod`, declaradas em `deploy/stag.env` e
`deploy/prod.env`. `bin/deploy.sh <env>` **entrega** a caixa numa delas e `bin/birth-remote.sh <env>` a faz
**nascer** lá. O pin desce primeiro para o **stag da Demo**, é conferido lá, e o **mesmo lock** desce para o
prod. O passo 4 (assar o que é dela) acontece **uma vez**: as imagens viajam por digest, e é o mesmo byte que
sobe nas duas.

⛔⛔ **E SÃO DOIS GESTOS PORQUE NASCER É DESTRUTIVO E UM DEPLOY NÃO PODE NASCER.** `bin/deploy.sh` roda a cada
adoção de pin. Semear é reset+seed por natureza — `bin/seed.mjs` reescreve os ajustes que toda tela herda,
`dist/seed-history.js` refaz um passado ou recusa um, `seed-box.mjs` reaplica o que `seed/box.json` declara
por cima do que a caixa viva virou. ⇒ **se o deploy semeasse, toda subida de versão apagaria a loja.** Por
isso o nascimento tem arquivo próprio, e `bash bin/deploy.sh <env> --birth` é a única passagem de um para o
outro — uma bandeira que se digita, nunca uma inferência de "a caixa parece vazia".
`bin/birth-remote.guard.mjs` prova o negativo: um deploy sem a bandeira, contra uma caixa que TEM dado, não
alcança nenhum gesto que escreva.

⚠️ **O que continua sendo verdade:** `bin/box-up.sh` é o nascimento da **bancada** e não mudou uma linha. Os
dois nascimentos declaram a **mesma lista de passos** e um guard os prende um ao outro — um passo que a
bancada ganhar e a caixa remota não é um passo que a caixa implantada nunca receberia, e nada mais neste
repositório diria isso, porque os dois nunca rodam na mesma máquina.
<!-- END staging-gap -->

---

## 1. O que a Demo é, em uma frase

Uma instância Forge como qualquer outra — quatro imagens do produto pinadas por digest em `forge.lock`, mais
o que **é dela**: a vitrine forkada do café, o totem do balcão, dois apps próprios, dois temas, o dataset.
Nenhuma linha de kernel. `README.md` abre com essa tabela e ela continua valendo.

---

## 2. A ORDEM DO DEPLOY

**Doutrina do produto**, conferida linha a linha contra `docs/conventions/deploy-lifecycle.md` (produto) —
esta tabela não a inventa, ela a espelha.

| # | o quê | onde | portão |
|---|---|---|---|
| 1 | a `main` do produto assa e sobe em **Staging/QA** | produto | **Portão 2** — o QA **humano** aprova |
| 2 | **corta o release**: tag `vX.Y.Z` + deploy na **Referência/Prod** | produto | **Portão 3** |
| 3 | a Demo **PINA** esse release — ⚠️ **e é aqui que o modo pré-release morre** | esta caixa | §2.1 |
| 4 | a Demo assa o que é **dela**: a vitrine do café, o totem, os apps | esta caixa | `bin/build-coffee.sh`, `bin/build-totem.sh`, `bin/pack-apps.sh` |
| 4b | a Demo **desce para o `stag` dela**, e depois para o `prod` com o MESMO lock | as duas VMs | `bash bin/deploy.sh stag` · `bash bin/deploy.sh prod` — §2.2 |
| 5 | a Demo **nasce** | a bancada **ou** a VM | bancada: `bash bin/box-up.sh` — §3 · VM: `bash bin/birth-remote.sh <env>` — §2.3 |
| 6 | **reset + reseed** | esta caixa | `bin/box-down.sh` + `bin/box-up.sh` — §5 |
| 7 | o **ciclo agendado** é configurado | a máquina | §5.1 e `docs/operations/reset-cycle.md` |

> ⏳ O degrau que faltava caía **entre o 3 e o 5** — veja o bloco acima. Uma metade é o passo 4b (o deploy);
> a outra é o passo 5 numa VM, que agora é `bin/birth-remote.sh`. ⛔ São dois gestos de propósito.

### 2.2 O deploy — `bin/deploy.sh <env>`

```bash
bash bin/deploy.sh stag --plan     # diz tudo o que faria; não toca em nada no host
bash bin/deploy.sh stag            # faz
bash bin/deploy.sh prod            # o mesmo lock, depois que o stag provou
```

**Não há um segundo compose.** `compose.yml` + `compose.override.yml` **são** a pilha de implantação: cada
coisa de bancada neles é uma VARIÁVEL e não uma linha (`FORGE_CADDYFILE` escolhe a borda — a de produção é o
default —, `FORGE_BENCH_BIND` escolhe a interface, e o coletor de e-mail está atrás de `profiles:`). O que
muda é o `.env`, e é por isso que `deploy/` guarda pedaços de `.env` e não um compose.

O `.env` da caixa tem **dois autores**: `deploy/box.env` + `deploy/<env>.env` dizem o que o DEPLOY decide, e
o que só a caixa sabe (ids de loja, mapa de host, lista de irmãos — o que um nascimento escreve) é
**carregado intacto**. A regra é mecânica: chave que os dois arquivos de `deploy/` DECLARAM é escrita pelo
deploy; chave que só a caixa tem fica como está. Nada digita uma lista de "chaves derivadas", porque uma
lista digitada é a lista à qual falta a chave que a próxima fatia acrescenta.

⚠️ **A cerca roda ANTES de qualquer gesto remoto.** `forge-lock-provenance` (do produto) compara a lista de
composição desta instância com a procedência que o `forge.lock` declara por imagem; uma superfície pinada
como `release` que precise compilar um app desta caixa é uma RECUSA — e não existe jeito de pular.
Detalhe em `README.md` §7.

### 2.3 O nascimento remoto — `bin/birth-remote.sh <env>`

```bash
bash bin/birth-remote.sh stag --plan      # o roteiro dos passos; não toca na caixa
bash bin/birth-remote.sh stag             # nasce
bash bin/birth-remote.sh stag --no-warm   # o mesmo sem o passo 14 (aquecer é RELATO, nunca portão)
bash bin/birth-remote.sh stag --again     # uma caixa que JÁ nasceu aqui — leia a recusa antes
bash bin/deploy.sh stag --birth           # entrega, sobe E nasce, num gesto só
```

**Ele atravessa os mesmos quinze passos do `bin/box-up.sh`, por dois veículos.** Os one-shots que são
entrypoints da IMAGEM do kernel (`migrate`, `provision-ref`, `admin-platform-token`, `bulk-read-token`,
`seed-demo`, `seed-history`) cruzam por `remote_compose` — o `ssh` que `bin/deploy.sh` já usava, agora com um
autor só em `bin/remote-box.sh`. Todo o resto é um `bin/*.mjs` deste repositório que recebe `--api <origem>`
e uma credencial, e roda **aqui**, no node do operador, contra a origem pública da caixa por https. Não é
postura nova: é o que `--api` sempre quis dizer — e é por isso que **a caixa não precisa de node** (medido
16/09: `forge-demo-stag` não tem nenhum).

⚠️ **Duas coisas diferem da bancada, e as duas são medição e não gosto:**

- **O espaço de endereços.** A bancada é UM host (`localhost`) com seis PORTAS; uma caixa implantada são
  SEIS HOSTNAMES. `bin/deployed-faces.mjs` junta as duas metades — `seed/box.json` diz qual VARIÁVEL carrega
  cada face (`domain.env`, `admin_domain.env`), `deploy/<env>.env` diz quanto essa variável vale nesta caixa
  — e **cada loja reivindica o próprio hostname** no diretório do kernel (passo 6b), em vez de uma loja
  reivindicar a caixa. Uma face sem endereço neste ambiente é uma **RECUSA** antes de qualquer escrita: o
  site block dela em `caddy/Caddyfile` ficaria no sentinela `.unset.localhost`, cinco faces serviriam e uma
  loja simplesmente não estaria na internet, sem nada em log nenhum.
- **O passo 3c é PULADO, declarado, com a razão.** Numa caixa implantada o café é roteado por HOSTNAME:
  `caddy/Caddyfile` já tem site block para `{$FORGE_CAFE_DOMAIN}`. O fragmento que o 3c escreve na bancada só
  é lido por `caddy/Caddyfile.local`, e o `Caddyfile` de produção importa `extra/*.caddy` em nível TOP, onde
  um arquivo tem de ser um SITE BLOCK — foi assim que `caddy validate` respondeu `parsed 'handle' as a site
  address` uma vez, o que não é um host extra quebrado e sim uma **BORDA MORTA**. A metade do passo que é
  sobre a caixa (o `FORGE_COFFEE_STORE_ID`) continua rodando.

⛔ **Um passo que falha INTERROMPE o nascimento.** Não há "avisa e segue": a caixa não é entregue
meio-semeada. Medido na primeira corrida contra o stag — o passo 5 recusou e a corrida parou ali, sem migrar
nada além do que já estava feito.

### 2.1 ⚠️ O passo 3 é o que a sequência implica e ninguém tinha escrito

Hoje `forge.lock` diz `"origin": "local build"`, e os quatro digests são de imagens construídas **numa
estação de trabalho**, a partir de uma **branch** — nunca por um registry. `bin/build-local.sh:22` carrega a
obrigação por escrito:

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

### 3.1-bis ★★★ AS SEIS URLS DESTA DEMO — onde cada uma mora, e o que acontece se você esquecer uma

Os endereços desta demo foram fixados em **12/09** — e são **seis**:

| endereço | o que serve | variável |
|---|---|---|
| `store.forgecommerce.pro` | vitrine + checkout da loja `forge` (T1) | `FORGE_DOMAIN` |
| `outlet.store.forgecommerce.pro` | vitrine + checkout da loja `outlet` (T1) | `FORGE_OUTLET_DOMAIN` |
| `admin.store.forgecommerce.pro` | admin do tenant `forgeco` | `FORGE_ADMIN_DOMAIN` |
| `cafe.forgecommerce.pro` | o **fork** `storefront-coffee` + o nosso checkout | `FORGE_CAFE_DOMAIN` |
| `totem.cafe.forgecommerce.pro` | o totem do balcão | `FORGE_TOTEM_DOMAIN` |
| `admin.cafe.forgecommerce.pro` | admin do tenant `forgecafe` | `FORGE_CAFE_ADMIN_DOMAIN` |

⛔ **A tabela acima não é digitada aqui como verdade — ela é `seed/box.json`.** Cada loja declara um
`domain` e cada tenant um `admin_domain`, porque **um hostname é DADO**: é a coluna `host` em que o kernel
chaveia o seu diretório. O `caddy/Caddyfile` decide a outra metade — **qual container** responde naquele
hostname — e `bin/box-domains.guard.mjs` grada o par nos **dois sentidos**, mais a terceira ponta que
ninguém tinha: o compose precisa **entregar** cada variável ao container do edge.

⚠️ **A bancada não nomeia nenhuma delas e nada muda.** A caixa nasce em `localhost` (§0b) e a promoção é um
passo **nomeado**; a bancada usa `caddy/Caddyfile.local`, que não sabe o que é hostname.

★★★ **E um deployment também não as digita — a PROMOÇÃO as escreve (pk35/d4).**
`bash bin/box-up.sh --promote store.forgecommerce.pro` (ou qualquer um dos seis nomes acima) escreve **as
seis** a partir do `seed/box.json`. Até esta fatia **ninguém escrevia o valor**: a promoção reescrevia quatro
variáveis (`FORGE_STORE_HOSTS`, `FORGE_PUBLIC_ORIGIN`, `FORGE_GATE_ADMIN_URLS`, `FORGE_ADMIN_SIBLINGS`) e
**nenhuma** das seis — então uma implantação preenchia à mão, ao lado de um arquivo que já as declarava.
Detalhes em `bin/promotion-faces.mjs`, e a §5 tem a tabela dos três estados.

⛔⛔ **E uma esquecida NÃO derruba mais a caixa — ela derrubava.** Medido em 12/09 na bancada viva:
`docker inspect …-caddy-1` mostrava **três** variáveis `FORGE_*` no container do edge, e
`FORGE_TOTEM_DOMAIN` **não estava entre elas** — o `{$FORGE_TOTEM_DOMAIN}` do `caddy/Caddyfile` resolvia
para **string vazia**, e endereço de site vazio não é host faltando, é arquivo que não carrega:

```
caddy validate → Error: adapting config using caddyfile: server block without any key is global
                        configuration, and if used, it must be first
```

`./caddy/Caddyfile` é o **default** do compose, então o edge de um deployment desta instância **não subia**:
loja, checkout e admin caídos juntos. Agora cada endereço carrega um sentinela `<algo>.unset.localhost` —
medido com `caddy:2` v2.11.4, um nome `.localhost` é emitido pela **CA interna** do Caddy (`issuer:"local"`,
11 ms, **zero** pedido ACME) — em **compose e Caddyfile ao mesmo tempo**, porque o `{$VAR:fallback}` do Caddy
**não dispara** para variável presente-e-vazia (também medido). ⇒ esquecer uma custa **uma face** num nome
que não resolve, e o passo 15 (`bin/verify-config.mjs`) **diz qual**.

---

### 3.2 Os segredos que **a própria caixa** cria

Nem todo segredo é seu para criar. Estes o `box-up` **minta e arquiva** via `put_secret`
(`bin/box-up.sh:377` — na bancada, no `.secrets`; online, no backend que você implementou):

| segredo | quem cria | passo |
|---|---|---|
| `forge-operator-token[-<tenant>]` | `provision-ref` | 3 |
| `forge-admin-service-token[-<tenant>]` | `provision-ref` | 3 |
| `forge-admin-platform-token` | `admin-platform-token` | 4 |
| `forge-admin-access-key[-<tenant>]` | `bin/admin-access-key.mjs` (pela porta) | 5b |

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

**⚠️ O passo 14 (aquecimento) é um RELATÓRIO, não um portão, e isso é desenho.** Ele **não**
faz mais o `box-up` sair 1, e a razão é que ele saía vermelho **em todo nascimento**, por construção. Medido em 04/09, duas corridas completas pelo tailnet, mesmo resultado: o plano
do aquecedor não é feito de páginas — são ~420 páginas e ~20 400 **imagens**, descobertas do `srcset` de cada
HTML — `planned=20822`, `warmed=4964`, `15865 urls nunca visitadas`. O teto que cortava é o **default** da
**vitrine**, `DEFAULT_MAX_DURATION_MS = 15 * 60_000` (`apps/storefront/src/lib/warm/warm.ts`, no produto —
**removido na pk35/p1**). ⚠️ Não confunda com o `--deadline-ms` **desta caixa**: esse é o prazo de **espera
pela resposta**, outro número.

**⛔⛔ E NA pk35 O TETO DERIVADO VIROU O DEFEITO.** No nascimento de 13/09 o número derivado saiu
`4 034 947 ms` e cortou o `outlet` em **879/1 224** imagens com `failed=0` e `busy=0` — caixa **saudável**,
enchendo o cache de derivadas a ~330 imagens/min. **Um teto que cresce com o plano continua sendo um teto com
número de TAMANHO dentro**, a forma proibida nesta casa desde 11/09: *limite por PROGRESSO; o relógio é rede,
nunca juiz.* A `pk35/p1` moveu o juiz para o **produto** — janela de **não-progresso**
(`apps/storefront/src/lib/warm/limit.ts`), `max_duration_ms` virou **rede opcional**, e a corrida passou a
publicar `report.stoppedBecause` (`finished` · `no-progress` · `safety-net`). ⇒ **o passo 14 parou de mandar
teto.**
⚠️ **Com UMA exceção MEDIDA:** esta caixa pina as frentes **por digest**, e a vitrine pinada hoje compila
`max_duration_ms")??9e5` na rota e **não** carrega `stoppedBecause` (medido na bancada, 13/09). Imagem que não
sabe dizer como parou é imagem que **não consegue se limitar por progresso** — está num relógio de qualquer
jeito, e um teto derivado é maior que os 900 000 ms dela. Então a derivação **sobrevive exatamente ali**, e o
relatório diz que é isso que está fazendo. ⛔ Quem decide é o **campo**, nunca o `skipped`.
⚠️ **E onde ela sobrevive, sobrevive como REDE.** A versão do tamanho-do-juiz desse número é justamente o que
cortou o outlet: `4 034 947 ms` contra um plano final de `planned=22047` que, ao custo de 180–200 ms/url que a
própria corrida mediu, precisava de **4 043 880–4 493 200 ms** — curto em 0,2–11%. Não podia ser diferente: o
plano observado é um **piso** (corrida cortada dentro da passada de PÁGINAS nunca vê as imagens que aquelas
páginas declarariam). Então o teto que sobrevive **folga uma ordem de grandeza** sobre o trabalho medido
(`NET_HEADROOM`) e é **nomeado** rede — múltiplo de uma medição, nunca número de tamanho.
★ E `stoppedBecause` tem **quatro** leituras, não três: **ausente** é *"esta corrida não pode dizer"* — nunca
`finished`. É a mesma régua que a coluna `busy` já obedece.

**★★ A derivação da pk21 (história, e ainda viva na exceção acima): o teto DERIVA DO PLANO, e essa derivação
é deliberada — não é efeito colateral de implementação.** A prosa antiga dizia que a caixa "não sobrescreve"
o teto da vitrine; era **falso**, e
bastou abrir a rota para ver: `/api/warm?max_duration_ms=` sobrescrevia o default (`apps/storefront/src/app/api/warm/route.ts`,
no bloco `parse`). O que
faltava era um **número para mandar**, e o único honesto é derivado:
`teto = (urls PLANEJADAS + as que o passo de verify revisita) × (ms por url que a corrida MEDIU)`.
Os dois fatores saem da corrida que foi cortada — o plano que ela enumerou pela porta, e o relógio dela
dividido pelas urls que aqueceu. Como **o plano não é conhecível antes da corrida** (as páginas vêm da porta e
as imagens vêm dos **bytes** que essas páginas servem), a **primeira** corrida é a *observação* — roda **sem
teto nenhum**, no limite com que o próprio produto se segura — e a **segunda**, só numa imagem pré-p1, roda no
teto derivado.
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
⇒ **A LENTIDÃO já tem veredicto, e é outro assunto:** nascer caixa e aquecer são trabalho de **madrugada**, e
sendo de madrugada não há o que corrigir. ⛔ Não abra fatia para isso.
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

### 4.2 ★★★ O passo da janela **espera o correio alcançar** antes de religar o e-mail do comprador — e o que fazer quando ele desiste

**Medido no nascimento de 10/09, e é a causa do «ESGOTADO» com estoque.** A caixa se declarou nascida
(roteiro com 24 ✓, 16 portas provadas, `verify-config: settled`) e a face interna respondeu **129 907 eventos
por entregar** em `forgeco` — `inventory.availability`, que é justamente o consumidor que decide se o card diz
ESGOTADO, devia **57 003**. A velocidade inicial era **29 eventos/min**: ~**12 horas** de loja mentindo.

**A cadeia, medida:** o seed silencia o e-mail do comprador **antes** do passado (fase 8) e religa **depois** da
janela (fase 11) — correto. O que ninguém tinha visto é que *a cerca depende do relógio*: o kernel decide
`channel_disabled` **quando o consumidor roda** (`packages/core/src/notification/dispatch.ts:393`), não quando o
evento entra no outbox. Com a fila funda, o religar chegou **antes** de o consumidor alcançar os 180 dias de
histórico ⇒ a caixa passou a tentar mandar pedidos fictícios para endereços `@example.com` e o provedor recusou
**56 de cada 67 com `550`**. Como o ciclo do relay é **serial**, cada envio lento atrasava **todo** consumidor:
com o canal calado, as projeções foram a **2 150/min** e a fila drenou em **24 min** em vez de 12 h.

⇒ **Desde a pk32/d3 o passo da janela pergunta antes de religar.** Ele consulta `read.relay_depth` (face
interna, pk31/p1) e espera **só o consumidor `notification.send`** — nunca `settled`, que somaria as 57 003 do
estoque e esperaria as mesmas 12 horas. Orçamento **10 min** (300 × 2 s), com uma linha de progresso a cada
30 s. O que você vê no log, e o que cada linha quer dizer:

| linha | significado | o que fazer |
|---|---|---|
| `notification.send caught up after Ns (0 owed, …)` | a cerca valeu até o fim | nada |
| `still waiting on notification.send after Ns: state=draining, remaining=N` | está alcançando; `N` encolhe | deixar correr |
| `nothing left it can deliver: N delivery(ies) are in the dead letter` | o provedor recusou `N` envios (os `@example.com`) e ninguém vai refazê-los | nada — não é caixa ociosa, é recusa do provedor |
| `⛔ the 600s budget ran out and notification.send is NOT caught up` | **o religar aconteceu com eventos ainda na fila**: aqueles **vão** ser despachados com o canal armado | ler a próxima linha |
| `⚠️ this kernel does not publish read.relay_depth` | a imagem pinada é anterior à pk31/p1 | pinar um kernel que a carregue — a cerca voltou a ser cega |
| `⚠️ read.relay_depth answered without a notification.send consumer` | o kernel renomeou o consumidor | é defeito de produto, não da caixa: relatar |

⛔ **Quando o orçamento estoura, a caixa NÃO fica muda** — o religar acontece de todo jeito, porque uma caixa
muda é a pior das duas falhas (ninguém recebe nada e ninguém nota por um dia). O que muda é que a linha acima
existe: se ela apareceu, **houve exposição** e ela está nomeada. Numa bancada com destinatários fictícios isso
é inofensivo; numa caixa com e-mail real de alguém, não é, e a resposta é **parar e avisar**, não subir o teto.

📌 **E isto é rede de segurança, não o conserto.** O conserto é o kernel saber **REGISTRAR** um pedido em vez de
**colocar** um — conserto de **produto**, já decidido e ainda não feito: os pedidos do passado são
colocações de verdade —
`apps/api/src/seed-history.ts` dirige a porta (`checkout.place_order`, `order.mark_paid`, …) e só as **datas**
são ficção — então eles realmente merecem confirmação. Quando o **ato** carregar o fato *"isto já aconteceu,
noutro sistema, noutro mês"*, cada consumidor deriva a própria resposta **do evento** e a resposta deixa de
depender de **quando** alguém pergunta. Aí esta espera é jogada fora sem dor.

## 5. O reset (passo 6) — e a promoção **entra no mesmo laço**

```bash
bash bin/box-down.sh                    # estado morre, o cache de 3,6 GB de fotos vive
bash bin/box-up.sh --no-warm            # o nascimento (localhost), sem o passo 14
bash bin/box-up.sh --promote tailnet    # ← a PROMOÇÃO, e a §5 inteira é sobre ela
bash bin/box-up.sh --warm-only          # o aquecimento, já no endereço promovido
```

★ **Os quatro acima, em ordem, são UM comando: `bash bin/box-cycle.sh --promote <destino>`** — com lock, log
por corrida e política de saída. É o passo 7, e a página dele é `docs/operations/reset-cycle.md`. Ele existe
porque **a ordem é a decisão**: as duas linhas do meio são obrigatórias (um nascimento des-promove o admin) e
a última só vale depois da promoção (a promoção recria todo front, então calor tomado antes morre com o
contêiner).

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
ficou verde e `https://<tailnet>:8443/login` respondia **`?error=unknown_host`** — «This address is
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

### 5-bis ★★★ pk35/d4 — a promoção escreve **as seis faces do edge**, e o destino decide se há o que escrever

`bin/promotion-faces.mjs` deriva as seis do `seed/box.json` e o `box-up` as escreve junto com as outras
quatro. **Nenhum endereço é digitado em lugar nenhum** — o arquivo já os tem. São **três** estados, e são os
mesmos que o passo 15 (`bin/verify-config.mjs`) já gradua:

| o destino da promoção | o que acontece com as seis |
|---|---|
| **é uma das faces declaradas** (`store.forgecommerce.pro`, …) | esta promoção **é** a implantação que o `seed/box.json` descreve ⇒ **as seis** são escritas, do arquivo, numa passada |
| **é outro endereço** (tailnet, laptop, staging) | **nenhuma** é escrita, e a corrida **diz isso por extenso**: aqueles hostnames não são endereços em que esta caixa responde, e escrevê-los publicaria nome que não roteia e daria seis faces "publicadas" para o passo 15 reprovar |
| **a caixa não declara face nenhuma** | é uma **bancada**: nada a escrever, e isso **não** é falha — o mapa host→loja, a origem e as portas de admin **são** a promoção; as faces são o **edge** |

⛔ **E uma face que o edge LÊ e o `seed/box.json` não declara é RECUSA, nunca sentinela em silêncio.** Se o
`caddy/Caddyfile` tem bloco para `{$FORGE_OUTLET_DOMAIN}` e nenhuma loja declara essa variável, escrever as
outras cinco deixaria essa numa `outlet.unset.localhost`: o edge carrega, cinco faces servem, e uma loja
responde num nome que não resolve **sem uma linha em log nenhum**. A promoção para e **nomeia a variável, a
sentinela e a linha do Caddyfile** — e para **antes** da primeira escrita, então a caixa recusada é byte a
byte a caixa que rodou o comando.

⚠️ **A VOLTA (`--promote localhost`) não desfaz as seis, e diz quais está deixando.** As duas desfeitas
óbvias estão medidas mortas: esvaziar é **recusado pelo próprio compose** (`${FORGE_DOMAIN:?…}` rejeita
variável presente-e-vazia) e apontar as seis para `localhost` é **endereço de site duplicado**, que não
degrada uma face — derruba o arquivo inteiro (loja, checkout e admin juntos).

★★ **E o que faz qualquer uma dessas escritas CHEGAR num contêiner (achado da fatia).** Medido na bancada
viva em 13/09: o `.env` dizia `FORGE_ADMIN_SIBLINGS='[…"https://<tailnet>:8443"…]'` e o contêiner do admin,
recriado **10 s depois** pelo próprio `--force-recreate` da promoção, dizia `[…"http://localhost:8201"…]` — o
valor da geração anterior. **A causa não é ordem de recriação:** o `box-up` faz `set -a; . .env` no passo 0,
então todo valor do arquivo fica **exportado** naquele shell, e o compose prefere o **ambiente** ao `.env`
(medido com um projeto descartável: `docker compose config` responde `from-dotenv` sem export e `from-shell`
com export). ⇒ `put_env` agora escreve o arquivo **e exporta no shell que está rodando**, tirando as aspas
simples exatamente como os dois leitores do `.env` tiram.

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
- o passo 3d reescreve `FORGE_ADMIN_SIBLINGS` **e `FORGE_GATE_ADMIN_URLS`** de volta para `localhost`;
- `FORGE_PUBLIC_ORIGIN` não é reescrito no nascimento ⇒ continua apontando para o endereço público.

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

### 5.1 O ciclo agendado (passo 7) — as pré-condições são **medidas**, não supostas

📄 **A página é `docs/operations/reset-cycle.md`**: o que o ciclo é, o que destrói, o que preserva, a política
de saída e os exemplos de crontab/systemd. O que fica aqui são as pré-condições da **máquina**.

⛔ **`0 4 * * 0 bash bin/box-up.sh` ingênuo destrói o banco e morre em seguida.**
⛔ **E dois agendamentos — "03:00 reseta, 04:00 aquece" — são piores que um.** Relógio não é dependência: numa
noite em que o seed demorar mais, o segundo dispara contra uma caixa ainda semeando, aquece nada e reporta
verde. É **um** script e **um** agendamento: `bash bin/box-cycle.sh --promote <destino>`.

★ **pk24/§B1 — e o nascimento agendado não precisa mais pagar o aquecimento no meio.** `bash bin/box-up.sh
--no-warm` tira o **passo 14** e **só** ele: o 14-bis (abrir toda porta de toda loja) continua rodando, porque
provar que a caixa está de pé não é calor. O aquecimento vem depois, **já promovido**, por
`bash bin/box-up.sh --warm-only` — que é o mesmo laço por tenant do passo 14, e não uma segunda cópia dele. O
aquecedor também continua chamável sozinho:
`FORGE_OPERATOR_TOKEN=<token de seed> node bin/warm-box.mjs --tenant <tenant> --api <origem>`.
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
   agendador carrega o destino, não a memória de quem a escreveu; o ciclo **recusa dizendo** se não souber
   para onde promover, e *"sem destino"* é um modo declarado (`--no-promote`), não uma omissão. Ver §5.
3. **`jq` também.** `bin/box-up.sh:344` exige — e note que `bin/require-node.sh` roda **antes** desse check e
   já depende de `jq`: numa máquina sem ele, a recusa fala de node nomeando jq.
4. **Sourceie os segredos.** A unidade precisa do mesmo `env-source.sh` (ou do backend real) exportado antes
   do `box-up`; sem `DATABASE_URL` o passo 0 morre pelo nome, que é o comportamento certo.
5. **Janela.** ~19 min de nascimento + a promoção + o aquecimento, **na mesma corrida**. Reserve ~2 h e meça
   a primeira: o log do ciclo traz o relógio de cada gesto. Madrugada de domingo, por decisão de produto.

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
| as **portas** | passo 14-bis | toda porta de toda loja, aberta de verdade — e desde a pk33 **nos dois lados do cookie da portaria** (§6.2) |
| este runbook | `bash bin/test.sh` | a lista da §3.1 contra o compose, nos dois sentidos |
| a **coluna health** | `docker ps` | pk28/d2 — desde 09/09 ela é um veredicto, e não era |
| a **home do admin** | passo 12 · `bin/verify-seed.mjs`, **por tenant** | pk30/§11 — a ordem dos widgets, contra o que o dataset declara |
| os **blocos dos apps** | passo 12 · `bin/verify-seed.mjs`, **por tenant** | pk31/§6 — todo bloco que um app instalado **declara** está vivo em alguma loja |
| os **apps desta caixa nos FRONTS desta caixa** | `bash bin/test.sh` (`bin/front-app-reach.guard.mjs`) | pk32/d1 — todo componente de front que um app **nosso** declara, alcançável pelo front que tem de desenhá-lo |

★★ **pk30/§11 — a ORDEM DOS WIDGETS da home do admin, e ela era decidida pela ordem de instalação dos apps.**
Medido em 10/09 nos dois admins: o bloco de últimas assinaturas vinha no **topo** do quadro da demo — o
admin do café estava certo e o do sapato, errado. Instalar um app **auto-coloca** os widgets dele no
**fim** de `admin:admin.home.widgets` — então a posição de um widget **É** a ordem em que o app dele foi
instalado. `forgeco` instalou `subscriptions` primeiro, `forgecafe` instalou por último, e **nenhum dos dois
tinha decidido nada**: um deles calhou de bater com a ordem que se queria.
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
deixa em `storefront:list.*` (a PLP do Outlet é limpa por decisão de produto). Isso é decisão, não defeito —
e uma regra por loja precisaria de uma **lista de exceções digitada** para se calar. "Vivo em algum lugar" não precisa de nenhuma, e
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

★★★ **pk36/d1 — O CAFÉ GANHOU PORTARIA, e agora as QUATRO lojas nascem com ela.** Decisão de produto
(13/09, confirmada em 14/09), e o que a destravou foi a pk35/d2.
⚠️ **O arranjo anterior está descrito aqui porque ele explica o mecanismo, não porque ainda valha:**
`extension.install` é **por TENANT** e o kernel coloca o bloco **em toda loja do tenant**, então instalar para o
`forgecafe` alcança o **café** e o **balcão** — e até a pk35 só um dos dois sabia desenhar (o balcão é o totem,
que solda o registro dele; o café é o `storefront-coffee`, que resolvia pelo registro do kit, `{}` por desenho).
Como `storefront:gate` é alvo **estrutural**, o fork **RECUSAVA a página** em voz alta (*"Esta loja está
temporariamente indisponível"*), então `seed/coffee.mjs` **removia a colocação do café** e `seed/box.json`
declarava `"gate": false` + o motivo. ⇒ **As duas coisas morreram juntas nesta fatia**, porque a pk35/d2 deu ao
fork um `composition.json` próprio, um script `codegen` e a dependência real do `@forgeco/surface-codegen`:
`storefront-coffee/src/lib/extensions/generated/gate-registry.tsx` **existe** e resolve o `demo-gate` nas duas
faces. ⛔ **E a divergência declarada saiu junto** — o `bin/front-app-reach.guard.mjs` agora **grada** o par
`storefront-coffee × demo-gate` em vez de dispensá-lo, e fica vermelho no dia em que o fork deixar de alcançar
o app. 📌 **A chave `gate: false` continua existindo** — é como qualquer loja de qualquer caixa declara que não
tem portaria — e as quatro reações do 14-bis a ela continuam gradadas: como nenhuma loja real a declara,
`bin/prove-doors.test.mjs` as grada contra uma **caixa de fixture própria**, com uma loja que só existe lá.
⚠️ **A colocação só chega no NASCIMENTO** (`extension.install` materializa as colocações), então uma caixa já de
pé **não** ganha a portaria do café por esta mudança: ela chega no próximo nascimento.

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

### 6.1 ★★★ Uma loja **OCUPADA** não é uma loja quebrada — e agora os dois forks sabem dizer isso

⛔ **Até 10/09, qualquer erro no café e no balcão era a página branca do Next.** Medido neste repo, depois de
assar: `find storefront-coffee/src totem/src -name 'error.tsx' -o -name 'global-error.tsx'` → **vazio**, e
`grep -rl busy-boundary` nos dois → **vazio**. O `bin/fork-refusal-drift.guard.mjs` já dizia isso em voz alta,
por rota (*"storefront-coffee: NOT CHECKED — no src/app/error.tsx"*). ⇒ um estouro de teto de leitura aparecia
como *"Application error: a server-side exception has occurred"*, em inglês, 16px, sem chrome da loja, sem
português e sem dizer quando voltar. As cinco fronteiras que o produto ganhou na pk31/p1 são **do produto**; um
fork é um **corte** e não herda o que não foi cortado.

**Desde a pk32/d3 cada fork tem a sua, na voz dele:**

| fork | rotas com fronteira | 429 (teto de leitura) | outro erro |
|---|---|---|---|
| `storefront-coffee` | a raiz sem loja, a árvore cacheada `c/[store]`, a árvore dinâmica `s/[store]` | *"Muita gente no café agora"* + **quando voltar** + 3 portas (tentar de novo · loja · buscar cafés) | *"Não foi possível carregar esta página"* + **Código: `<digest>`** |
| `totem` | a única rota do balcão | *"O balcão recebeu muitos pedidos ao mesmo tempo"* + **quando voltar** + UM botão gigante | *"O balcão não conseguiu abrir a tela de pedidos"* + **Código** + *"peça direto com um atendente"* |

⚠️ **O STATUS CONTINUA 500 NOS DOIS CASOS, E ISSO NÃO TEM CONSERTO AQUI.** Um Server Component do App Router
não tem como publicar 429 (não existe `tooManyRequests()` ao lado de `notFound()`). ⇒ **uma sonda que lê só o
status vai reportar a loja como quebrada estando ela apenas cheia.** Quem precisa distinguir **lê o corpo**:
`data-testid="busy-boundary"` (ocupada) × `data-testid="error-boundary"` (quebrada). É a mesma régua que o
passo 14-bis adotou na pk29/p3 — *uma prova que não sabe diferenciar a página certa do pedido de desculpas do
app prova só que o processo está vivo*.

⇒ **Na prática, para quem opera:** um 500 durante o passo 14 (aquecimento) cujo corpo diz *"Muita gente…"* é a
caixa **se** estourando o próprio teto anônimo, não um defeito — é exatamente o que a §4 descreve sobre o custo
do aquecedor. Um 500 cujo corpo traz **Código:** é um defeito, e esse código é o que se procura no
`docker compose logs`.

⚠️ **E uma dívida de produto ficou nomeada, não consertada:** o `@forgeco/storefront-kit` **embarca**
`src/ceiling-digest.ts` (o vocabulário de "não agora") e **não publica** o subcaminho —
`packages/storefront-kit/package.json` tem `./ceiling-digest` em `exports` e **não** em `publishConfig.exports`
(91 chaves contra 92). Dentro do monorepo o import resolve; **de um tarball, não**. Os dois forks daqui o
carregam como **solda** (`src/lib/ceiling-digest.ts`), com um guard que os prova idênticos ao módulo vendorizado
a cada corrida e fica **vermelho no dia em que o kit publicar o subcaminho** — que é o dia de apagar a solda.
⛔ Isso é conserto no **outro repositório**, de uma linha, e uma fatia nomeia um repo só.

### 6.2 ★★★ A PORTARIA — o que o operador vê quando ela está de pé, e o que mudou no 14-bis

**O que a portaria É, para quem opera.** Uma tela cheia que **cobre** a rota pedida (nunca redireciona), em
**PT/EN/ES** com seletor no rodapé, e ela tem **duas telas**, não uma:

1. **O hub** — a primeira. Manchete em quatro orações (*"Dois tenants. Quatro lojas. Dois admins."* + *"Mesmo
   kernel!"* no acento), **dois cartões de tenant** com as lojas de cada um e, no pé de cada cartão, a linha
   *"Admin do tenant"*. Fecha com o aviso *"Tudo fictício: nada é cobrado, nada é enviado…"*.
2. **A arquitetura** — *"A arquitetura da demo"*, aberta pelo botão *"Entenda a arquitetura"* e fechada por
   *"Voltar para as demos"*. Ela **substitui** o hub em tela cheia; não há navegação, então a URL não muda e
   o idioma escolhido viaja junto.

⚠️ **Não procure um `<h1>` dizendo que é uma loja demo:** o herói que ficava acima do hub **saiu na pk38/d7**,
com a segunda moldura e com o botão *"seguir nesta janela"*. ⇒ **o hub É a escolha**, e a única porta que
sobrou fora dos cartões é a linha de rodapé desenhada só quando o host não casa com nenhum destino declarado
(*"Esta janela está num endereço que esta demo não publica:"* + *"entrar assim mesmo"*) — que é **sempre** o
caso na bancada. 📌 Para gradar *"a portaria apareceu"* numa sonda, o handle é o corpo, não o texto:
`data-testid` de `apps/demo-gate/block/marks.ts` (e `data-hub-faces=<n>` conta os cartões).

⛔ **Até 11/09 NADA verificava que a portaria APARECE, e foi assim que ela ficou desinstalada por dias.** O app
`apps/demo-gate` — a tela cheia que todo visitante encontra antes da loja — não era instalado por
**passo nenhum** do nascimento: nem `bin/seed-box.mjs`, nem `seed/vitrine.mjs`, nem `seed/coffee.mjs`, nem
`seed/outlet.mjs`. O README do próprio app dizia *"Install the app for the tenant"*, ou seja: **um gesto de
mão** que alguém tinha de lembrar. Ninguém lembrou, e **toda corrida de nascimento ficou verde** durante todo
esse tempo — porque o passo 14-bis gradava o **status** e o **contêiner**, e os dois são idênticos quer o
visitante encontre a portaria, quer entre direto na loja: **a portaria responde 200 e a loja também**.

**O que o operador vê hoje, com a caixa de pé:**

| onde | sem o cookie (1º visitante) | com o cookie (já entrou) |
|---|---|---|
| `/s/<forge>/`, `/s/<outlet>/` e as três portas de checkout de cada uma | a **portaria** (tela cheia, PT/EN/ES, o **hub** dos seis destinos) | a **loja**, com a **faixa** vermelha no rodapé que reabre a portaria |
| `/s/<balcao>/checkout`, `/account`, `/account/login` | a **portaria** (quem serve é o `checkout`, que compõe o app) | a porta de sempre |
| `/s/<balcao>/` | **404** — a vitrine recusa a loja do balcão, e essa recusa é **acima** da portaria | **404**, idêntico |
| `/s/<cafe>/…` | a **portaria** — desde a pk36/d1 o café é gradado como as outras três (§6.1 acima) | a **loja**, com a **faixa** no rodapé |

★★★ **DESDE pk35 A PRIMEIRA TELA É O HUB DOS SEIS DESTINOS** (o layout é o do artboard,
`apps/demo-gate/design-base/gate.dc.html`, e `block/hub.test.tsx` segura os dois juntos): dois cartões de tenant,
cada um com as suas lojas e, no pé, a linha que abre o admin daquele tenant. ⛔ **Nenhum endereço está escrito no
app** — quem os declara é `seed/box.json` (`domain` por loja, `admin_domain` por tenant), `bin/gate-faces.mjs`
renderiza essa declaração em `apps/demo-gate/faces.generated.ts` e `bin/gate-faces.guard.mjs` impede as duas
pontas de divergirem. **Uma loja que perder o `domain` continua na tela, NOMEADA**, dizendo que não tem endereço
publicado; ela nunca some em silêncio.

⇒ **O destino em que o visitante JÁ ESTÁ** é o único que grava o cookie `forge_gate_dismissed=1` (botão, não
link): a **MESMA url** passa a servir a página pedida — a portaria **cobre** a rota, nunca redireciona, então um
link fundo (`/s/<loja>/account/orders/<id>`) continua valendo depois de passar por ela. Os outros cinco são
links comuns para outras origens, e a linha do admin abre o `/enter`, que resgata a chave de operador **no
servidor**. ⚠️ **Na bancada NENHUM dos seis casa com o host** (a caixa nasce em `localhost` e a promoção é passo
à parte), então o hub desenha, no pé, **a sua própria porta**, dizendo em que host ela está — sem isso a caixa
recém-nascida seria uma loja em que ninguém consegue entrar.

#### ★★★ A PORTA DO ADMIN — a chave nasce com a caixa, e são DUAS (pk38/d8)

⛔ **A frase acima era uma promessa que nada cumpria.** O `/enter` resgata uma **chave de acesso de operador**
no servidor — mas **nenhum passo do nascimento cunhava uma**, e a variável que a entrega ao admin não era
declarada em lugar nenhum: nem no `.env.example`, nem no compose, nem no `box-up.sh`. A rota lia uma variável
ausente e caía no `/login`, **em toda caixa que este repositório já construiu**. Como a Demo se regenera, uma
chave criada à mão depois de cada reset é uma porta que fica fechada quase sempre.

**O que o nascimento faz agora:**

| passo | o que escreve | onde mora |
|---|---|---|
| **3b** | `FORGE_ADMIN_STORE_IDS` = `{"<tenant>":"<loja>"}` | `.env` — não é segredo, e os ids são ULIDs novos a cada nascimento |
| **5b** | uma chave por tenant, via `operator.access_key.create` **pela porta** | `.secrets` (`forge-admin-access-key`, e `-<tenant>` do segundo em diante) |
| `env-source.sh` | junta as duas metades em `FORGE_ADMIN_ACCESS_KEYS` = `{"<tenant>":{"store":…,"key":…}}` | só na shell; **nunca** num arquivo ao lado do `.env` |

★★★ **Uma entrada é INTEIRA ou AUSENTE — nunca emprestada.** As duas metades são procuradas sob o nome **do
próprio tenant**; um tenant sem chave ou sem loja simplesmente **não aparece no mapa**, e o admin daquela marca
cai no login de sempre. ⛔ Ele **não pode** herdar a entrada do vizinho: isso assinaria uma sessão do tenant A
para quem abriu o hostname do tenant B, que é exatamente a fuga pela porta da frente que a rota recusa a
adivinhar. Com `FORGE_ADMIN_TENANT` preenchido (modo *pinado*) **não há porta por hostname nenhuma** — esta
caixa o deixa vazio de propósito (§3.1).

★★ **E o link do hub também deixou de ser singular.** `FORGE_GATE_ADMIN_URLS` = `{"<tenant>":"<origem>"}`, uma
por marca, escrito pelo passo **3d** a partir do `admin_host` de `seed/box.json` e **reescrito pela promoção**
com as portas que o diretório aceitou. Antes era um valor só: uma das duas linhas de admin abria a porta certa
e a outra ficava com o hostname **declarado**, que a bancada não publica. O passo **15** grada **cada entrada**
— ausente, sem reivindicação no diretório, ou **reivindicada por outro tenant** são três ✗ diferentes, cada um
nomeando a marca.

⚠️ **A chave é recunhada a cada nascimento e as anteriores são revogadas** (ela é devolvida uma vez só, então um
re-run não tem como reaproveitá-la). ⛔ **O valor nunca é impresso**: o script escreve a chave crua em `stdout`,
o `box-up.sh` arquiva e destrói o arquivo temporário, e o que aparece na tela é o **id** (`oak_…`).

⚠️ **O admin NÃO tem portaria, e isso é decisão de produto** (11/09): quem abre a url do admin cai no login
normal. E como a loja e o admin são **origens diferentes**, o cookie de dispensa **não** acompanha esse salto. Isso é correto e esperado.

⛔ **E O MESMO VALE ENTRE AS SEIS LOJAS, o que AINDA não é o que está decidido.** O cookie de dispensa é escrito
**sem atributo `domain`** (`packages/storefront-kit/src/gate/actions.ts:57-64`, no monorepo do Forge), logo é
*host-only*: quem passou pela portaria em `store.forgecommerce.pro` encontra portaria de novo em cada uma das
outras (medido 13/09: os dois admins não têm portaria por decisão, e desde a pk36/d1 o café tem — então são
**três** fronts de loja, não dois). A decisão de 13/09 — o cookie **pode** valer para todas ⇒ cookie de domínio
`.forgecommerce.pro`, e a barrinha reabrindo nas seis — é mudança **no kit**, ou seja, **no outro repositório**;
uma fatia nomeia um repo só.

★★ **O QUE MUDOU NO PASSO 14-bis, e ele ficou MELHOR, não mais frouxo.** Ele continua exigindo as mesmas 16
portas, a mesma regra de *"a loja e não um pedido de desculpas"*, e o mesmo `⊘` deliberado do balcão. O que
ganhou: **toda porta é aberta DUAS vezes**, sem o cookie e com ele, e as duas respostas são gradadas uma contra
a outra — **sem** o cookie o corpo tem de **ser a portaria**; **com** o cookie tem de ser a **loja**; e os dois
corpos têm de **diferir**, afirmado diretamente. ⚠️ **Ele grada o CORPO, nunca o status**, pela mesma razão da
§6.1: a portaria responde **200** do mesmo contêiner que a loja, então um código não enxerga a diferença. A
marca é `data-testid="<o id do app que a porta declara>"` — o passo **não digita** o nome do app: pergunta ao
`read.extensions` quem preenche `storefront:gate` e monta o atributo com a resposta.

★★★ **E DESDE pk35 ELE COBRA TAMBÉM A VOLTA — a barrinha.** Toda porta **gradada que renderizou página** (2xx;
um `307` não tem corpo e é dito, não exigido) tem de trazer `data-testid="<id do app>-ribbon"` **com** o cookie.
Era a metade que ninguém tinha: o lado do cookie só era gradado pelo que **não** podia conter, então um front
que montasse a tela cheia e **não** a barrinha era uma perda silenciosa numa corrida verde. Medido na bancada
em 13/09, no outlet: `/` → `200 · storefront` (barrinha), `/checkout` → `200 · checkout` (barrinha),
`/account` → `307 · checkout` (sem corpo, correto), `/account/login` → `200 · checkout` (barrinha). O vermelho
**nomeia a porta e o front que a serviu**.

★ **Quais lojas DEVEM ter portaria: todas, por padrão.** Nada em lugar nenhum lista as lojas com portaria — uma
lista envelheceria calada na quinta loja. O que é declarado é a **exceção**, em `seed/box.json`, com o motivo ao
lado (`"gate": false` + `_gate_why`), e desde a pk36/d1 **não há nenhuma** — o `cafe` era a última.
`bin/gate-at-birth.guard.mjs` fecha o
outro lado no laço de testes: *todo tenant cujas lojas querem portaria tem um seed que a INSTALA* — derivado do
manifesto do app, do `seed/box.json` e das quatro listas de `extension.install` deste repo, sem nome digitado.

⛔ **Como isto fica vermelho — e cada linha nomeia a loja:**

| o que aconteceu | o que o 14-bis imprime |
|---|---|
| ninguém instalou a portaria | `✗ <loja> — NO APP FILLS storefront:gate FOR THIS STORE` |
| a portaria está declarada e a frente **não sabe desenhá-la** | `✗ <loja>/<porta> — the front that answers this door CANNOT DRAW the gate…` (recusa estrutural: a loja não abre) |
| a porta serve a loja **sem** a portaria | `✗ <loja>/<porta> — NO GATE ON THIS DOOR` |
| a portaria **não solta** nem com o cookie | `✗ <loja>/<porta> — THE GATE WILL NOT LET GO` |
| a loja é declarada sem portaria e uma portaria aparece nela | `✗ <loja>/<porta> — declared gateless and a gate screen … reached this door anyway` |

⛔⛔ **E UM CUSTO NOVO, MEDIDO, QUE É DEFEITO DO PRODUTO E NÃO DESTA CAIXA: com a portaria de pé, o passo 14
(aquecimento) AQUECE A PORTARIA, não a loja.** O aquecedor roda **dentro** da vitrine (`POST /api/warm` →
`apps/storefront/src/lib/warm/run.ts`, no monorepo) e o fetcher dele manda **um header só** —
`user-agent: <o do aquecedor>` (`withWarmerUserAgent` + `runPass`). **Cookie nenhum.** ⇒ toda página que ele
visita numa loja com portaria responde **a portaria**: 200, do mesmo contêiner, e **sem um `next/image`
dentro** — então o cache de rota, as entradas de ISR e as ~20 400 derivadas de imagem **não são preenchidas**, e
a passada de imagens (que deriva a lista do `imageUrlsFrom(corpo)`) encontra **zero**. ⚠️ **E a corrida volta
verde**: cada visita é 200 e o relatório diz *"warm"*, porque nada nele distingue os dois corpos. ⇒ **desde a
pk33 o passo 14 NOMEIA cada loja com portaria** e diz, na linha, que aquela loja deve ser tratada como **FRIA**
qualquer que seja o número. ⛔ **O conserto é um header no fetcher do aquecedor, no OUTRO repositório** — uma
fatia nomeia um repo só. O que foi consertado aqui é o **silêncio**. 📌 **E desde a pk36/d1 isso vale para as
TRÊS lojas de vitrine** — `forge`, `outlet` e agora o `cafe`, que deixou de ser a única a aquecer de verdade.
O passo 14 deriva a lista do `read.extensions`, então ele já nomeia o café sozinho: nenhuma lista a atualizar.

⇒ **Na prática, para quem opera:** se a demo aparecer **sem** a portaria, o nascimento já vai ter
dito qual loja e por quê, antes de a caixa ser entregue. E se você precisar ver a loja **sem** a portaria para
conferir alguma coisa, é um cookie: `curl -H 'Cookie: forge_gate_dismissed=1' <url>` — é exatamente o que o
passo 14-bis faz no segundo lado.
