# Animação dos personagens (Kenney Mini Characters)

## Arquivos
- `heroi-glb.js` — carrega os personagens e toca as animações que vêm DENTRO do .glb (idle, walk, **sprint**, jump, fall, segurar arma, tiro, golpe).
- `heroi-config.js` — qual .glb é cada personagem (`arquivo`, `altura`, `armaEscala`) e as armas (`NR_ARMAS_GLB`).
- `heroi-padrao.glb` (Operador Padrão = character-male-c) · `heroi-cacador.glb` (Caçador Cyber = character-male-d) · `heroi-kunoichi.glb` (Kunoichi Neon = character-female-a). A textura já está dentro de cada arquivo.
- `modelos.js` + `animador.js` + `anim-dados.js` — o herói de BLOCOS antigo. Só entra se um .glb falhar ao carregar (rede de segurança). Se quiser, pode apagar os dois últimos junto com os scripts deles nos .html, mas aí um erro de carregamento deixa o herói invisível em vez de cair nos blocos.

## Como a animação funciona
- **Parado → andar → correr:** os 3 clips (idle, walk, sprint) são misturados de forma contínua pela velocidade real do jogador. O ritmo da passada acompanha a velocidade do chão, então o pé não patina.
- **Arma na mão direita:** o braço direito usa o clip `holding-right`; a arma (.glb) fica presa ao osso do braço. O braço esquerdo balança com a corrida.
- **Tiro:** `holding-right-shoot` (coice do braço/tronco). **Katana:** `attack-melee-right` (a lâmina acompanha o braço no golpe).
- **Dash:** o clip de pulo rodando rápido + inclinação para frente. **Pouso:** agachada + poeira e onda no chão (eventos `pouso`/`passoE`/`passoD` que o desenhista já usava).
- **Corpo e mira:** o corpo vira para onde corre; o tronco e a cabeça giram para o inimigo mais próximo (até 14,5 u com rifle, 7,2 u com katana), mesmo correndo para outro lado.
- Cada clip é fatiado por parte do corpo (pernas / tronco / cabeça / braço E / braço D) e os pesos de cada parte sempre somam 1 — por isso correr + segurar arma + atirar + pular não brigam entre si.

## Botão PULAR
- Botão rosa à esquerda do DASH (tecla **J** ou **K** no computador). É um pulo VISUAL do seu personagem (não muda a simulação nem o servidor: não esquiva de dano, e no co-op só você vê o pulo). Altura/duração: `PULO_V` e `GRAV` no topo de `heroi-glb.js`.

## Ajustes rápidos
- Tamanho do personagem: `altura` em `heroi-config.js`. Tamanho da arma: `comprimento` de cada arma (e `armaEscala`).
- Pés patinando na corrida: `V_SPRINT` / `V_WALK` no topo de `heroi-glb.js` (maior = passada mais lenta para a mesma velocidade).
- Quando vira "correr": `sm(2.6, 4.2, vs)` em `passo()` (velocidade do jogador em unidades/s; o jogador base anda a 5,2).
- Trocar de boneco: pegue outro `character-male-a..f` / `character-female-a..f` do pacote Kenney (todos têm o mesmo esqueleto e animações) e troque o `arquivo`.

## Mapa (sem peças)
O jogo agora usa só o cenário cyberpunk feito em código (`mundo.js`, `AJUSTES.ambiente = 'cyberpunk'`). As peças do mapa (`mapa-espaco.js` + 12 `esp-*.glb`) foram removidas e podem ser APAGADAS do projeto. Também já tinham saído: `mapa-hex.js`, `natureza.js`, `hex-*.glb`, `cyber_ak_rifle.glb`, `cyberpunk_katana.glb`, `heroi-cyber.glb`.

## Menu e loja
Só a animação de ficar parado (idle). A vitrine continua girando devagar; não corre, não atira e não golpeia mais.

## Tiro dos amigos: distância em metros (online)
- `partida.js` (`processarEv`) calcula a distância entre você e o amigo que atirou (1 unidade do mapa = 1 m) e o lado (esquerda/direita). `audio.js` repassa isso ao `tiro-sintetizado.js` (`distance`, `x` — o "Distância (m)" do tiros.html).
- Volume = 1/distância (4 m de referência: perto = alto, 35 m ≈ 12%, 100 m ≈ 4%), agudos somem com a distância e o som sai pelo lado do amigo. Abaixo de ~2% de volume o tiro nem toca. Ajuste: `atenua` em `tiro-sintetizado.js` (`4 / (4 + 0.9 * (dist - 4))`; troque o 0.9 por um número menor para o som alcançar mais longe).
- **Estralo corrigido:** os tiros dos amigos chegam em bloco (vários no mesmo instante) e somavam; agora cada um recebe um atraso aleatório de 4–44 ms, folga maior no agendamento do áudio (12 ms) e limitador próprio (não disputa mais com o seu tiro).

## Botão ATIRAR e modo de tiro
- **Onde escolher:** Pausa (dentro da partida) e Menu → Ajustes: botão **TIRO: AUTOMÁTICO / POR BOTÃO**. Fica guardado no aparelho (`NRAudio.modoTiro()`).
- **Automático:** como sempre — o rifle/katana atacam sozinhos o inimigo mais perto.
- **Por botão:** aparece o botão laranja **ATIRAR** (acima do DASH; tecla **F** no computador). O herói só ataca enquanto você segura. Com inimigo por perto mira nele; sem inimigo atira para onde você anda (parado: para onde mirava). Vale para o rifle e para a katana. Drones continuam automáticos.
- Lógica em `sim.js` (`p.manual` / `p.atira` em `entrada()` e `habilidades()`); botão em `partida.js`/`interface.js`/`jogo.html`/`jogo.css`.
- **Online:** a entrada enviada ao servidor ganhou os campos `manual`, `atira` e `pulo`. O `SalaRoom.js` original descartava esses campos — a versão nova (pasta `servidor/`) repassa para o sim.

## Cadência e dano do rifle (arma inicial × RIFLE PLASMA)
- **Arma inicial** (quem não comprou nada): `RIFLE_INTERVALO_BASE = 0.5` em `sim.js` (2 tiros/s), dano 16 — igual ao de sempre.
- **RIFLE PLASMA** (comprado no Hangar): `RIFLE_INTERVALO_PLASMA = 0.14` em `sim.js` (~7 tiros/s) e dano por tiro **5% menor** que o da arma inicial: `LOJA.efeitos.arma.rifle.dano = 0.95` em `data.js` (antes era 1.2). Para outro valor, mude esses dois números.
- Nível 4+ da carta "Cadência +18%" continua valendo para as duas.
- O servidor (`servidor/`) usa o MESMO `sim.js` e `data.js`: foi por isso que no online todo mundo atirava a 0.5 — o servidor ainda tinha o `sim.js` antigo. Copie `sim.js`, `data.js` e `SalaRoom.js` para o servidor e faça o deploy.

## Pulo visto pelos outros jogadores (online)
O pulo é só visual, mas agora o servidor avisa os outros celulares: `sim.js` ganhou o evento `EV.PULO` (28), `SalaRoom.js` repassa o campo `pulo` da entrada, e `partida.js` (`processarEv`) faz o boneco do outro jogador pular. O seu pulo continua instantâneo no seu celular.

## Som que estourava e calava (corrigido)
Cada tiro criava a sua própria cadeia de efeitos (saturador + filtros) e a mantinha 5 s no ar: metralhando, acumulavam dezenas de cadeias → o áudio estourava e parava. Agora `tiro-sintetizado.js` usa UMA cadeia permanente e limita as vozes simultâneas (acima de 8 só toca estalo/corpo/soco/grave; acima de 14 pula o tiro). O cartucho caindo ficou mais raro.

## Poças d'água, habilidades e áudio nas ondas altas
- **Poças:** `pocas.js` foi removido (e a carga dele no `jogo.html`/`partida.js`). O `desenhista.js` ainda tem 3 linhas `pocas && ...` que agora nunca disparam (inofensivas).
- **Habilidades e passivas removidas (TUDO):** saíram as 5 habilidades extras (drones, EMP, tesla, granada, orbital) e também as 8 passivas (dano, cadência, velocidade, vida, regen, ímã, crítico, dash/propulsores). Não existem mais cartas de level up nem a loja de passivas entre as ondas (`ORDEM_PAS = []` e `ORDEM_HAB = ['rifle','katana']` em `data.js`). Subir de nível agora só cura 10% e mostra o aviso; a cápsula cura 30%; no fim de cada onda a arena é limpa, todo mundo cura 25%, quem caiu no co-op revive e a próxima onda começa direto (`abrirLoja()` em `sim.js` virou "fim de onda"). O contador de sucata sumiu do HUD. O ÚNICO ataque que sobrou é o da arma equipada (rifle ou katana, fixo), porque sem ele o herói não ataca; para tirar também, apague os blocos "RIFLE PLASMA" e "KATANA RUBI" em `habilidades()` (`sim.js`). Código morto que pode ser apagado depois: `gerarCartas/abrirCartas/escolher`, `ofertar/comprar/rerolar`, `pulsoEMP`, `lancarGranada` no `sim.js`, e as telas de cartas/loja em `interface.js`/`jogo.html`.
- **Áudio que calava nas ondas altas (20–44):** `audio.js` agora tem (1) ORÇAMENTO DE VOZES: acima de 16 sons ao mesmo tempo descarta os menos importantes (acertos, gemas, passos); acima de 26, também mortes/tiros de inimigos/cortes; acima de 36, só os essenciais (dano, tiro). (2) VIGIA a cada 1,5 s: se a saída de áudio travar (valor inválido/NaN, contexto "interrupted"), ele refaz o compressor/volume mestre sozinho e volta a tocar. Se ainda calar, abra o console (chrome://inspect) e procure `[audio] refazendo...` — me mande a mensagem.

## Partida só com waves, XP e nível
- Sem cartas de level up, sem loja entre ondas (kit de reparo, bônus de créditos, rerolar, sucata) e sem itens/baús no chão (cura, ímã, bomba e cápsula pararam de cair: `soltarItem()` em `sim.js` virou vazio). Sobraram: inimigos por onda, gemas de XP, nível e a arma equipada.
- **As cartas e a loja vêm do SERVIDOR no online.** Com o `sim.js` antigo no servidor elas continuam aparecendo. Por segurança o cliente novo (`partida.js`) responde sozinho (escolhe a 1ª carta / pula a loja) sem mostrar nada, mas o certo é subir o `servidor/sim.js` novo.
- O "Baú Neon" do MENU (`bau.html`, botão `btnBau` em `menu.js`) é outra coisa (fora da partida) e NÃO foi mexido. Para tirar: apague `bau.html` e a linha `$('btnBau').onclick...` em `menu.js` (e o botão em `menu.html`).
