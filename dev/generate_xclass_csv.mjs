import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

// Load environment variables from .env or .env.local if present
for (const envFile of ['.env', '.env.local']) {
  const p = path.join(ROOT, envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const value = m[2].trim().replace(/^["'](.*)["']$/s, '$1');
    if (value && !process.env[m[1]]) process.env[m[1]] = value;
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL is not set.');
  console.error('Please configure DATABASE_URL in your .env file or environment variables.');
  process.exit(1);
}

// Coordinates from standard XCLASS template for Room K315
const templateCoords = {
  K3150201: { x: 259, y: 492 },
  K3150202: { x: 324, y: 492 },
  K3150203: { x: 450, y: 491 },
  K3150204: { x: 511, y: 491 },
  K3150205: { x: 586, y: 491 },
  K3150206: { x: 654, y: 492 },
  K3150207: { x: 776, y: 487 },
  K3150208: { x: 846, y: 491 },
  K3150209: { x: 267, y: 402 },
  K3150210: { x: 324, y: 402 },
  K3150211: { x: 450, y: 401 },
  K3150212: { x: 511, y: 401 },
  K3150213: { x: 586, y: 401 },
  K3150214: { x: 654, y: 401 },
  K3150215: { x: 773, y: 408 },
  K3150216: { x: 851, y: 407 },
  K3150217: { x: 263, y: 334 },
  K3150218: { x: 324, y: 334 },
  K3150219: { x: 450, y: 333 },
  K3150220: { x: 511, y: 333 },
  K3150221: { x: 586, y: 333 },
  K3150222: { x: 654, y: 333 },
  K3150223: { x: 778, y: 328 },
  K3150224: { x: 850, y: 327 },
  K3150225: { x: 256, y: 266 },
  K3150226: { x: 324, y: 266 },
  K3150227: { x: 450, y: 265 },
  K3150228: { x: 511, y: 265 },
  K3150229: { x: 586, y: 265 },
  K3150230: { x: 654, y: 265 },
  K3150231: { x: 775, y: 258 },
  K3150232: { x: 856, y: 258 },
  K3150233: { x: 257, y: 170 },
  K3150234: { x: 318, y: 170 },
  K3150235: { x: 437, y: 169 },
  K3150236: { x: 512, y: 169 },
  K3150237: { x: 586, y: 169 },
  K3150238: { x: 654, y: 169 },
  K3150239: { x: 776, y: 168 },
  K3150240: { x: 846, y: 173 }
};

// Original export order of computers in XCLASS CSV template
const originalOrder = [
  'K3150238', 'K3150240', 'K3150233', 'K3150228', 'K3150214', 'K3150206',
  'K3150203', 'K3150223', 'K3150224', 'K3150225', 'K3150226', 'K3150222',
  'K3150215', 'K3150217', 'K3150216', 'K3150218', 'K3150219', 'K3150220',
  'K3150221', 'K3150208', 'K3150209', 'K3150210', 'K3150211', 'K3150213',
  'K3150212', 'K3150205', 'K3150204', 'K3150207', 'K3150202', 'K3150201',
  'K3150227', 'K3150237', 'K3150230', 'K3150236', 'K3150231', 'K3150235',
  'K3150234', 'K3150229', 'K3150232', 'K3150239'
];

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const classesRes = await client.query('select * from classes order by name');
    const studentsRes = await client.query('select * from students order by class, no');
    
    const outDir = path.join(ROOT, 'xclass_csv');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const targetClasses = classesRes.rows.map(c => c.name);
    if (targetClasses.length === 0) {
      console.log('No classes found in the database to export.');
      return;
    }

    for (const clsName of targetClasses) {
      const cls = classesRes.rows.find(c => c.name.toUpperCase() === clsName.toUpperCase());
      if (!cls) continue;

      const rawSeats = cls.seats ? cls.seats.split(',').map(s => s.trim()) : [];
      const students = studentsRes.rows.filter(s => s.class === cls.name);
      const studentMap = new Map();
      students.forEach(s => {
        if ((s.name && s.name.trim()) || (s.name_zh && s.name_zh.trim())) {
          studentMap.set(s.no, s);
        }
      });

      const pcStudentMap = {};
      for (let i = 0; i < 40; i++) {
        const pcNum = String(i + 1).padStart(2, '0');
        const pcName = `K31502${pcNum}`;
        const stNo = rawSeats[i] ? parseInt(rawSeats[i], 10) : null;
        const student = (stNo && studentMap.has(stNo)) ? studentMap.get(stNo) : null;
        pcStudentMap[pcName] = student;
      }

      const formats = [
        {
          suffix: '',
          formatName: (st) => st ? `${st.name || st.name_zh || ''} (${String(st.no).padStart(2, '0')})` : ''
        },
        {
          suffix: '_zh',
          formatName: (st) => st ? `${st.name_zh || st.name || ''} (${String(st.no).padStart(2, '0')})` : ''
        },
        {
          suffix: '_both',
          formatName: (st) => {
            if (!st) return '';
            const zh = st.name_zh ? `${st.name_zh} ` : '';
            return `${zh}${st.name || ''} (${String(st.no).padStart(2, '0')})`;
          }
        }
      ];

      for (const fmt of formats) {
        const lines = [];
        lines.push(`Teacher,default,,,`);
        lines.push(`Class,${cls.name},,,`);
        lines.push(`Computer Name,Student Name,Gender,X,Y`);

        for (const pc of originalOrder) {
          const coords = templateCoords[pc];
          const st = pcStudentMap[pc];
          const sName = fmt.formatName(st);
          const gender = st?.sex || 'M';
          lines.push(`${pc},${sName},${gender},${coords.x},${coords.y}`);
        }

        const fileName = `${cls.name}${fmt.suffix}.csv`;
        const filePath = path.join(outDir, fileName);
        fs.writeFileSync(filePath, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
        console.log(`Generated: xclass_csv/${fileName}`);
      }
    }

    console.log('\nAll XCLASS CSV files generated successfully in xclass_csv/');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
