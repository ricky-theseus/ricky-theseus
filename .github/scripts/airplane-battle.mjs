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
  const gridY = 65;
  const PLANE_Y = 310;
  const COL_TIME = 2.5;

  const maxCount = Math.max(1, ...weeks.flatMap(w => w.contributionDays.map(d => d.contributionCount)));
  const cycleDur = cols * COL_TIME;

  function cellColor(count) {
    if (count === 0) return '#161b22';
    const i = Math.min(count / Math.max(maxCount, 1), 1);
    return `rgb(${Math.round(9 + i * 57)},${Math.round(110 + i * 127)},${Math.round(90 + i * 107)})`;
  }

  let cells = '', bullets = '', explosions = '';
  let hasHits = false;

  weeks.slice(0, cols).forEach((w, col) => {
    const cx = gridX + col * (CELL + GAP) + CELL / 2;
    let rowHitDelay = 0;
    w.contributionDays.forEach((d, row) => {
      const rx = gridX + col * (CELL + GAP);
      const ry = gridY + row * (CELL + GAP);
      const count = d.contributionCount;
      cells += `<rect x="${rx}" y="${ry}" width="${CELL}" height="${CELL}" rx="2" fill="${cellColor(count)}">
        <title>${d.date}: ${count}</title>
      </rect>\n`;
      if (count > 0) {
        hasHits = true;
        const t = col * COL_TIME + rowHitDelay;
        const bulletEndY = ry + CELL / 2;

        bullets += `<rect x="${cx - 1}" y="${PLANE_Y}" width="2" height="6" rx="1" fill="#fff700" filter="url(#glow)">
          <animate attributeName="y" values="${PLANE_Y};${bulletEndY}" dur="0.5s" begin="${t.toFixed(1)}s" fill="freeze"/>
          <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.7;1" dur="0.7s" begin="${t.toFixed(1)}s" fill="freeze"/>
        </rect>\n`;

        explosions += `<circle cx="${cx}" cy="${bulletEndY}" r="2" fill="none" stroke="#ff4444" stroke-width="2">
          <animate attributeName="r" values="2;${CELL * 1.2};0" dur="0.6s" begin="${(t + 0.4).toFixed(1)}s" fill="freeze"/>
          <animate attributeName="opacity" values="1;0.8;0" dur="0.6s" begin="${(t + 0.4).toFixed(1)}s" fill="freeze"/>
        </circle>\n`;
        explosions += `<circle cx="${cx}" cy="${bulletEndY}" r="1" fill="#ffe066">
          <animate attributeName="r" values="1;4;0" dur="0.5s" begin="${(t + 0.4).toFixed(1)}s" fill="freeze"/>
          <animate attributeName="opacity" values="1;0.6;0" dur="0.5s" begin="${(t + 0.4).toFixed(1)}s" fill="freeze"/>
        </circle>\n`;

        rowHitDelay += 0.6;
      }
    });
  });

  let planeAnims = '';
  if (cols > 0) {
    let values = [], times = [];
    weeks.slice(0, cols).forEach((w, col) => {
      const px = gridX + col * (CELL + GAP) + CELL / 2;
      const t0 = (col * COL_TIME / cycleDur).toFixed(3);
      const stay = ((col * COL_TIME + COL_TIME * 0.85) / cycleDur).toFixed(3);
      if (col === 0) {
        values.push(`${px},0`);
        times.push('0');
      }
      values.push(`${px},0`);
      times.push(stay);
      if (col < cols - 1) {
        const nextPx = gridX + (col + 1) * (CELL + GAP) + CELL / 2;
        const mvTime = ((col * COL_TIME + COL_TIME) / cycleDur).toFixed(3);
        values.push(`${nextPx},0`);
        times.push(mvTime);
      }
    });
    const lastT = '1';
    values.push(`${gridX + (cols - 1) * (CELL + GAP) + CELL / 2},0`);
    times.push(lastT);

    planeAnims = `<animateTransform attributeName="transform" type="translate" values="${values.join('; ')}" keyTimes="${times.join('; ')}" dur="${cycleDur}s" repeatCount="indefinite"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">
  <defs>
    <style>
      @keyframes starTwinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.7; } }
      .star { animation: starTwinkle 4s ease-in-out infinite; }
    </style>
    <radialGradient id="bg" cx="50%" cy="100%" r="80%">
      <stop offset="0%" stop-color="#1a2332"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${generateStars(W, H)}
  <text x="${W/2}" y="28" text-anchor="middle" fill="#e6edf3" font-family="system-ui,sans-serif" font-size="16" font-weight="bold">🚀 Contribution Battle</text>
  <text x="${W/2}" y="46" text-anchor="middle" fill="#8b949e" font-family="system-ui,sans-serif" font-size="11">${total} contributions in the last year</text>
  <g id="grid">${cells}</g>
  <g id="bullets" filter="url(#glow)">${bullets}</g>
  <g id="explosions">${explosions}</g>
  <g id="plane">
    <g>${airplaneSVG()}
    ${planeAnims}</g>
  </g>
</svg>`;
  return svg;
}

function generateStars(W, H) {
  let stars = '';
  const positions = [];
  for (let i = 0; i < 40; i++) {
    let x, y, key;
    do {
      x = Math.floor(Math.random() * W);
      y = Math.floor(Math.random() * (H * 0.55));
      key = `${x},${y}`;
    } while (positions.includes(key));
    positions.push(key);
    const r = Math.random() * 1.2 + 0.3;
    const delay = (Math.random() * 4).toFixed(2);
    const dur = (3 + Math.random() * 3).toFixed(1);
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" class="star" style="animation-delay:${delay}s;animation-duration:${dur}s"/>\n`;
  }
  return stars;
}

function airplaneSVG() {
  return `<g transform="translate(0, ${PLANE_Y})">
    <path d="M0,-12 L-6,4 L-2,2 L0,8 L2,2 L6,4 Z" fill="#58a6ff"/>
    <path d="M0,-12 L-2,2 L0,8 L2,2 Z" fill="#1f6feb"/>
    <path d="M-6,4 L-10,8 L-2,2" fill="#58a6ff" opacity="0.5"/>
    <path d="M6,4 L10,8 L2,2" fill="#58a6ff" opacity="0.5"/>
    <path d="M0,-4 L-1,1 L1,1 Z" fill="#ffe066" opacity="0.9"/>
    <ellipse cx="0" cy="-10" rx="3" ry="2" fill="#79c0ff" opacity="0.3"/>
  </g>`;
}

const PLANE_Y = 310;

async function main() {
  const data = await fetchContributions(USER);
  const svg = generateSVG(data.weeks || [], data.totalContributions || 0);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(OUT, svg);
  console.log(`Generated ${OUT} - ${data.totalContributions} total contributions`);
}

main().catch(e => { console.error(e); process.exit(1); });
