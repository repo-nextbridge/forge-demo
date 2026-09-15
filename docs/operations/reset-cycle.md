# O ciclo agendado — a caixa renasce, é promovida e é aquecida, numa corrida só

> **Operador.** O que o ciclo **é**, quando ele roda, **o que ele destrói**, o que ele **preserva**, e como
> agendá-lo. É o passo 7 da ordem de deploy em `docs/operations/runbook-demo.md` (§2), e o degrau que precede
> o staging da Demo: provar o ciclo **local**, à mão, antes de existir CI/CD.

**O comando:**

```bash
bash bin/box-cycle.sh --promote <tailnet|localhost|hostname>
```

---

## 1. Os quatro gestos, e a ordem é a decisão

| # | gesto | o que roda |
|---|---|---|
| 1 | a caixa morre | `bash bin/box-down.sh` |
| 2 | a caixa nasce (sem aquecer) | `bash bin/box-up.sh --no-warm` |
| 3 | a caixa é **promovida** | `bash bin/box-up.sh --promote <destino>` |
| 4 | a caixa é **aquecida**, já no endereço promovido | `bash bin/box-up.sh --warm-only` |

**UM script, UM agendamento.** ⛔ Não são quatro entradas de crontab. Três razões, todas medidas nesta árvore:

1. **A ordem já é a decisão e já tem guard.** `bin/reset-complete.guard.mjs` existe para provar que o
   nascimento *renasce → purga a borda → aquece → gradua*. Repartido em horários, isso vira aritmética de
   relógio — e **relógio não é dependência**: numa noite em que o seed demorar mais, a entrada das 04:00
   dispara contra uma caixa ainda semeando, aquece nada e reporta verde.
2. **Os passos já são um script só.** `bin/box-up.sh` são quinze passos que existem cada um porque o anterior
   produziu algo de que ele precisa. O ciclo **orquestra**; nada dessa lógica é reimplementado aqui.
3. **O código de saída tem de ser decidido num lugar só.** `box-up.sh` sai 1 de propósito por sete razões
   diferentes. Um agendamento que alerta em qualquer não-zero alerta toda noite; um que ignora não-zero não
   alerta nunca. Quem resolve isso é o ciclo — §4.

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

⚠️ **E o laço que aquece não é copiado para o `box-cycle.sh`.** Aquecer é uma vez **por tenant, com o token
daquele tenant** — a face de leitura resolve o tenant pela **credencial** — e a regra do nome do segredo de um
tenant já tem dois autores. Por isso o gesto 4 pede `--warm-only` ao próprio `box-up.sh`, que dirige o mesmo
`warm_every_tenant` do passo 14. Uma terceira cópia dessa regra aqui envelheceria no dia em que um tenant
entrasse no `seed/box.json`.

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

**Hoje: nenhum.** `cycle_verdict` em `bin/box-cycle.sh` é *"qualquer não-zero é vermelho"*, e a lista de
perdões (`CYCLE_TOLERATED`) está **vazia de propósito**.

⛔ **Está vazia porque nada foi medido ainda.** Uma lista escrita por antecipação é a doença que o
`bin/verify-config.mjs` já nomeia: *"the obvious answer is a checklist, and the checklist is the disease"*.
⇒ Rode o ciclo de verdade, leia o log, e **só então** escreva a entrada — com a medição colada nela.

★ **O candidato que já se espera**, dito para que a primeira corrida saiba o que está olhando: o gesto 2 é o
nascimento de uma caixa que **estava promovida**, então ele pode terminar `MISCONFIGURED` — exatamente a
des-promoção da §1, que o gesto 3 então conserta. ⚠️ Mesmo assim **não** está escrito: `box-up.sh` sai 1 por
sete razões e o status sozinho não as distingue — um perdão para "2 saiu 1" perdoaria também uma caixa com
portas que o comprador não abre. O que a primeira corrida tem de produzir é a **linha do log** que nomeia a
razão. Se o perdão não puder ser estreitado a uma razão só, o conserto é um **código de saída próprio** no
`box-up.sh` para o caso meio-promovido, não um perdão genérico aqui.

⚠️ **O ciclo não para no primeiro vermelho.** Ele roda os quatro gestos e gradua no fim, porque o único
não-zero já esperado é consertado pelo gesto seguinte. Parar ali deixaria a caixa exatamente no estado que o
ciclo existe para acabar.

**Os códigos do ciclo:**

| saída | significado |
|---|---|
| **0** | os quatro gestos rodaram e nenhum voltou sujo |
| **1** | algum gesto voltou não-zero sem perdão (ou a corrida não consegue prestar contas de todos os gestos) |
| **2** | recusou **antes de tocar em qualquer coisa** — sem node, destino não declarado, argumento desconhecido |
| **3** | outra corrida está com o lock |

---

## 5. Como conferir sem tocar em caixa nenhuma

```bash
bash bin/box-cycle.sh --plan --promote demo.exemplo.com   # o roteiro; ⛔ não cria nem o diretório de log
bash bin/box-cycle.sh --dry-run --promote demo.exemplo.com # lock + log + roteiro + veredicto, sem executar gesto
bash bin/test.sh                                           # bin/box-cycle.guard.mjs, entre os outros
```

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

⚠️ **Janela.** ~19 min de nascimento + a promoção + o aquecimento (teto histórico ~1h10, hoje limitado por
**progresso** e não por relógio). Reserve ~2 h e meça a primeira corrida: o log traz o relógio de cada gesto.

---

## 7. Irmãos

| documento | do que trata |
|---|---|
| `docs/operations/runbook-demo.md` | a caixa online inteira: a ordem do deploy, o que preencher, o reset (§5) |
| `README.md` (este repo) | subir a caixa na bancada, e o porquê de cada peça |
| `bin/box-cycle.sh` | o script — a prosa dele é a versão longa desta página |
| `bin/box-cycle.guard.mjs` | o que fica vermelho se um gesto sumir ou a ordem trocar |
