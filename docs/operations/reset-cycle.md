# O ciclo agendado — a caixa renasce, é promovida, é aquecida e **é julgada**, numa corrida só

> **Operador.** O que o ciclo **é**, quando ele roda, **o que ele destrói**, o que ele **preserva**, e como
> agendá-lo. É o passo 7 da ordem de deploy em `docs/operations/runbook-demo.md` (§2), e o degrau que precede
> o staging da Demo: provar o ciclo **local**, à mão, antes de existir CI/CD.

**O comando:**

```bash
bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>
```

> ⚠️ **Este ciclo é o da BANCADA, e desde 16/09 (pk43/d2) existe um irmão para as caixas implantadas:**
> `bash bin/birth-remote.sh <env>` nasce uma caixa remota pelos mesmos quinze passos (runbook §2.3). Ele
> **não** está agendado, e isso é decisão e não pendência — o `stag` renasce **à mão**, antes de um pin ser
> ensaiado e depois de uma rodada de testes (`deploy/stag.env` carrega a razão). ⛔ E a promoção não entra
> ali: uma caixa implantada já nasce nos endereços que ela publica, um por face, em vez de nascer em
> `localhost` e ser apontada depois.

---

## 1. Os cinco gestos, e a ordem é a decisão

| # | gesto | o que roda |
|---|---|---|
| 1 | a caixa morre | `bash bin/box-down.sh` |
| 2 | a caixa nasce (sem aquecer) | `bash bin/box-up.sh --no-warm` |
| 3 | a caixa é **promovida** | `bash bin/box-up.sh --promote <destino>` |
| 4 | a caixa é **aquecida**, já no endereço promovido | `bash bin/box-up.sh --warm-only` |
| 5 | ★ **o veredicto** — as duas perguntas do nascimento, feitas **de novo** | `bash bin/box-up.sh --verdict-only` |

**UM script, UM agendamento.** ⛔ Não são quatro entradas de crontab. Três razões, todas medidas nesta árvore:

1. **A ordem já é a decisão e já tem guard.** `bin/reset-complete.guard.mjs` existe para provar que o
   nascimento *renasce → purga a borda → aquece → gradua*. Repartido em horários, isso vira aritmética de
   relógio — e **relógio não é dependência**: numa noite em que o seed demorar mais, a entrada das 04:00
   dispara contra uma caixa ainda semeando, aquece nada e reporta verde.
2. **Os passos já são um script só.** `bin/box-up.sh` são quinze passos que existem cada um porque o anterior
   produziu algo de que ele precisa. O ciclo **orquestra**; nada dessa lógica é reimplementado aqui.
3. **O código de saída tem de ser decidido num lugar só.** `box-up.sh` sai 1 de propósito por **oito** razões
   diferentes. Um agendamento que alerta em qualquer não-zero alerta toda noite; um que ignora não-zero não
   alerta nunca. Quem resolve isso é o ciclo — §4.

### ★★★ Por que existe o gesto 5

**Um veredicto tirado antes de o estado que ele julga estar pronto não é um veredicto.** Medido na **primeira
corrida real** do ciclo (15/09/2026): o gesto 2 saiu 1 por **duas** razões — `cafe/` sem portaria (passo
14-bis) e o admin publicado em `localhost` enquanto a caixa se publica no tailnet (passo 15) — e **as duas
tinham deixado de ser verdade antes de o ciclo terminar**. Depois do gesto 3, o `prove-doors` respondeu
`every door answers as it must (8)` e o `verify-config` respondeu `VERDICT: settled`.

O nascimento é sondado **no endereço PROMOVIDO** de uma caixa que nasce em `localhost` por decisão (§0b do
`box-up.sh`) e ainda não o reivindicou. Os dois passos estão **certos sobre a caixa daquele momento** e
errados sobre a caixa que é entregue.

⛔ **O conserto não é um gesto 2 mais frouxo — é uma PERGUNTA MAIS TARDE.** O gesto 2 continua dizendo tudo o
que diz e continua voltando não-zero. O que mudou é que o ciclo não gradua mais só por ele. E a consequência
é prática: do jeito anterior **o cron ficava vermelho toda noite**, e um vermelho que sempre acende é um
vermelho que as pessoas aprendem a pular — que é exatamente por que o passo 14 deixou de ser portão.

### ⚠️ Por que o gesto 3 não é opcional

**Um nascimento DES-PROMOVE o admin.** O banco morre, então o diretório do kernel volta a ter só as portas
`localhost` que o `seed/box.json` reivindica; o passo 3d reescreve a lista de irmãos de volta para
`localhost`; e o passo 3b **mantém** o nome público no mapa host→loja. ⇒ a loja abre no endereço público e o
admin recusa o login com `unknown_admin_host`. O passo 15 (`bin/verify-config.mjs`) acusa isso e o nascimento
sai **vermelho**. **Um reset agendado sem o gesto 3 perde o admin em toda corrida.**

### ⚠️ Por que o gesto 4 vem DEPOIS do 3

A promoção termina em
`docker compose up -d --force-recreate kernel caddy admin storefront checkout storefront-coffee totem`
(`bin/box-up.sh`, bloco 0b). **Todo front que SEGURA o calor** — cache de rota, entradas de ISR, derivadas de
imagem — é destruído e recriado ali. Aquecer antes seria pagar ~1h10 por um cache apagado minutos depois. A
razão mais antiga continua valendo: numa primeira promoção o `FORGE_PUBLIC_ORIGIN` só está certo **depois**
que ela o escreve, então aquecer antes aquece um endereço que ninguém digita.

### ⚠️ Por que o gesto 5 vem por ÚLTIMO

Tudo antes dele muda a resposta: o gesto 3 reivindica o endereço em que as portas são abertas, e o gesto 4
enche o que o gesto 3 esvaziou (a promoção termina em `--force-recreate` de todo front). ⛔ E o **não-zero do
próprio gesto 5 nunca é perdoado**: nada vem depois dele.

⚠️ **E nem o laço que aquece nem o que abre as portas é copiado para o `box-cycle.sh`.** Aquecer é uma vez **por tenant, com o token
daquele tenant** — a face de leitura resolve o tenant pela **credencial** — e a regra do nome do segredo de um
tenant já tem dois autores. Por isso o gesto 4 pede `--warm-only` ao próprio `box-up.sh`, que dirige o mesmo
`warm_every_tenant` do passo 14, e o gesto 5 pede `--verdict-only`, que dirige o mesmo `prove_every_tenant`
do passo 14-bis. Uma terceira cópia dessa regra aqui envelheceria no dia em que um tenant entrasse no
`seed/box.json`.

---

## 2. O que ele DESTRÓI e o que ele PRESERVA

| | o quê | por quê |
|---|---|---|
| ⛔ **destruído** | o banco (`pgdata`), o redis, a **mídia** servida (`media`), o estado do edge (`caddy_data`, `caddy_config`) | é o que a caixa **derivou**; uma prova de nascimento que não destrói isso não é um nascimento |
| ✅ **preservado** | o cache de fotos (`seed_photos`, ~3,6 GB) | é o que a caixa **buscou** e buscaria de novo. Destruí-lo custa ~40 min e não prova nada. `bin/box-down.sh --all` derruba também — o ciclo **nunca** usa `--all` |
| ✅ preservado | o `.env` e os segredos | o ciclo não escreve nem um nem outro; quem reescreve `.env` é o nascimento e a promoção |
| ⚠️ **fica para trás** | online, os objetos do bucket da corrida anterior | um bucket não é um volume: cada nascimento escreve ~18 500 objetos sob chaves novas e as antigas **ficam**, pagas e apontadas por nada. Ver runbook §5 |

⚠️ **Todo dado que alguém curou à mão na caixa morre no gesto 1.** O ciclo é para uma caixa cujo conteúdo vem
inteiro do `seed/` e do dataset montado. Não agende ciclo numa caixa em que alguém está curando dado à mão.

---

## 3. Lock, log e o ambiente do agendador

**LOCK.** Duas corridas sobrepostas se destroem: a segunda derruba a caixa que a primeira está semeando. O
lock é um arquivo com o PID em `cycle-logs/cycle.lock`; a segunda corrida **recusa e diz** (saída **3**),
nomeando o PID, o início e o log de quem está segurando. ⛔ Ela **não** espera na fila. E um lock cujo processo
**morreu** é detectado e **tomado**, dizendo em voz alta de quem era — um lock eterno transformaria uma queda
em "a caixa nunca mais é resetada", sem nada dizendo por quê.

**LOG.** Uma corrida de ~90 min não tem terminal. Cada corrida escreve **um** log carimbado em `cycle-logs/`,
e o caminho é impresso **antes** de o trabalho começar e de novo com o veredicto. Quando a saída padrão não é
um terminal — que é o caso de um agendador — o corpo vai para o arquivo e só o cabeçalho e o veredicto chegam
à saída do agendador: o aviso que um agendador emite por conta própria fica curto e diz onde está o resto. `cycle-logs/` é gitignored (o
log carrega endereços, hostnames e a cauda do seed).

**NODE.** Um cron ou uma systemd unit herda um `PATH` mínimo e **não tem `node` nem `jq`**. `bin/require-node.sh`
trata esse caso e é a **primeira** coisa que o ciclo faz — antes do lock, antes do log, antes de destruir o
banco. ⇒ **a unidade tem de receber o diretório do Node que o release pina** (sob nvm,
`~/.nvm/versions/node/v<major>.*/bin`). Provado com `env -i` em `bin/box-cycle.guard.mjs`, nas duas direções.

**`COMPOSE_PROJECT_NAME`.** Nunca chame docker sem ele — é o que nomeia os volumes que o `box-down.sh`
destrói **pelo nome**. O ciclo o defaulta para o mesmo valor que o `box-down.sh` e **exporta**.

**Os segredos.** A unidade precisa do mesmo `env-source.sh` (ou do backend real) alcançável; sem
`DATABASE_URL` o passo 0 do nascimento morre pelo nome, que é o comportamento certo.

---

## 4. A política de saída — qual não-zero é aceitável

★ **A resposta não é um gesto, é uma RAZÃO**, e cabe numa frase:

> **Uma razão que um gesto deu só é perdoada onde um gesto POSTERIOR fez a MESMA pergunta e respondeu ✓.**
> **Razão que ninguém re-pergunta continua vermelha.**

⛔ **Por isso não existe mais perdão do tipo `<gesto>=<status>`.** O `box-up.sh` sai 1 por **oito** razões; um
perdão para *"o gesto 2 saiu 1"* perdoaria junto uma loja em que o comprador não consegue entrar, um tenant
com o catálogo de outra marca, um totem que não subiu e uma corrida que não presta contas dos próprios
passos. Perdão cego não é regra mais frouxa — é **outra** regra: ela para de ler a razão.

### Como a razão é lida — e por que é a SENTENÇA, não o status

Duas saídas estavam na mesa: ensinar ao `box-up.sh` um **código de saída por família**, ou ler as **sentenças
nomeadas** que ele já imprime. **A medição decidiu, e foi a própria primeira corrida:** o gesto 2 voltou com
**duas razões ao mesmo tempo** (`SHUT` **e** `MISCONFIGURED`). Um status é **um** número e não carrega
conjunto — e máscara de bits também não cabe: oito famílias pedem oito bits, os bits baixos já são dos **32
`die`** e das recusas de argumento que saem 1, e status é limitado a 255. Um código por família teria de
**descartar uma das duas razões** que a corrida que abriu esta questão produziu.

⇒ As razões são lidas das sentenças, e a tabela é o `CYCLE_REASONS` do `bin/box-cycle.sh`: `token | sentença |
quem re-pergunta | a medição`. ⚠️ **O custo disso é prosa, e ele é pago por guard:** o
`bin/box-cycle.guard.mjs` **deriva as oito famílias do próprio `bin/box-up.sh`** e fica vermelho se uma
sentença deixar de bater, se uma família nova aparecer lá e não aqui, ou se uma razão que ninguém re-pergunta
ganhar perdão.

### A tabela, hoje

| razão | quem re-pergunta | por quê |
|---|---|---|
| `SHUT` | **gesto 5** | ✅ medido 15/09: o nascimento abre as portas no endereço **promovido** que a caixa ainda não reivindicou. O gesto 5 abre as mesmas portas depois da promoção |
| `DOORS_UNKNOWN` | **gesto 5** | ✅ é a outra resposta do mesmo passo 14-bis, e o gesto 5 **é** esse passo de novo |
| `MISCONFIGURED` | **gesto 5** | ✅ medido 15/09: entre o gesto 2 e o 3 a caixa está mesmo meio-promovida. O gesto 5 roda o mesmo `verify-config` depois da promoção |
| `MISSING_STORE` | — | ⛔ o gesto 2 roda com `--no-warm` e nunca reporta isto; um perdão aqui seria regra que nada exercita |
| `UNSETTLED` | — | ⛔ nenhum gesto semeia depois do nascimento: quem saiu com o catálogo errado continua com ele |
| `UNSETTLED_EXTRA` | — | ⛔ nada depois sobe o totem |
| `ONLINE_ONLY_FAILED` | — | ⛔ o passo 13 roda uma vez; nada re-purga a borda |
| `ROTEIRO_INCOMPLETE` | — | ⛔ a pergunta é sobre **aquela** corrida, e ela acabou. É também a razão que diz que o próprio sumário não é confiável |

⛔ **E um não-zero que não nomeia razão nenhuma é vermelho** — um `die` no meio do nascimento, uma promoção
que recusou, um teardown que falhou. Não é *"ainda não"*: é o desconhecido, e o desconhecido não se perdoa.

⚠️ **O ciclo não para no primeiro vermelho.** Ele roda os cinco gestos e gradua no fim — que é o mecanismo
inteiro: as razões que o gesto 2 dá são respondidas por gestos que vêm **depois** dele.

**Os códigos do ciclo:**

| saída | significado |
|---|---|
| **0** | toda razão que algum gesto deu foi re-perguntada por um gesto posterior e respondida ✓ |
| **1** | alguma razão ficou sem resposta — ou um gesto voltou não-zero sem nomear razão (ou a corrida não presta contas de todos os gestos) |
| **2** | recusou **antes de tocar em qualquer coisa** — sem node, destino não declarado, argumento desconhecido |
| **3** | outra corrida está com o lock |

---

## 5. Como conferir sem tocar em caixa nenhuma

```bash
bash bin/box-cycle.sh --plan --promote demo.exemplo.com   # o roteiro; ⛔ não cria nem o diretório de log
bash bin/box-cycle.sh --dry-run --promote demo.exemplo.com # lock + log + roteiro + veredicto, sem executar gesto
bash bin/test.sh                                           # bin/box-cycle.guard.mjs, entre os outros
```

O `--plan` imprime os **cinco** gestos **e** as razões que têm resposta vindo (quem re-pergunta cada uma), de
modo que a política de saída é legível sem rodar nada.

O `--dry-run` marca **REHEARSAL** no log em três lugares: um ensaio nunca pode ser lido como um ciclo.

---

## 6. O agendamento — e **este repositório não instala nenhum**

⛔ **Ligar o agendamento é gesto de quem opera a instância.** O repositório entrega o **script** e o **exemplo**; não há
crontab nem unit versionados aqui, e não havia nada agendado antes desta página existir — três comentários do
`box-up.sh` e uma linha do `README` prometiam *"a cron warms later"* e **essa cron nunca existiu**.
`bin/box-cycle.guard.mjs` fica vermelho se a promessa voltar.

**crontab** (madrugada de domingo, com o diretório do Node no `PATH`):

```cron
PATH=/home/<user>/.nvm/versions/node/v24.18.0/bin:/usr/local/bin:/usr/bin:/bin
0 3 * * 0 cd /caminho/para/forge-demo && bash bin/box-cycle.sh --promote demo.exemplo.com
```

**systemd** (o par serviço + timer; `Type=oneshot`, porque o ciclo termina):

```ini
# /etc/systemd/system/forge-demo-cycle.service
[Unit]
Description=Forge Demo — o ciclo: renascer, promover, aquecer
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=<user>
WorkingDirectory=/caminho/para/forge-demo
Environment=PATH=/home/<user>/.nvm/versions/node/v24.18.0/bin:/usr/local/bin:/usr/bin:/bin
Environment=FORGE_CYCLE_PROMOTE_TO=demo.exemplo.com
ExecStart=/usr/bin/bash bin/box-cycle.sh
TimeoutStartSec=3h
```

```ini
# /etc/systemd/system/forge-demo-cycle.timer
[Unit]
Description=Forge Demo — o ciclo, semanal

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

⚠️ **O destino é parâmetro, nunca constante.** `--promote <onde>` aceita `tailnet`, `localhost` ou um
hostname — e **o endereço de uma rede privada não pode morar em arquivo versionado**. Por isso o destino vem
do **argumento** (a linha do agendador) ou do ambiente (`FORGE_CYCLE_PROMOTE_TO`), e o ciclo **recusa dizendo**
se não souber para onde promover. ✅ E *"sem destino"* é um modo legítimo e **declarado**: `--no-promote`
deixa a caixa onde ela nasce (`localhost`) e o gesto 3 aparece no roteiro como **pulado, com a razão** — nunca
silenciosamente ausente.

⚠️ **Janela — e agora ela está MEDIDA.** A primeira corrida real (15/09/2026, `--promote tailnet`) marcou:

| gesto | relógio |
|---|---|
| 1 · derrubar | **14 s** |
| 2 · nascer (`--no-warm`) | **1 273 s** (~21 min) |
| 3 · promover | **37 s** |
| 4 · aquecer | **2 409 s** (~40 min) |
| 5 · o veredicto | ainda não medido — é o passo 14-bis + o 15 do nascimento, sem construir nada |

⇒ ~62 min naquela corrida. Reserve ~2 h: o aquecimento é limitado por **progresso** e não por relógio, e o
log traz o relógio de cada gesto.

---

## 6-bis. A caixa que **não é esta máquina** — `--env`

Tudo acima descreve o ciclo na bancada. A mesma corrida contra uma caixa implantada é `--env`:

```bash
bash bin/box-cycle.sh --env stag --plan                  # o roteiro, sem tocar em nada
bash bin/box-cycle.sh --env stag --dry-run               # o mecanismo inteiro, com os gestos IMPRESSOS
bash bin/box-cycle.sh --env stag                         # a corrida
bash bin/box-cycle.sh --env prod --mail-to voce@exemplo  # …com a mensagem do fim
```

### ⛔ São QUATRO gestos, não cinco — e o 3 não existe lá

A promoção existe porque uma **bancada** nasce em `localhost` por decisão e precisa ser apontada depois para
o endereço onde é realmente alcançada. Uma caixa implantada **nasce nos próprios endereços**:
`bin/deployed-faces.mjs` lê os seis hostnames de `deploy/<env>.env` **antes de um byte ser escrito** e recusa
o nascimento se faltar um; cada loja reivindica o seu no diretório do kernel durante o próprio nascimento.

⇒ Não sobra o que apontar — e uma promoção inventada ali **não seria redundante, seria errada**: reescreveria
o diretório do admin que o nascimento acabou de montar certo, apontando-o para um destino digitado num laptop.
O gesto 3 aparece no roteiro como **pulado, com essa razão**, nunca silenciosamente ausente. `--env` junto de
`--promote`/`--no-promote` é **recusado**.

### ⚠️ O que NÃO muda

A ordem. O gesto 4 (aquecer) e o 5 (julgar) continuam por último, e a razão da bancada (*a promoção destrói
as frentes*) não é a razão de lá — o nascimento remoto também termina recriando as frentes, então calor
adquirido no meio dele é jogado fora do mesmo jeito; e um veredito tirado antes de a caixa assentar continua
não sendo veredito. **A ordem é a decisão nos dois lados; só muda o gesto que fica no meio dela.**

E a **política de saída é a mesma tabela** — o `bin/birth-remote.sh` imprime as **oito** sentenças que o
`bin/box-up.sh` imprime, palavra por palavra, porque é assim que uma tabela só serve às duas caixas.

> ⛔ **Uma delas foi acertada nesta fatia, e vale saber por quê.** O totem parado saía do nascimento remoto
> como um `note` e um `exit 1` — vermelho certo, **sem nomear razão nenhuma**. A política lê razões do texto,
> então um ciclo remoto com o totem morto graduaria aquilo como *"não-zero não reconhecido"*: vermelho, sim, e
> mudo sobre qual das oito coisas quebrou — às 3 da manhã, num agendamento, que é a única hora em que essa
> frase é lida.

### ⛔⛔ O que a PRIMEIRA corrida remota de verdade achou — e ler não acharia

Medido em 17/09, contra o staging: o gesto 1 destruiu os volumes de estado e — **corretamente** — preservou o
`.secrets`, que é **identidade, não estado**. O gesto 2 leu esse mesmo `.secrets`, concluiu que a caixa já
havia nascido, e **RECUSOU**. A caixa ficou no chão, com um ciclo em que cada peça fez exatamente o que
prometia.

⇒ **A recusa é sobre uma caixa que alguém está usando, e uma caixa sem estado não é uma dessas.** O que ela
protege está escrito nela mesma: *"as configurações, os sortimentos e as promoções que este repositório
declara sendo re-aplicados sobre o que a caixa viva tenha virado"* — uma frase **sem sujeito** quando o volume
do banco não existe mais. Então a pergunta passou a ser feita ao **ESTADO** (`<projeto>_pgdata`, o primeiro
nome da lista STATE do próprio `bin/box-down.sh`), e identidade deixada para trás por um teardown parou de
ser lida como vida.

⚠️ **E as duas respostas são frases diferentes, de propósito.** Caixa com segredos **e** estado é caixa viva e
é recusada; caixa com segredos e **sem** estado é um **RENASCIMENTO** e diz isso em voz alta — uma corrida que
silenciosamente fizesse a coisa certa aqui seria indistinguível da que fez a errada.

★ **A lição, que é mais larga que este arquivo:** a recusa estava certa no dia em que foi escrita, quando o
único jeito de destruir o estado era o mesmo gesto que apagava os segredos. O que a quebrou foi **um gesto
novo** — um teardown que separa identidade de estado — e nenhum dos dois arquivos mudou. **Duas peças
corretas compõem errado**, e só a corrida inteira mostra isso.

### ⛔⛔ O RELÓGIO DE UMA CAIXA IMPLANTADA NÃO É O DA BANCADA — medido, e muda o que dá para agendar

A tabela da §6 diz *"reserve ~2 h"*, e ela é honesta sobre o que mediu: uma **bancada** — um laptop com
núcleos de sobra. A caixa de staging da demo é **1 vCPU e 2 GB**. Medido em 17/09, durante um renascimento
real:

| | bancada (15/09) | staging implantada (17/09) |
|---|---|---|
| gesto 2 · nascer | **1 273 s** (~21 min) | **~7 h** (extrapolado do ritmo medido) |
| ritmo do catálogo | — | **5,4 produtos/min**, 2 790 a semear |
| load average | — | **12** num núcleo · 98 MB livres · 736 MB em swap |

⇒ **O gargalo é a máquina, não o código.** Um núcleo carrega Postgres, Redis, o kernel, a borda e **cinco
frentes** enquanto semeia; o swap é o que mantém isso lento em vez de morto (é literalmente o argumento da
§3 do `bin/provision-host.sh`, visto de dentro).

⚠️ **O que isso significa para um agendamento**, e é a parte que precisa ser decidida e não estimada:

- Uma corrida semanal às 3h da manhã **termina às 10h**, e a caixa passa a manhã inteira degradada. Numa
  DEMO isso é aceitável e deve estar escrito; numa caixa com clientes **não existe** — e é por isso que o
  ciclo é gesto da demo, nunca do produto.
- A **produção** da demo é **2 vCPU e 4 GB** (load 0,85 em regime, medido no mesmo instante). O mesmo ciclo
  lá é materialmente mais rápido, e é a caixa em que o cron de facto vai rodar.
- ⛔ **Não estime — meça na caixa que vai agendar.** Os dois números acima diferem por um fator de vinte, e a
  única coisa que os separa é onde a corrida aconteceu.

### As credenciais, quando nada foi cunhado nesta corrida

Num nascimento, o passo 3 cunha o token de operador de cada tenant e o segura no shell. Os modos
`--warm-only` e `--verdict-only` são perguntados a uma caixa **nascida dias atrás**, por um agendador, numa
máquina que não cunhou nada — então o token volta **da caixa** (`remote_secret_get`), atravessa para uma
variável de shell e **para ali**: não toca disco desta máquina, não entra em linha de comando e não é impresso.

⛔ **Um segredo ausente é recusa, nunca string vazia repassada.** Uma credencial vazia não falha alto na porta:
volta `unauthorized`, que se parece com uma caixa quebrada — e uma corrida agendada que relata o erro errado é
pior do que uma que não relata nada.

---

## 6-ter. A mensagem do fim (`--mail-to`)

`bin/cycle-mail.mjs` manda **uma** mensagem, pelo **relay da própria caixa** — os mesmos `FORGE_SMTP_*` por
onde saem os códigos de acesso da loja, montados pelo `env-source.sh` dela, que é o autor único deles.

- **SMTP à mão, sem dependência e sem fornecedor.** O relay de hoje também atende em HTTP, e um `fetch` teria
  sido quarenta linhas em vez de cento e cinquenta. São as quarenta linhas erradas: a doutrina do produto é
  que uma instância nunca fica presa a um SaaS, e um ciclo que só soubesse se reportar pela API de **uma**
  empresa seria exatamente essa prisão, no script que o operador não tem como evitar rodar.
- **E a mensagem é uma TESTEMUNHA.** Um ciclo que relata verde pelo mesmo relay dos códigos da loja
  demonstrou, na mesma respiração, que aquele relay funciona.
- **Ela sai nos DOIS vereditos.** Mandar só quando quebra é o erro clássico: um agendamento que parou de
  disparar, uma unit que morreu antes do lock, uma máquina reconstruída sem o timer — os três são
  indistinguíveis de uma semana verde. **É o verde semanal que dá sentido ao silêncio.**
- **Ela é a ÚLTIMA coisa, depois do código de saída, e nunca no lugar dele.** Um relay que recusa não muda o
  veredito do ciclo: o `cycle-mail` diz isso no stderr, a mensagem do próprio agendador carrega essa linha, e
  a caixa continua sendo o que o veredito disse que ela é.

⚠️ **O limite, dito em voz alta:** um ciclo que falha **porque** o e-mail da caixa está quebrado não consegue
mandar e-mail sobre isso. Não é buraco a tapar aqui — um segundo canal é uma segunda coisa para configurar,
esquecer e errar. O canal curto do agendador é o reserva, e sempre foi. **Silêncio não é verde.**

### A unit, para uma caixa implantada

```ini
# /etc/systemd/system/forge-demo-cycle.service
[Unit]
Description=Forge Demo — o ciclo semanal da caixa implantada
[Service]
Type=oneshot
User=<user>
WorkingDirectory=/caminho/para/forge-demo
Environment=PATH=/home/<user>/.nvm/versions/node/v24.18.0/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/bash bin/box-cycle.sh --env prod --mail-to <voce@exemplo>
TimeoutStartSec=3h
```

⚠️ **`docker` não é requisito desta máquina** quando o destino é `--env`: quem roda contêiner é a caixa. O que
esta máquina precisa é do **Node** que o release pina (`bin/require-node.sh` recusa por nome, antes de
qualquer leitura) e da **chave ssh** que `deploy/<env>.env` nomeia.

---

## 7. Irmãos

| documento | do que trata |
|---|---|
| `docs/operations/runbook-demo.md` | a caixa online inteira: a ordem do deploy, o que preencher, o reset (§5) |
| `README.md` (este repo) | subir a caixa na bancada, e o porquê de cada peça |
| `bin/box-cycle.sh` | o script — a prosa dele é a versão longa desta página |
| `bin/box-cycle.guard.mjs` | o que fica vermelho se um gesto sumir, a ordem trocar, o perdão virar cego ou uma sentença do `box-up.sh` mudar — e, desde `--env`, se o **plano remoto prometer os comandos da bancada** ou o e-mail passar a decidir o veredito |
| `bin/birth-remote.sh` | o nascimento da caixa que não é esta máquina — e os modos `--warm-only` / `--verdict-only` que os gestos 4 e 5 pedem |
| `bin/cycle-mail.mjs` | a mensagem do fim: SMTP à mão, sem dependência, pelo relay da própria caixa |
