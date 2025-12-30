// server.js
const express = require(‘express’);
const http = require(‘http’);
const socketIO = require(‘socket.io’);
const mongoose = require(‘mongoose’);
const cors = require(‘cors’);
const crypto = require(‘crypto’);

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
cors: { origin: ‘*’ }
});

app.use(cors());
app.use(express.json());

// MongoDB Models
const UserSchema = new mongoose.Schema({
telegramId: { type: String, unique: true, required: true },
username: String,
balance: { type: Number, default: 0.09 },
gamesPlayed: { type: Number, default: 0 },
gamesWon: { type: Number, default: 0 },
totalWinnings: { type: Number, default: 0 },
betsHistory: Array,
createdAt: { type: Date, default: Date.now }
});

const GameRoundSchema = new mongoose.Schema({
roundId: { type: String, unique: true },
crashPoint: Number,
startTime: Date,
endTime: Date,
bets: Array,
adminControlled: { type: Boolean, default: false }
});

const User = mongoose.model(‘User’, UserSchema);
const GameRound = mongoose.model(‘GameRound’, GameRoundSchema);

mongoose.connect(process.env.MONGODB_URI || ‘mongodb://localhost:27017/crash-game’);

// GAME STATE - Автоматическая игра 24/7
let gameState = {
status: ‘waiting’, // waiting, countdown, flying, crashed
countdown: 10,
multiplier: 1.00,
crashPoint: null,
startTime: null,
roundId: null,
bets: [],
connectedPlayers: 0
};

let adminNextCrash = null; // Админ может установить следующий краш

// Генерация точки краша
function generateCrashPoint() {
if (adminNextCrash !== null) {
const crash = adminNextCrash;
adminNextCrash = null;
return crash;
}

// House edge ~3%
const r = Math.random();
if (r < 0.03) return 1.00;

// Провайдер справедливости
return Math.max(1.01, Math.floor((99 / (1 - Math.random() * 0.99)) * 100) / 100);
}

// АВТОМАТИЧЕСКИЙ ИГРОВОЙ ЦИКЛ 24/7
async function gameLoop() {
// 1. WAITING -> COUNTDOWN (10 секунд на ставки)
if (gameState.status === ‘waiting’) {
gameState.status = ‘countdown’;
gameState.countdown = 10;
gameState.roundId = crypto.randomBytes(8).toString(‘hex’);
gameState.crashPoint = generateCrashPoint();
gameState.bets = [];

```
io.emit('game_waiting', {
  roundId: gameState.roundId,
  countdown: gameState.countdown
});

// Обратный отсчет
const countdownInterval = setInterval(() => {
  gameState.countdown--;
  io.emit('countdown_tick', { countdown: gameState.countdown });
  
  if (gameState.countdown <= 0) {
    clearInterval(countdownInterval);
    startFlyingPhase();
  }
}, 1000);
```

}
}

async function startFlyingPhase() {
gameState.status = ‘flying’;
gameState.multiplier = 1.00;
gameState.startTime = new Date();

io.emit(‘game_started’, {
roundId: gameState.roundId,
startTime: gameState.startTime
});

// Рост множителя
const flyInterval = setInterval(async () => {
gameState.multiplier += 0.01;

```
io.emit('multiplier_update', {
  multiplier: gameState.multiplier.toFixed(2)
});

// Проверка автовыводов
for (let bet of gameState.bets) {
  if (bet.autoCashout && gameState.multiplier >= bet.autoCashout && bet.status === 'active') {
    await processCashout(bet);
  }
}

// Достигли точки краша
if (gameState.multiplier >= gameState.crashPoint) {
  clearInterval(flyInterval);
  await crashGame();
}
```

}, 50);
}

async function crashGame() {
gameState.status = ‘crashed’;

// Все активные ставки проиграли
for (let bet of gameState.bets) {
if (bet.status === ‘active’) {
bet.status = ‘lost’;
const user = await User.findOne({ telegramId: bet.userId });
if (user) {
user.gamesPlayed++;
await user.save();
}
}
}

// Сохранить раунд
await new GameRound({
roundId: gameState.roundId,
crashPoint: gameState.crashPoint,
startTime: gameState.startTime,
endTime: new Date(),
bets: gameState.bets
}).save();

io.emit(‘game_crashed’, {
crashPoint: gameState.crashPoint.toFixed(2),
roundId: gameState.roundId
});

// Ждем 3 секунды и начинаем новый раунд
setTimeout(() => {
gameState.status = ‘waiting’;
gameLoop();
}, 3000);
}

async function processCashout(bet) {
const winAmount = bet.amount * gameState.multiplier;
bet.status = ‘cashed_out’;
bet.cashoutMultiplier = gameState.multiplier;
bet.winAmount = winAmount;

const user = await User.findOne({ telegramId: bet.userId });
if (user) {
user.balance += winAmount;
user.gamesPlayed++;
user.gamesWon++;
user.totalWinnings += winAmount - bet.amount;
await user.save();
}

io.emit(‘player_cashed_out’, {
username: bet.username,
multiplier: gameState.multiplier.toFixed(2),
winAmount: winAmount.toFixed(2)
});

return winAmount;
}

// Socket.IO
io.on(‘connection’, (socket) => {
gameState.connectedPlayers++;
console.log(‘Player connected:’, socket.id, ‘| Online:’, gameState.connectedPlayers);

io.emit(‘players_update’, { count: gameState.connectedPlayers });

socket.emit(‘game_state’, {
status: gameState.status,
countdown: gameState.countdown,
multiplier: gameState.multiplier,
roundId: gameState.roundId,
bets: gameState.bets.map(b => ({
username: b.username,
amount: b.amount,
status: b.status
}))
});

socket.on(‘auth’, async (data) => {
const { telegramId, username } = data;
socket.userId = telegramId;
socket.username = username;

```
let user = await User.findOne({ telegramId });
if (!user) {
  user = new User({ telegramId, username });
  await user.save();
}

socket.emit('auth_success', {
  balance: user.balance,
  stats: {
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    totalWinnings: user.totalWinnings
  }
});
```

});

socket.on(‘place_bet’, async (data) => {
if (gameState.status !== ‘countdown’ && gameState.status !== ‘waiting’) {
socket.emit(‘bet_error’, { message: ‘Ставки закрыты’ });
return;
}

```
const { amount, autoCashout } = data;
const user = await User.findOne({ telegramId: socket.userId });

if (!user || user.balance < amount) {
  socket.emit('bet_error', { message: 'Недостаточно средств' });
  return;
}

user.balance -= amount;
await user.save();

const bet = {
  userId: socket.userId,
  username: socket.username,
  amount,
  autoCashout: autoCashout || null,
  status: 'active'
};

gameState.bets.push(bet);

io.emit('new_bet', {
  username: socket.username,
  amount: amount.toFixed(2)
});

socket.emit('bet_placed', {
  success: true,
  newBalance: user.balance.toFixed(2)
});
```

});

socket.on(‘cashout’, async () => {
if (gameState.status !== ‘flying’) {
socket.emit(‘cashout_error’, { message: ‘Нельзя вывести’ });
return;
}

```
const bet = gameState.bets.find(b => b.userId === socket.userId && b.status === 'active');
if (!bet) {
  socket.emit('cashout_error', { message: 'Нет активной ставки' });
  return;
}

const winAmount = await processCashout(bet);

const user = await User.findOne({ telegramId: socket.userId });
socket.emit('cashout_success', {
  winAmount: winAmount.toFixed(2),
  newBalance: user.balance.toFixed(2),
  multiplier: gameState.multiplier.toFixed(2)
});
```

});

socket.on(‘disconnect’, () => {
gameState.connectedPlayers–;
io.emit(‘players_update’, { count: gameState.connectedPlayers });
console.log(‘Player disconnected:’, socket.id, ‘| Online:’, gameState.connectedPlayers);
});
});

// ADMIN API
app.post(’/admin/set-crash’, (req, res) => {
const { crashPoint, adminKey } = req.body;

if (adminKey !== process.env.ADMIN_SECRET) {
return res.status(403).json({ error: ‘Неверный ключ’ });
}

adminNextCrash = parseFloat(crashPoint);
res.json({ success: true, message: `Следующий краш: ${crashPoint}x` });
});

app.post(’/admin/force-crash’, async (req, res) => {
const { adminKey } = req.body;

if (adminKey !== process.env.ADMIN_SECRET) {
return res.status(403).json({ error: ‘Неверный ключ’ });
}

if (gameState.status === ‘flying’) {
gameState.crashPoint = gameState.multiplier;
await crashGame();
res.json({ success: true, message: ‘Игра обрушена принудительно’ });
} else {
res.json({ success: false, message: ‘Игра не активна’ });
}
});

app.get(’/admin/stats’, async (req, res) => {
const { adminKey } = req.query;

if (adminKey !== process.env.ADMIN_SECRET) {
return res.status(403).json({ error: ‘Неверный ключ’ });
}

const totalUsers = await User.countDocuments();
const totalRounds = await GameRound.countDocuments();
const topUsers = await User.find().sort({ totalWinnings: -1 }).limit(10);

res.json({
totalUsers,
totalRounds,
onlinePlayers: gameState.connectedPlayers,
currentGame: {
status: gameState.status,
multiplier: gameState.multiplier.toFixed(2),
crashPoint: gameState.crashPoint,
bets: gameState.bets.length,
countdown: gameState.countdown
},
topUsers
});
});

app.get(’/api/history’, async (req, res) => {
const rounds = await GameRound.find()
.sort({ endTime: -1 })
.limit(20);
res.json(rounds);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`🚀 Server running on port ${PORT}`);
console.log(‘🎮 Starting automatic game loop…’);
gameLoop(); // Запуск автоматической игры 24/7
});

module.exports = { app, server };
