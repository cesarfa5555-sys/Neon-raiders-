// ══════════════════════════════════════════════════════════════════
// HEROI-CONFIG.JS — liga o modelo 3D do Sketchfab (.glb) no lugar do herói de blocos.
//
//  1) Coloque o arquivo .glb na MESMA pasta dos outros arquivos do jogo (sem pastas).
//  2) Troque  ativo: false  por  ativo: true  e escreva o nome do arquivo em "arquivo".
//  3) Abra o jogo e olhe o console: o adaptador mostra quais ossos reconheceu.
//
//  Por personagem você pode ter um modelo diferente (cacador, kunoichi, padrao). Quem não tiver
//  "arquivo" continua com o herói de blocos.  Opções de cada herói:
//    arquivo     nome do .glb
//    altura      altura final do personagem no jogo (padrão 2.7; o herói de blocos tem ~2.8)
//    rotY        gira o modelo (em radianos) se ele vier olhando para o lado errado (3.14159 = de costas)
//    armaEscala  tamanho da arma (1 = padrão) / armaOffset { x, y, z } = ajuste fino da posição da arma
//    ossos       (opcional) forçar o nome exato de um osso se o reconhecimento automático errar:
//                { hips:'Pelvis', head:'Head', coxaL:'thigh_L', canelaL:'calf_L', peL:'foot_L', ... }
//                chaves: hips, neck, head, ombroL/R, bracoL/R, antebracoL/R, maoL/R, coxaL/R, canelaL/R, peL/R, dedoL/R
// ══════════════════════════════════════════════════════════════════
window.NR_HEROI_GLB = {
  ativo: false,
  herois: {
    cacador:  { arquivo: '', altura: 2.7, rotY: 0, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
    kunoichi: { arquivo: '', altura: 2.7, rotY: 0, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
    padrao:   { arquivo: '', altura: 2.7, rotY: 0, armaEscala: 1, armaOffset: { x: 0, y: 0, z: 0 }, ossos: {} },
  },
};
