import https from 'https';
import fs from 'fs';

const USER = process.argv[2] || 'ricky-theseus';
const OUT = process.argv[3] || 'dist/airplane-battle-dark.svg';

async function fetchContributions(user) {
  const query = JSON.stringify({
    query: `query { user(login:"${user}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }`
  });
  const opts = {
    hostname: 'api.github.com', path: '/graphql', method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(query),
      'Authorization': `bearer ${process.env.GITHUB_TOKEN}`,
      'User-Agent': 'airplane-battle'
    }
  };
  return new Promise((ok, fail) => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const j = JSON.parse(data);
        ok(j.data?.user?.contributionsCollection?.contributionCalendar || { totalContributions: 0, weeks: [] });
      });
    });
    req.on('error', fail);
    req.write(query);
    req.end();
  });
}

function generateSVG(weeks, total) {
  const W = 800, H = 400;
  const CELL = 10, GAP = 2;
  const cols = Math.min(weeks.length, 53);
  const rows = 7;
  const gridW = cols * (CELL + GAP);
  const gridH = rows * (CELL + GAP);
  const gridX = Math.floor((W - gridW) / 2);
  const gridY = H - gridH - 40;

  const maxCount = Math.max(1, ...weeks.flatMap(w => w.contributionDays.map(d => d.contributionCount)));

  function cellColor(count) {
    if (count === 0) return '#161b22';
    const i = Math.min(count / Math.max(maxCount, 1), 1);
    const r = Math.round(9 + i * 57);
    const g = Math.round(110 + i * 127);
    const b = Math.round(90 + i * 107);
    return `rgb(${r},${g},${b})`;
  }

  let cells = '';
  let targets = '';
  let explosions = '';

  weeks.slice(0, cols).forEach((w, col) => {
    w.contributionDays.forEach((d, row) => {
      const x = gridX + col * (CELL + GAP);
      const y = gridY + row * (CELL + GAP);
      const count = d.contributionCount;
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${cellColor(count)}">
        <title>${d.date}: ${count} contributions</title>
      </rect>\n`;
      if (count > 0) {
        const delay = (col * 0.05 + row * 0.02).toFixed(2);
        targets += `<rect x="${x-1}" y="${y-1}" width="${CELL+2}" height="${CELL+2}" rx="3" fill="none" stroke="#ff6e6e" stroke-width="0.5" opacity="0" class="target" style="animation:targetIn ${(1+count/3).toFixed(1)}s ${delay}s infinite">
          <animate attributeName="opacity" values="0;0.6;0" dur="${(1.5+count/2).toFixed(1)}s" begin="${delay}s" repeatCount="indefinite"/>
        </rect>\n`;
        explosions += `<circle cx="${x+CELL/2}" cy="${y+CELL/2}" r="${CELL/2}" fill="none" stroke="#ff6e6e" stroke-width="1" opacity="0" class="explode">
          <animate attributeName="r" values="${CELL/2};${CELL*1.5};0" dur="0.8s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.8;0" dur="0.8s" begin="${delay}s" repeatCount="indefinite"/>
        </circle>\n`;
        explosions += `<circle cx="${x+CELL/2}" cy="${y+CELL/2}" r="2" fill="#ffe066" opacity="0" class="spark">
          <animate attributeName="opacity" values="0;1;0" dur="0.4s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="r" values="1;3;0" dur="0.4s" begin="${delay}s" repeatCount="indefinite"/>
        </circle>\n`;
      }
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">
  <defs>
    <style>
      @keyframes fly {
        0% { transform: translate(-120px, 0); }
        100% { transform: translate(920px, 0); }
      }
      @keyframes targetFade {
        0%, 100% { opacity: 0; }
        50% { opacity: 0.8; }
      }
      @keyframes bullet {
        0% { transform: translate(0, 0); opacity: 1; }
        100% { transform: translate(0, 60px); opacity: 0; }
      }
      @keyframes explodeAnim {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      .plane { animation: fly 4s linear infinite; }
      .bullet:nth-child(1) { animation: bullet 0.6s ease-in infinite; }
      .bullet:nth-child(2) { animation: bullet 0.6s ease-in 0.3s infinite; }
      @keyframes starTwinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 0.8; }
      }
      .star { animation: starTwinkle ${2 + Math.random() * 3}s ease-in-out infinite; }
    </style>
    <radialGradient id="bg" cx="50%" cy="100%" r="80%">
      <stop offset="0%" stop-color="#1a2332"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </radialGradient>
    <linearGradient id="bulletGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff700"/>
      <stop offset="100%" stop-color="#ff6e00"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${generateStars(W, H)}
  <text x="${W/2}" y="30" text-anchor="middle" fill="#e6edf3" font-family="system-ui,sans-serif" font-size="18" font-weight="bold">🚀 Contribution Battle</text>
  <text x="${W/2}" y="50" text-anchor="middle" fill="#8b949e" font-family="system-ui,sans-serif" font-size="12">${total} contributions in the last year</text>
  <g class="plane" filter="url(#glow)">
    ${generateAirplane()}
    <g class="bullets">${generateBullets()}</g>
  </g>
  <g id="grid">${cells}</g>
  <g id="effects">
    ${targets}
    ${explosions}
  </g>
</svg>`;
  return svg;
}

function generateStars(W, H) {
  let stars = '';
  const positions = [];
  for (let i = 0; i < 50; i++) {
    let x, y, key;
    do {
      x = Math.floor(Math.random() * W);
      y = Math.floor(Math.random() * (H * 0.6));
      key = `${x},${y}`;
    } while (positions.includes(key));
    positions.push(key);
    const r = Math.random() * 1.5 + 0.5;
    const delay = (Math.random() * 3).toFixed(2);
    const dur = (2 + Math.random() * 3).toFixed(1);
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" class="star" style="animation-delay:${delay}s;animation-duration:${dur}s"/>\n`;
  }
  return stars;
}

function generateAirplane() {
  return `<g transform="translate(50, 80)">
    <path d="M0,0 L15,-8 L12,0 L15,8 Z" fill="#58a6ff"/>
    <rect x="4" y="-1" width="10" height="2" rx="1" fill="#1f6feb"/>
    <path d="M8,-3 L10,-10 L12,-3" fill="#58a6ff" opacity="0.6"/>
    <path d="M2,-2 L0,-8 L5,-2" fill="#58a6ff" opacity="0.4"/>
    <path d="M2,2 L0,8 L5,2" fill="#58a6ff" opacity="0.4"/>
    <path d="M6,0 L8,-2 L8,2 Z" fill="#fff" opacity="0.8"/>
    <circle cx="6" cy="0" r="1.5" fill="#ffe066"/>
    <ellipse cx="14" cy="0" rx="4" ry="1.5" fill="#58a6ff" opacity="0.5"/>
  </g>`;
}

function generateBullets() {
  let bullets = '';
  for (let i = 0; i < 2; i++) {
    const delay = (i * 0.3).toFixed(1);
    bullets += `<rect x="${45 + i * 3}" y="95" width="2" height="10" rx="1" fill="url(#bulletGrad)" class="bullet" style="animation-delay:${delay}s;filter:url(#glow)"/>\n`;
  }
  return bullets;
}

async function main() {
  const data = await fetchContributions(USER);
  const svg = generateSVG(data.weeks || [], data.totalContributions || 0);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(OUT, svg);
  console.log(`Generated ${OUT} - ${data.totalContributions} total contributions`);
}

main().catch(e => { console.error(e); process.exit(1); });
