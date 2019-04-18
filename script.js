let hash = location.hash.substr(1);

const REGEXP = /^(\/?(\d+)(,m(?:uted)?)?(,(-)?(?:(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?))?)+;(\d)x(\d)$/i;
const REGEXP_VOD = /^(\d+)(,m(?:uted)?)?(?:,(-)?(?:(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?))?$/i;

const matches = hash.match(REGEXP);
if (hash.startsWith('/'))
  hash = hash.substr(1);

const layout = {
  x: matches[matches.length - 2],
  y: matches[matches.length - 1]
};
let vods = hash
    .split(';')[0]
    .split('/')
    .map(str => {
      const v = str.match(REGEXP_VOD);

      const pos = v.length - 5;

      let start = 0;
      if (v[pos])
        start += parseInt(v[pos]) * 24 * 60 * 60;
      if (v[pos + 1])
        start += parseInt(v[pos + 1]) * 60 * 60;
      if (v[pos + 2])
        start += parseInt(v[pos + 2]) * 60;
      if (v[pos + 3])
        start += parseInt(v[pos + 3]);
      if (v[pos + 4])
        start += parseFloat('0.' + v[pos + 4].padStart(3, '0'));
      if(v[pos-1])
        start = -start;

      return {
        id: v[1], start,
        muted: !!v[2]
      };
    });

const overlay = document.querySelector('.overlay');
const seeker = document.querySelector('#seeker');
const quality = document.querySelector('#quality');
const totalDuration = document.querySelector('#total-duration');
const currentTime = document.querySelector('#current-time');
const confirmVideos = document.querySelector('#confirm-videos');
const mainUI = document.querySelector('#main-ui');
const resyncButton = document.querySelector('#resync-videos');
const pausePlayButton = document.querySelector('#pause-play');

let videosConfirmed;

const players = [];

resyncButton.addEventListener('click', seek);
function pauseAll() {
  for(const player of players)
    player.pause();
}
function playAll() {
  for(const player of players)
    player.play();
}
function setQuality() {
  for(const player of players) {
    player.setQuality(quality.value);
  }
}
function seek() {
  for(let i = 0; i < players.length; i++) {
    players[i].seek(vods[i].start + parseFloat(seeker.value));
  }
  pauseAll();
}
pausePlayButton.addEventListener('click', e => {
  if(players[0].isPaused())
    playAll();
  else
    pauseAll();
});
confirmVideos.querySelector('button').addEventListener('click', e => {
  videosConfirmed = true;
  confirmVideos.style.display = 'none';
  mainUI.classList.remove('invisible');
  seekSetup();
});

let x = 1, y = 1;
for(let vod of vods) {
  if(x <= layout.x) {
    const player = new Twitch.Player(`v-${x}-${y}`, {
      width: '',
      height: '',
      video: vod.id
    });
    player.setMuted(vod.muted);
    player.pause();
    players.push(player);
  }
  if(++x > layout.x) {
    x = 1;
    if(++y > layout.y)
      break;
  }
}
setQuality();

const rows = document.querySelectorAll('.row');
const cells = document.querySelectorAll('.cell');
for(const cell of cells) {
  if(!cell.querySelector('iframe'))
    cell.parentNode.removeChild(cell);
}
for(const row of rows) {
  if(!row.querySelector('.cell'))
    row.parentNode.removeChild(row);
}

function formatTime(n) {
  const hours = Math.floor(n / 60 / 60).toString();
  const minutes = Math.floor((n - hours * 60 * 60) / 60).toString();
  const seconds = Math.floor(n - hours * 60 * 60 - minutes * 60).toString();
  return `${hours.padStart(2, '0')}h${minutes.padStart(2, '0')}m${seconds.padStart(2, '0')}s`;
}
let shortestDuration = Infinity;
let seeked;
function seekSetup() {
  if(seeked)
    return;
  seeked = true;
  for(let i = 0; i < vods.length; i++) {
    const duration = players[i].getDuration() - vods[i].start;
    if(shortestDuration > duration)
      shortestDuration = duration;
    players[i].__start = vods[i].start;
  }
  setQuality();
  seeker.max = shortestDuration;
  totalDuration.textContent = formatTime(shortestDuration);
}

document.body.addEventListener('keyup', e => {
  if(!seeked)
    return;
  if(e.key === ' ') {
    e.preventDefault();
    if(!players[0].isPaused())
      pauseAll();
    else
      playAll();
  }
});

quality.addEventListener('change', setQuality);
seeker.addEventListener('change', seek);

setInterval(() => {
  if(!seeked)
    return;
  const val = players[0].getCurrentTime() - players[0].__start;
  seeker.value = val;
  currentTime.textContent = formatTime(val);
  for(const player of players) {
    if(player.__start < 0 && -player.__start > val) {
      if(player.getCurrentTime() !== 0)
        player.seek(0);
      if(!player.isPaused())
        player.pause();
    } else if(-player.__start <= val && !players[0].isPaused() && player.isPaused()) {
      player.play();
    }
  }
}, 950);

let uiTimeout;
function delayUIDisappearance() {
  if(!videosConfirmed)
    return;
  overlay.style.opacity = '1';
  if(uiTimeout)
    clearTimeout(uiTimeout);
  uiTimeout = setTimeout(hideUI, 3000);
}
function hideUI() {
  overlay.style.opacity = '0.001';
}

document.documentElement.addEventListener('mousemove', delayUIDisappearance);
document.documentElement.addEventListener('click', delayUIDisappearance);
document.documentElement.addEventListener('keydown', delayUIDisappearance);