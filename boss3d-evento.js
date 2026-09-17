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

        // Painel de debug — mesma ideia do boss3d.js (ver comentário lá).
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
        const shootSound = new Audio('error_004.ogg');
        shootSound.volume = 0.75;
        const enemyDeathSound = new Audio('minimize_006.ogg');
        enemyDeathSound.volume = 0.5;
        function tocarSom(audio) {
            // clona o elemento de áudio pra permitir tocar sobreposto (tiro
            // rápido em sequência), senão cada novo play() corta o anterior
            try { const s = audio.cloneNode(); s.volume = audio.volume; s.play().catch(() => {}); } catch (e) { /* autoplay bloqueado antes da 1ª interação — ignora */ }
        }

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
        };

        function createFighterShip() {
            // Escolhe o modelo pelo naveAtual salvo — "vanguard" (peças
            // customizáveis) ainda não foi portada, cai na padrão por ora
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
            camera.position.set(
                shipGroup.position.x * 0.4, // câmera acompanha só parcialmente o X (mais estável, menos "enjoo")
                CAMERA_ALTURA_BASE + shipState.y * CAMERA_FOLLOW_Y,
                shipGroup.position.z + CAMERA_OFFSET.z
            );
            camera.lookAt(
                shipGroup.position.x * 0.4,
                MIRA_ALTURA_BASE + shipState.y * CAMERA_FOLLOW_Y,
                shipGroup.position.z + CAMERA_LOOKAHEAD.z
            );
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
            tocarSom(shootSound);
            if (jogadorPowerup === 'TRIPLE') {
                shootBullet(-0.55); shootBullet(0); shootBullet(0.55);
            } else {
                shootBullet(0);
            }
        }

        const shootBtnEl = document.getElementById('shootBtn');
        shootBtnEl.addEventListener('touchstart', e => { e.preventDefault(); firing = true; shootBtnEl.classList.add('firing'); }, { passive: false });
        shootBtnEl.addEventListener('touchend', e => { e.preventDefault(); firing = false; shootBtnEl.classList.remove('firing'); }, { passive: false });
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
        const CRISTAL_CORES = [0x00ffff, 0xff2266, 0xffff00]; // 0=energia(ciano) 1=vida(vermelho) 2=pontos(amarelo)
        const cristaisAtivos = [];
        function spawnCristais(pos, isBoss) {
            const qtd = isBoss ? 6 : (Math.random() < 0.5 ? 3 : 4); // igual ao "drops" real
            for (let i = 0; i < qtd; i++) {
                const tipo = Math.floor(Math.random() * 3);
                const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: CRISTAL_CORES[tipo] }));
                mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.6));
                scene.add(mesh);
                // Velocidade inicial (unidades/segundo) — deriva lateral leve
                // + vem em direção à nave (vz positivo), igual à ideia do
                // vx/vy do 2D real, só que aqui vz é quem "traz" o cristal
                cristaisAtivos.push({
                    mesh, tipo, vida: 14, rotSpeed: 2 + Math.random() * 2,
                    vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 3 + Math.random() * 2),
                });
            }
        }

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
        // Conferi o código-fonte a fundo: as JOIAS (loja.js) têm bônus
        // definidos (getBonusJoia) mas esse bônus NUNCA é somado aos stats
        // do jogador em lugar nenhum do boss.js real — só afeta o desenho
        // da nave (visual). Ou seja, joia hoje é cosmética na prática, não
        // um bug meu — é assim no jogo real também. Portei fielmente isso.
        const NAVES_REAIS = {
            // Mesma curva do catálogo da loja (loja.js) e do boss3d.js
            // normal — ver comentário lá pra explicação completa.
            padrao:  { dmgMult: 1.0, spdBonus: 0,   hpBonus: 0,   cor: 0x00ffff },
            striker: { dmgMult: 1.4, spdBonus: 0.6, hpBonus: 60,  cor: 0xff6600 },
            crimson: { dmgMult: 1.9, spdBonus: 0,   hpBonus: 150, cor: 0xff2244 },
            warbat:  { dmgMult: 2.6, spdBonus: 0.4, hpBonus: 280, cor: 0x8800ff },
            cyer:    { dmgMult: 3.6, spdBonus: 0.8, hpBonus: 450, cor: 0x00ff88 },
            spectre: { dmgMult: 5.0, spdBonus: 0.5, hpBonus: 650, cor: 0xffffff },
        };
        // "vanguard" (peças customizáveis) ainda não foi portada — cai na
        // padrão por enquanto, com aviso no console pra não confundir
        const _naveIdSalva = localStorage.getItem('naveAtual') || 'padrao';
        if (_naveIdSalva === 'vanguard') console.warn('NRDados 3D: nave Vanguard (peças customizáveis) ainda não portada — usando stats padrão');
        const bonusNave = NAVES_REAIS[_naveIdSalva] || NAVES_REAIS.padrao;

        // Joia equipada — no 2D real ela NÃO afeta stats (só visual), mas
        // você pediu pra fazer valer de verdade aqui no 3D. Mesmos 4 tipos
        // e valores reais da loja (getBonusJoia em loja.js), só que agora
        // realmente somados ao bônus da nave.
        const JOIAS_REAIS = {
            joia_preta:    { dmgMult: 0.4 },
            joia_roxa:     { spdBonus: 1.2 },
            joia_pink:     { hpBonus: 60 },
            joia_vermelha: { dmgMult: 0.2, hpBonus: 30 },
        };
        function getBonusJoiaEquipada() {
            try {
                const joiasEquipadas = JSON.parse(localStorage.getItem('joiasEquipadas') || '{}');
                const joiaId = joiasEquipadas[_naveIdSalva];
                return (joiaId && JOIAS_REAIS[joiaId]) || {};
            } catch (e) { return {}; }
        }
        const bonusJoia = getBonusJoiaEquipada();
        // Bônus final = nave + joia somados
        const dmgMultTotal = bonusNave.dmgMult + (bonusJoia.dmgMult || 0);
        const spdBonusTotal = bonusNave.spdBonus + (bonusJoia.spdBonus || 0);
        const hpBonusTotal = bonusNave.hpBonus + (bonusJoia.hpBonus || 0);
        // DANO_JOGADOR virou função — precisa considerar a SOBRECARGA do
        // mercado negro (3.4x por 9s), que pode ligar/desligar durante a
        // partida. Multiplicador pedido: 3.4x (o 2D real usa 2.3x).
        function calcularDanoJogador() {
            return 1 * dmgMultTotal * (sobrecargaAtiva ? 3.4 : 1.0);
        }
        // Fator de resposta do controle "direto" (perseguir o alvo) — o
        // 2D usa p.speed=4+spdBonus pra aceleração; aqui adapto pro nosso
        // sistema de lerp, mantendo a MESMA proporção relativa entre naves
        const FATOR_MOVIMENTO = 0.15 * (1 + spdBonusTotal * 0.15);

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

        function atualizarHpBar() { elHpFill.style.width = Math.max(0, playerHp / playerMaxHp * 100) + '%'; }
        function atualizarScore() { elScore.textContent = String(score).padStart(6, '0'); }
        function atualizarWave() { elWave.textContent = 'ONDA ' + wave; }
        function atualizarMoedas() { elMoedas.textContent = '◈ ' + moedas; }
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
            escudoMesh3D.position.set(0, 0, -5.6); // flutua na frente da nave, de onde vêm os tiros
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

        function sofrerDano(qtd) {
            if (playerInvincibleTimer > 0) return;
            if (escudoHp > 0) {
                const absorvido = Math.min(escudoHp, qtd);
                escudoHp -= absorvido;
                qtd -= absorvido;
                atualizarEscudoBar();
            }
            if (qtd <= 0) { playerInvincibleTimer = 1.0; return; } // escudo absorveu tudo
            playerHp = Math.max(0, playerHp - qtd);
            playerInvincibleTimer = 1.0;
            atualizarHpBar();
            if (playerHp <= 0) encerrarPartida();
        }

        let jogoAtivo = true; // vira false na tela de Game Over/Vitória — pausa o gameplay, mas cena/câmera continuam rendendo atrás da tela

        window.pausarJogoPorModeracao = function () { jogoAtivo = false; };

        function encerrarPartida() {
            if (!jogoAtivo) return; // já encerrado, evita disparar 2x
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

            score += reward * combo;
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
                // Mesmo gatilho real: só na 2ª onda, só uma vez por partida
                if (wave === 2 && !mercadoUsado) { mercadoUsado = true; setTimeout(abrirMercadoNegro, 600); }
            }

            atualizarScore(); atualizarMoedas(); atualizarEnergyBar();
            verificarMissoesNitro();
        }

        function usarBomba() {
            if (bombs <= 0) return;
            bombs--;
            atualizarBombCount();
            // Bomba limpa a tela: destrói todos os inimigos em cena de uma vez
            // (contra um boss também funciona — mata ele igual a qualquer inimigo)
            [...enemies].forEach(en => {
                matarOuRessuscitar(en);
            });
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
            return (Number(localStorage.getItem('nivelDesbloqueado_mapa' + mapa)) || 1) > nivel;
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
        function criarNitroMesh() {
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
        function atualizarNitro(dt) {
            if (!NITRO3D.ativo || !NITRO3D.mesh) return;
            // Offset fixo ao lado da nave (igual ao 2D real — velocidadeOrbita
            // é 0 lá, o NITRO não chega a girar de verdade)
            NITRO3D.mesh.position.set(shipGroup.position.x + 1.3, shipGroup.position.y + 0.2, shipGroup.position.z - 0.6);
            NITRO3D.mesh.userData.anel.rotation.z += dt * 1.2;

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
                        en.hp -= calcularDanoJogador();
                        en.hitFlashTimer = 0.12;
                        atingiu = true;
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

        renderer.domElement.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; onTouchStart(t.clientX, t.clientY); }, { passive: false });
        renderer.domElement.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; onTouchMove(t.clientX, t.clientY); }, { passive: false });
        renderer.domElement.addEventListener('touchend', e => { e.preventDefault(); onTouchEnd(); }, { passive: false });

        // Suporte a mouse/teclado só pra testar no navegador do PC
        renderer.domElement.addEventListener('mousedown', e => onTouchStart(e.clientX, e.clientY));
        renderer.domElement.addEventListener('mousemove', e => { if (touching) onTouchMove(e.clientX, e.clientY); });
        window.addEventListener('mouseup', onTouchEnd);

        // ── 8. LOOP PRINCIPAL ─────────────────────────────────────────
        const clock = new THREE.Clock();
        let elapsedTime = 0; // controlado manualmente pra não chamar getDelta() duas vezes por frame (getElapsedTime já faz isso internamente)

        let _painelDebugEl = null;
        if (DEBUG_MODO) {
            _painelDebugEl = document.createElement('div');
            _painelDebugEl.id = 'painelDebug';
            _painelDebugEl.style.cssText = 'position:fixed;top:6px;left:6px;z-index:99999;background:rgba(0,0,0,0.75);color:#0f0;font-family:monospace;font-size:11px;line-height:1.5;padding:8px 10px;border-radius:6px;border:1px solid #0f0;white-space:pre;pointer-events:none;max-width:70vw;';
            document.body.appendChild(_painelDebugEl);
        }

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

        // Mesma função do boss3d.js normal — ver comentário lá pra
        // explicação completa (calcula uma vez, alimenta painel local E
        // telemetria pro Firebase, nunca ficam com números diferentes).
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
                    radarInimigos.push([Math.round(en.mesh.position.x * 10) / 10, Math.round(en.mesh.position.y * 10) / 10, Math.ceil(en.hp), 0]);
                }
            });

            const danoPorTiro = calcularDanoJogador();
            const cooldownAtual = jogadorPowerup === 'RAPID' ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN_NORMAL;
            const dps = danoPorTiro / cooldownAtual;
            const ttk = hpTotalTela > 0 ? Number((hpTotalTela / dps).toFixed(1)) : 0;
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
                evento: true,
                jogadorPos: [Math.round(shipGroup.position.x * 10) / 10, Math.round(shipGroup.position.y * 10) / 10],
                radar: radarInimigos,
            };
        }

        function atualizarPainelDebug(estado) {
            if (!_painelDebugEl) return;
            _painelDebugEl.textContent =
                `[DEBUG][EVENTO] Mapa${estado.mapa} NV${estado.nivel}  wave=${estado.wave}  fps=${estado.fps}\n` +
                `Nave: dano/tiro=${estado.danoPorTiro}  dps=${estado.dps}\n` +
                `HP jogador: ${estado.hpAtual}/${estado.hpMax}\n` +
                `Tela: ${estado.qtdInimigos} inimigo(s)  dano_total=${estado.danoTotalTela}  hp_total=${estado.hpTotalTela}  TTK~${estado.ttk}s  HTD~${estado.htd}\n` +
                `Boss: ${estado.bossNome ? `${estado.bossNome}  hp=${estado.bossHp}/${estado.bossHpMax}  danoBala=${estado.bossDanoBala}` : 'nenhum'}`;
        }

        function animate() {
            requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05); // trava dt máximo pra evitar saltos se o app pausar
            elapsedTime += dt;
            const time = elapsedTime;

            if (jogoAtivo) {
            // Modo direto: persegue o alvo (mesmo fator 0.15 do boss.js)
            if (modoControle === 'direto' && touching) {
                shipState.x += (targetX - shipState.x) * FATOR_MOVIMENTO;
                shipState.y += (targetY - shipState.y) * FATOR_MOVIMENTO;
            }

            shipGroup.position.x = shipState.x;
            shipGroup.position.y = shipState.y;

            // Inclinação da nave ao virar — mesma ideia do protótipo do Gemini,
            // agora calculada pela diferença de posição em vez da velocidade X pura
            const inclinacaoAlvo = (targetX - shipState.x) * -0.3;
            shipGroup.rotation.z = THREE.MathUtils.lerp(shipGroup.rotation.z, modoControle === 'direto' ? inclinacaoAlvo : 0, 0.15);

            // Leve flutuação vertical (vida na nave parada)
            shipGroup.position.y += Math.sin(time * 4) * 0.04;
            } // fim do if(jogoAtivo) do controle da nave

            atualizarCamera();

            // Movimento das estrelas (sensação de voo pra frente)
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
            for (let i = 0; i < starCount; i++) {
                positions[i * 3 + 2] += starVelocities[i];
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

            if (jogoAtivo) {
            // ── Tiro do jogador (mantém pressionado o botão ⚡) ──────
            shootCooldownTimer -= dt;
            if (firing && shootCooldownTimer <= 0) {
                dispararTiroJogador();
                shootCooldownTimer = jogadorPowerup === 'RAPID' ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN_NORMAL;
            }

            // ── Atualiza balas do jogador + colisão com inimigos ─────
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.position.z -= BULLET_SPEED * 60 * dt;
                b.position.x += (b.userData.vx || 0) * 60 * dt; // só o TRIPLE tem desvio lateral
                let atingiu = false;

                for (let j = enemies.length - 1; j >= 0; j--) {
                    const en = enemies[j];
                    if (b.position.distanceTo(en.mesh.position) < (en.hitRadius || ENEMY_HIT_RADIUS)) {
                        en.hp -= calcularDanoJogador();
                        en.hitFlashTimer = 0.12;
                        atingiu = true;
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
            tickFormacao(dt);

            atualizarInimigos(dt); // porta a movimentação/tiro/colisão corpo-a-corpo dos inimigos (inimigos3d.js)
            atualizarNitro(dt);
            atualizarTirosNitro(dt);


            // ── Atualiza balas inimigas + colisão com o jogador ──────
            // ENEMY_BULLET_HOMING controla quão forte a bala curva atrás
            // da nave a cada segundo — 0 = reta (como o 2D original),
            // valores maiores = curva mais rápido e é mais difícil de
            // desviar. Ajuste esse número livremente pra calibrar.
            const ENEMY_BULLET_HOMING = 4.5;
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eb = enemyBullets[i];

                // Vira a direção da bala gradualmente rumo à posição atual da nave
                const direcaoAtual = new THREE.Vector3().subVectors(shipGroup.position, eb.position).normalize();
                eb.userData.dir.lerp(direcaoAtual, Math.min(1, ENEMY_BULLET_HOMING * dt)).normalize();
                eb.position.addScaledVector(eb.userData.dir, ENEMY_BULLET_SPEED * 60 * dt);
                eb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eb.userData.dir);

                eb.userData.vida -= dt;

                if (eb.position.distanceTo(shipGroup.position) < 1.1) {
                    // Igual ao 2D real: com SHIELD ativo, o tiro é bloqueado
                    // em vez de causar dano (o hurtPlayer nem é chamado)
                    if (jogadorPowerup !== 'SHIELD') {
                        // Bala de inimigo comum carrega o dano exato da spec
                        // de balanceamento (eb.userData.dano, setado em
                        // inimigos3d-evento.js na hora do tiro). Balas de
                        // boss não têm esse campo ainda — cai pra fórmula
                        // antiga por wave.
                        sofrerDano(eb.userData.dano != null ? eb.userData.dano : (17 + wave * 2));
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
                if (c.mesh.position.distanceTo(shipGroup.position) < 1.3) {
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
                    jogadorPowerup = pu.tipo;
                    jogadorPowerupTimer = POWERUP_DURACAO;
                    mostrarAvisoBoss(pu.tipo + ' ATIVADO'); // reaproveita o toast do boss pro mesmo tipo de aviso
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

            _registrarFrameFps(dt);
            if (jogoAtivo) {
                const _estadoAgora = coletarEstadoPartida();
                if (DEBUG_MODO) atualizarPainelDebug(_estadoAgora);
                if (window.NRTelemetria) window.NRTelemetria.enviar(_estadoAgora);
            }

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
