// ============================================================================
// juice3d.js — GAME FEEL + GAME JUICE do Neon Raiders 3D  (v2)
// ----------------------------------------------------------------------------
// "Juice" é tudo aquilo que não muda as regras do jogo, mas muda COMO ELE
// SENTE: explosões, faíscas, tremor de tela, brilho nos tiros, congelada
// rápida (hit-stop), flashes, física da nave, sons, vibração do celular...
//
// Como esse arquivo se encaixa:
//   - Carrega ANTES do boss3d.js (ver game3d.html).
//   - O boss3d.js cria UM objeto:  const JUICE = criarJuice({...})
//     e chama os métodos dele nos momentos certos (tiro, acerto, morte,
//     dano, bomba, coleta...). O inimigos3d.js chama JUICE.explosaoInimigo
//     quando um inimigo morre e JUICE.bossChegando quando um boss entra.
//   - Nada aqui mexe em dano, HP, pontuação ou balanceamento. É só visual,
//     som e sensação (a única coisa que toca na jogabilidade é o "ímã" dos
//     cristais, que fica no boss3d.js e tem uma chave pra desligar).
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │ ONDE AJUSTAR CADA COISA (procure o nome dentro do JUICE_CFG abaixo)  │
// │                                                                      │
// │  TIRO DA NAVE (visual) ........ JUICE_CFG.balaJogador                │
// │  TIRO DOS INIMIGOS (visual) ... JUICE_CFG.balaInimigo                │
// │  FÍSICA DA NAVE (sobe/desce) .. JUICE_CFG.nave                       │
// │  Tudo ligado/desligado ........ JUICE_CFG (as chaves do topo)        │
// │                                                                      │
// │  Fora deste arquivo (boss3d.js):                                     │
// │   - espessura/comprimento da bala da nave: bulletGeo                 │
// │   - cor da bala da nave: bulletMatPadrao / Rapid / Triple            │
// │   - velocidade da bala da nave: BULLET_SPEED                         │
// │   - bala dos inimigos: enemyBulletGeo / enemyBulletMat (cor/tamanho) │
// └──────────────────────────────────────────────────────────────────────┘
//
// Performance (importante no Android):
//   - Todas as faíscas/explosões são UM único THREE.Points (1 draw call),
//     com pool fixo de partículas reaproveitadas — zero alocação por frame.
//   - O brilho dos tiros é OUTRO único Points (1 draw call pra todas as
//     balas juntas), em vez de 1 sprite por bala.
//   - Os estilhaços sólidos são UM InstancedMesh (1 draw call).
//   - Os anéis de choque são um pool pequeno de meshes reaproveitados.
//   - Auto-qualidade: se o FPS cair, o módulo reduz sozinho a quantidade
//     de partículas e volta ao normal quando o FPS se recupera.
// ============================================================================

// ── PAINEL DE CONTROLE — mexa à vontade pra ajustar o "tempero" ────────────
const JUICE_CFG = {
    ligado: true,          // false = desliga TODO o juice (volta ao visual antigo)
    particulas: 1.0,       // multiplicador de quantidade de faíscas (0.5 = metade, 1.5 = mais)
    tremor: 1.0,           // multiplicador do tremor de tela (0 desliga)
    hitStop: true,         // congelada rápida ao tomar dano / matar boss
    slowMoBoss: true,      // câmera lenta ao derrotar um boss / limpar uma formação
    vibracao: true,        // vibra o celular (navigator.vibrate) em momentos fortes
    flashTela: true,       // clarões coloridos na tela (dano, bomba, nível...)
    brilhoBalas: true,     // brilho neon nas balas (jogador e inimigos)
    rastroMotor: true,     // brasas saindo do motor + vórtices nas pontas das asas
    estilhacos: true,      // pedaços sólidos voando na morte dos inimigos
    cameraViva: true,      // câmera inclina/abre o FOV junto com a velocidade da nave
    derrotaFiltro: true,   // a imagem do jogo fica cinza/escura durante a cinemática de DERROTA (false = sem isso; poupa GPU em celular fraco)
    sons: true,            // sons sintetizados (pling de cristal, alerta de boss, bomba...)
    volumeSons: 0.35,      // volume desses sons (0 a 1) — os arquivos .mp3 do jogo não mudam
    autoQualidade: true,   // reduz partículas sozinho se o FPS cair

    // ────────────────────────────────────────────────────────────────────
    // TIRO DA NAVE — quanto mais alto, mais "vivo". 0 desliga aquele item.
    // ────────────────────────────────────────────────────────────────────
    balaJogador: {
        brilho: 1.0,        // tamanho do halo neon em volta da bala (0 = sem halo)
        brilhoAlfa: 1.0,    // intensidade/opacidade do halo
        pulso: 0.22,        // quanto o halo "respira" (0 = fixo)
        velPulso: 32,       // velocidade dessa respiração
        engrossar: 0.28,    // quanto o CORPO da bala engrossa/afina pulsando
        esticar: 0.30,      // quanto o corpo estica/encolhe no comprimento
        surgir: 0.07,       // segundos que a bala leva pra "nascer" (começa pequena e cresce)
        cauda: 1.25,        // comprimento do rastro brilhante atrás da bala
        rastro: 1.0,        // densidade das faíscas soltas atrás da bala (0 = nenhuma, 2 = o dobro)
        rastroDur: 0.30,    // quanto tempo cada faísca do rastro dura (s)
        rastroTam: 0.17,    // tamanho de cada faísca do rastro
        rastroEspalha: 0.6, // quanto as faíscas se espalham pros lados
    },

    // ────────────────────────────────────────────────────────────────────
    // TIRO DOS INIMIGOS (e dos bosses)
    // ────────────────────────────────────────────────────────────────────
    balaInimigo: {
        brilho: 0.85,
        brilhoAlfa: 0.8,
        pulso: 0.20,
        velPulso: 22,
        engrossar: 0.18,
        esticar: 0.15,
        surgir: 0.05,
        cauda: 1.6,
        rastro: 0.6,        // bala inimiga solta menos faíscas (tem MUITAS na tela, poupa o FPS)
        rastroDur: 0.35,
        rastroTam: 0.2,
        rastroEspalha: 0.4,
        telegrafo: true,    // o inimigo "carrega" (brilho + faíscas entrando) um instante ANTES de atirar
        telegrafoTempo: 0.22, // quanto tempo antes do tiro esse aviso aparece (s)
        graze: true,        // "desvio": faíscas + texto quando uma bala passa perto sem acertar (SEM som)
        grazeRaio: 2.0,     // distância máxima da nave pra contar como desvio
        desvioTexto: 'DESVIO', // texto que aparece em cima da nave quando você desvia de uma bala ('' = sem texto)
        desvioIntervalo: 0.4,  // tempo mínimo entre um texto e o próximo (s) — evita encher a tela em chuva de balas
    },

    // ────────────────────────────────────────────────────────────────────
    // FÍSICA DA NAVE — a nave é uma MOLA: quando você sobe/desce/vai pro
    // lado ela inclina, passa do ponto e balança até assentar (overshoot).
    // ────────────────────────────────────────────────────────────────────
    nave: {
        rigidez: 85,        // força da mola. Maior = volta rápido e nervosa; menor = mole e lenta
        amortecimento: 8,   // freio da mola. MENOR = balança mais (mais "física"); maior = duro/seco
        rollPorVel: 0.04,   // inclinação lateral (asa baixa) por velocidade lateral
        rollMax: 0.8,       // limite dessa inclinação (rad, 0.8 ≈ 46°)
        pitchPorVel: 0.04,  // nariz sobe/desce conforme a velocidade vertical
        pitchMax: 0.45,     // limite do nariz (rad)
        yawPorVel: 0.022,   // nariz "aponta" pro lado que ela vai
        yawMax: 0.28,       // limite disso (rad)
        recuoTiro: 0.6,     // coice do tiro empurrando o nariz pra cima (0 = sem coice)
        impulsoDano: 4.5,   // tranco (giro) ao levar dano
        balanco: 0.03,      // balanço suave quando parada, "flutuando" (0 = parada dura)
        esticar: 0.06,      // esticar/achatar o modelo com a velocidade (squash & stretch)
        suavVel: 16,        // suaviza a velocidade medida (maior = reage mais rápido, mais nervoso)
        camRoll: 1.0,       // quanto a CÂMERA inclina junto (0 = câmera reta, 2 = o dobro)
        camFov: 2.5,        // quanto o FOV abre em velocidade máxima (graus). 0 desliga
    },
};

function criarJuice(ctx) {
    const scene = ctx.scene;
    const camera = ctx.camera;
    const renderer = ctx.renderer;
    const container = ctx.container;
    const corTema = ctx.corTema || 0x00ffff;
    const alturaJogo = ctx.altura || (() => window.innerHeight);
    const FOV_BASE = camera.fov;

    // Atalho: cor em hex (0xff8800), objeto {r,g,b} (0..1) ou array → [r,g,b]
    function paraRgb(cor) {
        if (Array.isArray(cor)) return cor;
        if (cor && typeof cor === 'object') return [cor.r, cor.g, cor.b];
        return [((cor >> 16) & 255) / 255, ((cor >> 8) & 255) / 255, (cor & 255) / 255];
    }
    const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

    // Estado geral -----------------------------------------------------------
    let qualidade = 1;      // 1 = cheio; cai até 0.4 se o FPS estiver ruim
    let emLote = false;     // true durante a bomba (muitas mortes de uma vez)
    const agenda = [];      // ações atrasadas: {t, fn}
    let tempoAtual = 0;     // relógio do jogo (atualizado no aposFrame)
    let amb = null;         // ambiente espacial (ambiente3d.js): o portal reage aos momentos fortes
    function ligarAmbiente(a) { amb = a; }
    function ambEvento(nome) { if (amb) amb.evento(nome); }

    // ========================================================================
    // 1) SISTEMA DE PARTÍCULAS (faíscas, explosões, flashes) — 1 draw call
    // ========================================================================
    // Cada partícula é um ponto redondo desenhado por um shader próprio:
    // nasce branco-quente e "esfria" até a cor dela, encolhendo enquanto some.
    const VERT = `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aLife;
        uniform float uScale;
        varying vec3 vColor;
        varying float vLife;
        void main() {
            vColor = aColor;
            vLife = aLife;
            // partícula morta: joga pra fora da tela (não gasta pixel nenhum)
            if (aLife <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float encolhe = 1.0;
            #ifndef FLAT
                encolhe = 0.35 + 0.65 * aLife; // faísca vai encolhendo enquanto some
            #endif
            // limita o tamanho (alguns GPUs de celular têm limite baixo de gl_PointSize)
            gl_PointSize = clamp(aSize * encolhe * uScale / max(0.5, -mv.z), 2.0, 180.0);
            gl_Position = projectionMatrix * mv;
        }`;
    // OBS: evitei smoothstep com bordas invertidas (indefinido em alguns GPUs de celular)
    const FRAG = `
        uniform float uNucleo;
        varying vec3 vColor;
        varying float vLife;
        void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c) * 2.0;
            if (d > 1.0) discard;
            float miolo = 1.0 - smoothstep(0.0, 1.0, d);
            #ifdef FLAT
                // brilho de bala: miolo branco-quente, borda na cor da bala
                float quente = 1.0 - smoothstep(0.0, 0.55, d);
                vec3 col = mix(vColor, vec3(1.0), quente * uNucleo);
                gl_FragColor = vec4(col, miolo * miolo * vLife);
            #else
                // explosão: nasce branco-quente e "esfria" até a cor da faísca
                float idade = 1.0 - vLife;
                vec3 col = mix(vec3(1.0, 0.96, 0.82), vColor, smoothstep(0.0, 0.45, idade));
                col *= 0.75 + miolo * 0.9;
                gl_FragColor = vec4(col, pow(miolo, 1.4) * pow(vLife, 0.85));
            #endif
        }`;

    // Cria um conjunto de pontos com N vagas fixas
    function criarPontos(cap, flat) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(cap * 3);
        const col = new Float32Array(cap * 3);
        const tam = new Float32Array(cap);
        const vida = new Float32Array(cap); // 0 = vaga livre/morta, 1 = recém nascida
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(tam, 1));
        geo.setAttribute('aLife', new THREE.BufferAttribute(vida, 1));
        const mat = new THREE.ShaderMaterial({
            uniforms: { uScale: { value: 600 }, uNucleo: { value: 0.55 } },
            defines: flat ? { FLAT: 1 } : {},
            vertexShader: VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const pontos = new THREE.Points(geo, mat);
        pontos.frustumCulled = false; // as posições mudam todo frame; a esfera de corte inicial seria inválida
        pontos.renderOrder = 5;       // desenha por cima dos inimigos/balas normais
        scene.add(pontos);
        return { geo, mat, pontos, pos, col, tam, vida, cap };
    }

    // ── faíscas/explosões ──
    const CAP_FAISCAS = 1600;
    const F = criarPontos(CAP_FAISCAS, false);
    const fVel = new Float32Array(CAP_FAISCAS * 3);
    const fRest = new Float32Array(CAP_FAISCAS);  // tempo restante de vida (s)
    const fMax = new Float32Array(CAP_FAISCAS);   // tempo total de vida (s)
    const fArrasto = new Float32Array(CAP_FAISCAS);
    const fGrav = new Float32Array(CAP_FAISCAS);
    let fCursor = 0;
    let fCorSuja = false;

    // Solta UMA partícula. Se o pool estiver cheio, reaproveita a mais antiga.
    function emitir(x, y, z, vx, vy, vz, rgb, tam, dur, arrasto, grav) {
        const i = fCursor;
        fCursor = (fCursor + 1) % CAP_FAISCAS;
        const j = i * 3;
        F.pos[j] = x; F.pos[j + 1] = y; F.pos[j + 2] = z;
        fVel[j] = vx; fVel[j + 1] = vy; fVel[j + 2] = vz;
        F.col[j] = rgb[0]; F.col[j + 1] = rgb[1]; F.col[j + 2] = rgb[2];
        F.tam[i] = tam;
        fRest[i] = dur; fMax[i] = dur;
        fArrasto[i] = arrasto; fGrav[i] = grav || 0;
        F.vida[i] = 1;
        fCorSuja = true;
    }

    // Quantas partículas de verdade (aplica configuração + auto-qualidade + bomba)
    function qtd(base) {
        return Math.max(1, Math.round(base * JUICE_CFG.particulas * qualidade * (emLote ? 0.55 : 1)));
    }

    function atualizarFaiscas(dt) {
        let mexeu = false;
        for (let i = 0; i < CAP_FAISCAS; i++) {
            if (fRest[i] <= 0) continue;
            mexeu = true;
            fRest[i] -= dt;
            if (fRest[i] <= 0) { F.vida[i] = 0; continue; }
            const j = i * 3;
            const f = Math.max(0, 1 - fArrasto[i] * dt); // atrito: explode rápido e desacelera
            fVel[j] *= f; fVel[j + 1] *= f; fVel[j + 2] *= f;
            fVel[j + 1] -= fGrav[i] * dt;
            F.pos[j] += fVel[j] * dt;
            F.pos[j + 1] += fVel[j + 1] * dt;
            F.pos[j + 2] += fVel[j + 2] * dt;
            F.vida[i] = fRest[i] / fMax[i];
        }
        if (mexeu || fCorSuja) {
            F.geo.attributes.position.needsUpdate = true;
            F.geo.attributes.aLife.needsUpdate = true;
            if (fCorSuja) {
                F.geo.attributes.aColor.needsUpdate = true;
                F.geo.attributes.aSize.needsUpdate = true;
                fCorSuja = false;
            }
        }
    }

    // ── brilho das balas (recalculado do zero todo frame a partir das listas) ──
    const CAP_BRILHO = 420;
    const B = criarPontos(CAP_BRILHO, true);
    let brilhoUsado = 0;
    function pontoBrilho(n, x, y, z, rgb, tam, alfa) {
        const j = n * 3;
        B.pos[j] = x; B.pos[j + 1] = y; B.pos[j + 2] = z;
        B.col[j] = rgb[0]; B.col[j + 1] = rgb[1]; B.col[j + 2] = rgb[2];
        B.tam[n] = tam;
        B.vida[n] = alfa;
    }

    // Orçamento de faíscas de rastro por frame (evita explodir a CPU com muitas balas)
    let orcRastro = 0;
    const _rgbBala = [1, 1, 1];

    // Desenha o brilho + rastro + "vida" (pulso/esticar/surgir) de UMA lista de balas.
    //   C = JUICE_CFG.balaJogador ou JUICE_CFG.balaInimigo
    //   n = próximo índice livre no buffer de brilho; devolve o novo n
    function processarBalas(lista, C, n, tempo, dt, ehInimigo) {
        const rastroP = C.rastro > 0 ? Math.min(1, C.rastro * 0.6 * dt * 60) : 0;
        for (let k = 0; k < lista.length; k++) {
            const b = lista[k];
            const u = b.userData;
            if (!u._jb) { u._jb = b.scale.clone(); u._id = 0; } // guarda a escala original (a do jogo) uma vez
            u._id += dt;

            // "Vida" do corpo: nasce pequeno, depois engrossa e estica pulsando
            const nasce = C.surgir > 0 ? Math.min(1, 0.35 + 0.65 * u._id / C.surgir) : 1;
            const ph = tempo * C.velPulso + k * 1.9;
            const sxy = nasce * (1 + C.engrossar * Math.sin(ph));
            const sz = nasce * (1 + C.esticar * Math.sin(ph * 0.7 + 1.3));
            b.scale.set(u._jb.x * sxy, u._jb.y * sxy, u._jb.z * sz);

            const m = b.material;
            const cor = (m && m.color) ? m.color : null;
            _rgbBala[0] = cor ? cor.r : 1; _rgbBala[1] = cor ? cor.g : 1; _rgbBala[2] = cor ? cor.b : 1;
            const d = u.dir;
            const dx = d ? d.x : 0, dy = d ? d.y : 0, dz = d ? d.z : -1;
            const p = b.position;

            // Halo neon: 3 pontos por bala (ponta forte, meio, cauda que some)
            if (JUICE_CFG.brilhoBalas && C.brilho > 0 && n + 3 <= CAP_BRILHO) {
                const pulso = 1 + C.pulso * Math.sin(ph);
                const e = C.brilho * nasce * pulso;
                const a = C.brilhoAlfa;
                pontoBrilho(n++, p.x + dx * 1.0, p.y + dy * 1.0, p.z + dz * 1.0, _rgbBala, 0.46 * e, a);
                pontoBrilho(n++, p.x, p.y, p.z, _rgbBala, 0.34 * e, a * 0.8);
                pontoBrilho(n++, p.x - dx * C.cauda, p.y - dy * C.cauda, p.z - dz * C.cauda, _rgbBala, 0.22 * C.brilho * nasce, a * 0.5);
            }

            // Faíscas soltas atrás da bala (cometa)
            if (rastroP > 0 && orcRastro > 0 && Math.random() < rastroP) {
                orcRastro--;
                const es = C.rastroEspalha;
                const branco = Math.random() < 0.3;
                emitir(p.x - dx * 0.9 + (Math.random() - 0.5) * 0.25, p.y - dy * 0.9 + (Math.random() - 0.5) * 0.25, p.z - dz * 0.9,
                    -dx * 2 + (Math.random() - 0.5) * es * 4, -dy * 2 + (Math.random() - 0.5) * es * 4, -dz * 2 + (Math.random() - 0.5) * es * 2,
                    branco ? BRANCO : _rgbBala, C.rastroTam * (0.7 + Math.random() * 0.6), C.rastroDur * (0.6 + Math.random() * 0.5), 2.6, 0);
            }
        }
        return n;
    }

    // ── "raspão" (graze) e "carga" do tiro inimigo ──
    let ultimoGraze = -1;
    function verificarGraze(balas, nave, tempo) {
        const R = JUICE_CFG.balaInimigo.grazeRaio;
        const np = nave.position;
        for (let k = 0; k < balas.length; k++) {
            const eb = balas[k];
            const u = eb.userData;
            if (u._graze || !u.dir) continue;
            const sx = np.x - eb.position.x, sy = np.y - eb.position.y, sz = np.z - eb.position.z;
            // só conta DEPOIS que a bala passou da nave (produto escalar < 0 = já está se afastando)
            if (sx * u.dir.x + sy * u.dir.y + sz * u.dir.z >= 0) continue;
            u._graze = true; // (marca sempre: só avaliamos o instante em que ela passa)
            const dist = Math.sqrt(sx * sx + sy * sy + sz * sz);
            if (dist > R) continue;
            if (tempo - ultimoGraze < 0.06) continue; // várias ao mesmo tempo: só um som
            ultimoGraze = tempo;
            const mx = eb.position.x + sx * 0.5, my = eb.position.y + sy * 0.5, mz = eb.position.z + sz * 0.5;
            for (let i = 0; i < qtd(6); i++) {
                emitir(mx, my, mz, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 2 + Math.random() * 4,
                    Math.random() < 0.5 ? BRANCO : CIANO, 0.14 + Math.random() * 0.14, 0.14 + Math.random() * 0.14, 3, 0);
            }
            tremer(0.04);
            textoDesvio(nave.position); // antes tocava um "tick"; agora mostra o texto DESVIO (sem som)
        }
    }

    // ========================================================================
    // 2) ANÉIS DE CHOQUE (onda que se expande) — pool pequeno de meshes
    // ========================================================================
    const anelGeo = new THREE.RingGeometry(0.86, 1.0, 48);
    const ANEIS = [];
    for (let i = 0; i < 18; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
            depthWrite: false, side: THREE.DoubleSide, fog: false,
        });
        const mesh = new THREE.Mesh(anelGeo, mat);
        mesh.visible = false;
        mesh.renderOrder = 4;
        scene.add(mesh);
        ANEIS.push({ mesh, mat, ativo: false, atraso: 0, vida: 0, dur: 1, r0: 0, r1: 1, a0: 1 });
    }
    let anelCursor = 0;
    function anel(x, y, z, rgb, r0, r1, dur, alfa, atraso) {
        if (!JUICE_CFG.ligado) return;
        // procura uma vaga livre; se todas ocupadas, reaproveita em rodízio
        let a = null;
        for (let i = 0; i < ANEIS.length; i++) { if (!ANEIS[i].ativo) { a = ANEIS[i]; break; } }
        if (!a) { a = ANEIS[anelCursor]; anelCursor = (anelCursor + 1) % ANEIS.length; }
        a.ativo = true; a.atraso = atraso || 0; a.vida = dur; a.dur = dur;
        a.r0 = r0; a.r1 = r1; a.a0 = alfa;
        a.mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
        a.mesh.position.set(x, y, z);
        a.mesh.scale.set(r0, r0, 1);
        a.mat.opacity = 0;
        a.mesh.visible = a.atraso <= 0;
    }
    function atualizarAneis(dt) {
        for (let i = 0; i < ANEIS.length; i++) {
            const a = ANEIS[i];
            if (!a.ativo) continue;
            if (a.atraso > 0) {
                a.atraso -= dt;
                if (a.atraso > 0) continue;
                a.mesh.visible = true;
            }
            a.vida -= dt;
            if (a.vida <= 0) { a.ativo = false; a.mesh.visible = false; continue; }
            const t = 1 - a.vida / a.dur;             // 0 → 1
            const e = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out: abre rápido e desacelera
            const s = a.r0 + (a.r1 - a.r0) * e;
            a.mesh.scale.set(s, s, 1);
            a.mat.opacity = a.a0 * (1 - t);
        }
    }

    // ========================================================================
    // 2.5) ESTILHAÇOS SÓLIDOS (pedaços do inimigo girando e voando) —
    //      UM InstancedMesh só = 1 draw call pra todos. Se o navegador não
    //      suportar, simplesmente não aparecem (o resto do juice segue).
    // ========================================================================
    const CAP_EST = 150;
    let est = null;
    const eP = new Float32Array(CAP_EST * 3), eV = new Float32Array(CAP_EST * 3);
    const eR = new Float32Array(CAP_EST * 3), eW = new Float32Array(CAP_EST * 3);
    const eVida = new Float32Array(CAP_EST), eMax = new Float32Array(CAP_EST), eTam = new Float32Array(CAP_EST);
    let eCursor = 0, eAtivos = 0;
    let _dummy = null, _corTmp = null;
    try {
        if (typeof THREE.InstancedMesh === 'function' && typeof THREE.Object3D === 'function' && typeof THREE.Color === 'function') {
            const geoE = new THREE.TetrahedronGeometry(0.24);
            const matE = new THREE.MeshBasicMaterial({ color: 0xffffff });
            est = new THREE.InstancedMesh(geoE, matE, CAP_EST);
            if (est.instanceMatrix && est.instanceMatrix.setUsage && THREE.DynamicDrawUsage) est.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            _dummy = new THREE.Object3D();
            _corTmp = new THREE.Color();
            _dummy.scale.setScalar(0); _dummy.updateMatrix();
            for (let i = 0; i < CAP_EST; i++) { est.setMatrixAt(i, _dummy.matrix); est.setColorAt(i, _corTmp); } // tudo escondido (escala 0)
            est.frustumCulled = false; // o "corte" automático não conhece as posições das instâncias
            est.renderOrder = 3;
            scene.add(est);
        }
    } catch (e) { est = null; /* sem suporte: segue sem estilhaços */ }

    function estilhaco(x, y, z, rgb, vel, tam) {
        if (!est || !JUICE_CFG.estilhacos) return;
        const i = eCursor; eCursor = (eCursor + 1) % CAP_EST;
        const j = i * 3;
        eP[j] = x; eP[j + 1] = y; eP[j + 2] = z;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = vel * (0.5 + Math.random() * 0.7);
        eV[j] = Math.sin(ph) * Math.cos(th) * sp; eV[j + 1] = Math.sin(ph) * Math.sin(th) * sp; eV[j + 2] = Math.cos(ph) * sp * 0.6 + 1.5;
        eR[j] = Math.random() * 6; eR[j + 1] = Math.random() * 6; eR[j + 2] = Math.random() * 6;
        eW[j] = (Math.random() - 0.5) * 22; eW[j + 1] = (Math.random() - 0.5) * 22; eW[j + 2] = (Math.random() - 0.5) * 22;
        eMax[i] = eVida[i] = 0.7 + Math.random() * 0.5;
        eTam[i] = tam * (0.6 + Math.random() * 0.8);
        // brilho um pouco acima de 1 = parece "incandescente"
        _corTmp.setRGB(Math.min(1.6, rgb[0] * 1.5 + 0.1), Math.min(1.6, rgb[1] * 1.5 + 0.1), Math.min(1.6, rgb[2] * 1.5 + 0.1));
        est.setColorAt(i, _corTmp);
        est.instanceColor.needsUpdate = true;
        eAtivos++;
    }
    function atualizarEstilhacos(dt) {
        if (!est || eAtivos <= 0) return;
        let vivos = 0;
        for (let i = 0; i < CAP_EST; i++) {
            if (eVida[i] <= 0) continue;
            eVida[i] -= dt;
            const j = i * 3;
            if (eVida[i] <= 0) { // morreu agora: esconde (escala 0)
                _dummy.position.set(0, 0, 0); _dummy.scale.setScalar(0); _dummy.updateMatrix();
                est.setMatrixAt(i, _dummy.matrix);
                eAtivos--;
                continue;
            }
            vivos++;
            const f = Math.max(0, 1 - 0.9 * dt); // leve atrito
            eV[j] *= f; eV[j + 1] *= f; eV[j + 2] *= f;
            eV[j + 1] -= 3.0 * dt; // gravidade fraquinha: os cacos caem um pouco
            eP[j] += eV[j] * dt; eP[j + 1] += eV[j + 1] * dt; eP[j + 2] += eV[j + 2] * dt;
            eR[j] += eW[j] * dt; eR[j + 1] += eW[j + 1] * dt; eR[j + 2] += eW[j + 2] * dt;
            const k = eVida[i] / eMax[i];
            _dummy.position.set(eP[j], eP[j + 1], eP[j + 2]);
            _dummy.rotation.set(eR[j], eR[j + 1], eR[j + 2]);
            _dummy.scale.setScalar(eTam[i] * Math.min(1, k * 2.5)); // encolhe no final
            _dummy.updateMatrix();
            est.setMatrixAt(i, _dummy.matrix);
        }
        est.instanceMatrix.needsUpdate = true;
        if (vivos === 0) eAtivos = 0;
    }

    // ========================================================================
    // 3) TREMOR DE TELA (modelo "trauma": quanto mais trauma, mais treme —
    //    e o efeito cresce ao QUADRADO, então tremores fracos são sutis e
    //    os fortes são violentos). O boss3d.js soma isso na câmera.
    // ========================================================================
    let trauma = 0, tShake = 0;
    const tremor = { px: 0, py: 0, tx: 0, ty: 0, roll: 0 };
    function tremer(v) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.tremor) return;
        trauma = Math.min(1, trauma + v * JUICE_CFG.tremor);
    }
    function calcularTremor(dtReal) {
        tShake += dtReal;
        trauma = Math.max(0, trauma - dtReal * 1.7); // some em ~0.6s
        const q = trauma * trauma;
        const camR = JUICE_CFG.cameraViva ? nv.camR : 0; // inclinação "viva" da câmera (vem da física da nave)
        if (q < 0.0002) { tremor.px = tremor.py = tremor.tx = tremor.ty = 0; tremor.roll = camR; return; }
        const n1 = Math.sin(tShake * 47.3) + Math.sin(tShake * 71.1 + 1.3) * 0.5;
        const n2 = Math.sin(tShake * 53.9 + 2.1) + Math.sin(tShake * 83.7 + 4.4) * 0.5;
        const n3 = Math.sin(tShake * 39.7 + 0.7);
        tremor.px = n1 * 0.17 * q;   // câmera balança (parallax: o que está perto treme mais)
        tremor.py = n2 * 0.14 * q;
        tremor.tx = n1 * 1.1 * q;    // mira balança (todo o fundo treme igual)
        tremor.ty = n2 * 0.9 * q;
        tremor.roll = n3 * 0.03 * q + camR; // leve giro da câmera
    }

    // ========================================================================
    // 4) TEMPO: hit-stop (congelada) e câmera lenta
    // ========================================================================
    let hitStopT = 0, slowT = 0, slowDur = 1, slowEsc = 1, slowHold = 0;
    function hitStop(seg) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.hitStop) return;
        hitStopT = Math.max(hitStopT, Math.min(0.15, seg));
    }
    // segura (opcional, 0 a 1): fração do tempo em que a câmera lenta fica FIXA em `esc` antes de voltar
    // ao normal (1 = fica fixa o tempo todo — usado na cinemática de vitória). Sem ela, a velocidade
    // já vai voltando ao normal desde o começo.
    function slowmo(dur, esc, segura) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.slowMoBoss) return;
        if (slowT > dur) return; // já há uma câmera lenta mais longa em andamento: não corta
        slowT = dur; slowDur = dur; slowEsc = esc; slowHold = segura || 0;
    }
    // Devolve o multiplicador de tempo do frame (1 = normal)
    function escalaTempo(dtReal) {
        if (hitStopT > 0) { hitStopT -= dtReal; return 0.04; }
        if (slowT > 0) {
            slowT -= dtReal;
            const k = Math.max(0, slowT / slowDur);          // 1 → 0
            if (slowHold >= 1) return slowEsc;                // fixa o tempo todo
            if (slowHold > 0 && k > 1 - slowHold) return slowEsc;   // fixa no começo...
            const kk = slowHold > 0 ? k / (1 - slowHold) : k;       // ...e no resto volta ao normal
            return slowEsc + (1 - slowEsc) * Math.pow(1 - kk, 2); // volta ao normal suavemente
        }
        return 1;
    }

    // ── "soco" no FOV e "warp" das estrelas ──
    let fovP = 0, fovAplicado = 0, warp = 0;
    function fovPunch(v) { if (JUICE_CFG.ligado) fovP = Math.max(fovP, v); }
    function acelerarEstrelas(v) { if (JUICE_CFG.ligado) warp = Math.max(warp, v); }

    // ========================================================================
    // 5) OVERLAYS DE TELA (flash colorido, vinheta de perigo, banner central e
    //    textos de crítico) — criados aqui mesmo, então o game3d.html não
    //    precisa de CSS extra.
    // ========================================================================
    const estilo = document.createElement('style');
    estilo.textContent =
        '.juice-overlay{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;}' +
        '#juiceFlash{z-index:7;opacity:0;}' +
        '#juicePerigo{z-index:6;opacity:0;display:none;box-shadow:inset 0 0 70px 18px rgba(255,20,60,.85);animation:juicePerigoPulso 1.1s ease-in-out infinite;}' +
        '@keyframes juicePerigoPulso{0%,100%{opacity:.18}50%{opacity:.7}}' +
        '#juiceBanner{position:absolute;left:50%;top:27%;z-index:8;opacity:0;pointer-events:none;text-align:center;white-space:nowrap;' +
            'font-family:Orbitron,monospace;font-weight:900;transform:translate(-50%,-50%);}' +
        '#juiceBanner .jb-t{font-size:clamp(26px,9vw,46px);letter-spacing:.08em;line-height:1.05;}' +
        '#juiceBanner .jb-s{font-size:clamp(11px,3.4vw,16px);letter-spacing:.35em;margin-top:6px;opacity:.9;}' +
        '.juice-desvio{position:absolute;left:0;top:0;z-index:25;opacity:0;pointer-events:none;white-space:nowrap;' +
            'font-family:Orbitron,monospace;font-weight:900;font-size:13px;letter-spacing:.14em;color:#c8fbff;text-shadow:0 0 8px #00e5ff,0 0 16px #00b8ff;}' +
        '.juice-crit{position:absolute;left:0;top:0;z-index:25;opacity:0;pointer-events:none;white-space:nowrap;' +
            'font-family:Orbitron,monospace;font-weight:900;font-size:15px;color:#ffe066;text-shadow:0 0 8px #ffb400,0 0 16px #ff8800;}';
    document.head.appendChild(estilo);
    const elFlash = document.createElement('div');
    elFlash.id = 'juiceFlash'; elFlash.className = 'juice-overlay';
    const elPerigo = document.createElement('div');
    elPerigo.id = 'juicePerigo'; elPerigo.className = 'juice-overlay';
    const elBanner = document.createElement('div');
    elBanner.id = 'juiceBanner';
    elBanner.innerHTML = '<div class="jb-t"></div><div class="jb-s"></div>';
    container.appendChild(elPerigo);
    container.appendChild(elFlash);
    container.appendChild(elBanner);

    let flashAnim = null;
    function flashTela(cor, alfa, ms) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.flashTela) return;
        elFlash.style.background = cor;
        if (typeof elFlash.animate === 'function') {
            if (flashAnim) flashAnim.cancel();
            flashAnim = elFlash.animate([{ opacity: alfa }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
        } else { // navegador sem Web Animations: fallback simples
            elFlash.style.transition = 'none'; elFlash.style.opacity = alfa;
            requestAnimationFrame(() => { elFlash.style.transition = 'opacity ' + ms + 'ms ease-out'; elFlash.style.opacity = 0; });
        }
    }
    // Vinheta vermelha pulsando quando o HP está baixo
    let perigoLigado = false;
    function perigo(ligado) {
        if (ligado === perigoLigado) return;
        perigoLigado = ligado;
        elPerigo.style.display = (ligado && JUICE_CFG.ligado && JUICE_CFG.flashTela) ? 'block' : 'none';
    }
    // Balança um elemento do HUD (ex: barra de HP quando toma dano)
    function balancar(el) {
        if (!el || typeof el.animate !== 'function' || !JUICE_CFG.ligado) return;
        el.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
            { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' },
        ], { duration: 260, easing: 'ease-out' });
    }
    // "Pop" (cresce e volta) — usado no contador de combo e no placar
    function pop(el, escala) {
        if (!el || typeof el.animate !== 'function' || !JUICE_CFG.ligado) return;
        el.animate([{ transform: 'scale(' + (escala || 1.5) + ')' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    }
    function vibrar(padrao) {
        try { if (JUICE_CFG.ligado && JUICE_CFG.vibracao && navigator.vibrate) navigator.vibrate(padrao); } catch (e) { /* sem suporte — ignora */ }
    }

    // Banner grande no centro (ex: "COMBO x10", "ONDA 3", "⚠ ALERTA ⚠")
    let bannerAnim = null;
    function banner(texto, sub, corCss, ms) {
        if (!JUICE_CFG.ligado || typeof elBanner.animate !== 'function') return;
        const t = elBanner.firstChild, s = elBanner.lastChild;
        t.textContent = texto; s.textContent = sub || '';
        t.style.color = corCss; t.style.textShadow = '0 0 14px ' + corCss + ',0 0 34px ' + corCss;
        s.style.color = '#fff'; s.style.textShadow = '0 0 10px ' + corCss;
        if (bannerAnim) bannerAnim.cancel();
        const c = 'translate(-50%,-50%) ';
        bannerAnim = elBanner.animate([
            { opacity: 0, transform: c + 'scale(1.9)', offset: 0 },
            { opacity: 1, transform: c + 'scale(1)', offset: 0.14 },
            { opacity: 1, transform: c + 'scale(1.04)', offset: 0.72 },
            { opacity: 0, transform: c + 'scale(.94)', offset: 1 },
        ], { duration: ms || 1300, easing: 'ease-out' });
    }

    // Texto de CRÍTICO subindo do ponto do acerto (pool de 6 elementos reaproveitados)
    const critEls = [];
    for (let i = 0; i < 6; i++) {
        const el = document.createElement('div');
        el.className = 'juice-crit'; el.textContent = 'CRIT!';
        container.appendChild(el);
        critEls.push(el);
    }
    let critCursor = 0, ultimoCrit = -1;
    const _vProj = new THREE.Vector3();
    function textoCritico(pos) {
        if (!JUICE_CFG.ligado || tempoAtual - ultimoCrit < 0.07) return; // limita a spam
        ultimoCrit = tempoAtual;
        const el = critEls[critCursor]; critCursor = (critCursor + 1) % critEls.length;
        if (typeof el.animate !== 'function') return;
        _vProj.set(pos.x, pos.y, pos.z).project(camera);
        const x = (_vProj.x * 0.5 + 0.5) * window.innerWidth, y = (-_vProj.y * 0.5 + 0.5) * alturaJogo();
        el.animate([
            { opacity: 1, transform: 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) scale(1.5)' },
            { opacity: 1, transform: 'translate(' + x + 'px,' + (y - 26) + 'px) translate(-50%,-50%) scale(1)', offset: 0.35 },
            { opacity: 0, transform: 'translate(' + x + 'px,' + (y - 62) + 'px) translate(-50%,-50%) scale(.9)' },
        ], { duration: 620, easing: 'ease-out' });
    }

    // Texto "DESVIO" subindo da nave quando uma bala inimiga passa raspando (pool de 4 elementos reaproveitados)
    const desvioEls = [];
    for (let i = 0; i < 4; i++) {
        const el = document.createElement('div');
        el.className = 'juice-desvio';
        container.appendChild(el);
        desvioEls.push(el);
    }
    let desvioCursor = 0, ultimoDesvio = -9;
    function textoDesvio(pos) {
        const C = JUICE_CFG.balaInimigo;
        if (!JUICE_CFG.ligado || !C.desvioTexto || tempoAtual - ultimoDesvio < C.desvioIntervalo) return;
        ultimoDesvio = tempoAtual;
        const el = desvioEls[desvioCursor]; desvioCursor = (desvioCursor + 1) % desvioEls.length;
        if (typeof el.animate !== 'function') return;
        el.textContent = C.desvioTexto;
        _vProj.set(pos.x, pos.y + 0.9, pos.z).project(camera);   // um pouco acima da nave
        const x = (_vProj.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 36; // leve variação pra não empilhar
        const y = (-_vProj.y * 0.5 + 0.5) * alturaJogo();
        el.animate([
            { opacity: 0, transform: 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) scale(.8)' },
            { opacity: 1, transform: 'translate(' + x + 'px,' + (y - 14) + 'px) translate(-50%,-50%) scale(1.1)', offset: 0.2 },
            { opacity: 1, transform: 'translate(' + x + 'px,' + (y - 30) + 'px) translate(-50%,-50%) scale(1)', offset: 0.6 },
            { opacity: 0, transform: 'translate(' + x + 'px,' + (y - 52) + 'px) translate(-50%,-50%) scale(.95)' },
        ], { duration: 700, easing: 'ease-out' });
    }

    function agendar(seg, fn) { agenda.push({ t: seg, fn }); }

    // ========================================================================
    // 5.5) SONS SINTETIZADOS (WebAudio) — sem arquivos, sem download.
    //      Cristais tocam uma escala musical que SOBE quanto mais rápido
    //      você coleta em sequência (efeito "moeda do Mario").
    // ========================================================================
    let ac = null, mestre = null, bufRuido = null;
    function audio() {
        if (ac) return ac;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ac = new AC();
            mestre = ac.createGain();
            mestre.connect(ac.destination);
        } catch (e) { ac = null; }
        return ac;
    }
    // Um "bip" com envelope: freq → freqFim em dur segundos
    function tom(freq, dur, tipo, vol, freqFim, atraso) {
        const t0 = ac.currentTime + (atraso || 0);
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = tipo; o.frequency.setValueAtTime(freq, t0);
        if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(mestre);
        o.start(t0); o.stop(t0 + dur + 0.03);
    }
    // Rajada de ruído filtrado (explosões, trancos)
    function ruido(dur, vol, fIni, fFim, atraso) {
        if (!bufRuido) {
            bufRuido = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.8), ac.sampleRate);
            const d = bufRuido.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t0 = ac.currentTime + (atraso || 0);
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = bufRuido; f.type = 'lowpass';
        f.frequency.setValueAtTime(fIni, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, fFim), t0 + dur);
        g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(mestre);
        s.start(t0); s.stop(t0 + dur + 0.03);
    }
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // escala pentatônica (soa bem em qualquer ordem)
    const sfxUltimo = {};
    function sfx(tipo, a) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.sons || JUICE_CFG.volumeSons <= 0) return;
        const agora = performance.now();
        if (agora - (sfxUltimo[tipo] || 0) < 25) return; // evita empilhar o mesmo som no mesmo instante
        sfxUltimo[tipo] = agora;
        if (!audio()) return;
        try {
            if (ac.state === 'suspended') ac.resume();
            mestre.gain.value = JUICE_CFG.volumeSons;
            switch (tipo) {
                case 'coleta': { // a = quantos cristais em sequência
                    const f = 523.25 * Math.pow(2, PENTA[Math.min(a | 0, PENTA.length - 1)] / 12);
                    tom(f, 0.16, 'sine', 0.45, null, 0);
                    tom(f * 2, 0.10, 'triangle', 0.12, null, 0);
                    break;
                }
                case 'powerup': [0, 4, 7, 12, 16].forEach((n, i) => tom(440 * Math.pow(2, n / 12), 0.16, 'triangle', 0.32, null, i * 0.05)); break;
                case 'nivel': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tom(392 * Math.pow(2, n / 12), 0.22, 'triangle', 0.3, null, i * 0.06)); break;
                case 'marco':
                    [0, 4, 7, 12].forEach((n, i) => tom(330 * Math.pow(2, n / 12), 0.45, 'triangle', 0.3, null, i * 0.035));
                    tom(1320, 0.3, 'sine', 0.18, null, 0.12);
                    break;
                case 'bomba': ruido(0.75, 0.9, 2600, 90, 0); tom(150, 0.7, 'sine', 0.8, 28, 0); break;
                case 'dano': tom(190, 0.28, 'sawtooth', 0.5, 55, 0); ruido(0.18, 0.5, 1800, 200, 0); break;
                case 'derrota': // estrondo grave + 3 notas descendo (melancólico)
                    ruido(1.1, 0.9, 2200, 50, 0); tom(130, 1.2, 'sine', 0.8, 28, 0);
                    [392, 330, 262].forEach((f, i) => tom(f, 0.55, 'triangle', 0.22, f * 0.94, 0.25 + i * 0.28));
                    break;
                case 'escudo': tom(900, 0.16, 'square', 0.18, 320, 0); break;
                case 'limpa': tom(660, 0.18, 'triangle', 0.3, null, 0); tom(990, 0.28, 'triangle', 0.3, null, 0.09); break;
                case 'alerta':
                    for (let i = 0; i < 4; i++) tom(i % 2 ? 620 : 420, 0.22, 'square', 0.22, null, i * 0.24);
                    break;
                case 'boss': ruido(1.0, 0.9, 3000, 70, 0); tom(200, 1.0, 'sine', 0.8, 30, 0); tom(880, 0.5, 'triangle', 0.25, 220, 0.05); break;
            }
        } catch (e) { /* áudio indisponível — ignora */ }
    }

    // ========================================================================
    // 6) EFEITOS PRONTOS (é isso que o jogo chama)
    // ========================================================================

    // Pega a cor "principal" do modelo 3D de um inimigo (pra explosão combinar)
    function corDaMalha(obj) {
        if (!obj || typeof obj.traverse !== 'function') return null; // proteção: sem modelo 3D, cai na cor do tema
        let achada = null;
        obj.traverse(ch => {
            if (achada || !ch.isMesh) return;
            const m = Array.isArray(ch.material) ? ch.material[0] : ch.material;
            if (m && m.color) {
                const c = m.color;
                if (0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.12) achada = c; // ignora partes quase pretas
            }
        });
        return achada ? [Math.min(1, achada.r * 1.3), Math.min(1, achada.g * 1.3), Math.min(1, achada.b * 1.3)] : null;
    }

    // Rajada de faíscas em todas as direções (a "explosão" do protótipo)
    function rajada(x, y, z, n, velMin, velMax, paleta, tamMin, tamMax, durMin, durMax, arrasto, grav) {
        for (let i = 0; i < n; i++) {
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            const sp = velMin + Math.random() * (velMax - velMin);
            const rgb = paleta[(Math.random() * paleta.length) | 0];
            emitir(x, y, z,
                Math.sin(ph) * Math.cos(th) * sp, Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp * 0.8,
                rgb, tamMin + Math.random() * (tamMax - tamMin), durMin + Math.random() * (durMax - durMin), arrasto, grav);
        }
    }

    const LARANJA = [1.0, 0.62, 0.10]; // o laranja do protótipo
    const AMARELO = [1.0, 0.90, 0.45];
    const BRANCO = [1.0, 0.97, 0.85];
    const CIANO = [0.0, 0.9, 1.0];

    // MORTE DO INIMIGO — explosão + estilhaços + clarão + onda de choque
    function explosaoInimigo(pos, en) {
        if (!JUICE_CFG.ligado) return;
        const boss = !!(en && en.isBoss);
        const elite = !!(en && en.tipo === 'tank');
        const k = boss ? 3.2 : Math.max(0.7, Math.min(1.8, ((en && en.hitRadius) || 1.6) / 1.6));
        const corIn = (en && en.mesh && corDaMalha(en.mesh)) || paraRgb(corTema);
        const paleta = [LARANJA, LARANJA, AMARELO, corIn, corIn];
        const x = pos.x, y = pos.y, z = pos.z;

        // faíscas (rajada esférica que desacelera por atrito)
        const base = boss ? 170 : (elite ? 62 : 40);
        rajada(x, y, z, qtd(base), 2.5 * k, 9 * k, paleta, 0.28, 0.75 * Math.sqrt(k), boss ? 0.7 : 0.4, boss ? 1.4 : 0.85, 2.2, 0);
        // estilhaços sólidos girando (na bomba: metade, pra poupar o celular)
        const nEst = Math.round((boss ? 28 : (elite ? 11 : 6)) * qualidade * (emLote ? 0.5 : 1));
        for (let i = 0; i < nEst; i++) estilhaco(x, y, z, corIn, (boss ? 9 : 6) * Math.sqrt(k), 0.55 * Math.sqrt(k));
        // clarão central (branco-quente que some em ~0.15s) + brasa laranja
        emitir(x, y, z, 0, 0, 0, BRANCO, 2.4 * k, 0.16, 0, 0);
        emitir(x, y, z, 0, 0, 0, LARANJA, 1.5 * k, 0.32, 0, 0);
        // onda de choque (em lote/bomba economiza — só a bomba desenha o anel grande)
        if (!emLote || boss) {
            anel(x, y, z, corIn, 0.3 * k, 2.8 * k, boss ? 0.6 : 0.38, 0.85, 0);
            if (boss) {
                anel(x, y, z, LARANJA, 0.5 * k, 4.2 * k, 0.8, 0.7, 0.12);
                anel(x, y, z, BRANCO, 0.5 * k, 5.6 * k, 1.0, 0.6, 0.26);
            }
        }

        if (boss) {
            // Sequência épica: congelada → câmera lenta → mini-explosões em volta
            hitStop(0.12);
            slowmo(0.9, 0.3);
            tremer(0.9);
            fovPunch(6);
            acelerarEstrelas(4);
            flashTela('#ffffff', 0.55, 520);
            vibrar([40, 30, 90]);
            sfx('boss');
            impulsoNave(0, -2, 0);
            ambEvento('bomba'); // boss caiu: o portal solta uma onda de choque
            for (let i = 0; i < 6; i++) {
                agendar(0.08 + i * 0.13, () => {
                    const ox = x + (Math.random() - 0.5) * 5, oy = y + (Math.random() - 0.5) * 3.5, oz = z + (Math.random() - 0.5) * 2;
                    rajada(ox, oy, oz, qtd(34), 2, 7, paleta, 0.3, 0.8, 0.5, 1.0, 2.2, 0);
                    for (let e = 0; e < 4; e++) estilhaco(ox, oy, oz, corIn, 6, 0.5);
                    emitir(ox, oy, oz, 0, 0, 0, BRANCO, 2.2, 0.16, 0, 0);
                    anel(ox, oy, oz, corIn, 0.3, 2.4, 0.4, 0.7, 0);
                    tremer(0.15);
                });
            }
        } else if (!emLote) {
            tremer(elite ? 0.2 : 0.09);
            if (elite) vibrar(25);
        }
    }

    // ACERTO num inimigo (a bala bateu mas ele ainda vive)
    const _rgbTmp = [1, 1, 1];
    function acertoInimigo(en, pos, rgb, crit) {
        if (!JUICE_CFG.ligado) return;
        const c = _rgbTmp;                       // reaproveita o mesmo array (sem alocar)
        if (rgb) { c[0] = rgb.r; c[1] = rgb.g; c[2] = rgb.b; } // rgb = THREE.Color da bala
        const n = qtd(crit ? 11 : 5);
        for (let i = 0; i < n; i++) {
            // faíscas voltam pra trás (rumo à câmera) e pros lados, como estilhaços do impacto
            emitir(pos.x, pos.y, pos.z,
                (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, 2 + Math.random() * 6,
                Math.random() < 0.5 ? c : BRANCO, 0.18 + Math.random() * 0.22, 0.16 + Math.random() * 0.2, 3.0, 0);
        }
        emitir(pos.x, pos.y, pos.z, 0, 0, 0, BRANCO, crit ? 1.6 : 0.9, 0.07, 0, 0); // faísca de contato
        if (crit) {
            anel(pos.x, pos.y, pos.z, AMARELO, 0.2, 1.4, 0.25, 0.9, 0);
            tremer(0.06);
            textoCritico(pos);
        }
        if (en) {
            en._punch = 1;                       // "soco": o inimigo infla um pouquinho e volta
            en._kb = 1;                          // "tranco": ele é empurrado pra trás e volta
            en._kbx = (Math.random() - 0.5) * 0.35;
        }
    }

    // Disparo do jogador: clarão na boca do canhão + 2 faíscas + coice na nave
    function tiro(pos, cor) {
        if (!JUICE_CFG.ligado) return;
        const rgb = paraRgb(cor);
        emitir(pos.x, pos.y, pos.z - 1.1, 0, 0, 0, rgb, 0.8, 0.07, 0, 0);
        for (let i = 0; i < 2; i++) {
            emitir(pos.x, pos.y, pos.z - 1.0, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, -3 - Math.random() * 4,
                rgb, 0.16, 0.16, 2.0, 0);
        }
        // coice: dá um tranco no nariz (a mola da nave faz ele voltar balançando)
        nv.wp += JUICE_CFG.nave.recuoTiro;
        nv.wr += (Math.random() - 0.5) * JUICE_CFG.nave.recuoTiro * 0.6;
    }
    // Clarão magenta quando um inimigo atira (avisa o jogador e dá vida)
    function faiscaInimigo(pos) {
        if (!JUICE_CFG.ligado) return;
        emitir(pos.x, pos.y, pos.z, 0, 0, 0, [1.0, 0.3, 1.0], 0.9, 0.1, 0, 0);
    }

    // DANO NO JOGADOR
    function danoJogador(pos, fracao, escudo) {
        if (!JUICE_CFG.ligado) return;
        if (escudo) { // o escudo absorveu: efeito mais leve, azul
            rajada(pos.x, pos.y, pos.z, qtd(14), 2, 6, [CIANO, BRANCO], 0.22, 0.5, 0.3, 0.6, 2.2, 0);
            anel(pos.x, pos.y, pos.z, CIANO, 0.5, 2.8, 0.35, 0.8, 0);
            flashTela('#00e5ff', 0.25, 260);
            tremer(0.28);
            vibrar(20);
            sfx('escudo');
            impulsoNave((Math.random() < 0.5 ? -1 : 1) * JUICE_CFG.nave.impulsoDano * 0.4, 0, 0);
            return;
        }
        rajada(pos.x, pos.y, pos.z, qtd(26), 2, 8, [[1.0, 0.1, 0.2], LARANJA, BRANCO], 0.25, 0.65, 0.35, 0.8, 2.2, 0);
        anel(pos.x, pos.y, pos.z, [1.0, 0.15, 0.25], 0.5, 3.4, 0.4, 0.9, 0);
        flashTela('#ff1133', 0.5, 420);
        ambEvento('dano');
        tremer(0.5 + 0.4 * Math.min(1, fracao || 0));
        hitStop(0.07);
        fovPunch(3);
        vibrar(45);
        sfx('dano');
        // tranco na nave: gira de lado e o nariz empina (a mola devolve balançando)
        const I = JUICE_CFG.nave.impulsoDano;
        impulsoNave((Math.random() < 0.5 ? -1 : 1) * I, -I * 0.4, (Math.random() - 0.5) * I * 0.5);
        balancar(document.getElementById('hpFill') && document.getElementById('hpFill').parentElement);
    }

    // BOMBA
    function bomba(pos) {
        if (!JUICE_CFG.ligado) return;
        flashTela('#ffffff', 0.9, 380);
        ambEvento('bomba');
        anel(pos.x, pos.y, pos.z, BRANCO, 0.6, 26, 0.7, 0.95, 0);
        anel(pos.x, pos.y, pos.z, [1.0, 0.2, 1.0], 0.6, 20, 0.6, 0.8, 0.1);
        anel(pos.x, pos.y, pos.z, CIANO, 0.6, 14, 0.5, 0.7, 0.2);
        tremer(0.75);
        fovPunch(9);
        acelerarEstrelas(6);
        vibrar(70);
        sfx('bomba');
        impulsoNave(0, -3.5, 0);
    }
    // MORTE DO JOGADOR (HP chegou a 0): explosão enorme, ondas vermelhas, estilhaços, flash, tremor e vibração.
    // (A explosão básica da nave já é chamada pelo boss3d.js; isto é o "extra" de impacto.)
    function morteJogador(pos) {
        if (!JUICE_CFG.ligado) return;
        const verm = [1.0, 0.1, 0.2];
        flashTela('#ff1133', 0.65, 800);
        hitStop(0.15);
        tremer(1.0);
        fovPunch(10);
        vibrar([120, 60, 240]);
        sfx('derrota');
        ambEvento('dano');
        anel(pos.x, pos.y, pos.z, BRANCO, 0.5, 12, 0.6, 0.95, 0);
        anel(pos.x, pos.y, pos.z, verm, 0.5, 18, 0.9, 0.8, 0.12);
        anel(pos.x, pos.y, pos.z, verm, 0.5, 26, 1.2, 0.6, 0.28);
        rajada(pos.x, pos.y, pos.z, qtd(90), 2, 11, [verm, LARANJA, BRANCO], 0.3, 0.9, 0.6, 1.4, 1.8, 0);
        for (let i = 0; i < 16; i++) estilhaco(pos.x, pos.y, pos.z, verm, 8, 0.6);
        // explosões menores em volta, em sequência (a nave se desmanchando)
        for (let i = 0; i < 5; i++) {
            agendar(0.1 + i * 0.16, () => {
                const ox = pos.x + (Math.random() - 0.5) * 3, oy = pos.y + (Math.random() - 0.5) * 2, oz = pos.z + (Math.random() - 0.5) * 2;
                rajada(ox, oy, oz, qtd(28), 2, 7, [verm, LARANJA], 0.25, 0.7, 0.5, 1.0, 2.0, 0);
                emitir(ox, oy, oz, 0, 0, 0, BRANCO, 1.8, 0.14, 0, 0);
                anel(ox, oy, oz, verm, 0.3, 3, 0.4, 0.7, 0);
                tremer(0.12);
            });
        }
    }
    // Filtro de "derrota": a imagem do jogo vai ficando cinza e escura (e volta ao normal ao reviver)
    function filtroDerrota(ligado) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.derrotaFiltro || !renderer.domElement) return;
        renderer.domElement.style.transition = 'filter 1.2s ease';
        renderer.domElement.style.filter = ligado ? 'saturate(.25) brightness(.8) contrast(1.05)' : '';
    }
    function iniciarLote() { emLote = true; }
    function fimLote() { emLote = false; }

    // Coleta de cristal / power-up (sequência rápida = nota mais aguda)
    let streakColeta = 0, ultimaColeta = -9;
    function coleta(pos, cor) {
        if (!JUICE_CFG.ligado) return;
        const rgb = paraRgb(cor);
        rajada(pos.x, pos.y, pos.z, qtd(8), 1.5, 4, [rgb, BRANCO], 0.16, 0.34, 0.25, 0.45, 3.0, 0);
        anel(pos.x, pos.y, pos.z, rgb, 0.2, 1.2, 0.28, 0.7, 0);
        streakColeta = (tempoAtual - ultimaColeta < 0.55) ? streakColeta + 1 : 0;
        ultimaColeta = tempoAtual;
        sfx('coleta', streakColeta);
    }
    function powerup(pos, cor) {
        if (!JUICE_CFG.ligado) return;
        const rgb = paraRgb(cor);
        rajada(pos.x, pos.y, pos.z, qtd(24), 2, 7, [rgb, BRANCO], 0.22, 0.55, 0.4, 0.8, 2.0, 0);
        anel(pos.x, pos.y, pos.z, rgb, 0.4, 3.4, 0.5, 0.9, 0);
        flashTela('#' + ((1 << 24) | (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255)).toString(16).slice(1), 0.22, 300);
        tremer(0.12);
        vibrar(20);
        sfx('powerup');
    }
    function subiuNivel(pos) {
        if (!JUICE_CFG.ligado) return;
        const ouro = [1.0, 0.84, 0.0];
        rajada(pos.x, pos.y, pos.z, qtd(36), 2, 7, [ouro, BRANCO, AMARELO], 0.22, 0.55, 0.5, 1.0, 1.8, -1.5);
        anel(pos.x, pos.y, pos.z, ouro, 0.5, 5, 0.6, 0.9, 0);
        anel(pos.x, pos.y, pos.z, BRANCO, 0.5, 7, 0.8, 0.7, 0.12);
        flashTela('#ffd700', 0.3, 420);
        ambEvento('nivel');
        acelerarEstrelas(2.5);
        tremer(0.15);
        vibrar([20, 30, 40]);
        sfx('nivel');
    }
    function nexusAtivada(pos) {
        if (!JUICE_CFG.ligado) return;
        const roxo = [0.75, 0.3, 1.0];
        rajada(pos.x, pos.y, pos.z, qtd(30), 2, 7, [roxo, [1.0, 0.24, 0.94], BRANCO], 0.22, 0.6, 0.4, 0.9, 2.0, 0);
        anel(pos.x, pos.y, pos.z, roxo, 0.5, 5.5, 0.6, 0.95, 0);
        flashTela('#a020ff', 0.32, 450);
        tremer(0.3);
        fovPunch(4);
        vibrar([25, 20, 50]);
        sfx('powerup');
    }

    // ── MARCOS DE COMBO: em x5, x10, x20... um banner + efeito especial ──
    const MARCOS = { 5: 'AQUECENDO', 10: 'EM CHAMAS', 20: 'IMPARÁVEL', 35: 'LENDÁRIO', 50: 'INSANO', 75: 'DIVINO', 100: 'ABSURDO' };
    let ultimoMarco = 0;
    function comboMarco(combo, pos) {
        if (!JUICE_CFG.ligado) return;
        if (combo < ultimoMarco) ultimoMarco = 0;                 // combo caiu: pode anunciar de novo
        if (!MARCOS[combo] || combo <= ultimoMarco) return;
        ultimoMarco = combo;
        const ouro = [1.0, 0.84, 0.0];
        anel(pos.x, pos.y, pos.z, ouro, 0.5, 6, 0.6, 0.9, 0);
        rajada(pos.x, pos.y, pos.z, qtd(22), 2, 7, [ouro, BRANCO], 0.2, 0.5, 0.4, 0.8, 2.0, 0);
        banner('COMBO x' + combo, MARCOS[combo], '#ffd700', 1300);
        ambEvento('marco');
        flashTela('#ffd700', 0.18, 350);
        fovPunch(3);
        acelerarEstrelas(2);
        tremer(0.18);
        vibrar([15, 20, 30]);
        sfx('marco');
    }
    // Formação inteira limpa: respiro em câmera lenta + anel dourado
    function formacaoLimpa(pos) {
        if (!JUICE_CFG.ligado || emLote) return;
        slowmo(0.35, 0.5);
        ambEvento('limpa');
        anel(pos.x, pos.y, pos.z, [1.0, 0.84, 0.0], 0.5, 6.5, 0.55, 0.85, 0);
        acelerarEstrelas(2.5);
        sfx('limpa');
    }
    // Nova onda começando
    function onda(n) {
        if (!JUICE_CFG.ligado) return;
        banner('ONDA ' + n, '', '#' + ('000000' + corTema.toString(16)).slice(-6), 1100);
        acelerarEstrelas(3);
    }
    // Boss entrando: alerta vermelho piscando + sirene
    function bossChegando(nome) {
        if (!JUICE_CFG.ligado) return;
        banner('⚠ ALERTA ⚠', String(nome || 'BOSS'), '#ff2255', 2000);
        ambEvento('boss');
        for (let i = 0; i < 3; i++) agendar(i * 0.36, () => flashTela('#ff0033', 0.32, 300));
        tremer(0.45);
        vibrar([60, 40, 60, 40, 90]);
        sfx('alerta');
    }

    // ========================================================================
    // 6.5) FÍSICA DA NAVE — sistema de MOLAS (rola, empina e aponta o nariz)
    // ========================================================================
    // A nave "sente" a própria velocidade: quando você arrasta pro lado ela
    // inclina (roll), quando sobe o nariz empina (pitch) e ela aponta o nariz
    // pro lado que vai (yaw). Cada eixo é uma MOLA com amortecimento, então
    // ela passa do ponto e balança antes de assentar. Tiro dá coice, dano dá
    // tranco. Tudo ajustável em JUICE_CFG.nave (lá em cima).
    const nv = {
        init: false, px: 0, py: 0,        // posição do frame anterior
        vx: 0, vy: 0, vel: 0,             // velocidade suavizada (unidades/s)
        r: 0, wr: 0,                      // roll:  ângulo e velocidade angular
        p: 0, wp: 0,                      // pitch
        y: 0, wy: 0,                      // yaw
        t: 0, esc: null,                  // relógio do balanço parada + escala original
        camR: 0, camW: 0,                 // roll da câmera (mola separada)
        fov: 0,                           // FOV extra por velocidade
    };
    // Dá um empurrão nos ângulos (usado por dano, bomba, boss...)
    function impulsoNave(roll, pitch, yaw) { nv.wr += roll; nv.wp += pitch; nv.wy += yaw; }

    function fisicaNave(nave, st, dt, dtReal) {
        if (!JUICE_CFG.ligado) return;
        const C = JUICE_CFG.nave;
        if (!nv.init) { nv.init = true; nv.px = st.x; nv.py = st.y; nv.esc = nave.scale.clone(); }
        nv.t += dt;

        // 1) velocidade REAL da nave (em tempo real, não em câmera lenta), suavizada
        if (dtReal > 0) {
            const vxr = clamp((st.x - nv.px) / dtReal, -45, 45);
            const vyr = clamp((st.y - nv.py) / dtReal, -45, 45);
            const s = Math.min(1, C.suavVel * dtReal);
            nv.vx += (vxr - nv.vx) * s;
            nv.vy += (vyr - nv.vy) * s;
        }
        nv.px = st.x; nv.py = st.y;
        nv.vel = Math.hypot(nv.vx, nv.vy);

        // 2) ângulos-alvo: a mola puxa a nave pra cá
        const parada = 1 / (1 + nv.vel * 0.5); // 1 = parada, → 0 em movimento
        const alvoR = clamp(-nv.vx * C.rollPorVel, -C.rollMax, C.rollMax) + Math.sin(nv.t * 1.9) * C.balanco * parada;
        const alvoP = clamp(nv.vy * C.pitchPorVel, -C.pitchMax, C.pitchMax) + Math.sin(nv.t * 2.7 + 1) * C.balanco * 0.6 * parada;
        const alvoY = clamp(-nv.vx * C.yawPorVel, -C.yawMax, C.yawMax);

        // 3) integra as molas (sub-passos de 8ms = estável mesmo com FPS baixo)
        const k = C.rigidez, c = C.amortecimento;
        let resto = Math.min(dt, 0.05);
        while (resto > 0) {
            const h = Math.min(resto, 0.008);
            nv.wr += (k * (alvoR - nv.r) - c * nv.wr) * h; nv.r += nv.wr * h;
            nv.wp += (k * (alvoP - nv.p) - c * nv.wp) * h; nv.p += nv.wp * h;
            nv.wy += (k * (alvoY - nv.y) - c * nv.wy) * h; nv.y += nv.wy * h;
            resto -= h;
        }
        nv.r = clamp(nv.r, -1.3, 1.3); nv.p = clamp(nv.p, -1.0, 1.0); nv.y = clamp(nv.y, -0.8, 0.8);
        nave.rotation.set(nv.p, nv.y, nv.r); // aplica na nave (ordem XYZ, ângulos pequenos)

        // 4) squash & stretch: estica no sentido em que se move (volume ~constante)
        if (C.esticar > 0 && nv.esc) {
            const ex = 1 + C.esticar * Math.min(1, Math.abs(nv.vx) / 20);
            const ey = 1 + C.esticar * Math.min(1, Math.abs(nv.vy) / 20);
            const ez = 1 / Math.sqrt(ex * ey);
            nave.scale.set(nv.esc.x * ex, nv.esc.y * ey, nv.esc.z * ez);
        }

        // 5) câmera "viva": mola própria que inclina a imagem junto com a nave
        if (JUICE_CFG.cameraViva) {
            const alvoC = clamp(-nv.vx * 0.0022, -0.045, 0.045) * C.camRoll;
            let rc = Math.min(dt, 0.05);
            while (rc > 0) {
                const h = Math.min(rc, 0.01);
                nv.camW += (40 * (alvoC - nv.camR) - 8 * nv.camW) * h; nv.camR += nv.camW * h;
                rc -= h;
            }
            nv.fov = clamp(nv.vel / 25, 0, 1) * C.camFov;
        } else { nv.camR = 0; nv.fov = 0; }
    }

    // Rastro do motor da nave: brasas saindo de trás + vórtices nas pontas das
    // asas. Tudo fica mais intenso e longo quanto mais rápido a nave anda.
    let motorAcc = 0;
    function motor(nave, dt) {
        if (!JUICE_CFG.ligado || !JUICE_CFG.rastroMotor) return;
        motorAcc += dt;
        const v = Math.min(1, nv.vel / 22);
        const passo = (0.034 - 0.016 * v) / Math.max(0.4, qualidade);
        if (motorAcc < passo) return;
        motorAcc = 0;
        const p = nave.position;
        emitir(p.x + (Math.random() - 0.5) * 0.2, p.y - 0.05 + (Math.random() - 0.5) * 0.12, p.z + 0.85,
            (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 2.5 + Math.random() * 2.5 + v * 5,
            Math.random() < 0.6 ? [0.2, 0.75, 1.0] : [1.0, 0.55, 0.9], 0.2 + Math.random() * 0.12 + v * 0.1, 0.3 + v * 0.14, 1.2, 0);
        if (v > 0.18) { // em velocidade: linhas nas pontas das asas
            for (let s = -1; s <= 1; s += 2) {
                emitir(p.x + s * 0.95, p.y, p.z + 0.35, -nv.vx * 0.05, -nv.vy * 0.05, 3 + v * 7,
                    CIANO, 0.12 + 0.1 * v, 0.22 + 0.2 * v, 1.0, 0);
            }
        }
    }

    // ========================================================================
    // 7) LOOP: chamado 2x por frame pelo boss3d.js
    // ========================================================================
    let fpsSuave = 60, tBaixo = 0, tAlto = 0;

    // ANTES de mover o jogo: calcula tremor e devolve a escala de tempo
    function antesDoFrame(dtReal) {
        if (!JUICE_CFG.ligado) { tremor.px = tremor.py = tremor.tx = tremor.ty = tremor.roll = 0; return 1; }
        calcularTremor(dtReal);
        return escalaTempo(dtReal);
    }

    // DEPOIS de mover o jogo: anima partículas, anéis, brilho das balas etc.
    //   estado = { nave, inimigos, balasJogador, balasNitro, balasInimigas, cristais, powerups }
    function aposFrame(dt, dtReal, tempo, estado) {
        if (!JUICE_CFG.ligado) return;
        tempoAtual = tempo;

        // Auto-qualidade (mede o FPS real, não o do jogo em câmera lenta)
        if (JUICE_CFG.autoQualidade && dtReal > 0) {
            fpsSuave += (1 / dtReal - fpsSuave) * 0.05;
            if (fpsSuave < 40) { tBaixo += dtReal; tAlto = 0; }
            else if (fpsSuave > 54) { tAlto += dtReal; tBaixo = 0; }
            else { tBaixo = 0; tAlto = 0; }
            if (tBaixo > 2 && qualidade > 0.4) { qualidade = Math.max(0.4, qualidade * 0.7); tBaixo = 0; if (amb) amb.setQualidade(qualidade); }
            if (tAlto > 6 && qualidade < 1) { qualidade = Math.min(1, qualidade * 1.25); tAlto = 0; if (amb) amb.setQualidade(qualidade); }
        }

        // Escala do tamanho dos pontos (acompanha tela, pixel ratio e FOV)
        const escalaPx = (renderer.getPixelRatio() * alturaJogo() * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        F.mat.uniforms.uScale.value = escalaPx;
        B.mat.uniforms.uScale.value = escalaPx;

        // Ações agendadas (mini-explosões do boss, piscadas do alerta etc.)
        for (let i = agenda.length - 1; i >= 0; i--) {
            agenda[i].t -= dt;
            if (agenda[i].t <= 0) { const fn = agenda[i].fn; agenda.splice(i, 1); fn(); }
        }

        const inim = estado.inimigos;
        const CI = JUICE_CFG.balaInimigo;
        let orcTele = Math.round(14 * qualidade); // orçamento de partículas de "carga" por frame

        for (let i = 0; i < inim.length; i++) {
            const en = inim[i];
            const pm = en.mesh.position;

            // "Soco" do acerto: infla e volta ao tamanho original
            if (en._punch > 0) {
                if (!en._escBase) en._escBase = en.mesh.scale.clone();
                en._punch = Math.max(0, en._punch - dtReal * 9);
                const s = 1 + (en.isBoss ? 0.04 : 0.17) * en._punch * en._punch;
                en.mesh.scale.set(en._escBase.x * s, en._escBase.y * s, en._escBase.z * s);
                if (en._punch === 0) en.mesh.scale.copy(en._escBase); // volta EXATAMENTE ao tamanho original
            }
            // "Tranco": empurrado pra trás/pro lado e volta (o jogo reescreve a posição todo frame, então não acumula)
            if (en._kb > 0) {
                en._kb = Math.max(0, en._kb - dtReal * 7);
                const kk = en._kb * en._kb;
                pm.z -= (en.isBoss ? 0.15 : 0.45) * kk;
                pm.x += (en._kbx || 0) * kk;
            }

            // Cor do inimigo (pega 1x): usada nos efeitos de entrada
            if (!en._cJ) en._cJ = corDaMalha(en.mesh) || paraRgb(corTema);

            // Apareceu agora: estouro de luz (também vale pros filhotes e minions)
            if (!en._jVisto) {
                en._jVisto = true;
                anel(pm.x, pm.y, pm.z, en._cJ, 0.2, en.isBoss ? 6 : 2.2, en.isBoss ? 0.7 : 0.35, 0.8, 0);
                emitir(pm.x, pm.y, pm.z, 0, 0, 0, BRANCO, en.isBoss ? 4 : 1.5, 0.18, 0, 0);
                if (en.isBoss) tremer(0.2);
            }
            // Voando até a formação: deixa um rastro colorido (o "swoosh" de entrada)
            if (!en.posicionado && Math.random() < qualidade) {
                emitir(pm.x + (Math.random() - 0.5) * 0.4, pm.y + (Math.random() - 0.5) * 0.4, pm.z,
                    (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 1 + Math.random() * 2,
                    en._cJ, (en.isBoss ? 0.9 : 0.4) + Math.random() * 0.2, 0.4, 1.5, 0);
            }
            // Telégrafo: faíscas convergindo + flare crescendo um instante antes do tiro
            if (CI.telegrafo && en.posicionado && en.shootTimer > 0 && en.shootTimer < CI.telegrafoTempo && orcTele > 0) {
                orcTele--;
                const g = 1 - en.shootTimer / CI.telegrafoTempo;      // 0 → 1
                const ee = clamp((en.hitRadius || 1.6) / 1.6, 0.7, 2.6);
                const ang = Math.random() * 6.283, rr = (0.7 + Math.random() * 0.5) * ee * (1 - g * 0.4);
                const ox = Math.cos(ang) * rr, oy = Math.sin(ang) * rr;
                emitir(pm.x + ox, pm.y + oy, pm.z + 0.6, -ox * 8, -oy * 8, 0, [1.0, 0.3, 1.0], 0.2, 0.12, 0, 0);
                emitir(pm.x, pm.y, pm.z + 0.6, 0, 0, 0, [1.0, 0.45, 1.0], (0.5 + g * 1.3) * ee, 0.05, 0, 0);
            }
        }

        // Cristais e power-ups: brilham, pulsam e deixam um rastro (fácil de ver e de querer pegar)
        const cri = estado.cristais, pus = estado.powerups;
        if (cri) for (let i = 0; i < cri.length; i++) {
            const m = cri[i].mesh;
            if (!m.userData._jb) m.userData._jb = m.scale.clone();
            const s = 1 + 0.2 * Math.sin(tempo * 9 + i * 1.7);
            m.scale.set(m.userData._jb.x * s, m.userData._jb.y * s, m.userData._jb.z * s);
            // cor do rastro: a cor do TIPO do cristal (cri[i].cor); se não vier, a cor do material.
            // (o cristal de cura agora é um modelo 3D com textura, cujo material é branco)
            const corC = cri[i].cor || (m.material && m.material.color);
            if (Math.random() < 0.22 * qualidade && corC) {
                emitir(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.5,
                    [corC.r, corC.g, corC.b], 0.14, 0.4, 1.5, 0);
            }
        }
        if (pus) for (let i = 0; i < pus.length; i++) {
            const pu = pus[i], m = pu.mesh;
            if (!m.userData._jb) m.userData._jb = m.scale.clone();
            const s = 1 + 0.15 * Math.sin(tempo * 7 + i);
            m.scale.set(m.userData._jb.x * s, m.userData._jb.y * s, m.userData._jb.z * s);
            pu._jT = (pu._jT || 0) - dt;
            if (pu._jT <= 0 && m.material && m.material.color) { // anel pulsando em volta, 2x por segundo
                pu._jT = 0.5;
                anel(m.position.x, m.position.y, m.position.z, [m.material.color.r, m.material.color.g, m.material.color.b], 0.3, 1.5, 0.5, 0.6, 0);
            }
            if (Math.random() < 0.3 * qualidade && m.material && m.material.color) {
                emitir(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0.5,
                    [m.material.color.r, m.material.color.g, m.material.color.b], 0.18, 0.45, 1.5, 0);
            }
        }

        // Raspão das balas inimigas
        if (CI.graze && estado.nave) verificarGraze(estado.balasInimigas, estado.nave, tempo);

        // Brilho + rastro + "vida" das balas (jogador, nitro e inimigas)
        orcRastro = Math.round(28 * qualidade);
        let n = 0;
        n = processarBalas(estado.balasJogador, JUICE_CFG.balaJogador, n, tempo, dt, false);
        n = processarBalas(estado.balasNitro, JUICE_CFG.balaJogador, n, tempo, dt, false);
        n = processarBalas(estado.balasInimigas, CI, n, tempo, dt, true);
        for (let i = n; i < brilhoUsado; i++) B.vida[i] = 0; // zera o que sobrou do frame anterior
        brilhoUsado = n;
        B.geo.setDrawRange(0, n);
        B.geo.attributes.position.needsUpdate = true;
        B.geo.attributes.aColor.needsUpdate = true;
        B.geo.attributes.aSize.needsUpdate = true;
        B.geo.attributes.aLife.needsUpdate = true;

        atualizarFaiscas(dt);
        atualizarAneis(dt);
        atualizarEstilhacos(dt);

        // FOV: "soco" (sobe rápido e volta suave) + abertura por velocidade
        fovP *= Math.exp(-7 * dtReal);
        if (fovP < 0.02) fovP = 0;
        const fovAlvo = fovP + (JUICE_CFG.cameraViva ? nv.fov : 0);
        if (Math.abs(fovAlvo - fovAplicado) > 0.01) {
            camera.fov = FOV_BASE + fovAlvo;
            camera.updateProjectionMatrix();
            fovAplicado = fovAlvo;
        }
        // Estrelas em "warp": acelera e volta
        warp *= Math.exp(-2.2 * dtReal);
        if (warp < 0.02) warp = 0;
    }

    return {
        cfg: JUICE_CFG,
        tremor,
        antesDoFrame, aposFrame, fisicaNave, ligarAmbiente,
        fatorEstrelas: () => 1 + warp,
        explosaoInimigo, acertoInimigo, tiro, faiscaInimigo,
        danoJogador, morteJogador, filtroDerrota, bomba, iniciarLote, fimLote,
        coleta, powerup, subiuNivel, nexusAtivada, motor,
        comboMarco, formacaoLimpa, onda, bossChegando, banner, sfx, ambEvento,
        flashTela, tremer, hitStop, slowmo, fovPunch, acelerarEstrelas, impulsoNave,
        perigo, balancar, pop, vibrar,
    };
}
