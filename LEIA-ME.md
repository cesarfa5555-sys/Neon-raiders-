# NEON RAIDERS — SURVIVAL (Nektra)

Survivor cyberpunk 3D top-down, 100% deitado, ondas infinitas, solo ou co-op online (até 4).
Mistura Survivor.io (joystick, auto-tiro, gemas, cartas de level up, chefes) com Brotato (arena fechada, loja entre as ondas).
Zero arquivos de som e zero .glb: sons, música e modelos 3D são gerados por código.

## TODOS OS ARQUIVOS FICAM NA RAIZ (sem pastas) — feito para Spck Editor e GitHub
Basta colocar todos juntos na mesma pasta e abrir `index.html`.

PÁGINAS: index (abertura) · login · menu · loja (Hangar) · sala (lobby online) · jogo (partida) · ranking · bau
CSS: base.css (compartilhado) · menu.css · loja.css · sala.css · jogo.css
CÉREBRO (roda no celular E no servidor): data.js (todos os números do jogo) · sim.js (simulação) · codec.js (rede binária)
PARTIDA 3D: modelos.js · mundo.js · efeitos.js · desenhista.js · controles.js · interface.js · partida.js
CONTA/REDE/SOM: dados.js · conta.js · guarda.js · rede.js · audio.js · paisagem.js · config-servidor.js · auto-voltar.js · atualizacao.js · manutencao.js
PERFIL (mantido): perfil.js · perfil-ui.js · hud-profile.js · level.js · xp.js · avatars.js · molduras.js · titulos.js · recompensas.js · animations.js
MENUS: menu.js · menu-cenario.js · menu-heroi.js · loja.js · sala.js · ranking.js

## Balancear
Tudo em `data.js` (inimigos, ondas, chefes, habilidades, preços do Hangar). Preços da loja entre ondas: `precoOferta` em `sim.js`.
Zoom/câmera: `AJUSTES` no topo de `mundo.js`.
Se mudar data.js, sim.js ou codec.js, copie os 3 para o servidor e refaça o deploy.

## Firebase
Nenhuma regra nova. `usuarios/{uid}/survivor` guarda compras e recorde. O caminho do baú (`estoqueBauVanguard`) foi mantido por causa das suas regras.

## Novidades desta atualização
- Corrigido o 3D invisível (inimigos, balas, gemas e partículas saíam pretos por erro no buffer de cores).
- Novo no Hangar: **KUNOICHI NEON** (cabelo longo preso em rabo de cavalo, +15% velocidade, +8% crítico) e **KATANA RUBI** (arma corpo a corpo: corte em arco, corte duplo no nível 5, onda de corte no 7, golpe 360° no 8). Compre, EQUIPE 1 personagem + 1 arma; o que você compra já fica equipado.
- Menus, loja entre ondas e tela de resultado redesenhados para caber em celulares deitados (~360px de altura).

## Ranking (Firebase) — recomendado
O ranking já funciona sem mudar nada, mas para ficar rápido adicione o índice nas regras:
```
"ranking": { ".read": true, ".indexOn": ["score"], "$uid": { ".write": "auth != null && auth.uid === $uid" } }
```

## Atualização 3 (ícones, abertura e menu)
- Todos os emojis foram trocados por ícones SVG próprios (`icones.js` — para mudar/criar um ícone, edite a tabela `ICONES`).
- Abertura igual à do Neon Raiders antigo: tela azul da NEKTRA Studios (usa `nektra_logo2.png`), depois o carregamento do jogo.
- `nektra_logo1.png` não é mais usado: pode apagar.
- Menu com ajuste automático de tamanho: todos os botões cabem em qualquer celular.

## ONDE MUDAR PREÇOS E BÔNUS (personagens e armas)
Tudo em `data.js`, dentro de `LOJA`:
- PREÇO: `LOJA.cacador.preco`, `LOJA.kunoichi.preco`, `LOJA.rifle.preco`, `LOJA.katana.preco`
- BÔNUS REAIS: `LOJA.efeitos` (vida/vel = multiplicador, dano = multiplicador, crit = soma). Ex.: `cacador: { vida: 1.15, vel: 1.08 }`
- TEXTO mostrado no Hangar: `bonus` e `desc` de cada item (atualize junto com os números)
- Força da arma em si (dano do rifle/katana por nível): `statsHab` em `sim.js`
Depois de mudar `data.js` ou `sim.js`, copie também para o servidor.
