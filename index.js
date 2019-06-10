const pkg = require('./package.json');
const assert = require('assert');
const TelegramBot = require('node-telegram-bot-api');
const Unifi = require('ubnt-unifi');
const debug = require('debug');

const LOG = debug('app');
const POLLING_INTERVAL = 60;

LOG(`Starting ${pkg.name} v${pkg.version}`);

assert(process.env.UNIFI_USERNAME, 'UNIFI_USERNAME is not defined');
assert(process.env.UNIFI_PASSWORD, 'UNIFI_PASSWORD is not defined');
assert(process.env.UNIFI_AP_MAC, 'UNIFI_AP_MAC is not defined');
assert(process.env.TELEGRAM_TOKEN, 'TELEGRAM_TOKEN is not defined');

function parseNote(note) {
  if (!note) {
    return false;
  }

  const match = note.match(/user:(.+)/u);
  if (!match) {
    return false;
  }

  const name = match[1];

  return name;
}

const unifi = new Unifi({
  host: 'ctrl.mech.sh',
  port: 443,
  username: process.env.UNIFI_USERNAME,
  password: process.env.UNIFI_PASSWORD,
  site: 'default',
  insecure: true,
});

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

let visitors = [];

function updateUsers() => {
  LOG('Refreshing the user list.');
  unifi.get('stat/sta')
    .then(({ data }) => {
      const names = new Set();
      for (const { ap_mac, mac, note } of data) {
        const name = parseNote(note);

        if (name && ap_mac === process.env.UNIFI_AP_MAC) {
          LOG(`Visitor: ${mac} with name ${name}`);
          names.add(name);
        }
      }
      visitors = Array.from(names);
      LOG('User list refresh complete.');
    });
};

bot.onText(/\/(whoshome|whosthere)/, (msg) => {
  if (!visitors.length) {
    bot.sendMessage(msg.chat.id, 'В офисе, кажется, никого.');
    return;
  }
  bot.sendMessage(msg.chat.id, `*Сейчас в офисе:*\n${visitors.join('\n')}`, { parse_mode: 'Markdown' });
});

updateUsers();
setInterval(updateUsers, USERLIST_POLLING_INTERVAL * 1000);
