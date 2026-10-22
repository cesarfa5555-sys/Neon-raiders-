// ══════════════════════════════════════════════════════════════════
// HEROI-CONFIG.JS — liga os modelos 3D (.glb) no lugar das peças de blocos.  (todos os arquivos na mesma pasta)
//
//  HERÓIS (NR_HEROI_GLB): um .glb por personagem. Personagem sem "arquivo" continua com o herói de blocos.
//    arquivo      nome do .glb                       altura   altura final no jogo (herói de blocos ≈ 2.8)
//    rotY         gira o modelo (radianos) se ele vier olhando para o lado errado (3.14159 = de costas)
//    emissivo     (opcional) cor hexadecimal de brilho neon espalhada no modelo (visual "cyber")
//    armaEscala / armaOffset { x, y, z }   ajuste fino do tamanho/posição da arma na mão
//    ossos        (opcional) forçar o nome exato de um osso se o reconhecimento automático errar:
//                 { hips:'Pelvis', head:'Head', coxaL:'thigh_L', ... }  chaves: hips, neck, head, ombroL/R, bracoL/R,
//                 antebracoL/R, maoL/R, coxaL/R, canelaL/R, peL/R, dedoL/R
//  ARMAS (NR_ARMAS_GLB): katana e rifle 3D. Vale para todos os personagens.
//    arquivo      nome do .glb          comprimento   tamanho da arma no jogo
//    giro         { x, y, z } em radianos para a PONTA/CANO apontar para +z (frente)
//    empunhadura  (katana) onde fica a mão, de 0 a 1 a partir do cabo (0.17 = 17% do comprimento)
//    pos          { x, y, z } posição da arma em relação à cintura do personagem
//  Para desligar tudo e voltar aos blocos: ativo: false.
// ══════════════════════════════════════════════════════════════════
window.NR_HEROI_GLB = {
  ativo: true,
  herois: {
    // CAÇADOR CYBER → soldado tático low poly (rosto, colete, botas, dedos e clavículas) com brilho ciano
    cacador:  { arquivo: 'heroi-cyber.glb', altura: 2.7, rotY: 0, emissivo: 0x0a3340, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
    // OPERADOR PADRÃO (caçador normal) → soldado de capacete com visor
    padrao:   { arquivo: 'heroi-padrao.glb', altura: 2.7, rotY: 0, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
    // KUNOICHI continua com o modelo de blocos (sem "arquivo")
    kunoichi: { arquivo: '', altura: 2.7, rotY: 0, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
  },
};
window.NR_ARMAS_GLB = {
  ativo: true,
  armas: {
    // KATANA: no arquivo ela está deitada no eixo X com a ponta para -X → gira 90° em Y para a ponta ir para a frente
    katana: { arquivo: 'arma-katana.glb', comprimento: 2.0, giro: { x: 0, y: Math.PI / 2, z: 0 }, empunhadura: 0.17, pos: { x: -0.3, y: 0.28, z: 0.5 } },
    // RIFLE (AK ciberpunk): já vem com o cano para +z; fica centrada no peito
    rifle:  { arquivo: 'arma-rifle.glb', comprimento: 1.45, giro: { x: 0, y: 0, z: 0 }, pos: { x: 0.1, y: 0.34, z: 0.9 } },
  },
};
