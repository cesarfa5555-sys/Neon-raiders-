# Animação do herói — como funciona e como mexer

## Arquivos
- `animador.js` — o cérebro: recebe velocidade/mira e devolve a pose (ângulos). Não tem nada de 3D.
- `anim-dados.js` — o salto REAL (captura de movimento Mixamo, do FBX que você mandou) em ângulos. Usado no DASH.
- `modelos.js` — o herói de blocos (esqueleto com juntas: quadril, coluna, pescoço, coxa, joelho, pé, ombro, cotovelo) que aplica a pose.
- `heroi-glb.js` + `heroi-config.js` — colocam o modelo 3D do Sketchfab no lugar, com a MESMA animação.

## O que é física / procedural (e não ciclo gravado)
- Andar, correr, ir de costas e de lado: os pés seguem uma trajetória de passada e as pernas são resolvidas por IK. O pé de apoio recua
  exatamente na velocidade do chão (não escorrega), o quadril sobe/desce sozinho, há fase de voo na corrida, passada e cadência crescem com a velocidade.
- Molas: tronco inclina com aceleração/velocidade; cabeça estabiliza o olhar e tem atraso; pelve gira para onde corre e o tronco continua mirando;
  tiro, golpe da katana, dano e pouso dão "chutes" que as molas absorvem. Mochila balança por inércia.
- Rabo de cavalo (6 segmentos) e cachecol (4): correntes com mola + gravidade + vento + inércia.
- Passos: poeira neon e som a cada pisada; pouso do dash com onda no chão e agachada.
- DASH: salto de captura de movimento (decolagem → voo → pouso) misturado com a física; o quadril nunca entra no chão.

## Ajustes rápidos (no topo de `animar()`/`atualizar()` em animador.js)
- inclinação do tronco ao correr: `leanBase` · balanço dos braços: `Aarm` · altura do passo: `lift` · tamanho do passo: `Sl`
- rigidez/balanço de cada mola: `mola(valor, alvo, w, z, dt)` — w maior = mais firme, z menor = mais balanço
- velocidade que vira "correr": `suave(2.4, 4.7, vel)`

## Usar o modelo do Sketchfab
1. Coloque o `.glb` na mesma pasta. 2. Em `heroi-config.js`: `ativo: true` e `arquivo: 'nome.glb'`. 3. Abra o jogo e veja o console (F12):
   ele lista os ossos reconhecidos. Se algum osso não for achado, preencha `ossos: { ... }` com o nome exato.
- Modelo olhando para o lado errado → `rotY`. Arma fora da mão → `armaOffset`/`armaEscala`.
- Melhores modelos: esqueleto humanoide completo (Mixamo ou padrão parecido), T-pose ou A-pose, até ~25 mil triângulos, texturas leves.
  Use `analisar_glb.py` (pasta de ferramentas) para dar nota nos modelos antes de escolher.
- Se o modelo não tiver esqueleto humanoide reconhecível, o jogo usa as animações que vêm no arquivo (idle/walk/run) ou só o balanço do corpo todo.
  Se der qualquer erro, volta sozinho para o herói de blocos.

## Trocar a animação do dash por outra do Mixamo
`python3 gerar_anim_dados.py arquivo.fbx salto 6 17 > anim-dados.js`  (FBX binário, "with skin" ou "without skin"; 6 e 17 = quadros inicial e final)
