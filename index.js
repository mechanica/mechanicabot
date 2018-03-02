const pkg = require('./package.json');
const assert = require('assert');
const TelegramBot = require('node-telegram-bot-api');
const Unifi = require('ubnt-unifi');
const debug = require('debug');

const LOG = debug('app');

LOG(`Starting ${pkg.name} v${pkg.version}`);

assert(process.env.UNIFI_USERNAME, 'UNIFI_USERNAME is not defined')
assert(process.env.UNIFI_PASSWORD, 'UNIFI_PASSWORD is not defined')
assert(process.env.UNIFI_AP_MAC, 'UNIFI_AP_MAC is not defined')
assert(process.env.TELEGRAM_TOKEN, 'TELEGRAM_TOKEN is not defined')

function parseNote(note) {
  if (!note) {
    return false;
  }

  const match = note.match(/user:([\wа-яА-Я]+)/u);
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
  polling: true
});

const visitors = {};

unifi.on('**', function (...args) {
  debug('unifi')('incoming event:', this.event, args);
});

unifi.on('ctrl.connect', () => LOG('connected'));
unifi.on('ctrl.disconnect', () => LOG('disconnected'));
unifi.on('ctrl.reconnect', () => LOG('reconnect'));
unifi.on('ctrl.error', (err) => LOG('error', err));

unifi.on('wu.connected', async (event) => {
  const { data } = await unifi.get(`stat/sta/${event.user}`);
  const { ap_mac, note } = data[0];

  const name = parseNote(note);

  if (name && ap_mac === process.env.UNIFI_AP_MAC) {
    LOG(`add visitor ${event.user} with name ${name}`);
    visitors[event.user] = { name };
  }
});

unifi.on('wu.disconnected', (event) => {
  if (!visitors[event.user]) {
    return;
  }

  const { name } = visitors[event.user];

  LOG(`remove visitor ${event.user} with name ${name}`);
  delete visitors[event.user];
});

unifi.get('stat/sta')
  .then(({ data }) => {
    for (const { ap_mac, mac, note } of data) {
      const name = parseNote(note);

      if (name && ap_mac === process.env.UNIFI_AP_MAC) {
        LOG(`add visitor ${mac} with name ${name}`);

        visitors[mac] = { name };
      }
    }
  });

bot.onText(/\/(whoshome|whosthere)/, (msg) => {
  const names = Object.values(visitors).map(e => e.name)

  bot.sendMessage(msg.chat.id, `*Сейчас в офисе:*\n${names.join('\n')}`, { parse_mode: 'Markdown' });
});