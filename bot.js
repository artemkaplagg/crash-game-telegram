// bot.js
const { Bot, InlineKeyboard } = require(‘grammy’);
const axios = require(‘axios’);
require(‘dotenv’).config();

const bot = new Bot(process.env.BOT_TOKEN);

const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID; // ВАШ Telegram ID
const MINI_APP_URL = process.env.MINI_APP_URL;
const API_URL = process.env.API_URL || ‘http://localhost:3000’;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

console.log(‘🤖 Bot starting…’);
console.log(‘Admin ID:’, ADMIN_ID);

// Команда /start
bot.command(‘start’, async (ctx) => {
const keyboard = new InlineKeyboard()
.webApp(‘🚀 Играть в Crash’, MINI_APP_URL)
.row()
.text(‘💰 Баланс’, ‘balance’)
.text(‘📊 Статистика’, ‘stats’)
.row()
.text(‘🏆 Топ игроков’, ‘top’);

await ctx.reply(
`🚀 *Добро пожаловать в Crash Game!*\n\n` +
`Игра работает 24/7 автоматически!\n\n` +
`⏱ Каждые 10 секунд - новый раунд\n` +
`💎 Стартовый баланс: 0.09 PLAGG STARS\n` +
`🎯 Делай ставки и забирай выигрыш вовремя!\n\n` +
`Нажми кнопку ниже чтобы начать! 👇`,
{
parse_mode: ‘Markdown’,
reply_markup: keyboard
}
);
});

// Баланс
bot.callbackQuery(‘balance’, async (ctx) => {
try {
const userId = ctx.from.id.toString();
const response = await axios.get(`${API_URL}/api/user/${userId}`);
const user = response.data;

```
await ctx.answerCallbackQuery();

if (!user) {
  await ctx.reply('❌ Сначала начните игру!');
  return;
}

await ctx.reply(
  `💰 *Ваш баланс*\n\n` +
  `💎 ${user.balance.toFixed(2)} PLAGG STARS\n\n` +
  `🎮 Игр сыграно: ${user.gamesPlayed}\n` +
  `✅ Выиграно: ${user.gamesWon}\n` +
  `💵 Всего выигрышей: ${user.totalWinnings.toFixed(2)}`,
  { parse_mode: 'Markdown' }
);
```

} catch (error) {
console.error(‘Balance error:’, error);
await ctx.answerCallbackQuery({ text: ‘❌ Ошибка’, show_alert: true });
}
});

// Статистика
bot.callbackQuery(‘stats’, async (ctx) => {
try {
const userId = ctx.from.id.toString();
const response = await axios.get(`${API_URL}/api/user/${userId}`);
const user = response.data;

```
await ctx.answerCallbackQuery();

if (!user) {
  await ctx.reply('❌ Сначала начните игру!');
  return;
}

const winRate = user.gamesPlayed > 0 
  ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1)
  : 0;

await ctx.reply(
  `📊 *Ваша статистика*\n\n` +
  `🎮 Всего игр: ${user.gamesPlayed}\n` +
  `✅ Побед: ${user.gamesWon}\n` +
  `❌ Поражений: ${user.gamesPlayed - user.gamesWon}\n` +
  `📈 Винрейт: ${winRate}%\n\n` +
  `💰 Баланс: ${user.balance.toFixed(2)}\n` +
  `💵 Всего выигрышей: ${user.totalWinnings.toFixed(2)}`,
  { parse_mode: 'Markdown' }
);
```

} catch (error) {
console.error(‘Stats error:’, error);
}
});

// Топ игроков
bot.callbackQuery(‘top’, async (ctx) => {
try {
const response = await axios.get(`${API_URL}/api/leaderboard`);
const users = response.data;

```
await ctx.answerCallbackQuery();

if (!users || users.length === 0) {
  await ctx.reply('📊 Топ игроков пока пуст');
  return;
}

let message = `🏆 *Топ 10 игроков*\n\n`;
users.slice(0, 10).forEach((user, idx) => {
  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
  message += `${medal} ${user.username || 'Игрок'} - ${user.totalWinnings.toFixed(2)} PLAGG\n`;
});

await ctx.reply(message, { parse_mode: 'Markdown' });
```

} catch (error) {
console.error(‘Top error:’, error);
}
});

// =====================================================
// АДМИН ПАНЕЛЬ
// =====================================================

bot.command(‘admin’, async (ctx) => {
const userId = ctx.from.id.toString();

console.log(‘Admin command from:’, userId);
console.log(‘Expected admin:’, ADMIN_ID);

if (userId !== ADMIN_ID) {
await ctx.reply(‘❌ У вас нет доступа к админ-панели’);
return;
}

const keyboard = new InlineKeyboard()
.text(‘📊 Статистика’, ‘admin_stats’)
.row()
.text(‘🎯 Установить краш’, ‘admin_set_crash’)
.row()
.text(‘💥 Обрушить игру’, ‘admin_force_crash’)
.row()
.text(‘🔄 Обновить’, ‘admin_refresh’);

await ctx.reply(
`🔐 *Админ-панель*\n\n` +
`Выберите действие:`,
{
parse_mode: ‘Markdown’,
reply_markup: keyboard
}
);
});

// Статистика для админа
bot.callbackQuery(‘admin_stats’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

try {
const response = await axios.get(`${API_URL}/admin/stats`, {
params: { adminKey: ADMIN_SECRET }
});
const stats = response.data;

```
await ctx.answerCallbackQuery();
await ctx.editMessageText(
  `📊 *Статистика сервера*\n\n` +
  `👥 Всего игроков: ${stats.totalUsers}\n` +
  `🎮 Всего раундов: ${stats.totalRounds}\n` +
  `🟢 Онлайн: ${stats.onlinePlayers}\n\n` +
  `*Текущая игра:*\n` +
  `📍 Статус: ${stats.currentGame.status}\n` +
  `📈 Множитель: ${stats.currentGame.multiplier}x\n` +
  `💣 Точка краша: ${stats.currentGame.crashPoint ? stats.currentGame.crashPoint.toFixed(2) + 'x' : 'Генерация...'}\n` +
  `🎲 Ставок: ${stats.currentGame.bets}\n` +
  `⏱ Обратный отсчет: ${stats.currentGame.countdown}с`,
  {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('🔄 Обновить', 'admin_stats').row().text('◀️ Назад', 'admin_back')
  }
);
```

} catch (error) {
console.error(‘Admin stats error:’, error);
await ctx.answerCallbackQuery({ text: ‘❌ Ошибка загрузки’, show_alert: true });
}
});

// Установить краш
bot.callbackQuery(‘admin_set_crash’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

await ctx.answerCallbackQuery();
await ctx.editMessageText(
`🎯 *Установить точку краша*\n\n` +
`Отправьте число (множитель) для следующего раунда.\n` +
`Например: \`1.50` или `5.00`\n\n`+`⚠️ Это повлияет ТОЛЬКО на следующий раунд!`,
{
parse_mode: ‘Markdown’,
reply_markup: new InlineKeyboard().text(‘❌ Отмена’, ‘admin_back’)
}
);

// Ждем ответ от админа
bot.on(‘message:text’, async (msgCtx) => {
if (msgCtx.from.id.toString() !== ADMIN_ID) return;

```
const crashValue = parseFloat(msgCtx.message.text);

if (isNaN(crashValue) || crashValue < 1.00) {
  await msgCtx.reply('❌ Неверное значение! Введите число >= 1.00');
  return;
}

try {
  await axios.post(`${API_URL}/admin/set-crash`, {
    crashPoint: crashValue,
    adminKey: ADMIN_SECRET
  });

  await msgCtx.reply(
    `✅ *Краш установлен!*\n\n` +
    `Следующая игра обрушится на *${crashValue.toFixed(2)}x*\n\n` +
    `Это сработает в следующем раунде.`,
    { parse_mode: 'Markdown' }
  );
} catch (error) {
  await msgCtx.reply('❌ Ошибка установки краша');
}
```

});
});

// Обрушить игру принудительно
bot.callbackQuery(‘admin_force_crash’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

const keyboard = new InlineKeyboard()
.text(‘✅ Да, обрушить’, ‘confirm_crash’)
.text(‘❌ Отмена’, ‘admin_back’);

await ctx.answerCallbackQuery();
await ctx.editMessageText(
`⚠️ *ВНИМАНИЕ!*\n\n` +
`Вы уверены что хотите принудительно обрушить текущую игру?\n\n` +
`Это действие нельзя отменить!`,
{
parse_mode: ‘Markdown’,
reply_markup: keyboard
}
);
});

bot.callbackQuery(‘confirm_crash’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

try {
await axios.post(`${API_URL}/admin/force-crash`, {
adminKey: ADMIN_SECRET
});

```
await ctx.answerCallbackQuery({ text: '✅ Игра обрушена!', show_alert: true });
await ctx.editMessageText('💥 *Игра успешно обрушена!*', { parse_mode: 'Markdown' });
```

} catch (error) {
await ctx.answerCallbackQuery({ text: ‘❌ Ошибка’, show_alert: true });
}
});

// Обновить админ панель
bot.callbackQuery(‘admin_refresh’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

await ctx.answerCallbackQuery({ text: ‘🔄 Обновление…’ });

// Показываем главное меню админки
const keyboard = new InlineKeyboard()
.text(‘📊 Статистика’, ‘admin_stats’)
.row()
.text(‘🎯 Установить краш’, ‘admin_set_crash’)
.row()
.text(‘💥 Обрушить игру’, ‘admin_force_crash’)
.row()
.text(‘🔄 Обновить’, ‘admin_refresh’);

await ctx.editMessageText(
`🔐 *Админ-панель*\n\n` +
`Выберите действие:`,
{
parse_mode: ‘Markdown’,
reply_markup: keyboard
}
);
});

bot.callbackQuery(‘admin_back’, async (ctx) => {
if (ctx.from.id.toString() !== ADMIN_ID) {
await ctx.answerCallbackQuery({ text: ‘❌ Доступ запрещен’, show_alert: true });
return;
}

const keyboard = new InlineKeyboard()
.text(‘📊 Статистика’, ‘admin_stats’)
.row()
.text(‘🎯 Установить краш’, ‘admin_set_crash’)
.row()
.text(‘💥 Обрушить игру’, ‘admin_force_crash’)
.row()
.text(‘🔄 Обновить’, ‘admin_refresh’);

await ctx.answerCallbackQuery();
await ctx.editMessageText(
`🔐 *Админ-панель*\n\n` +
`Выберите действие:`,
{
parse_mode: ‘Markdown’,
reply_markup: keyboard
}
);
});

// Запуск бота
bot.catch((err) => {
console.error(‘❌ Bot error:’, err);
});

bot.start({
onStart: (botInfo) => {
console.log(`✅ Bot started: @${botInfo.username}`);
console.log(`🔐 Admin ID: ${ADMIN_ID}`);
}
});

module.exports = bot;
