// ══════════════════════════════════════════════════════════════════
// PVP-CLIENT.JS — modo 1v1 dentro da partida (lado do jogo)
// Carregar em game3d.html DEPOIS do boss3d.js e do multiplayer-core.js e ANTES do online3d.js.
// O online3d.js usa este arquivo sozinho quando a URL tem &modo=pvp.
//
//  • o adversário fica de frente pra você (mesma distância das formações), com o X espelhado
//  • SEUS tiros: quando uma bala sua cruza o adversário, o jogo conta "acertei" e avisa o servidor
//    (ATUALIZAÇÃO: isso agora é só o EFEITO visual. Quem decide se acertou e tira a vida é o servidor,
//    que simula cada tiro — o aviso "acertei" deixou de ser enviado)
//  • PAUSA: se um dos dois cai e está reconectando, o servidor pausa a partida e este arquivo mostra o aviso
//  • os tiros DELE: aparecem vindo na sua direção (só visual)
//  • sua vida (barra do HUD) é a que o servidor mandar; ao levar dano toca o MESMO alerta do jogo
//  • ao zerar a vida: a MESMA explosão da nave do jogo (a do adversário explode na sua tela)
//  • fim da partida: a MESMA cinemática de VITÓRIA/DERROTA do jogo + tabela de estatísticas
// ══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  window.NRPvpClient = {
    // api = { M, sala: () => sala, fantasma: () => nave do adversário, aviso: (txt) => ... }
    criar: function (api) {
      var D = (typeof FORMACAO_Z_BASE !== 'undefined') ? Math.abs(FORMACAO_Z_BASE) : 22; // distância até o adversário
      var R_ACERTO = 1.6;   // raio de acerto (generoso: tela de celular)
      var ESCALA = 1.8;     // a nave dele está longe, então desenhamos maior
      var acertos = 0, terminou = false, pausado = false, ovPausa = null;
      var rodada = { n: 1, total: 1, placar: {}, fimLocal: 0, protecaoAte: 0 };
      var mortoNoRound = false, advExplodiu = false, ultimoAlerta = 0, danoAcum = 0, hud = null, ultimoHud = 0;

      function sala() { return api.sala(); }
      function meuId() { var s = sala(); return s ? s.sessionId : ''; }
      function eu() { var s = sala(); return s && s.state && s.state.jogadores.get(s.sessionId); }
      function adversario() {
        var s = sala(), r = null; if (!s || !s.state) return null;
        s.state.jogadores.forEach(function (j, id) { if (id !== s.sessionId) r = j; });
        return r;
      }
      function aviso(txt) { try { mostrarAvisoBoss(txt); } catch (e) { api.aviso(txt); } } // o mesmo aviso do jogo (ex.: "REVIVIDO")

      // Onde o adversário aparece NA MINHA TELA (X espelhado porque ele me encara)
      function posVisual(j) { return { x: -j.x, y: j.y, z: -D }; }
      // Onde nasce um tiro dele (vem na minha direção)
      function posTiro(d) { return { x: -d.x, y: d.y, z: -D + 1.2 }; }
      // Move um tiro dele (reto, em direção a mim). Devolve true quando deve sumir.
      function moverTiro(m, t, vel, dt) {
        m.position.z += vel * dt;
        m.position.x += -t.vx * 60 * dt;
        return m.position.z > 1;
      }

      // Seus tiros acertando o adversário (conferência por cruzamento: não perde balas em fps baixo)
      function checarAcertos() {
        var f = api.fantasma(); if (!f || typeof bullets === 'undefined') return;
        var vivo = f.nave.visible, gx = f.grupo.position.x, gy = f.grupo.position.y, zP = -D;
        for (var i = bullets.length - 1; i >= 0; i--) {
          var b = bullets[i], u = b.userData, z = b.position.z;
          if (u._pz !== undefined && vivo && u._pz > zP && z <= zP) {
            var t = (u._pz - zP) / (u._pz - z);
            var ix = u._px + (b.position.x - u._px) * t, iy = u._py + (b.position.y - u._py) * t;
            if (Math.hypot(ix - gx, iy - gy) < R_ACERTO) {
              acertos++;
              try { JUICE.acertoInimigo({ mesh: f.grupo, hitFlashTimer: 0, hp: 1 }, b.position, b.material.color, false); } catch (e) {}
              scene.remove(b); bullets.splice(i, 1); continue;
            }
          }
          u._pz = z; u._px = b.position.x; u._py = b.position.y;
        }
      }

      // Sua vida vem do servidor. Dano → alerta do jogo. Zerou → explosão do jogo.
      function sincronizarMinhaVida() {
        var j = eu();
        if (!j || j.hpMax < 100 || typeof playerHp === 'undefined') return;
        if (playerMaxHp !== j.hpMax) playerMaxHp = j.hpMax;
        if (playerHp !== j.hp) {
          var perdeu = playerHp - j.hp, antes = playerHp;
          playerHp = j.hp;
          try { atualizarHpBar(); } catch (e) {}
          if (perdeu > 0 && antes > 0) {
            danoAcum += perdeu;
            var agora = performance.now();
            // o jogo normal tem 1s de invencibilidade entre danos; aqui limitamos o alerta ao mesmo ritmo (senão a tela congela a cada tiro)
            if (agora - ultimoAlerta > 1000 || j.hp <= 0) {
              try { JUICE.danoJogador(shipGroup.position, Math.min(1, danoAcum / playerMaxHp), false); } catch (e) {}
              danoAcum = 0; ultimoAlerta = agora;
            }
          }
        }
        if (j.hp <= 0 && !mortoNoRound) { // a mesma explosão da sua nave no jogo normal
          mortoNoRound = true;
          try {
            JUICE.explosaoInimigo(shipGroup.position, { tipo: 'tank', hitRadius: 3.2, mesh: shipGroup });
            JUICE.morteJogador(shipGroup.position);
          } catch (e) {}
          naveDestruida = true; // a nave some e para de atirar até a próxima rodada
        }
      }

      // A nave do adversário explode na SUA tela quando a vida dele zera
      function vigiarAdversario() {
        var j = adversario(), f = api.fantasma();
        if (!j || !f || j.hpMax < 100 || advExplodiu || j.hp > 0) return;
        advExplodiu = true;
        try { JUICE.explosaoInimigo(f.grupo.position, { tipo: 'tank', hitRadius: 3.2, mesh: f.grupo }); } catch (e) {}
      }

      // ── PLACAR DE RODADAS (topo da tela) ─────────────────────────
      function atualizarHud() {
        var agora = performance.now();
        if (agora - ultimoHud < 250) return; ultimoHud = agora;
        if (!hud) {
          hud = document.createElement('div');
          hud.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 4px);left:50%;transform:translateX(-50%);z-index:9500;pointer-events:none;font:700 11px Orbitron,monospace;letter-spacing:1px;color:#cfeaff;background:#05101fcc;border:1px solid #0ff5;border-radius:8px;padding:4px 10px;text-align:center;white-space:nowrap';
          document.body.appendChild(hud);
        }
        var meu = rodada.placar[meuId()] || 0, adv = 0;
        Object.keys(rodada.placar).forEach(function (id) { if (id !== meuId()) adv += rodada.placar[id]; });
        var seg = Math.max(0, Math.ceil((rodada.fimLocal - agora) / 1000));
        var prep = agora < rodada.protecaoAte;
        hud.innerHTML = 'RODADA ' + rodada.n + '/' + rodada.total + ' · <span style="color:#4dff9a">VOCÊ ' + meu + '</span> – <span style="color:#ff5d73">' + adv + ' ADV</span> · ' + (pausado ? 'PAUSADO' : prep ? 'PREPARAR' : seg + 's');
      }

      // Eventos do servidor: a rodada começou / terminou
      function rodadaInicio(d) {
        var agora = performance.now();
        rodada = { n: d.n, total: d.total, placar: d.placar || {}, protecaoAte: agora + d.protecaoMs, fimLocal: agora + d.protecaoMs + d.duracaoMs };
        mortoNoRound = false; advExplodiu = false; danoAcum = 0;
        try { naveDestruida = false; } catch (e) {}                 // a nave volta (igual ao reviver do jogo)
        try { JUICE.filtroDerrota(false); } catch (e) {}
        if (d.n > 1) aviso('⚔ RODADA ' + d.n + ' — VAI!');
      }
      function rodadaFim(d) {
        rodada.placar = d.placar || rodada.placar;
        if (!d.vencedor) aviso('RODADA EMPATADA');
        else aviso(d.vencedor === meuId() ? '✔ VOCÊ VENCEU A RODADA' : '✖ VOCÊ PERDEU A RODADA');
      }

      // ── FIM DA PARTIDA: cinemática do jogo + tabela de estatísticas ──
      function celula(v) { return '<td style="padding:7px 8px;text-align:center;color:#fff">' + v + '</td>'; }
      function cardEstatisticas(d) {
        var meu = meuId(), ids = Object.keys(d.stats || {});
        ids.sort(function (a) { return a === meu ? -1 : 1; }); // você sempre na 1ª coluna
        var linhas = [
          ['Rodadas vencidas', function (s) { return s.rounds; }],
          ['Disparos', function (s) { return s.disparos; }],
          ['Acertos', function (s) { return s.acertos; }],
          ['Precisão', function (s) { return s.disparos ? Math.min(100, Math.round(100 * s.acertos / s.disparos)) + '%' : '–'; }],
          ['Dano causado', function (s) { return Math.round(s.dano); }],
          ['Dano sofrido', function (s) { return Math.round(s.sofrido); }],
        ];
        var cab = '<tr><th style="padding:8px"></th>' + ids.map(function (id) {
          var nome = String(d.stats[id].nome || 'Jogador').replace(/[<>&"']/g, '');
          return '<th style="padding:8px;font-size:11px;color:' + (id === meu ? '#4dff9a' : '#ff5d73') + '">' + (id === meu ? 'VOCÊ' : nome) + '</th>';
        }).join('') + '</tr>';
        var corpo = linhas.map(function (l) {
          return '<tr style="border-top:1px solid #ffffff14"><td style="padding:7px 8px;color:#9fb8d6;font-size:11px;text-align:left">' + l[0] + '</td>' +
            ids.map(function (id) { return celula(l[1](d.stats[id])); }).join('') + '</tr>';
        }).join('');
        return '<div style="width:min(92vw,380px);background:#07142a;border:1px solid #0ff5;border-radius:14px;padding:12px;box-shadow:0 0 24px #00ffff22">' +
          '<div style="font:700 11px Orbitron,monospace;letter-spacing:2px;color:#ff00cc;margin-bottom:6px">ESTATÍSTICAS · ' + d.jogadas + '/' + d.rodadas + ' RODADAS</div>' +
          '<table style="width:100%;border-collapse:collapse;font:13px \'Share Tech Mono\',monospace">' + cab + corpo + '</table></div>';
      }

      function mostrarCard(d) {
        try { jogoAtivo = false; } catch (e) {}
        var empate = !d.vencedor, venci = d.vencedor === meuId();
        var cor = empate ? '#ffd24d' : venci ? '#4dff9a' : '#ff5d73';
        var motivo = { nocaute: 'Nocaute!', tempo: 'Fim do tempo', 'adversario-saiu': 'O adversário saiu da partida' }[d.motivo] || '';
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#02050df2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:Orbitron,monospace;text-align:center;padding:20px;overflow:auto';
        ov.innerHTML = '<div style="font-size:30px;font-weight:900;letter-spacing:4px;color:' + cor + ';text-shadow:0 0 18px ' + cor + '">' + (empate ? 'EMPATE' : venci ? 'VITÓRIA' : 'DERROTA') + '</div>' +
          (motivo ? '<div style="color:#9fb8d6;font-size:12px;margin-top:-8px">' + motivo + '</div>' : '') +
          cardEstatisticas(d) +
          '<button id="nrVoltar" style="font:700 15px Orbitron,monospace;letter-spacing:2px;color:#00ffff;background:#06303a;border:1px solid #0ff8;border-radius:10px;padding:14px 26px">VOLTAR AO LOBBY</button>';
        document.body.appendChild(ov);
        document.getElementById('nrVoltar').onclick = function () { try { api.M.sair(); } catch (e) {} location.href = 'multiplayer.html'; };
      }

      // ── PAUSA (alguém caiu e está reconectando) ─────────────────
      // O servidor congela a partida e avisa os dois. Aqui só mostramos o aviso na tela; o online3d.js
      // consulta pausado() e não deixa você atirar enquanto estiver pausado.
      function mostrarPausa(on) {
        if (!ovPausa) {
          ovPausa = document.createElement('div');
          ovPausa.style.cssText = 'position:fixed;left:50%;top:34%;transform:translateX(-50%);z-index:9600;pointer-events:none;text-align:center;font:700 14px Orbitron,monospace;letter-spacing:1px;color:#ffd24d;background:#05101fe6;border:1px solid #ffd24d88;border-radius:10px;padding:12px 18px;max-width:80vw;text-shadow:0 0 8px #000';
          document.body.appendChild(ovPausa);
        }
        ovPausa.innerHTML = '⏸ PARTIDA PAUSADA<div style="font-size:11px;font-weight:400;margin-top:6px;opacity:.9">Um jogador está reconectando...<br>A partida continua quando ele voltar.</div>';
        ovPausa.style.display = on ? 'block' : 'none';
      }
      function pausa(d) {
        if (terminou || !d) return;
        pausado = !!d.on;
        mostrarPausa(pausado);
        if (!pausado && d.ativa) { // a partida voltou: acerta os relógios e o placar com o que o servidor mandou
          var agora = performance.now();
          rodada.n = d.n || rodada.n; rodada.total = d.total || rodada.total; rodada.placar = d.placar || rodada.placar;
          rodada.protecaoAte = agora + (d.protecaoMs || 0);
          rodada.fimLocal = agora + (d.protecaoMs || 0) + (d.duracaoMs || 0);
        } else if (!pausado && d.placar) rodada.placar = d.placar;
      }

      function fim(d) {
        if (terminou) return; terminou = true;
        pausado = false; if (ovPausa) ovPausa.style.display = 'none'; // partida acabou: some o aviso de pausa
        if (hud) hud.style.display = 'none';
        var empate = !d.vencedor, venci = d.vencedor === meuId();
        // espera ~1s para a explosão da última rodada aparecer, e roda a MESMA cinemática de vitória/derrota do jogo
        setTimeout(function () {
          if (!empate && typeof rodarCinematicaFinal === 'function') {
            try { rodarCinematicaFinal(venci ? 'vitoria' : 'derrota', function () { mostrarCard(d); }); return; } catch (e) {}
          }
          mostrarCard(d);
        }, 1000);
      }

      return {
        D: D, ESCALA: ESCALA,
        posVisual: posVisual, posTiro: posTiro, moverTiro: moverTiro,
        tick: function () { if (terminou) return; checarAcertos(); sincronizarMinhaVida(); vigiarAdversario(); atualizarHud(); },
        coletarAcertos: function () { var n = acertos; acertos = 0; return n; }, // o online3d.js manda isso pro servidor a cada 100ms
        rodadaInicio: rodadaInicio, rodadaFim: rodadaFim,
        pausa: pausa, pausado: function () { return pausado; },
        fim: fim, terminou: function () { return terminou; }
      };
    }
  };
})();
