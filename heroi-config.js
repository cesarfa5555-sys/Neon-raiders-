// ══════════════════════════════════════════════════════════════════
// HEROI-CONFIG.JS — liga os modelos 3D (.glb) no lugar das peças de blocos.  (todos os arquivos na mesma pasta)
//
//  HERÓIS (NR_HEROI_GLB): um .glb por personagem. Personagem sem "arquivo" continua com o herói de blocos.
//    arquivo      nome do .glb                       altura   altura final no jogo (herói de blocos ≈ 2.8)
//    rotY         gira o modelo (radianos) se ele vier olhando para o lado errado (3.14159 = de costas)
//    armaEscala   tamanho extra da arma na mão (1 = o tamanho de ARMAS abaixo)
//  ARMAS (NR_ARMAS_GLB): katana e rifle 3D. Vale para todos os personagens.
//    arquivo      nome do .glb          comprimento   tamanho da arma no jogo
//    ponta/cima   direções do MODELO (ponta da lâmina/cano e o lado de cima) → o jogo gira a arma para ficar certa (ou use giro { x, y, z } em radianos)
//    maos         onde as mãos seguram a arma
//    empunhadura  (katana) onde fica a mão, de 0 a 1 a partir do cabo (0.17 = 17% do comprimento)
//    pos          { x, y, z } posição da arma em relação à cintura do personagem
//  Para desligar tudo e voltar aos blocos: ativo: false.
// ══════════════════════════════════════════════════════════════════
window.NR_HEROI_GLB = {
  ativo: true,
  herois: {
    // Personagens Kenney "Mini Characters" (CC0). Todos têm o mesmo esqueleto e as mesmas animações (idle, walk, sprint, jump, fall, tiro, golpe...).
    // Para trocar de boneco: gere outro .glb do pacote (character-male-a..f / character-female-a..f) e mude o "arquivo".
    // CAÇADOR CYBER → character-male-d (terno preto)
    cacador:  { arquivo: 'heroi-cacador.glb',  altura: 2.7, rotY: 0, armaEscala: 1.0 },
    // OPERADOR PADRÃO → character-male-c (policial)
    padrao:   { arquivo: 'heroi-padrao.glb',   altura: 2.7, rotY: 0, armaEscala: 1.0 },
    // KUNOICHI NEON → character-female-a (roxa, coque escuro)
    kunoichi: { arquivo: 'heroi-kunoichi.glb', altura: 2.7, rotY: 0, armaEscala: 1.0 },
  },
};
window.NR_ARMAS_GLB = {
  ativo: true,
  armas: {
    // KATANA ("samurai sword"): o arquivo vem torto. "ponta" = para onde a LÂMINA aponta no modelo (estava invertido: a mão segurava na lâmina; agora o cabo fica na mão); "cima" = lado do lombo (fica para cima).
    // comprimento = tamanho no jogo (para aumentar/diminuir a katana, mude só este número). empunhadura = onde fica a mão (0 a 1 a partir do cabo).
    // maos = onde as mãos seguram (no espaço da arma; z>0 = em direção à ponta): dir = mão de cima (perto da guarda), esq = mão de baixo (pomo).
    katana: { arquivo: 'arma-katana.glb', comprimento: 3.0, ponta: { x: -0.85, y: 0.313, z: 0.423 }, cima: { x: 0.561, y: 0.49, z: 0.668 }, empunhadura: 0.17,
              maos: { dir: { x: 0, y: 0, z: 0.12 }, esq: { x: 0, y: 0, z: -0.22 } }, pos: { x: -0.3, y: 0.28, z: 0.5 } },
    // RIFLE (Vandal): coronha à esquerda e cano à direita no arquivo → "ponta" = +x. comprimento = TAMANHO DO RIFLE NO JOGO (para aumentar/diminuir, mude este número e escale "maos" junto: dir.z e esq.z crescem na mesma proporção). Era 1.7.
    // maos: dir = mão que ATIRA (no cabo/empunhadura), esq = mão da FRENTE (na guarda do cano).
    rifle:  { arquivo: 'arma-rifle.glb', comprimento: 2.5, ponta: { x: 1, y: 0.06, z: 0 }, cima: { x: 0, y: 1, z: 0 },
              maos: { dir: { x: 0, y: -0.147, z: -0.41 }, esq: { x: 0, y: 0.03, z: 0.29 } }, pos: { x: -0.1, y: 0.45, z: 0.5 } },
  },
};
