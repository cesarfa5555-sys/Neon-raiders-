// ════════════════════════════════════════════════════════════════
// BOSS3D.JS — motor principal: cena/câmera/nave, controles, tiro do
// jogador, cristais/power-ups, HUD, Firebase, XP/nível, game over/
// vitória e o loop principal. Carrega DEPOIS de inimigos3d.js.
// ════════════════════════════════════════════════════════════════

        function getGameWidth() { return window.innerWidth; }
        function getGameHeight() { return window.innerHeight; }

        // ── MAPA/NÍVEL — vem da URL igual ao boss.js real (mapa=X&nivel=Y).
        // Chamei de "nivelDoMapa" (não "nivelAtual") pra não colidir com
        // o nível de XP do jogador, que já usa esse nome desde a Camada 9.
        const _params = new URLSearchParams(location.search);
        const mapaAtual = Number(_params.get('mapa')) || 1;
        const nivelDoMapa = Number(_params.get('nivel')) || 1;

        // ── PAINEL DE DEBUG (só pra você, nunca pro jogador) ─────────────
        // Só liga com ?debug=1 na URL — o link normal que os jogadores
        // usam pra jogar nunca tem esse parâmetro, então eles nunca veem
        // esse painel (nem sabem que ele existe). Mostra ao vivo, quadro
        // a quadro: mapa/nível, formação atual (dano/HP total dos
        // inimigos vivos na tela), boss (se tiver), DPS do jogador e um
        // TTK (tempo-pra-matar) estimado com os números de agora — pra
        // conferir o balanceamento jogando de verdade, sem precisar só
        // confiar nas contas feitas fora do jogo.
        const DEBUG_MODO = _params.get('debug') === '1';

        // Cores/tema por mapa — mesmos valores de MAPA_PORTAL_COR/MAPA_VISUAL
        // do boss.js real (só simplificado pro 3D: aqui é 1 cor de destaque +
        // 1 cor de fog por mapa, não o gradiente de fundo completo do 2D)
        const MAPA_TEMA_3D = {
            1: { nome: 'CYBERPUNK', cor: 0x00ffff, corFog: 0x050015 },
            2: { nome: 'GLACIAL',   cor: 0x88ccff, corFog: 0x001a33 },
            3: { nome: 'INFERNAL',  cor: 0xff6600, corFog: 0x1a0500 },
            4: { nome: 'SOMBRIO',   cor: 0xaa44ff, corFog: 0x0a0015 },
            5: { nome: 'ROBÓTICO',  cor: 0x00ff88, corFog: 0x001505 },
            6: { nome: 'VOID',      cor: 0xff00ff, corFog: 0x050005 },
        };
        const temaMapa = MAPA_TEMA_3D[mapaAtual] || MAPA_TEMA_3D[1];

        // ── SONS — mesmos arquivos de áudio do jogo 2D real. Precisam
        // estar na mesma pasta do game3d.html pra funcionar (error_004.ogg
        // e minimize_006.ogg já existem no projeto, reaproveitados aqui)
        const shootSound = new Audio('plasma-punch (1).wav');
        shootSound.volume = 1;
        const enemyDeathSound = new Audio('plasma-custom-death (1).wav');
        enemyDeathSound.volume = 1;
        // ── MOTOR DE ÁUDIO DOS EFEITOS (tiro, morte de inimigo) ─────────────
        // BUG CORRIGIDO: antes cada tiro fazia audio.cloneNode() e tocava o clone. O som do
        // tiro (tiro5.mp3) dura ~2s e a cadência é de 6 a 16 tiros por segundo, então se
        // acumulavam dezenas de elementos <audio> ao mesmo tempo. O Android limita quantos
        // players de mídia podem existir, e depois de 5-7s segurando o botão o navegador
        // simplesmente parava de tocar (até a rajada acabar e o lixo ser coletado).
        // Agora o arquivo é baixado e decodificado UMA vez (Web Audio) e cada tiro é só uma
        // "voz" leve que usa o mesmo buffer — sem limite de players. Se o Web Audio ou o
        // download falharem (ex: abrir o arquivo direto, sem servidor), cai num pool FIXO de
        // no máximo 6 elementos <audio> por som, reaproveitados em rodízio (nunca vaza).
        const AUDIO_MAX_VOZES = 16;      // vozes simultâneas por som; passou disso, a mais antiga é cortada suavemente
        const AUDIO_POOL_TAMANHO = 6;    // elementos <audio> do plano B
        const _AC = window.AudioContext || window.webkitAudioContext;
        let audioCtxFx = null;
        try { if (_AC) audioCtxFx = new _AC(); } catch (e) { audioCtxFx = null; }
        const buffersSom = new Map();    // url -> AudioBuffer já decodificado
        const vozesSom = new Map();      // url -> vozes tocando agora [{ src, ganho }]
        const poolsSom = new Map();      // url -> { els: [], i: 0 } (plano B)

        // Navegadores só liberam áudio depois de um toque: destrava no primeiro toque na tela
        function destravarAudioFx() {
            if (audioCtxFx && audioCtxFx.state === 'suspended') audioCtxFx.resume().catch(() => {});
        }
        ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, destravarAudioFx, { capture: true, passive: true }));

        // Baixa e decodifica o arquivo do som (1 vez). Se falhar, o plano B (pool) assume.
        function prepararSomBuffer(audio) {
            if (!audioCtxFx) return;
            const url = audio.src;
            fetch(url)
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
                .then(ab => new Promise((ok, erro) => {
                    const p = audioCtxFx.decodeAudioData(ab, ok, erro);   // (forma com callback + promise: funciona em navegador antigo e novo)
                    if (p && p.catch) p.catch(erro);
                }))
                .then(buf => buffersSom.set(url, buf))
                .catch(e => console.warn('NRSom: não decodifiquei ' + url + ' — usando o plano B (pool de <audio>)', e));
        }

        // Toca uma voz do buffer (leve: não cria elemento de mídia nenhum)
        function tocarBuffer(url, buf, volume, taxa, pan) { // pan (opcional): -1 = todo na esquerda ... +1 = todo na direita (tiro-onda.js)
            destravarAudioFx();
            const src = audioCtxFx.createBufferSource();
            src.buffer = buf;
            src.playbackRate.value = taxa || 1;       // muda velocidade e tom juntos (igual ao preservesPitch=false de antes)
            const ganho = audioCtxFx.createGain();
            ganho.gain.value = volume;
            src.connect(ganho);
            let panner = null; // lado do som (só se o navegador tiver StereoPanner)
            if (pan && audioCtxFx.createStereoPanner) {
                try { panner = audioCtxFx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan)); ganho.connect(panner); panner.connect(audioCtxFx.destination); } catch (e) { panner = null; }
            }
            if (!panner) ganho.connect(audioCtxFx.destination);
            const voz = { src, ganho };
            let lista = vozesSom.get(url);
            if (!lista) { lista = []; vozesSom.set(url, lista); }
            lista.push(voz);
            src.onended = () => {                      // terminou: libera tudo
                const i = lista.indexOf(voz); if (i >= 0) lista.splice(i, 1);
                try { src.disconnect(); ganho.disconnect(); if (panner) panner.disconnect(); } catch (e) { /* já solto */ }
            };
            src.start(0);
            if (lista.length > AUDIO_MAX_VOZES) {      // muitas vozes: corta a mais antiga com um fade curtinho (sem estalo)
                const velha = lista.shift();
                try { velha.ganho.gain.setTargetAtTime(0, audioCtxFx.currentTime, 0.02); velha.src.stop(audioCtxFx.currentTime + 0.1); } catch (e) { /* já parou */ }
            }
        }

        // Plano B: pool fixo de elementos <audio> reaproveitados em rodízio
        function tocarSomPool(audio, taxa, vol) {
            const url = audio.src;
            let pool = poolsSom.get(url);
            if (!pool) { pool = { els: [], i: 0 }; poolsSom.set(url, pool); }
            let el;
            if (pool.els.length < AUDIO_POOL_TAMANHO) { el = audio.cloneNode(); pool.els.push(el); }
            else { el = pool.els[pool.i]; pool.i = (pool.i + 1) % AUDIO_POOL_TAMANHO; }
            el.volume = Math.min(1, audio.volume * (vol || 1));
            if (taxa) { el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false; el.playbackRate = taxa; }
            try { el.currentTime = 0; el.play().catch(() => {}); } catch (e) { /* autoplay bloqueado antes da 1ª interação — ignora */ }
        }

        function tocarSom(audio, taxa, pan, vol) { // pan e vol (opcionais) vêm do tiro-onda.js: lado e volume do tiro
            // taxa (opcional): velocidade/tom do som. Usado pra variar o tom do tiro
            // e subir o tom do som de morte com o combo (juice de áudio).
            const buf = audioCtxFx && buffersSom.get(audio.src);
            if (buf) { try { tocarBuffer(audio.src, buf, audio.volume * (vol || 1), taxa, pan); return; } catch (e) { /* cai no plano B */ } }
            tocarSomPool(audio, taxa, vol);
        }
        prepararSomBuffer(shootSound);
        prepararSomBuffer(enemyDeathSound);

        // ── TELA DE LOADING — mesma ideia da real (index.html): barra de
        // progresso + dicas rotativas, só que aqui o "carregamento" real é
        // montar a cena 3D e esperar o Firebase conectar, não baixar
        // assets grandes (o jogo é leve, então isso tende a ser rápido).
        const DICAS_LOADING = [
            "O UniCard pode ser usado para evoluir qualquer nave da frota.",
            "Desvie dos asteroides vermelhos, eles têm blindagem reforçada!",
            "Mantenha o propulsor ativo para ganhar bônus de velocidade passivo.",
            "Melhore seus canhões de plasma no menu de hangar antes de chefões.",
            "Coletar poeira cósmica azul recupera seu escudo instantaneamente.",
        ];
        const elLoadingBarra = document.getElementById('barraLoadingFill');
        const elLoadingPct = document.getElementById('percentualLoading');
        const elLoadingDica = document.getElementById('dicaLoading');
        function atualizarLoading(pct) {
            elLoadingBarra.style.width = pct + '%';
            elLoadingPct.textContent = pct + '%';
        }
        elLoadingDica.textContent = 'Dica: ' + DICAS_LOADING[Math.floor(Math.random() * DICAS_LOADING.length)];
        elLoadingDica.classList.add('visivel');
        const _loadingInicio = performance.now();
        function esconderLoading() {
            // Garante um tempo mínimo de exibição (~700ms) pra não "piscar"
            // quando tudo carrega rápido demais — mesma sensação do real
            const passado = performance.now() - _loadingInicio;
            const espera = Math.max(0, 700 - passado);
            setTimeout(() => {
                atualizarLoading(100);
                document.getElementById('telaLoading').classList.add('saindo');
                setTimeout(iniciarContagem, 350); // com o loading já sumindo, começa o 3-2-1-GO
            }, espera);
        }
        atualizarLoading(20); // script começou a rodar

        // ── Texto flutuante (ex: "+5 XP") — projeta a posição 3D pra tela
        // e anima um <div> subindo e sumindo. Não é geometria 3D (custaria
        // caro carregar fonte 3D só pra isso); é só um overlay de HTML.
        function mostrarTextoFlutuante(worldPos, texto, cor) {
            const vetor = worldPos.clone().project(camera);
            const x = (vetor.x * 0.5 + 0.5) * getGameWidth();
            const y = (-vetor.y * 0.5 + 0.5) * getGameHeight();
            const el = document.createElement('div');
            el.textContent = texto;
            el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;transform:translate(-50%,-50%);' +
                'font-family:\'Orbitron\',monospace;font-weight:900;font-size:14px;color:' + cor + ';text-shadow:0 0 8px ' + cor + ';' +
                'pointer-events:none;z-index:25;transition:transform 0.8s ease-out, opacity 0.8s ease-out;opacity:1;';
            document.getElementById('container').appendChild(el);
            requestAnimationFrame(() => { el.style.transform = 'translate(-50%, -140%)'; el.style.opacity = '0'; });
            setTimeout(() => el.remove(), 850);
        }

        // ── 1. CENA, CÂMERA E RENDERER ──────────────────────────────
        const container = document.getElementById('container');
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(temaMapa.corFog, 0.012);

        const camera = new THREE.PerspectiveCamera(65, getGameWidth() / getGameHeight(), 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(getGameWidth(), getGameHeight());
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(temaMapa.corFog);
        container.appendChild(renderer.domElement);

        // ── 2. ILUMINAÇÃO (igual à referência do Gemini) ────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const pinkLight = new THREE.DirectionalLight(0xff44ff, 1.5);
        pinkLight.position.set(0, 10, -10);
        scene.add(pinkLight);
        const cyanLight = new THREE.DirectionalLight(0x00ffff, 1.0);
        cyanLight.position.set(0, 5, 5);
        scene.add(cyanLight);

        // ── 2.5 JUICE (GAME FEEL) ────────────────────────────────────
        // Todo o "tempero" visual do jogo (explosões, brilho dos tiros,
        // tremor de tela, hit-stop, flashes...) vive no juice3d.js. Aqui só
        // criamos o objeto e depois chamamos JUICE.xxx nos momentos certos.
        // Se o juice3d.js não for carregado (arquivo faltando), usamos um
        // objeto "mudo" que não faz nada — o jogo roda igual ao de antes.
        const JUICE = (typeof criarJuice === 'function')
            ? criarJuice({ scene, camera, renderer, container, corTema: temaMapa.cor, altura: getGameHeight })
            : new Proxy({}, { get: (_, k) => k === 'tremor' ? { px: 0, py: 0, tx: 0, ty: 0, roll: 0 }
                                             : (k === 'antesDoFrame' || k === 'fatorEstrelas') ? () => 1
                                             : () => {} });

        // ── 3. CAMPO DE ESTRELAS ─────────────────────────────────────
        const starGeo = new THREE.BufferGeometry();
        const starCount = 3500;
        const starPositions = new Float32Array(starCount * 3);
        const starVelocities = [];
        for (let i = 0; i < starCount; i++) {
            starPositions[i * 3]     = (Math.random() - 0.5) * 200;
            starPositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
            starPositions[i * 3 + 2] = -Math.random() * 200;
            starVelocities.push(0.5 + Math.random() * 2.0);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.9 }));
        scene.add(stars);
        // Estrelas desligadas por enquanto (AMBIENTE_CFG.estrelasLigadas = false, no ambiente3d.js):
        // tira também estas estrelas antigas. As linhas acima/abaixo continuam aqui pro futuro.
        const ESTRELAS_LIGADAS = (typeof AMBIENTE_CFG !== 'undefined') && AMBIENTE_CFG.estrelasLigadas;
        if (!ESTRELAS_LIGADAS) scene.remove(stars);

        // ── PARTÍCULAS TEMÁTICAS DO MAPA — versão 3D simplificada dos
        // bgParticles por mapa do boss.js real (lá cada mapa tem um
        // padrão diferente: neve caindo no gelo, brasa subindo no fogo,
        // etc). Aqui é uma camada extra de pontos coloridos com a cor
        // do mapa, com uma leve tendência vertical por mapa.
        const climaGeo = new THREE.BufferGeometry();
        const climaCount = 500;
        const climaPositions = new Float32Array(climaCount * 3);
        for (let i = 0; i < climaCount; i++) {
            climaPositions[i * 3] = (Math.random() - 0.5) * 160;
            climaPositions[i * 3 + 1] = (Math.random() - 0.5) * 160;
            climaPositions[i * 3 + 2] = -Math.random() * 160;
        }
        climaGeo.setAttribute('position', new THREE.BufferAttribute(climaPositions, 3));
        const clima = new THREE.Points(climaGeo, new THREE.PointsMaterial({ color: temaMapa.cor, size: 0.5, transparent: true, opacity: 0.5 }));
        scene.add(clima);
        // Deriva vertical por mapa: 2=gelo cai, 3=fogo sobe, resto neutro
        const CLIMA_DRIFT_Y = { 2: -0.4, 3: 0.5 }[mapaAtual] || 0;

        // ── 3.5 PORTAL NO HORIZONTE (substitui a lua) ─────────────────
        // 3 anéis TRACEJADOS (estilo radar/scanner, igual à referência) +
        // núcleo brilhante + partículas sendo "puxadas" pro centro — tudo
        // na cor do mapa (temaMapa.cor). A 1ª e a 3ª faixa giram pra um
        // lado, a do meio gira pro lado oposto — mesmo padrão da imagem.
        const moonGroup = new THREE.Group(); // mantive o nome moonGroup pra não quebrar outras referências
        const portalNucleo = new THREE.Mesh(
            new THREE.CircleGeometry(9, 48),
            new THREE.MeshBasicMaterial({ color: temaMapa.cor, transparent: true, opacity: 0.85, fog: false })
        );
        moonGroup.add(portalNucleo);

        // Cria um anel tracejado (círculo com espaços) usando LineLoop +
        // material com dash — precisa de computeLineDistances() pra o
        // dash funcionar
        function criarAnelTracejado(raio, dashSize, gapSize, cor, opacidade) {
            const pontos = [];
            const segmentos = 128;
            for (let i = 0; i <= segmentos; i++) {
                const a = (i / segmentos) * Math.PI * 2;
                pontos.push(new THREE.Vector3(Math.cos(a) * raio, Math.sin(a) * raio, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pontos);
            const mat = new THREE.LineDashedMaterial({ color: cor, dashSize, gapSize, transparent: true, opacity: opacidade, fog: false });
            const linha = new THREE.LineLoop(geo, mat);
            linha.computeLineDistances();
            return linha;
        }
        const portalAnel1 = criarAnelTracejado(15, 2.2, 1.1, temaMapa.cor, 0.9);   // externo — gira pra direita
        const portalAnel2 = criarAnelTracejado(12.5, 1.6, 1.3, 0xffffff, 0.6);     // meio — gira pra esquerda
        const portalAnel3 = criarAnelTracejado(10.5, 1.2, 0.9, temaMapa.cor, 0.75); // interno — gira pra direita
        moonGroup.add(portalAnel1, portalAnel2, portalAnel3);

        const auraPink = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: temaMapa.cor, transparent: true, opacity: 0.15, fog: false }));
        auraPink.position.z = -2;
        moonGroup.add(auraPink);
        moonGroup.position.set(0, 20, -150);
        scene.add(moonGroup);

        // Partículas sendo puxadas pro centro do portal (efeito de sucção)
        const PORTAL_PARTICULA_QTD = 120;
        const portalParticulaGeo = new THREE.BufferGeometry();
        const portalParticulaPos = new Float32Array(PORTAL_PARTICULA_QTD * 3);
        const portalParticulaEstado = []; // {angulo, raio} — coordenada polar no plano do portal
        for (let i = 0; i < PORTAL_PARTICULA_QTD; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const raio = 16 + Math.random() * 26;
            portalParticulaEstado.push({ angulo, raio, vel: 4 + Math.random() * 6 });
            portalParticulaPos[i * 3] = Math.cos(angulo) * raio;
            portalParticulaPos[i * 3 + 1] = Math.sin(angulo) * raio;
            portalParticulaPos[i * 3 + 2] = 0;
        }
        portalParticulaGeo.setAttribute('position', new THREE.BufferAttribute(portalParticulaPos, 3));
        const portalParticulas = new THREE.Points(portalParticulaGeo, new THREE.PointsMaterial({ color: temaMapa.cor, size: 0.6, transparent: true, opacity: 0.9, fog: false }));
        moonGroup.add(portalParticulas);

        // ── 3.6 AMBIENTE ESPACIAL NOVO (ambiente3d.js) ────────────────
        // Nebulosas, estrelas de verdade (com riscos de warp), poeira cósmica, o PORTAL
        // GALÁCTICO (buraco negro + disco de acreção) e um planeta distante. Quando o
        // ambiente novo está ativo, as estrelas quadradas, as partículas de clima e o
        // portal antigo acima ficam FORA da cena (o código deles continua aqui, e volta
        // a valer sozinho se o ambiente3d.js faltar ou se algum shader falhar no aparelho).
        let AMBIENTE = null;
        if (typeof criarAmbiente === 'function' && AMBIENTE_CFG.ligado) {
            try {
                AMBIENTE = criarAmbiente({
                    scene, camera, renderer, cor: temaMapa.cor, mapa: mapaAtual,
                    aoFalhar: () => { AMBIENTE = null; if (ESTRELAS_LIGADAS) scene.add(stars); scene.add(clima); scene.add(moonGroup); } // volta o fundo antigo (sem estrelas se estiverem desligadas)
                });
                scene.remove(stars); scene.remove(clima); scene.remove(moonGroup);
                JUICE.ligarAmbiente(AMBIENTE); // o portal passa a reagir a boss, bomba, combo...
            } catch (e) { console.warn('ambiente3d falhou, usando o fundo antigo:', e); AMBIENTE = null; }
        }


        // ── 4. NAVE DO JOGADOR (mesmo modelo da referência do Gemini) ─
        // ── 6 NAVES REAIS — desenhadas a partir dos sprites reais do 2D
        // (1781027164830.png, striker.png, crimson.png, warbat-2.png,
        // cyer.png, spectre.png). 3 são brancas/azuis (padrao/striker/
        // crimson), 3 são vermelhas/douradas (warbat/cyer/spectre) — duas
        // "famílias". Tamanho cresce de padrão pra spectre (degrau de
        // poder, igual ao pedido). Striker e cyer eram pixel art no 2D —
        // aqui saem lisas (sem serrilhado), só a silhueta reaproveitada.
        // Formas mais robustas (nada fino), como pedido.

        function createShipPadrao() {
            // Bico único + asas em degrau + joia ciano no cockpit
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0xccd2dd, roughness: 0.35, metalness: 0.6 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.5 });
            const matNeon = new THREE.MeshBasicMaterial({ color: 0x3366ff });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0x00eeff });

            const bicoGeo = new THREE.ConeGeometry(0.55, 2.4, 6);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            const asaGeo = new THREE.BoxGeometry(1.9, 0.22, 1.2);
            const asaL = new THREE.Mesh(asaGeo, matEscuro); asaL.position.set(-1.0, 0, 0.3); asaL.rotation.y = 0.25; asaL.rotation.z = 0.08;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matEscuro); asaR.position.set(1.0, 0, 0.3); asaR.rotation.y = -0.25; asaR.rotation.z = -0.08;
            group.add(asaR);

            const faixaGeo = new THREE.BoxGeometry(1.7, 0.08, 0.18);
            const faixaL = new THREE.Mesh(faixaGeo, matNeon); faixaL.position.set(-1.0, 0.14, 0.55);
            group.add(faixaL);
            const faixaR = new THREE.Mesh(faixaGeo, matNeon); faixaR.position.set(1.0, 0.14, 0.55);
            group.add(faixaR);

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), matJoia);
            joia.position.set(0, 0.15, -0.4);
            group.add(joia);

            group.scale.set(0.5, 0.5, 0.5);
            return group;
        }

        function createShipStriker() {
            // Triangular compacta, mais robusta que o sprite pixelado —
            // joia azul funda oval, asas curtas e grossas
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0xdfe4ee, roughness: 0.3, metalness: 0.55 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x142438, roughness: 0.45 });
            const matNeon = new THREE.MeshBasicMaterial({ color: 0x55bbff });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0x2266cc });

            const bicoGeo = new THREE.ConeGeometry(0.6, 2.1, 8);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            const asaGeo = new THREE.BoxGeometry(2.1, 0.24, 1.0);
            const asaL = new THREE.Mesh(asaGeo, matEscuro); asaL.position.set(-1.05, 0, 0.5); asaL.rotation.y = 0.3;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matEscuro); asaR.position.set(1.05, 0, 0.5); asaR.rotation.y = -0.3;
            group.add(asaR);

            const bordaGeo = new THREE.BoxGeometry(1.9, 0.1, 0.15);
            const bordaL = new THREE.Mesh(bordaGeo, matNeon); bordaL.position.set(-1.05, 0.15, 0.75);
            group.add(bordaL);
            const bordaR = new THREE.Mesh(bordaGeo, matNeon); bordaR.position.set(1.05, 0.15, 0.75);
            group.add(bordaR);

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), matJoia);
            joia.scale.set(0.85, 1.2, 0.7);
            joia.position.set(0, 0.15, -0.15);
            group.add(joia);

            group.scale.set(0.55, 0.55, 0.55);
            return group;
        }

        function createShipCrimson() {
            // 2 espigões no lugar de 1 + plataformas de asa com canhõezinhos
            // vermelhos nas pontas — mais robusta, corpo mais largo
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0xc4c9d2, roughness: 0.3, metalness: 0.6 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.5 });
            const matArma = new THREE.MeshBasicMaterial({ color: 0xff3344 });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0x1a3a66 });

            const bicoGeo = new THREE.ConeGeometry(0.65, 2.3, 4);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            [-0.35, 0.35].forEach(x => {
                const espigaoGeo = new THREE.ConeGeometry(0.14, 1.1, 4);
                espigaoGeo.rotateX(Math.PI / 2);
                const espigao = new THREE.Mesh(espigaoGeo, matCasco);
                espigao.position.set(x, 0.1, -1.3);
                group.add(espigao);
            });

            const asaGeo = new THREE.BoxGeometry(2.4, 0.26, 1.3);
            const asaL = new THREE.Mesh(asaGeo, matEscuro); asaL.position.set(-1.2, 0, 0.5); asaL.rotation.y = 0.28;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matEscuro); asaR.position.set(1.2, 0, 0.5); asaR.rotation.y = -0.28;
            group.add(asaR);

            [-2.1, -1.6, 1.6, 2.1].forEach(x => {
                const canhao = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), matArma);
                canhao.rotation.x = Math.PI / 2;
                canhao.position.set(x, 0.05, 1.1);
                group.add(canhao);
            });

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), matJoia);
            joia.position.set(0, 0.15, -0.3);
            group.add(joia);

            group.scale.set(0.62, 0.62, 0.62);
            return group;
        }

        function createShipWarbat() {
            // Casco vermelho/dourado, dardo mais robusto, joia dourada
            // grande, canos duplos por baixo das asas
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0xaa2b2b, roughness: 0.35, metalness: 0.5 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x5a1414, roughness: 0.45 });
            const matArma = new THREE.MeshBasicMaterial({ color: 0x661616 });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

            const bicoGeo = new THREE.ConeGeometry(0.7, 2.5, 6);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            const asaGeo = new THREE.BoxGeometry(2.3, 0.26, 1.3);
            const asaL = new THREE.Mesh(asaGeo, matCasco); asaL.position.set(-1.15, 0, 0.5); asaL.rotation.y = 0.3;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matCasco); asaR.position.set(1.15, 0, 0.5); asaR.rotation.y = -0.3;
            group.add(asaR);

            [-0.75, 0.75].forEach(x => {
                const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.6, 10), matEscuro);
                pod.rotation.x = Math.PI / 2;
                pod.position.set(x, -0.15, 1.0);
                group.add(pod);
                [x - 0.12, x + 0.12].forEach(xc => {
                    const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), matArma);
                    cano.rotation.x = Math.PI / 2;
                    cano.position.set(xc, -0.15, 1.35);
                    group.add(cano);
                });
            });

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), matJoia);
            joia.position.set(0, 0.15, -0.3);
            group.add(joia);

            group.scale.set(0.7, 0.7, 0.7);
            return group;
        }

        function createShipCyer() {
            // Robusta, 2 chifres pequenos, joia vermelha, pods de motor
            // atrás — sprite original era pixelado, aqui sai lisa
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0x8c1f1f, roughness: 0.3, metalness: 0.5 });
            const matDourado = new THREE.MeshStandardMaterial({ color: 0xddaa33, roughness: 0.35, metalness: 0.6 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x442211, roughness: 0.5 });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0xff2222 });

            const bicoGeo = new THREE.ConeGeometry(0.68, 2.4, 6);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            [-0.3, 0.3].forEach(x => {
                const chifreGeo = new THREE.ConeGeometry(0.1, 0.7, 4);
                chifreGeo.rotateX(Math.PI / 2);
                const chifre = new THREE.Mesh(chifreGeo, matDourado);
                chifre.position.set(x, 0.2, -1.35);
                group.add(chifre);
            });

            const asaGeo = new THREE.BoxGeometry(2.5, 0.28, 1.3);
            const asaL = new THREE.Mesh(asaGeo, matCasco); asaL.position.set(-1.25, 0, 0.55); asaL.rotation.y = 0.28;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matCasco); asaR.position.set(1.25, 0, 0.55); asaR.rotation.y = -0.28;
            group.add(asaR);

            [-0.85, 0.85].forEach(x => {
                const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 10), matEscuro);
                motor.rotation.x = Math.PI / 2;
                motor.position.set(x, -0.15, 1.1);
                group.add(motor);
            });

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 14), matJoia);
            joia.position.set(0, 0.15, -0.3);
            group.add(joia);

            group.scale.set(0.78, 0.78, 0.78);
            return group;
        }

        function createShipSpectre() {
            // A mais forte — 2 espigões, joia dourada grande, canhões
            // quádruplos nos pods, motores gêmeos grandes atrás
            const group = new THREE.Group();
            const matCasco = new THREE.MeshStandardMaterial({ color: 0x771818, roughness: 0.25, metalness: 0.55 });
            const matDourado = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.25, metalness: 0.7 });
            const matEscuro = new THREE.MeshStandardMaterial({ color: 0x3a0d0d, roughness: 0.45 });
            const matArma = new THREE.MeshBasicMaterial({ color: 0x881818 });
            const matJoia = new THREE.MeshBasicMaterial({ color: 0xffdd55 });

            const bicoGeo = new THREE.ConeGeometry(0.72, 2.6, 6);
            bicoGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bicoGeo, matCasco));

            [-0.34, 0.34].forEach(x => {
                const espigaoGeo = new THREE.ConeGeometry(0.12, 1.0, 4);
                espigaoGeo.rotateX(Math.PI / 2);
                const espigao = new THREE.Mesh(espigaoGeo, matDourado);
                espigao.position.set(x, 0.2, -1.4);
                group.add(espigao);
            });

            const asaGeo = new THREE.BoxGeometry(2.7, 0.3, 1.4);
            const asaL = new THREE.Mesh(asaGeo, matCasco); asaL.position.set(-1.35, 0, 0.55); asaL.rotation.y = 0.3;
            group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matCasco); asaR.position.set(1.35, 0, 0.55); asaR.rotation.y = -0.3;
            group.add(asaR);

            [-0.9, 0.9].forEach(x => {
                const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.75, 10), matEscuro);
                pod.rotation.x = Math.PI / 2;
                pod.position.set(x, -0.15, 1.15);
                group.add(pod);
                [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]].forEach(([ox, oy]) => {
                    const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), matArma);
                    cano.rotation.x = Math.PI / 2;
                    cano.position.set(x + ox, -0.15 + oy, 1.55);
                    group.add(cano);
                });
            });

            const joia = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), matJoia);
            joia.position.set(0, 0.15, -0.35);
            group.add(joia);

            group.scale.set(0.85, 0.85, 0.85);
            return group;
        }

        const NAVES_MODELOS_3D = {
            padrao: createShipPadrao,
            striker: createShipStriker,
            crimson: createShipCrimson,
            warbat: createShipWarbat,
            cyer: createShipCyer,
            spectre: createShipSpectre,
            // Vanguard: modelo em vanguard3d.js. Se o script não carregar,
            // cai na padrão em vez de quebrar o jogo
            vanguard: (typeof createShipVanguard === 'function') ? createShipVanguard : createShipPadrao,
            // Plasma: modelo e habilidade (tiro carregado de 3 s) em plasma.js
            plasma: (typeof createShipPlasma === 'function') ? createShipPlasma : createShipPadrao,
        };

        function createFighterShip() {
            // Escolhe o modelo pelo naveAtual salvo. A "vanguard" vem do
            // vanguard3d.js (modelo 3D próprio, com fogo nas turbinas)
            const id = localStorage.getItem('naveAtual') || 'padrao';
            const construtor = NAVES_MODELOS_3D[id] || NAVES_MODELOS_3D.padrao;
            return construtor();
        }

        const shipGroup = createFighterShip();
        scene.add(shipGroup);

        // ── 5. ÁREA DE VOO (limites do plano onde a nave desliza) ────
        // No jogo 2D o jogador desliza livre em x/y dentro da tela do
        // canvas. Aqui a nave desliza livre num PLANO fixo em relação à
        // câmera (profundidade Z travada) — largura/altura desse plano
        // definem os limites, igual aos limites de tela do 2D.
        const VOO = {
            xMin: -4.2, xMax: 4.2,   // esquerda/direita
            yMin: 0.6,  yMax: 9.5,   // baixo/cima (a nave sobe/desce, não entra/sai de profundidade) — teto mais alto pra formação abrir mais pra cima
            zFixo: 0,                 // profundidade fixa da nave em relação à cena
        };

        // Agora que VOO existe, dá pra iniciar a primeira formação —
        // iniciarFormacao() é definida no inimigos3d.js (carrega antes
        // deste arquivo), mas só podia ser CHAMADA depois de VOO existir
        iniciarFormacao();

        // Posição "neutra" — onde a nave começa e pra onde tende a
        // voltar suavemente no eixo Y quando não há comando (opcional,
        // deixa mais previsível controlar). Ajuste livre depois.
        const shipState = {
            x: 0,
            y: (VOO.yMin + VOO.yMax) / 2,
            vx: 0,
            vy: 0,
        };
        shipGroup.position.set(shipState.x, shipState.y, VOO.zFixo);

        // ── 6. CÂMERA ANGULADA (por trás e de cima da nave) ──────────
        // Nem top-down (olhando reto de cima) nem rail-shooter (câmera
        // reta atrás olhando só pra frente) — um meio-termo tipo
        // "chase cam" de cima, pra dar a sensação de top-down do 2D
        // mas com profundidade 3D visível.
        const CAMERA_OFFSET = new THREE.Vector3(0, 4.5, 7.5); // acima e atrás da nave
        const CAMERA_LOOKAHEAD = new THREE.Vector3(0, -1.2, -10); // profundidade da mira à frente da nave
        // Antes a câmera e a mira subiam/desciam quase junto com a nave
        // (ambas usavam shipGroup.position.y cheio), então a diferença de
        // altura entre câmera/nave quase não mudava — por isso a subida e
        // descida pareciam curtas. Agora a câmera e a mira seguem só uma
        // fração pequena da altura da nave (CAMERA_FOLLOW_Y), deixando a
        // diferença de altura variar bem mais — a nave sobe/desce visivelmente
        // dentro do quadro em vez de "andar junto" com a câmera.
        const CAMERA_ALTURA_BASE = 4.3;   // altura fixa de referência da câmera
        const MIRA_ALTURA_BASE = 1.2;     // altura fixa de referência da mira
        const CAMERA_FOLLOW_Y = 0.12;     // 0 = câmera nunca segue a altura; 1 = seguia igual antes (bug)

        function atualizarCamera() {
            // Tremor de tela (juice3d.js): 'px/py' balançam a câmera, 'tx/ty' balançam
            // a mira e 'roll' gira a imagem. Tudo vale 0 quando não há tremor.
            const sh = JUICE.tremor;
            camera.position.set(
                shipGroup.position.x * 0.4 + sh.px, // câmera acompanha só parcialmente o X (mais estável, menos "enjoo")
                CAMERA_ALTURA_BASE + shipState.y * CAMERA_FOLLOW_Y + sh.py,
                shipGroup.position.z + CAMERA_OFFSET.z
            );
            camera.lookAt(
                shipGroup.position.x * 0.4 + sh.tx,
                MIRA_ALTURA_BASE + shipState.y * CAMERA_FOLLOW_Y + sh.ty,
                shipGroup.position.z + CAMERA_LOOKAHEAD.z
            );
            if (sh.roll !== 0) camera.rotateZ(sh.roll);
        }
        atualizarCamera();

        // ── 6.6 TIRO DO JOGADOR ────────────────────────────────────────
        const bulletGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMatPadrao = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const bulletMatRapid = new THREE.MeshBasicMaterial({ color: 0xffff00 });  // igual ao 2D: RAPID = amarelo
        const bulletMatTriple = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // igual ao 2D: TRIPLE = magenta
        const bullets = [];
        const BULLET_SPEED = 1.4;
        const SHOOT_COOLDOWN_NORMAL = 0.15; // ritmo padrão
        const SHOOT_COOLDOWN_RAPID = 0.06;  // RAPID: mesma proporção do 2D (cooldown 6 vs 15 frames)
        let shootCooldownTimer = 0;
        let firing = false;

        function corTiroAtual() {
            if (jogadorPowerup === 'RAPID') return bulletMatRapid;
            if (jogadorPowerup === 'TRIPLE') return bulletMatTriple;
            return bulletMatPadrao;
        }

        // vx: desvio lateral por frame (só usado pelo TRIPLE, pra abrir
        // leque enquanto voa — igual ao 2D real onde os tiros de fora
        // têm vx=-2.5/+2.5 e o do meio vx=0)
        function shootBullet(vx) {
            const b = new THREE.Mesh(bulletGeo, corTiroAtual());
            b.position.set(shipGroup.position.x, shipGroup.position.y, shipGroup.position.z - 1);
            b.userData.vx = vx || 0;
            scene.add(b);
            bullets.push(b);
        }
        function dispararTiroJogador() {
            if (VANGUARD_SOM_TIRO) { try { vanguardTocarSom(VANGUARD_SOM_TIRO); } catch (e) { tocarSom(shootSound, 0.92 + Math.random() * 0.16); } }
            else if (typeof NRTiroOnda !== 'undefined') { const o = NRTiroOnda.proximo(); tocarSom(shootSound, o.taxa, o.pan, o.vol); } // tom em ONDA que acompanha a nave: altura, lado e movimento (tiro-onda.js)
            else tocarSom(shootSound, 0.92 + Math.random() * 0.16); // tom levemente diferente a cada tiro (menos cansativo)
            if (jogadorPowerup === 'TRIPLE') {
                shootBullet(-0.55); shootBullet(0); shootBullet(0.55);
            } else {
                shootBullet(0);
            }
            JUICE.tiro(shipGroup.position, corTiroAtual().color); // clarão + faíscas na boca do canhão
        }

        // ── BALA DO JOGADOR TELEGUIADA ───────────────────────────────
        // Os players pediram: a bala curva rumo ao inimigo/boss à frente.
        // Ajustes (pode mexer à vontade):
        //   PLAYER_BULLET_HOMING  = quão rápido a bala vira (por segundo).
        //                           0 desliga (volta a ser reta).
        //   PLAYER_BULLET_CONE    = ângulo máximo (rad) entre pra onde a bala
        //                           vai e o alvo pra ela "travar" (0.75 ≈ 43°).
        //                           Menor = só trava no que está mais na frente.
        //   PLAYER_BULLET_ALCANCE = distância máxima pra travar num alvo.
        const PLAYER_BULLET_HOMING = 7;
        const PLAYER_BULLET_CONE = 0.75;
        const PLAYER_BULLET_ALCANCE = 80;
        const _PB_COS_CONE = Math.cos(PLAYER_BULLET_CONE);
        const _vAlvo = new THREE.Vector3();
        const _vFrente = new THREE.Vector3(0, 0, -1);

        // escolhe o inimigo (ou boss) mais perto que esteja à frente da bala
        function adquirirAlvoBala(b) {
            const dir = b.userData.dir;
            let melhor = null, melhorD = Infinity;
            for (let k = 0; k < enemies.length; k++) {
                const en = enemies[k];
                if (en.hp <= 0) continue;
                _vAlvo.subVectors(en.mesh.position, b.position);
                const d = _vAlvo.length();
                if (d < 0.5 || d > PLAYER_BULLET_ALCANCE) continue;
                if (_vAlvo.z >= -0.5) continue;                  // só o que está à frente (−Z)
                if (_vAlvo.dot(dir) / d < _PB_COS_CONE) continue; // fora do cone
                if (d < melhorD) { melhorD = d; melhor = en; }
            }
            return melhor;
        }

        // move UMA bala do jogador (reta se não há alvo; curva se há)
        function moverBalaJogador(b, dt) {
            const u = b.userData;
            if (!u.dir) { // primeira vez: direção inicial = a de antes (frente + desvio lateral do TRIPLE)
                u.dir = new THREE.Vector3(u.vx || 0, 0, -BULLET_SPEED);
                u.vel = u.dir.length();
                u.dir.normalize();
            }
            if (PLAYER_BULLET_HOMING > 0) {
                let alvo = u.alvo;
                // larga o alvo se morreu, sumiu ou a bala já passou dele
                if (alvo && (alvo.hp <= 0 || alvo.mesh.position.z >= b.position.z || enemies.indexOf(alvo) === -1)) alvo = u.alvo = null;
                if (!alvo) alvo = u.alvo = adquirirAlvoBala(b);
                if (alvo) {
                    _vAlvo.subVectors(alvo.mesh.position, b.position).normalize();
                    u.dir.lerp(_vAlvo, Math.min(1, PLAYER_BULLET_HOMING * dt)).normalize();
                    b.quaternion.setFromUnitVectors(_vFrente, u.dir);
                }
            }
            b.position.addScaledVector(u.dir, u.vel * 60 * dt);
        }

        const shootBtnEl = document.getElementById('shootBtn');
        shootBtnEl.addEventListener('touchstart', e => { e.preventDefault(); firing = true; shootBtnEl.classList.add('firing'); }, { passive: false });
        // só para de atirar quando não sobrou NENHUM dedo no botão (e também se o toque for cancelado pelo sistema)
        const soltouTiro = e => { e.preventDefault(); if (e.targetTouches.length === 0) { firing = false; shootBtnEl.classList.remove('firing'); } };
        shootBtnEl.addEventListener('touchend', soltouTiro, { passive: false });
        shootBtnEl.addEventListener('touchcancel', soltouTiro, { passive: false });
        shootBtnEl.addEventListener('mousedown', () => { firing = true; shootBtnEl.classList.add('firing'); });
        shootBtnEl.addEventListener('mouseup', () => { firing = false; shootBtnEl.classList.remove('firing'); });

        // ── 6.7 TIRO DOS INIMIGOS ────────────────────────────────────────
        const enemyBulletGeo = new THREE.CylinderGeometry(0.13, 0.13, 2.6, 8);
        enemyBulletGeo.rotateX(Math.PI / 2);
        const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff33ff });
        const enemyBullets = [];
        // Velocidade da bala inimiga agora escala por MAPA (não por nível
        // dentro do mapa) — mapa1 é a mais lenta, cresce até o mapa6.
        // Valor geral também reduzido (era 0.7 fixo, ficava rápido demais).
        const ENEMY_BULLET_SPEED = 0.32 + (mapaAtual - 1) * 0.09; // mapa1=0.32 ... mapa6=0.77

        // ── 6.75 CRISTAIS E POWER-UPS — igual ao spawnCrystal/spawnPowerup
        // /collectCrystal/collectPowerup do 2D real. Cor escolhida POR TIPO
        // (o 2D usa cor aleatória sem relação com o tipo) — aqui ajuda o
        // jogador a reconhecer o que está pegando num jogo 3D onde não dá
        // pra ler texto no meio da ação.
        const CRISTAL_CORES = [0x00ffff, 0x11C76E, 0xffff00]; // 0=energia(ciano) 1=vida(verde #11C76E) 2=pontos(amarelo)

        // ── CRISTAL DE CURA (+8 HP) EM MODELO 3D ─────────────────────────────
        // Modelo: "Crystal" por SomjadeChunthavorn (Sketchfab) — licença CC-BY-4.0:
        //   https://sketchfab.com/3d-models/crystal-36ba796c756a4bd4b7d6532b35ebcfa2
        // (a licença pede que o autor seja creditado em algum lugar do jogo)
        // O arquivo precisa estar na mesma pasta do game3d.html. Se ele não carregar,
        // o jogo usa o octaedro simples de antes — nada quebra.
        const CRISTAL_CURA_GLB = 'Crystal-vermelho.glb';
        const CRISTAL_CURA_SO_UM = true;      // o .glb traz 3 cristais iguais lado a lado: true = usa só 1 (o do meio); false = usa os 3 juntos
        const CRISTAL_CURA_ALTURA = 0.62;     // altura do cristal no jogo (unidades 3D) — o octaedro antigo tinha ~0.36
        const CRISTAL_CURA_RECOLORIR = true;  // true = pinta o modelo com a cor CRISTAL_CORES[1] (verde); false = mantém o vermelho original do arquivo
        let cristalCuraBase = null;           // { geo, mat } prontos — todos os cristais de cura compartilham (carrega 1 vez)
        const cristaisAtivos = [];
        // ÍMÃ dos cristais (game feel): dentro desse raio o cristal é puxado
        // até a nave — coletar fica mais gostoso e fluido. 0 = desliga o ímã.
        const CRISTAL_IMA_RAIO = 3.2;
        function spawnCristais(pos, isBoss) {
            const qtd = isBoss ? 6 : (Math.random() < 0.5 ? 3 : 4); // igual ao "drops" real
            for (let i = 0; i < qtd; i++) {
                const tipo = Math.floor(Math.random() * 3);
                // Cristal de cura (tipo 1): modelo 3D, se já carregou; os outros (e o fallback) seguem o octaedro
                const mesh = (tipo === 1 && cristalCuraBase)
                    ? new THREE.Mesh(cristalCuraBase.geo, cristalCuraBase.mat)
                    : new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: CRISTAL_CORES[tipo] }));
                mesh.rotation.y = Math.random() * Math.PI * 2; // cada cristal começa virado pra um lado
                mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.6));
                scene.add(mesh);
                // Velocidade inicial (unidades/segundo) — deriva lateral leve
                // + vem em direção à nave (vz positivo), igual à ideia do
                // vx/vy do 2D real, só que aqui vz é quem "traz" o cristal
                cristaisAtivos.push({
                    mesh, tipo, vida: 14, rotSpeed: 2 + Math.random() * 2,
                    cor: new THREE.Color(CRISTAL_CORES[tipo]), // cor do tipo (o juice usa pro rastro de faíscas)
                    vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 3 + Math.random() * 2),
                });
            }
        }

        // O power-up VERDE (chave 'SHIELD') agora CURA: ao coletar, o jogador ganha POWERUP_VERDE_CURA de HP e
        // aparece um "+45 HP" verde (igual ao +8 HP do cristal). A chave continua 'SHIELD' só por compatibilidade.
        const POWERUP_VERDE_CURA = 45;            // HP que ele cura (0 desliga a cura e volta ao escudo de antes)
        const POWERUP_VERDE_TAMBEM_ESCUDO = false; // true = além de curar, ainda liga o escudo de 6s que ele tinha
        const POWERUP_TIPOS = [
            { chave: 'RAPID', cor: 0xff8800 },
            { chave: 'TRIPLE', cor: 0xff00ff },
            { chave: 'SHIELD', cor: 0x00ff88 },
        ];
        const powerupsAtivos = [];
        function spawnPowerupChance(pos, isBoss) {
            // Mesma fórmula do 2D real (15% + 2% por onda), só limitada a
            // 60% pra não virar praticamente garantido nas ondas altas —
            // o 2D não tinha esse teto, mas sem ele qualquer sessão longa
            // vira chuva de power-up constante
            const chance = isBoss ? 1 : Math.min(0.6, 0.15 + wave * 0.02);
            if (Math.random() >= chance) return;
            const tipo = POWERUP_TIPOS[Math.floor(Math.random() * POWERUP_TIPOS.length)];
            const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: tipo.cor }));
            mesh.position.copy(pos);
            scene.add(mesh);
            powerupsAtivos.push({
                mesh, tipo: tipo.chave, vida: 14, rotSpeed: 1.5,
                vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.35, 3 + Math.random() * 1.5),
            });
        }

        // Estado do power-up ativo na nave (RAPID/TRIPLE/SHIELD), igual ao
        // p.powerup/p.powerupTimer do 2D real (360 frames = 6s a 60fps)
        let jogadorPowerup = null;
        let jogadorPowerupTimer = 0;
        const POWERUP_DURACAO = 6;

        // Chamada quando a nave encosta num power-up
        function coletarPowerup(pu) {
            const _puCor = POWERUP_TIPOS.find(t => t.chave === pu.tipo);
            JUICE.powerup(shipGroup.position, _puCor ? _puCor.cor : 0xffffff); // explosão de coleta do power-up
            if (pu.tipo === 'SHIELD' && POWERUP_VERDE_CURA > 0) {
                // power-up verde: cura (limitada ao HP máximo) + texto verde subindo, igual ao +8 HP do cristal
                playerHp = Math.min(playerMaxHp, playerHp + POWERUP_VERDE_CURA);
                atualizarHpBar();
                mostrarTextoFlutuante(pu.mesh.position, '+' + POWERUP_VERDE_CURA + ' HP', '#4dff9e');
                if (!POWERUP_VERDE_TAMBEM_ESCUDO) return;   // só cura; sem escudo
            }
            jogadorPowerup = pu.tipo;
            jogadorPowerupTimer = POWERUP_DURACAO;
            mostrarAvisoBoss(pu.tipo + ' ATIVADO'); // reaproveita o toast do boss pro mesmo tipo de aviso
        }

        // Anel de escudo (só visível durante SHIELD) — mesma ideia do
        // círculo verde pulsante desenhado ao redor da nave no 2D
        const escudoMesh = new THREE.Mesh(
            new THREE.TorusGeometry(1.1, 0.05, 8, 32),
            new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 })
        );
        escudoMesh.rotation.x = Math.PI / 2;
        escudoMesh.visible = false;
        shipGroup.add(escudoMesh);

        // ── 6.8 HUD REAL COMPLETO (HP, energia, moedas, combo, onda, bomba) ──
        // Valores de HP/bombas iguais ao G inicial do boss.js real
        // (createPlayer: hp 700, initState: bombs 999).
        //
        // NAVE EQUIPADA — mesma tabela real do boss.js (getBonusNaveLocal).
        // As 4 joias antigas saíram do jogo inteiro — a loja não vende
        // mais nenhuma, e aqui embaixo não existe mais bônus de joia
        // somado a nada. A nova joia ainda não tem habilidade decidida.
        const NAVES_REAIS = {
            // Mesma curva do catálogo da loja (loja.js) — nave compraveis
            // escalam bem mais forte em dmgMult/hpBonus pra acompanhar a
            // dificuldade real dos inimigos balanceados (ver inimigos3d.js,
            // BALANCEAMENTO_MAPAS). "vanguard" fica fora dessa curva —
            // continua modular, tratada à parte logo abaixo.
            padrao:  { dmgMult: 1.0, spdBonus: 0,   hpBonus: 0,   cor: 0x00ffff },
            striker: { dmgMult: 1.4, spdBonus: 0.6, hpBonus: 60,  cor: 0xff6600 },
            crimson: { dmgMult: 1.9, spdBonus: 0,   hpBonus: 150, cor: 0xff2244 },
            warbat:  { dmgMult: 2.6, spdBonus: 0.4, hpBonus: 280, cor: 0x8800ff },
            cyer:    { dmgMult: 3.6, spdBonus: 0.8, hpBonus: 450, cor: 0x00ff88 },
            spectre: { dmgMult: 5.0, spdBonus: 0.5, hpBonus: 650, cor: 0xffffff },
            // Plasma: o dano de cada tiro carregado é este dmgMult × PLASMA_CFG.danoMult (plasma.js). Não tem tiro comum.
            plasma:  { dmgMult: 5.0, spdBonus: 0.4, hpBonus: 600, cor: 0xb26bff },
            // Vanguard: stats base + peças equipadas, calculados pelo
            // vanguard-core.js (VANGUARD_BASE + getBonusVanguard). Os números
            // do fallback só valem se o script não carregar — mantém em
            // sincronia com VANGUARD_BASE lá.
            vanguard: (function () {
                const b = (typeof getBonusVanguard === 'function')
                    ? getBonusVanguard()
                    : { dmgMult: 5.1, spdBonus: 0.5, hpBonus: 680, cadencia: 0, critico: 0 };
                return {
                    dmgMult: b.dmgMult, spdBonus: b.spdBonus, hpBonus: b.hpBonus,
                    cadencia: b.cadencia || 0, critico: b.critico || 0, cor: 0x00f0ff,
                };
            })(),
        };
        // Nave equipada (a Vanguard tem entrada própria em NAVES_REAIS acima)
        const _naveIdSalva = localStorage.getItem('naveAtual') || 'padrao';
        const bonusNave = NAVES_REAIS[_naveIdSalva] || NAVES_REAIS.padrao;
        if (typeof NRPlasma !== 'undefined') NRPlasma.ligar(_naveIdSalva); // nave de plasma: liga a habilidade de tiro carregado (desligada no PvP)

        // As 4 joias antigas (e o bônus que elas davam aqui no 3D) saíram
        // do jogo — a nova joia ainda não tem habilidade decidida, então
        // por enquanto o bônus final é só o da nave, sem nada somado.
        const dmgMultTotal = bonusNave.dmgMult;
        const spdBonusTotal = bonusNave.spdBonus;
        const hpBonusTotal = bonusNave.hpBonus;
        // DANO_JOGADOR virou função — precisa considerar a SOBRECARGA do
        // mercado negro (3.4x por 9s), que pode ligar/desligar durante a
        // partida. Multiplicador pedido: 3.4x (o 2D real usa 2.3x).
        function calcularDanoJogador() {
            return 1 * dmgMultTotal * (sobrecargaAtiva ? 3.4 : 1.0) * nexusMultDano();
        }
        // ── PEÇAS DA VANGUARD: cadência, crítico e som do tiro ────────
        // (as outras naves têm cadencia/critico = 0, então nada muda pra elas)
        const CADENCIA_MULT = 1 + (bonusNave.cadencia || 0);
        const CRITICO_CHANCE = bonusNave.critico || 0;
        const CRITICO_MULT = (typeof VANGUARD_CRITICO_MULT !== 'undefined') ? VANGUARD_CRITICO_MULT : 1.5;
        // cadência acelera só o tiro NORMAL — o RAPID (powerup) continua fixo
        function cooldownTiroAtual() {
            return jogadorPowerup === 'RAPID' ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN_NORMAL / (CADENCIA_MULT * nexusMultCadencia());
        }
        // dano de UM tiro que acertou: sorteia o crítico
        function danoDoTiroComCritico() {
            let d = calcularDanoJogador();
            if (CRITICO_CHANCE > 0 && Math.random() < CRITICO_CHANCE) d *= CRITICO_MULT;
            return d;
        }
        // som do tiro: a Vanguard usa o timbre da skin de cauda equipada
        // (sintetizado, vanguard-core.js); as outras naves seguem no .ogg
        const VANGUARD_SOM_TIRO = (_naveIdSalva === 'vanguard' && typeof vanguardGetSkinEquipada === 'function' && typeof vanguardTocarSom === 'function')
            ? vanguardGetSkinEquipada('cauda').som : null;
        // Fator de resposta do controle "direto" (perseguir o alvo) — o
        // 2D usa p.speed=4+spdBonus pra aceleração; aqui adapto pro nosso
        // sistema de lerp, mantendo a MESMA proporção relativa entre naves
        function fatorMovimentoAtual() {
            return 0.15 * (1 + spdBonusTotal * 0.15) * nexusMultVelocidade();
        }

        // ── JOIA NEXUS ────────────────────────────────────────────────
        // Compra registrada na loja (localStorage: joiaNexusComprada).
        // A barra enche com o DANO CAUSADO PELA NAVE (não conta o Nitro,
        // que é o companheiro, não "a nave do jogador" — assim o design
        // pediu). Ao chegar em 100%: +50% dano, +35% cadência, +25%
        // velocidade por 6s: depois reseta e começa a encher de novo,
        // repete a partida inteira. Sem a joia comprada, tudo aqui vira
        // no-op — os números ficam concentrados nas 5 constantes abaixo.
        const NEXUS_COMPRADA = localStorage.getItem('joiaNexusComprada') === 'true';
        const NEXUS_DANO_PARA_ENCHER = 235; // dano acumulado pra virar 100% — ajuste fácil de calibrar
        const NEXUS_BUFF_DURACAO = 15.0;
        const NEXUS_BUFF_DANO = 0.50;
        const NEXUS_BUFF_CADENCIA = 0.35;
        const NEXUS_BUFF_VELOCIDADE = 0.25;
        let nexusDanoAcumulado = 0;
        let nexusBuffAtivo = false;
        let nexusBuffTimer = 0;

        const elNexusBarWrap = document.getElementById('nexusBarWrap');
        const elNexusFill = document.getElementById('nexusFill');
        // Nova barra (new-barra.html): texto de % dentro da barra e
        // contagem regressiva do bônus (ex: "12.4s") acima dela
        const elNexusPct = document.getElementById('nexusPct');
        const elNexusTempo = document.getElementById('nexusTempo');
        let nexusUltimoDecimo = -1; // evita reescrever o texto do timer todo frame
        if (NEXUS_COMPRADA && elNexusBarWrap) elNexusBarWrap.style.display = 'flex';

        function nexusMultDano() { return (NEXUS_COMPRADA && nexusBuffAtivo) ? (1 + NEXUS_BUFF_DANO) : 1; }
        function nexusMultCadencia() { return (NEXUS_COMPRADA && nexusBuffAtivo) ? (1 + NEXUS_BUFF_CADENCIA) : 1; }
        function nexusMultVelocidade() { return (NEXUS_COMPRADA && nexusBuffAtivo) ? (1 + NEXUS_BUFF_VELOCIDADE) : 1; }

        function nexusRegistrarDano(dano) {
            if (!NEXUS_COMPRADA || nexusBuffAtivo) return; // já no bônus — só acumula de novo depois que ele acabar
            nexusDanoAcumulado += dano;
            const pct = Math.min(1, nexusDanoAcumulado / NEXUS_DANO_PARA_ENCHER);
            if (elNexusFill) elNexusFill.style.width = (pct * 100) + '%';
            if (elNexusPct) elNexusPct.textContent = Math.floor(pct * 100) + '%'; // floor: só mostra 100% de verdade quando encheu
            if (pct >= 1) {
                nexusBuffAtivo = true;
                nexusBuffTimer = NEXUS_BUFF_DURACAO;
                nexusDanoAcumulado = 0;
                if (elNexusBarWrap) elNexusBarWrap.classList.add('nexus-cheia');
                mostrarAvisoBoss('💜 NEXUS ATIVADA');
                JUICE.nexusAtivada(shipGroup.position);
            }
        }

        function nexusAtualizar(dt) {
            if (!NEXUS_COMPRADA || !nexusBuffAtivo) return;
            nexusBuffTimer -= dt;
            if (nexusBuffTimer <= 0) {
                nexusBuffAtivo = false;
                if (elNexusBarWrap) elNexusBarWrap.classList.remove('nexus-cheia');
                if (elNexusFill) elNexusFill.style.width = '0%';
                if (elNexusPct) elNexusPct.textContent = '0%';
                if (elNexusTempo) elNexusTempo.textContent = '';
                nexusUltimoDecimo = -1;
            } else if (elNexusTempo) {
                // Contagem regressiva: só mexe no DOM quando o décimo de segundo muda
                const decimo = Math.ceil(nexusBuffTimer * 10);
                if (decimo !== nexusUltimoDecimo) {
                    nexusUltimoDecimo = decimo;
                    elNexusTempo.textContent = (decimo / 10).toFixed(1) + 's';
                }
            }
        }

        // Chamas roxas ao redor da nave, só visíveis durante o bônus —
        // criadas 1x e reaproveitadas (troca só visible/posição a cada
        // frame) pra não gerar lixo de memória nos vários ciclos da
        // partida. Nada disso roda se a joia não foi comprada.
        const NEXUS_CHAMA_QTD = 10;
        const nexusChamas = [];
        if (NEXUS_COMPRADA) {
            const nexusChamaGeo = new THREE.OctahedronGeometry(0.12, 0);
            const nexusChamaMat = new THREE.MeshBasicMaterial({ color: 0xb347ff, transparent: true, opacity: 0.85 });
            for (let nc = 0; nc < NEXUS_CHAMA_QTD; nc++) {
                const chama = new THREE.Mesh(nexusChamaGeo, nexusChamaMat);
                chama.visible = false;
                chama.userData.fase = Math.random() * Math.PI * 2;
                chama.userData.raio = 0.5 + Math.random() * 0.35;
                chama.userData.velAngular = 1.2 + Math.random() * 1.6;
                scene.add(chama);
                nexusChamas.push(chama);
            }
        }

        function nexusAtualizarVisual(tempo) {
            for (let nc = 0; nc < nexusChamas.length; nc++) {
                const c = nexusChamas[nc];
                c.visible = nexusBuffAtivo;
                if (!nexusBuffAtivo) continue;
                const ang = tempo * c.userData.velAngular + c.userData.fase;
                c.position.set(
                    shipGroup.position.x + Math.cos(ang) * c.userData.raio,
                    shipGroup.position.y + Math.sin(ang * 1.7) * 0.25,
                    shipGroup.position.z + Math.sin(ang) * c.userData.raio
                );
                c.scale.setScalar(0.7 + Math.sin(tempo * 8 + c.userData.fase) * 0.3);
            }
        }

        // ── BARRA NEXUS SEGUINDO A NAVE ───────────────────────────────
        // A barra é um <div> normal (HTML/CSS, dentro do #container), não
        // geometria 3D. Todo frame pegamos a posição 3D da nave (um pouco
        // acima dela), projetamos pra coordenada de tela — mesma técnica do
        // mostrarTextoFlutuante — e movemos o <div> com transform (barato,
        // não força re-layout). Nada roda se a joia não foi comprada.
        const NEXUS_BARRA_OFFSET_Y = 0.85; // quão acima da nave a barra fica (unidades 3D) — aumente pra subir, diminua pra descer
        const NEXUS_BARRA_MARGEM = 6;      // folga mínima (px) da borda da tela pra barra nunca cortar
        const _nexusBarraVec = new THREE.Vector3(); // reaproveitado todo frame (sem criar lixo de memória)
        let _nexusBarraUltX = -99999, _nexusBarraUltY = -99999;
        let _nexusBarraMeiaLarg = 0, _nexusBarraAltura = 0; // medidos 1x (e de novo se a tela redimensionar)

        window.addEventListener('resize', () => { _nexusBarraMeiaLarg = 0; }); // força re-medir

        function nexusPosicionarBarra() {
            if (!NEXUS_COMPRADA || !elNexusBarWrap) return;

            // Mede o tamanho da barra só quando preciso (ler offsetWidth
            // todo frame poderia forçar re-layout do navegador)
            if (_nexusBarraMeiaLarg === 0) {
                _nexusBarraMeiaLarg = elNexusBarWrap.offsetWidth / 2;
                _nexusBarraAltura = elNexusBarWrap.offsetHeight;
            }

            // A câmera já foi movida neste frame (atualizarCamera), mas a
            // matriz dela só atualiza no render — força aqui pra não dar
            // 1 frame de atraso (senão a barra "treme" atrás da nave)
            camera.updateMatrixWorld();

            _nexusBarraVec.set(
                shipGroup.position.x,
                shipGroup.position.y + NEXUS_BARRA_OFFSET_Y,
                shipGroup.position.z
            ).project(camera);

            const w = getGameWidth(), h = getGameHeight();
            let x = (_nexusBarraVec.x * 0.5 + 0.5) * w;
            let y = (-_nexusBarraVec.y * 0.5 + 0.5) * h;

            // Mantém a barra inteira dentro da tela (nave colada na lateral/topo)
            x = Math.max(_nexusBarraMeiaLarg + NEXUS_BARRA_MARGEM, Math.min(w - _nexusBarraMeiaLarg - NEXUS_BARRA_MARGEM, x));
            y = Math.max(_nexusBarraAltura + NEXUS_BARRA_MARGEM, Math.min(h - NEXUS_BARRA_MARGEM, y));

            // Só escreve no DOM se moveu de verdade (arredonda em 0.1px)
            const rx = Math.round(x * 10) / 10, ry = Math.round(y * 10) / 10;
            if (rx === _nexusBarraUltX && ry === _nexusBarraUltY) return;
            _nexusBarraUltX = rx; _nexusBarraUltY = ry;
            // translate(-50%,-100%): centraliza a barra em X e apoia a base dela no ponto calculado
            elNexusBarWrap.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-100%)';
        }

        // Recolore o corpo/motor da nave (que nasceram ciano por padrão)
        // pra cor da nave equipada — não é um modelo 3D novo por nave
        // ainda (isso é o próximo passo), só já reflete visualmente qual
        // nave está equipada
        shipGroup.traverse(child => {
            if (child.isMesh && child.material && child.material.color && child.material.color.getHex() === 0x00ffff) {
                child.material.color.setHex(bonusNave.cor);
            }
        });

        let playerHp = 700 + hpBonusTotal;
        let playerMaxHp = 700 + hpBonusTotal;
        let score = 0;
        let moedas = 0;
        let playerInvincibleTimer = 0; // pequeno tempo sem levar dano após ser atingido

        let energy = 0, maxEnergy = 100;
        // ATENÇÃO/SUPOSIÇÃO: no 2D a energia vem de cristais coletados
        // (crystal tipo 0 dá +3.8), sistema que ainda não existe aqui.
        // Por enquanto ela enche um pouco a cada abate só pra a barra
        // não ficar sempre vazia — troca fácil quando os cristais forem
        // portados de verdade.
        const ENERGY_POR_ABATE = 6;

        let wave = 1;
        const ENEMIES_POR_ONDA = 8; // igual ao G.enemiesPerWave padrão do 2D
        let killsNaOnda = 0;

        let combo = 1, comboTimer = 0;
        const COMBO_JANELA = 1.6; // segundos pra manter o combo entre abates

        let bombs = 999; // mesmo valor inicial do G do 2D

        // ── XP e NÍVEL — mesma fórmula do level.js real:
        // xpParaProximoNivel(n) = 5n² + 15n + 30, nível máximo 50.
        // Valores de XP por ação também iguais ao xp.js real (inimigo
        // comum 5, elite 20, boss 100 — "elite" aqui é o tipo tank).
        const XP_A = 5, XP_B = 15, XP_C = 30, NIVEL_MAXIMO = 50;
        function xpParaProximoNivel(n) {
            const nivelValido = Math.min(Math.max(n, 1), NIVEL_MAXIMO);
            return Math.round(XP_A * nivelValido * nivelValido + XP_B * nivelValido + XP_C);
        }
        let xpAtual = 0, nivelAtual = 1;

        const elNivel = document.getElementById('nivelDisplay');
        const elXpFill = document.getElementById('xpFill');
        const elLevelUpToast = document.getElementById('levelUpToast');

        function atualizarNivelHud() {
            elNivel.textContent = 'NÍVEL ' + nivelAtual;
            elXpFill.style.width = Math.min(100, xpAtual / xpParaProximoNivel(nivelAtual) * 100) + '%';
        }

        function ganharXP(quantidade) {
            xpAtual += quantidade;
            let subiu = false;
            // Loop, não "if" — mesmo motivo do xp.js real: um ganho grande
            // (bônus de boss) pode subir mais de 1 nível de uma vez
            while (nivelAtual < NIVEL_MAXIMO && xpAtual >= xpParaProximoNivel(nivelAtual)) {
                xpAtual -= xpParaProximoNivel(nivelAtual);
                nivelAtual++;
                subiu = true;
            }
            atualizarNivelHud();
            precisaSincronizar = true;
            if (subiu) {
                elLevelUpToast.textContent = '⬆ NÍVEL ' + nivelAtual + '!';
                elLevelUpToast.style.opacity = '1';
                setTimeout(() => { elLevelUpToast.style.opacity = '0'; }, 1800);
                JUICE.subiuNivel(shipGroup.position); // anéis dourados + flash
            }
        }

        const elHpFill = document.getElementById('hpFill');
        const elScore = document.getElementById('scoreDisplay');
        const elWave = document.getElementById('waveDisplay');
        const elMoedas = document.getElementById('moedas');
        const elEnergyFill = document.getElementById('energyFill');
        const elComboText = document.getElementById('comboText');
        const elComboMult = document.getElementById('comboMult');
        const elBombCount = document.getElementById('bombCount');
        const elBombBtn = document.getElementById('bombBtn');

        function atualizarHpBar() {
            elHpFill.style.width = Math.max(0, playerHp / playerMaxHp * 100) + '%';
            JUICE.perigo(playerHp > 0 && playerHp / playerMaxHp <= 0.3); // vinheta vermelha pulsando com HP baixo
        }
        // HUD 3.0: cada dígito do placar vira uma "casinha" (<i>) no card — o visual é todo no CSS (.score-display i)
        function atualizarScore() { elScore.innerHTML = String(score).padStart(6, '0').split('').map(d => '<i>' + d + '</i>').join(''); }
        function atualizarWave() { elWave.textContent = 'ONDA ' + wave; }
        function atualizarMoedas() { elMoedas.textContent = moedas; } // HUD 3.0: o ícone do diamante agora é um SVG ao lado do número
        function atualizarEnergyBar() { elEnergyFill.style.width = Math.max(0, Math.min(100, energy / maxEnergy * 100)) + '%'; }
        function atualizarBombCount() {
            elBombCount.textContent = bombs;
            elBombBtn.classList.toggle('empty', bombs <= 0);
        }
        function mostrarCombo() {
            if (combo > 1) {
                elComboText.textContent = 'COMBO!';
                elComboMult.textContent = 'x' + combo;
                elComboText.style.opacity = '1';
                JUICE.pop(elComboMult, 1 + Math.min(0.9, combo * 0.07)); // o número "pula" a cada abate (cresce com o combo)
                JUICE.comboMarco(combo, shipGroup.position); // x5, x10, x20...: banner + efeito especial
            }
        }
        function esconderCombo() {
            elComboText.style.opacity = '0';
            elComboMult.textContent = '';
            combo = 1;
        }

        let escudoHp = 0; // escudo quântico do mercado negro — absorve dano antes do HP

        // ── SKIN DO ESCUDO (Sketchfab: Mass_effect_shields.glb) — o
        // arquivo tem 3 escudos dentro (nós separados na cena); usamos só
        // o "cat6 heavy omnishield_ARM" (o 1º, com a peça "omnitool"
        // brilhante). É um escudo de mão/braço achatado no modelo
        // original, não uma esfera — por isso vira uma BARREIRA flutuando
        // na frente da nave (de onde vêm os tiros), em vez de encapsular
        // ela toda, respeitando a forma real do modelo.
        let escudoMesh3D = null;
        const gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load('Mass_effect_shields.glb', (gltf) => {
            console.log('NRDados 3D: escudo carregado — nós na cena:', gltf.scene.children.map(c => c.name));
            // Busca por NOME falhava (GLTFLoader pode remontar a árvore
            // de um jeito diferente do JSON bruto) — indo por POSIÇÃO em
            // vez disso: o Cat6 Heavy Omnishield é sempre o 1º item da
            // cena (scene.nodes = [3,6,10] no glb, ele é o índice 3)
            const noOmnishield = gltf.scene.children[0];
            if (!noOmnishield) { console.warn('NRDados 3D: escudo veio sem nenhum nó na cena — usando placeholder'); return; }

            escudoMesh3D = noOmnishield;
            escudoMesh3D.scale.setScalar(5.5); // o modelo nasce pequeno (~1 unidade) — escala pro tamanho de uma barreira de nave
            escudoMesh3D.position.set(-0.5, 0, -2.6); // flutua na frente da nave, de onde vêm os tiros
            escudoMesh3D.rotation.set(0, 0, 0);
            escudoMesh3D.visible = false;
            escudoMesh3D.traverse(c => {
                if (c.isMesh) {
                    c.material = c.material.clone(); // não mexe no material compartilhado do glb original
                    c.material.transparent = true;
                    c.material.opacity = 0.75;
                    c.material.emissive = new THREE.Color(0x00ffcc);
                    c.material.emissiveIntensity = 0.6;
                }
            });
            shipGroup.add(escudoMesh3D);
        }, undefined, (erro) => {
            console.warn('NRDados 3D: falha ao carregar a skin do escudo — mantendo só a barra do HUD', erro);
        });
        // ── CRISTAL DE CURA 3D: carrega o .glb, separa 1 cristal, centraliza, escala e pinta ──
        // (constantes CRISTAL_CURA_* lá em cima, junto do CRISTAL_CORES)

        // Acha os cristais separados dentro da geometria (grupos de triângulos que não se tocam).
        // pos = Float32Array xyz; idx = índices dos triângulos. Devolve [{ tris, minX, maxX }]
        function ilhasDoCristal(pos, idx) {
            const n = pos.length / 3, pai = new Int32Array(n);
            for (let i = 0; i < n; i++) pai[i] = i;
            const raiz = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
            const unir = (a, b) => { pai[raiz(a)] = raiz(b); };
            // vértices na MESMA posição (costuras da textura) contam como o mesmo ponto
            const porPos = new Map();
            for (let i = 0; i < n; i++) {
                const k = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
                if (porPos.has(k)) unir(i, porPos.get(k)); else porPos.set(k, i);
            }
            for (let t = 0; t < idx.length; t += 3) { unir(idx[t], idx[t + 1]); unir(idx[t + 1], idx[t + 2]); }
            const ilhas = new Map();
            for (let t = 0; t < idx.length; t += 3) {
                const r = raiz(idx[t]);
                if (!ilhas.has(r)) ilhas.set(r, { tris: [], minX: Infinity, maxX: -Infinity });
                const il = ilhas.get(r);
                il.tris.push(t);
                for (let k = 0; k < 3; k++) { const x = pos[idx[t + k] * 3]; if (x < il.minX) il.minX = x; if (x > il.maxX) il.maxX = x; }
            }
            return Array.from(ilhas.values());
        }

        // "Colorize": troca o matiz de toda a textura pro matiz da cor-alvo, mantendo luz e sombra
        // do desenho original. Roda 1 vez no carregamento, numa cópia reduzida (256x256 — o cristal
        // é pequeno na tela, não precisa mais que isso).
        function colorizarImagem(img, corAlvo) {
            const T = 256, cv = document.createElement('canvas');
            cv.width = cv.height = T;
            const g = cv.getContext('2d');
            g.drawImage(img, 0, 0, T, T);
            const dados = g.getImageData(0, 0, T, T), d = dados.data;
            const alvo = { h: 0, s: 0, l: 0 }; corAlvo.getHSL(alvo);
            const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
                const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
                const l0 = (mx + mn) / 2;
                const s0 = mx === mn ? 0 : (l0 > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
                const l = Math.min(1, l0 + 0.02);
                const s = Math.min(1, alvo.s * (0.55 + 0.45 * Math.min(1, s0 * 1.2)));
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
                d[i] = hue2rgb(p, q, alvo.h + 1 / 3) * 255;
                d[i + 1] = hue2rgb(p, q, alvo.h) * 255;
                d[i + 2] = hue2rgb(p, q, alvo.h - 1 / 3) * 255;
            }
            g.putImageData(dados, 0, 0);
            return cv;
        }

        function prepararCristalCura(gltf) {
            gltf.scene.updateMatrixWorld(true);
            let malha = null;
            gltf.scene.traverse(o => { if (!malha && o.isMesh) malha = o; });
            if (!malha) throw new Error('o .glb não tem nenhuma malha');

            // 1) geometria "assada" na posição final (aplica a rotação do nó do arquivo: ele vem deitado)
            const geo = malha.geometry.clone();
            geo.applyMatrix4(malha.matrixWorld);
            const pos = geo.attributes.position.array;
            const idx = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.length / 3 }, (_, i) => i);

            // 2) fica só com o cristal do meio (se pedido e se houver mais de um)
            let usados = idx;
            if (CRISTAL_CURA_SO_UM) {
                const ilhas = ilhasDoCristal(pos, idx);
                if (ilhas.length > 1) {
                    const meioX = (Math.min(...ilhas.map(i => i.minX)) + Math.max(...ilhas.map(i => i.maxX))) / 2;
                    ilhas.sort((a, b) => Math.abs((a.minX + a.maxX) / 2 - meioX) - Math.abs((b.minX + b.maxX) / 2 - meioX));
                    usados = [];
                    for (const t of ilhas[0].tris) usados.push(idx[t], idx[t + 1], idx[t + 2]);
                }
            }
            geo.setIndex(usados);

            // 3) centraliza (só nos vértices usados) e escala pra altura desejada — já fica pronto na geometria,
            //    então mesh.scale continua 1 (o juice anima a escala em cima disso)
            let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
            for (const v of usados) {
                const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
                if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z;
            }
            geo.translate(-(mnx + mxx) / 2, -(mny + mxy) / 2, -(mnz + mxz) / 2);
            const k = CRISTAL_CURA_ALTURA / Math.max(0.0001, mxy - mny);
            geo.scale(k, k, k);

            // 4) material: o do arquivo (já é "unlit", sem luz). Recolorido pra cor do tipo, se pedido
            let mat = malha.material;
            if (CRISTAL_CURA_RECOLORIR && mat.map && mat.map.image) {
                const tex = new THREE.CanvasTexture(colorizarImagem(mat.map.image, new THREE.Color(CRISTAL_CORES[1])));
                tex.flipY = mat.map.flipY;          // texturas de .glb vêm com flipY = false
                tex.encoding = mat.map.encoding;
                tex.wrapS = mat.map.wrapS; tex.wrapT = mat.map.wrapT;
                tex.needsUpdate = true;
                mat = new THREE.MeshBasicMaterial({ map: tex });
            }
            return { geo, mat };
        }

        gltfLoader.load(CRISTAL_CURA_GLB, (gltf) => {
            try {
                cristalCuraBase = prepararCristalCura(gltf);
                console.log('NRDados 3D: cristal de cura (modelo 3D) carregado');
            } catch (e) {
                console.warn('NRDados 3D: não consegui preparar o cristal 3D — usando o octaedro de antes', e);
                cristalCuraBase = null;
            }
        }, undefined, (erro) => {
            console.warn('NRDados 3D: falha ao carregar ' + CRISTAL_CURA_GLB + ' — usando o octaedro de antes', erro);
        });

        let sobrecargaAtiva = false, sobrecargaTimer = 0; // sobrecarga do mercado negro — 3.4x de dano por 9s
        let mercadoUsado = false;
        let mercadoSegundos = 17, mercadoInterval = null;

        function atualizarEscudoBar() {
            const wrap = document.getElementById('escudoBarWrap');
            wrap.style.display = escudoHp > 0 ? 'flex' : 'none';
            document.getElementById('escudoFill').style.width = Math.max(0, escudoHp / 67 * 100) + '%';
            if (escudoMesh3D) escudoMesh3D.visible = escudoHp > 0;
        }

        // Gera os itens disponíveis — MESMAS fórmulas reais do boss.js:
        // nano só aparece se estiver faltando mais de 10 de HP, e a
        // quantidade que ele recupera é PROPORCIONAL ao quanto falta (não
        // enche tudo de uma vez) — isso é o "bem matemática" que você pediu.
        function gerarItensMercado() {
            const itens = [];
            const hpFaltando = playerMaxHp - playerHp;
            if (hpFaltando > 10) {
                const pct = hpFaltando / playerMaxHp;
                const hpRecuperar = Math.round(playerMaxHp * Math.min(0.6, pct * 0.9));
                const preco = Math.round(200 - pct * 120);
                itens.push({ id: 'nano', icone: '❤️', nome: 'NANOREPARAÇÃO', desc: '+' + hpRecuperar + ' HP', preco, hpRecuperar });
            }
            itens.push({ id: 'escudo', icone: '🛡️', nome: 'ESCUDO QUÂNTICO', desc: '67 de dano absorvido', preco: 350 });
            // Sobrecarga: pedido explícito de subir de 2.3x (real) pra 3.4x
            itens.push({ id: 'sobrecarga', icone: '⚡', nome: 'SOBRECARGA', desc: '3.4x de dano por 9s', preco: 280 });
            return itens;
        }

        function renderMercado() {
            const itens = gerarItensMercado();
            document.getElementById('mercadoItens').innerHTML = itens.map(it => {
                const podeComprar = moedas >= it.preco;
                return '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,0,255,0.2);border-radius:10px;padding:8px 10px;">' +
                    '<div style="font-size:22px;">' + it.icone + '</div>' +
                    '<div style="flex:1;">' +
                        '<div style="font-family:\'Orbitron\',monospace;font-size:10px;color:#fff;letter-spacing:1px;">' + it.nome + '</div>' +
                        '<div style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:#ffffff88;">' + it.desc + '</div>' +
                    '</div>' +
                    '<button ' + (podeComprar ? '' : 'disabled') + ' onclick="comprarItemMercado(\'' + it.id + '\')" style="font-family:\'Orbitron\',monospace;font-size:9px;font-weight:700;color:' + (podeComprar ? '#000' : '#ffffff44') + ';background:' + (podeComprar ? 'linear-gradient(135deg,#ffd700,#ffaa00)' : 'rgba(255,255,255,0.05)') + ';border:none;border-radius:6px;padding:7px 10px;cursor:' + (podeComprar ? 'pointer' : 'default') + ';white-space:nowrap;">◈' + it.preco + '</button>' +
                '</div>';
            }).join('');
        }

        function abrirMercadoNegro() {
            document.getElementById('mercadoNegroOverlay').style.display = 'flex';
            renderMercado();
            mercadoSegundos = 17;
            document.getElementById('mercadoTimer').textContent = mercadoSegundos + 's';
            clearInterval(mercadoInterval);
            mercadoInterval = setInterval(() => {
                mercadoSegundos--;
                const el = document.getElementById('mercadoTimer');
                el.textContent = mercadoSegundos + 's';
                el.style.color = mercadoSegundos <= 5 ? '#ff4466' : '#00ffff';
                if (mercadoSegundos <= 0) fecharMercadoNegro();
            }, 1000);
        }
        function fecharMercadoNegro() {
            document.getElementById('mercadoNegroOverlay').style.display = 'none';
            clearInterval(mercadoInterval);
            mercadoInterval = null;
        }
        function comprarItemMercado(id) {
            const item = gerarItensMercado().find(i => i.id === id);
            if (!item || moedas < item.preco) return;
            moedas -= item.preco;
            ganhoMoedasNestaSessao -= item.preco; // desconta do total sincronizado também
            precisaSincronizar = true;
            atualizarMoedas();

            if (id === 'nano') {
                playerHp = Math.min(playerMaxHp, playerHp + item.hpRecuperar);
                atualizarHpBar();
                mostrarAvisoBoss('❤️ +' + item.hpRecuperar + ' HP');
                fecharMercadoNegro(); // item de uso único — fecha ao comprar
            } else if (id === 'escudo') {
                escudoHp = 67;
                atualizarEscudoBar();
                mostrarAvisoBoss('🛡️ ESCUDO QUÂNTICO ATIVO');
                fecharMercadoNegro();
            } else if (id === 'sobrecarga') {
                sobrecargaAtiva = true;
                sobrecargaTimer = 9;
                mostrarAvisoBoss('⚡ SOBRECARGA 3.4x ATIVO');
                fecharMercadoNegro();
            }
        }

        // BUG CORRIGIDO: antes, depois de levar UMA bala a nave ficava 1s "invencível" e todas as outras
        // balas que chegavam nesse 1s eram destruídas SEM causar dano — por isso, com 2 ou mais inimigos
        // atirando, só 1 bala contava. Agora toda bala que encosta na nave causa dano. A invencibilidade
        // de 1s continua só como efeito visual (a nave pisca); a proteção do REVIVER (2s) continua valendo
        // contra tudo. Se achar que ficou difícil demais, aumente BALA_INTERVALO_DANO (ex: 0.15 = no máximo
        // uma bala a cada 0,15s causa dano; 0 = todas contam).
        const BALA_INTERVALO_DANO = 0;
        let invencibilidadeEhDeDano = false; // true = o timer de invencibilidade veio de levar dano (as balas ignoram); false = veio do reviver (protege de tudo)
        let ultimoDanoDeBala = -99;          // (elapsedTime da última bala que causou dano)
        function sofrerDano(qtd, ehBala) {
            if (cinematicaFinalAtiva) return; // (nas cinemáticas de vitória/derrota a nave fica protegida)
            if (ehBala) {
                if (playerInvincibleTimer > 0 && !invencibilidadeEhDeDano) return;            // protegida pelo reviver
                if (elapsedTime - ultimoDanoDeBala < BALA_INTERVALO_DANO) return;             // (intervalo mínimo opcional entre balas)
                ultimoDanoDeBala = elapsedTime;
            } else if (playerInvincibleTimer > 0) return;
            if (escudoHp > 0) {
                const absorvido = Math.min(escudoHp, qtd);
                escudoHp -= absorvido;
                qtd -= absorvido;
                atualizarEscudoBar();
            }
            if (qtd <= 0) { JUICE.danoJogador(shipGroup.position, 0, true); playerInvincibleTimer = 1.0; invencibilidadeEhDeDano = true; return; } // escudo absorveu tudo
            playerHp = Math.max(0, playerHp - qtd);
            playerInvincibleTimer = 1.0;
            invencibilidadeEhDeDano = true;
            atualizarHpBar();
            JUICE.danoJogador(shipGroup.position, qtd / playerMaxHp, false); // juice: flash vermelho, tremor, congelada, vibração
            if (playerHp <= 0) {
                // Juice: explosão grande da própria nave ao morrer
                JUICE.explosaoInimigo(shipGroup.position, { tipo: 'tank', hitRadius: 3.2, mesh: shipGroup });
                JUICE.morteJogador(shipGroup.position); // juice extra: ondas vermelhas, estilhaços, flash, tremor, som e vibração
                naveDestruida = true;                    // a nave some (explodiu) até reviver
                // 1ª morte da partida: oferece reviver com moedas antes do
                // Game Over de verdade. Da 2ª morte em diante, vai direto
                // (agora passando pela cinemática de DERROTA).
                if (!reviveUsado) mostrarTelaRevive(); else iniciarCinematicaDerrota();
            }
        }

        // ── REVIVER COM MOEDAS ────────────────────────────────────────
        // Só pode ser usada 1x por partida (reviveUsado). O custo sobe com
        // a onda em que o jogador morreu — mexe em REVIVE_CUSTO_BASE e
        // REVIVE_CUSTO_POR_ONDA pra ajustar. HP volta a REVIVE_HP_PERCENTUAL
        // do máximo, com um respiro de invencibilidade pra não morrer nos
        // mesmos tiros na hora.
        let reviveUsado = false;
        let naveDestruida = false; // true entre a morte e o reviver: a nave fica escondida e não atira
        const REVIVE_CUSTO_BASE = 300;
        const REVIVE_CUSTO_POR_ONDA = 35;
        const REVIVE_CUSTO_MAXIMO = 1500;
        const REVIVE_HP_PERCENTUAL = 0.5;
        const REVIVE_INVENCIBILIDADE = 2.0;

        function custoRevive() {
            return Math.min(REVIVE_CUSTO_MAXIMO, Math.round(REVIVE_CUSTO_BASE + wave * REVIVE_CUSTO_POR_ONDA));
        }

        function mostrarTelaRevive() {
            jogoAtivo = false; // pausa o jogo (mesmo mecanismo do Game Over) sem chamar encerrarPartida ainda
            const custo = custoRevive();
            document.getElementById('reviveMoedasAtual').textContent = String(moedas);
            document.getElementById('reviveCustoTexto').textContent = 'REVIVER CUSTA ◈ ' + custo;
            const btn = document.getElementById('btnReviverMoedas');
            const podeReviver = moedas >= custo;
            btn.disabled = !podeReviver;
            btn.style.opacity = podeReviver ? '1' : '0.4';
            document.getElementById('ui').classList.add('hidden');
            document.getElementById('reviveScreen').classList.remove('hidden');
        }

        function reviverComMoedas() {
            const custo = custoRevive();
            if (moedas < custo) return; // sem moedas — o botão já vem desabilitado, isso é só reforço
            moedas -= custo;
            ganhoMoedasNestaSessao -= custo; // desconta do total sincronizado também (igual ao Mercado Negro)
            precisaSincronizar = true;
            atualizarMoedas();

            reviveUsado = true;
            naveDestruida = false; // a nave volta
            JUICE.filtroDerrota(false); // (e a imagem volta às cores)
            playerHp = Math.round(playerMaxHp * REVIVE_HP_PERCENTUAL);
            atualizarHpBar();
            playerInvincibleTimer = REVIVE_INVENCIBILIDADE;
            invencibilidadeEhDeDano = false; // proteção do reviver: vale contra balas também
            escudoHp = 0; atualizarEscudoBar(); // evita contar 2 camadas de proteção de uma vez

            document.getElementById('reviveScreen').classList.add('hidden');
            document.getElementById('ui').classList.remove('hidden');
            mostrarAvisoBoss('⚡ REVIVIDO — ' + Math.round(REVIVE_HP_PERCENTUAL * 100) + '% HP');
            jogoAtivo = true; // retoma o jogo
        }

        function desistirAposMorte() {
            document.getElementById('reviveScreen').classList.add('hidden');
            iniciarCinematicaDerrota(); // "DERROTA" + câmera lenta, e só então a tela de game over
        }

        // ── CONTAGEM REGRESSIVA 3-2-1-GO (do 3s.html) ──────────────────────
        // Quando o loading termina, aparece 3... 2... 1... GO! (com sons) e SÓ no GO a
        // partida começa de verdade: antes disso não nasce inimigo, ninguém atira e o
        // tempo do jogo não corre. A nave já se mexe (dá pra se posicionar). Pra voltar
        // a partida começar direto, ponha CONTAGEM_INICIAL = false.
        const CONTAGEM_INICIAL = true;
        const CONTAGEM_SEGUNDOS = 3;
        let contagemAtiva = CONTAGEM_INICIAL;   // true enquanto o 3-2-1 está rolando
        let contagemIniciada = false;           // evita iniciar duas vezes
        let pausadoPorModeracao = false;        // kick/ban durante a contagem: o GO NÃO pode reativar o jogo
        let jogoAtivo = !CONTAGEM_INICIAL; // vira false na tela de Game Over/Vitória — pausa o gameplay, mas cena/câmera continuam rendendo atrás da tela (e fica false durante a contagem inicial)

        // Hook chamado pelo telemetria.js quando um admin manda kick/ban
        // nessa sessão — só precisa parar o gameplay, a tela de aviso já
        // é mostrada pelo próprio telemetria.js por cima de tudo.
        window.pausarJogoPorModeracao = function () { jogoAtivo = false; pausadoPorModeracao = true; };

        let partidaEncerrada = false; // guarda própria — jogoAtivo já pode estar
                                       // false por causa da tela de Reviver
        function encerrarPartida() {
            if (partidaEncerrada) return; // já encerrado, evita disparar 2x
            partidaEncerrada = true;
            jogoAtivo = false;
            if (window.NRTelemetria) window.NRTelemetria.encerrar();
            ganhoMortesNestaSessao++;
            document.getElementById('ui').classList.add('hidden');
            document.getElementById('finalScore').textContent = String(score).padStart(6, '0');
            document.getElementById('finalWave').textContent = 'ONDA ' + wave + ' ALCANÇADA';
            document.getElementById('gameOverScreen').classList.remove('hidden');
            salvarPontuacaoRanking();
            renderizarRankingListas();
        }

        // ── Contagem: elementos, sons e animação (copiado do 3s.html) ──
        // Os sons countdown.mp3 e go2.mp3 precisam estar na mesma pasta do game3d.html.
        const somContagem = new Audio('countdown.mp3');
        const somGo = new Audio('go2.mp3');
        const elCdNumero = document.getElementById('cdNumero');
        const elCdGo = document.getElementById('cdGo');
        const elCdFlash = document.getElementById('cdFlash');
        const elCdMensagem = document.getElementById('cdMensagem');
        const elCdToque = document.getElementById('cdToque');

        // "Reinicia" uma animação CSS (remove a classe, força o reflow e põe de novo)
        function reiniciarAnimacao(el, classe) {
            el.classList.remove(classe);
            void el.offsetWidth;
            el.classList.add(classe);
        }

        // Toca um som da contagem (mesmo elemento de áudio, volta pro começo — igual ao 3s.html).
        // Devolve uma Promise<boolean>: true se tocou, false se o navegador bloqueou o som
        // (alguns celulares só liberam áudio depois de um toque na tela).
        function tocarSomContagem(audio) {
            try {
                audio.currentTime = 0;
                const p = audio.play();
                if (p && typeof p.then === 'function') return p.then(() => true).catch(() => false);
                return Promise.resolve(true);
            } catch (e) { return Promise.resolve(false); }
        }

        function mostrarNumeroContagem(n, somJaTocado) {
            elCdNumero.textContent = n;
            reiniciarAnimacao(elCdNumero, 'jump');
            if (!somJaTocado) tocarSomContagem(somContagem);
            JUICE.tremer(0.1);          // pancadinha de tela a cada número
            JUICE.vibrar(15);
        }

        function mostrarGoContagem() {
            elCdNumero.classList.remove('jump');
            reiniciarAnimacao(elCdGo, 'show');
            reiniciarAnimacao(elCdMensagem, 'show');
            reiniciarAnimacao(elCdFlash, 'active');   // flash branco de impacto
            tocarSomContagem(somGo);
            // Juice no GO: soco no FOV, pancada, vibração e o portal pulsa
            JUICE.fovPunch(5);
            JUICE.tremer(0.35);
            JUICE.acelerarEstrelas(4);
            JUICE.vibrar([30, 20, 60]);
            JUICE.ambEvento('nivel');
            // AQUI a partida começa de verdade (libera inimigos, tiro, spawn e o relógio do jogo)
            contagemAtiva = false;
            if (!partidaEncerrada && !pausadoPorModeracao) jogoAtivo = true;
        }

        // Roda a sequência 3 → 2 → 1 → GO (1 segundo entre cada número, como no 3s.html)
        function rodarContagem(somJaTocado) {
            let n = CONTAGEM_SEGUNDOS;
            mostrarNumeroContagem(n, somJaTocado);
            (function proximo() {
                setTimeout(() => {
                    n--;
                    if (n > 0) { mostrarNumeroContagem(n, false); proximo(); }
                    else mostrarGoContagem();
                }, 1000);
            })();
        }

        function iniciarContagem() {
            if (contagemIniciada) return;
            contagemIniciada = true;
            if (!CONTAGEM_INICIAL) return;   // contagem desligada: o jogo já nasceu ativo
            // Tenta tocar o som do "3" já. Se o celular bloquear o áudio (ainda não houve toque
            // nessa página), mostra "TOQUE PARA COMEÇAR" e espera um toque — que também libera o som.
            tocarSomContagem(somContagem).then(tocou => {
                if (tocou) { rodarContagem(true); return; }
                elCdToque.classList.add('show');
                const aoTocar = () => {
                    document.removeEventListener('pointerdown', aoTocar, true);
                    elCdToque.classList.remove('show');
                    rodarContagem(false);   // o toque libera o áudio: agora o som do "3" toca junto
                };
                document.addEventListener('pointerdown', aoTocar, true);
            });
        }
        // Rede de segurança: se por algum motivo o loading nunca chamar a contagem, ela começa sozinha
        // depois de 15s (senão o jogo ficaria parado pra sempre esperando o "GO").
        setTimeout(iniciarContagem, 15000);

        // ── CINEMÁTICAS FINAIS: VITÓRIA e DERROTA (do arquivo de teste "Victory Test") ──
        // As duas seguem a mesma ideia: flash + câmera lenta + um texto grande com som, e SÓ
        // depois (~3,7s) aparece a tela de sempre (vitória ou game over).
        //   VITÓRIA: "PARABÉNS" em cima e "VITÓRIA" verde — quando o boss final morre.
        //   DERROTA: "MAIS SORTE NA PRÓXIMA!" em cima e "DERROTA" vermelha — quando o jogador
        //            perde de vez (morreu sem reviver, ou desistiu na tela de reviver). A
        //            nave explode (juice de morte), some, e a imagem do jogo fica cinza.
        // Durante a cinemática o jogo roda em câmera lenta, mas ninguém leva dano e nenhuma
        // formação nova nasce. Pra desligar: CINEMATICA_VITORIA / CINEMATICA_DERROTA = false.
        const CINEMATICA_VITORIA = true;
        const CINEMATICA_DERROTA = true;
        const VITORIA_SOM = 'dragon-studio-whoosh-cinematic-sound-effect-376889.mp3'; // mesma pasta do game3d.html
        const DERROTA_SOM = VITORIA_SOM;   // por enquanto o mesmo "whoosh" — pra ter um som só da derrota, ponha o nome do arquivo aqui
        const CINEMATICA_CAMERA_LENTA = 0.15;   // velocidade do jogo durante a cinemática (1 = normal)
        let cinematicaFinalAtiva = false;       // true enquanto uma das duas está rodando
        const somVitoria = new Audio(VITORIA_SOM);
        const somDerrota = new Audio(DERROTA_SOM);
        somVitoria.volume = 0.8;
        somDerrota.volume = 0.8;
        const elVitoriaFlash = document.getElementById('vitoriaFlash');
        const elVitoriaOverlay = document.getElementById('vitoriaOverlay');
        const elVitoriaTopo = document.getElementById('vitoriaTopo');
        const elVitoriaTexto = document.getElementById('vitoriaTexto');
        const CINEMATICAS = {
            vitoria: { topo: 'PARABÉNS', texto: 'VITÓRIA', derrota: false, som: somVitoria },
            derrota: { topo: 'MAIS SORTE NA PRÓXIMA!', texto: 'DERROTA', derrota: true, som: somDerrota },
        };

        // Roda a sequência (igual ao arquivo de teste): flash+câmera lenta → texto+som aos 0,45s →
        // texto sai subindo aos 3s → fim aos 3,7s (chama aoTerminar: tela de vitória / game over).
        function rodarCinematicaFinal(tipo, aoTerminar) {
            if (cinematicaFinalAtiva) return;
            cinematicaFinalAtiva = true;
            const c = CINEMATICAS[tipo];
            elVitoriaTopo.textContent = c.topo;
            elVitoriaTexto.textContent = c.texto;
            elVitoriaOverlay.classList.toggle('derrota', c.derrota);

            // 1) impacto: flash branco + câmera lenta fixa durante toda a cinemática
            reiniciarAnimacao(elVitoriaFlash, 'active');
            JUICE.slowmo(3.9, CINEMATICA_CAMERA_LENTA, 1);
            if (c.derrota) {
                JUICE.filtroDerrota(true);          // imagem cinza e escura
            } else {
                JUICE.fovPunch(8);
                JUICE.tremer(0.5);
                JUICE.acelerarEstrelas(5);
                JUICE.vibrar([60, 40, 120]);
                JUICE.ambEvento('boss');            // o portal pulsa
            }

            // 2) pequena pausa cinematográfica, aí entra o texto e toca o som
            setTimeout(() => {
                c.som.currentTime = 0;
                c.som.play().catch(() => {});
                elVitoriaOverlay.classList.remove('hide');
                void elVitoriaOverlay.offsetWidth;
                elVitoriaOverlay.classList.add('show');
            }, 450);

            // 3) o texto fica na tela e então sai subindo
            setTimeout(() => {
                elVitoriaOverlay.classList.remove('show');
                void elVitoriaOverlay.offsetWidth;
                elVitoriaOverlay.classList.add('hide');
            }, 3000);

            // 4) fim: limpa e abre a tela de sempre
            setTimeout(() => {
                elVitoriaOverlay.classList.remove('hide');
                cinematicaFinalAtiva = false;
                aoTerminar();
            }, 3700);
        }

        // Chamada quando o boss final morre (inimigos3d.js)
        function iniciarCinematicaVitoria() {
            if (cinematicaFinalAtiva) return;
            if (!CINEMATICA_VITORIA) { venceuJogo(); return; }   // desligada: vai direto pra tela de vitória
            rodarCinematicaFinal('vitoria', () => venceuJogo());
        }

        // Chamada quando o jogador perde de vez (morreu sem poder reviver, ou desistiu na tela de reviver)
        function iniciarCinematicaDerrota() {
            if (cinematicaFinalAtiva || partidaEncerrada) return;
            if (!CINEMATICA_DERROTA) { encerrarPartida(); return; }   // desligada: vai direto pro game over
            // veio da tela de reviver? ela pausou o jogo — religa pra câmera lenta rodar (a nave já está destruída e protegida)
            if (!pausadoPorModeracao) jogoAtivo = true;
            rodarCinematicaFinal('derrota', () => { if (!pausadoPorModeracao) encerrarPartida(); });
        }

        // Condição de vitória de TESTE: derrotar 2 bosses. O jogo real
        // vence ao terminar a última onda de uma FASE (estrutura de
        // fases/mapas que ainda não existe aqui) — isso é um placeholder
        // só pra validar o fluxo da tela, não a regra final de vitória.
        const BOSSES_PARA_VITORIA = 1; // pedido explícito: 1 boss só já passa de nível/mapa
        let bossesDerrotados = 0;
        function venceuJogo() {
            if (!jogoAtivo) return;
            jogoAtivo = false;
            if (window.NRTelemetria) window.NRTelemetria.encerrar();
            ganhoVitoriasNestaSessao++;
            document.getElementById('ui').classList.add('hidden');

            // ── Desbloqueia o próximo nível/mapa — igual à lógica real do
            // boss.js. Isso é o que faltava: sem isso, o modos.html real
            // nunca via o próximo nível como disponível.
            const chaveNivel = 'nivelDesbloqueado_mapa' + mapaAtual;
            const nivDesbloq = Number(localStorage.getItem(chaveNivel)) || 1;
            if (nivelDoMapa >= nivDesbloq && nivelDoMapa < 6) localStorage.setItem(chaveNivel, nivelDoMapa + 1);
            if (nivelDoMapa === 6 && mapaAtual < 6) {
                const mapaDesbloq = Number(localStorage.getItem('mapaDesbloqueado')) || 1;
                if (mapaAtual >= mapaDesbloq) {
                    localStorage.setItem('mapaDesbloqueado', mapaAtual + 1);
                    localStorage.setItem('nivelDesbloqueado_mapa' + (mapaAtual + 1), 1);
                }
            }
            sincronizarProgressoMapas3D();
            verificarMissoesNitro(); // pode completar uma missão de "completar nível" bem aqui

            // Mesma lógica real do showVictoryScreen(): se ainda não é o
            // último nível do mapa, avança nível; se é o último nível mas
            // não o último mapa, avança mapa; se já é tudo, zerou o jogo.
            // O botão sempre manda pro modos.html — então "próximo nível/
            // mapa" e "voltar pros modos" são a mesma ação, igual ao 2D.
            const ultimoNivel = nivelDoMapa >= 6, ultimoMapa = mapaAtual >= 6;
            let tituloBotaoAvancar = '', urlAvancar = '';
            if (!ultimoNivel) { tituloBotaoAvancar = '▶ PRÓXIMO NÍVEL'; urlAvancar = 'modos.html?mapa=' + mapaAtual; }
            else if (!ultimoMapa) { tituloBotaoAvancar = '▶ PRÓXIMO MAPA'; urlAvancar = 'modos.html?mapa=' + (mapaAtual + 1); }
            const btnAvancar = tituloBotaoAvancar
                ? '<button class="btn-primary-tela" onclick="location.href=\'' + urlAvancar + '\'">' + tituloBotaoAvancar + '</button>'
                : '<p style="font-family:\'Share Tech Mono\',monospace;color:#ffd700;font-size:13px;letter-spacing:3px;text-align:center;margin:14px 0;">🏆 VOCÊ ZEROU O JOGO! 🏆</p>';

            document.getElementById('victoryScreen').innerHTML =
                '<div class="titulo-fim-jogo" style="color:#00ff88;text-shadow:0 0 30px #00ff88,0 0 80px #00ff8866;">VITÓRIA!</div>' +
                '<div style="width:80%;max-width:300px;height:1px;background:linear-gradient(90deg,transparent,#00ff88,transparent);margin:10px auto;"></div>' +
                '<p class="final-score-label">PONTUAÇÃO FINAL</p>' +
                '<div class="final-score-value">' + String(score).padStart(6, '0') + '</div>' +
                '<div class="final-wave" style="margin-bottom:18px;">MAPA ' + mapaAtual + ' — NÍVEL ' + nivelDoMapa + '</div>' +
                '<div id="rankingSection"><p class="ranking-titulo">🏆 TOP 10 GLOBAL</p><div class="rank-msg" id="rankMsgVitoria"></div><div class="ranking-list-dinamica"><div style="text-align:center;color:#ffffff55;font-family:\'Share Tech Mono\',monospace;font-size:11px;">carregando...</div></div></div>' +
                '<div style="display:flex;flex-direction:column;gap:10px;width:85%;max-width:320px;">' +
                    btnAvancar +
                    '<button class="btn-nav-secundario" style="flex:none;width:100%;color:#00ffff;border:1.5px solid #00ffff;" onclick="location.href=\'menu.html\'">⟵ VOLTAR AO MENU</button>' +
                '</div>';
            document.getElementById('victoryScreen').classList.remove('hidden');
            salvarPontuacaoRanking();
            renderizarRankingListas(); // a tela de vitória acabou de criar seu próprio elemento — atualiza com o dado já em cache
        }

        // Sincroniza o progresso de mapas/níveis com a conta (mesma função
        // real do boss.js) — sem isso, o desbloqueio ficaria só neste
        // aparelho e sumiria se o jogador trocasse de celular
        function sincronizarProgressoMapas3D() {
            if (!firebaseUid || !firebaseDb) return; // sem conta logada, fica só no localStorage mesmo
            const niveisDesbloqueados = {};
            for (let m = 1; m <= 6; m++) {
                niveisDesbloqueados[String(m)] = Number(localStorage.getItem('nivelDesbloqueado_mapa' + m)) || 1;
            }
            firebaseDbMod.update(firebaseDbMod.ref(firebaseDb, 'usuarios/' + firebaseUid + '/progresso'), {
                mapaDesbloqueado: Number(localStorage.getItem('mapaDesbloqueado')) || 1,
                niveisDesbloqueados,
            }).catch(e => console.warn('NRDados 3D: falha ao sincronizar progresso de mapas', e));
        }

        // "Tentar novamente"/"Jogar novamente" — mais simples que o
        // startGame() real (que reseta em memória sem sair da página);
        // aqui só recarrega a página inteira, suficiente pro teste
        function reiniciarPartida() { location.reload(); }

        function ganharAbate(reward, xpGanho, isBoss) {
            // Combo: se matou dentro da janela de tempo, incrementa;
            // senão reinicia em 1 — mesma ideia do combo/comboTimer do 2D
            combo = comboTimer > 0 ? combo + 1 : 1;
            comboTimer = COMBO_JANELA;
            mostrarCombo();

            score += Math.round(reward * combo * ((window.NRProf && NRProf.multPontos) ? NRProf.multPontos() : 1)); // profundidade: nave à frente = bônus de pontos
            JUICE.pop(elScore, 1.18); // o placar "pula" a cada abate
            moedas += 6;
            ganhoMoedasNestaSessao += 6;
            ganhoKillsNestaSessao++;
            if (isBoss) ganhoBossesNestaSessao++;
            precisaSincronizar = true;
            ganharXP(xpGanho);
            energy = Math.min(maxEnergy, energy + ENERGY_POR_ABATE);
            killsNaOnda++;
            if (killsNaOnda >= ENEMIES_POR_ONDA) {
                killsNaOnda = 0; wave++; atualizarWave();
                JUICE.onda(wave); // banner "ONDA N"
                // Mesmo gatilho real: só na 2ª onda, só uma vez por partida
                if (wave === 2 && !mercadoUsado) { mercadoUsado = true; setTimeout(abrirMercadoNegro, 600); }
            }

            atualizarScore(); atualizarMoedas(); atualizarEnergyBar();
            verificarMissoesNitro();
        }

        function usarBomba() {
            if (bombs <= 0 || cinematicaFinalAtiva) return;
            bombs--;
            atualizarBombCount();
            // Bomba limpa a tela: destrói todos os inimigos em cena de uma vez
            // (contra um boss também funciona — mata ele igual a qualquer inimigo)
            JUICE.bomba(shipGroup.position);  // onda de choque gigante + flash + tremor
            JUICE.iniciarLote();              // várias mortes de uma vez: explosões mais leves (economiza FPS)
            [...enemies].forEach(en => {
                matarOuRessuscitar(en);
            });
            JUICE.fimLote();
        }
        elBombBtn.addEventListener('touchstart', e => { e.preventDefault(); usarBomba(); }, { passive: false });
        elBombBtn.addEventListener('mousedown', () => usarBomba());

        atualizarHpBar(); atualizarScore(); atualizarWave(); atualizarMoedas(); atualizarEnergyBar(); atualizarBombCount(); atualizarNivelHud();

        // ── Aplica a cor do mapa em alguns destaques do HUD (dá pra sentir
        // a diferença entre mapas mesmo sem trocar o cenário inteiro) ──
        (function aplicarTemaMapaHud() {
            const corCss = '#' + temaMapa.cor.toString(16).padStart(6, '0');
            elScore.style.color = corCss;
            elScore.style.textShadow = '0 0 15px ' + corCss + ', 0 0 30px ' + corCss + '88';
            const dbg = document.getElementById('debugInfo');
            if (dbg) dbg.textContent += ' — MAPA ' + mapaAtual + ': ' + temaMapa.nome;
        })();

        // ── 6.9 FIREBASE — INTEGRAÇÃO REAL COM O DADOS.JS ────────────────
        // Mesma config/estrutura do dados.js real: usuarios/{uid}/progresso.
        // Ligar as moedas do teste no saldo de verdade da conta permite
        // validar de ponta a ponta se o núcleo 3D "conversa" com o resto
        // do jogo (loja, etc.) — não é só um número decorativo no HUD.
        //
        // Esse arquivo é um teste solto, sem tela de login antes dele
        // (diferente do jogo real, que trava em login.html primeiro). Por
        // isso ele só consegue sincronizar SE já existir uma sessão do
        // Firebase Auth ativa no mesmo navegador/origem (por ex., se você
        // abriu o login.html/menu.html antes, na mesma aba/app). Se não
        // houver sessão, ele continua funcionando 100% offline — só não
        // salva nada de verdade, e o status no topo avisa isso.
        const firebaseConfig = {
            apiKey: "AIzaSyBetMNuPB8BDfvcanmgEUIWw3bLNgbi9aM",
            authDomain: "neon-raiders.firebaseapp.com",
            projectId: "neon-raiders",
            storageBucket: "neon-raiders.firebasestorage.app",
            messagingSenderId: "307351573602",
            appId: "1:307351573602:web:a1ce6488ed420d5b99ad3b",
            databaseURL: "https://neon-raiders-default-rtdb.firebaseio.com"
        };

        const elStatusFirebase = document.getElementById('statusFirebase');
        let firebaseUid = null;
        let firebaseDb = null;
        let firebaseDbMod = null;
        let totalMoedasGanhasBase = 0;   // valor que já existia em estatisticas antes desta sessão
        let ganhoMoedasNestaSessao = 0;  // só o que essa sessão de teste ganhou
        let totalKillsBase = 0, ganhoKillsNestaSessao = 0;   // igual, mas pra abates (usado pelas missões do NITRO)
        let totalBossesBase = 0, ganhoBossesNestaSessao = 0; // igual, mas pra boss derrotados
        let tempoJogadoBase = 0;         // segundos já acumulados antes desta sessão
        let vitoriasBase = 0, ganhoVitoriasNestaSessao = 0;
        let mortesBase = 0, ganhoMortesNestaSessao = 0;
        const _inicioSessao3D = Date.now(); // pra calcular quanto tempo essa sessão durou
        let precisaSincronizar = false;
        let sincronizando = false;
        const nitroMissoesDesbloqueadas = {}; // { nitro_m1: true, ... } — carregado do Firebase

        async function ligarFirebase() {
            try {
                const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js");
                const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js");
                const dbMod = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js");
                const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
                const auth = getAuth(app);
                firebaseDb = dbMod.getDatabase(app);
                firebaseDbMod = dbMod;
                iniciarRankingListener(); // Top 10 é público — não precisa de login pra ver

                // Espera confirmar se já existe sessão logada (timeout de
                // 4s — se não vier nada, segue em modo offline em vez de
                // travar o jogo esperando pra sempre)
                const uid = await Promise.race([
                    new Promise(resolve => {
                        const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user ? user.uid : null); });
                    }),
                    new Promise(resolve => setTimeout(() => resolve(null), 4000)),
                ]);

                if (!uid) {
                    elStatusFirebase.textContent = '⚠ sem conta logada — modo offline (progresso não salva)';
                    atualizarLoading(90);
                    esconderLoading();
                    return;
                }
                firebaseUid = uid;

                // Liga a telemetria só agora — reaproveita a MESMA conexão
                // (firebaseDb/dbMod) e o uid de verdade que o jogo acabou de
                // confirmar, em vez de abrir uma segunda conexão própria.
                // Best-effort: se der erro, o jogo continua normal (ver
                // comentário dentro de telemetria.js).
                if (window.NRTelemetria) window.NRTelemetria.iniciar(firebaseDb, dbMod, uid);

                const snapProgresso = await dbMod.get(dbMod.ref(firebaseDb, 'usuarios/' + uid + '/progresso'));
                if (snapProgresso.exists()) {
                    const p = snapProgresso.val();
                    if (typeof p.moedas === 'number') { moedas = p.moedas; atualizarMoedas(); }
                    // nivel/xp vivem no mesmo branch progresso desde o
                    // cadastro em login.html (mesma regra do xp.js real)
                    if (typeof p.nivel === 'number') nivelAtual = p.nivel;
                    if (typeof p.xp === 'number') xpAtual = p.xp;
                    atualizarNivelHud();
                }
                const snapStats = await dbMod.get(dbMod.ref(firebaseDb, 'usuarios/' + uid + '/estatisticas'));
                if (snapStats.exists()) {
                    const s = snapStats.val();
                    totalMoedasGanhasBase = s.totalMoedasGanhas || 0;
                    totalKillsBase = s.totalKills || 0;
                    totalBossesBase = s.totalBosses || 0;
                    tempoJogadoBase = s.tempoJogado || 0;
                    vitoriasBase = s.vitorias || 0;
                    mortesBase = s.mortes || 0;
                }
                const snapConquistas = await dbMod.get(dbMod.ref(firebaseDb, 'usuarios/' + uid + '/conquistas'));
                if (snapConquistas.exists()) Object.assign(nitroMissoesDesbloqueadas, snapConquistas.val());
                atualizarNitroAtivo(); // pode já estar tudo desbloqueado de sessões anteriores

                elStatusFirebase.textContent = 'conectado';
                elStatusFirebase.style.color = '#00ffaa';
                atualizarLoading(90);
                esconderLoading();
            } catch (e) {
                elStatusFirebase.textContent = '⚠ Firebase indisponível — modo offline';
                console.warn('NRDados 3D: falha ao conectar Firebase', e);
                atualizarLoading(90);
                esconderLoading();
            }
        }
        atualizarLoading(60); // cena 3D montada — só falta o Firebase
        ligarFirebase();

        // Só escreve no banco de verdade a cada poucos segundos (não a
        // cada abate) — mesma lógica de "não floodar o Firebase" que o
        // 2D real já tem espalhada em debounces parecidos
        // ── RANKING TOP 10 — mesma ideia real: escuta ao vivo o Top 10
        // global (ordenado por score) e só salva a pontuação do jogador
        // se ela bater o recorde anterior dele (não sobrescreve com nota
        // pior). É público — não precisa estar logado pra VER o ranking,
        // só pra salvar uma pontuação nele.
        let ultimaListaRanking = [];
        function iniciarRankingListener() {
            const q = firebaseDbMod.query(firebaseDbMod.ref(firebaseDb, 'ranking'), firebaseDbMod.orderByChild('score'), firebaseDbMod.limitToLast(10));
            firebaseDbMod.onValue(q, snap => {
                const lista = [];
                snap.forEach(child => lista.push(child.val()));
                lista.sort((a, b) => (b.score || 0) - (a.score || 0));
                ultimaListaRanking = lista;
                renderizarRankingListas();
            }, e => console.warn('NRDados 3D: falha ao ler ranking', e));
        }
        function renderizarRankingListas() {
            const containers = document.querySelectorAll('.ranking-list-dinamica');
            if (containers.length === 0) return;
            let html;
            if (ultimaListaRanking.length === 0) {
                html = '<div style="text-align:center;color:#ffffff55;font-family:\'Share Tech Mono\',monospace;font-size:11px;">ninguém no ranking ainda</div>';
            } else {
                html = ultimaListaRanking.map((r, i) => {
                    const pos = i + 1;
                    const classe = pos === 1 ? 'top1' : pos === 2 ? 'top2' : pos === 3 ? 'top3' : '';
                    return '<div class="rank-entry ' + classe + '"><div class="rank-pos">' + pos + '</div><div class="rank-name">' + (r.name || '???') + '</div><div class="rank-pts">' + (r.score || 0).toLocaleString('pt-BR') + '</div><div class="rank-lv">Lv.' + (r.level || 1) + '</div></div>';
                }).join('');
            }
            containers.forEach(c => c.innerHTML = html);
        }
        async function salvarPontuacaoRanking() {
            if (!firebaseUid || !firebaseDb) return; // sem conta logada, não salva (mas o Top 10 continua visível)
            try {
                const playerRef = firebaseDbMod.ref(firebaseDb, 'ranking/' + firebaseUid);
                const snap = await firebaseDbMod.get(playerRef);
                const recordeAtual = snap.exists() ? (snap.val().score || 0) : 0;
                if (score > recordeAtual) {
                    const nome = localStorage.getItem('jogadorNome') || 'Piloto';
                    await firebaseDbMod.set(playerRef, { name: nome, score, level: nivelAtual, at: Date.now() });
                    const msgEl = document.getElementById('rankMsg') || document.getElementById('rankMsgVitoria');
                    if (msgEl) msgEl.textContent = '🎉 Novo recorde pessoal!';
                }
            } catch (e) { console.warn('NRDados 3D: falha ao salvar ranking', e); }
        }

        async function sincronizarComFirebase() {
            if (!firebaseUid || sincronizando || !precisaSincronizar) return;
            sincronizando = true;
            precisaSincronizar = false;
            try {
                // update() em vez de set() — só mexe no campo moedas,
                // igual ao _salvarCampo('progresso', patch) do dados.js real
                await firebaseDbMod.update(firebaseDbMod.ref(firebaseDb, 'usuarios/' + firebaseUid + '/progresso'), { moedas, xp: xpAtual, nivel: nivelAtual });
                await firebaseDbMod.update(firebaseDbMod.ref(firebaseDb, 'usuarios/' + firebaseUid + '/estatisticas'), {
                    totalMoedasGanhas: totalMoedasGanhasBase + ganhoMoedasNestaSessao,
                    totalKills: totalKillsBase + ganhoKillsNestaSessao,
                    totalBosses: totalBossesBase + ganhoBossesNestaSessao,
                    tempoJogado: tempoJogadoBase + Math.round((Date.now() - _inicioSessao3D) / 1000),
                    vitorias: vitoriasBase + ganhoVitoriasNestaSessao,
                    mortes: mortesBase + ganhoMortesNestaSessao,
                });
            } catch (e) {
                console.warn('NRDados 3D: falha ao sincronizar', e);
            }
            sincronizando = false;
        }
        setInterval(sincronizarComFirebase, 3000);
        // Mesma ideia dos listeners de saída inesperada do 2D real — tenta
        // salvar o tempo jogado mesmo se o jogador sair sem terminar a
        // partida (fechar a aba, trocar de app, apertar voltar)
        window.addEventListener('pagehide', () => { precisaSincronizar = true; sincronizarComFirebase(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { precisaSincronizar = true; sincronizarComFirebase(); } });

        // ── NITRO — drone companheiro desbloqueado ao completar as 15
        // missões reais (conquistas.js). Verifica a cada abate/vitória; quando
        // as 15 estiverem completas, o drone aparece na partida sozinho.
        function nivelFoiCompletado(mapa, nivel) {
            const desbloqueado = Number(localStorage.getItem('nivelDesbloqueado_mapa' + mapa)) || 1;
            if (desbloqueado > nivel) return true;
            // BUG que a missão "Veterano Glacial" (nitro_m8, mapa 2 nível 6)
            // expôs: o ÚLTIMO nível de um mapa nunca desbloqueia "nível 7"
            // (não existe), então nivelDesbloqueado_mapaX trava em 6 pra
            // sempre — mesmo depois de vencer. Isso fazia essa checagem
            // devolver falso PARA SEMPRE pra quem batesse o nível 6 de
            // qualquer mapa, por mais que tivesse realmente vencido.
            // Se o jogo já liberou o MAPA seguinte, é prova de que o nível 6
            // (o último) foi batido — venceuJogo() só libera o próximo mapa
            // depois de vencer o nível 6 do atual.
            if (nivel === 6) {
                const mapaDesbloqueado = Number(localStorage.getItem('mapaDesbloqueado')) || 1;
                if (mapaDesbloqueado > mapa) return true;
            }
            return false;
        }
        const MISSOES_NITRO = [
            { id: 'nitro_m1',  checar: () => (totalKillsBase + ganhoKillsNestaSessao) >= 65 },
            { id: 'nitro_m2',  checar: () => nivelFoiCompletado(1, 1) },
            { id: 'nitro_m3',  checar: () => (totalMoedasGanhasBase + ganhoMoedasNestaSessao) >= 573 },
            { id: 'nitro_m4',  checar: () => (totalKillsBase + ganhoKillsNestaSessao) >= 289 },
            { id: 'nitro_m5',  checar: () => nivelFoiCompletado(2, 1) },
            { id: 'nitro_m6',  checar: () => (totalBossesBase + ganhoBossesNestaSessao) >= 7 },
            { id: 'nitro_m7',  checar: () => (totalMoedasGanhasBase + ganhoMoedasNestaSessao) >= 2500 },
            { id: 'nitro_m8',  checar: () => nivelFoiCompletado(2, 6) },
            { id: 'nitro_m9',  checar: () => (totalKillsBase + ganhoKillsNestaSessao) >= 611 },
            { id: 'nitro_m10', checar: () => (totalBossesBase + ganhoBossesNestaSessao) >= 18 },
            { id: 'nitro_m11', checar: () => nivelFoiCompletado(3, 1) },
            { id: 'nitro_m12', checar: () => (totalMoedasGanhasBase + ganhoMoedasNestaSessao) >= 25000 },
            { id: 'nitro_m13', checar: () => (totalKillsBase + ganhoKillsNestaSessao) >= 1250 },
            { id: 'nitro_m14', checar: () => nivelFoiCompletado(4, 1) },
            { id: 'nitro_m15', checar: () => (totalBossesBase + ganhoBossesNestaSessao) >= 30 },
        ];
        function verificarMissoesNitro() {
            let mudou = false;
            MISSOES_NITRO.forEach(m => {
                if (!nitroMissoesDesbloqueadas[m.id] && m.checar()) {
                    nitroMissoesDesbloqueadas[m.id] = true;
                    mudou = true;
                    // Espelha no localStorage no formato antigo, pra continuar
                    // compatível com o 2D real (neonraiders_conquistas_{jogador})
                    try {
                        const jogador = localStorage.getItem('jogadorNome');
                        if (jogador) {
                            const chave = 'neonraiders_conquistas_' + jogador;
                            const dados = JSON.parse(localStorage.getItem(chave) || '{}');
                            dados[m.id] = true;
                            localStorage.setItem(chave, JSON.stringify(dados));
                        }
                    } catch (e) { /* localStorage indisponível — segue só com Firebase */ }
                    if (firebaseUid) {
                        firebaseDbMod.update(firebaseDbMod.ref(firebaseDb, 'usuarios/' + firebaseUid + '/conquistas'), { [m.id]: true }).catch(() => {});
                    }
                }
            });
            if (mudou) atualizarNitroAtivo();
        }

        // ── DEBUG — só pra testar rápido. Abra o console do navegador
        // (F12 no PC, ou o painel de console que você já usa no Spck) e
        // digite: testarNitro()
        // Isso força as 15 missões como completas na hora, sem precisar
        // realmente matar 1250 inimigos ou derrotar 30 boss pra testar.
        window.testarNitro = function () {
            MISSOES_NITRO.forEach(m => { nitroMissoesDesbloqueadas[m.id] = true; });
            atualizarNitroAtivo();
            console.log('[DEBUG] Todas as 15 missões do NITRO marcadas como completas. NITRO ativo:', NITRO3D.ativo);
        };

        // ── Visual e comportamento do NITRO — porta fielmente o drawNitro()/
        // updateNitro() reais: hexágono ciano + anel tracejado girando +
        // núcleo, num offset FIXO ao lado da nave (o 2D usa
        // velocidadeOrbita:0, ou seja, ele não gira de verdade — fica
        // parado num ponto relativo à nave, então mantive isso igual)
        const NITRO3D = { ativo: false, mesh: null, anelInterno: null, shootTimer: 0.75, coletaTimer: 0, curaTimer: 5 };
        const nitroBullets = []; // tiro próprio do NITRO — mira certeira, não precisa de homing
        // Modelo novo (nitro3d.js: corpo/viseira/asas/braços). Se o
        // script não carregar por algum motivo, cai no hexágono antigo
        // em vez de quebrar o jogo — mesma rede de segurança do Vanguard.
        function criarNitroMesh() {
            if (typeof window.criarNitroRobo === 'function') return window.criarNitroRobo();
            const group = new THREE.Group();
            const hexShape = new THREE.Shape();
            for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; const x = Math.cos(a) * 0.5, y = Math.sin(a) * 0.5; if (i === 0) hexShape.moveTo(x, y); else hexShape.lineTo(x, y); }
            hexShape.closePath();
            const corpo = new THREE.Mesh(new THREE.ExtrudeGeometry(hexShape, { depth: 0.15, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
            group.add(corpo);
            const anel = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.025, 6, 24), new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.55 }));
            group.add(anel);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
            nucleo.position.z = 0.25;
            group.add(nucleo);
            group.userData.anel = anel;
            return group;
        }
        function atualizarNitroAtivo() {
            const todasCompletas = MISSOES_NITRO.every(m => nitroMissoesDesbloqueadas[m.id]);
            if (todasCompletas && !NITRO3D.ativo) {
                NITRO3D.ativo = true;
                NITRO3D.mesh = criarNitroMesh();
                scene.add(NITRO3D.mesh);
                mostrarAvisoBoss('🤖 NITRO ATIVADO!');
            }
        }
        function atualizarNitro(dt, time) {
            if (!NITRO3D.ativo || !NITRO3D.mesh) return;
            // Offset fixo ao lado da nave (igual ao 2D real — velocidadeOrbita
            // é 0 lá, o NITRO não chega a girar de verdade)
            NITRO3D.mesh.position.set(shipGroup.position.x + 1.3, shipGroup.position.y + 0.2, shipGroup.position.z - 0.6);
            if (typeof window.atualizarVisualNitro === 'function') window.atualizarVisualNitro(NITRO3D.mesh, dt, time);
            else if (NITRO3D.mesh.userData.anel) NITRO3D.mesh.userData.anel.rotation.z += dt * 1.2; // hexágono antigo (rede de segurança)

            // Tiro automático no inimigo mais próximo (não-boss)
            NITRO3D.shootTimer -= dt;
            if (NITRO3D.shootTimer <= 0 && enemies.length > 0) {
                NITRO3D.shootTimer = 0.75;
                let alvo = null, menorDist = Infinity;
                enemies.forEach(en => {
                    if (en.isBoss || !en.posicionado) return;
                    const d = NITRO3D.mesh.position.distanceTo(en.mesh.position);
                    if (d < menorDist) { menorDist = d; alvo = en; }
                });
                if (alvo && menorDist < 30) {
                    const dir = new THREE.Vector3().subVectors(alvo.mesh.position, NITRO3D.mesh.position).normalize();
                    const b = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
                    b.position.copy(NITRO3D.mesh.position);
                    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
                    b.userData.dir = dir;
                    b.userData.vida = 3;
                    scene.add(b);
                    nitroBullets.push(b);
                }
            }

            // Coleta cristal próximo automaticamente
            NITRO3D.coletaTimer -= dt;
            if (NITRO3D.coletaTimer <= 0) {
                NITRO3D.coletaTimer = 0.13;
                for (let i = cristaisAtivos.length - 1; i >= 0; i--) {
                    const c = cristaisAtivos[i];
                    if (c.mesh.position.distanceTo(NITRO3D.mesh.position) < 1.4) {
                        if (c.tipo === 0) { energy = Math.min(maxEnergy, energy + 3.8); atualizarEnergyBar(); }
                        else if (c.tipo === 1) { playerHp = Math.min(playerMaxHp, playerHp + 8); atualizarHpBar(); }
                        else { score += 50 * combo; atualizarScore(); }
                        scene.remove(c.mesh);
                        cristaisAtivos.splice(i, 1);
                        break;
                    }
                }
            }

            // Cura periódica
            NITRO3D.curaTimer -= dt;
            if (NITRO3D.curaTimer <= 0) {
                NITRO3D.curaTimer = 5;
                if (playerHp < playerMaxHp) { playerHp = Math.min(playerMaxHp, playerHp + 3); atualizarHpBar(); }
            }
        }
        function atualizarTirosNitro(dt) {
            for (let i = nitroBullets.length - 1; i >= 0; i--) {
                const b = nitroBullets[i];
                b.position.addScaledVector(b.userData.dir, BULLET_SPEED * 60 * dt);
                b.userData.vida -= dt;
                let atingiu = false;
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const en = enemies[j];
                    if (b.position.distanceTo(en.mesh.position) < (en.hitRadius || ENEMY_HIT_RADIUS)) {
                        const _dNitro = calcularDanoJogador();
                        en.hp -= _dNitro;
                        if (window.NROnline) NROnline.dano(en, _dNitro); // multiplayer: avisa o outro jogador
                        en.hitFlashTimer = 0.12;
                        atingiu = true;
                        JUICE.acertoInimigo(en, b.position, b.material.color, false); // juice: faíscas do impacto
                        if (en.hp <= 0) { matarOuRessuscitar(en); }
                        break;
                    }
                }
                if (atingiu || b.userData.vida <= 0) { scene.remove(b); nitroBullets.splice(i, 1); }
            }
        }



        // ── 7. CONTROLE POR ARRASTE — replica o boss.js do jogo 2D ───
        // O 2D tem 2 modos salvos em localStorage('modoControle'):
        //  - "direto": a nave persegue a posição do dedo (lerp de 15%
        //    por frame) — é o padrão do jogo.
        //  - "relativo": a nave soma o delta do arraste diretamente.
        // Os dois foram portados aqui do mesmo jeito, só trocando
        // "pixels de canvas" por "posição no plano de voo 3D".
        let modoControle = localStorage.getItem('modoControle') || 'direto';
        const modoBtn = document.getElementById('modoControleBtn');
        modoBtn.textContent = 'MODO: ' + modoControle.toUpperCase();
        modoBtn.addEventListener('click', () => {
            modoControle = (modoControle === 'direto') ? 'relativo' : 'direto';
            localStorage.setItem('modoControle', modoControle);
            modoBtn.textContent = 'MODO: ' + modoControle.toUpperCase();
        });

        let touching = false;
        let lastTouchX = null, lastTouchY = null;
        let targetX = shipState.x, targetY = shipState.y;

        // Sensibilidade do modo relativo (pixels de arraste → unidades do mundo)
        const SENSIBILIDADE_RELATIVA = 0.018;

        function pixelParaAlvo(clientX, clientY) {
            // Converte a posição do dedo na tela (0..largura, 0..altura)
            // proporcionalmente pros limites da área de voo (VOO.x/y).
            const fracX = clientX / getGameWidth();       // 0 = esquerda, 1 = direita
            const fracY = clientY / getGameHeight();       // 0 = topo, 1 = base
            const x = VOO.xMin + fracX * (VOO.xMax - VOO.xMin);
            // Topo da tela ("cima") = nave sobe (y maior) — por isso inverte
            const y = VOO.yMax - fracY * (VOO.yMax - VOO.yMin);
            return { x, y };
        }

        function onTouchStart(clientX, clientY) {
            touching = true;
            lastTouchX = clientX;
            lastTouchY = clientY;
            modoControle = localStorage.getItem('modoControle') || modoControle; // recarrega igual ao 2D
            if (modoControle === 'direto') {
                const alvo = pixelParaAlvo(clientX, clientY);
                targetX = alvo.x;
                targetY = alvo.y;
            }
        }
        function onTouchMove(clientX, clientY) {
            if (!touching) return;
            if (modoControle === 'relativo') {
                const deltaX = (clientX - lastTouchX) * SENSIBILIDADE_RELATIVA;
                const deltaY = -(clientY - lastTouchY) * SENSIBILIDADE_RELATIVA; // arrastar pra cima = subir
                shipState.x = THREE.MathUtils.clamp(shipState.x + deltaX, VOO.xMin, VOO.xMax);
                shipState.y = THREE.MathUtils.clamp(shipState.y + deltaY, VOO.yMin, VOO.yMax);
                lastTouchX = clientX;
                lastTouchY = clientY;
            } else {
                const alvo = pixelParaAlvo(clientX, clientY);
                targetX = alvo.x;
                targetY = alvo.y;
            }
        }
        function onTouchEnd() { touching = false; }

        // BUG CORRIGIDO (multitoque): antes o código usava sempre e.touches[0] — o PRIMEIRO dedo da lista de
        // todos os dedos na tela. Então, com 2 dedos, a nave "trocava de dedo": se você segurava o botão de tiro
        // ou de bomba primeiro (esse dedo é o touches[0]) e depois arrastava outro dedo pra mover, a nave ia pra
        // onde estava o botão; e se o 1º dedo saísse, ela pulava pro outro. Agora a nave segue UM dedo só: o que
        // encostou primeiro NA TELA DE JOGO, guardado pelo identifier. Os outros dedos (inclusive os dos botões)
        // são ignorados, e quando o dedo da nave sai, a nave para (não pula pra outro dedo).
        let dedoNaveId = null;   // identifier do dedo que está guiando a nave (null = nenhum)
        function acharToque(lista, id) {
            for (let i = 0; i < lista.length; i++) if (lista[i].identifier === id) return lista[i];
            return null;
        }
        renderer.domElement.addEventListener('touchstart', e => {
            e.preventDefault();
            // trava de segurança: se esse é o ÚNICO dedo na tela, qualquer dedo guardado ficou "velho" (touchend perdido)
            if (dedoNaveId !== null && e.touches.length === e.changedTouches.length) dedoNaveId = null;
            if (dedoNaveId !== null) return;   // já tem um dedo guiando a nave: ignora os outros
            const t = e.changedTouches[0];     // o dedo que ACABOU de encostar aqui (não os que estão nos botões)
            dedoNaveId = t.identifier;
            onTouchStart(t.clientX, t.clientY);
        }, { passive: false });
        renderer.domElement.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = acharToque(e.changedTouches, dedoNaveId);   // só o dedo da nave importa
            if (t) onTouchMove(t.clientX, t.clientY);
        }, { passive: false });
        function soltouDedoNave(e) {
            e.preventDefault();
            if (acharToque(e.changedTouches, dedoNaveId)) { dedoNaveId = null; onTouchEnd(); }
        }
        renderer.domElement.addEventListener('touchend', soltouDedoNave, { passive: false });
        renderer.domElement.addEventListener('touchcancel', soltouDedoNave, { passive: false }); // (o sistema pode cancelar o toque, ex: gesto de notificação)

        // Suporte a mouse/teclado só pra testar no navegador do PC
        renderer.domElement.addEventListener('mousedown', e => onTouchStart(e.clientX, e.clientY));
        renderer.domElement.addEventListener('mousemove', e => { if (touching) onTouchMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup', onTouchEnd);

        // ── 8. LOOP PRINCIPAL ─────────────────────────────────────────
        const clock = new THREE.Clock();
        let elapsedTime = 0; // controlado manualmente pra não chamar getDelta() duas vezes por frame (getElapsedTime já faz isso internamente)

        // Cria o painel (só existe no DOM se DEBUG_MODO) — canto superior
        // esquerdo, por cima de tudo, texto monoespaçado fácil de ler.
        let _painelDebugEl = null;
        if (DEBUG_MODO) {
            _painelDebugEl = document.createElement('div');
            _painelDebugEl.id = 'painelDebug';
            _painelDebugEl.style.cssText = 'position:fixed;top:6px;left:6px;z-index:99999;background:rgba(0,0,0,0.75);color:#0f0;font-family:monospace;font-size:11px;line-height:1.5;padding:8px 10px;border-radius:6px;border:1px solid #0f0;white-space:pre;pointer-events:none;max-width:70vw;';
            document.body.appendChild(_painelDebugEl);
        }

        // ── FPS (média móvel simples, últimos ~30 frames) ────────────────
        let _fpsAmostras = [];
        function _registrarFrameFps(dt) {
            if (dt <= 0) return;
            _fpsAmostras.push(1 / dt);
            if (_fpsAmostras.length > 30) _fpsAmostras.shift();
        }
        function _fpsMedio() {
            if (_fpsAmostras.length === 0) return 0;
            return Math.round(_fpsAmostras.reduce((a, b) => a + b, 0) / _fpsAmostras.length);
        }

        // Calcula o estado atual da partida UMA VEZ SÓ — usado tanto pelo
        // painel de debug local (só você, ?debug=1) quanto pra mandar pro
        // Firebase via telemetria.js (pro painel de espectador). Assim as
        // duas coisas nunca ficam com números diferentes uma da outra.
        //
        // "radar" é a parte enviada pro modo assistir do painel admin: só
        // as posições X/altura + HP de cada inimigo (e a posição da nave),
        // arredondadas — nunca a cena 3D inteira nem imagem/vídeo. Cabe
        // folgado no limite de payload pequeno que a telemetria já usa.
        function coletarEstadoPartida() {
            let danoTotalTela = 0, hpTotalTela = 0, qtdComuns = 0;
            let boss = null;
            const radarInimigos = [];
            enemies.forEach(en => {
                if (en.isBoss) {
                    boss = { nome: en.nomeBoss, hp: Math.ceil(en.hp), hpMax: en.maxHp, danoBala: en.danoBala };
                    radarInimigos.push([Math.round(en.mesh.position.x * 10) / 10, Math.round(en.mesh.position.y * 10) / 10, Math.ceil(en.hp), 1]);
                } else {
                    danoTotalTela += en.dano || 0;
                    hpTotalTela += en.hp || 0;
                    qtdComuns++;
                    // Radar fica só com os inimigos comuns visíveis agora —
                    // como o limite por formação já é 3 a 8 (mapa 1 a 6), o
                    // array nunca fica grande, sem precisar nem de um corte.
                    radarInimigos.push([Math.round(en.mesh.position.x * 10) / 10, Math.round(en.mesh.position.y * 10) / 10, Math.ceil(en.hp), 0]);
                }
            });

            const danoPorTiro = calcularDanoJogador() * (1 + CRITICO_CHANCE * (CRITICO_MULT - 1)); // crítico esperado
            const cooldownAtual = cooldownTiroAtual();
            const dps = danoPorTiro / cooldownAtual;
            const ttk = hpTotalTela > 0 ? Number((hpTotalTela / dps).toFixed(1)) : 0;
            // HTD = "hits to die" — quantos hits do inimigo/boss mais forte
            // em tela o jogador aguenta antes de morrer, com o HP de agora
            const maiorDanoInimigo = Math.max(danoTotalTela > 0 ? Math.max(...enemies.filter(e => !e.isBoss).map(e => e.dano || 0)) : 0, boss ? boss.danoBala : 0);
            const htd = maiorDanoInimigo > 0 ? Math.max(1, Math.ceil(playerHp / maiorDanoInimigo)) : 99;

            const _nomeJogador = localStorage.getItem('jogadorNome') || 'Piloto';

            return {
                nome: _nomeJogador,
                mapa: mapaAtual, nivel: nivelDoMapa, wave: formacoesConcluidas, combo,
                naveId: _naveIdSalva,
                hpAtual: Math.ceil(playerHp), hpMax: playerMaxHp,
                danoPorTiro: Number(danoPorTiro.toFixed(2)), dps: Number(dps.toFixed(1)),
                bossNome: boss ? boss.nome : null, bossHp: boss ? boss.hp : null, bossHpMax: boss ? boss.hpMax : null, bossDanoBala: boss ? boss.danoBala : null,
                ttk, htd, qtdInimigos: qtdComuns, danoTotalTela, hpTotalTela,
                fps: _fpsMedio(),
                jogadorPos: [Math.round(shipGroup.position.x * 10) / 10, Math.round(shipGroup.position.y * 10) / 10],
                radar: radarInimigos,
            };
        }

        function atualizarPainelDebug(estado) {
            if (!_painelDebugEl) return;
            _painelDebugEl.textContent =
                `[DEBUG] Mapa${estado.mapa} NV${estado.nivel}  wave=${estado.wave}  fps=${estado.fps}\n` +
                `Nave: dano/tiro=${estado.danoPorTiro}  dps=${estado.dps}\n` +
                `HP jogador: ${estado.hpAtual}/${estado.hpMax}\n` +
                `Tela: ${estado.qtdInimigos} inimigo(s)  dano_total=${estado.danoTotalTela}  hp_total=${estado.hpTotalTela}  TTK~${estado.ttk}s  HTD~${estado.htd}\n` +
                `Boss: ${estado.bossNome ? `${estado.bossNome}  hp=${estado.bossHp}/${estado.bossHpMax}  danoBala=${estado.bossDanoBala}` : 'nenhum'}`;
        }

        function animate() {
            requestAnimationFrame(animate);
            const dtReal = Math.min(clock.getDelta(), 0.05); // trava dt máximo pra evitar saltos se o app pausar
            // dt = tempo do JOGO. Igual ao real, exceto em hit-stop/câmera lenta (juice3d.js),
            // quando encolhe — assim o jogo todo congela/desacelera junto.
            const dt = dtReal * JUICE.antesDoFrame(dtReal);
            elapsedTime += dt;
            const time = elapsedTime;

            if (jogoAtivo || contagemAtiva) { // (durante a contagem a nave já se mexe)
            // Modo direto: persegue o alvo (mesmo fator 0.15 do boss.js)
            if (modoControle === 'direto' && touching) {
                shipState.x += (targetX - shipState.x) * fatorMovimentoAtual();
                shipState.y += (targetY - shipState.y) * fatorMovimentoAtual();
            }

            shipGroup.position.x = shipState.x;
            shipGroup.position.y = shipState.y;

            // Inclinação da nave ao virar — mesma ideia do protótipo do Gemini,
            // agora calculada pela diferença de posição em vez da velocidade X pura
            const inclinacaoAlvo = (targetX - shipState.x) * -0.3;
            shipGroup.rotation.z = THREE.MathUtils.lerp(shipGroup.rotation.z, modoControle === 'direto' ? inclinacaoAlvo : 0, 0.15);

            // Leve flutuação vertical (vida na nave parada)
            shipGroup.position.y += Math.sin(time * 4) * 0.04;

            // Juice: FÍSICA DE MOLA da nave (juice3d.js → JUICE_CFG.nave). Ela inclina de lado,
            // empina o nariz ao subir/descer, passa do ponto e balança até assentar. Usa a
            // velocidade real de shipState (sem o balanço acima) e sobrescreve a rotação.
            JUICE.fisicaNave(shipGroup, shipState, dt, dtReal);
            // Juice: brasas saindo do motor (a Vanguard já tem fogo próprio, então pula)
            if (!shipGroup.userData.fogo) JUICE.motor(shipGroup, dt);
            } // fim do if(jogoAtivo) do controle da nave

            // Fogo das turbinas da Vanguard (não faz nada nas outras naves)
            if (shipGroup.userData.fogo && typeof atualizarFogoVanguard === 'function') atualizarFogoVanguard(shipGroup, dt, time);

            atualizarCamera();

            // Movimento das estrelas (sensação de voo pra frente)
            // Ambiente novo: 1 chamada e a GPU faz o resto. Fundo antigo: os loops abaixo.
            if (AMBIENTE) { AMBIENTE.atualizar(dt, dtReal, time, JUICE.fatorEstrelas(), combo); } else {
            moonGroup.position.y = 20 + Math.sin(time * 0.5) * 0.5;
            portalAnel1.rotation.z += dt * 0.25;  // externo — direita
            portalAnel2.rotation.z -= dt * 0.35;  // meio — esquerda
            portalAnel3.rotation.z += dt * 0.45;  // interno — direita
            portalNucleo.material.opacity = 0.7 + Math.sin(time * 2) * 0.15;

            // Partículas sendo sugadas pro centro do portal — raio diminui
            // com o tempo; ao chegar perto do núcleo, volta pra borda
            const portalPos = portalParticulas.geometry.attributes.position.array;
            for (let i = 0; i < PORTAL_PARTICULA_QTD; i++) {
                const p = portalParticulaEstado[i];
                p.raio -= p.vel * dt;
                if (p.raio < 2) { p.raio = 16 + Math.random() * 26; p.angulo = Math.random() * Math.PI * 2; }
                portalPos[i * 3] = Math.cos(p.angulo) * p.raio;
                portalPos[i * 3 + 1] = Math.sin(p.angulo) * p.raio;
            }
            portalParticulas.geometry.attributes.position.needsUpdate = true;
            const positions = stars.geometry.attributes.position.array;
            // Juice: estrelas aceleram (warp) na bomba/boss/level-up e acompanham a câmera lenta
            const fatorEstrelas = JUICE.fatorEstrelas() * (dt / Math.max(dtReal, 0.0001));
            for (let i = 0; i < starCount; i++) {
                positions[i * 3 + 2] += starVelocities[i] * fatorEstrelas;
                if (positions[i * 3 + 2] > 10) {
                    positions[i * 3 + 2] = -200;
                    positions[i * 3] = (Math.random() - 0.5) * 200;
                    positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
                }
            }
            stars.geometry.attributes.position.needsUpdate = true;

            // Partículas de clima do mapa — mesma reciclagem das estrelas,
            // só que também derivam um pouco em Y conforme o mapa (gelo cai,
            // fogo sobe)
            const climaPos = clima.geometry.attributes.position.array;
            for (let i = 0; i < climaCount; i++) {
                climaPos[i * 3 + 2] += 0.8;
                climaPos[i * 3 + 1] += CLIMA_DRIFT_Y * dt;
                if (climaPos[i * 3 + 2] > 10) {
                    climaPos[i * 3 + 2] = -160;
                    climaPos[i * 3] = (Math.random() - 0.5) * 160;
                    climaPos[i * 3 + 1] = (Math.random() - 0.5) * 160;
                }
            }
            clima.geometry.attributes.position.needsUpdate = true;
            } // fim do else (fundo antigo)

            if (jogoAtivo) {
            // ── Tiro do jogador (mantém pressionado o botão ⚡) ──────
            shootCooldownTimer -= dt;
            if (typeof NRPlasma !== 'undefined' && NRPlasma.ativa) {
                NRPlasma.atualizar(dt, firing); // nave de plasma: segurar o botão carrega o tiro (plasma.js); não há tiro comum
            } else if (firing && shootCooldownTimer <= 0 && !naveDestruida) {
                dispararTiroJogador();
                shootCooldownTimer = cooldownTiroAtual();
            }

            // ── Atualiza balas do jogador + colisão com inimigos ─────
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                moverBalaJogador(b, dt); // reta, ou curvando rumo a um inimigo (ver PLAYER_BULLET_HOMING)
                let atingiu = false;

                for (let j = enemies.length - 1; j >= 0; j--) {
                    const en = enemies[j];
                    if (b.position.distanceTo(en.mesh.position) < (en.hitRadius || ENEMY_HIT_RADIUS)) {
                        const nexusDano = danoDoTiroComCritico();
                        en.hp -= nexusDano;
                        if (window.NROnline) NROnline.dano(en, nexusDano); // multiplayer: avisa o outro jogador
                        nexusRegistrarDano(nexusDano);
                        en.hitFlashTimer = 0.12;
                        atingiu = true;
                        // Juice: faíscas do impacto + "soco" no inimigo (crítico = mais forte)
                        JUICE.acertoInimigo(en, b.position, b.material.color, nexusDano > calcularDanoJogador() * 1.0001);
                        if (en.hp <= 0) {
                            matarOuRessuscitar(en);
                        }
                        break;
                    }
                }

                if (atingiu || b.position.z < ENEMY_SPAWN_Z - 30) {
                    scene.remove(b);
                    bullets.splice(i, 1);
                }
            }

            // ── Atualiza formação (spawna próximo membro se for a hora) ──
            if (!cinematicaFinalAtiva) tickFormacao(dt); // (nas cinemáticas de vitória/derrota nenhuma formação nova nasce)

            atualizarInimigos(dt); // porta a movimentação/tiro/colisão corpo-a-corpo dos inimigos (inimigos3d.js)
            atualizarNitro(dt, time);
            nexusAtualizar(dt);
            nexusAtualizarVisual(time);
            atualizarTirosNitro(dt);


            // ── Atualiza balas inimigas + colisão com o jogador ──────
            // ENEMY_BULLET_HOMING controla quão forte a bala curva atrás
            // da nave a cada segundo — 0 = reta (como o 2D original),
            // valores maiores = curva mais rápido e é mais difícil de
            // desviar. Os players reclamaram que estava difícil de desviar,
            // então agora é 0: a bala sai mirada na posição da nave NA HORA
            // do tiro e segue reta (vale pra inimigos comuns e bosses).
            // (Se um dia quiser de volta, 4.5 era o valor anterior.)
            const ENEMY_BULLET_HOMING = 0;
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eb = enemyBullets[i];

                if (ENEMY_BULLET_HOMING > 0) {
                    // Vira a direção da bala gradualmente rumo à posição atual da nave
                    const direcaoAtual = new THREE.Vector3().subVectors(shipGroup.position, eb.position).normalize();
                    eb.userData.dir.lerp(direcaoAtual, Math.min(1, ENEMY_BULLET_HOMING * dt)).normalize();
                }
                eb.position.addScaledVector(eb.userData.dir, ENEMY_BULLET_SPEED * 60 * dt);
                // a orientação da bala já é definida na hora do tiro; só refaz se ela estiver curvando
                if (ENEMY_BULLET_HOMING > 0) eb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eb.userData.dir);

                eb.userData.vida -= dt;

                if (!eb.userData.alvoOutro && eb.position.distanceTo(shipGroup.position) < 1.1) {
                    // Igual ao 2D real: com SHIELD ativo, o tiro é bloqueado
                    // em vez de causar dano (o hurtPlayer nem é chamado)
                    if (jogadorPowerup !== 'SHIELD') {
                        // Bala de inimigo comum carrega o dano exato da spec
                        // de balanceamento (eb.userData.dano, setado em
                        // inimigos3d.js na hora do tiro). Balas de boss não
                        // têm esse campo ainda (boss não foi balanceado
                        // nessa etapa) — cai pra fórmula antiga por wave.
                        sofrerDano(eb.userData.dano != null ? eb.userData.dano : (17 + wave * 2), true); // true = é bala (conta mesmo durante o piscar)
                    }
                    scene.remove(eb);
                    enemyBullets.splice(i, 1);
                    continue;
                }
                if (eb.userData.vida <= 0) {
                    scene.remove(eb);
                    enemyBullets.splice(i, 1);
                }
            }

            // ── Cristais (energia/vida/pontos) e power-ups (RAPID/TRIPLE/SHIELD) ──
            // Física igual à ideia do 2D real: vx/vy vão perdendo força
            // (atrito) e vz vai acelerando (a "gravidade" do 2D, lá em
            // direção ao jogador) — então eles vêm boiando até a nave em
            // vez de ficar parados esperando no lugar onde nasceram.
            for (let i = cristaisAtivos.length - 1; i >= 0; i--) {
                const c = cristaisAtivos[i];
                c.vel.z += 0.4 * dt;
                c.vel.x *= (1 - Math.min(1, 3 * dt));
                c.vel.y *= (1 - Math.min(1, 3 * dt));
                c.mesh.position.addScaledVector(c.vel, dt);
                c.mesh.rotation.y += c.rotSpeed * dt;
                c.vida -= dt;
                if (CRISTAL_IMA_RAIO > 0) {
                    const dIma = c.mesh.position.distanceTo(shipGroup.position);
                    // quanto mais perto, mais forte o puxão
                    if (dIma < CRISTAL_IMA_RAIO) c.mesh.position.lerp(shipGroup.position, Math.min(1, (1 - dIma / CRISTAL_IMA_RAIO) * 9 * dt));
                }
                if (c.mesh.position.distanceTo(shipGroup.position) < 1.3) {
                    JUICE.coleta(c.mesh.position, CRISTAL_CORES[c.tipo]); // faíscas + anelzinho na cor do cristal
                    if (c.tipo === 1) mostrarTextoFlutuante(c.mesh.position, '+8 HP', '#4dff9e');
                    if (c.tipo === 0) { energy = Math.min(maxEnergy, energy + 3.8); atualizarEnergyBar(); }
                    else if (c.tipo === 1) { playerHp = Math.min(playerMaxHp, playerHp + 8); atualizarHpBar(); }
                    else { score += 50 * combo; atualizarScore(); }
                    scene.remove(c.mesh);
                    cristaisAtivos.splice(i, 1);
                } else if (c.vida <= 0 || c.mesh.position.z > shipGroup.position.z + 4) {
                    // Some por tempo esgotado OU por ter passado da nave sem
                    // ser pego (evita ficar voando pra sempre se desviar no
                    // x/y e não colidir)
                    scene.remove(c.mesh);
                    cristaisAtivos.splice(i, 1);
                }
            }
            for (let i = powerupsAtivos.length - 1; i >= 0; i--) {
                const pu = powerupsAtivos[i];
                pu.vel.z += 0.4 * dt;
                pu.vel.x *= (1 - Math.min(1, 3 * dt));
                pu.vel.y *= (1 - Math.min(1, 3 * dt));
                pu.mesh.position.addScaledVector(pu.vel, dt);
                pu.mesh.rotation.y += pu.rotSpeed * dt;
                pu.mesh.rotation.x += pu.rotSpeed * 0.6 * dt;
                pu.vida -= dt;
                if (pu.mesh.position.distanceTo(shipGroup.position) < 1.5) {
                    coletarPowerup(pu); // aplica o efeito (o verde cura 45 HP; os outros ligam o power-up)
                    scene.remove(pu.mesh);
                    powerupsAtivos.splice(i, 1);
                } else if (pu.vida <= 0 || pu.mesh.position.z > shipGroup.position.z + 4) {
                    scene.remove(pu.mesh);
                    powerupsAtivos.splice(i, 1);
                }
            }

            // Contagem regressiva do power-up ativo + efeitos contínuos do SHIELD
            if (jogadorPowerup) {
                jogadorPowerupTimer -= dt;
                if (jogadorPowerup === 'SHIELD') {
                    energy = Math.min(maxEnergy, energy + 18 * dt); // igual ao +0.3/frame do 2D real
                    atualizarEnergyBar();
                }
                if (jogadorPowerupTimer <= 0) jogadorPowerup = null;
            }
            escudoMesh.visible = jogadorPowerup === 'SHIELD';
            if (escudoMesh.visible) escudoMesh.material.opacity = 0.4 + Math.sin(time * 8) * 0.25;

            if (playerInvincibleTimer > 0) playerInvincibleTimer -= dt;
            if (sobrecargaAtiva) { sobrecargaTimer -= dt; if (sobrecargaTimer <= 0) sobrecargaAtiva = false; }

            // Combo expira depois de COMBO_JANELA sem abater ninguém
            if (comboTimer > 0) {
                comboTimer -= dt;
                if (comboTimer <= 0) esconderCombo();
            }
            } // fim do if(jogoAtivo) do gameplay

            _registrarFrameFps(dtReal); // FPS real (o dt do jogo encolhe em câmera lenta)
            if (jogoAtivo) {
                const _estadoAgora = coletarEstadoPartida();
                if (DEBUG_MODO) atualizarPainelDebug(_estadoAgora);
                if (window.NRTelemetria) window.NRTelemetria.enviar(_estadoAgora);
            }

            // Juice: a nave PISCA enquanto está invencível (depois de tomar dano / reviver)
            shipGroup.visible = !naveDestruida && (!jogoAtivo || playerInvincibleTimer <= 0 || (Math.floor(time * 18) % 2 === 0));

            // Juice: anima faíscas, explosões, anéis, brilho das balas etc.
            JUICE.aposFrame(dt, dtReal, time, { inimigos: enemies, balasJogador: bullets, balasNitro: nitroBullets, balasInimigas: enemyBullets, nave: shipGroup, cristais: cristaisAtivos, powerups: powerupsAtivos });

            nexusPosicionarBarra(); // barra Nexus acompanha a nave (fora do if(jogoAtivo) pra não ficar congelada em pausas)

            renderer.render(scene, camera);
        }
        animate();

        // ── 9. RESPONSIVIDADE ─────────────────────────────────────────
        window.addEventListener('resize', () => {
            const w = getGameWidth(), h = getGameHeight();
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });