# Esta caixa cobra no balcão

> Uma capacidade nova desta instância: o pedido feito no totem é **pago ali**, na maquininha ou no QR da
> tela, e entra na mesma fila do admin que todos os outros. Sem PSP, sem integração nova, sem tocar no kernel.

Esta página **nomeia o poder**. Os campos, os envelopes e as respostas exatas estão no
`README.md` do app (`apps/payment-pos/`) e no `CONTRATO-POS.md` da onda; aqui está o que passou a ser
possível, e o que isso custa.

## O que passou a existir

Até agora esta caixa sabia cobrar de um jeito só: pela internet, com um provedor de pagamento que a
plataforma oferece. Um balcão não é isso. No balcão o dinheiro **já se moveu** quando o software fica
sabendo: o cliente encostou o cartão na maquininha, ou apontou a câmera para um QR na tela do totem.

`payment-pos` é o app que traduz essas duas cenas para a porta única do kernel:

| a cena no balcão | o método neutro | o que o kernel registra |
|---|---|---|
| "pague na maquininha" | `card` | **pago, na hora** |
| "aponte a câmera no QR" | `pix` | **aguardando**, até o pagamento ser reconhecido |

O pedido resultante não é especial em nada: mesmo `order.number`, mesma loja, mesma fila do admin, mesmo
nome de quem retira. É essa a prova — **uma experiência de venda inteiramente nova não precisou de um kernel
diferente.**

## Por que é um app desta caixa, e não uma configuração

A plataforma já traz um app de pagamento de teste (`payment-reference`) que chega perto. Duas medições
fecharam a porta, e as duas são do app, não do kernel:

1. **O modo do PIX dele é config UNIVERSAL.** Ligar o auto-aprovar para o balcão ligaria também para a loja
   de cafés, e o "aguardando pagamento" vivo dela é uma das coisas que a demo existe para mostrar.
2. **A porta de liquidação dele é inalcançável por uma tela.** Ela precisa de um `provider_ref` que o
   `initiate` dele nunca devolve.

O `payment-pos` resolve a segunda com **um campo**: ele devolve o ref dentro do próprio envelope. E resolve
a primeira por existir separado. Custo total no kernel: zero linha.

## A espécie que isto prova

Esta caixa já tinha um app seu, o `demo-gate` — mas o `demo-gate` é **tela**. Um *driver de pagamento* é a
outra ponta: ele participa da parte do kernel que move dinheiro, com o mesmo mecanismo de composição e sem
nenhuma permissão especial.

A doutrina que sustenta isso é a dos **dois eixos**: o que a plataforma OFERECE e o que uma caixa COMPÕE são
listas diferentes. Um app da instância entra só na segunda, e a imagem que o compõe sai carimbada
`offerable: false` — o portão de release recusa promovê-la. Ver `docs/concepts/instance-owned-apps.md` no
monorepo.

## ⚠️ O que esta capacidade custa, dito antes de alguém descobrir

### 1. Uma porta pública que aprova pagamento

A simulação do escaneio ("toque no QR") é um `POST` **sem autenticação** que liquida um pedido de verdade.
Ela só é aceitável porque este app **nunca é ofertado a ninguém**. O que a segura é o ref ser opaco e sair do
kernel num lugar só, mais duas recusas que são **do kernel** (ref que não existe; segunda liquidação do mesmo
pedido). Está tudo escrito, com as linhas, no README do app.

**Numa caixa que a plataforma vende, isto seria uma vulnerabilidade.** Não copie o padrão para um app OOTB.

### 2. Instalar oferece em TODAS as lojas do tenant

Instalação é **por tenant**, por construção: `extension_installation` tem índice único
`(extension_id, tenant_id)` (`system/0008`). O que é por loja é a *colocação* de bloco — e um provedor de
pagamento não passa por colocação para ser oferecido, ele é resolvido direto da instalação.

Consequência concreta nesta caixa: com o `payment-pos` instalado, ele aparece como provedor **também** no
checkout da loja de cafés e do outlet.

> ⚠️ **A frase que estava aqui envelheceu, e ela sustentava a decisão.** Este parágrafo dizia que "hoje
> **nenhum** provedor de pagamento está instalado no tenant", logo o `payment-pos` viraria o **único** provedor
> de `pix`/`card` de todas as lojas. Medido em 02/09 na caixa viva, `read.payment_methods` do tenant
> `forgecafe` responde com **três** provedores instalados — `payment-reference` (pix `manual` + card),
> `payment-mercadopago` e `payment-zero`. O `payment-pos` entra portanto como **mais um chip numa lista**, que
> é o cenário menos grave dos dois. O que continua verdade é o resto: a instalação é por tenant, ele aparece
> nas outras lojas, e o `card` dele liquida na hora e de graça.

#### ★ E a pior consequência disso já mordeu: o bloco falava por cobrança dos outros

Medido em 07/09 (caderno pk21 §R3), na caixa viva. Um pedido na **loja de cafés**, cobrado pelo
**`payment-reference`**, no **cartão**, com Entrega Expressa e endereço de entrega, recebeu na confirmação a
frase deste app — *"Pagamento confirmado. Retire no balcão quando chamarmos o seu nome."* — logo acima do
bloco que mostrava a transportadora e a previsão de sexta.

A causa era a **pergunta**, não o texto: o bloco olhava o **método neutro** (`method !== 'pix' && method !==
'card'`), e método neutro é vocabulário da casa — ele não diz **quem** recebeu. Como a instalação é por
tenant, todo pedido de cartão ou pix de qualquer loja do tenant casava.

**Agora quem compara é o ponto de render, não o app.** A confirmação sabe duas coisas que nenhum app sabe
sozinho — **qual app ela está chamando** e **quem o kernel diz que cobrou** — e entrega o veredicto pronto a
cada bloco (`settledByThisApp: 'yes' | 'no' | 'unknown'`, `pk23/p4` no produto). O `payment-pos` **cala em
`'no'`** e desenha nos outros dois.

⚠️ **Por que o app não reconhece o próprio id:** ele teria de **escrevê-lo à mão** — não dá para importar o
próprio manifesto sem arrastar o `@forgeco/contracts` para o bundle da frente — e aí um *fork* ou um
*rename* recolocaria o defeito **em silêncio**.

⚠️ **E `'unknown'` NÃO é `'no'`.** `'unknown'` é *"o kernel não nomeou ninguém"* — nenhuma tentativa de
pagamento foi aberta. É população **real** desta caixa e não um buraco: `apps/api/src/seed-history.ts:551,676`
deixa os pedidos `pending_payment` no `place_order` e **nunca** chama `payment.initiate`, então o passado da
demo carrega dezenas de pedidos sem tentativa — desenhados tanto na confirmação quanto na página de pedidos da
conta. Ler isso como negativa apagaria uma tela que não é sobre a cobrança de ninguém.

⛔ **Trocar a frase não teria consertado nada** — ela está certa para quem pagou no balcão.

### 2b. Composto ≠ instalado — e é a instalação que falta

⛔ **Medido em 02–03/09: o `payment-pos` está NA IMAGEM e NÃO está INSTALADO no tenant** — são duas perguntas
diferentes e só a primeira é responsabilidade deste repositório.

* **Composição (nossa, verde):** `docker exec <kernel> cat /app/composition.json` lista `payment-pos` entre os
  20 apps de `demo-instance`. `composition.json` e `forge.lock` concordam. Nada a fazer.
* **Instalação (dado da caixa, vermelho):** o admin mostra o app como *"Disponível / Instalar"*, e
  `GET /v1/read/payment_methods?store=<balcao>` não traz `payment-pos` entre os `providers`.

O efeito é o **segundo bloqueio do totem**, atrás do da cotação: com o carrinho pronto e a retirada escrita,
`checkout.place_order` recusa

    400 {"code":"validation_failed","message":"the chosen payment app is unavailable",
         "details":{"reason":"payment_app_unavailable","method":"pix"}}

⚠️ e note **onde** ele recusa: `cart.set_payment_method` com `payment_app: "payment-pos"` responde **200** num
tenant que não tem o app. A disponibilidade só é conferida no fechamento — então "a tela deixou escolher" não é
prova de que o app existe.

Nenhum `seed/*.mjs` instala o `payment-pos`: `seed/coffee.mjs` instala `['subscriptions','reviews']` e
`seed/totem.mjs` não instala nada. Quem instala apps nesta caixa é o recheio, e é lá — ou no `seed/totem.mjs`,
que é a certidão de nascimento do balcão — que a instalação precisa nascer.

Não há conserto dentro desta onda: um portão de oferta por loja seria mudança de kernel. Está aceito e
carimbado como propriedade conhecida desta caixa, e carded como trabalho de produto. A mitigação que existe é
honesta e pequena: **o app se chama por um lugar** ("Pagar no balcão"), para que a aparição dele fora do
balcão leia como configuração errada e nunca como oferta legítima.

## ★ E o pedido que uma recarga deixou aberto pode ser TERMINADO no próprio totem

Capacidade nova (C5, 05/09). Uma recarga de página é a única saída do fluxo do balcão que nunca passa pelo
reset: o cookie sobrevive e o estado da tela não. Com o QR do PIX na tela, isso deixava um pedido **colocado e
não pago** que ninguém mais conseguia liquidar — o `provider_ref` e o copia-e-cola moravam no estado do
componente e a recarga os destruía. A pk9 fez a tela **dizer** isso ("chame um atendente"); ela não recuperava
nada.

**Agora o painel de espera oferece "Retomar o pagamento do pedido N", e a tela volta para o mesmo QR.**

⚠️ **Sem um segundo lugar de verdade, e sem risco de segunda cobrança.** O envelope não é lembrado por
ninguém: ele já está persistido na *tentativa* de pagamento, e `read.payment` o publica **verbatim** — leitura
pública, PII-zero, anônima. O totem **relê** em vez de guardar. Não há cookie novo, não há URL com capacidade
dentro, e uma leitura não cobra ninguém.

⚠️ **E não é `payment.initiate(..., resume: true)`, que era o caminho óbvio.** O `resume` existe para o QR
**expirado**: ele força o adapter a reinvocar o app para que este possa responder `attempt_failed`. Aqui ele
não compraria nada e custaria uma chamada a provedor — o `payment-pos` deriva os dois campos do
`idempotency_key` (o id da tentativa, que não muda), então uma reinvocação só reproduz byte a byte o que a
leitura acabou de responder. O único caso que a leitura não responde é a tentativa reivindicada e nunca
invocada (`next_action: null`), e aí um `payment.initiate` **simples** basta: o kernel reentra na MESMA
tentativa com a MESMA chave. **Um pedido, uma cobrança**, por construção.

O botão só aparece para um pedido que o kernel diz estar **aguardando**: pedido pago, tentativa recusada ou
encerrada não voltam a desenhar QR nenhum. E ele é um botão **ao lado** do painel, nunca dentro — o próximo
cliente continua conseguindo começar o pedido dele com o mesmo toque de sempre.

## ★ E um QR ABANDONADO não fica mais na tela: o balcão estaciona o pedido e se libera

Capacidade nova. A tela do QR era a única do totem sem relógio de inatividade — medido na bancada: **cinco
minutos** parados, sem aviso e sem reset. Isso era deliberado e tinha uma razão medida (uma tela que se reseta
enquanto alguém paga escreve uma dívida no kernel), mas a conta era paga pela **fila**: o próximo cliente
chegava num totem ocupado com o pagamento vivo de um estranho na tela.

**Agora a tela do QR tem o MESMO regime das outras** — a mesma janela, a mesma pergunta "Você ainda está aí?"
— e só o **fim** é diferente: em vez de esquecer, o balcão **estaciona** o pedido e o entrega ao painel de
espera, que volta a oferecer "Retomar o pagamento do pedido N" (a mesma saída da seção acima). Qualquer toque
devolve a janela inteira, então quem está pagando no app do banco é **perguntado** antes, nunca despejado.

⚠️ **A pergunta diz a verdade DESTA tela.** Nas outras ela avisa que o pedido é apagado; aqui isso seria
falso — o pedido já está no kernel e não é apagado por nada que a tela faça. A frase nomeia o número e diz que
ele continua registrado.

★ **O que tornou isso possível foi uma mudança de fato, não de opinião.** A isenção antiga se apoiava em a
tela guardar a ÚNICA cópia da capacidade de liquidar. Desde que a recuperação virou uma **leitura** (seção
acima), qualquer superfície que consiga **nomear** o pedido põe o QR de volta — então sair da tela deixou de
significar esquecer. A janela do próprio PIX (`expires_in`) continua como limite externo: vale a menor das
duas.

⚠️ **Pergunta de produto que fica aberta:** um pedido criado e nunca pago **expira no kernel?** Medido nesta
caixa: um pedido abandonado no QR continuava `pending_payment` horas depois. Enquanto não houver resposta, o
que o balcão faz é liberar a si mesmo — nunca cancelar coisa nenhuma.

## ★ E o recibo do balcão FECHA: o que foi cobrado aparece linha a linha

Capacidade nova. A tela "Pagamento confirmado" listava os itens a preço cheio e, logo abaixo, um total menor,
**sem nenhuma linha de desconto** — medido num pedido de 11 itens: R$ 156,00 de linhas sobre "Total pago ·
Pix R$ 137,40", e nada explicando os R$ 18,60 de diferença. A tela de revisão do mesmo totem já sabia
desenhar a linha do combo; a confirmação não desenhava nenhuma.

**Agora a confirmação imprime subtotal, uma linha POR promoção e o total pago** — e cada número vem do
**pedido** (`read.order_confirmation`), nunca copiado da tela de revisão. Uma promoção por linha é medida, não
estética: um pedido do balcão carregava duas ao mesmo tempo, e colapsá-las numa linha só põe o nome de uma
sobre o dinheiro das duas.

★ **E foi a mesma correção que fechou o pior achado do balcão:** pagar de novo depois de "Trocar forma de
pagamento" mostrava **R$ 0,00** no segundo QR e um resumo vazio no recibo, porque a tela lia o CARRINHO —
gasto pelo primeiro `place_order` — em vez do pedido. O kernel nunca cobrou zero (medido na bancada: um único
`payment_intent` de R$ 5,40, aprovado); a mentira era só da tela. A régua que ficou escrita: **uma tela não
afirma sobre o PEDIDO o que só sabe sobre SI.**

## Onde isto é provado

* `apps/payment-pos/provider.test.ts` — `card` liquida no `initiate`; `pix` não liquida e devolve o ref; a
  porta do escaneio recusa o que não é uma cobrança PIX aberta deste app.
* `bin/pos-after-payment.guard.mjs` — **rodado por `bash bin/test.sh`**: `'yes'` desenha, `'no'` cala (a
  falha reproduz a frase do defeito), `'unknown'` **desenha** (e a falha explica por que não é `'no'`), e o
  app **não** pode reconhecer o próprio id. Com `FORGE_MONOREPO=<checkout>` ele ainda cobra do produto o
  **nome do campo e os três membros** do union — um membro renomeado faria o `=== 'no'` casar com nada, em
  silêncio. Nasceu em `bin/` porque, até a `pk24/d3`, as suítes vitest de `apps/payment-pos/` não eram
  coletadas por comando nenhum deste repositório — medido: `bin/test.sh` varria só `bin/` e `seed/`, e
  `bin/fork-suite.guard.mjs` enxerga só quem depende do kit. **Isso mudou:** hoje as duas suítes rodam.
* `apps/payment-pos/manifest.test.ts` — os métodos neutros, as janelas em minutos, os toggles, e a regra de
  cópia que o guard do monorepo não alcança um app da instância para cobrar.
* `bin/instance-app.guard.mjs` — **quem roda as duas suítes acima**, e o compilador que nunca as tinha lido.
  Um app desta instância não chega ao forno sem ter sido compilado e testado: o guard deriva a lista de quem
  declara `forge.origin: "instance"` (a mesma propriedade que o forno exige, `bin/build-local.sh:114`), liga
  as dependências a partir de um checkout do Forge, roda `tsc` e a suíte de cada app, e por fim cobra que a
  lista de `instanceApps` do `composition.json` — a que o forno copia — seja exatamente a que ele acabou de
  compilar e rodar. Sem checkout do Forge na máquina ele diz **NOT CHECKED**, nunca verde.
* `totem/src/lib/pos.recover.test.ts` — a recuperação é uma LEITURA (nenhuma escrita), o `resume` fica
  desligado, e um pedido já pago não volta a oferecer QR.
* `totem/src/components/Totem.reload.test.tsx` — o painel oferece a saída, o toque nomeia o pedido pelo id, e
  **nenhum render** alcança a porta de pagamento.
* `totem/src/app/actions.receipt.test.ts` — um segundo "Pagar" no carrinho já gasto diz o total do PEDIDO e
  lista os itens dele; um pedido que a porta não descreve mostra "—" e nunca R$ 0,00.
* `totem/src/components/Totem.receipt.test.tsx` — a confirmação desenha subtotal, uma linha por promoção e o
  total pago; sem desconto não inventa linha nenhuma.
* `totem/src/components/Totem.idle.test.tsx` — a tela do QR pergunta, um toque devolve a janela inteira, e o
  silêncio ESTACIONA o pedido: o painel volta a nomeá-lo e a recuperação chama a porta por aquele id.
* `RELATORIO-T-B.md` (nos briefs da onda) — as sabotagens medidas e o pedido de verdade pago pelos dois
  métodos.
