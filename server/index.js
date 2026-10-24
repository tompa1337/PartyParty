const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Room } = require('./game');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

// ---------- statiska filer ----------
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use('/vendor/leaflet', express.static(path.join(ROOT, 'node_modules/leaflet/dist')));
app.use('/vendor/world', express.static(path.join(ROOT, 'node_modules/world-atlas'), { maxAge: '7d' }));
app.use('/vendor/topojson', express.static(path.join(ROOT, 'node_modules/topojson-client/dist')));
app.use('/vendor/sortable', express.static(path.join(ROOT, 'node_modules/sortablejs')));
app.use('/vendor/fonts/bricolage', express.static(path.join(ROOT, 'node_modules/@fontsource-variable/bricolage-grotesque')));
app.use('/vendor/fonts/figtree', express.static(path.join(ROOT, 'node_modules/@fontsource/figtree')));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'public/tv.html')));
app.get('/spela', (_req, res) => res.sendFile(path.join(ROOT, 'public/play.html')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

// ---------- rum ----------
const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // utan I och O, som lätt förväxlas

function newCode() {
  for (let i = 0; i < 1000; i++) {
    const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    if (!rooms.has(code)) return code;
  }
  throw new Error('Inga lediga rumskoder');
}

// Samla ihop ändringar så att vi skickar högst en uppdatering per rum och tick.
const pending = new Set();
function scheduleBroadcast(room) {
  if (pending.has(room.code)) return;
  pending.add(room.code);
  setImmediate(() => {
    pending.delete(room.code);
    broadcast(room);
  });
}

function broadcast(room) {
  io.to(`tv:${room.code}`).emit('state', room.tvView());
  for (const p of room.players.values()) {
    if (p.connected) io.to(`player:${p.id}`).emit('state', room.playerView(p));
  }
}

function createRoom() {
  const room = new Room(newCode(), scheduleBroadcast);
  rooms.set(room.code, room);
  return room;
}

// Städa bort rum som ingen har använt på länge.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.hostConnected || room.connectedPlayers().length > 0;
    if (!anyone && now - room.lastActivity > 30 * 60 * 1000) {
      clearTimeout(room.timer);
      rooms.delete(code);
    }
  }
}, 60 * 1000);

// ---------- uppkopplingar ----------
io.on('connection', (socket) => {
  let room = null;
  let role = null;
  let playerId = null;

  // TV:n skapar eller återansluter till ett rum.
  socket.on('host:hello', async ({ code, origin } = {}, ack) => {
    room = (code && rooms.get(String(code).toUpperCase())) || createRoom();
    role = 'tv';
    room.hostConnected = true;
    socket.join(`tv:${room.code}`);
    if (origin && !room.joinUrl) {
      room.joinUrl = `${String(origin).replace(/\/$/, '')}/spela?rum=${room.code}`;
      try {
        room.qr = await QRCode.toDataURL(room.joinUrl, { margin: 1, width: 360, color: { dark: '#26221dff', light: '#00000000' } });
      } catch {
        room.qr = null;
      }
    }
    if (typeof ack === 'function') ack({ code: room.code });
    scheduleBroadcast(room);
  });

  socket.on('host:next', () => {
    if (role === 'tv' && room) room.hostNext();
  });

  socket.on('host:restart', () => {
    if (role === 'tv' && room && room.phase === 'podium') room.restart();
  });

  socket.on('host:new-room', (_d, ack) => {
    if (role !== 'tv') return;
    if (room) socket.leave(`tv:${room.code}`);
    room = null;
    if (typeof ack === 'function') ack({ ok: true });
  });

  // Mobilen frågar vilka figurer som redan är tagna innan man går med.
  socket.on('room:peek', ({ code } = {}, ack) => {
    if (typeof ack !== 'function') return;
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r) return ack({ exists: false, taken: [] });
    ack({ exists: true, taken: r.takenEmojis(), started: r.phase !== 'lobby' });
  });

  // En spelare går med eller återansluter.
  socket.on('player:join', ({ code, name, emoji, playerId: pid } = {}, ack) => {
    const r = rooms.get(String(code || '').toUpperCase());
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!r) return reply({ error: 'Hittar inget rum med den koden.' });
    const res = r.addOrRejoin({ playerId: pid, name, emoji });
    if (res.error) return reply({ error: res.error });
    room = r;
    role = 'player';
    playerId = res.player.id;
    socket.join(`player:${playerId}`);
    reply({ playerId, code: r.code });
    scheduleBroadcast(r);
  });

  const forPlayer = (fn) => (data, ack) => {
    if (role !== 'player' || !room) return;
    const out = fn(data || {});
    if (typeof ack === 'function') ack(out === undefined ? { ok: true } : out);
  };

  socket.on('player:ready', forPlayer((d) => room.setReady(playerId, d.ready !== false)));
  socket.on('player:bet', forPlayer((d) => room.placeBet(playerId, d.amount)));
  socket.on('player:answer', forPlayer((d) => room.answer(playerId, d)));
  socket.on('player:swipe', forPlayer((d) => room.swipe(playerId, d)));
  socket.on('player:next', forPlayer(() => room.pressNext(playerId)));

  socket.on('disconnect', () => {
    if (!room) return;
    if (role === 'tv') {
      const still = io.sockets.adapter.rooms.get(`tv:${room.code}`);
      room.hostConnected = !!(still && still.size);
    } else if (role === 'player') {
      const still = io.sockets.adapter.rooms.get(`player:${playerId}`);
      if (!still || !still.size) room.disconnect(playerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`PartyParty kör på http://localhost:${PORT}`);
});

module.exports = { server, rooms };
