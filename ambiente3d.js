// ============================================================================
// ambiente3d.js — CENÁRIO ESPACIAL do Neon Raiders 3D
// ----------------------------------------------------------------------------
// Substitui o fundo antigo (pontos quadrados + portal de 3 anéis) por:
//
//   1) NEBULOSAS procedurais em 3 camadas com paralaxe (cores por mapa)
//   2) ESTRELAS de verdade: redondas, coloridas (azuis, brancas, amarelas,
//      laranjas, vermelhas), cintilando, com "pontas" de brilho nas maiores
//      e RISCOS DE VELOCIDADE (warp) quando a nave acelera
//   3) POEIRA CÓSMICA temática (neve, brasas... na cor do mapa)
//   4) PORTAL GALÁCTICO: buraco negro com anel de fótons, disco de acreção
//      em espiral girando, raios cósmicos, ondas de choque e uma galáxia
//      de poeira em órbita sendo engolida
//   5) PLANETA distante com atmosfera e luz vinda do portal
//
// Como esse arquivo se encaixa:
//   - Carrega ANTES do boss3d.js (ver game3d.html), junto do juice3d.js.
//   - O boss3d.js chama  const AMBIENTE = criarAmbiente({...})  e, todo
//     frame,  AMBIENTE.atualizar(dt, dtReal, tempo, fatorWarp).
//   - O juice3d.js avisa o ambiente dos momentos fortes (boss, bomba, combo)
//     e o portal REAGE (pulsa, gira mais rápido, solta onda de choque).
//   - Se este arquivo faltar (ou os shaders falharem), o boss3d.js volta
//     sozinho pro fundo antigo. Nada quebra.
//
// Performance (Android):
//   - Estrelas e poeira: a posição é calculada na GPU (vertex shader). A CPU
//     só atualiza 1 número por frame (antes eram 4000 pontos reescritos e
//     reenviados à GPU todo frame) — na prática o fundo novo é MAIS leve.
//   - Nebulosas e ruído são "assados" 1x na abertura da partida (~100-200ms,
//     atrás da tela de loading) e depois são só texturas.
//   - Auto-qualidade: o juice3d.js chama setQualidade() se o FPS cair, e o
//     ambiente reduz a quantidade de estrelas e desliga os efeitos mais caros.
// ============================================================================

// ── PAINEL DE CONTROLE — mexa à vontade ─────────────────────────────────────
const AMBIENTE_CFG = {
    ligado: true,         // false = volta ao fundo antigo (estrelas quadradas + 3 anéis)
    economico: false,     // true = versão leve pra celular fraco (menos estrelas, sem raios, sem planeta)
    nebulosa: 0.20,       // brilho das nebulosas de fundo (0 desliga, 1.5 = mais forte)
    ceuLigado: true,        // CÉU ESTRELADO lá no fundo (estrelinhas brancas quase paradas que só cintilam) — é o que fica ligado
    estrelasLigadas: false, // estrelas de VELOCIDADE (as que varrem a parte de baixo): desligadas por enquanto (futuro). true = voltam
    poeiraLigada: false,    // poeira cósmica (pontinhos brancos embaixo, parecem estrelas). Desligada junto. true = volta
    estrelas: 1.0,        // quantidade das estrelas de VELOCIDADE (as que passam por baixo da nave e dos inimigos)
    chao: 0.34,           // quão EMBAIXO as estrelas ficam: 0 = tela toda; 0.34 = só no terço de baixo; 0.5 = ainda mais embaixo (só a faixa final)
    corEstrelas: 0.0,     // 0 = todas brancas; 1 = cores reais de estrelas (azuis, amarelas, laranjas, vermelhas)
    velCombo: 1.0,        // as estrelas aceleram conforme o COMBO sobe (0 = velocidade sempre igual; 2 = acelera o dobro)
    ceu: 1.0,             // quantidade de estrelas do céu estrelado (0.5 = metade, 1.5 = mais)
    brilhoEstrelas: 1.0,  // brilho geral das estrelas
    riscosWarp: 1.0,      // tamanho dos riscos de velocidade quando a nave acelera (0 = sem riscos)
    poeira: 1.0,          // quantidade da poeira cósmica temática
    portal: {
        ligado: true,
        intensidade: 1.5, // brilho do portal. Se atrapalhar a visão dos tiros, baixe (0.7)
        tamanho: 0.8,     // multiplicador do tamanho (1 = ocupa boa parte do céu de cima)
        velocidade: 1.0,  // velocidade da rotação da espiral
        raios: 1.0,       // intensidade dos raios cósmicos saindo do portal (0 desliga)
        particulas: 2.0,  // quantidade de poeira/estrelas orbitando e sendo engolidas
        onda: true,       // ondas de choque periódicas saindo do horizonte de eventos
    },
    planeta: {
        ligado: true,
        tamanho: 1.0,
    },
};

// ── Paletas por mapa (0..1). "portal" vem da cor do tema; o resto é daqui ──
//   nebA/nebB = tons base da nebulosa, nebC = brilho quente dos núcleos
//   planeta = {tipo, c1, c2, atm}
const AMBIENTE_PALETAS = {
    1: { nebA: [0.00, 0.30, 0.65], nebB: [0.55, 0.05, 0.75], nebC: [0.20, 0.95, 1.00], planeta: { tipo: 'gasoso', c1: [0.10, 0.25, 0.55], c2: [0.75, 0.25, 0.85], atm: [0.20, 0.85, 1.00] } },
    2: { nebA: [0.05, 0.30, 0.55], nebB: [0.25, 0.55, 0.85], nebC: [0.75, 0.95, 1.00], planeta: { tipo: 'gelo', c1: [0.55, 0.78, 0.95], c2: [0.90, 0.97, 1.00], atm: [0.55, 0.85, 1.00] } },
    3: { nebA: [0.55, 0.08, 0.00], nebB: [0.85, 0.30, 0.00], nebC: [1.00, 0.75, 0.25], planeta: { tipo: 'lava', c1: [0.20, 0.03, 0.02], c2: [1.00, 0.35, 0.05], atm: [1.00, 0.45, 0.10] } },
    4: { nebA: [0.22, 0.03, 0.42], nebB: [0.50, 0.15, 0.85], nebC: [0.85, 0.55, 1.00], planeta: { tipo: 'sombrio', c1: [0.10, 0.04, 0.18], c2: [0.45, 0.20, 0.70], atm: [0.65, 0.30, 1.00] } },
    5: { nebA: [0.00, 0.35, 0.20], nebB: [0.05, 0.60, 0.45], nebC: [0.45, 1.00, 0.70], planeta: { tipo: 'tech', c1: [0.05, 0.22, 0.14], c2: [0.30, 0.95, 0.60], atm: [0.20, 1.00, 0.55] } },
    6: { nebA: [0.30, 0.00, 0.45], nebB: [0.75, 0.00, 0.65], nebC: [1.00, 0.40, 1.00], planeta: { tipo: 'vazio', c1: [0.02, 0.00, 0.04], c2: [0.60, 0.05, 0.60], atm: [1.00, 0.20, 1.00] } },
};

function criarAmbiente(ctx) {
    const scene = ctx.scene;
    const camera = ctx.camera;
    const renderer = ctx.renderer;
    const cfg = AMBIENTE_CFG;
    const eco = !!cfg.economico;
    const corHex = ctx.cor;             // cor de destaque do mapa (hex)
    const mapa = ctx.mapa || 1;

    const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
    const hexRgb = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
    const cor = hexRgb(corHex);

    // Mapa sem paleta (ex: o futuro Mapa 7): deriva tudo da cor do tema
    const pal = AMBIENTE_PALETAS[mapa] || {
        nebA: cor.map(c => c * 0.35), nebB: [cor[2] * 0.7, cor[0] * 0.7, cor[1] * 0.9], nebC: cor.map(c => Math.min(1, c * 0.6 + 0.4)),
        planeta: { tipo: 'gasoso', c1: cor.map(c => c * 0.3), c2: cor, atm: cor },
    };

    // ========================================================================
    // 1) RUÍDO PROCEDURAL PERIÓDICO (tileable) — base de nebulosas, portal, planeta
    // ========================================================================
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // Ruído de valor com "wrap" (some a emenda quando a textura repete).
    // Otimizado pro celular: reticulado em potência de 2 (máscara de bits no lugar de %),
    // (x|0) no lugar de Math.floor e um Float32Array por oitava. `base` DEVE ser potência de 2.
    function criarFbm(seed, base, oitavas) {
        const rnd = mulberry32(seed);
        const ns = [], lats = [];
        for (let o = 0; o < oitavas; o++) {
            const n = base << o, a = new Float32Array(n * n);
            for (let i = 0; i < a.length; i++) a[i] = rnd();
            ns.push(n); lats.push(a);
        }
        return function (u, v) { // u,v >= 0 — devolve 0..1 (repete a cada 1.0)
            let tot = 0, amp = 0.5, norm = 0;
            const uf = u - (u | 0), vf = v - (v | 0);
            for (let o = 0; o < oitavas; o++) {
                const n = ns[o], a = lats[o], m = n - 1;
                const x = uf * n, y = vf * n;
                const xi = x | 0, yi = y | 0;
                let fx = x - xi, fy = y - yi;
                fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
                const x0 = xi & m, x1 = (xi + 1) & m, y0 = (yi & m) * n, y1 = ((yi + 1) & m) * n;
                const top = a[y0 + x0] + (a[y0 + x1] - a[y0 + x0]) * fx;
                const bot = a[y1 + x0] + (a[y1 + x1] - a[y1 + x0]) * fx;
                tot += amp * (top + (bot - top) * fy);
                norm += amp; amp *= 0.5;
            }
            return tot / norm;
        };
    }
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

    function criarTextura(dados, w, h) {
        const t = new THREE.DataTexture(dados, w, h, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.needsUpdate = true;
        return t;
    }

    // Textura de ruído (R = nuvem suave, G = detalhe fino, B = fio) — usada pelo portal e pelo planeta
    function assarRuido(T) {
        const f1 = criarFbm(101, 4, 5), f2 = criarFbm(202, 8, 4), f3 = criarFbm(303, 8, 3);
        const d = new Uint8Array(T * T * 4);
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
            const u = x / T, v = y / T, i = (y * T + x) * 4;
            d[i] = f1(u, v) * 255; d[i + 1] = f2(u, v) * 255;
            d[i + 2] = (1 - Math.abs(f3(u, v) * 2 - 1)) * 255; d[i + 3] = 255;
        }
        return criarTextura(d, T, T);
    }

    // Nebulosa colorida com alfa (distorção de domínio = filamentos; faixa tipo Via Láctea)
    function assarNebulosa(T, seed, cA, cB, cC, banda) {
        const fD = criarFbm(seed, 4, 5), fW = criarFbm(seed + 7, 4, 4), fM = criarFbm(seed + 13, 4, 3), fP = criarFbm(seed + 21, 8, 3);
        const d = new Uint8Array(T * T * 4);
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
            const u = x / T, v = y / T, i = (y * T + x) * 4;
            const dd = fD(u, v);
            const ww = fW(u + 0.31 * dd, v + 0.17 * dd);
            let dens = sstep(0.38, 0.82, dd * 0.65 + ww * 0.5);
            if (banda) {
                const b = Math.exp(-Math.pow((v - 0.5 - 0.16 * Math.sin(u * 6.2832)) / 0.20, 2));
                dens = clamp(dens * 0.55 + b * sstep(0.30, 0.75, ww) * 0.9, 0, 1);
            }
            const m = sstep(0.3, 0.75, fM(u, v));
            const quente = Math.pow(dens, 3) * 0.9;
            const poeira = 1 - 0.55 * sstep(0.55, 0.9, fP(u, v)); // faixas escuras de poeira
            const a = dens * poeira * 0.85;
            d[i] = clamp((cA[0] * (1 - m) + cB[0] * m + cC[0] * quente) * 255, 0, 255);
            d[i + 1] = clamp((cA[1] * (1 - m) + cB[1] * m + cC[1] * quente) * 255, 0, 255);
            d[i + 2] = clamp((cA[2] * (1 - m) + cB[2] * m + cC[2] * quente) * 255, 0, 255);
            d[i + 3] = clamp(a * 255, 0, 255);
        }
        return criarTextura(d, T, T);
    }

    // Todo o "assar" fica dentro de try: se algo der errado, o ambiente desliga sem quebrar o jogo
    const texRuido = assarRuido(eco ? 128 : 256);
    const TNEB = eco ? 128 : 256;   // pequena de propósito: nebulosa é suave, e o shader soma detalhe fino por cima
    // A nebulosa principal (a mais visível) é assada agora. As duas camadas fracas da frente
    // são assadas alguns instantes depois (setTimeout) pra não travar a abertura da partida:
    // até lá elas usam uma textura vazia (transparente).
    const texNebA = assarNebulosa(TNEB, 11, pal.nebA, pal.nebB, pal.nebC, true);
    const texVazia = criarTextura(new Uint8Array(4), 1, 1);

    // ========================================================================
    // 2) CAMADAS DE NEBULOSA (planos gigantes bem no fundo, rolando devagar)
    // ========================================================================
    const camadasNeb = [];
    const NEB_VERT = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const NEB_FRAG = `
        uniform sampler2D uTex;
        uniform sampler2D uDet;   // ruído fino: dá textura de "gás" à nebulosa de baixa resolução
        uniform vec2 uOff;
        uniform float uRep;
        uniform float uInt;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv * uRep + uOff;
            vec4 t = texture2D(uTex, uv);
            float fino = texture2D(uDet, uv * 3.3 + vec2(0.17, 0.41)).g;
            float fino2 = texture2D(uDet, uv * 7.1).r;
            float modul = 0.55 + 0.9 * fino * (0.6 + 0.8 * fino2);
            gl_FragColor = vec4(t.rgb * uInt * modul, t.a * clamp(modul, 0.0, 1.2));
        }`;
    function camadaNebulosa(tex, z, larg, alt, y, rep, inten, vx, vy, ordem) {
        const mat = new THREE.ShaderMaterial({
            uniforms: { uTex: { value: tex }, uDet: { value: texRuido }, uOff: { value: new THREE.Vector2(Math.random(), Math.random()) }, uRep: { value: rep }, uInt: { value: inten } },
            vertexShader: NEB_VERT, fragmentShader: NEB_FRAG,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), mat);
        m.position.set(0, y, z);
        m.renderOrder = ordem;
        m.frustumCulled = false;
        scene.add(m);
        camadasNeb.push({ m, mat, vx, vy, base: inten });
    }
    // Três camadas em profundidades diferentes (as de trás mais brilhantes; as da frente mais fracas e rápidas)
    camadaNebulosa(texNebA, -420, 1700, 1300, -60, 2.2, 0.62, 0.0009, 0.0002, -30);
    camadaNebulosa(texVazia, -330, 1300, 1000, -50, 1.6, 0.34, -0.0016, 0.0004, -29);
    if (!eco) camadaNebulosa(texVazia, -280, 1100, 850, -40, 1.2, 0.20, 0.0026, -0.0003, -28);
    const TN2 = eco ? 64 : 128;
    setTimeout(() => { try { camadasNeb[1].mat.uniforms.uTex.value = assarNebulosa(TN2, 47, pal.nebB, pal.nebA, pal.nebC, false); } catch (e) { /* segue sem essa camada */ } }, 90);
    if (!eco) setTimeout(() => { try { camadasNeb[2].mat.uniforms.uTex.value = assarNebulosa(TN2, 83, pal.nebC.map(c => c * 0.6), pal.nebB, pal.nebA, false); } catch (e) { /* idem */ } }, 200);

    // ========================================================================
    // 3) CAMPO DE ESTRELAS EM GPU (redondas, coloridas, cintilando, com riscos de warp)
    //    Cada estrela é um "fita" (2 triângulos) esticada na tela do ponto onde
    //    está até onde estava um instante atrás. Parada = pontinho redondo;
    //    em warp = risco de velocidade.
    // ========================================================================
    const STAR_VERT = `
        attribute vec4 aDados;   // x = id (0..1), y = z inicial (0..1), z = velocidade relativa, w = tamanho (px)
        attribute vec4 aCor;     // rgb + brilho
        uniform float uZ;        // "distância percorrida" (acumulada na CPU)
        uniform float uTempo;
        uniform float uRango;    // extensão do túnel de estrelas em Z
        uniform float uZmin;     // z mais distante
        uniform float uStreak;   // comprimento do risco (segundos de viagem)
        uniform float uVel;      // unidades/s no túnel
        uniform vec2 uRes;       // resolução da tela em pixels
        uniform vec2 uFov;       // (tan(fov/2), aspecto)
        uniform vec3 uCam;       // posição da câmera
        uniform float uDeriva;   // deslocamento vertical acumulado (poeira temática: neve cai, brasa sobe)
        uniform float uPx;       // multiplicador de tamanho em pixels (pixel ratio)
        uniform float uFadeIn;   // distância (em Z) em que a estrela vai surgindo lá longe
        uniform vec2 uBanda;     // faixa de altura (y mínimo, y máximo) quando uModo = 1
        uniform float uModo;     // 0 = enche a tela toda (céu); 1 = só dentro da faixa uBanda (abaixo do jogo)
        varying vec2 vLoc;       // coordenadas locais em pixels (along, across)
        varying float vComp;     // comprimento do risco em pixels
        varying float vNucleo;   // raio do núcleo em pixels
        varying float vMeia;     // meia-largura da fita em pixels
        varying vec4 vCor;
        varying float vBril;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

        void main() {
            // s = progresso da estrela no túnel (0 = nasce longe, 1 = passa rente à câmera).
            // z = R*s²: mais estrelas LONGE (céu cheio, sem poluir a tela) e as de perto passam
            // mais rápido — paralaxe natural, como voar de verdade.
            float t = aDados.y + uZ * aDados.z / uRango;
            float ciclo = floor(t);
            float s = t - ciclo;
            float z = uRango * s * s;                     // 0..uRango
            float wz = uZmin + z;                         // z do mundo (longe → perto)
            float d = max(1.0, uCam.z - wz);              // distância até a câmera

            // A cada volta a estrela renasce em outro lugar (mas em ângulo constante: densidade uniforme na tela)
            float h1 = hash(vec2(aDados.x * 91.7, ciclo));
            float h2 = hash(vec2(aDados.x * 53.3 + 7.0, ciclo * 1.7));
            float larg = d * uFov.x * uFov.y * 1.25;
            float x = uCam.x + (h1 - 0.5) * 2.0 * larg;
            // Modo "chão": as estrelas só existem lá EMBAIXO — numa faixa de ângulo abaixo do horizonte
            // (uBanda = tangente do ângulo mínimo e máximo de descida). Assim elas ficam sempre no terço
            // de baixo da tela, qualquer que seja a distância: nascem longe, embaixo da nave e dos
            // inimigos, e varrem a parte de baixo passando por baixo da nave.
            float y = (uModo > 0.5) ? uCam.y - d * mix(uBanda.x, uBanda.y, h2) : uCam.y + d * mix(-0.95, 0.55, h2);
            y += uDeriva * (0.4 + aDados.x);              // deriva vertical (só a poeira usa: neve cai, brasa sobe)
            vec3 pos = vec3(x, y, wz);

            vec4 c0 = projectionMatrix * viewMatrix * vec4(pos, 1.0);
            vec4 c1 = projectionMatrix * viewMatrix * vec4(pos.x, pos.y, pos.z - uVel * aDados.z * uStreak * (0.4 + 1.6 * s), 1.0);   // risco maior nas estrelas próximas (elas andam mais rápido)
            vec2 s0 = c0.xy / c0.w * uRes * 0.5;
            vec2 s1 = c1.xy / c1.w * uRes * 0.5;
            vec2 dir = s1 - s0;
            float L = length(dir);
            dir = L > 0.001 ? dir / L : vec2(0.0, 1.0);
            vec2 nrm = vec2(-dir.y, dir.x);

            // tamanho em pixels: estrelas perto ficam um pouco maiores
            float tam = aDados.w * uPx * (1.0 + 1.6 * smoothstep(90.0, 8.0, d));
            float brilhante = step(0.8, aCor.a);
            float meia = tam * (2.6 + 2.4 * brilhante);   // fita com folga (o brilho some suave antes da borda); as brilhantes têm mais pra caber as pontas

            float ax = position.x;   // -1 ou 1 (lado)
            float ay = position.y;   //  0 (cabeça) ou 1 (cauda)
            float along = mix(-meia, L + meia, ay);
            // deslocamento em pixels (largura da fita + pontas redondas), convertido pra espaço de clip
            vec2 desloc = nrm * ax * meia + dir * mix(-meia, meia, ay);
            vec4 c = mix(c0, c1, ay);
            c.xy += desloc / (uRes * 0.5) * c.w;
            gl_Position = c;

            vLoc = vec2(along, ax * meia);
            vComp = L;
            vNucleo = tam;
            vMeia = meia;
            // some ao nascer lá longe e ao passar rente à câmera
            float fade = smoothstep(0.0, uFadeIn, z) * (1.0 - smoothstep(uRango - 10.0, uRango - 2.0, z));   // nascem suaves lá longe (sem "parede" de estrelas no horizonte)
            vCor = vec4(aCor.rgb, fade);
            // cintilação: cada estrela pisca no seu ritmo
            float tw = 0.72 + 0.28 * sin(uTempo * (1.5 + aDados.x * 5.0) + aDados.x * 40.0);
            vBril = aCor.a * tw;
        }`;
    const STAR_FRAG = `
        uniform float uAlfa;
        varying vec2 vLoc;
        varying float vComp;
        varying float vNucleo;
        varying float vMeia;
        varying vec4 vCor;
        varying float vBril;
        void main() {
            // distância até o segmento (cabeça→cauda): risco com pontas redondas
            float ao = clamp(vLoc.x, 0.0, vComp);
            vec2 q = vec2(vLoc.x - ao, vLoc.y);
            float dist = length(q) / max(vNucleo, 0.5);
            float miolo = exp(-dist * dist * 2.2);
            float halo = exp(-dist * 1.1) * 0.35;
            float luz = miolo + halo;
            // pontas de brilho (cruz) nas estrelas mais brilhantes quando quase paradas
            float pontas = 0.0;
            if (vBril > 0.75 && vComp < 3.0) {
                vec2 n = vec2(abs(vLoc.y), abs(vLoc.x)) / max(vNucleo, 0.5);
                pontas = max(exp(-n.x * 16.0 - n.y * 0.9), exp(-n.y * 16.0 - n.x * 0.9)) * 0.55;
            }
            float janela = 1.0 - smoothstep(0.55, 1.0, length(q) / max(vMeia, 0.5));   // some suave antes da borda da fita
            float a = (luz + pontas) * vBril * vCor.a * uAlfa * janela;
            vec3 col = mix(vCor.rgb, vec3(1.0), clamp(miolo * 0.6, 0.0, 1.0));
            gl_FragColor = vec4(col, a);   // (o blend aditivo já multiplica a cor pelo alfa)
        }`;

    // Espectro real de estrelas: maioria azul-branca, algumas amarelas/laranjas/vermelhas
    function corEstrela(r) {
        if (r < 0.50) return [0.72, 0.85, 1.00];
        if (r < 0.70) return [1.00, 1.00, 1.00];
        if (r < 0.82) return [1.00, 0.93, 0.70];
        if (r < 0.91) return [1.00, 0.76, 0.50];
        if (r < 0.96) return [1.00, 0.55, 0.45];
        return [0.55, 0.70, 1.00];
    }

    // Mistura a cor com BRANCO conforme cfg.corEstrelas (0 = branco puro, 1 = cor cheia)
    function cinza(c, k) { return [1 + (c[0] - 1) * k, 1 + (c[1] - 1) * k, 1 + (c[2] - 1) * k]; }

    function criarCampo(qtd, opcoes) {
        const geo = new THREE.InstancedBufferGeometry();
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        // quad base: x = lado (-1/1), y = ponta (0 cabeça / 1 cauda)
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
        const dados = new Float32Array(qtd * 4), cores = new Float32Array(qtd * 4);
        for (let i = 0; i < qtd; i++) {
            const r = Math.random();
            dados[i * 4] = Math.random();
            dados[i * 4 + 1] = Math.random();
            dados[i * 4 + 2] = opcoes.velMin + Math.random() * (opcoes.velMax - opcoes.velMin);
            // poucas estrelas grandes, muitas pequenas (lei de potência)
            const grande = Math.pow(Math.random(), opcoes.expTam);
            dados[i * 4 + 3] = opcoes.tamMin + grande * (opcoes.tamMax - opcoes.tamMin);
            let c;
            if (opcoes.tema) { c = cinza(opcoes.tema, cfg.corEstrelas + 0.12); }   // poeira: branca com um toque da cor do mapa
            else c = cinza(corEstrela(Math.random()), cfg.corEstrelas);
            cores[i * 4] = c[0]; cores[i * 4 + 1] = c[1]; cores[i * 4 + 2] = c[2];
            // brilho: maioria fraca, poucas fortes
            cores[i * 4 + 3] = opcoes.brilMin + Math.pow(Math.random(), opcoes.expBril) * (opcoes.brilMax - opcoes.brilMin);
        }
        geo.setAttribute('aDados', new THREE.InstancedBufferAttribute(dados, 4));
        geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cores, 4));
        geo.instanceCount = qtd;
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uZ: { value: 0 }, uTempo: { value: 0 }, uRango: { value: opcoes.rango }, uZmin: { value: opcoes.zMin },
                uStreak: { value: 0.02 }, uVel: { value: 60 }, uRes: { value: new THREE.Vector2(800, 600) },
                uFov: { value: new THREE.Vector2(0.64, 1) }, uCam: { value: new THREE.Vector3() },
                uDeriva: { value: 0 }, uPx: { value: 1 }, uAlfa: { value: opcoes.alfa },
                uBanda: { value: new THREE.Vector2(opcoes.banda ? opcoes.banda[0] : 0, opcoes.banda ? opcoes.banda[1] : 0) },
                uModo: { value: opcoes.banda ? 1 : 0 },
                uFadeIn: { value: opcoes.fadeIn || 60 },
            },
            vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
            // DoubleSide é ESSENCIAL aqui: a fita é montada na tela pelo shader e os triângulos saem
            // "de costas" pro culling padrão do three.js (era isso que escondia TODAS as estrelas).
            side: THREE.DoubleSide,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;   // as posições são calculadas na GPU: o corte automático não as conhece
        mesh.renderOrder = opcoes.ordem;
        scene.add(mesh);
        return { mesh, mat, geo, qtdMax: qtd, opcoes };
    }

    // Estrelas de VELOCIDADE: só lá embaixo (faixa de ângulo abaixo do horizonte, ver cfg.chao).
    // Nascem longe, embaixo do portal e dos inimigos, e passam varrendo a parte de baixo da tela.
    // (Com cfg.estrelasLigadas = false nenhum desses campos é criado: zero custo de GPU/CPU.)
    const QTD_ESTRELAS = Math.round((eco ? 600 : 1300) * cfg.estrelas);
    const campoEstrelas = cfg.estrelasLigadas ? criarCampo(QTD_ESTRELAS, {
        velMin: 0.45, velMax: 2.4, tamMin: 1.2, tamMax: 3.6, expTam: 2.6, brilMin: 0.4, brilMax: 1.0, expBril: 1.4,
        rango: 270, zMin: -262, alfa: 0.7 * cfg.brilhoEstrelas, ordem: 1, banda: [cfg.chao, 1.05],
    }) : null;
    // Céu estrelado de fundo: estrelinhas minúsculas praticamente PARADAS (só cintilam). Dá cara de espaço
    // sem encher a tela de coisas vindo na direção do jogador. cfg.ceu = 0 desliga.
    const QTD_CEU = Math.round((eco ? 400 : 900) * cfg.ceu);
    const campoCeu = (cfg.ceuLigado && QTD_CEU > 0) ? criarCampo(QTD_CEU, {
        // só LONGE (z de -262 a -172: nenhuma estrela chega perto da câmera) e quase paradas
        velMin: 0.01, velMax: 0.03, tamMin: 0.9, tamMax: 2.3, expTam: 3.0, brilMin: 0.25, brilMax: 0.85, expBril: 1.6,
        rango: 90, zMin: -262, fadeIn: 18, alfa: 0.7 * cfg.brilhoEstrelas, ordem: 0,
    }) : null;
    // Poeira cósmica temática (substitui as "partículas de clima" quadradas): mais lenta, na cor do mapa,
    // também só abaixo do jogo (neve cai / brasa sobe nos mapas que têm deriva)
    const QTD_POEIRA = Math.round((eco ? 120 : 300) * cfg.poeira);
    const campoPoeira = cfg.poeiraLigada ? criarCampo(QTD_POEIRA, {
        velMin: 0.6, velMax: 1.5, tamMin: 2.0, tamMax: 8.5, expTam: 2.2, brilMin: 0.25, brilMax: 0.75, expBril: 1.3,
        rango: 200, zMin: -190, alfa: 0.55, ordem: 2, tema: cor, banda: [cfg.chao + 0.04, 1.0],
    }) : null;
    const CAMPOS = [campoEstrelas, campoPoeira, campoCeu].filter(Boolean);   // só os que existem

    // ========================================================================
    // 4) PORTAL GALÁCTICO — buraco negro + disco de acreção + raios + galáxia orbitando
    // ========================================================================
    const PORTAL_Z = -240;
    const PORTAL_Y = 26;
    const PORTAL_R = 80;   // meia-largura do plano do disco (unidades do mundo)
    const grupoPortal = new THREE.Group();
    grupoPortal.position.set(0, PORTAL_Y, PORTAL_Z);
    scene.add(grupoPortal);

    const PORTAL_VERT = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

    // Disco de acreção + anel de fótons + ondas de choque (tudo num único quad)
    const DISCO_FRAG = `
        uniform sampler2D uRuido;
        uniform float uT;         // tempo
        uniform vec3 uCor;        // cor do mapa
        uniform float uInt;       // intensidade
        uniform float uPulso;     // 0..1+ (reage a boss/bomba/combo)
        uniform float uOnda;      // progresso da onda de choque (-1 = sem onda)
        varying vec2 vUv;
        void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            if (r >= 1.0) discard;
            float a = atan(p.y, p.x);

            // espiral logarítmica + rotação diferencial (o miolo gira bem mais rápido que a borda)
            float swirl = 2.4 * log(r + 0.03);
            float rot = uT * 0.5 / (0.30 + r * 2.0);
            float ang = a + swirl - rot;
            float u = ang * 0.15915494;

            float n1 = texture2D(uRuido, vec2(u, r * 1.7 - uT * 0.01)).r;
            float n2 = texture2D(uRuido, vec2(u * 2.0 + 0.37, r * 3.3)).g;
            #ifndef ECO
                float n3 = texture2D(uRuido, vec2(u * 3.0 + 0.11, r * 5.0 + uT * 0.02)).r;
                float n4 = texture2D(uRuido, vec2(u + 0.5, r * 15.0 - uT * 0.03)).r;   // filamentos orbitais
            #else
                float n3 = 0.5;
                float n4 = 0.5;
            #endif
            float arms  = pow(max(0.5 + 0.5 * cos(3.0 * ang), 0.0), 2.2);
            float arms2 = pow(max(0.5 + 0.5 * cos(5.0 * ang + 1.3), 0.0), 3.0);
            float dens = (arms * 1.15 + arms2 * 0.5) * (0.25 + 1.1 * n1) * (0.55 + 0.9 * n4) + 0.60 * n2 * n3 + 0.10;

            float interno = smoothstep(0.225, 0.30, r);
            float queda = exp(-(r - 0.24) * 2.9) * (1.0 - smoothstep(0.62, 1.0, r));

            // cor: núcleo quente (quase branco) → cor do mapa → violeta frio na borda
            float k = smoothstep(0.24, 0.85, r);
            vec3 quente = uCor * 0.35 + 0.65;
            vec3 frio = uCor * vec3(0.5, 0.35, 1.0) * 0.35;
            vec3 col = mix(quente, uCor, smoothstep(0.0, 0.33, k));
            col = mix(col, frio, smoothstep(0.4, 1.0, k));

            // "beaming" relativístico: um lado do disco é mais brilhante que o outro
            float beam = 0.62 + 0.5 * cos(a - 0.9);
            vec3 luz = col * dens * queda * interno * beam * (1.0 + 0.6 * uPulso) * 2.0;

            // anel de fótons (fininho e brilhante) + halo
            float qa = (r - 0.235) / 0.010;
            float anel = exp(-qa * qa) * 2.6;
            float halo = (r > 0.235 ? exp(-(r - 0.235) * 16.0) : 0.0) * 0.55;
            luz += (anel + halo) * (vec3(1.0, 0.96, 0.9) * 0.7 + uCor * 0.5) * (1.0 + 0.5 * uPulso);

            // onda de choque saindo do horizonte
            if (uOnda >= 0.0) {
                float rr = 0.25 + uOnda * 0.75;
                float qo = (r - rr) / 0.03;
                luz += uCor * exp(-qo * qo) * (1.0 - uOnda) * 0.7;
            }
            luz *= uInt;
            luz *= step(0.20, r);       // horizonte de eventos: preto absoluto
            gl_FragColor = vec4(luz, 1.0);   // alfa 1: soma a luz exatamente como calculada
        }`;
    // Raios cósmicos: feixes radiais girando devagar (só depende do ângulo)
    const RAIOS_FRAG = `
        uniform sampler2D uRuido;
        uniform float uT;
        uniform vec3 uCor;
        uniform float uInt;
        varying vec2 vUv;
        void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            if (r >= 1.0) discard;
            float a = atan(p.y, p.x) * 0.15915494;
            float f1 = texture2D(uRuido, vec2(a * 4.0 + uT * 0.010, 0.5)).r;
            float f2 = texture2D(uRuido, vec2(a * 7.0 - uT * 0.017, 0.25)).g;
            float feixe = pow(clamp((f1 - 0.45) * 3.0, 0.0, 1.0), 2.0) + 0.6 * pow(clamp((f2 - 0.5) * 3.0, 0.0, 1.0), 2.0);
            float f = feixe * exp(-r * 2.6) * smoothstep(0.10, 0.22, r) * (1.0 - smoothstep(0.7, 1.0, r));
            vec3 luz = uCor * f * uInt;
            gl_FragColor = vec4(luz, 1.0);
        }`;

    const defines = eco ? { ECO: 1 } : {};
    const matDisco = new THREE.ShaderMaterial({
        uniforms: { uRuido: { value: texRuido }, uT: { value: 0 }, uCor: { value: new THREE.Vector3(cor[0], cor[1], cor[2]) },
            uInt: { value: 1 }, uPulso: { value: 0 }, uOnda: { value: -1 } },
        defines, vertexShader: PORTAL_VERT, fragmentShader: DISCO_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const discoMesh = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_R * 2, PORTAL_R * 2), matDisco);
    discoMesh.renderOrder = -20;
    discoMesh.frustumCulled = false;

    const matRaios = new THREE.ShaderMaterial({
        uniforms: { uRuido: { value: texRuido }, uT: { value: 0 }, uCor: { value: new THREE.Vector3(cor[0], cor[1], cor[2]) }, uInt: { value: 1 } },
        vertexShader: PORTAL_VERT, fragmentShader: RAIOS_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const raiosMesh = new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_R * 2.6, PORTAL_R * 2.6), matRaios);
    raiosMesh.position.z = -1;
    raiosMesh.renderOrder = -24;
    raiosMesh.frustumCulled = false;

    // Disco preto opaco do horizonte de eventos (esconde a nebulosa atrás do "buraco")
    const matHorizonte = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });   // escreve profundidade: esconde o que está atrás do buraco
    const horizonteMesh = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_R * 0.215, 48), matHorizonte);
    horizonteMesh.position.z = 0.2;
    horizonteMesh.renderOrder = -22;
    horizonteMesh.frustumCulled = false;

    // Os 3 anéis tracejados originais (identidade do portal antigo), agora em volta do buraco negro
    function anelTracejado(raio, dash, gap, cor, op) {
        const pontos = [];
        for (let i = 0; i <= 160; i++) { const ang = (i / 160) * Math.PI * 2; pontos.push(new THREE.Vector3(Math.cos(ang) * raio, Math.sin(ang) * raio, 0)); }
        const geo = new THREE.BufferGeometry().setFromPoints(pontos);
        const mat = new THREE.LineDashedMaterial({ color: cor, dashSize: dash, gapSize: gap, transparent: true, opacity: op, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
        const linha = new THREE.LineLoop(geo, mat);
        linha.computeLineDistances();
        linha.renderOrder = -19;
        linha.frustumCulled = false;
        return linha;
    }
    const aneis = [
        anelTracejado(PORTAL_R * 0.50, 3.4, 1.8, corHex, 0.55),
        anelTracejado(PORTAL_R * 0.58, 2.4, 2.2, 0xffffff, 0.30),
        anelTracejado(PORTAL_R * 0.66, 5.0, 2.6, corHex, 0.35),
    ];

    // Galáxia de poeira/estrelas em órbita: espiral, cada partícula gira mais rápido perto do centro e é engolida
    const ORB_VERT = `
        attribute vec4 aOrb;     // x = raio inicial (0..1), y = ângulo inicial, z = velocidade de queda, w = fase
        attribute vec3 aCorO;
        uniform float uT;
        uniform float uScale;
        uniform float uR;        // raio máximo em unidades
        uniform float uInt;
        varying vec3 vC;
        varying float vA;
        void main() {
            float cicloT = uT * aOrb.z * 0.035 + aOrb.w;
            float f = fract(aOrb.x + cicloT);                // 0 = borda externa, 1 = engolida
            float r01 = mix(1.0, 0.24, f * f * 0.85 + f * 0.15);   // acelera perto do fim
            float omega = 1.7 / (0.30 + r01 * 2.0);          // mesma rotação diferencial do disco
            float ang = aOrb.y + uT * 0.5 * omega * 0.55 + 2.4 * log(r01 + 0.03) * -0.3;
            vec3 pos = vec3(cos(ang), sin(ang), 0.0) * r01 * uR;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mv;
            float fade = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.86, 1.0, f));
            vA = fade * uInt;
            vC = mix(aCorO, vec3(1.0), f * 0.6);             // esquenta ao cair
            gl_PointSize = clamp((0.5 + aOrb.w * 1.4) * uScale * (1.0 - f * 0.4) / max(1.0, -mv.z), 1.5, 14.0);
        }`;
    const ORB_FRAG = `
        varying vec3 vC;
        varying float vA;
        void main() {
            float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
            if (d > 1.0) discard;
            float m = 1.0 - smoothstep(0.0, 1.0, d);
            gl_FragColor = vec4(vC, m * m * vA);
        }`;
    const QTD_ORB = Math.round((eco ? 500 : 1800) * cfg.portal.particulas);
    const orbGeo = new THREE.BufferGeometry();
    {
        const pos = new Float32Array(QTD_ORB * 3);                 // (não usado, mas o three exige o atributo position)
        const orb = new Float32Array(QTD_ORB * 4), cores = new Float32Array(QTD_ORB * 3);
        const cA = cor, cB = pal.nebC;
        for (let i = 0; i < QTD_ORB; i++) {
            orb[i * 4] = Math.random();
            orb[i * 4 + 1] = Math.random() * Math.PI * 2;
            orb[i * 4 + 2] = 0.5 + Math.random() * 1.6;
            orb[i * 4 + 3] = Math.random();
            const t = Math.random();
            cores[i * 3] = cA[0] * (1 - t) + cB[0] * t + 0.15; cores[i * 3 + 1] = cA[1] * (1 - t) + cB[1] * t + 0.15; cores[i * 3 + 2] = cA[2] * (1 - t) + cB[2] * t + 0.15;
        }
        orbGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        orbGeo.setAttribute('aOrb', new THREE.BufferAttribute(orb, 4));
        orbGeo.setAttribute('aCorO', new THREE.BufferAttribute(cores, 3));
    }
    const matOrb = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uScale: { value: 600 }, uR: { value: PORTAL_R * 1.0 }, uInt: { value: 0.85 } },
        vertexShader: ORB_VERT, fragmentShader: ORB_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const orbPontos = new THREE.Points(orbGeo, matOrb);
    orbPontos.renderOrder = -18;
    orbPontos.frustumCulled = false;

    grupoPortal.add(raiosMesh, horizonteMesh, discoMesh, orbPontos, ...aneis);

    // ========================================================================
    // 5) PLANETA DISTANTE (esfera com faixas/continentes, atmosfera e terminador)
    // ========================================================================
    let planeta = null;
    if (cfg.planeta.ligado && !eco) {
        const P = pal.planeta;
        const tipoId = { gasoso: 0, gelo: 1, lava: 2, sombrio: 3, tech: 4, vazio: 5 }[P.tipo] || 0;
        const PL_VERT = `
            varying vec3 vN;
            varying vec3 vV;
            varying vec3 vObj;
            void main() {
                vObj = normalize(position);
                vN = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`;
        const PL_FRAG = `
            uniform sampler2D uRuido;
            uniform float uRot;
            uniform vec3 uC1;
            uniform vec3 uC2;
            uniform vec3 uAtm;
            uniform vec3 uLuz;      // direção da luz (espaço da câmera)
            uniform float uTipo;
            varying vec3 vN;
            varying vec3 vV;
            varying vec3 vObj;
            void main() {
                vec3 n = normalize(vN);
                float lat = vObj.y;
                float lon = atan(vObj.z, vObj.x) * 0.15915494 + uRot;
                float base = texture2D(uRuido, vec2(lon, lat * 0.45 + 0.5)).r;
                float det = texture2D(uRuido, vec2(lon * 3.0, lat * 1.4 + 0.5)).g;
                float superficie;
                if (uTipo < 0.5) {            // gasoso: faixas horizontais turbulentas
                    superficie = 0.5 + 0.5 * sin(lat * 14.0 + base * 4.0 + det * 2.0);
                } else if (uTipo < 1.5) {     // gelo: rachaduras claras
                    superficie = smoothstep(0.35, 0.8, base * 0.7 + det * 0.5);
                } else if (uTipo < 2.5) {     // lava: continentes escuros com rios incandescentes
                    superficie = smoothstep(0.45, 0.62, base + det * 0.25);
                } else {                      // sombrio / tech / vazio: manchas
                    superficie = smoothstep(0.3, 0.75, base * 0.8 + det * 0.4);
                }
                vec3 albedo = mix(uC1, uC2, superficie);
                float difuso = clamp(dot(n, normalize(uLuz)), 0.0, 1.0);
                float noturno = 1.0 - smoothstep(0.0, 0.25, difuso);
                vec3 col = albedo * (0.04 + difuso * 0.8);   // planeta discreto: não disputa atenção com os inimigos
                // lava e tech brilham no lado escuro
                if (uTipo > 1.5 && uTipo < 2.5) col += uC2 * (1.0 - superficie) * 0.9 * noturno;
                if (uTipo > 3.5 && uTipo < 4.5) col += uC2 * smoothstep(0.55, 0.7, det) * 0.5 * noturno;
                // atmosfera (fresnel) mais forte do lado iluminado
                float fres = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);
                col += uAtm * fres * (0.25 + 0.95 * difuso);
                gl_FragColor = vec4(col, 1.0);
            }`;
        const matP = new THREE.ShaderMaterial({
            uniforms: {
                uRuido: { value: texRuido }, uRot: { value: 0 }, uC1: { value: new THREE.Vector3(...P.c1) }, uC2: { value: new THREE.Vector3(...P.c2) },
                uAtm: { value: new THREE.Vector3(...P.atm) }, uLuz: { value: new THREE.Vector3(0.35, 0.8, 0.5) }, uTipo: { value: tipoId },
            },
            vertexShader: PL_VERT, fragmentShader: PL_FRAG,
        });
        const R_PLANETA = 40 * cfg.planeta.tamanho;
        planeta = new THREE.Mesh(new THREE.SphereGeometry(R_PLANETA, 48, 32), matP);
        planeta.position.set(-88, -110, -360);
        planeta.renderOrder = -26;
        planeta.frustumCulled = false;
        scene.add(planeta);
        // Halo da atmosfera (esfera maior, só a borda brilha)
        const matHalo = new THREE.ShaderMaterial({
            uniforms: { uAtm: { value: new THREE.Vector3(...P.atm) } },
            vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
            fragmentShader: `uniform vec3 uAtm; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(dot(normalize(vN), normalize(vV)),0.0,1.0), 2.5); gl_FragColor = vec4(uAtm, f*0.75); }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
        });
        const halo = new THREE.Mesh(new THREE.SphereGeometry(R_PLANETA * 1.09, 40, 24), matHalo);
        halo.renderOrder = -25;
        halo.frustumCulled = false;
        planeta.add(halo);
    }

    // ========================================================================
    // 6) ESTADO, REAÇÕES E LOOP
    // ========================================================================
    let tPortal = 0;           // relógio do portal (tempo do jogo)
    let zAcum = 0;             // "distância" percorrida pelas estrelas
    let derivaAcum = 0;
    let pulso = 0;             // reação a eventos (decai sozinho)
    let girosExtra = 0;        // aceleração temporária da espiral
    let onda = -1;             // progresso da onda de choque (-1 = parada)
    let proxOnda = 5;          // segundos até a próxima onda automática
    let qual = 1;
    const DERIVA = { 2: -0.4, 3: 0.5 }[mapa] || 0;   // mesma deriva do clima antigo (gelo cai, fogo sobe)
    const _camPos = new THREE.Vector3();

    // ── REDE DE SEGURANÇA ──
    // Se algum shader deste arquivo falhar ao compilar no aparelho, o three.js só escreve um erro
    // no console e o objeto some. Aqui a gente escuta esse erro nos primeiros quadros; se for
    // nosso, desmonta o cenário novo e avisa o boss3d.js (ctx.aoFalhar), que devolve o fundo antigo.
    const MARCAS = ['aDados', 'aOrb', 'uRango', 'uRuido', 'uOnda', 'uTipo', 'uOff', 'uRep'];
    const _erroOriginal = console.error;
    let falhou = false, ativo = true, quadros = 0;
    console.error = function () {
        try {
            const txt = Array.prototype.map.call(arguments, a => String(a)).join(' ');
            if (/shader|WebGLProgram|WebGLShader/i.test(txt) && MARCAS.some(m => txt.indexOf(m) >= 0)) falhou = true;
        } catch (e) { /* ignora */ }
        return _erroOriginal.apply(console, arguments);
    };

    function redimensionar() {
        const w = renderer.domElement.width, h = renderer.domElement.height;
        const pr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
        for (const c of CAMPOS) {
            c.mat.uniforms.uRes.value.set(w, h);
            c.mat.uniforms.uPx.value = pr;
        }
        matOrb.uniforms.uScale.value = (h * 0.5) / Math.tan((camera.fov * Math.PI / 180) * 0.5);
    }
    window.addEventListener('resize', () => setTimeout(redimensionar, 60));
    redimensionar();

    // Momentos do jogo que fazem o portal reagir
    function evento(nome) {
        switch (nome) {
            case 'boss': pulso = Math.max(pulso, 1.6); girosExtra = Math.max(girosExtra, 3.0); onda = 0; break;
            case 'bomba': pulso = Math.max(pulso, 1.1); onda = 0; break;
            case 'marco': pulso = Math.max(pulso, 0.7); break;
            case 'nivel': pulso = Math.max(pulso, 0.8); onda = 0; break;
            case 'limpa': pulso = Math.max(pulso, 0.5); break;
            case 'dano': pulso = Math.max(pulso, 0.25); break;
        }
    }
    // O juice3d.js chama isso quando o FPS cai/sobe (q entre 0.4 e 1)
    function setQualidade(q) {
        qual = q;
        if (campoEstrelas) campoEstrelas.geo.instanceCount = Math.max(300, Math.round(campoEstrelas.qtdMax * clamp(q, 0.4, 1)));
        if (campoPoeira) campoPoeira.geo.instanceCount = Math.max(60, Math.round(campoPoeira.qtdMax * clamp(q, 0.4, 1)));
        if (campoCeu) campoCeu.geo.instanceCount = Math.max(150, Math.round(campoCeu.qtdMax * clamp(q, 0.4, 1)));
        raiosMesh.visible = cfg.portal.raios > 0 && q >= 0.6;
        orbPontos.visible = q >= 0.5;
        if (camadasNeb[2]) camadasNeb[2].m.visible = q >= 0.7;   // nebulosa da frente é a primeira a sair
        if (camadasNeb[1]) camadasNeb[1].m.visible = q >= 0.5;
    }

    // Chamado uma vez por frame. dt = tempo do jogo (encolhe em hit-stop/câmera lenta),
    // dtReal = tempo real, tempo = relógio do jogo, warp = 1 normal, >1 acelerando (bomba/boss)
    function atualizar(dt, dtReal, tempo, warp, combo) {
        if (!ativo) return;
        quadros++;
        if (falhou) { // shader nosso quebrou: volta pro fundo antigo
            console.error = _erroOriginal; ativo = false; desmontar();
            _erroOriginal.call(console, '[ambiente3d] shader falhou — voltando ao fundo antigo');
            if (ctx.aoFalhar) ctx.aoFalhar();
            return;
        }
        if (quadros === 12) console.error = _erroOriginal; // já compilou tudo: para de escutar
        tPortal += dt;
        pulso *= Math.exp(-1.3 * dtReal);
        girosExtra *= Math.exp(-0.8 * dtReal);
        const w = Math.max(1, warp || 1);

        // -- estrelas e poeira: só atualiza uniforms (a GPU faz o resto) --
        // O combo acelera o fluxo de estrelas (até +50% em combo 40): quanto melhor você joga, mais rápido parece voar
        const velBase = 1 + Math.min(combo || 0, 40) * 0.0125 * cfg.velCombo;
        zAcum += 60 * dt * w * velBase;
        derivaAcum += dt * DERIVA;
        _camPos.copy(camera.position);
        const tf = Math.tan((camera.fov * Math.PI / 180) * 0.5);
        const streak = 0.014 + (w - 1) * 0.11 * cfg.riscosWarp;   // riscos de velocidade (em repouso já esticam um pouco)      // em warp o risco cresce
        for (const c of CAMPOS) {
            const u = c.mat.uniforms;
            u.uZ.value = zAcum; u.uTempo.value = tempo;
            u.uStreak.value = streak; u.uVel.value = 60;
            u.uFov.value.set(tf, camera.aspect);
            u.uCam.value.copy(_camPos);
        }
        if (campoPoeira) campoPoeira.mat.uniforms.uDeriva.value = derivaAcum;

        // -- nebulosas rolando em velocidades diferentes (paralaxe) --
        for (const cn of camadasNeb) {
            const off = cn.mat.uniforms.uOff.value;
            off.x += cn.vx * dt * (1 + (w - 1) * 2); off.y += cn.vy * dt;
            cn.mat.uniforms.uInt.value = cn.base * cfg.nebulosa * (1 + 0.25 * pulso);
        }

        // -- portal --
        const P = cfg.portal;
        const visivel = P.ligado;
        grupoPortal.visible = visivel;
        if (visivel) {
            const vel = P.velocidade * (1 + girosExtra);
            const tt = tPortal * vel;
            matDisco.uniforms.uT.value = tt;
            matDisco.uniforms.uInt.value = P.intensidade;
            matDisco.uniforms.uPulso.value = pulso;
            matRaios.uniforms.uT.value = tt;
            matRaios.uniforms.uInt.value = P.raios * P.intensidade * 0.9 * (1 + pulso * 0.9);
            matOrb.uniforms.uT.value = tt;
            matOrb.uniforms.uInt.value = 0.85 * P.intensidade;
            aneis[0].rotation.z += dt * 0.25 * vel;   // externo — direita (igual ao portal antigo)
            aneis[1].rotation.z -= dt * 0.35 * vel;   // meio — esquerda
            aneis[2].rotation.z += dt * 0.45 * vel;   // interno — direita
            const respira = 1 + Math.sin(tempo * 0.7) * 0.015 + pulso * 0.05;
            grupoPortal.scale.setScalar(P.tamanho * respira);
            grupoPortal.position.y = PORTAL_Y + Math.sin(tempo * 0.5) * 0.5;
            // ondas de choque: periódicas + as que os eventos disparam
            if (P.onda) { proxOnda -= dt; if (proxOnda <= 0 && onda < 0) { onda = 0; proxOnda = 7 + Math.random() * 5; } }
            if (onda >= 0) { onda += dt / 1.8; if (onda >= 1) onda = -1; }
            matDisco.uniforms.uOnda.value = onda;
        }

        // -- planeta: gira devagar; a luz vem do portal --
        if (planeta) {
            planeta.material.uniforms.uRot.value = tempo * 0.004;
            planeta.rotation.y = 0;
            // direção portal → planeta, em espaço da câmera
            const luz = planeta.material.uniforms.uLuz.value;
            luz.set(grupoPortal.position.x - planeta.position.x, grupoPortal.position.y - planeta.position.y, grupoPortal.position.z - planeta.position.z).normalize();
            luz.transformDirection(camera.matrixWorldInverse);
        }
    }

    // Remove tudo da cena (usado como fallback se algo falhar)
    function desmontar() {
        for (const o of [...CAMPOS.map(c => c.mesh), grupoPortal, planeta, ...camadasNeb.map(c => c.m)]) if (o) scene.remove(o);
    }

    // Tudo pronto: aplica a qualidade inicial (útil pro modo econômico)
    setQualidade(eco ? 0.7 : 1);

    return {
        atualizar, evento, setQualidade, redimensionar,
        desmontar,
    };
}
