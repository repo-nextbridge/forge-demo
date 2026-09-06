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
- **`.env`** (5): as suas. Quatro são endereços e identidades; a quinta é uma armadilha — leia a §3.3.

⚠️ **`FORGE_ADMIN_TENANT` é a única que o compose deixa VAZIA de propósito** — `${FORGE_ADMIN_TENANT?…}`,
sem os dois-pontos: ela tem de **existir** e pode ser branco. Vazia é o que põe o admin em **modo host**
(um container servindo as duas marcas, resolvidas pelo hostname). Preencher "porque estava vazio" tira a
caixa do modo em que ela roda. Nesse modo quem serve o login é a credencial de plataforma
(`FORGE_ADMIN_PLATFORM_TOKEN`), não o token singular.

### 3.2 Os segredos que **a própria caixa** cria

Nem todo segredo é seu para criar. Estes o `box-up` **minta e arquiva** via `put_secret`
(`bin/box-up.sh:214` — na bancada, no `.secrets`; online, no backend que você implementou):

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
`FORGE_TOTEM_STORE_ID=sto_PENDING_SEED`. `bin/box-up.sh:1044` o trata como "ainda não", o passo 6 resolve o
id de verdade e **reescreve o `.env`** (`:1018`), e o passo 7 sobe o totem.
⚠️ Hoje **nenhum arquivo desta caixa escreve esse sentinela** — ele só é lido. Enquanto isso for verdade, a
linha acima é uma instrução, não um mecanismo.

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
| semear de um dataset que **não é o das imagens** | passo 0c, `bin/box-up.sh:750` | 2 790 produtos de um checkout velho, caixa verde, painel de estoque nascido vazio |
| promover sem dizer **para onde** | `bin/box-up.sh:447` | `FORGE_PUBLIC_ORIGIN=http://:8200`, que é a origem de toda URL de imagem |

**O que a caixa PUBLICA ≠ o que ela escuta.** Quando a Demo está atrás de um `tailscale serve` (ou de
qualquer terminador de TLS), a porta que o navegador digita **não** é a porta do container. `box-up`
**lê** o que está publicado (`tailscale serve status --json`, `bin/box-up.sh:294-353`) em vez de supor.
Medido em 03/09, antes disso: o diretório tinha reivindicação para `<tailnet>:8201` (a porta interna) e
**404** para `<tailnet>:8443` (a porta que o navegador usa) — o login abria a tela e recusava o POST com
`unknown_admin_host`. **Ler nunca é configurar**: o script jamais roda `tailscale up` ou `serve`; entrar na
rede continua sendo gesto do operador.

**⚠️ O passo 14 (aquecimento) é um RELATÓRIO, não um portão — decisão do Renan em 05/09:** *"D1 - Pode ser
só relatório"*. Ele **não** faz mais o `box-up` sair 1, e a razão é que ele saía vermelho **em todo
nascimento**, por construção. Medido em 04/09, duas corridas completas pelo tailnet, mesmo resultado: o plano
do aquecedor não é feito de páginas — são ~420 páginas e ~20 400 **imagens**, descobertas do `srcset` de cada
HTML — `planned=20822`, `warmed=4964`, `15865 urls nunca visitadas`. O teto que corta é o da
**vitrine**, `DEFAULT_MAX_DURATION_MS = 15 * 60_000` (`apps/storefront/src/lib/warm/warm.ts:51`, no produto),
que `bin/warm-box.mjs` não sobrescreve.
⚠️ Não confunda com o `--deadline-ms` **desta caixa** (20 min, em `bin/warm-box.mjs`): esse é o prazo de
**espera pela resposta**, outro número.
E ele também **inventava** vermelho: `failed=198` num nascimento contra `failed=0` para as mesmas urls na
caixa **ociosa** minutos depois — é a carga que o próprio aquecedor impõe a uma caixa que ainda está
assentando. ★ **Um passo sempre vermelho é um passo que as pessoas aprendem a pular**, e aí ele deixa de
valer para o dia em que estiver certo.

⛔ **Nada foi apagado nem silenciado.** O passo roda igual e agora diz **mais**: **quais** urls não
responderam (com o status ou o timeout de cada uma) e **quais nunca foram visitadas** — que é outro fato e
outro conserto. O relatório antigo dizia *"198 of 419 pages did not answer"* e **não nomeava nenhuma**.
O `box-up` imprime `⚠️ REPORT — THE BOX IS UP AND … DID NOT COME OUT FULLY WARM` e **sai 0**; se ele nem
conseguiu perguntar, imprime `⚠️ REPORT — WARMTH IS UNKNOWN FOR …`, que é outra frase.

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

---

## 5. O reset (passo 6) — e a promoção **entra no mesmo laço**

```bash
bash bin/box-down.sh          # estado morre, o cache de 3,6 GB de fotos vive
bash bin/box-up.sh --tailnet  # ← --tailnet, e a §5 inteira é sobre esse argumento
```

⚠️ **E aqui está uma fronteira, medida, que este runbook não pode esconder.** A única promoção que este
repositório implementa hoje é a do **tailnet**: `bin/box-up.sh:447` **morre** se `FORGE_TAILNET_HOST` estiver
vazio, nas duas direções, e todo o bloco 0b deriva os endereços de `tailscale serve status --json`. Uma Demo
num **nome de DNS de verdade** precisa desse mesmo bloco aceitando o hostname público — o mecanismo existe e
o modo não. Enquanto isso for verdade, a caixa online ou fica no tailnet, ou promove à mão o que o passo 3b
reescreve, que é exatamente o trabalho que o bloco 0b existe para não se perder.

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
hostname. O conserto é rodar de novo **com `--tailnet`** — e é por isso que a linha do reset semanal tem de
carregar o argumento. **Um reset agendado sem ele perde o admin toda madrugada de domingo.**

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

1. **Cron não tem `node`.** `env -i` com `PATH` mínimo não acha `node` nem `pnpm`; só o diretório do nvm tem
   o par compatível. Metade do nascimento são processos de host (`seed.mjs`, `verify-seed.mjs`,
   `warm-box.mjs`, `verify-config.mjs`), então a unidade **tem** de receber esse diretório no `PATH`. A
   recusa por versão de Node existe por causa desse caso: sem ela, a unidade morreria **depois** de o
   `box-down` já ter destruído o banco.
2. **Use `--tailnet`** (ou o modo que promove esta caixa). Ver §5.
3. **`jq` também.** `bin/box-up.sh:181` exige — e note que `bin/require-node.sh` roda **antes** desse check e
   já depende de `jq`: numa máquina sem ele, a recusa fala de node nomeando jq.
4. **Sourceie os segredos.** A unidade precisa do mesmo `env-source.sh` (ou do backend real) exportado antes
   do `box-up`; sem `DATABASE_URL` o passo 0 morre pelo nome, que é o comportamento certo.
5. **Janela.** ~19 min de nascimento + o teto de 15 min do aquecimento. Madrugada, como o dono decidiu.

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

A regra única do passo 15 é **posse de um endereço**: *esta caixa se publica em UM endereço, e toda face que
ela declara tem de estar publicada ali*. Cada face é comparada com **o que a caixa responde** — nunca com uma
cópia do que ela deveria responder. A última checagem vira a regra contra o próprio arquivo: qualquer
`FORGE_*` que segure um endereço **desta** caixa e que a promoção **não** reescreva é **nomeada**, porque o
próximo reset a deixaria apontando para a rede em que a caixa costumava estar. Ninguém precisa ter lembrado.

⚠️ **A sonda é `node:http`, nunca `fetch`** — o undici **descarta em silêncio** um header `host`. Medido:
`fetch(origem, {headers:{host:'nope.invalid'}})` respondeu **200** onde `node:http` respondeu **404**. Uma
sonda feita com `fetch` teria gradado todo hostname como resolvido, em toda caixa, para sempre.
