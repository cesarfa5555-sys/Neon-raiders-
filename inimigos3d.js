// ════════════════════════════════════════════════════════════════
// INIMIGOS3D.JS — visual/catálogo/formações/boss dos inimigos.
// Carrega ANTES de boss3d.js (mesma ordem do jogo 2D real:
// inimigos-boss.js antes de boss.js) porque boss3d.js chama funções
// definidas aqui (tickFormacao, atualizarInimigos, destruirInimigo)
// de dentro do loop principal do jogo.
// ════════════════════════════════════════════════════════════════

        // ── 6.5 VARIEDADE DE INIMIGOS ─────────────────────────────────
        // LOTE 1 de 4 — 10 dos 38 tipos reais do ENEMY_TYPES (inimigos-
        // boss.js), com hp/velocidade/recompensa/tamanho/cadência/bala
        // EXATOS do 2D. scout/drone/viper/razor usam sprite (scoutImg
        // etc.) no 2D — como não tenho acesso a essas imagens aqui, criei
        // silhuetas 3D novas na mesma cor/classe. tank/heavy/bomber/
        // phantom/ghost/elite têm desenho vetorial real no 2D — esses
        // foram traduzidos fielmente da forma (hexágono, diamante,
        // estrela pulsante, etc.).
        function createEnemyScout(color) {
            const group = new THREE.Group();
            const geo = new THREE.ConeGeometry(0.35, 1.3, 4);
            geo.rotateX(-Math.PI / 2);
            group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.3 })));
            const finGeo = new THREE.BoxGeometry(0.9, 0.05, 0.4);
            const fin = new THREE.Mesh(finGeo, new THREE.MeshBasicMaterial({ color }));
            fin.position.z = 0.35;
            group.add(fin);
            return group;
        }
        function createEnemyDrone(color) {
            const group = new THREE.Group();
            const matCorpo = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
            const matPink = new THREE.MeshBasicMaterial({ color: 0xff33ff });
            group.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.5), matCorpo));
            const wingGeo = new THREE.BoxGeometry(0.3, 1.5, 1.2);
            const wingL = new THREE.Mesh(wingGeo, matCorpo);
            wingL.position.set(-0.7, 0.5, 0); wingL.rotation.z = -0.3;
            group.add(wingL);
            const wingR = new THREE.Mesh(wingGeo, matCorpo);
            wingR.position.set(0.7, 0.5, 0); wingR.rotation.z = 0.3;
            group.add(wingR);
            const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), matPink);
            eye.position.set(0, 0, -0.76);
            group.add(eye);
            return group;
        }
        function createEnemyViper(color) {
            const group = new THREE.Group();
            const geo = new THREE.BoxGeometry(0.5, 0.4, 2.0);
            group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 })));
            const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            nose.rotation.x = -Math.PI / 2;
            nose.position.z = -1.1;
            group.add(nose);
            return group;
        }
        function createEnemyRazor(color) {
            // Lâmina angular fina — 2 cones opostos achatados formando um losango comprido
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.7 });
            const frente = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 4), mat);
            frente.rotation.x = -Math.PI / 2; frente.position.z = -0.5;
            group.add(frente);
            const tras = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 4), mat);
            tras.rotation.x = Math.PI / 2; tras.position.z = 0.4;
            group.add(tras);
            group.scale.set(1, 0.5, 1); // achatado, tipo lâmina
            return group;
        }
        function createEnemyTank(color) {
            // Corpo largo + 2 blocos laterais + cockpit escuro — mesma
            // composição do draw() real (fillRect corpo + 2 laterais + cockpit)
            const group = new THREE.Group();
            const matCorpo = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
            group.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.6), matCorpo));
            const lateralGeo = new THREE.BoxGeometry(0.5, 0.7, 0.5);
            const matLateral = new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.6 });
            const latL = new THREE.Mesh(lateralGeo, matLateral); latL.position.x = -1.2; group.add(latL);
            const latR = new THREE.Mesh(lateralGeo, matLateral); latR.position.x = 1.2; group.add(latR);
            const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x1a0800 }));
            cockpit.position.y = 0.6;
            group.add(cockpit);
            return group;
        }
        function createEnemyHeavy(color) {
            // Hexágono com núcleo escuro — mesma forma do draw() real (6 lados)
            const group = new THREE.Group();
            const hexGeo = new THREE.CylinderGeometry(1, 1, 0.5, 6);
            hexGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(hexGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 })));
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), new THREE.MeshBasicMaterial({ color: 0x252525 }));
            nucleo.position.z = 0.3;
            group.add(nucleo);
            return group;
        }
        function createEnemyBomber(color) {
            // Esfera + anel externo + núcleo escuro — mesma forma do draw() real
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.3 })));
            const anel = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color }));
            group.add(anel);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            nucleo.position.z = 0.6;
            group.add(nucleo);
            return group;
        }
        function createEnemyPhantom(color) {
            // Estrela de 6 pontas semitransparente, pulsando — mesma forma
            // do draw() real (hexagrama com alpha oscilando)
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 / 6) * i;
                const r = i % 2 === 0 ? 1 : 0.5;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
            }
            shape.closePath();
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
            group.userData.matPulsante = mat; // referência pra animar a opacidade no loop
            return group;
        }
        function createEnemyGhost(color) {
            // Blob arredondado semitransparente, pulsando — aproximação da
            // forma orgânica (arco + curvas) do draw() real
            const group = new THREE.Group();
            const geo = new THREE.SphereGeometry(0.85, 12, 10);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.scale.set(1, 1.15, 0.8);
            group.add(mesh);
            group.userData.matPulsante = mat;
            return group;
        }
        function createEnemyElite(color) {
            // Diamante (losango) + camada interna translúcida — mesma
            // composição do draw() real (losango externo + losango interno)
            const group = new THREE.Group();
            const geo = new THREE.OctahedronGeometry(1, 0);
            group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.6 })));
            const interno = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
            group.add(interno);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1a0800 }));
            group.add(nucleo);
            return group;
        }

        // ── LOTE 2 — 10 novos tipos: 5 exclusivos do Mapa 2 (gelo) e 5 do
        // Mapa 3 (fogo). Igual ao lote 1: forma vetorial real traduzida
        // fielmente quando o 2D tinha draw() próprio (todos esses têm).
        // cor: null no catálogo — em vez de uma cor fixa, esses tipos usam
        // a cor do MAPA atual (temaMapa.cor), já que são exclusivos de um
        // mapa só — é isso que você pediu ("cada inimigo da cor do mapa").
        function createEnemyCryo(cor) {
            const group = new THREE.Group();
            const hexGeo = new THREE.CylinderGeometry(1, 1, 0.4, 6);
            hexGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(hexGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.2, metalness: 0.3 })));
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
            nucleo.position.z = 0.25;
            group.add(nucleo);
            return group;
        }
        function createEnemyFrostDrone(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 14), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3 })));
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i;
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0x003344 }));
                dot.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.7);
                group.add(dot);
            }
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xaaffff, transparent: true, opacity: 0.6 }));
            nucleo.position.z = 0.8;
            group.add(nucleo);
            return group;
        }
        function createEnemyPulse(cor) {
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const r = i % 2 === 0 ? 1 : 0.5;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
            }
            shape.closePath();
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7 });
            group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }), mat));
            group.userData.matPulsante = mat;
            return group;
        }
        function createEnemyGlacier(cor) {
            const group = new THREE.Group();
            const halo = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.35 }));
            group.add(halo);
            const hexGeo = new THREE.CylinderGeometry(1, 1, 0.5, 6);
            hexGeo.rotateX(Math.PI / 2);
            const hex = new THREE.Mesh(hexGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.25, metalness: 0.4 }));
            hex.position.z = 0.1;
            group.add(hex);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshBasicMaterial({ color: 0x004466 }));
            nucleo.position.z = 0.35;
            group.add(nucleo);
            return group;
        }
        function createEnemyIceSpike(cor) {
            const group = new THREE.Group();
            const geo = new THREE.ConeGeometry(0.5, 2.0, 4);
            geo.rotateX(-Math.PI / 2);
            group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cor })));
            const geo2 = new THREE.ConeGeometry(0.25, 1.1, 4);
            geo2.rotateX(-Math.PI / 2);
            const interno = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55 }));
            interno.position.z = -0.15;
            group.add(interno);
            return group;
        }
        function createEnemyInferno(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 14), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.35 })));
            const orbitais = [];
            for (let i = 0; i < 6; i++) {
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.55 }));
                group.add(dot);
                orbitais.push(dot);
            }
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1a0000 }));
            group.add(nucleo);
            group.userData.orbitais = orbitais; // gira em volta do corpo (ver atualizarInimigos)
            return group;
        }
        function createEnemyEmber(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10), new THREE.MeshBasicMaterial({ color: cor })));
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.55 }));
            nucleo.position.z = 0.4;
            group.add(nucleo);
            return group;
        }
        function createEnemyBlaze(cor) {
            const group = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({ color: cor });
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i;
                const petala = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 4), mat);
                petala.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0);
                petala.rotation.z = a - Math.PI / 2;
                group.add(petala);
            }
            return group;
        }
        function createEnemyVulcan(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.0), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5 })));
            const turre = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x660000, roughness: 0.5 }));
            turre.position.y = 1.0;
            group.add(turre);
            for (let i = -1; i <= 1; i++) {
                const cano = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6 }));
                cano.position.set(i * 0.5, -0.9, 0);
                group.add(cano);
            }
            return group;
        }
        // Silhueta de chama/pássaro (usada pelo inimigo phoenix E reaproveitada
        // no boss FLAME-X, só maior) — via Shape com curvas bezier, igual à
        // forma real do draw() do 2D
        function criarSilhuetaChama(cor, corInterna) {
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            shape.moveTo(0, -1.2);
            shape.bezierCurveTo(0.8, -0.4, 0.6, 0.4, 0, 0.8);
            shape.bezierCurveTo(-0.6, 0.4, -0.8, -0.4, 0, -1.2);
            const mat = new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide });
            group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat));
            const shapeInterna = new THREE.Shape();
            shapeInterna.moveTo(0, -0.6);
            shapeInterna.bezierCurveTo(0.4, -0.2, 0.3, 0.3, 0, 0.5);
            shapeInterna.bezierCurveTo(-0.3, 0.3, -0.4, -0.2, 0, -0.6);
            const interna = new THREE.Mesh(new THREE.ShapeGeometry(shapeInterna), new THREE.MeshBasicMaterial({ color: corInterna, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
            interna.position.z = 0.05;
            group.add(interna);
            return group;
        }
        function createEnemyPhoenix(cor) { return criarSilhuetaChama(cor, 0xffdd00); }

        // Catálogo real — hp/reward/size/cor/shootIntMs/bSize são os
        // valores EXATOS do ENEMY_TYPES do 2D. "size" (raio em px no 2D)
        // vira escala 3D (dividido por 20, o tamanho do drone = referência
        // 1.0). shootIntMs é o intervalo entre tiros; bSize é o tamanho
        // da bala (também usado pra escalar o projétil 3D).
        // ── LOTE 3 — 5 novos tipos exclusivos do Mapa 4 (sombrio)
        function createEnemyShade(cor) {
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            shape.moveTo(0, -1); shape.lineTo(0.6, 0.5); shape.lineTo(0, 0.2); shape.lineTo(-0.6, 0.5); shape.closePath();
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
            group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat));
            group.userData.matPulsante = mat;
            return group;
        }
        function createEnemyWraith(cor) {
            const group = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
            const capa = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat);
            capa.rotation.x = Math.PI;
            group.add(capa);
            group.userData.matPulsante = mat;
            return group;
        }
        function createEnemyMirror(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 })));
            const brilho = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
            group.add(brilho);
            return group;
        }
        function createEnemyDarkTwin(cor) {
            const group = new THREE.Group();
            const geo = new THREE.ConeGeometry(0.8, 1.4, 3);
            geo.rotateX(Math.PI);
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.75 });
            group.add(new THREE.Mesh(geo, mat));
            group.userData.matPulsante = mat;
            return group;
        }
        function createEnemyVoidShade(cor) {
            const group = new THREE.Group();
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7 }));
            group.add(nucleo);
            const anel1 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5 }));
            const anel2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.35 }));
            group.add(anel1, anel2);
            group.userData.matPulsante = nucleo.material;
            group.userData.gruposGirando = [anel1, anel2];
            return group;
        }

        // ── LOTE 4 — 5 novos tipos exclusivos do Mapa 5 (robótico)
        function createEnemyMech(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.9), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4, metalness: 0.5 })));
            const bracoGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
            const bracoMat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4, metalness: 0.5 });
            const bL = new THREE.Mesh(bracoGeo, bracoMat); bL.position.x = -1.1; group.add(bL);
            const bR = new THREE.Mesh(bracoGeo, bracoMat); bR.position.x = 1.1; group.add(bR);
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.15), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            visor.position.set(0, 0.5, 0.5);
            group.add(visor);
            return group;
        }
        function createEnemyTurret(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.6), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5 })));
            const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0x223344 }));
            cano.rotation.x = Math.PI / 2;
            cano.position.z = 0.8;
            group.add(cano);
            return group;
        }
        function createEnemyDroneMk2(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 14), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3 })));
            const orbitais = [];
            for (let i = 0; i < 4; i++) {
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                group.add(dot);
                orbitais.push(dot);
            }
            group.userData.orbitais = orbitais;
            return group;
        }
        function createEnemyBulldozer(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.2), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 })));
            const trilhoGeo = new THREE.BoxGeometry(0.35, 1.8, 1.0);
            const trilhoMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
            const tL = new THREE.Mesh(trilhoGeo, trilhoMat); tL.position.x = -1.2; group.add(tL);
            const tR = new THREE.Mesh(trilhoGeo, trilhoMat); tR.position.x = 1.2; group.add(tR);
            return group;
        }
        function createEnemyNanobots(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.2), new THREE.MeshBasicMaterial({ color: cor })));
            const anel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 6, 16), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5 }));
            group.add(anel);
            return group;
        }

        // ── LOTE 5 — 6 novos tipos exclusivos do Mapa 6 (void/caos) — os últimos, fecha os 38
        function createEnemyRift(cor) {
            const group = new THREE.Group();
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshBasicMaterial({ color: cor }));
            group.add(nucleo);
            const orbitais = [];
            for (let i = 0; i < 3; i++) {
                const anel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7 }));
                group.add(anel);
                orbitais.push(anel);
            }
            group.userData.orbitais = orbitais;
            return group;
        }
        function createEnemyChaosDrone(cor) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3 })));
            const orbitais = [];
            for (let i = 0; i < 3; i++) {
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0x220022 }));
                group.add(dot);
                orbitais.push(dot);
            }
            group.userData.orbitais = orbitais;
            return group;
        }
        function createEnemyOmegaDrone(cor) {
            const group = new THREE.Group();
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), new THREE.MeshBasicMaterial({ color: cor }));
            group.add(nucleo);
            const anel1 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6 }));
            const anel2 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.4 }));
            group.add(anel1, anel2);
            group.userData.gruposGirando = [anel1, anel2];
            return group;
        }
        function createEnemyCorrupted(cor) {
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i;
                const r = i % 2 === 0 ? 1 : 0.55;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
            }
            shape.closePath();
            group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3 })));
            return group;
        }
        function createEnemySingularity(cor) {
            const group = new THREE.Group();
            const gruposGirando = [];
            for (let ring = 1; ring <= 3; ring++) {
                const anel = new THREE.Mesh(new THREE.TorusGeometry(ring * 0.32, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6 }));
                group.add(anel);
                gruposGirando.push(anel);
            }
            group.userData.gruposGirando = gruposGirando;
            return group;
        }
        function createEnemyVoidWalker(cor) {
            const group = new THREE.Group();
            const geo = new THREE.ConeGeometry(0.7, 1.4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6 });
            group.add(new THREE.Mesh(geo, mat));
            group.userData.matPulsante = mat;
            return group;
        }

        function createEnemySwarm(cor) {
            // Minúsculo e rápido — esfera pequena com 2 "olhos" escuros
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10), new THREE.MeshBasicMaterial({ color: cor })));
            const olhoGeo = new THREE.SphereGeometry(0.28, 6, 6);
            const olhoMat = new THREE.MeshBasicMaterial({ color: 0x1a1000 });
            const oL = new THREE.Mesh(olhoGeo, olhoMat); oL.position.set(0.35, 0.35, 0.7); group.add(oL);
            const oR = new THREE.Mesh(olhoGeo, olhoMat); oR.position.set(-0.35, 0.35, 0.7); group.add(oR);
            return group;
        }
        function createEnemyVoid(cor) {
            // 3 anéis concêntricos alternando rotação + núcleo escuro — mesma composição do draw() real
            const group = new THREE.Group();
            const gruposGirando = [];
            for (let ring = 1; ring <= 3; ring++) {
                const anel = new THREE.Mesh(new THREE.TorusGeometry(ring * 0.35, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5 }));
                group.add(anel);
                gruposGirando.push(anel);
            }
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            group.add(nucleo);
            group.userData.gruposGirando = gruposGirando;
            return group;
        }

        const ENEMY_CATALOGO = [
            { chave: 'scout',   hp: 3,  reward: 5,  size: 15, cor: 0xff6688, shootIntMs: 190, bSize: 4, criar: createEnemyScout },
            { chave: 'drone',   hp: 4,  reward: 5,  size: 20, cor: 0xff4466, shootIntMs: 200, bSize: 5, criar: createEnemyDrone },
            { chave: 'viper',   hp: 5,  reward: 8, size: 23, cor: 0x00ff88, shootIntMs: 160, bSize: 5, criar: createEnemyViper },
            { chave: 'razor',   hp: 6,  reward: 8, size: 27, cor: 0x00ccff, shootIntMs: 150, bSize: 5, criar: createEnemyRazor },
            { chave: 'tank',    hp: 15, reward: 22, size: 22, cor: 0xffaa00, shootIntMs: 90,  bSize: 9, criar: createEnemyTank },
            { chave: 'heavy',   hp: 12, reward: 19, size: 20, cor: 0xffcc00, shootIntMs: 100, bSize: 8, criar: createEnemyHeavy },
            { chave: 'bomber',  hp: 20, reward: 35, size: 24, cor: 0x00ffaa, shootIntMs: 80,  bSize: 10, criar: createEnemyBomber },
            { chave: 'phantom', hp: 9,  reward: 15, size: 16, cor: 0xcc00ff, shootIntMs: 120, bSize: 6, criar: createEnemyPhantom },
            { chave: 'ghost',   hp: 8,  reward: 13, size: 15, cor: 0x9955ff, shootIntMs: 130, bSize: 5, criar: createEnemyGhost },
            { chave: 'elite',   hp: 18, reward: 29, size: 18, cor: 0xff5500, shootIntMs: 85,  bSize: 8, criar: createEnemyElite },
            { chave: 'swarm',   hp: 1,  reward: 35,  size: 9,  cor: 0xffe000, shootIntMs: 300, bSize: 3, criar: createEnemySwarm },
            { chave: 'void',    hp: 24, reward: 550, size: 20, cor: 0x00eeff, shootIntMs: 75,  bSize: 9, criar: createEnemyVoid },
            // ── Mapa 2 (Glacial) — exclusivos, cor = cor do mapa
            { chave: 'cryo',        hp: 6,  reward: 16, size: 14, cor: null, shootIntMs: 140, bSize: 5,  criar: createEnemyCryo },
            { chave: 'frost_drone', hp: 7,  reward: 17, size: 15, cor: null, shootIntMs: 130, bSize: 5,  criar: createEnemyFrostDrone },
            { chave: 'pulse',       hp: 7,  reward: 19, size: 13, cor: null, shootIntMs: 120, bSize: 5,  criar: createEnemyPulse },
            { chave: 'glacier',     hp: 28, reward: 50, size: 26, cor: null, shootIntMs: 95,  bSize: 11, criar: createEnemyGlacier },
            { chave: 'ice_spike',   hp: 5,  reward: 15, size: 11, cor: null, shootIntMs: 300, bSize: 4,  criar: createEnemyIceSpike },
            // ── Mapa 3 (Infernal) — exclusivos, cor = cor do mapa
            { chave: 'inferno', hp: 22, reward: 49, size: 23, cor: null, shootIntMs: 85,  bSize: 10, criar: createEnemyInferno },
            { chave: 'ember',   hp: 3,  reward: 10,  size: 9,  cor: null, shootIntMs: 250, bSize: 3,  criar: createEnemyEmber },
            { chave: 'blaze',   hp: 8,  reward: 28, size: 12, cor: null, shootIntMs: 200, bSize: 6,  criar: createEnemyBlaze },
            { chave: 'vulcan',  hp: 18, reward: 44, size: 21, cor: null, shootIntMs: 100, bSize: 10, criar: createEnemyVulcan },
            { chave: 'phoenix', hp: 14, reward: 42, size: 16, cor: null, shootIntMs: 110, bSize: 6,  criar: createEnemyPhoenix },
            // ── Mapa 4 (Sombrio) — exclusivos, cor = cor do mapa
            { chave: 'shade',      hp: 10, reward: 43, size: 14, cor: null, shootIntMs: 110, bSize: 6, criar: createEnemyShade },
            { chave: 'wraith',     hp: 7,  reward: 35, size: 13, cor: null, shootIntMs: 125, bSize: 5, criar: createEnemyWraith },
            { chave: 'mirror',     hp: 9,  reward: 37, size: 14, cor: null, shootIntMs: 130, bSize: 5, criar: createEnemyMirror },
            { chave: 'dark_twin',  hp: 11, reward: 47, size: 14, cor: null, shootIntMs: 115, bSize: 6, criar: createEnemyDarkTwin },
            { chave: 'void_shade', hp: 13, reward: 51, size: 15, cor: null, shootIntMs: 105, bSize: 6, criar: createEnemyVoidShade },
            // ── Mapa 5 (Robótico) — exclusivos, cor = cor do mapa
            { chave: 'mech',       hp: 30, reward: 71, size: 26, cor: null, shootIntMs: 70,  bSize: 11, criar: createEnemyMech },
            { chave: 'turret',     hp: 20, reward: 40, size: 18, cor: null, shootIntMs: 45,  bSize: 7,  criar: createEnemyTurret },
            { chave: 'drone_mk2',  hp: 12, reward: 43, size: 18, cor: null, shootIntMs: 95,  bSize: 7,  criar: createEnemyDroneMk2 },
            { chave: 'bulldozer',  hp: 45, reward: 85, size: 30, cor: null, shootIntMs: 200, bSize: 13, criar: createEnemyBulldozer },
            { chave: 'nanobots',   hp: 2,  reward: 7,  size: 7,  cor: null, shootIntMs: 350, bSize: 3,  criar: createEnemyNanobots },
            // ── Mapa 6 (Void/Caos) — exclusivos, cor = cor do mapa — fecha os 38 tipos
            { chave: 'rift',         hp: 20, reward: 73, size: 19, cor: null, shootIntMs: 200, bSize: 8, criar: createEnemyRift },
            { chave: 'chaos_drone',  hp: 9,  reward: 33, size: 13, cor: null, shootIntMs: 105, bSize: 6, criar: createEnemyChaosDrone },
            { chave: 'omega_drone',  hp: 18, reward: 64, size: 17, cor: null, shootIntMs: 90,  bSize: 8, criar: createEnemyOmegaDrone },
            { chave: 'corrupted',    hp: 12, reward: 39, size: 14, cor: null, shootIntMs: 130, bSize: 6, criar: createEnemyCorrupted },
            { chave: 'singularity',  hp: 16, reward: 58, size: 16, cor: null, shootIntMs: 100, bSize: 7, criar: createEnemySingularity },
            { chave: 'void_walker',  hp: 14, reward: 52, size: 15, cor: null, shootIntMs: 115, bSize: 6, criar: createEnemyVoidWalker },
        ];

        const ENEMY_SPAWN_Z = -70;        // profundidade "bem longe", usada pelas entradas vindas de trás
        const ENEMY_HIT_RADIUS = 1.6;     // raio padrão (equivalente a en.size+b.r do 2D) — sobrescrito por tipo
        const ENEMY_TOUCH_RADIUS = 1.4;   // raio de colisão corpo-a-corpo com a nave

        // ── FORMAÇÕES — porta o sistema real de _formacaoAtiva/getFormacaoPositions
        // do inimigos-boss.js. Lá as posições são em pixels de tela (x,y da
        // tela 2D); aqui x continua esquerda/direita, mas o "y de tela"
        // (que no 2D representa distância até o jogador) virou profundidade
        // Z — faz mais sentido, já que é exatamente o que ele significava.
        // A altura (nosso eixo Y de verdade) não existe no 2D, então cada
        // formação sorteia uma altura só sua e todo mundo hover nela.
        //
        // SIMPLIFICAÇÕES assumidas (o 2D real tem 108 combinações por
        // mapa/nível/onda — isso pode ser plugado depois via dados.js):
        // SIMPLIFICAÇÃO restante: quantidade fixa por formação
        // (FORMACAO_QTD), o 2D real varia de 6 a 20 por mapa/nível/onda —
        // isso ainda não foi portado, só o formato em si (ver
        // FORMACOES_POR_MAPA_NIVEL logo abaixo, que já usa a tabela real).
        // ═══════════════════════════════════════════════════════════
        // BALANCEAMENTO_MAPAS — spec aprovada pelo dev (288 formações,
        // 1689 inimigos únicos). Gerado a partir da regra: soma da
        // última formação do nível/mapa anterior +2 = soma da primeira
        // do próximo. Cada formação é [ [nome, dano], ... ] na ordem
        // exata das waves. NÃO conter posição/visual — só nome+dano,
        // por pedido explícito do dev (formação visual vem depois).
        // ═══════════════════════════════════════════════════════════
        const BALANCEAMENTO_MAPAS = {
            1: {
                1: [
                    [["Neon Drone",13], ["Cyber Bug",9], ["Pulse Bot",11]],
                    [["Razor",7], ["Volt",15], ["Byte",12]],
                    [["Shock",5], ["Blaster",13], ["Nano",12]],
                ],
                2: [
                    [["Plasma",14], ["Viper",10], ["Reaper",12]],
                    [["Spark",11], ["Crusher",16], ["Phantom",10]],
                    [["Striker",17], ["Titan",9], ["Glitch",12]],
                    [["Tornor",21], ["GravX",11], ["Wex7",11]],
                ],
                3: [
                    [["Hexclaw",9], ["Nullbyte",11], ["Cryptek",18]],
                    [["Vantor",6], ["Zerion",20], ["Kryvox",13]],
                    [["Dreadcoil",18], ["Synapse-X",18], ["Ravix",4]],
                    [["Vantr-X",11], ["Drix Ith",12], ["Kel 3",20]],
                    [["Zol-OM",17], ["Torn Ex",12], ["Vex-Ith",16]],
                ],
                4: [
                    [["Axiom-7",10], ["Nexvyr",11], ["Corvex",19]],
                    [["Virex",5], ["Oblivion Core",20], ["Xenith",16]],
                    [["Kryntor",11], ["Malvex",14], ["Synkron",17]],
                    [["Ozex Ith",11], ["Fyx-9",23], ["Ozex 9",12]],
                    [["Kel-ON",12], ["Gravus",22], ["Vex 3",17]],
                    [["Skarn On",12], ["Grav-Ith",20], ["Bex-US",22]],
                ],
                5: [
                    [["Vexurion",7], ["Nyrak",17], ["Cyrnox",18]],
                    [["Voltrax",7], ["Kaelith",19], ["Zyphor",17]],
                    [["Dravex",11], ["Xyronis",14], ["Mordyx",19]],
                    [["Kryn-3",10], ["Bex-7",17], ["Skarn Ak",19]],
                    [["Kryn7",15], ["Vantr-EX",17], ["Rax-ON",18]],
                    [["Kel Om",20], ["Rax-YX",19], ["Vex-US",14]],
                    [["Fyx Ak",11], ["Fyx-7",16], ["Vantr X",30]],
                ],
                6: [
                    [["Azrakeon",6], ["Vyrnexis",15], ["Kharvok",23]],
                    [["Nexarion",7], ["Zerakth",19], ["Oxyvane",19]],
                    [["Rhyzok",19], ["Velkrion",16], ["Xandryx",15]],
                    [["Kryn Om",24], ["Bexor",12], ["Vex-ON",17]],
                    [["Drixom",11], ["Bex9",22], ["Ozex-ON",24]],
                    [["Vex Om",18], ["Rax-OR",27], ["Vex 7",15]],
                    [["Wex On",16], ["Ozex Yx",31], ["Skarn Om",16]],
                    [["Drix-OR",17], ["Ozex-US",21], ["Vexyx",28]],
                ],
            },
            2: {
                1: [
                    [["Vor-UM",18], ["Krixor",12], ["Nyx-OK",21], ["Malvum",17]],
                    [["Voss Ic",18], ["Zeph-YN",18], ["Thex Ak",15], ["Orix Or",19]],
                    [["Drazis",17], ["Nyx Av",28], ["Malv Av",16], ["Ozric-IS",14]],
                    [["Skarr-YX",23], ["Kryo-YX",12], ["Drazex",13], ["Malvyn",29]],
                ],
                2: [
                    [["Rynar",25], ["Vantis-EL",12], ["Kael-OK",23], ["Ythan-Ith",19]],
                    [["Drazum",26], ["Grix-AV",21], ["Kaelyn",26], ["Thexel",10]],
                    [["Vantis On",26], ["Solen Ic",23], ["Voror",23], ["Skarr Ar",16]],
                    [["Vor Ar",28], ["Vor Ith",16], ["Skarr-ON",27], ["Skarr Ith",21]],
                    [["Nebral-Ith",28], ["Vantis Yx",20], ["Malv Ar",32], ["Ythan-AK",16]],
                ],
                3: [
                    [["Solen-AK",33], ["Orix Yn",25], ["Fenrix Yn",18], ["Draz Yx",22]],
                    [["Krix Ok",28], ["Fenrix-OK",17], ["Ozric-OR",26], ["Malv-UM",29]],
                    [["Grix-AK",23], ["Solenav",23], ["Orixis",33], ["Thex Um",26]],
                    [["Kaelok",23], ["Nebral Yx",23], ["Nyxex",32], ["Thex-AR",31]],
                    [["Solen Or",22], ["Krix-IC",34], ["Drazok",33], ["Nebral Um",22]],
                    [["Krix Is",31], ["Grix Ok",38], ["Kael-AR",25], ["Kryo Ar",19]],
                ],
                4: [
                    [["Skarr-IS",30], ["Ozric Ar",22], ["Vantis-IS",24], ["Fenrix Or",39]],
                    [["Kael Av",20], ["Voss On",24], ["Nebral-OR",50], ["Rynyn",24]],
                    [["Vossyx",31], ["Nebralav",26], ["Fenrix-OR",18], ["Kael Ith",45]],
                    [["Nyxel",42], ["Krix-UM",21], ["Ythan On",16], ["Fenrixis",43]],
                    [["Vantis Ith",39], ["Kaelis",36], ["Solen-UM",24], ["Vor-EL",28]],
                    [["Kryo Is",30], ["Zephis",30], ["Krix-YX",34], ["Kryo-UM",35]],
                    [["Fenrix-IS",41], ["Orix Ar",31], ["Draz Yn",42], ["Ozric-YN",19]],
                ],
                5: [
                    [["Malvor",44], ["Kael Um",26], ["Draz-IC",45], ["Zeph-OR",20]],
                    [["Nyx-IS",46], ["Zephav",18], ["Krixav",29], ["Kael-Ith",47]],
                    [["Kael Ok",41], ["Rynon",21], ["Vantisel",24], ["Voss-YX",56]],
                    [["Malvar",47], ["Draz-YN",41], ["Kryoak",18], ["Orixyn",40]],
                    [["Zeph Ak",50], ["Voss Ok",22], ["Kaelyx",45], ["Nyx-AV",32]],
                    [["Fenrix Ex",31], ["Draz-OK",28], ["Nebral Ex",66], ["Malv Us",27]],
                    [["Solenon",40], ["Drazav",35], ["Nyxak",54], ["Draz-ON",25]],
                    [["Vorel",38], ["Ozric Is",47], ["Fenrixus",32], ["Malv Is",39]],
                ],
                6: [
                    [["Nebral Av",38], ["Vantis-OK",45], ["Draz-YX",44], ["Zeph Av",31]],
                    [["Voss Ak",48], ["Ythan Ith",20], ["Ozric-OK",43], ["Skarr-US",49]],
                    [["Vor Av",47], ["Krixic",25], ["Thex El",51], ["Vantisor",42]],
                    [["Draz-EL",51], ["Vossyn",30], ["Vor-YX",58], ["Orix-UM",30]],
                    [["Fenrix-Ith",27], ["Ozricus",54], ["Vantis-IC",57], ["Malvith",36]],
                    [["Zeph Yx",39], ["Nebralor",40], ["Kryo-ON",47], ["Thex-YN",51]],
                    [["Zeph-EL",31], ["Ythanyx",44], ["Thex Or",64], ["Voric",42]],
                    [["Malvon",61], ["Vor-IC",31], ["Nebralum",58], ["Vantis Or",36]],
                    [["Fenrix Ok",55], ["Draz-AK",50], ["Orix Ok",35], ["Solen-IS",49]],
                ],
            },
            3: {
                1: [
                    [["Cindra Husk",31], ["Torvex-Frost",50], ["Stormedge",24], ["Velth Frost",22], ["Cindra-Husk",64]],
                    [["Krayth-Ash",54], ["Ashen Fire",22], ["Umbra Fire",51], ["Emberixspire",35], ["Quor Grim",32]],
                    [["Ashen Frost",54], ["Ashen-Claw",56], ["Emberix-Claw",18], ["Frost-Tide",44], ["Umbrastrike",24]],
                    [["Pyrspire",27], ["Emberix Husk",45], ["Torvex Husk",53], ["Krayth-Brand",35], ["Torvex-Strike",41]],
                    [["Umbrafang",63], ["Coraxfrost",40], ["Voidrastrike",26], ["Solstistide",30], ["Torvex-Ash",47]],
                ],
                2: [
                    [["Storm Strike",47], ["Cindra Claw",37], ["Umbra Ash",21], ["Torvex Shard",52], ["Ashentide",51]],
                    [["Solstis Tide",42], ["Glare-Spire",40], ["Torvex-Spire",46], ["Quorfrost",24], ["Storm Spire",58]],
                    [["Krayth Edge",45], ["Torvex-Tide",58], ["Torvex Frost",30], ["Quor-Fang",36], ["Solstis-Ward",45]],
                    [["Pyr Shard",36], ["Ashenfrost",44], ["Nihilclaw",31], ["Umbra-Frost",60], ["Storm-Gale",47]],
                    [["Emberixfrost",59], ["Ignar Ward",28], ["Corax Tide",50], ["Cindrashard",32], ["Torvexgale",54]],
                    [["Voidra-Gale",25], ["Solstis-Claw",36], ["Umbra Edge",61], ["Rax-Fang",52], ["Raxgrim",51]],
                ],
                3: [
                    [["Krayth Brand",33], ["Torvexedge",41], ["Umbra-Spire",56], ["Ignar-Shard",58], ["Emberixgrim",39]],
                    [["Ignar-Ash",36], ["Velth-Spire",37], ["Ignar Gale",38], ["Frostfrost",64], ["Rax-Husk",57]],
                    [["Stormclaw",56], ["Froststrike",67], ["Quor Shard",52], ["Glare-Claw",27], ["Nihil Ash",35]],
                    [["Emberix Shard",73], ["Rax Brand",55], ["Wrathe-Ash",27], ["Frost-Husk",26], ["Quor-Tide",59]],
                    [["Corax Husk",49], ["Glare-Strike",48], ["Blizkash",53], ["Voidra Ash",25], ["Storm-Brand",69]],
                    [["Glareedge",47], ["Voidra Strike",59], ["Frostward",60], ["Storm-Ash",35], ["Corax-Husk",48]],
                    [["Ignar Spire",71], ["Ashen Tide",50], ["Wrathe Ash",32], ["Solstisfrost",50], ["Pyrfire",51]],
                ],
                4: [
                    [["Wrathe-Fire",73], ["Nihil Claw",37], ["Voidra-Frost",71], ["Emberix-Tide",30], ["Quor-Edge",45]],
                    [["Frost-Grim",44], ["Storm Grim",48], ["Emberix Fire",56], ["Solstis-Tide",56], ["Glare-Ward",56]],
                    [["Emberix-Ward",35], ["Ignar Ash",33], ["Glare Claw",62], ["Umbra Frost",71], ["Ashen Ward",63]],
                    [["Blizk-Claw",42], ["Nihil Frost",85], ["Solstisash",45], ["Cindra Grim",43], ["Velth-Fire",54]],
                    [["Wrathe Tide",49], ["Wrathe-Gale",53], ["Quoredge",51], ["Rax Frost",55], ["Frostbrand",65]],
                    [["Ignar Shard",49], ["Voidra-Grim",59], ["Solstis-Spire",71], ["Corax-Brand",68], ["Voidra Fire",30]],
                    [["Frostfang",66], ["Frostgrim",49], ["Torvex Fang",77], ["Pyrgale",53], ["Storm Husk",37]],
                    [["Velth-Gale",32], ["Emberix-Gale",64], ["Glareshard",30], ["Solstis Husk",81], ["Ashen-Gale",77]],
                ],
                5: [
                    [["Blizkfang",86], ["Nihil-Strike",67], ["Umbra Tide",35], ["Wrathe Husk",60], ["Frost-Strike",38]],
                    [["Frost Fire",52], ["Cindra Fire",51], ["Kraythstrike",99], ["Kraythbrand",38], ["Torvex-Gale",49]],
                    [["Voidra-Spire",55], ["Blizk-Shard",55], ["Corax Fire",65], ["Cindra Ash",52], ["Krayth-Edge",66]],
                    [["Kraythedge",30], ["Voidrafrost",57], ["Voidra-Fire",71], ["Pyrash",74], ["Solstis Shard",64]],
                    [["Ashengrim",102], ["Solstis Fire",55], ["Wrathespire",44], ["Cindra Strike",48], ["Glare-Husk",49]],
                    [["Raxfrost",90], ["Blizk Spire",34], ["Storm-Ward",66], ["Wratheclaw",78], ["Rax-Grim",34]],
                    [["Nihil-Ward",62], ["Torvex-Shard",62], ["Corax-Edge",79], ["Umbraash",50], ["Glare Ward",53]],
                    [["Frost-Frost",41], ["Blizk-Edge",48], ["Velth Grim",65], ["Emberix-Strike",86], ["Blizkbrand",70]],
                    [["Velth-Grim",70], ["Rax-Brand",38], ["Glare-Fire",56], ["Quor-Strike",65], ["Quor-Gale",84]],
                ],
                6: [
                    [["Cindragrim",61], ["Pyrclaw",71], ["Solstis Fang",70], ["Quor-Ash",74], ["Rax-Tide",39]],
                    [["Solstis-Husk",73], ["Solstis-Shard",88], ["Pyr Spire",52], ["Quorfire",60], ["Blizk-Ash",44]],
                    [["Ignarshard",89], ["Pyr Frost",73], ["Velth Brand",74], ["Blizk-Strike",46], ["Nihiltide",38]],
                    [["Velth-Fang",64], ["Quorshard",56], ["Kraythhusk",43], ["Wrathe-Spire",97], ["Velth Gale",62]],
                    [["Voidra Grim",84], ["Cindraclaw",63], ["Blizk-Gale",54], ["Ashenclaw",53], ["Solstisgale",72]],
                    [["Ashenshard",83], ["Blizkhusk",77], ["Wrathe-Tide",64], ["Rax-Spire",61], ["Wrathe Frost",44]],
                    [["Blizkstrike",75], ["Krayth-Ward",87], ["Umbrashard",54], ["Ashenspire",74], ["Coraxclaw",42]],
                    [["Pyr-Spire",84], ["Solstis-Gale",54], ["Wrathefang",78], ["Velth-Shard",57], ["Ashen-Brand",63]],
                    [["Ashen-Ash",92], ["Ignar Strike",73], ["Torvex Claw",48], ["Voidraash",74], ["Storm-Grim",51]],
                    [["Blizkfrost",90], ["Voidraward",40], ["Umbra-Husk",37], ["Ignar-Gale",99], ["Rax-Edge",77]],
                ],
            },
            4: {
                1: [
                    [["Xerathsurge",49], ["Dravokspike",65], ["Fervex-Blade",67], ["Zorath Vex",59], ["Wyrnvex",49], ["Rancorgear",56]],
                    [["Fervexhowl",44], ["Duskar Mark",58], ["Kaine Shell",53], ["Obsydrend",50], ["Grimm Cinder",77], ["Xerath-Spike",68]],
                    [["Chrono Mark",48], ["Halonrend",66], ["Rancor-Rend",31], ["Novusgear",42], ["Toxinrend",83], ["Ryzen Fume",84]],
                    [["Vulcrafume",41], ["Dravokcinder",38], ["Chrono-Fume",84], ["Kaine Gear",71], ["Rancor-Zap",49], ["Kaine-Shell",74]],
                    [["Sever-Core",53], ["Obsyd-Howl",55], ["Rancor-Cinder",68], ["Warden-Gear",63], ["Xerathblade",52], ["Zorath-Mark",69]],
                    [["Halon-Vex",63], ["Halon Core",37], ["Vulcra Vex",86], ["Obsyd Surge",76], ["Dravok Surge",45], ["Blight-Mark",55]],
                ],
                2: [
                    [["Novushowl",64], ["Vulcra Drone",74], ["Xerath Core",55], ["Talonspike",93], ["Wyrnspike",46], ["Xerath-Cinder",32]],
                    [["Duskar Gear",57], ["Novus Shell",60], ["Sever Cinder",49], ["Warden-Husk",50], ["Kainezap",38], ["Xerath Gear",113]],
                    [["Xerathhowl",71], ["Grimmmark",77], ["Xerath-Core",74], ["Vulcra-Shell",30], ["Warden Cinder",63], ["Blight Husk",55]],
                    [["Obsydhusk",55], ["Halon Zap",74], ["Toxin Rend",53], ["Wardenblade",82], ["Duskar-Gear",80], ["Talon-Spike",28]],
                    [["Vulcra Howl",36], ["Obsydgear",78], ["Novus Howl",93], ["Blightcore",38], ["Ryzenshell",77], ["Warden Zap",55]],
                    [["Fervexblade",67], ["Chrono-Surge",82], ["Halon-Surge",35], ["Vulcra Surge",46], ["Halon Surge",86], ["Wyrnshell",65]],
                    [["Zorath Husk",63], ["Dravokrend",63], ["Sever-Mark",61], ["Obsydvex",75], ["Chrono Blade",82], ["Severvex",41]],
                ],
                3: [
                    [["Rancor Spike",55], ["Dravok-Blade",74], ["Sever Fume",66], ["Fervex Core",73], ["Chronofume",58], ["Obsydspike",61]],
                    [["Wyrnfume",41], ["Warden Mark",97], ["Rancor-Surge",54], ["Novusspike",47], ["Obsyd Blade",59], ["Wardenhusk",91]],
                    [["Xerathshell",54], ["Dravokhusk",83], ["Zorath Rend",72], ["Ryzen-Zap",83], ["Blightspike",42], ["Kaine Cinder",58]],
                    [["Halon Drone",50], ["Obsyd Drone",78], ["Warden Rend",39], ["Halon Shell",86], ["Vulcradrone",87], ["Fervex Howl",57]],
                    [["Rancorhusk",72], ["Wyrnmark",91], ["Fervex-Howl",35], ["Halon-Cinder",60], ["Vulcra-Fume",85], ["Blight Gear",57]],
                    [["Blight Cinder",60], ["Obsydhowl",91], ["Blightshell",87], ["Talon Cinder",73], ["Rancor Drone",38], ["Wardensurge",54]],
                    [["Vulcracore",66], ["Chrono-Vex",55], ["Blight Spike",72], ["Rancor-Blade",72], ["Chrono Rend",78], ["Halonhowl",62]],
                    [["Warden-Blade",55], ["Chrono Husk",73], ["Wyrn Drone",62], ["Severspike",90], ["Kainehusk",65], ["Chronoblade",64]],
                ],
                4: [
                    [["Wardenzap",41], ["Obsyd Core",88], ["Zorath-Howl",37], ["Vulcrahowl",86], ["Zorath-Vex",76], ["Grimm Gear",83]],
                    [["Warden Vex",113], ["Blightgear",96], ["Talon Mark",50], ["Chronorend",58], ["Zorath Shell",50], ["Ryzengear",47]],
                    [["Kaine Core",63], ["Grimm Shell",88], ["Fervex Zap",60], ["Novus Core",74], ["Xerath Fume",66], ["Wyrngear",66]],
                    [["Sever Mark",49], ["Halondrone",51], ["Kaine-Mark",89], ["Grimm Zap",44], ["Blighthowl",92], ["Sever Core",96]],
                    [["Sever-Drone",78], ["Dravok Drone",69], ["Grimm-Drone",81], ["Rancorrend",73], ["Severzap",61], ["Ryzen-Core",63]],
                    [["Novusvex",90], ["Dravok-Fume",92], ["Kainedrone",52], ["Grimmhusk",42], ["Zorathspike",79], ["Novusshell",75]],
                    [["Talon-Husk",70], ["Novussurge",49], ["Chrono Vex",81], ["Talon Surge",106], ["Kainespike",57], ["Wardencinder",72]],
                    [["Duskar-Drone",92], ["Rancor-Husk",55], ["Talonsurge",59], ["Dravok-Mark",95], ["Fervexfume",51], ["Toxin-Shell",88]],
                    [["Warden Husk",56], ["Severrend",78], ["Rancor Husk",66], ["Duskarsurge",126], ["Zorathfume",50], ["Vulcra-Cinder",68]],
                ],
                5: [
                    [["Taloncinder",79], ["Talon-Fume",83], ["Duskar Core",56], ["Novus-Blade",81], ["Grimmgear",63], ["Xerath-Drone",84]],
                    [["Sever-Howl",47], ["Duskarhowl",74], ["Vulcra Blade",65], ["Xerath-Husk",110], ["Rancorcore",87], ["Wyrn Core",66]],
                    [["Vulcra Rend",52], ["Fervexspike",71], ["Blight-Blade",107], ["Severcore",35], ["Grimm-Gear",103], ["Wyrnhusk",85]],
                    [["Warden Shell",62], ["Wyrn Rend",94], ["Zorath-Surge",83], ["Sever Gear",72], ["Obsydfume",76], ["Zorath-Gear",70]],
                    [["Dravok Howl",48], ["Talon-Blade",71], ["Toxin-Howl",50], ["Chrono Surge",114], ["Novus-Shell",101], ["Warden-Howl",78]],
                    [["Blight-Core",70], ["Grimm-Vex",124], ["Toxinshell",89], ["Chrono Fume",62], ["Ryzen Drone",61], ["Novus-Drone",60]],
                    [["Vulcrablade",77], ["Obsyd Howl",95], ["Kaine Fume",94], ["Novus-Rend",92], ["Duskar Zap",49], ["Sever-Surge",61]],
                    [["Ryzen-Blade",102], ["Rancor Blade",63], ["Wyrn-Shell",75], ["Vulcra-Howl",68], ["Chronosurge",85], ["Xerathdrone",80]],
                    [["Sever-Gear",89], ["Warden Blade",65], ["Ryzenzap",52], ["Dravoksurge",81], ["Vulcrazap",107], ["Rancorspike",81]],
                    [["Ryzen Blade",115], ["Duskar Howl",85], ["Novus Rend",41], ["Novus Drone",42], ["Obsyd Gear",81], ["Vulcragear",114]],
                ],
                6: [
                    [["Chronospike",101], ["Talonzap",81], ["Ryzencinder",43], ["Warden-Surge",100], ["Toxin Zap",102], ["Xerath Blade",53]],
                    [["Halon Mark",47], ["Rancor Shell",48], ["Zorath-Shell",138], ["Toxin-Surge",78], ["Duskar Drone",97], ["Xerath-Blade",76]],
                    [["Grimm Vex",74], ["Duskarshell",100], ["Vulcra Gear",92], ["Wyrn-Spike",80], ["Chrono Spike",82], ["Toxin Howl",59]],
                    [["Halongear",95], ["Vulcraspike",106], ["Ryzen Vex",76], ["Ryzen-Fume",52], ["Novuscore",80], ["Kaine Vex",80]],
                    [["Toxincinder",89], ["Talon-Rend",79], ["Talon Fume",60], ["Xerath-Surge",96], ["Xerath Husk",72], ["Dravok-Drone",96]],
                    [["Blight-Vex",91], ["Duskarblade",73], ["Chrono Cinder",85], ["Obsyd-Fume",71], ["Novusfume",57], ["Toxin Spike",120]],
                    [["Duskarzap",54], ["Obsyd Spike",73], ["Vulcrahusk",61], ["Grimmhowl",133], ["Warden-Rend",106], ["Toxin-Blade",73]],
                    [["Kainevex",71], ["Obsydblade",61], ["Dravokshell",127], ["Duskar-Core",108], ["Xerathgear",71], ["Zorathblade",65]],
                    [["Warden-Mark",65], ["Fervexcore",90], ["Sever Surge",99], ["Fervexmark",112], ["Novus-Howl",96], ["Vulcra Spike",44]],
                    [["Blight-Husk",101], ["Chrono-Cinder",82], ["Halonfume",66], ["Grimm-Fume",101], ["Xerath Cinder",82], ["Wyrnrend",77]],
                    [["Rancor Gear",103], ["Chrono-Zap",56], ["Fervexdrone",81], ["Zorath Howl",102], ["Dravokblade",78], ["Wyrn Spike",94]],
                ],
            },
            5: {
                1: [
                    [["Quellith Gale",66], ["Quellith Ion",50], ["Ragnar Pulse",86], ["Fallox-Warden",52], ["Solvex Prime",61], ["Fallox Ion",92], ["Kaldur Pulse",109]],
                    [["Eryndorgale",87], ["Bastir-Ion",57], ["Bastir-Bane",46], ["Devast Forge",45], ["Devastcrest",91], ["Luminar Might",96], ["Kaldur-Gale",99]],
                    [["Luminarseal",43], ["Iskar-Wrath",75], ["Iskar-Prime",112], ["Bastir-Crest",70], ["Iskar-Reach",95], ["Havokspark",80], ["Paragon-Gale",50]],
                    [["Jarrow-Pulse",74], ["Paragon-Ion",50], ["Quellith-Spark",78], ["Nekrosdawn",94], ["Titaniswarden",87], ["Jarrow Crest",90], ["Eryndorspark",57]],
                    [["Morrik-Spark",96], ["Colos-Warden",55], ["Solvexgaze",107], ["Ragnarcrest",74], ["Eryndor-Gale",45], ["Nekros Prime",65], ["Nekros-Ion",91]],
                    [["Devastseal",78], ["Titanis-Bane",51], ["Aegis-Might",98], ["Iskarforge",56], ["Eryndor Wrath",101], ["Solvex Might",56], ["Aegis-Gaze",98]],
                    [["Aegisprime",106], ["Bastir Warden",44], ["Morrikion",68], ["Quellith Wrath",76], ["Jarrow-Gaze",72], ["Luminar Seal",91], ["Bastir Dawn",84]],
                ],
                2: [
                    [["Havok Reach",86], ["Fallox Spark",96], ["Fallox-Ion",66], ["Titanis-Seal",99], ["Colos-Spark",39], ["Morrik Gaze",59], ["Nekros-Forge",98]],
                    [["Quellithprime",101], ["Falloxspark",92], ["Quellith Reach",75], ["Quellith Gaze",94], ["Solvexion",50], ["Luminar Gale",85], ["Gorathgaze",49]],
                    [["Quellith Dawn",91], ["Luminarcrest",73], ["Aegis-Pulse",75], ["Bastirpulse",117], ["Aegis Pulse",95], ["Gorath-Pulse",61], ["Eryndorcrest",39]],
                    [["Solvex-Prime",86], ["Aegisgale",79], ["Solvex-Ion",77], ["Gorath-Bane",46], ["Ragnar-Spark",43], ["Jarrowspark",116], ["Solvex-Spark",108]],
                    [["Colos-Prime",136], ["Coloswarden",56], ["Devast Wrath",115], ["Devast Pulse",65], ["Havok-Prime",49], ["Gorath-Prime",89], ["Luminarwarden",50]],
                    [["Solvex Warden",80], ["Ragnar Might",70], ["Morrik-Ion",112], ["Aegisdawn",65], ["Havokcrest",110], ["Falloxgaze",49], ["Devastion",79]],
                    [["Paragon-Wrath",110], ["Falloxbane",41], ["Solvex Dawn",82], ["Gorath Gaze",90], ["Bastir Crest",46], ["Morrikmight",94], ["Luminar Prime",107]],
                    [["Devastpulse",63], ["Havok-Crest",64], ["Devastgaze",98], ["Solvex-Wrath",85], ["Paragonspark",93], ["Jarrowseal",71], ["Ragnar Prime",100]],
                ],
                3: [
                    [["Oberon Wrath",36], ["Ragnar Ion",71], ["Oberongaze",90], ["Aegis-Gale",100], ["Aegisseal",100], ["Luminar-Crest",85], ["Paragonwarden",94]],
                    [["Solvexgale",42], ["Gorathwarden",80], ["Falloxseal",113], ["Gorath-Reach",66], ["Jarrow-Ion",82], ["Gorath Bane",87], ["Titanis Gale",108]],
                    [["Oberonseal",110], ["Paragon-Gaze",60], ["Oberonion",106], ["Devast-Bane",42], ["Oberonreach",72], ["Aegis Crest",90], ["Colos-Wrath",103]],
                    [["Ragnar Bane",102], ["Gorathwrath",72], ["Devastgale",53], ["Nekros-Reach",79], ["Iskarspark",106], ["Havok-Warden",73], ["Solvex Wrath",101]],
                    [["Ragnar-Crest",98], ["Solvex-Seal",85], ["Titaniscrest",106], ["Colosspark",83], ["Aegisforge",67], ["Oberonwarden",52], ["Ragnar Crest",98]],
                    [["Eryndor Reach",81], ["Kaldur Gaze",46], ["Quellith-Warden",112], ["Paragon Gale",115], ["Colos-Crest",56], ["Oberon-Might",94], ["Kaldur-Pulse",89]],
                    [["Solvexseal",56], ["Falloxmight",83], ["Nekrospulse",82], ["Titanis-Spark",92], ["Quellith Warden",91], ["Fallox Seal",104], ["Kaldurseal",87]],
                    [["Ragnar-Dawn",55], ["Nekros-Dawn",108], ["Ragnar-Warden",84], ["Luminargaze",86], ["Eryndorreach",108], ["Jarrowwrath",91], ["Nekroswrath",68]],
                    [["Gorath-Gale",78], ["Kaldur Spark",78], ["Titaniswrath",70], ["Paragonprime",122], ["Oberon-Forge",85], ["Luminar-Might",118], ["Aegis-Spark",53]],
                ],
                4: [
                    [["Solvex-Might",128], ["Havok-Gale",97], ["Morrik Bane",60], ["Luminar Gaze",101], ["Gorathpulse",48], ["Nekros Pulse",127], ["Nekros Spark",45]],
                    [["Oberon-Pulse",89], ["Paragongaze",98], ["Aegis-Warden",96], ["Iskarwarden",94], ["Morrikspark",52], ["Luminarion",88], ["Gorathseal",92]],
                    [["Titanisspark",91], ["Solvex-Reach",59], ["Devastprime",120], ["Fallox Reach",66], ["Iskar Pulse",87], ["Gorathbane",54], ["Jarrow Bane",136]],
                    [["Aegision",74], ["Fallox Bane",93], ["Jarrow-Gale",103], ["Bastir-Seal",88], ["Paragon Dawn",97], ["Paragon Gaze",63], ["Eryndor Gaze",99]],
                    [["Jarrow Gaze",55], ["Gorath Reach",95], ["Bastirprime",108], ["Iskarseal",64], ["Nekros-Warden",100], ["Jarrow Wrath",105], ["Kaldur-Warden",93]],
                    [["Ragnardawn",47], ["Iskar Seal",79], ["Solvex-Pulse",125], ["Fallox Wrath",70], ["Havokprime",89], ["Titanis Crest",107], ["Paragonion",108]],
                    [["Colos Ion",56], ["Kaldurwrath",79], ["Nekrosreach",115], ["Colospulse",79], ["Oberongale",73], ["Nekros-Crest",113], ["Solvex-Bane",114]],
                    [["Titanis-Might",72], ["Havok-Bane",75], ["Bastir Forge",131], ["Ragnar-Seal",116], ["Jarrow Pulse",103], ["Havok-Wrath",50], ["Morrik-Seal",85]],
                    [["Havok Spark",123], ["Jarrow-Dawn",138], ["Quellith-Bane",67], ["Aegis-Forge",71], ["Ragnar-Prime",63], ["Colosbane",58], ["Aegis Reach",114]],
                    [["Solvex-Crest",98], ["Morrik Reach",64], ["Gorath-Wrath",82], ["Luminarbane",128], ["Colos-Dawn",67], ["Jarrow Might",71], ["Iskarion",128]],
                ],
                5: [
                    [["Devast-Gaze",115], ["Bastirwrath",65], ["Morrikprime",100], ["Kaldurion",128], ["Oberon-Bane",86], ["Luminardawn",58], ["Morrik-Dawn",88]],
                    [["Colos-Gale",100], ["Oberonpulse",49], ["Colos Spark",146], ["Nekrosseal",71], ["Gorath-Warden",78], ["Eryndor-Might",70], ["Ragnar-Reach",131]],
                    [["Iskarbane",84], ["Eryndorbane",126], ["Havokion",75], ["Devast-Seal",77], ["Ragnarwarden",65], ["Bastirspark",97], ["Titanis-Crest",123]],
                    [["Morrik Forge",61], ["Paragon-Reach",144], ["Iskar-Warden",72], ["Nekros-Prime",110], ["Luminarspark",81], ["Oberonforge",106], ["Morrikwarden",77]],
                    [["Eryndor Might",91], ["Quellith-Seal",80], ["Oberon-Prime",52], ["Morrik-Gale",83], ["Oberon Warden",118], ["Jarrow Reach",122], ["Devast Reach",110]],
                    [["Jarrowwarden",78], ["Paragonforge",160], ["Eryndor Warden",62], ["Eryndor-Prime",72], ["Devast Gaze",79], ["Havok Gale",142], ["Falloxdawn",68]],
                    [["Devast-Pulse",72], ["Luminar Ion",90], ["Eryndor Ion",85], ["Titanis-Ion",134], ["Nekros-Pulse",115], ["Kaldur-Reach",68], ["Oberon-Crest",102]],
                    [["Havok-Forge",103], ["Eryndor Spark",76], ["Oberon-Gaze",61], ["Solvexreach",129], ["Jarrow-Bane",106], ["Paragonbane",82], ["Paragon Prime",114]],
                    [["Iskarprime",70], ["Solvexmight",114], ["Gorath Seal",60], ["Ragnar Gaze",79], ["Iskar Crest",97], ["Fallox-Pulse",124], ["Paragon Reach",129]],
                    [["Kaldurdawn",141], ["Kaldurpulse",74], ["Fallox-Seal",95], ["Jarrowdawn",128], ["Eryndorwarden",134], ["Havok Wrath",59], ["Morrik Pulse",47]],
                    [["Luminar-Warden",111], ["Paragonreach",67], ["Titanisbane",99], ["Quellithseal",118], ["Ragnar-Bane",86], ["Quellith-Forge",102], ["Quellith Pulse",97]],
                ],
                6: [
                    [["Iskar-Pulse",139], ["Titanis-Dawn",60], ["Iskar Gale",137], ["Quellith Crest",87], ["Paragon Warden",52], ["Paragon Wrath",112], ["Bastir Ion",95]],
                    [["Iskar-Ion",140], ["Kaldurwarden",90], ["Titanis Spark",60], ["Kaldur Seal",146], ["Falloxwrath",48], ["Fallox-Reach",145], ["Ragnar Warden",57]],
                    [["Devastwarden",72], ["Iskar Warden",98], ["Morrikreach",61], ["Colos Warden",158], ["Nekrosmight",115], ["Nekrosspark",104], ["Jarrow-Reach",82]],
                    [["Iskar-Gaze",66], ["Titanisdawn",107], ["Paragoncrest",110], ["Coloswrath",141], ["Oberon Ion",93], ["Bastir-Dawn",120], ["Bastir-Warden",55]],
                    [["Falloxcrest",115], ["Kaldurspark",55], ["Bastir Pulse",106], ["Gorathmight",85], ["Quellithwrath",99], ["Havok-Reach",106], ["Devast Seal",128]],
                    [["Havok-Spark",122], ["Quellith Bane",82], ["Iskar-Seal",66], ["Morrik Gale",53], ["Ragnar Dawn",124], ["Jarrowpulse",143], ["Jarrowcrest",109]],
                    [["Oberondawn",62], ["Fallox Dawn",164], ["Quellithdawn",93], ["Ragnarreach",92], ["Luminarpulse",97], ["Ragnar Seal",95], ["Eryndorforge",101]],
                    [["Jarrowgale",95], ["Ragnar Forge",118], ["Havok-Dawn",155], ["Oberon-Warden",53], ["Iskar Prime",66], ["Gorath Warden",153], ["Bastirmight",69]],
                    [["Bastirgale",92], ["Quellith Forge",109], ["Solvex-Gale",136], ["Colos-Might",84], ["Titanisreach",115], ["Oberon Prime",54], ["Falloxprime",121]],
                    [["Devast Prime",114], ["Nekrosprime",137], ["Colos-Ion",66], ["Paragon Seal",72], ["Nekros-Spark",128], ["Colos Crest",123], ["Eryndor Pulse",76]],
                    [["Morrik Spark",129], ["Havok-Might",100], ["Solvex-Dawn",97], ["Ragnarmight",97], ["Falloxwarden",104], ["Havok Seal",64], ["Gorathforge",127]],
                    [["Nekros-Might",71], ["Iskar-Gale",68], ["Luminar Dawn",109], ["Paragon Bane",106], ["Morrik-Reach",162], ["Devastmight",112], ["Paragonpulse",95]],
                ],
            },
            6: {
                1: [
                    [["Cataclys-Abyss",85], ["Karnathos Doom",109], ["Doomrikend",101], ["Malakarnull",120], ["Necrovardoom",66], ["Harrower-Doom",123], ["Harrowerscourge",71], ["Malakar-Null",50]],
                    [["Gehenna End",72], ["Legionyx Abyss",69], ["Forsakenrot",68], ["Harrower-Dread",115], ["Karnathos Dread",116], ["Necrovar-Abyss",62], ["Infernus-Tomb",67], ["Judgethwraith",158]],
                    [["Malakar Fall",96], ["Judgethrot",80], ["Tyrannissin",76], ["Sovereign-Null",118], ["Malakarreign",103], ["Forsaken-Doom",118], ["Karnathos-Reign",75], ["Abyssar Abyss",66]],
                    [["Judgethfall",54], ["Legionyxdoom",139], ["Tyrannisrot",73], ["Tyrannis-Wraith",84], ["Judgethtomb",129], ["Karnathosdread",72], ["Extermin Scourge",113], ["Abyssar Doom",70]],
                    [["Necrovar-Dread",86], ["Extermindread",118], ["Necrovarreign",123], ["Infernus Reign",101], ["Doomrikscourge",84], ["Omegar-Rot",74], ["Omegarend",91], ["Judgethdread",60]],
                    [["Doomrikfall",93], ["Cataclys-Scourge",89], ["Doomriknull",50], ["Judgeth-Rot",108], ["Infernus Null",94], ["Necrovartomb",63], ["Omegar Rot",133], ["Infernus-Ruin",112]],
                    [["Harrower Ruin",43], ["Malakar-Wraith",124], ["Malakar-Void",114], ["Legionyxtomb",117], ["Gehennafall",67], ["Forsakenend",104], ["Reaperin-Reign",73], ["Voidlord Wraith",103]],
                    [["Voidlordvoid",131], ["Tyrannis-Ruin",108], ["Doomrik-Maw",63], ["Behemordread",45], ["Doomrik-Rot",84], ["Infernusmaw",132], ["Reaperindoom",69], ["Judgeth-Null",115]],
                ],
                2: [
                    [["Tyrannisnull",103], ["Abyssar Reign",65], ["Infernus End",56], ["Omegar Reign",115], ["Necrovar Dread",114], ["Karnathos Maw",82], ["Behemorfall",81], ["Reaperinvoid",133]],
                    [["Legionyx Sin",88], ["Malakar Wraith",78], ["Doomrik-Sin",58], ["Infernus Abyss",65], ["Voidlordend",109], ["Forsaken-Sin",121], ["Purgat Dread",153], ["Infernusdread",80]],
                    [["Doomrik-Void",100], ["Harrowerabyss",48], ["Abyssardread",92], ["Malakarrot",111], ["Doomrikrot",112], ["Doomrik Ruin",133], ["Purgat Ruin",110], ["Sovereign Void",51]],
                    [["Tyrannis-End",93], ["Judgeth-Sin",80], ["Sovereignend",75], ["Omegarnull",172], ["Omegar End",73], ["Abyssar-Ruin",96], ["Doomriksin",77], ["Harrower Null",95]],
                    [["Doomrik Tomb",99], ["Gehenna Scourge",45], ["Voidlordscourge",81], ["Forsaken-Ruin",96], ["Extermin-Scourge",126], ["Voidlord-Wraith",101], ["Judgeth-Reign",131], ["Cataclys Doom",86]],
                    [["Purgat-Sin",84], ["Tyrannis-Reign",87], ["Tyrannisvoid",124], ["Exterminvoid",118], ["Malakar Doom",79], ["Infernuswraith",100], ["Harrower-Fall",80], ["Behemor Doom",95]],
                    [["Doomrik-Tomb",130], ["Doomrik Rot",76], ["Gehenna Sin",57], ["Abyssar-Void",57], ["Necrovarruin",88], ["Purgat Abyss",117], ["Purgat Doom",112], ["Legionyxwraith",133]],
                    [["Abyssar-Tomb",60], ["Reaperin Wraith",81], ["Doomrik-Ruin",98], ["Malakar-Dread",81], ["Karnathosfall",170], ["Necrovar-Scourge",80], ["Necrovar-Reign",116], ["Purgat-End",87]],
                    [["Judgeth Wraith",108], ["Sovereignmaw",53], ["Reaperin-Tomb",142], ["Karnathostomb",58], ["Voidlord Maw",78], ["Behemor Sin",59], ["Sovereign End",144], ["Necrovar-Maw",136]],
                ],
                3: [
                    [["Karnathos Reign",106], ["Legionyxnull",107], ["Gehenna-Fall",103], ["Infernussin",52], ["Karnathos-Ruin",116], ["Tyrannisend",114], ["Forsaken-Maw",103], ["Sovereignscourge",79]],
                    [["Reaperintomb",61], ["Behemor-Reign",92], ["Infernus Dread",97], ["Purgat Scourge",133], ["Judgethreign",138], ["Cataclyssin",82], ["Malakar Maw",53], ["Forsaken End",127]],
                    [["Abyssar-Dread",89], ["Gehenna-Tomb",69], ["Omegar Dread",123], ["Forsakenmaw",136], ["Karnathos Null",85], ["Tyrannisfall",110], ["Doomrik-End",84], ["Karnathos-Sin",92]],
                    [["Tyrannis Dread",60], ["Judgeth Fall",159], ["Tyrannis-Tomb",79], ["Gehenna Fall",108], ["Judgethdoom",99], ["Reaperinmaw",73], ["Gehenna-Rot",137], ["Malakar-Scourge",75]],
                    [["Purgat-Void",123], ["Forsakenwraith",135], ["Sovereignsin",66], ["Karnathos Wraith",147], ["Cataclysnull",128], ["Legionyx Rot",57], ["Malakar Reign",58], ["Voidlord Rot",78]],
                    [["Cataclysruin",66], ["Harrower-Void",81], ["Doomrik Doom",102], ["Tyrannisdread",95], ["Legionyx-Fall",87], ["Forsaken Reign",109], ["Judgeth Maw",124], ["Exterminmaw",131]],
                    [["Extermin Doom",139], ["Tyrannis Null",96], ["Infernus-Reign",106], ["Cataclysdoom",120], ["Abyssar Null",82], ["Tyrannis-Null",65], ["Gehennareign",66], ["Doomrikreign",126]],
                    [["Behemor-End",76], ["Exterminabyss",135], ["Abyssar Wraith",77], ["Malakar Void",90], ["Gehennavoid",151], ["Malakar-Sin",144], ["Necrovar-Fall",52], ["Infernus Scourge",80]],
                    [["Karnathosscourge",101], ["Gehenna Reign",125], ["Sovereignreign",138], ["Sovereign Abyss",69], ["Doomrik-Dread",58], ["Abyssar Sin",135], ["Cataclys-Tomb",76], ["Omegar-Ruin",108]],
                    [["Exterminrot",120], ["Doomrik Reign",118], ["Judgeth Dread",146], ["Karnathos-Wraith",74], ["Abyssarnull",83], ["Purgat-Abyss",70], ["Karnathos-Doom",113], ["Extermin-Ruin",90]],
                ],
                4: [
                    [["Cataclys-Reign",85], ["Exterminsin",83], ["Forsaken-Reign",125], ["Doomrikdread",110], ["Necrovarrot",97], ["Necrovarvoid",79], ["Reaperin-Doom",129], ["Cataclys-End",108]],
                    [["Forsakensin",71], ["Harrower Rot",129], ["Cataclys Rot",128], ["Legionyxabyss",99], ["Reaperin-Fall",141], ["Abyssarruin",135], ["Forsaken-Dread",61], ["Cataclys-Ruin",56]],
                    [["Reaperin-Sin",118], ["Judgeth Doom",92], ["Purgat Fall",67], ["Doomrik Sin",61], ["Extermin Abyss",124], ["Reaperin-Wraith",104], ["Sovereigndread",122], ["Forsaken Doom",135]],
                    [["Karnathos End",132], ["Abyssar-End",135], ["Legionyxend",96], ["Behemorruin",117], ["Malakar-Tomb",71], ["Doomrik-Null",122], ["Purgatdoom",61], ["Infernus-Dread",92]],
                    [["Necrovarscourge",111], ["Omegar-Wraith",66], ["Karnathos Void",132], ["Legionyx Scourge",104], ["Abyssar Maw",118], ["Cataclys-Fall",124], ["Legionyx-Sin",89], ["Extermintomb",86]],
                    [["Harrowerend",95], ["Forsaken Rot",148], ["Cataclysreign",149], ["Abyssartomb",149], ["Extermin-End",88], ["Omegar-Null",61], ["Karnathos-Null",68], ["Judgeth Scourge",77]],
                    [["Necrovardread",120], ["Forsakenvoid",123], ["Legionyx Dread",125], ["Abyssar-Wraith",59], ["Voidlordwraith",120], ["Necrovar Reign",100], ["Tyrannis Tomb",67], ["Behemor Fall",123]],
                    [["Harrower Reign",64], ["Extermin-Void",144], ["Harrowersin",53], ["Exterminend",115], ["Abyssarfall",112], ["Purgat-Fall",119], ["Tyrannisscourge",115], ["Cataclysabyss",120]],
                    [["Necrovar-Tomb",118], ["Abyssar-Reign",145], ["Judgeth Ruin",132], ["Judgethend",56], ["Malakarvoid",97], ["Necrovar-Wraith",109], ["Cataclysscourge",135], ["Infernus Maw",53]],
                    [["Forsaken Abyss",149], ["Reaperin Ruin",54], ["Purgatabyss",135], ["Tyrannisabyss",93], ["Infernusabyss",56], ["Extermin-Rot",118], ["Harrower Maw",112], ["Infernus-Doom",133]],
                    [["Behemor-Maw",96], ["Tyrannis Abyss",94], ["Legionyx-Abyss",69], ["Tyrannis Maw",129], ["Purgatreign",76], ["Gehenna Void",85], ["Tyrannis-Maw",123], ["Forsaken-Null",180]],
                ],
                5: [
                    [["Judgethsin",163], ["Malakar-Maw",113], ["Malakar-End",70], ["Purgatwraith",79], ["Harrower End",157], ["Voidlord Reign",112], ["Abyssar Void",58], ["Legionyx Tomb",102]],
                    [["Abyssarrot",133], ["Infernus-Rot",97], ["Purgat Rot",147], ["Infernusruin",107], ["Gehenna-Ruin",82], ["Sovereign Maw",101], ["Omegar Abyss",110], ["Judgethscourge",79]],
                    [["Tyrannisreign",132], ["Legionyxfall",70], ["Necrovar Sin",108], ["Gehenna Doom",116], ["Behemor-Wraith",78], ["Legionyx Reign",74], ["Gehenna-Maw",129], ["Omegarfall",154]],
                    [["Karnathossin",89], ["Legionyx-Doom",67], ["Gehenna Tomb",117], ["Gehenna-Dread",144], ["Reaperindread",133], ["Legionyx Null",140], ["Harrower Scourge",100], ["Karnathosdoom",73]],
                    [["Reaperin-End",66], ["Harrower Fall",81], ["Purgatnull",108], ["Behemor-Doom",100], ["Infernus-Abyss",67], ["Infernusrot",135], ["Doomrik-Reign",149], ["Omegarscourge",161]],
                    [["Sovereign Tomb",84], ["Sovereign-Sin",108], ["Voidlord Void",147], ["Legionyx Void",170], ["Reaperin Tomb",107], ["Cataclys Void",113], ["Behemor-Tomb",75], ["Abyssar Scourge",66]],
                    [["Cataclys Dread",125], ["Sovereign-Wraith",112], ["Abyssar-Fall",117], ["Necrovarfall",97], ["Omegarmaw",96], ["Malakar-Fall",155], ["Behemor Tomb",77], ["Necrovar-Null",93]],
                    [["Forsaken Null",102], ["Legionyx-Scourge",152], ["Extermin Maw",111], ["Omegar-Doom",112], ["Gehenna-Doom",76], ["Voidlordtomb",98], ["Reaperin Void",101], ["Voidlord Scourge",122]],
                    [["Malakar Rot",80], ["Judgethabyss",151], ["Forsaken Maw",106], ["Forsakenabyss",82], ["Necrovar Void",121], ["Voidlord Fall",109], ["Judgeth-Maw",126], ["Doomrik Abyss",102]],
                    [["Necrovar Wraith",80], ["Infernusscourge",116], ["Behemor-Void",102], ["Gehennaabyss",106], ["Reaperin-Scourge",143], ["Cataclyswraith",154], ["Harrower-Scourge",74], ["Forsaken-Rot",106]],
                    [["Reaperin Rot",84], ["Purgat-Wraith",119], ["Malakar-Doom",90], ["Purgat-Doom",96], ["Voidlordnull",143], ["Sovereign Scourge",68], ["Gehenna-Scourge",156], ["Cataclys Abyss",130]],
                    [["Forsaken-Fall",112], ["Extermin-Fall",107], ["Sovereignruin",139], ["Harrower Dread",80], ["Karnathos Rot",129], ["Legionyx Ruin",127], ["Legionyxmaw",73], ["Purgatend",121]],
                ],
                6: [
                    [["Karnathos-Rot",129], ["Sovereignfall",69], ["Karnathos Scourge",124], ["Infernus-Maw",126], ["Omegar Doom",162], ["Doomrik Null",114], ["Reaperin-Abyss",76], ["Doomrik-Abyss",90]],
                    [["Omegar Fall",165], ["Forsaken-End",90], ["Extermin Tomb",71], ["Legionyxvoid",74], ["Omegar-End",191], ["Forsakennull",73], ["Harrower-Sin",91], ["Karnathos-Void",139]],
                    [["Gehennadread",125], ["Omegar-Tomb",107], ["Malakar-Abyss",143], ["Behemorscourge",104], ["Voidlord-Scourge",54], ["Reaperinrot",144], ["Tyrannis-Fall",144], ["Voidlordabyss",75]],
                    [["Cataclys-Maw",92], ["Abyssarscourge",96], ["Sovereign-End",133], ["Gehenna-Abyss",98], ["Infernus-Scourge",149], ["Necrovar End",131], ["Sovereign Wraith",145], ["Tyrannis-Doom",55]],
                    [["Karnathos Sin",129], ["Abyssar-Maw",94], ["Harrower-End",166], ["Cataclys Sin",92], ["Tyrannis-Sin",89], ["Legionyx Maw",130], ["Extermin-Abyss",87], ["Tyrannis Doom",114]],
                    [["Gehenna-Void",166], ["Voidlordreign",108], ["Necrovar-Rot",78], ["Abyssar Ruin",88], ["Reaperin Fall",82], ["Voidlord Sin",122], ["Extermin Rot",126], ["Doomrikmaw",135]],
                    [["Gehenna Dread",88], ["Reaperinwraith",161], ["Extermin-Tomb",124], ["Omegar-Dread",158], ["Extermin Reign",71], ["Karnathosend",81], ["Malakardoom",131], ["Voidlord-Sin",95]],
                    [["Gehennawraith",76], ["Gehennascourge",162], ["Legionyx-Wraith",60], ["Harrower Tomb",157], ["Tyrannis Fall",108], ["Infernus Fall",89], ["Behemor-Fall",170], ["Exterminnull",90]],
                    [["Voidlord-Fall",81], ["Forsakenreign",99], ["Purgatvoid",103], ["Behemordoom",82], ["Extermin Ruin",200], ["Doomrikabyss",130], ["Infernusdoom",87], ["Behemorwraith",132]],
                    [["Legionyxscourge",84], ["Malakarwraith",152], ["Sovereign Reign",106], ["Gehennaend",114], ["Infernusnull",116], ["Necrovar Scourge",145], ["Voidlord Ruin",137], ["Reaperin Doom",63]],
                    [["Infernus Sin",94], ["Harrower-Wraith",159], ["Purgat-Ruin",60], ["Behemor Ruin",92], ["Omegar-Scourge",157], ["Sovereign Ruin",75], ["Cataclys Ruin",158], ["Malakar Dread",126]],
                    [["Karnathos Tomb",120], ["Forsaken Wraith",77], ["Purgatruin",156], ["Karnathosnull",85], ["Harrowerrot",157], ["Tyrannisruin",115], ["Malakarruin",90], ["Malakar Sin",126]],
                    [["Omegar Null",66], ["Cataclys-Rot",174], ["Harrowerwraith",83], ["Abyssarsin",155], ["Doomrik Fall",169], ["Sovereignwraith",117], ["Legionyx Wraith",80], ["Extermin-Reign",84]],
                ],
            },
        };

        // Quantidade de waves (=formações) por mapa/nível, e quantidade
        // fixa de inimigos por formação em cada mapa — direto da spec.
        const WAVES_POR_NIVEL = {
            1: [3, 4, 5, 6, 7, 8],
            2: [4, 5, 6, 7, 8, 9],
            3: [5, 6, 7, 8, 9, 10],
            4: [6, 7, 8, 9, 10, 11],
            5: [7, 8, 9, 10, 11, 12],
            6: [8, 9, 10, 11, 12, 13],
        };
        const INIMIGOS_POR_FORMACAO_MAPA = {1:3, 2:4, 3:5, 4:6, 5:7, 6:8};
        const FORMACAO_TIPOS = ['linha', 'v', 'quadrado', 'triangulo', 'circulo', 'diamante', 'cruz']; // as 7 formas-base (referência)
        // FORMACAO_QTD não é mais usado pra decidir quantidade — agora
        // vem de INIMIGOS_POR_FORMACAO_MAPA[mapaAtual] (3 a 8, direto da
        // spec de balanceamento). Mantido só como valor de referência.
        const FORMACAO_QTD = 7;
        const FORMACAO_Z_BASE = -22;          // profundidade onde a formação fica parada
        const FORMACAO_ENTRY_DURATION = 1.3;  // segundos pra completar a curva de entrada
        const FORMACAO_SPAWN_DELAY = 0.28;    // intervalo entre cada inimigo entrando

        // Retorna {x, y} — y é um DESLOCAMENTO de altura a partir do centro
        // da formação (não profundidade). Antes cada formato variava em Z,
        // fazendo inimigos ficarem atrás uns dos outros; agora todo mundo
        // fica na MESMA profundidade (parede plana de frente pra nave) e o
        // formato se desenha empilhando em altura.
        function getFormacaoPosicoes(tipo, qtd) {
            const positions = [];
            if (tipo === 'linha') {
                const esp = 3.0;
                for (let i = 0; i < qtd; i++) positions.push({ x: (i - (qtd - 1) / 2) * esp, y: 0 });

            } else if (tipo === 'v') {
                const metade = Math.floor(qtd / 2);
                for (let i = 0; i < qtd; i++) {
                    const lado = i < metade ? -1 : 1;
                    const idx = i < metade ? i : i - metade;
                    positions.push({ x: lado * (idx + 1) * 2.4, y: idx * 1.9 });
                }

            } else if (tipo === 'quadrado') {
                const cols = Math.ceil(Math.sqrt(qtd)), rows = Math.ceil(qtd / cols);
                let count = 0;
                for (let r = 0; r < rows && count < qtd; r++)
                    for (let c = 0; c < cols && count < qtd; c++, count++)
                        positions.push({ x: (c - (cols - 1) / 2) * 2.4, y: (r - (rows - 1) / 2) * 2.1 });

            } else if (tipo === 'triangulo') {
                let count = 0, row = 0, perRow = 1;
                while (count < qtd) {
                    for (let c = 0; c < perRow && count < qtd; c++, count++)
                        positions.push({ x: (c - (perRow - 1) / 2) * 2.25, y: -row * 2.0 });
                    row++; perRow++;
                }

            } else if (tipo === 'circulo') {
                const raio = 3.2;
                for (let i = 0; i < qtd; i++) {
                    const ang = (Math.PI * 2 / qtd) * i - Math.PI / 2;
                    positions.push({ x: Math.cos(ang) * raio, y: Math.sin(ang) * raio * 0.7 });
                }

            } else if (tipo === 'diamante') {
                const lados = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];
                const porLado = Math.ceil(qtd / 4);
                let count = 0;
                for (let l = 0; l < 4 && count < qtd; l++)
                    for (let i = 0; i < porLado && count < qtd; i++, count++) {
                        const t = i / porLado;
                        const x1 = lados[l].dx * 3.8, y1 = lados[l].dy * 3.2;
                        const x2 = lados[(l + 1) % 4].dx * 3.8, y2 = lados[(l + 1) % 4].dy * 3.2;
                        positions.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
                    }

            } else { // cruz
                const metade = Math.floor(qtd / 2);
                for (let i = 0; i < metade; i++) positions.push({ x: (i - metade / 2) * 2.7 + 1.4, y: 0 });
                for (let i = 0; i < qtd - metade; i++) positions.push({ x: 0, y: (i - (qtd - metade) / 2) * 2.1 });
            }
            // Com a quantidade agora variando de 3 (Mapa 1) a 8 (Mapa 6) por
            // formação — antes era sempre 7 fixo — os formatos com
            // espaçamento fixo (linha, v, cruz) podem ficar mais largos que
            // a área de voo da nave (VOO.xMin/xMax = ±4.2) quando qtd é
            // grande. Em vez de mexer no espaçamento de cada formato um por
            // um, comprime o conjunto inteiro proporcionalmente (preserva o
            // formato, só encolhe) se a largura final passar do limite.
            const LARGURA_MAX_FORMACAO = 9; // um pouco além do dobro de VOO.xMax — a formação fica mais longe da nave (Z bem negativo), então pode ser um pouco mais larga que a área de voo sem sair da tela
            const maiorX = positions.reduce((m, p) => Math.max(m, Math.abs(p.x)), 0);
            if (maiorX > LARGURA_MAX_FORMACAO) {
                const fator = LARGURA_MAX_FORMACAO / maiorX;
                positions.forEach(p => { p.x *= fator; p.y *= fator; });
            }
            return positions;
        }

        // Curva de entrada: metade entra pela esquerda, metade pela direita,
        // e 1 a cada 4 entra vindo de bem longe (Z profundo) — igual à
        // proporção do gerarRotaEntrada() original. Z final é sempre
        // FORMACAO_Z_BASE (constante) — só a altura (Y) varia por formato.
        function gerarRotaEntrada(indice, total) {
            const metade = total / 2;
            let startX, startZ, ctrlX, ctrlZ;
            if (indice < metade) {
                startX = VOO.xMin - 3; startZ = FORMACAO_Z_BASE + (indice / metade) * 2 - 1;
                ctrlX = VOO.xMin * 0.4; ctrlZ = FORMACAO_Z_BASE + (Math.random() - 0.5) * 2;
            } else {
                startX = VOO.xMax + 3; startZ = FORMACAO_Z_BASE + ((indice - metade) / metade) * 2 - 1;
                ctrlX = VOO.xMax * 0.4; ctrlZ = FORMACAO_Z_BASE + (Math.random() - 0.5) * 2;
            }
            if (indice % 4 === 0) {
                startX = (Math.random() - 0.5) * 6;
                startZ = ENEMY_SPAWN_Z;
                ctrlX = startX * 0.6;
                ctrlZ = (startZ + FORMACAO_Z_BASE) / 2;
            }
            return { startX, startZ, ctrlX, ctrlZ };
        }

        // ── MODO BALANCEAMENTO (pedido explícito do dev) ────────────────
        // Enquanto true: inimigo comum nasce parado, sem curva de entrada
        // nem oscilação — foi usado só pra testar dano/HP/waves isolado do
        // movimento. Desligado agora que o balanceamento numérico foi
        // validado — a lógica continua toda aqui embaixo, é só virar pra
        // true de novo se precisar isolar de novo no futuro.
        const BALANCEAMENTO_MODO_TESTE = false;

        // Estado da formação atual
        let formacaoAtiva = false;
        let formacaoFila = [];
        let formacaoIndice = 0;
        let formacaoTotal = 0;
        let formacaoSpawnTimer = 0;
        let formacaoTipoInimigo = null; // uma formação inteira usa 1 só tipo de inimigo, igual ao 2D
        let formacaoAltura = 0;         // altura (eixo Y) compartilhada por toda a formação
        let formacaoDadosBalanceamento = []; // [{nome, dano}, ...] — vem de BALANCEAMENTO_MAPAS, na ordem exata da spec

        // Tabela real do 2D (FORMACOES em inimigos-boss.js): cada mapa/nível
        // só pode sortear entre 3 formatos específicos, não os 7 todos —
        // é isso que dá a variedade real de "108 combinações" (6 mapas ×
        // 6 níveis × 3 opções), mesmo usando as mesmas 7 formas-base.
        const FORMACOES_POR_MAPA_NIVEL = {
            1: { 1: ['linha', 'v', 'quadrado'], 2: ['v', 'quadrado', 'triangulo'], 3: ['quadrado', 'triangulo', 'linha'], 4: ['triangulo', 'linha', 'v'], 5: ['v', 'triangulo', 'quadrado'], 6: ['quadrado', 'v', 'triangulo'] },
            2: { 1: ['circulo', 'linha', 'v'], 2: ['v', 'circulo', 'triangulo'], 3: ['triangulo', 'circulo', 'quadrado'], 4: ['circulo', 'quadrado', 'v'], 5: ['quadrado', 'circulo', 'triangulo'], 6: ['circulo', 'triangulo', 'quadrado'] },
            3: { 1: ['triangulo', 'v', 'circulo'], 2: ['v', 'diamante', 'triangulo'], 3: ['diamante', 'triangulo', 'circulo'], 4: ['circulo', 'diamante', 'v'], 5: ['triangulo', 'circulo', 'diamante'], 6: ['diamante', 'circulo', 'triangulo'] },
            4: { 1: ['diamante', 'quadrado', 'circulo'], 2: ['quadrado', 'diamante', 'cruz'], 3: ['cruz', 'diamante', 'quadrado'], 4: ['diamante', 'cruz', 'circulo'], 5: ['cruz', 'circulo', 'diamante'], 6: ['circulo', 'cruz', 'diamante'] },
            5: { 1: ['cruz', 'quadrado', 'diamante'], 2: ['quadrado', 'cruz', 'circulo'], 3: ['circulo', 'cruz', 'diamante'], 4: ['diamante', 'circulo', 'cruz'], 5: ['cruz', 'diamante', 'circulo'], 6: ['diamante', 'cruz', 'circulo'] },
            6: { 1: ['circulo', 'diamante', 'cruz'], 2: ['diamante', 'circulo', 'v'], 3: ['cruz', 'diamante', 'circulo'], 4: ['circulo', 'cruz', 'diamante'], 5: ['diamante', 'cruz', 'circulo'], 6: ['cruz', 'circulo', 'diamante'] },
        };
        function escolherFormacao() {
            const mapaCfg = FORMACOES_POR_MAPA_NIVEL[mapaAtual] || FORMACOES_POR_MAPA_NIVEL[1];
            const opcoes = mapaCfg[nivelDoMapa] || mapaCfg[1];
            return opcoes[Math.floor(Math.random() * opcoes.length)];
        }

        // Tabela real do MAP_CONFIGS (inimigos-boss.js): cada mapa/nível só
        // pode sortear inimigos do seu próprio pool temático — mapa 2
        // (gelo) nunca mostra tank/phantom, por exemplo. Copiei a tabela
        // INTEIRA (36 slots) mesmo sem ainda ter portado todos os tipos —
        // conforme os próximos lotes de inimigo forem chegando, isso já
        // funciona sem precisar mexer aqui de novo.
        const MAPA_ENEMY_POOLS = {
            1: { 1: ['scout'], 2: ['drone'], 3: ['viper', 'razor'], 4: ['tank', 'heavy'], 5: ['bomber', 'phantom'], 6: ['ghost', 'elite'] },
            2: { 1: ['cryo', 'frost_drone'], 2: ['cryo', 'pulse', 'frost_drone'], 3: ['cryo', 'pulse', 'glacier'], 4: ['pulse', 'glacier', 'ice_spike'], 5: ['cryo', 'glacier', 'ice_spike', 'frost_drone'], 6: ['cryo', 'pulse', 'glacier', 'ice_spike', 'frost_drone'] },
            3: { 1: ['inferno', 'ember'], 2: ['inferno', 'blaze', 'ember'], 3: ['inferno', 'vulcan', 'ember'], 4: ['blaze', 'vulcan', 'phoenix'], 5: ['inferno', 'blaze', 'vulcan', 'phoenix'], 6: ['inferno', 'blaze', 'vulcan', 'phoenix', 'ember'] },
            4: { 1: ['shade', 'wraith'], 2: ['shade', 'mirror', 'wraith'], 3: ['shade', 'dark_twin', 'wraith'], 4: ['mirror', 'dark_twin', 'void_shade'], 5: ['shade', 'wraith', 'dark_twin', 'void_shade'], 6: ['shade', 'mirror', 'wraith', 'dark_twin', 'void_shade'] },
            5: { 1: ['mech', 'turret'], 2: ['mech', 'drone_mk2', 'turret'], 3: ['mech', 'bulldozer', 'turret'], 4: ['drone_mk2', 'bulldozer', 'nanobots'], 5: ['mech', 'drone_mk2', 'bulldozer', 'nanobots'], 6: ['mech', 'drone_mk2', 'bulldozer', 'nanobots', 'turret'] },
            6: { 1: ['rift', 'chaos_drone'], 2: ['rift', 'omega_drone', 'chaos_drone'], 3: ['rift', 'corrupted', 'void_walker'], 4: ['omega_drone', 'singularity', 'void_walker'], 5: ['rift', 'corrupted', 'singularity', 'void_walker'], 6: ['rift', 'omega_drone', 'corrupted', 'singularity', 'void_walker', 'chaos_drone'] },
        };
        function escolherTipoInimigo() {
            const mapaCfg = MAPA_ENEMY_POOLS[mapaAtual] || MAPA_ENEMY_POOLS[1];
            const poolChaves = mapaCfg[nivelDoMapa] || mapaCfg[1];
            // Só considera os tipos do pool que JÁ foram portados (têm
            // entrada em ENEMY_CATALOGO) — como ainda faltam lotes, isso
            // volta pro catálogo inteiro se nada do pool real existir ainda
            const disponiveis = ENEMY_CATALOGO.filter(t => poolChaves.includes(t.chave));
            const lista = disponiveis.length > 0 ? disponiveis : ENEMY_CATALOGO;
            return lista[Math.floor(Math.random() * lista.length)];
        }

        // Pega a formação exata (nome+dano de cada inimigo, na ordem da
        // spec) pro mapa/nível atual. formacoesConcluidas já funciona como
        // "índice da formação dentro deste nível" porque cada partida é 1
        // nível só (mapaAtual/nivelDoMapa vêm fixos da URL e não mudam
        // durante a sessão) — então a 1ª formação da sessão é sempre a
        // formação 0 da spec, a 2ª é a 1, etc. Se por algum motivo faltar
        // dado (não devia acontecer, os 36 combos estão completos), cai
        // pra formação 0 do mapa/nível em vez de quebrar.
        function obterFormacaoBalanceada() {
            const porNivel = (BALANCEAMENTO_MAPAS[mapaAtual] || BALANCEAMENTO_MAPAS[1])[nivelDoMapa]
                || BALANCEAMENTO_MAPAS[1][1];
            const formacao = porNivel[formacoesConcluidas] || porNivel[0];
            return formacao.map(([nome, dano]) => ({ nome, dano }));
        }

        function iniciarFormacao() {
            const tipoForma = escolherFormacao();
            formacaoDadosBalanceamento = obterFormacaoBalanceada();
            // Quantidade agora vem da spec (3 a 8, fixo por mapa) em vez do
            // FORMACAO_QTD fixo de antes — usa o tamanho real dos dados
            // como fonte da verdade (garante que sempre bate 1:1).
            const qtd = formacaoDadosBalanceamento.length;
            formacaoFila = getFormacaoPosicoes(tipoForma, qtd);
            formacaoTotal = formacaoFila.length;
            formacaoIndice = 0;
            formacaoSpawnTimer = 0;
            formacaoAtiva = true;
            formacaoTipoInimigo = escolherTipoInimigo(); // só decide o VISUAL (modelo/cor/hp) — nome e dano vêm da spec
            formacaoAltura = VOO.yMin + 0.5 + Math.random() * 1.5; // nasce sempre na parte de baixo, deixando espaço livre acima pro formato abrir
        }

        const enemies = [];
        // Cadência de tiro progressiva por mapa/nível — pedido explícito:
        // mapa1/nível1 = 0.3s entre tiros, e cada nível seguinte soma
        // +0.1s (nível2=0.4s, nível3=0.5s... até mapa6/nível6=3.8s). Os
        // valores reais do 2D (shootIntMs, 80-200ms) eram rápidos demais
        // pro nosso modelo — pareciam um laser contínuo. Vale pra
        // inimigo comum E boss (cadência unificada, não mais por tipo).
        function calcularIntervaloTiro() {
            const slot = (mapaAtual - 1) * 6 + nivelDoMapa; // 1..36
            return (3 + (slot - 1)) / 5; // dobrado — tava saindo rápido demais ainda
        }

        function spawnMembroFormacao(indice) {
            const posFinal = formacaoFila[indice];
            const rota = gerarRotaEntrada(indice, formacaoTotal);
            const tipo = formacaoTipoInimigo;
            const corResolvida = tipo.cor || temaMapa.cor; // tipos exclusivos de mapa (cor:null) usam a cor do mapa atual
            const mesh = tipo.criar(corResolvida);
            // Escala 3D proporcional ao "size" real do 2D (raio em px),
            // usando o drone (size 20) como referência = escala 1.0
            const escala = tipo.size / 20;
            mesh.scale.multiplyScalar(escala); // multiplica em vez de sobrescrever — preserva escalas não-uniformes (ex: o achatamento do razor)
            // Altura final = altura-base da formação + deslocamento do
            // formato (posFinal.y), sempre dentro da área de voo (com
            // margem) pra nenhum membro nascer fora do alcance da nave
            const alturaFinal = THREE.MathUtils.clamp(formacaoAltura + posFinal.y, VOO.yMin + 0.4, VOO.yMax - 0.4);
            const alturaInicial = alturaFinal + (Math.random() - 0.5) * 2;

            // Nome e dano vêm da spec de balanceamento aprovada (não do
            // tipo visual) — cada membro da formação tem seu próprio valor,
            // na ordem exata definida em BALANCEAMENTO_MAPAS.
            const dadosEnemy = formacaoDadosBalanceamento[indice] || { nome: tipo.chave, dano: 10 };

            if (BALANCEAMENTO_MODO_TESTE) {
                // Nasce direto na posição final, sem curva de entrada —
                // fica parado ali (seção 9 da spec: sem formação visual/
                // movimento ainda, só testando dano/HP/waves).
                mesh.position.set(posFinal.x, alturaFinal, FORMACAO_Z_BASE);
            } else {
                mesh.position.set(rota.startX, alturaInicial, rota.startZ);
            }
            scene.add(mesh);
            enemies.push({
                mesh, tipo: tipo.chave, hp: Math.round(dadosEnemy.dano * 1.05), maxHp: Math.round(dadosEnemy.dano * 1.05), reward: tipo.reward,
                nome: dadosEnemy.nome, dano: dadosEnemy.dano,        // da spec de balanceamento (ver BALANCEAMENTO_MAPAS)
                hitRadius: ENEMY_HIT_RADIUS * escala,               // raio de colisão bala/corpo escala com o tamanho real
                bulletScale: tipo.bSize / 5,                         // 5 = bSize de referência (drone/viper/razor)
                fireIntervalBase: calcularIntervaloTiro(),           // cadência progressiva por mapa/nível (não mais a real do tipo, que era rápida demais)
                matPulsante: mesh.userData.matPulsante || null,      // phantom/ghost/pulse pulsam (ver atualizarInimigos)
                orbitais: mesh.userData.orbitais || null,            // inferno — bolinhas girando ao redor (ver atualizarInimigos)
                gruposGirando: mesh.userData.gruposGirando || null,  // void_shade — anéis girando (ver atualizarInimigos)
                pulseT: Math.random() * Math.PI * 2,
                posFinalX: posFinal.x, posFinalZ: FORMACAO_Z_BASE, altura: alturaFinal, // Z sempre igual — parede plana, formato desenhado em X/Y
                rotaStartX: rota.startX, rotaStartZ: rota.startZ,
                rotaCtrlX: rota.ctrlX, rotaCtrlZ: rota.ctrlZ,
                alturaInicial, rotaT: 0, rotaSpd: 1 / FORMACAO_ENTRY_DURATION,
                // No modo balanceamento já nasce "posicionado" (pode atirar
                // na hora, sem esperar a curva de entrada que nem roda).
                posicionado: BALANCEAMENTO_MODO_TESTE ? true : false,
                oscOffset: Math.random() * Math.PI * 2,
                oscAmp: 0.5 + Math.random() * 0.35,
                oscSpd: 0.9 + Math.random() * 0.5,
                oscT: 0,
                shootTimer: 1 + Math.random() * 2,
                hitFlashTimer: 0,
            });
        }

        // Chamado todo frame: spawna 1 membro por vez (com atraso entre
        // eles) até completar a formação; quando a cena fica sem nenhum
        // inimigo, começa uma formação nova (ou um boss, a cada N
        // formações) — igual ao spawnEnemy()/updateWave() reais que só
        // chamam iniciarFormacao()/spawnBoss() quando G.enemies está vazio
        function tickFormacao(dt) {
            if (bossAtivo) return; // luta de boss em andamento, não mexe em formação
            if (!formacaoAtiva) {
                if (enemies.length === 0) {
                    // Quantidade real de waves(=formações) desse mapa/nível,
                    // direto da spec de balanceamento aprovada — antes disso
                    // usava BOSS_A_CADA_FORMACOES fixo (sempre 3), que
                    // cortava o nível cedo demais pra quase todo mundo
                    // (só o Mapa1/NV1 tem exatamente 3 waves; os outros 35
                    // combos têm de 4 a 13). O boss só aparece depois que
                    // TODAS as formações do nível foram limpas.
                    const wavesDoNivel = (WAVES_POR_NIVEL[mapaAtual] || WAVES_POR_NIVEL[1])[nivelDoMapa - 1] || 3;
                    if (formacoesConcluidas > 0 && formacoesConcluidas % wavesDoNivel === 0) {
                        iniciarBoss();
                    } else {
                        iniciarFormacao();
                    }
                }
                return;
            }
            formacaoSpawnTimer -= dt;
            if (formacaoSpawnTimer <= 0 && formacaoIndice < formacaoTotal) {
                spawnMembroFormacao(formacaoIndice);
                formacaoIndice++;
                formacaoSpawnTimer = FORMACAO_SPAWN_DELAY;
            }
            if (formacaoIndice >= formacaoTotal) formacaoAtiva = false; // lançados todos (não morreram ainda)
        }
        // iniciarFormacao() é chamado pelo boss3d.js, DEPOIS que VOO
        // (área de voo) existir — chamar aqui direto quebraria, porque
        // este arquivo carrega antes do boss3d.js

        // ── BOSS — LOTE 1/6: os 6 boss reais do MAPA 1 (Cyberpunk), com
        // hp/tamanho/cadência/recompensa do MAP_CONFIGS[1] real. HP foi
        // dividido por 10 (200→20 etc.) pra caber no nosso modelo de dano
        // simplificado (bala = 1 de dano) — a PROPORÇÃO entre os 6 boss
        // foi mantida igual à real. ALPHA-CORE/VIPER-X/OMEGA-VOID usam
        // imagem no 2D (não tenho acesso); os outros 3 têm desenho
        // vetorial real, traduzido fielmente pra 3D. Mapas 2-6 ainda
        // usam o boss genérico (próximos lotes).
        // Dano da bala do boss atual — setado logo antes de chamar
        // en.tiroCustom(en) (ver atualizarInimigos), pra dispararBalaCustom
        // poder anexar o dano certo sem precisar de um parâmetro extra em
        // cada uma das ~90 chamadas espalhadas pelos padrões de tiro dos
        // 36 boss (cada um chama dispararBalaCustom várias vezes, com
        // ângulos/cores diferentes, mas o dano da bala é sempre o mesmo
        // valor pro boss inteiro — ver BOSS_CONFIGS_MAPA1..6, campo
        // danoBala, calculado como % do HP da nave "esperada" daquele
        // mapa, pra nenhuma bala sozinha quase matar o jogador).
        let _danoBalaBossAtual = 0;

        function dispararBalaCustom(pos, direcao, cor, escala) {
            const eb = new THREE.Mesh(enemyBulletGeo, new THREE.MeshBasicMaterial({ color: cor }));
            eb.position.copy(pos);
            eb.scale.setScalar(escala || 1);
            eb.userData.dir = direcao.clone().normalize();
            eb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eb.userData.dir);
            eb.userData.vida = 5;
            eb.userData.dano = _danoBalaBossAtual; // dano balanceado do boss (ver BOSS_CONFIGS_MAPA1..6)
            scene.add(eb);
            enemyBullets.push(eb);
        }

        function createBossAlphaCore(cor) {
            const group = new THREE.Group();
            const matCorpo = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3, metalness: 0.6 });
            group.add(new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.2, 4), matCorpo));
            const asaGeo = new THREE.BoxGeometry(3.2, 0.15, 1.6);
            const asaL = new THREE.Mesh(asaGeo, matCorpo); asaL.position.set(-1.8, 0, 0.4); asaL.rotation.z = 0.15; group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, matCorpo); asaR.position.set(1.8, 0, 0.4); asaR.rotation.z = -0.15; group.add(asaR);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            nucleo.position.z = -0.3;
            group.add(nucleo);
            return group;
        }
        function createBossViperX(cor) {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.25, metalness: 0.65 });
            group.add(new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 6), mat));
            const finGeo = new THREE.BoxGeometry(2.4, 0.12, 1.0);
            const fin1 = new THREE.Mesh(finGeo, mat); fin1.position.z = 0.8; group.add(fin1);
            const fin2 = new THREE.Mesh(finGeo, mat); fin2.position.z = 1.4; fin2.scale.set(0.7, 1, 1); group.add(fin2);
            return group;
        }
        function createBossTitanShell(cor) {
            // Casca hexagonal dupla girando em sentidos opostos + núcleo escuro — mesma composição do draw() real
            const group = new THREE.Group();
            const hexOuterGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.15, 6);
            hexOuterGeo.rotateX(Math.PI / 2);
            const anelOuter = new THREE.Mesh(hexOuterGeo, new THREE.MeshBasicMaterial({ color: cor, wireframe: true }));
            group.add(anelOuter);
            const hexInnerGeo = new THREE.CylinderGeometry(1, 1, 0.5, 6);
            hexInnerGeo.rotateX(Math.PI / 2);
            const hexInner = new THREE.Mesh(hexInnerGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4, metalness: 0.4 }));
            group.add(hexInner);
            const nucleoEscuro = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), new THREE.MeshBasicMaterial({ color: 0x1a0800 }));
            nucleoEscuro.position.z = 0.3;
            group.add(nucleoEscuro);
            const nucleoBrilho = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: cor }));
            nucleoBrilho.position.z = 0.32;
            group.add(nucleoBrilho);
            group.userData.anelGirando = anelOuter; // gira em sentido oposto ao corpo
            return group;
        }
        function createBossPhantomNull(cor) {
            // Estrela de 8 pontas pulsante + núcleo escuro + "olho" elíptico — mesma forma do draw() real
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i;
                const r = i % 2 === 0 ? 1.1 : 0.5;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
            }
            shape.closePath();
            const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.7 });
            const estrela = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), mat);
            group.add(estrela);
            const nucleoEscuro = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), new THREE.MeshBasicMaterial({ color: 0x0d001a }));
            nucleoEscuro.position.z = 0.25;
            group.add(nucleoEscuro);
            const olho = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), new THREE.MeshBasicMaterial({ color: cor }));
            olho.scale.set(0.7, 1, 0.4);
            olho.position.z = 0.35;
            group.add(olho);
            group.userData.matPulsante = mat;
            return group;
        }
        function createBossSwarmQueen(cor) {
            // Corpo elipsoide + listras + cabeça com 2 olhos vermelhos + 2
            // asas translúcidas pulsantes — mesma composição do draw() real
            const group = new THREE.Group();
            const corpo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.45 }));
            corpo.scale.set(0.65, 1.0, 0.65);
            corpo.position.y = -0.25;
            group.add(corpo);
            const listraGeo = new THREE.TorusGeometry(0.6, 0.04, 6, 20);
            for (let i = -2; i <= 2; i++) {
                const listra = new THREE.Mesh(listraGeo, new THREE.MeshBasicMaterial({ color: 0x1a1000 }));
                listra.position.y = -0.25 + i * 0.25;
                listra.scale.setScalar(1 - Math.abs(i) * 0.12);
                group.add(listra);
            }
            const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4 }));
            cabeca.position.y = 0.7;
            group.add(cabeca);
            const olhoGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const olhoMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const olhoL = new THREE.Mesh(olhoGeo, olhoMat); olhoL.position.set(-0.14, 0.68, 0.32); group.add(olhoL);
            const olhoR = new THREE.Mesh(olhoGeo, olhoMat); olhoR.position.set(0.14, 0.68, 0.32); group.add(olhoR);
            const asaGeo = new THREE.PlaneGeometry(1.4, 0.6);
            const asaMat = new THREE.MeshBasicMaterial({ color: 0xaaffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
            const asaL = new THREE.Mesh(asaGeo, asaMat); asaL.position.set(-1.1, 0, 0); asaL.rotation.y = -0.4; group.add(asaL);
            const asaR = new THREE.Mesh(asaGeo, asaMat.clone()); asaR.position.set(1.1, 0, 0); asaR.rotation.y = 0.4; group.add(asaR);
            group.userData.matPulsante = asaMat; // pulsa a opacidade das asas
            return group;
        }
        function createBossOmegaVoid(cor) {
            // Núcleo grande + 3 anéis girando — o mais "ameaçador" visualmente, já que é o último boss do mapa
            const group = new THREE.Group();
            const nucleo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.2, metalness: 0.7, flatShading: true }));
            group.add(nucleo);
            [1.6, 2.0, 2.4].forEach((r, i) => {
                const anel = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? cor : 0xffffff }));
                anel.rotation.x = (Math.PI / 3) * i;
                group.add(anel);
            });
            return group;
        }

        const BOSS_CONFIGS_MAPA1 = {
            1: { nome: 'ALPHA-CORE', hp: 67, size: 1.9, shootIntervalMs: 550, bSize: 1.4, reward: 97, danoBala: 42, cor: 0xff4466, criar: createBossAlphaCore,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(off => { const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off); dispararBalaCustom(en.mesh.position, d, en.cor, 1.3); }); } },
            2: { nome: 'VIPER-X', hp: 87, size: 1.7, shootIntervalMs: 450, bSize: 1.2, reward: 127, danoBala: 48, cor: 0x00ff88, criar: createBossViperX,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.28), en.cor, 1.1); } },
            3: { nome: 'TITAN-SHELL', hp: 107, size: 1.5, shootIntervalMs: 400, bSize: 1.6, reward: 156, danoBala: 53, cor: 0xffaa00, criar: createBossTitanShell,
                tiro(en) { for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.4); } } },
            4: { nome: 'PHANTOM-NULL', hp: 127, size: 1.4, shootIntervalMs: 380, bSize: 1.4, reward: 185, danoBala: 59, cor: 0xcc00ff, criar: createBossPhantomNull,
                tiro(en) { for (let i = 0; i < 3; i++) { const a1 = (Math.PI * 2 / 3) * i + en.pulseT, a2 = (Math.PI * 2 / 3) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.3); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0xff00ff, 1.0); } } },
            5: { nome: 'SWARM-QUEEN', hp: 147, size: 1.5, shootIntervalMs: 320, bSize: 1.3, reward: 214, danoBala: 64, cor: 0xffe000, criar: createBossSwarmQueen,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT * 0.5; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.2); } } },
            6: { nome: 'OMEGA-VOID', hp: 180, size: 1.6, shootIntervalMs: 250, bSize: 1.6, reward: 263, danoBala: 70, cor: 0x00eeff, criar: createBossOmegaVoid,
                tiro(en) {
                    for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 / 10) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -1; a <= 1; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.22), 0xff00cc, 1.4);
                } },
        };

        function createBossFrostCore(cor) {
            // 8 pontas semitransparente girando + hexágono opaco girando oposto + núcleo branco
            const group = new THREE.Group();
            const shape = new THREE.Shape();
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i;
                const r = i % 2 === 0 ? 1.2 : 0.7;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
            }
            shape.closePath();
            const estrela = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5 }));
            group.add(estrela);
            const hexGeo = new THREE.CylinderGeometry(1, 1, 0.3, 6);
            hexGeo.rotateX(Math.PI / 2);
            const hex = new THREE.Mesh(hexGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.3 }));
            hex.position.z = 0.15;
            group.add(hex);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            nucleo.position.z = 0.3;
            group.add(nucleo);
            group.userData.estrelaGirando = estrela;
            group.userData.hexGirando = hex;
            return group;
        }
        function createBossCryoViper(cor) {
            // Lâmina cristalina angular (facetada) + núcleo escuro
            const group = new THREE.Group();
            const cristal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.1, metalness: 0.8, flatShading: true }));
            cristal.scale.set(0.6, 1.4, 0.6);
            group.add(cristal);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshBasicMaterial({ color: 0x000044 }));
            nucleo.position.y = -0.3;
            group.add(nucleo);
            return group;
        }
        function createBossIceTitan(cor) {
            // Hexágono girando + 6 lanças de gelo radiais + núcleo escuro
            const group = new THREE.Group();
            const hexGeo = new THREE.CylinderGeometry(1, 1, 0.35, 6);
            hexGeo.rotateX(Math.PI / 2);
            const hex = new THREE.Mesh(hexGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.25, metalness: 0.5 }));
            group.add(hex);
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i + Math.PI / 6;
                const lanca = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.0, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
                lanca.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.1);
                lanca.rotation.z = a - Math.PI / 2;
                group.add(lanca);
            }
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0x000033 }));
            nucleo.position.z = 0.2;
            group.add(nucleo);
            group.userData.hexGirando = hex;
            return group;
        }
        function createBossNullFrost(cor) {
            // Estrela de 8 pontas pulsante + núcleo escuro — mesma composição do PHANTOM-NULL, cor/tamanho diferentes
            return createBossPhantomNull(cor);
        }
        function createBossBlizzardQueen(cor) {
            // Corpo elipsoide + 6 "lanças" rotativas + núcleo escuro + anel pulsante
            const group = new THREE.Group();
            const corpo = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55 }));
            corpo.scale.set(1.3, 1.0, 1.0);
            group.add(corpo);
            const lancaGeo = new THREE.BoxGeometry(0.3, 1.0, 0.15);
            const lancas = [];
            for (let i = 0; i < 6; i++) {
                const lanca = new THREE.Mesh(lancaGeo, new THREE.MeshBasicMaterial({ color: cor }));
                const a = (Math.PI / 3) * i;
                lanca.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0);
                lanca.rotation.z = a;
                group.add(lanca);
                lancas.push(lanca);
            }
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0x003355 }));
            group.add(nucleo);
            const anelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
            const anel = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.04, 8, 32), anelMat);
            group.add(anel);
            group.userData.matPulsante = anelMat;
            group.userData.lancasGirando = lancas;
            return group;
        }
        function createBossAbsoluteZero(cor) {
            // 5 anéis concêntricos girando em sentidos alternados + núcleo brilhante gradiente
            const group = new THREE.Group();
            const nucleoBrilho = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.4 }));
            group.add(nucleoBrilho);
            const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            group.add(nucleo);
            const aneis = [];
            for (let ring = 1; ring <= 5; ring++) {
                const anel = new THREE.Mesh(new THREE.TorusGeometry(ring * 0.28, ring === 5 ? 0.1 : 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: ring === 5 ? 0.15 : 0.5 }));
                group.add(anel);
                aneis.push(anel);
            }
            group.userData.aneisGirando = aneis;
            return group;
        }

        const BOSS_CONFIGS_MAPA2 = {
            1: { nome: 'FROST-CORE', hp: 93, size: 1.9, shootIntervalMs: 520, bSize: 1.4, reward: 226, danoBala: 46, cor: 0xaaeeff, criar: createBossFrostCore,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -3; a <= 3; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.2), en.cor, 1.2); } },
            2: { nome: 'CRYO-VIPER', hp: 121, size: 1.7, shootIntervalMs: 420, bSize: 1.2, reward: 294, danoBala: 52, cor: 0x00ddff, criar: createBossCryoViper,
                tiro(en) { for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.2); } } },
            3: { nome: 'ICE-TITAN', hp: 149, size: 2.0, shootIntervalMs: 380, bSize: 1.7, reward: 362, danoBala: 58, cor: 0x88eeff, criar: createBossIceTitan,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT * 0.5; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.4); } } },
            4: { nome: 'NULL-FROST', hp: 177, size: 1.6, shootIntervalMs: 360, bSize: 1.4, reward: 430, danoBala: 64, cor: 0x00ffee, criar: createBossNullFrost,
                tiro(en) { for (let i = 0; i < 4; i++) { const a1 = (Math.PI / 2) * i + en.pulseT, a2 = (Math.PI / 2) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.3); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0xaaeeff, 1.0); } } },
            5: { nome: 'BLIZZARD-QUEEN', hp: 205, size: 1.9, shootIntervalMs: 300, bSize: 1.3, reward: 498, danoBala: 70, cor: 0xccffff, criar: createBossBlizzardQueen,
                tiro(en) { for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 / 10) * i + en.pulseT * 0.3; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.2); } } },
            6: { nome: 'ABSOLUTE-ZERO', hp: 252, size: 2.1, shootIntervalMs: 220, bSize: 1.7, reward: 611, danoBala: 76, cor: 0xffffff, criar: createBossAbsoluteZero,
                tiro(en) {
                    for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 / 12) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0xaaeeff, 1.3); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.2), 0xffffff, 1.5);
                } },
        };
        function createBossFlameX(cor) {
            // Reaproveita a silhueta de chama do inimigo phoenix, maior — mesma ideia visual do FLAME-X real (corpo bezier + chama interna)
            return criarSilhuetaChama(cor, 0xffaa00);
        }

        const BOSS_CONFIGS_MAPA3 = {
            1: { nome: 'EMBER-CORE', hp: 127, size: 1.9, shootIntervalMs: 500, bSize: 1.4, reward: 483, danoBala: 51, cor: 0xff6600, criar: createBossTitanShell,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.25), en.cor, 1.3); } },
            2: { nome: 'FLAME-X', hp: 165, size: 1.8, shootIntervalMs: 400, bSize: 1.3, reward: 628, danoBala: 58, cor: 0xff3300, criar: createBossFlameX,
                tiro(en) { for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            3: { nome: 'INFERNO-SHELL', hp: 203, size: 2.1, shootIntervalMs: 360, bSize: 1.8, reward: 772, danoBala: 65, cor: 0xff4400, criar: createBossIceTitan,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.5); } } },
            4: { nome: 'PHANTOM-BLAZE', hp: 241, size: 1.7, shootIntervalMs: 340, bSize: 1.5, reward: 917, danoBala: 71, cor: 0xff2200, criar: createBossPhantomNull,
                tiro(en) { for (let i = 0; i < 4; i++) { const a1 = (Math.PI / 2) * i + en.pulseT, a2 = (Math.PI / 2) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.4); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0xff8800, 1.1); } } },
            5: { nome: 'FIRE-QUEEN', hp: 279, size: 1.9, shootIntervalMs: 280, bSize: 1.4, reward: 1062, danoBala: 78, cor: 0xffaa00, criar: createBossSwarmQueen,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT * 0.4; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            6: { nome: 'SOLAR-VOID', hp: 342, size: 2.2, shootIntervalMs: 200, bSize: 1.7, reward: 1303, danoBala: 85, cor: 0xffdd00, criar: createBossAbsoluteZero,
                tiro(en) {
                    for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 / 12) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.18), 0xff4400, 1.5);
                } },
        };
        const BOSS_CONFIGS_MAPA4 = {
            1: { nome: 'SHADOW-CORE', hp: 173, size: 1.9, shootIntervalMs: 500, bSize: 1.4, reward: 813, danoBala: 59, cor: 0x6600cc, criar: createBossTitanShell,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.22), en.cor, 1.3); } },
            2: { nome: 'DARK-VIPER', hp: 225, size: 1.8, shootIntervalMs: 400, bSize: 1.3, reward: 1056, danoBala: 67, cor: 0x9900ff, criar: createBossCryoViper,
                tiro(en) { for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            3: { nome: 'SHADE-TITAN', hp: 277, size: 2.0, shootIntervalMs: 360, bSize: 1.7, reward: 1300, danoBala: 74, cor: 0x7700bb, criar: createBossIceTitan,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.5); } } },
            4: { nome: 'NULL-SHADOW', hp: 329, size: 1.8, shootIntervalMs: 330, bSize: 1.5, reward: 1544, danoBala: 82, cor: 0xaa00ff, criar: createBossPhantomNull,
                tiro(en) { for (let i = 0; i < 5; i++) { const a1 = (Math.PI * 2 / 5) * i + en.pulseT, a2 = (Math.PI * 2 / 5) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.4); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0xff00ff, 1.0); } } },
            5: { nome: 'MIRROR-QUEEN', hp: 381, size: 2.0, shootIntervalMs: 270, bSize: 1.4, reward: 1788, danoBala: 90, cor: 0xff88ff, criar: createBossSwarmQueen,
                tiro(en) { for (let i = 0; i < 9; i++) { const a = (Math.PI * 2 / 9) * i + en.pulseT * 0.4; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            6: { nome: 'ABYSS-VOID', hp: 468, size: 2.2, shootIntervalMs: 190, bSize: 1.8, reward: 2194, danoBala: 98, cor: 0x3300aa, criar: createBossAbsoluteZero,
                tiro(en) {
                    for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 / 12) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.4); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.2), 0xaa00ff, 1.6);
                } },
        };
        function createBossMechCore(cor) {
            // Robô retangular com braços + visor — mesma composição do
            // draw() real (fillRect corpo + braços + visor + faixa de HP embutida)
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.35, metalness: 0.55 });
            group.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 1.3), mat));
            const bracoGeo = new THREE.BoxGeometry(0.55, 1.2, 0.6);
            const bL = new THREE.Mesh(bracoGeo, mat); bL.position.x = -1.55; group.add(bL);
            const bR = new THREE.Mesh(bracoGeo, mat); bR.position.x = 1.55; group.add(bR);
            const cabeca = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), mat);
            cabeca.position.y = 1.4;
            group.add(cabeca);
            for (let i = 0; i < 3; i++) {
                const olho = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
                olho.position.set(-0.35 + i * 0.35, 1.45, 0.4);
                group.add(olho);
            }
            return group;
        }

        const BOSS_CONFIGS_MAPA5 = {
            1: { nome: 'MECH-CORE', hp: 240, size: 1.8, shootIntervalMs: 480, bSize: 1.5, reward: 1223, danoBala: 69, cor: 0x88aaff, criar: createBossMechCore,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -1; a <= 1; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.3), en.cor, 1.4); } },
            2: { nome: 'CIRCUIT-X', hp: 312, size: 1.7, shootIntervalMs: 380, bSize: 1.3, reward: 1590, danoBala: 78, cor: 0x00aaff, criar: createBossIceTitan,
                tiro(en) { for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            3: { nome: 'STEEL-TITAN', hp: 384, size: 2.1, shootIntervalMs: 340, bSize: 1.9, reward: 1957, danoBala: 87, cor: 0xaabbcc, criar: createBossMechCore,
                tiro(en) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.6); } } },
            4: { nome: 'PHANTOM-MECH', hp: 456, size: 1.9, shootIntervalMs: 310, bSize: 1.5, reward: 2324, danoBala: 97, cor: 0x66aaff, criar: createBossPhantomNull,
                tiro(en) { for (let i = 0; i < 4; i++) { const a1 = (Math.PI / 2) * i + en.pulseT, a2 = (Math.PI / 2) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.4); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0x00aaff, 1.1); } } },
            5: { nome: 'HIVE-QUEEN', hp: 528, size: 2.0, shootIntervalMs: 250, bSize: 1.4, reward: 2691, danoBala: 106, cor: 0x4488ff, criar: createBossSwarmQueen,
                tiro(en) { for (let i = 0; i < 9; i++) { const a = (Math.PI * 2 / 9) * i + en.pulseT * 0.35; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.3); } } },
            6: { nome: 'OMEGA-MECH', hp: 648, size: 2.3, shootIntervalMs: 180, bSize: 1.9, reward: 3303, danoBala: 115, cor: 0x00ddff, criar: createBossOmegaVoid,
                tiro(en) {
                    for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 / 12) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.5); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -2; a <= 2; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.18), 0x88eeff, 1.7);
                } },
        };
        const BOSS_CONFIGS_MAPA6 = {
            1: { nome: 'CHAOS-CORE', hp: 333, size: 1.9, shootIntervalMs: 460, bSize: 1.5, reward: 1665, danoBala: 81, cor: 0xff00aa, criar: createBossTitanShell,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); for (let a = -3; a <= 3; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.22), en.cor, 1.3); } },
            2: { nome: 'RIFT-X', hp: 433, size: 1.8, shootIntervalMs: 380, bSize: 1.3, reward: 2165, danoBala: 92, cor: 0xcc00ff, criar: createBossCryoViper,
                tiro(en) { for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.4); } } },
            3: { nome: 'VOID-TITAN', hp: 533, size: 2.1, shootIntervalMs: 320, bSize: 1.9, reward: 2664, danoBala: 103, cor: 0x00ccff, criar: createBossAbsoluteZero,
                tiro(en) { for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 / 10) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.6); } } },
            4: { nome: 'NULL-CHAOS', hp: 633, size: 1.9, shootIntervalMs: 280, bSize: 1.6, reward: 3164, danoBala: 113, cor: 0xff00ff, criar: createBossPhantomNull,
                tiro(en) { for (let i = 0; i < 5; i++) { const a1 = (Math.PI * 2 / 5) * i + en.pulseT, a2 = (Math.PI * 2 / 5) * i - en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), en.cor, 1.5); dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2)), 0xcc00ff, 1.1); } } },
            5: { nome: 'RIFT-QUEEN', hp: 733, size: 2.1, shootIntervalMs: 230, bSize: 1.5, reward: 3663, danoBala: 124, cor: 0xff44ff, criar: createBossSwarmQueen,
                tiro(en) { for (let i = 0; i < 10; i++) { const a = (Math.PI * 2 / 10) * i + en.pulseT * 0.4; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.4); } } },
            // OMEGA-CHAOS — boss final do jogo. Rajada tripla (a mais
            // intensa de todas: radial + mirada + radial secundária),
            // igual à combinação real do shoot() dele
            6: { nome: 'OMEGA-CHAOS', hp: 900, size: 2.4, shootIntervalMs: 160, bSize: 2.0, reward: 4496, danoBala: 135, cor: 0xff00ff, criar: createBossAbsoluteZero,
                tiro(en) {
                    for (let i = 0; i < 14; i++) { const a = (Math.PI * 2 / 14) * i + en.pulseT; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), en.cor, 1.5); }
                    const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize();
                    for (let a = -3; a <= 3; a++) dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a * 0.18), 0xff44ff, 1.7);
                    for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i + en.pulseT * 1.5; dispararBalaCustom(en.mesh.position, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0xcc00ff, 1.3); }
                } },
        };
        const BOSS_CONFIGS_POR_MAPA = { 1: BOSS_CONFIGS_MAPA1, 2: BOSS_CONFIGS_MAPA2, 3: BOSS_CONFIGS_MAPA3, 4: BOSS_CONFIGS_MAPA4, 5: BOSS_CONFIGS_MAPA5, 6: BOSS_CONFIGS_MAPA6 };

        const BOSS_A_CADA_FORMACOES = 3; // igual à ideia real do wavesPerBoss (lá é a cada 3 ondas)
        const BOSS_Z_HOLD = -38;         // valor definido pelo dev direto no jogo (era -24 na minha última proposta, -14 no original)
        const BOSS_ENTRY_DURATION = 2.2;
        let bossAtivo = false;
        let formacoesConcluidas = 0;

        function mostrarAvisoBoss(texto) {
            const el = document.getElementById('powerupIndicator');
            el.textContent = texto;
            el.style.opacity = '1';
            setTimeout(() => { el.style.opacity = '0'; }, 2200);
        }

        function iniciarBoss() {
            bossAtivo = true;
            // Todos os 6 mapas já têm os 6 boss reais portados (36 no
            // total) — esse fallback genérico só entra em ação se algum
            // mapaAtual/nivelDoMapa vier fora do esperado (não deveria
            // acontecer nunca em jogo normal).
            const tabelaMapa = BOSS_CONFIGS_POR_MAPA[mapaAtual];
            const cfg = (tabelaMapa && tabelaMapa[nivelDoMapa]) || {
                nome: 'BOSS', hp: 40, size: 1.6, shootIntervalMs: 900, bSize: 1.3, reward: 3000, danoBala: 60, cor: 0xff2255,
                criar: createBossOmegaVoid,
                tiro(en) { const base = new THREE.Vector3().subVectors(shipGroup.position, en.mesh.position).normalize(); [-0.35, 0, 0.35].forEach(ang => dispararBalaCustom(en.mesh.position, base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang), en.cor, 1.2)); },
            };
            const mesh = cfg.criar(cfg.cor);
            mesh.scale.setScalar(cfg.size);
            const alturaAlvo = (VOO.yMin + VOO.yMax) / 2;
            mesh.position.set(0, alturaAlvo, ENEMY_SPAWN_Z);
            scene.add(mesh);
            enemies.push({
                mesh, isBoss: true, hp: cfg.hp, maxHp: cfg.hp, reward: cfg.reward,
                cor: cfg.cor, tiroCustom: cfg.tiro, nomeBoss: cfg.nome,
                danoBala: cfg.danoBala || 60, // dano de cada bala do boss (spec de balanceamento — % do HP da nave esperada daquele mapa)
                hitRadius: 3.0 * cfg.size,
                matPulsante: mesh.userData.matPulsante || null,
                anelGirando: mesh.userData.anelGirando || mesh.userData.hexGirando || null,
                anelGirando2: mesh.userData.estrelaGirando || null,
                gruposGirando: mesh.userData.lancasGirando || mesh.userData.aneisGirando || null,
                pulseT: 0,
                posFinalX: 0, posFinalZ: BOSS_Z_HOLD, altura: alturaAlvo,
                rotaStartX: 0, rotaStartZ: ENEMY_SPAWN_Z,
                rotaCtrlX: 0, rotaCtrlZ: (ENEMY_SPAWN_Z + BOSS_Z_HOLD) / 2,
                alturaInicial: alturaAlvo, rotaT: 0, rotaSpd: 1 / BOSS_ENTRY_DURATION,
                posicionado: false,
                oscOffset: 0, oscAmp: 1.3, oscSpd: 0.5, oscT: 0,
                shootTimer: 2, hitFlashTimer: 0,
                fireIntervalBase: calcularIntervaloTiro(), // cadência progressiva por mapa/nível (não mais a real do tipo)
            });
            mostrarAvisoBoss('⚠ ' + cfg.nome + ' ⚠');
        }

        // ── Ponto único de "matar um inimigo" — todo lugar que antes fazia
        // enemies.splice()+destruirInimigo() direto agora passa por aqui,
        // pra dar chance das mecânicas especiais (PHOENIX ressuscitando,
        // CORRUPTED dividindo) entrarem em ação antes da morte de verdade.
        function matarOuRessuscitar(en) {
            if (en.tipo === 'phoenix' && !en.jaRessuscitou) {
                en.jaRessuscitou = true;
                en.hp = Math.ceil(en.maxHp / 2);
                mostrarTextoFlutuante(en.mesh.position, 'RESSUSCITOU!', '#ffaa00');
                return;
            }
            const posMorte = en.mesh.position.clone();
            const idx = enemies.indexOf(en);
            if (idx >= 0) enemies.splice(idx, 1);
            destruirInimigo(en);
            if (en.tipo === 'corrupted' && !en.jaDividiu) dividirCorrupted(en, posMorte);
        }

        function dividirCorrupted(enemyOriginal, posMorte) {
            const tipo = ENEMY_CATALOGO.find(t => t.chave === 'corrupted');
            if (!tipo) return;
            for (let i = 0; i < 2; i++) {
                const mesh = tipo.criar(temaMapa.cor);
                const escala = (tipo.size / 20) * 0.6; // metade do tamanho — filhote
                mesh.scale.multiplyScalar(escala);
                const pos = posMorte.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.1, 0));
                mesh.position.copy(pos);
                scene.add(mesh);
                enemies.push({
                    mesh, tipo: 'corrupted', hp: Math.max(1, Math.ceil(enemyOriginal.maxHp / 2)), maxHp: Math.max(1, Math.ceil(enemyOriginal.maxHp / 2)), reward: Math.ceil(enemyOriginal.reward / 2),
                    hitRadius: ENEMY_HIT_RADIUS * escala, bulletScale: tipo.bSize / 5, fireIntervalBase: calcularIntervaloTiro(),
                    jaDividiu: true, // filhote não divide de novo — só 1 nível de divisão
                    matPulsante: mesh.userData.matPulsante || null, pulseT: Math.random() * Math.PI * 2,
                    posFinalX: pos.x, posFinalZ: pos.z, altura: pos.y,
                    rotaStartX: pos.x, rotaStartZ: pos.z, rotaCtrlX: pos.x, rotaCtrlZ: pos.z,
                    alturaInicial: pos.y, rotaT: 1, rotaSpd: 1, posicionado: true, // já nasce posicionado, sem curva de entrada
                    oscOffset: Math.random() * Math.PI * 2, oscAmp: 0.4, oscSpd: 1.2, oscT: 0,
                    shootTimer: 1 + Math.random(), hitFlashTimer: 0,
                });
            }
        }

        // Boss "Queen" (RIFT-QUEEN, FIRE-QUEEN, SWARM-QUEEN, BLIZZARD-QUEEN,
        // MIRROR-QUEEN, HIVE-QUEEN) invocam um minion perto delas de tempos
        // em tempos — reaproveita o pool de inimigo real do mapa atual
        function invocarMinion(bossEn) {
            const tipo = escolherTipoInimigo();
            const cor = tipo.cor || temaMapa.cor;
            const mesh = tipo.criar(cor);
            const escala = (tipo.size / 20) * 0.6;
            mesh.scale.multiplyScalar(escala);
            const pos = bossEn.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.6, 0));
            mesh.position.copy(pos);
            scene.add(mesh);
            enemies.push({
                mesh, tipo: tipo.chave, hp: Math.max(1, Math.ceil(tipo.hp * 0.5)), maxHp: Math.max(1, Math.ceil(tipo.hp * 0.5)), reward: Math.ceil(tipo.reward * 0.4),
                hitRadius: ENEMY_HIT_RADIUS * escala, bulletScale: tipo.bSize / 5, fireIntervalBase: calcularIntervaloTiro(),
                matPulsante: mesh.userData.matPulsante || null, pulseT: Math.random() * Math.PI * 2,
                posFinalX: pos.x, posFinalZ: pos.z, altura: pos.y,
                rotaStartX: pos.x, rotaStartZ: pos.z, rotaCtrlX: pos.x, rotaCtrlZ: pos.z,
                alturaInicial: pos.y, rotaT: 1, rotaSpd: 1, posicionado: true,
                oscOffset: Math.random() * Math.PI * 2, oscAmp: 0.35, oscSpd: 1.3, oscT: 0,
                shootTimer: 1 + Math.random(), hitFlashTimer: 0,
            });
        }

        function destruirInimigo(enemy) {
            const posMorte = enemy.mesh.position.clone();
            scene.remove(enemy.mesh);
            tocarSom(enemyDeathSound);
            spawnCristais(posMorte, enemy.isBoss);
            spawnPowerupChance(posMorte, enemy.isBoss);
            // Mesmos valores do xp.js real: inimigoComum 5, elite 20, boss 100
            // ("elite" aqui é o tipo tank — o mais forte dos 4 tipos comuns)
            const xpGanho = enemy.isBoss ? 100 : (enemy.tipo === 'tank' ? 20 : 5);
            mostrarTextoFlutuante(posMorte, '+' + xpGanho + ' XP', '#ffd700');
            ganharAbate(enemy.reward, xpGanho, enemy.isBoss);
            if (enemy.isBoss) {
                bossAtivo = false; // derrotado — a próxima formação volta ao normal
                bossesDerrotados++;
                if (bossesDerrotados >= BOSSES_PARA_VITORIA) { venceuJogo(); return; }
            } else if (enemies.length === 0) {
                formacoesConcluidas++; // essa formação acabou de ser totalmente limpa
            }
        }


// ── Atualização por frame dos inimigos (chamada pelo boss3d.js) ──
function atualizarInimigos(dt) {
            // ── Atualiza inimigos: curva de entrada / hover da formação, tiro, colisão ──
            enemies.forEach(en => {
                if (!en.posicionado) {
                    // Curva de Bezier quadrática da posição de entrada até a vaga na formação
                    en.rotaT = Math.min(1, en.rotaT + en.rotaSpd * dt);
                    const t = en.rotaT, mt = 1 - t;
                    const x = mt * mt * en.rotaStartX + 2 * mt * t * en.rotaCtrlX + t * t * en.posFinalX;
                    const z = mt * mt * en.rotaStartZ + 2 * mt * t * en.rotaCtrlZ + t * t * en.posFinalZ;
                    const y = en.alturaInicial + (en.altura - en.alturaInicial) * t;
                    en.mesh.position.set(x, y, z);
                    if (en.rotaT >= 1) en.posicionado = true;
                } else if (BALANCEAMENTO_MODO_TESTE && !en.isBoss) {
                    // Seção 9 da spec de balanceamento: inimigo comum fica
                    // 100% parado (nem a oscilação de hover) enquanto só
                    // estamos testando dano/HP/waves. Boss NÃO entra aqui —
                    // continua se movendo normal, já que boss ainda não
                    // está sendo mexido nessa etapa.
                    en.mesh.position.set(en.posFinalX, en.altura, en.posFinalZ);
                } else if (en.isBoss) {
                    // Boss fica numa posição 100% fixa depois de entrar —
                    // sem a oscilação de hover dos inimigos comuns (pedido
                    // explícito: mesma posição sempre, mais pra trás — ver
                    // BOSS_Z_HOLD). O corpo dele continua "vivo" através das
                    // próprias animações (anéis girando, pulsar, etc.),
                    // só a posição no espaço que não se mexe mais.
                    en.mesh.position.set(en.posFinalX, en.altura, en.posFinalZ);
                } else {
                    // Parado na formação, oscilando de lado a lado (e um pouco em Z)
                    en.oscT += dt;
                    const x = en.posFinalX + Math.sin(en.oscT * en.oscSpd + en.oscOffset) * en.oscAmp;
                    const z = en.posFinalZ + Math.sin(en.oscT * en.oscSpd * 0.7 + en.oscOffset) * en.oscAmp * 0.35;
                    en.mesh.position.set(x, en.altura, z);
                }

                // Flash de dano (emissive branco rápido ao ser atingido)
                if (en.hitFlashTimer > 0) {
                    en.hitFlashTimer -= dt;
                    en.mesh.traverse(child => {
                        if (child.isMesh && child.material.emissive) child.material.emissive.setHex(en.hitFlashTimer > 0 ? 0xffffff : 0x000000);
                    });
                }

                // Fase (usada por pulsação E pelos padrões de tiro rotativos
                // dos boss — sempre incrementa, não só quando pulsa)
                en.pulseT = (en.pulseT || 0) + dt;

                // Pulsação de opacidade (phantom/ghost/boss translúcidos) —
                // mesma ideia do "alpha = base + sin(t)*amplitude" do draw() real
                if (en.matPulsante) {
                    en.matPulsante.opacity = 0.4 + Math.sin(en.pulseT * 3) * 0.3;
                }
                // Anel girando em sentido oposto ao corpo (TITAN-SHELL)
                if (en.anelGirando) en.anelGirando.rotation.z -= dt * 0.8;
                if (en.anelGirando2) en.anelGirando2.rotation.z += dt * 1.1;
                if (en.gruposGirando) en.gruposGirando.forEach((m, i) => { m.rotation.z += dt * (0.5 + i * 0.15) * (i % 2 === 0 ? 1 : -1); });
                if (en.orbitais) en.orbitais.forEach((m, i) => {
                    const a = (Math.PI * 2 / en.orbitais.length) * i + en.pulseT * 2;
                    m.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.5);
                });

                // Tiro do inimigo contra o jogador — só depois de posicionado
                // na formação (igual ao "podeAtirar" do 2D real), mirando na
                // posição atual da nave e perseguindo em seguida (Camada 4).
                // Boss usa o padrão de tiro PRÓPRIO dele (tiroCustom); inimigo
                // comum atira 1, na cadência e tamanho de bala reais do tipo.
                if (en.posicionado) {
                    en.shootTimer -= dt;
                    if (en.shootTimer <= 0) {
                        en.shootTimer = en.isBoss ? en.fireIntervalBase : (en.fireIntervalBase * (0.85 + Math.random() * 0.3));
                        if (en.isBoss && en.tiroCustom) {
                            _danoBalaBossAtual = en.danoBala; // dispararBalaCustom() lê essa variável — ver comentário lá em cima
                            en.tiroCustom(en);
                        } else {
                            const eb = new THREE.Mesh(enemyBulletGeo, enemyBulletMat);
                            eb.position.copy(en.mesh.position);
                            eb.scale.setScalar(en.bulletScale || 1); // tamanho da bala real do tipo
                            const direcaoBase = new THREE.Vector3().subVectors(shipGroup.position, eb.position).normalize();
                            eb.userData.dir = direcaoBase;
                            eb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direcaoBase);
                            eb.userData.vida = 5; // segundos até desaparecer sozinha, caso nunca acerte
                            eb.userData.dano = en.dano; // dano vem da spec de balanceamento (ver BALANCEAMENTO_MAPAS) — lido em boss3d.js na hora do acerto
                            scene.add(eb);
                            enemyBullets.push(eb);
                        }
                    }
                }

                // ── Mecânicas especiais de tipos específicos ──
                if (en.posicionado && !en.isBoss) {
                    if (en.tipo === 'vulcan') {
                        // Puxa a nave levemente por gravidade enquanto vivo
                        const puxao = 0.5 * dt;
                        shipState.x += (en.mesh.position.x - shipState.x) * puxao * 0.15;
                        shipState.y += (en.mesh.position.y - shipState.y) * puxao * 0.15;
                    }
                    if (en.tipo === 'singularity') {
                        // Sucção mais forte que a do vulcan
                        const puxao = 0.7 * dt;
                        shipState.x += (en.mesh.position.x - shipState.x) * puxao * 0.3;
                        shipState.y += (en.mesh.position.y - shipState.y) * puxao * 0.3;
                    }
                    if (en.tipo === 'void_walker') {
                        en.teleportTimer = (en.teleportTimer === undefined ? 2 + Math.random() * 2 : en.teleportTimer) - dt;
                        if (en.teleportTimer <= 0) {
                            en.teleportTimer = 2.5 + Math.random() * 2;
                            en.posFinalX = VOO.xMin + Math.random() * (VOO.xMax - VOO.xMin);
                            en.altura = THREE.MathUtils.clamp(en.altura + (Math.random() - 0.5) * 2.5, VOO.yMin + 0.4, VOO.yMax - 0.4);
                            en.mesh.position.set(en.posFinalX, en.altura, en.posFinalZ);
                        }
                    }
                }
                if (en.isBoss && en.nomeBoss && en.nomeBoss.includes('QUEEN') && en.posicionado) {
                    en.minionTimer = (en.minionTimer === undefined ? 4 : en.minionTimer) - dt;
                    if (en.minionTimer <= 0 && enemies.length < 30) {
                        en.minionTimer = 4 + Math.random() * 2;
                        invocarMinion(en);
                    }
                }

                // Colisão corpo-a-corpo: no 2D real, encostar num inimigo
                // não causa dano — mata o inimigo na hora (tipo um abate
                // por impacto). Só o tipo especial "blaze" explode e causa
                // dano de área, mas esse tipo ainda não foi portado.
                if (en.mesh.position.distanceTo(shipGroup.position) < ENEMY_TOUCH_RADIUS) {
                    matarOuRessuscitar(en);
                }
            });
}
