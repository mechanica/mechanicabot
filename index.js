const TelegramBot = require('node-telegram-bot-api');
const Unifi = require('ubnt-unifi');
const debug = require('debug')

const LOG = debug('app')


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

  const name = parseNote(data[0].note);

  if (name) {
    LOG(`add visitor ${event.user} with name ${name}`);
    visitors[event.user] = { name };
  }
});

unifi.on('wu.disconnected', (event) => {
  const { name } = visitors[event.user];

  LOG(`remove visitor ${event.user} with name ${name}`);
  delete visitors[event.user];
});

unifi.get('stat/sta')
  .then(({ data }) => {
    for (const { mac, note } of data) {
      const name = parseNote(note);

      if (name) {
        LOG(`add visitor ${mac} with name ${name}`);

        visitors[mac] = { name };
      }
    }
  });

bot.onText(/\/(whoshome|whosthere)/, (msg) => {
  const names = Object.values(visitors).map(e => e.name)

  bot.sendMessage(msg.chat.id, `*Сейчас в офисе:*\n${names.join('\n')}`, { parse_mode: 'Markdown' });
});