// Estado sincronizado automaticamente com todos os clientes da sala.
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');

class Jogador extends Schema {}
defineTypes(Jogador, {
  id: 'string',        // sessionId da conexão
  uid: 'string',       // uid do Firebase (nunca confie em uid vindo do cliente)
  nome: 'string',
  nivel: 'number',
  avatarId: 'string',
  molduraId: 'string',
  tituloId: 'string',
  pronto: 'boolean',
  ping: 'number',      // ms, reportado pelo cliente e limitado pelo servidor
  conectado: 'boolean',
  // passo 5: estado da nave dentro da partida (o servidor só repassa, depois de limitar os valores)
  x: 'float32',
  y: 'float32',
  hp: 'float32',
  hpMax: 'float32',
  vivo: 'boolean',
});

class SalaState extends Schema {
  constructor() {
    super();
    this.jogadores = new MapSchema();
  }
}
defineTypes(SalaState, {
  codigo: 'string',
  hostId: 'string',
  modo: 'string',      // 'coop' | 'pvp'
  fase: 'string',      // 'lobby' | 'jogando' | 'fim'
  mapa: 'number',
  nivel: 'number',
  seed: 'number',      // semente do Math.random da partida (passo 6: inimigos iguais p/ todos)
  maxJogadores: 'number',
  jogadores: { map: Jogador },
});

module.exports = { Jogador, SalaState };
