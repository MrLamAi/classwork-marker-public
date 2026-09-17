import pg from 'pg';
import ScheduleEngine from './schedule-engine.js';

export const TZ = 'Asia/Hong_Kong';

const DEFAULT_TOTAL = 40;
const DEFAULT_COLS = 8;
const MAX_ROWS = 10;

// Neon hands back timestamptz; keep it a Date rather than a string.
pg.types.setTypeParser(1114, (v) => new Date(v + 'Z'));

let pool;

/** One pool per warm container - Vercel reuses the module between invocations. */
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function sql(text, params = []) {
  const res = await getPool().query(text, params);
  return res.rows;
}

/* ------------------------------------------------------------------ schema */

let schemaReady = null;

export function ensureSchema() {
  if (!schemaReady) schemaReady = buildSchema().catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

async function buildSchema() {
  await sql(`
    create table if not exists classes (
      name  text primary key,
      total int  not null default ${DEFAULT_TOTAL},
      cols  int  not null default ${DEFAULT_COLS},
      seats text not null default ''
    );
    create table if not exists students (
      class text not null references classes(name) on update cascade on delete cascade,
      no    int  not null,
      name  text,
      primary key (class, no)
    );
    alter table students alter column name drop not null;
    alter table students add column if not exists name_zh text;
    alter table students add column if not exists name_en text;
    alter table students add column if not exists sex text;
    create table if not exists sessions (
      id         text primary key,
      class      text not null references classes(name) on update cascade on delete cascade,
      name       text not null,
      created_at timestamptz not null default now()
    );
    create table if not exists marks (
      session_id text not null references sessions(id) on delete cascade,
      student_no int  not null,
      marked_at  timestamptz not null default now(),
      primary key (session_id, student_no)
    );
    create table if not exists lesson_events (
      id         bigserial primary key,
      session_id text not null references sessions(id) on delete cascade,
      class      text not null references classes(name) on update cascade on delete cascade,
      student_no int  not null,
      type       text not null,
      label      text not null,
      note       text default '',
      created_at timestamptz not null default now()
    );
    create table if not exists discipline_records (
      id          bigserial primary key,
      class       text not null references classes(name) on update cascade on delete cascade,
      student_no  int  not null,
      record_date date not null default (now() at time zone '${TZ}')::date,
      record_time text not null default '',
      type        text not null,
      label       text not null,
      note        text default '',
      created_at  timestamptz not null default now()
    );
    create index if not exists sessions_class_created on sessions (class, created_at desc);
    create index if not exists lesson_events_session_idx on lesson_events (session_id, created_at desc);
    create index if not exists lesson_events_class_idx on lesson_events (class, created_at desc);
    create index if not exists discipline_student_idx on discipline_records (class, student_no, record_date desc, created_at desc);
    create index if not exists discipline_class_date_idx on discipline_records (class, record_date desc);
    create table if not exists class_lessons (
      class       text not null references classes(name) on update cascade on delete cascade,
      lesson_date date not null,
      note        text default '',
      created_at  timestamptz not null default now(),
      primary key (class, lesson_date)
    );
    create index if not exists class_lessons_idx on class_lessons (class, lesson_date desc);
  `);

  // Ensure all timetable schedule classes exist in classes table
  const defaultScheduleClasses = [
    { name: '1A', total: 32, cols: 8 },
    { name: '1D', total: 32, cols: 8 },
    { name: '2A', total: 30, cols: 6 },
    { name: '2B', total: 32, cols: 8 },
    { name: '2C', total: 32, cols: 8 },
    { name: '2D', total: 32, cols: 8 },
    { name: '4C', total: 38, cols: 6 }
  ];
  for (const sc of defaultScheduleClasses) {
    const seats = Array.from({ length: sc.total }, (_, i) => String(i + 1)).join(',');
    await sql(
      `insert into classes (name, total, cols, seats) values ($1, $2, $3, $4)
       on conflict (name) do nothing`,
      [sc.name, sc.total, sc.cols, seats]
    );
  }

  // 1. Demo student rosters for all schedule classes
  const demoStudentsByClass = {
    '1A': [
      [1, '陳大文', 'Chan Tai Man', '', 'M'],
      [2, '黃小明', 'Wong Siu Ming', 'Michael', 'M'],
      [3, '李嘉欣', 'Lee Ka Yan', '', 'F'],
      [4, '何俊傑', 'Ho Chun Kit', '', 'M'],
      [5, '吳偉霖', 'Ng Wai Lam', '', 'M'],
      [6, '張浩然', 'Cheung Ho Yin', '', 'M'],
      [7, '林嘉盈', 'Lam Ka Ying', '', 'F'],
      [8, '曾志恒', 'Tsang Chi Hang', '', 'M'],
      [9, '楊美玲', 'Yeung Mei Ling', 'Amy', 'F'],
      [10, '郭子晴', 'Kwok Tsz Ching', '', 'F'],
      [11, '歐陽建', 'Au Yeung Kin', '', 'M'],
      [12, '潘思慧', 'Poon Sze Wai', '', 'F'],
      [13, '周家豪', 'Chow Ka Ho', '', 'M'],
      [14, '譚婉婷', 'Tam Yuen Ting', '', 'F'],
      [15, '馮志偉', 'Fung Chi Wai', '', 'M'],
      [16, '蘇文杰', 'So Man Kit', '', 'M'],
      [17, '劉凱靖', 'Lau Hoi Ching', '', 'F'],
      [18, '葉家文', 'Yip Ka Man', '', 'M'],
      [19, '麥子翹', 'Mak Tsz Kiu', '', 'F'],
      [20, '沈穎恩', 'Shum Wing Yan', 'Grace', 'F']
    ],
    '1D': [
      [1, '趙子龍', 'Chiu Tsz Lung', 'Alex', 'M'],
      [2, '許敏儀', 'Hui Man Yee', '', 'F'],
      [3, '莫家軒', 'Mok Ka Hin', '', 'M'],
      [4, '鍾雪盈', 'Chung Suet Ying', 'Chloe', 'F'],
      [5, '杜卓言', 'To Cheuk Yin', '', 'M'],
      [6, '羅芷晴', 'Law Tsz Ching', '', 'F'],
      [7, '梁晉銘', 'Leung Chun Ming', '', 'M'],
      [8, '尹思琪', 'Wan Sze Ki', '', 'F'],
      [9, '施俊希', 'Sze Chun Hei', 'Isaac', 'M'],
      [10, '邱曉晴', 'Yau Hiu Ching', '', 'F'],
      [11, '蔡展鵬', 'Choi Chin Pang', '', 'M'],
      [12, '陸泳芝', 'Luk Wing Chi', 'Gigi', 'F'],
      [13, '鄭天佑', 'Cheng Tin Yau', '', 'M'],
      [14, '錢婉儀', 'Chin Yuen Yee', '', 'F'],
      [15, '嚴朗廷', 'Yim Long Ting', 'Eric', 'M'],
      [16, '韓欣怡', 'Hon Yan Yi', '', 'F'],
      [17, '莊家銘', 'Chong Ka Ming', '', 'M'],
      [18, '藍芷琳', 'Lam Tsz Lam', '', 'F'],
      [19, '顧焯軒', 'Ku Cheuk Hin', '', 'M'],
      [20, '龔慧珊', 'Kung Wai Shan', '', 'F']
    ],
    '2A': [
      [1, '陳卓賢', 'Chan Cheuk Yin', 'Ian', 'M'],
      [2, '梁仲恆', 'Leung Chung Hang', '', 'M'],
      [3, '鄭詠詩', 'Cheng Wing Sze', 'Cynthia', 'F'],
      [4, '盧瀚霆', 'Lo Hon Ting', 'Anson', 'M'],
      [5, '呂爵安', 'Lui Cheuk On', 'Edan', 'M'],
      [6, '謝安琪', 'Tse On Ki', 'Kay', 'F'],
      [7, '容祖兒', 'Yung Cho Yee', 'Joey', 'F'],
      [8, '張敬軒', 'Cheung King Hin', 'Hins', 'M'],
      [9, '王菀之', 'Wong Yuen Chi', 'Ivana', 'F'],
      [10, '林家謙', 'Lam Ka Him', 'Terence', 'M'],
      [11, '鄧麗欣', 'Tang Lai Yan', 'Stephy', 'F'],
      [12, '方力申', 'Fong Lik Sun', 'Alex', 'M'],
      [13, '衛蘭', 'Wai Lan', 'Janice', 'F'],
      [14, '周柏豪', 'Chow Pak Ho', 'Pakho', 'M'],
      [15, '連詩雅', 'Lin Sze Nga', 'Shiga', 'F'],
      [16, '許廷鏗', 'Hui Ting Hang', 'Alfred', 'M'],
      [17, '吳雨霏', 'Ng Yu Fai', 'Kary', 'F'],
      [18, '洪嘉豪', 'Hung Ka Ho', 'Kaho', 'M'],
      [19, '陳蕾', 'Chan Lui', 'Panther', 'F'],
      [20, '馮允謙', 'Fung Wan Him', 'Jay', 'M']
    ],
    '2B': [
      [1, '朱俊彥', 'Chu Chun Yin', '', 'M'],
      [2, '唐穎思', 'Tong Wing Sze', '', 'F'],
      [3, '溫卓峰', 'Wan Cheuk Fung', 'Kelvin', 'M'],
      [4, '方芷晴', 'Fong Tsz Ching', '', 'F'],
      [5, '岑皓天', 'Sham Ho Tin', '', 'M'],
      [6, '卓雅婷', 'Cheuk Nga Ting', '', 'F'],
      [7, '邵冠宇', 'Shiu Kwun Yu', 'Kevin', 'M'],
      [8, '殷佩儀', 'Yan Pui Yee', '', 'F'],
      [9, '易家豪', 'Yik Ka Ho', '', 'M'],
      [10, '俞詠恩', 'Yu Wing Yan', '', 'F'],
      [11, '侯逸朗', 'Hau Yat Long', '', 'M'],
      [12, '倪嘉敏', 'Ngai Ka Man', '', 'F'],
      [13, '祝文聰', 'Chuk Man Chung', '', 'M'],
      [14, '符美華', 'Foo Mei Wah', '', 'F'],
      [15, '談浩然', 'Tam Ho Yin', 'Brian', 'M'],
      [16, '康曉彤', 'Hong Hiu Tung', '', 'F'],
      [17, '陶啟銘', 'To Kai Ming', '', 'M'],
      [18, '莫紫珊', 'Mok Tsz Shan', '', 'F'],
      [19, '崔子謙', 'Tsui Tsz Him', '', 'M'],
      [20, '彭心怡', 'Pang Sum Yi', '', 'F']
    ],
    '2C': [
      [1, '袁啟康', 'Yuen Kai Hong', '', 'M'],
      [2, '區嘉麗', 'Au Ka Lai', '', 'F'],
      [3, '伍智恆', 'Ng Chi Hang', 'Tommy', 'M'],
      [4, '簡穎彤', 'Kan Wing Tung', '', 'F'],
      [5, '駱俊傑', 'Lok Chun Kit', '', 'M'],
      [6, '卞秀珍', 'Pin Sau Chun', '', 'F'],
      [7, '霍展程', 'Fok Chin Ching', '', 'M'],
      [8, '費敏芝', 'Fai Man Chi', '', 'F'],
      [9, '紀家榮', 'Kei Ka Wing', '', 'M'],
      [10, '韋靜怡', 'Wai Ching Yi', 'Kelly', 'F'],
      [11, '洪文瀚', 'Hung Man Hon', '', 'M'],
      [12, '柴倩茹', 'Chai Sin Yu', '', 'F'],
      [13, '范子敬', 'Fan Tsz King', '', 'M'],
      [14, '耿嘉宜', 'Kang Ka Yi', '', 'F'],
      [15, '郎智聰', 'Long Chi Chung', '', 'M'],
      [16, '凌寶儀', 'Ling Po Yee', '', 'F'],
      [17, '虞俊德', 'Yu Chun Tak', '', 'M'],
      [18, '景詠琳', 'King Wing Lam', '', 'F'],
      [19, '鮑卓立', 'Pau Cheuk Lap', '', 'M'],
      [20, '苗心悠', 'Miu Sum Yau', '', 'F']
    ],
    '2D': [
      [1, '戴偉健', 'Tai Kin', 'Kenny', 'M'],
      [2, '蒲美婷', 'Po Mei Ting', '', 'F'],
      [3, '饒家俊', 'Yiu Ka Chun', '', 'M'],
      [4, '黎若晴', 'Lai Yeuk Ching', '', 'F'],
      [5, '魏俊宇', 'Ngai Chun Yu', '', 'M'],
      [6, '龐淑華', 'Pong Shuk Wah', '', 'F'],
      [7, '譚永熹', 'Tam Wing Hei', '', 'M'],
      [8, '羅曼凝', 'Law Man Ying', '', 'F'],
      [9, '蘇文瀚', 'So Man Hon', '', 'M'],
      [10, '顧穎芝', 'Ku Wing Chi', '', 'F'],
      [11, '龔子軒', 'Kung Tsz Hin', '', 'M'],
      [12, '欒佩珊', 'Luen Pui Shan', '', 'F'],
      [13, '嚴俊傑', 'Yim Chun Kit', '', 'M'],
      [14, '竇嘉敏', 'Tau Ka Man', '', 'F'],
      [15, '繆晉邦', 'Miu Chun Pong', '', 'M'],
      [16, '邊曉雯', 'Pin Hiu Man', '', 'F'],
      [17, '廉子韜', 'Lim Tsz To', '', 'M'],
      [18, '司徒勇', 'Szeto Yung', '', 'M'],
      [19, '上官婉', 'Sheungkwun Yuen', '', 'F'],
      [20, '諸葛朗', 'Chukot Long', '', 'M']
    ],
    '4C': [
      [1, '李思銘', 'Lee Sze Ming', 'Samuel', 'M'],
      [2, '張曼婷', 'Cheung Man Ting', 'Tiffany', 'F'],
      [3, '王智聰', 'Wong Chi Chung', 'Justin', 'M'],
      [4, '陳曉澄', 'Chan Hiu Ching', 'Natalie', 'F'],
      [5, '梁家銘', 'Leung Ka Ming', 'Kenneth', 'M'],
      [6, '黃紫晴', 'Wong Tsz Ching', 'Janice', 'F'],
      [7, '趙永樂', 'Chiu Wing Lok', 'Ronald', 'M'],
      [8, '劉詠茵', 'Lau Wing Yan', 'Rachel', 'F'],
      [9, '潘梓朗', 'Poon Tsz Long', 'Ryan', 'M'],
      [10, '何佩珊', 'Ho Pui Shan', 'Shirley', 'F'],
      [11, '鄭希賢', 'Cheng Hei Yin', 'Marcus', 'M'],
      [12, '郭敏芝', 'Kwok Man Chi', 'Mandy', 'F'],
      [13, '謝家俊', 'Tse Ka Chun', 'Jason', 'M'],
      [14, '蔡淑婷', 'Choi Shuk Ting', 'Stephanie', 'F'],
      [15, '馮耀廷', 'Fung Yiu Ting', 'Vincent', 'M'],
      [16, '吳卓言', 'Ng Cheuk Yin', 'Matthew', 'M'],
      [17, '董樂儀', 'Tung Lok Yi', 'Vanessa', 'F'],
      [18, '鄧子浩', 'Tang Tsz Ho', 'Howard', 'M'],
      [19, '關詠嵐', 'Kwan Wing Lam', 'Karen', 'F'],
      [20, '鍾卓賢', 'Chung Cheuk Yin', 'Daniel', 'M'],
      [21, '盧美寶', 'Lo Mei Po', 'Mabel', 'F'],
      [22, '曾浩天', 'Tsang Ho Tin', 'Alvin', 'M'],
      [23, '許嘉欣', 'Hui Ka Yan', 'Vivian', 'F'],
      [24, '馬展鵬', 'Ma Chin Pang', 'Patrick', 'M']
    ]
  };

  // 2. Demo discipline events per class [studentNo, daysAgoIndex, time, type, label, note]
  const demoDisciplineByClass = {
    '1A': [
      [8, 0, '09:15', 'no_book', '欠帶課本', '未帶課本'],
      [8, 0, '09:35', 'talking', '說話分心', '與同桌交頭接耳'],
      [3, 0, '09:20', 'good_perf', '積極答問', '回答題目正確且詳盡'],
      [5, 0, '09:40', 'talking', '說話分心', '課堂討論過於喧嘩'],
      [8, 1, '14:20', 'no_hw', '欠交功課', '工作紙第3課未交'],
      [8, 1, '14:25', 'no_book', '欠帶課本', '上一堂未帶課本'],
      [3, 1, '11:15', 'good_perf', '積極答問', '主動上台板書解題'],
      [1, 1, '11:30', 'good_perf', '積極答問', '踴躍回答'],
      [8, 2, '10:05', 'no_book', '欠帶課本', '欠帶作業本'],
      [8, 2, '10:30', 'sleeping', '課堂睡覺', '伏在課桌上'],
      [4, 2, '10:20', 'good_perf', '專注投入', '認真筆記']
    ],
    '1D': [
      [5, 0, '10:15', 'no_book', '欠帶課本', '忘記帶課本及練習簿'],
      [5, 0, '10:40', 'talking', '說話分心', '上課時轉身與後座說話'],
      [1, 0, '10:25', 'good_perf', '積極答問', '熱心回答老師提問'],
      [8, 0, '10:35', 'good_perf', '積極答問', '主動分享分組討論結果'],
      [5, 1, '13:30', 'no_book', '欠帶課本', '連續欠帶課本'],
      [3, 1, '13:45', 'sleeping', '課堂睡覺', '午膳後疲倦伏在桌上'],
      [1, 1, '14:10', 'good_perf', '積極答問', '課堂表現積極主動'],
      [5, 2, '09:10', 'no_hw', '欠交功課', '數學工作紙未交'],
      [9, 2, '09:30', 'warning', '違規警告', '未經許可擅自離座'],
      [4, 2, '09:50', 'good_perf', '積極答問', '作業表現優良']
    ],
    '2A': [
      [8, 0, '11:20', 'no_book', '欠帶課本', '欠帶音樂課本'],
      [8, 0, '11:45', 'talking', '說話分心', '分組活動時不專心'],
      [1, 0, '11:15', 'good_perf', '積極答問', '主動帶領小組討論'],
      [6, 0, '11:30', 'good_perf', '積極答問', '分析精闢獨到'],
      [8, 1, '15:00', 'no_book', '欠帶課本', '欠課本及樂譜'],
      [4, 1, '15:15', 'sleeping', '課堂睡覺', '精神不振'],
      [10, 1, '15:30', 'good_perf', '積極答問', '示範演奏優秀'],
      [8, 2, '08:45', 'no_hw', '欠交功課', '樂理作業未交'],
      [5, 2, '09:10', 'warning', '違規警告', '課堂使用手機'],
      [7, 2, '09:30', 'good_perf', '積極答問', '課堂答題表現突出']
    ],
    '2B': [
      [4, 0, '08:30', 'no_hw', '欠交功課', '未交閱讀報告'],
      [4, 0, '08:50', 'no_book', '欠帶課本', '欠帶課堂工作紙'],
      [3, 0, '08:40', 'good_perf', '積極答問', '答題正確清晰'],
      [7, 0, '09:05', 'talking', '說話分心', '與鄰座同學竊竊私語'],
      [4, 1, '11:10', 'no_hw', '欠交功課', '兩次未交作業'],
      [1, 1, '11:25', 'good_perf', '積極答問', '課堂發言踴躍'],
      [9, 1, '11:40', 'sleeping', '課堂睡覺', '上課伏在桌上休息'],
      [4, 2, '14:15', 'warning', '違規警告', '多次提醒仍不抄筆記'],
      [6, 2, '14:35', 'good_perf', '積極答問', '主動協助同學解難']
    ],
    '2C': [
      [7, 0, '09:20', 'no_book', '欠帶課本', '未帶單元三課本'],
      [7, 0, '09:45', 'talking', '說話分心', '發言未有舉手'],
      [3, 0, '09:30', 'good_perf', '積極答問', '回答深度思考題'],
      [10, 0, '09:55', 'good_perf', '積極答問', '積極參與課堂活動'],
      [7, 1, '14:00', 'no_book', '欠帶課本', '上一堂亦未帶課本'],
      [5, 1, '14:20', 'sleeping', '課堂睡覺', '精神散漫伏桌'],
      [1, 1, '14:35', 'good_perf', '積極答問', '表現優秀'],
      [7, 2, '10:15', 'no_hw', '欠交功課', '未交補充練習'],
      [12, 2, '10:40', 'good_perf', '積極答問', '認真回答問題']
    ],
    '2D': [
      [5, 0, '13:45', 'no_book', '欠帶課本', '忘記帶科學課本'],
      [5, 0, '14:05', 'talking', '說話分心', '實驗課嬉戲'],
      [1, 0, '13:50', 'good_perf', '積極答問', '實驗步驟規範熟練'],
      [4, 0, '14:20', 'good_perf', '積極答問', '主動記錄實驗數據'],
      [5, 1, '09:30', 'no_book', '欠帶課本', '實驗手冊未帶'],
      [7, 1, '09:50', 'sleeping', '課堂睡覺', '精神恍惚'],
      [3, 1, '10:10', 'good_perf', '積極答問', '回答精確'],
      [5, 2, '11:20', 'no_hw', '欠交功課', '欠交實驗預習'],
      [18, 2, '11:40', 'good_perf', '積極答問', '熱心參與討論']
    ],
    '4C': [
      [5, 0, '08:50', 'no_book', '欠帶課本', '選修科教科書未帶'],
      [5, 0, '09:15', 'talking', '說話分心', '上課玩弄文具並說話'],
      [1, 0, '08:55', 'good_perf', '積極答問', '高中歷屆試題分析深入'],
      [6, 0, '09:25', 'good_perf', '積極答問', '論證完整有說服力'],
      [8, 0, '09:30', 'good_perf', '積極答問', '主動提出建設性問題'],
      [5, 1, '14:10', 'no_book', '欠帶課本', '連續欠帶高中課本'],
      [3, 1, '14:30', 'no_hw', '欠交功課', '校本評核草稿未交'],
      [1, 1, '14:45', 'good_perf', '積極答問', '課堂表現模範'],
      [7, 1, '15:00', 'sleeping', '課堂睡覺', '自修時段睡覺'],
      [5, 2, '10:30', 'warning', '違規警告', '欠交功課且無合理解釋'],
      [11, 2, '10:50', 'good_perf', '積極答問', '示範計算題步驟清晰']
    ]
  };

  const calcDate = (daysAgo) => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
    d.setDate(d.getDate() - daysAgo);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dates = [calcDate(0), calcDate(2), calcDate(5), calcDate(8)];

  for (const sc of defaultScheduleClasses) {
    const stList = demoStudentsByClass[sc.name] || [];
    const [{ n: curStudentCount }] = await sql(
      'select count(*)::int as n from students where class = $1',
      [sc.name]
    );

    if (curStudentCount < stList.length) {
      const seats = Array.from({ length: sc.total }, (_, i) => (i < stList.length ? String(i + 1) : '')).join(',');
      await sql(
        'update classes set seats = $1, total = $2, cols = $3 where name = $4',
        [seats, sc.total, sc.cols, sc.name]
      );

      for (const [no, zh, en_full, en_first, sex] of stList) {
        await sql(
          `insert into students (class, no, name, name_zh, name_en, sex) values ($1, $2, $3, $4, $5, $6)
           on conflict (class, no) do update set
             name = excluded.name,
             name_zh = excluded.name_zh,
             name_en = excluded.name_en,
             sex = excluded.sex`,
          [sc.name, no, en_full, zh, en_first, sex]
        );
      }

      const demoSessionId = 'DEMO_' + sc.name;
      await sql(
        `insert into sessions (id, class, name) values ($1, $2, $3) on conflict (id) do nothing`,
        [demoSessionId, sc.name, `${sc.name} 課堂工作紙 1 (DEMO)`]
      );

      for (const stNo of [1, 2, 4, 7, 9, 12, 15, 18].filter((n) => n <= stList.length)) {
        await sql(
          `insert into marks (session_id, student_no) values ($1, $2) on conflict (session_id, student_no) do nothing`,
          [demoSessionId, stNo]
        );
      }

      await sql(
        `insert into lesson_events (session_id, class, student_no, type, label, note) values
         ($1, $2, 1, 'good_perf', '積極答問', '主動舉手回答問題'),
         ($1, $2, 4, 'good_perf', '專注投入', '課堂表現認真')
         on conflict do nothing`,
        [demoSessionId, sc.name]
      );
    }

    const [{ n: curDiscCount }] = await sql(
      'select count(*)::int as n from discipline_records where class = $1',
      [sc.name]
    );

    if (curDiscCount === 0) {
      await sql(
        `insert into class_lessons (class, lesson_date, note) values
         ($1, $2, '正常開課'),
         ($1, $3, '正常開課'),
         ($1, $4, '正常開課')
         on conflict (class, lesson_date) do nothing`,
        [sc.name, dates[1], dates[2], dates[3]]
      );

      const discEvents = demoDisciplineByClass[sc.name] || [];
      for (const [stNo, dateIdx, time, type, label, note] of discEvents) {
        const recDate = dates[dateIdx] || dates[0];
        await sql(
          `insert into discipline_records (class, student_no, record_date, record_time, type, label, note)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict do nothing`,
          [sc.name, stNo, recDate, time, type, label, note]
        );
      }
    }
  }
}

/* ----------------------------------------------------------------- classes */

export async function getClasses() {
  return sql('select name, total, cols from classes order by name');
}

export async function createClass(name, total = DEFAULT_TOTAL, cols = DEFAULT_COLS) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Class name is required');
  const t = parseInt(total, 10) || DEFAULT_TOTAL;
  const c = parseInt(cols, 10) || DEFAULT_COLS;
  await sql(
    `insert into classes (name, total, cols, seats) values ($1, $2, $3, '')
     on conflict (name) do update set total = $2, cols = $3`,
    [cleanName, t, c]
  );
  return getClasses();
}

export async function updateClass(name, total, cols) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Class name is required');
  const t = parseInt(total, 10) || DEFAULT_TOTAL;
  const c = parseInt(cols, 10) || DEFAULT_COLS;
  await sql('update classes set total = $2, cols = $3 where name = $1', [cleanName, t, c]);
  return getClasses();
}

export async function deleteClass(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Class name is required');
  await sql('delete from classes where name = $1', [cleanName]);
  const [{ n }] = await sql('select count(*)::int as n from classes');
  if (n === 0) {
    await sql('insert into classes (name, total, cols) values ($1, $2, $3)',
      ['1A', DEFAULT_TOTAL, DEFAULT_COLS]);
  }
  return getClasses();
}

export async function ensureClassExists(clsName) {
  const cleanName = String(clsName || '').trim();
  if (!cleanName) return;
  const defaultTotal = (cleanName === '4C') ? 38 : ((cleanName === '2A') ? 30 : DEFAULT_TOTAL);
  const defaultCols = (cleanName === '4C' || cleanName === '2A') ? 6 : DEFAULT_COLS;
  const defaultSeats = Array.from({ length: defaultTotal }, (_, i) => String(i + 1)).join(',');
  await sql(
    `insert into classes (name, total, cols, seats) values ($1, $2, $3, $4)
     on conflict (name) do nothing`,
    [cleanName, defaultTotal, defaultCols, defaultSeats]
  );
}

async function getClass(name) {
  const clean = String(name || '').trim();
  if (clean) {
    let rows = await sql('select name, total, cols, seats from classes where name = $1', [clean]);
    if (rows.length) return rows[0];
    await ensureClassExists(clean);
    rows = await sql('select name, total, cols, seats from classes where name = $1', [clean]);
    if (rows.length) return rows[0];
  }
  const [first] = await sql('select name, total, cols, seats from classes order by name limit 1');
  return first;
}

/* ------------------------------------------------------------------ layout */

/** Stored as a CSV of student numbers, blank = empty desk (same shape as the Sheet). */
function parseSeats(raw, total, cols) {
  let arr = [];
  if (!raw) {
    for (let i = 0; i < total; i++) arr.push(i + 1);
  } else {
    const seen = new Set();
    for (const part of String(raw).split(',')) {
      const n = parseInt(part.trim(), 10);
      if (!n || n < 1 || n > total || seen.has(n)) { arr.push(null); continue; }
      seen.add(n);
      arr.push(n);
    }
  }
  const minRows = Math.ceil(total / cols);
  const rows = Math.min(MAX_ROWS, Math.max(minRows, Math.ceil(arr.length / cols)));
  const size = rows * cols;
  while (arr.length < size) arr.push(null);
  return arr.slice(0, size);
}

export function serialiseSeats(seats) {
  return (seats || []).map((v) => (v ? String(parseInt(v, 10) || '') : '')).join(',');
}

export async function saveLayout(cls, seats) {
  await sql('update classes set seats = $2 where name = $1', [cls, serialiseSeats(seats)]);
}

/* ---------------------------------------------------------------- students */

export async function getStudents(cls) {
  const rows = await sql(
    'select no, name, name_zh, name_en, sex from students where class = $1 order by no', [cls]
  );
  return Object.fromEntries(rows.map((r) => [String(r.no), {
    zh: r.name_zh || '', name: r.name || '', en: r.name_en || '', sex: r.sex || ''
  }]));
}

function cleanSex(v) {
  v = String(v || '').trim().toUpperCase();
  if (v === 'M' || v === '男' || v === 'BOY') return 'M';
  if (v === 'F' || v === '女' || v === 'GIRL') return 'F';
  return '';
}

export async function saveStudents(cls, list) {
  const cleanCls = String(cls || '').trim();
  if (!cleanCls) throw new Error('Class name is required');
  await ensureClassExists(cleanCls);

  const clean = (list || [])
    .map((o) => ({
      no: parseInt(o?.no, 10),
      zh: String(o?.zh || '').trim(),
      name: String(o?.name || o?.en || o?.zh || '').trim(),
      en: String(o?.en || '').trim(),
      sex: cleanSex(o?.sex)
    }))
    .filter((o) => o.no > 0 && (o.zh || o.name || o.en || o.sex));

  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('delete from students where class = $1', [cleanCls]);
    if (clean.length) {
      const cols = 5;
      const values = clean.map((_, i) => {
        const b = i * cols;
        return `($1, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
      }).join(',');
      await client.query(
        `insert into students (class, no, name, name_zh, name_en, sex) values ${values}`,
        [cleanCls, ...clean.flatMap((o) => [o.no, o.name || null, o.zh || null, o.en || null, o.sex || null])]
      );
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  return getStudents(cleanCls);
}

export async function updateStudent(cls, no, data) {
  const cleanCls = String(cls || '').trim();
  const n = parseInt(no, 10);
  if (!cleanCls || !n) throw new Error('Class and student number are required');
  await ensureClassExists(cleanCls);

  const zh = String(data?.zh || '').trim();
  const en = String(data?.en || '').trim();
  const name = String(data?.name || en || zh || '').trim();
  const sex = cleanSex(data?.sex);

  if (!zh && !en && !name && !sex) {
    await sql('delete from students where class = $1 and no = $2', [cleanCls, n]);
  } else {
    await sql(
      `insert into students (class, no, name, name_zh, name_en, sex)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (class, no) do update set
         name = $3, name_zh = $4, name_en = $5, sex = $6`,
      [cleanCls, n, name || null, zh || null, en || null, sex || null]
    );
  }
  return getStudents(cleanCls);
}

/* ---------------------------------------------------------------- sessions */

export async function getTodaySessions(cls) {
  const rows = await sql(
    `select id, name from sessions
      where class = $1
        and (created_at at time zone $2)::date = (now() at time zone $2)::date
      order by created_at desc`,
    [cls, TZ]
  );
  return rows.map((r) => `${r.name} (${r.id})`);
}

export async function createSession(cls, name) {
  const clean = String(name || '').trim() || todayCode();
  // 4 chars from a 32-symbol alphabet, retried on the astronomically rare clash
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = Array.from({ length: 4 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const rows = await sql(
      `insert into sessions (id, class, name) values ($1, $2, $3)
       on conflict (id) do nothing returning id`,
      [id, cls, clean]
    );
    if (rows.length) return `${clean} (${id})`;
  }
  throw new Error('Could not allocate a session id');
}

function todayCode() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  return String(d.getFullYear()).slice(-2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

export function sessionId(asgn) {
  const m = String(asgn || '').match(/\(([^)]+)\)$/);
  return m ? m[1] : '';
}

/* ------------------------------------------------------------------- marks */

export async function getStatus(sid) {
  if (!sid) return {};
  const rows = await sql(
    `select student_no, to_char(marked_at at time zone $2, 'HH24:MI') as t
       from marks where session_id = $1`,
    [sid, TZ]
  );
  return Object.fromEntries(rows.map((r) => [String(r.student_no), r.t]));
}

/** Toggle: delete if present, otherwise insert. One statement each, no race. */
export async function toggleMark(sid, no) {
  const gone = await sql(
    'delete from marks where session_id = $1 and student_no = $2 returning student_no',
    [sid, no]
  );
  if (gone.length) return { status: 'unmarked' };

  // `do update` with a no-op SET keeps the original marked_at but still returns a
  // row. `do nothing` would return zero rows when another device inserted first,
  // and we'd wrongly report the student as unmarked.
  const rows = await sql(
    `insert into marks (session_id, student_no) values ($1, $2)
     on conflict (session_id, student_no) do update set marked_at = marks.marked_at
     returning to_char(marked_at at time zone $3, 'HH24:MI') as t`,
    [sid, no, TZ]
  );
  return { status: 'marked', time: rows[0].t };
}

/** Set mark idempotently (used by external software and direct sets). */
export async function setMark(sid, no, marked = true) {
  if (!marked) {
    await sql('delete from marks where session_id = $1 and student_no = $2', [sid, no]);
    return { status: 'unmarked' };
  }
  const rows = await sql(
    `insert into marks (session_id, student_no) values ($1, $2)
     on conflict (session_id, student_no) do update set marked_at = marks.marked_at
     returning to_char(marked_at at time zone $3, 'HH24:MI') as t`,
    [sid, no, TZ]
  );
  return { status: 'marked', time: rows[0]?.t || '' };
}

export async function clearSession(sid) {
  await sql('delete from marks where session_id = $1', [sid]);
}

/* ----------------------------------------------------------- lesson events */

export async function recordLessonEvent(sid, cls, studentNo, type, label, note = '') {
  const cleanType = String(type || 'general').trim();
  const cleanLabel = String(label || cleanType).trim();
  const cleanNote = String(note || '').trim();
  const no = parseInt(studentNo, 10);
  if (!sid || !cls || !no) throw new Error('Missing session, class or student number');

  const rows = await sql(
    `insert into lesson_events (session_id, class, student_no, type, label, note)
     values ($1, $2, $3, $4, $5, $6)
     returning id::text, session_id, class, student_no, type, label, note, to_char(created_at at time zone $7, 'HH24:MI') as t, created_at`,
    [sid, cls, no, cleanType, cleanLabel, cleanNote, TZ]
  );
  return rows[0];
}

export async function getLessonEvents(sid) {
  if (!sid) return [];
  const rows = await sql(
    `select id::text, session_id, class, student_no, type, label, note, to_char(created_at at time zone $2, 'HH24:MI') as t, created_at
     from lesson_events where session_id = $1
     order by created_at desc`,
    [sid, TZ]
  );
  return rows;
}

export async function deleteLessonEvent(id) {
  const rows = await sql('delete from lesson_events where id = $1 returning id::text, session_id, student_no', [id]);
  return rows[0] || null;
}

export async function clearLessonEvents(sid) {
  await sql('delete from lesson_events where session_id = $1', [sid]);
}

export async function getOrCreateActiveSession(clsName, sessionName) {
  await ensureSchema();
  const cls = await getClass(clsName);
  if (!cls) throw new Error(`Class not found: ${clsName}`);
  let sessions = await getTodaySessions(cls.name);
  if (sessionName) {
    const found = sessions.find((s) => s.includes(sessionName) || sessionId(s) === sessionName);
    if (found) return found;
    return await createSession(cls.name, sessionName);
  }
  if (sessions.length > 0) return sessions[0];
  return await createSession(cls.name, todayCode());
}

export function todayDateStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function currentTimeStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* ------------------------------------------------------ discipline records */

export async function recordDiscipline(cls, studentNo, dateStr, timeStr, type, label, note = '') {
  const cleanCls = String(cls || '').trim();
  const no = parseInt(studentNo, 10);
  if (!cleanCls || !no) throw new Error('Class and student number are required');
  const d = String(dateStr || todayDateStr()).trim();
  const t = String(timeStr || currentTimeStr()).trim();
  const cleanType = String(type || 'general').trim();
  const cleanLabel = String(label || cleanType).trim();
  const cleanNote = String(note || '').trim();

  const rows = await sql(
    `insert into discipline_records (class, student_no, record_date, record_time, type, label, note)
     values ($1, $2, $3::date, $4, $5, $6, $7)
     returning id::text, class, student_no, to_char(record_date, 'YYYY-MM-DD') as date, record_time as time, type, label, note, created_at`,
    [cleanCls, no, d, t, cleanType, cleanLabel, cleanNote]
  );
  return rows[0];
}

export async function deleteDisciplineRecord(id) {
  const rows = await sql(
    'delete from discipline_records where id = $1 returning id::text, class, student_no',
    [id]
  );
  return rows[0] || null;
}

export async function getStudentDisciplineHistory(cls, studentNo) {
  const cleanCls = String(cls || '').trim();
  const no = parseInt(studentNo, 10);
  if (!cleanCls || !no) return [];

  const rows = await sql(
    `select id::text, class, student_no, to_char(record_date, 'YYYY-MM-DD') as date, record_time as time, type, label, note, created_at
     from discipline_records
     where class = $1 and student_no = $2
     order by record_date desc, created_at desc`,
    [cleanCls, no]
  );
  return rows;
}

export async function getClassDisciplineForDate(cls, dateStr) {
  const cleanCls = String(cls || '').trim();
  const d = String(dateStr || todayDateStr()).trim();
  const rows = await sql(
    `select id::text, class, student_no, to_char(record_date, 'YYYY-MM-DD') as date, record_time as time, type, label, note, created_at
     from discipline_records
     where class = $1 and record_date = $2::date
     order by created_at desc`,
    [cleanCls, d]
  );
  return rows;
}

export async function getClassDisciplineHistory(cls) {
  const cleanCls = String(cls || '').trim();
  if (!cleanCls) return [];
  const rows = await sql(
    `select id::text, class, student_no, to_char(record_date, 'YYYY-MM-DD') as date, record_time as time, type, label, note, created_at
     from discipline_records
     where class = $1
     order by record_date desc, created_at desc`,
    [cleanCls]
  );
  return rows;
}

export async function confirmLesson(cls, dateStr, note = '') {
  const cleanCls = String(cls || '').trim();
  const d = String(dateStr || todayDateStr()).trim();
  const cleanNote = String(note || '').trim();
  await sql(
    `insert into class_lessons (class, lesson_date, note)
     values ($1, $2::date, $3)
     on conflict (class, lesson_date) do update set note = excluded.note`,
    [cleanCls, d, cleanNote]
  );
  return { ok: true, class: cleanCls, date: d, note: cleanNote };
}

export async function deleteLessonDate(cls, dateStr) {
  const cleanCls = String(cls || '').trim();
  const d = String(dateStr || todayDateStr()).trim();
  await sql('delete from class_lessons where class = $1 and lesson_date = $2::date', [cleanCls, d]);
  return { ok: true, class: cleanCls, date: d };
}

export async function getClassDisciplineSummary(cls, dateStr, overridePrevDate) {
  const cleanCls = String(cls || '').trim();
  const targetDate = String(dateStr || todayDateStr()).trim();

  const [allRecords, confirmedLessons] = await Promise.all([
    sql(
      `select id::text, class, student_no, to_char(record_date, 'YYYY-MM-DD') as date, record_time as time, type, label, note, created_at
       from discipline_records
       where class = $1
       order by record_date desc, created_at desc`,
      [cleanCls]
    ),
    sql(
      `select to_char(lesson_date, 'YYYY-MM-DD') as date, note
       from class_lessons
       where class = $1
       order by lesson_date desc`,
      [cleanCls]
    )
  ]);

  // Merge distinct lesson dates from both discipline records and confirmed lessons
  const dateSet = new Set();
  allRecords.forEach(r => dateSet.add(r.date));
  confirmedLessons.forEach(l => dateSet.add(l.date));
  const distinctDates = Array.from(dateSet).sort().reverse();

  const schedPrev = ScheduleEngine ? ScheduleEngine.findPreviousScheduledLessonDate(cleanCls, targetDate) : null;
  const scheduledPreviousDate = schedPrev ? schedPrev.date : null;

  let previousLessonDate = null;
  if (overridePrevDate && overridePrevDate !== 'auto' && overridePrevDate < targetDate) {
    previousLessonDate = overridePrevDate;
  } else {
    previousLessonDate = distinctDates.find(d => d < targetDate) || scheduledPreviousDate || null;
  }

  const isTodayConfirmed = confirmedLessons.some(l => l.date === targetDate);

  const studentStats = {};
  for (const r of allRecords) {
    const sNo = String(r.student_no);
    if (!studentStats[sNo]) {
      studentStats[sNo] = {
        totals: { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0, total_infractions: 0 },
        today_badges: [],
        previous_badges: [],
        previous_alerts: {},
        consecutive_streaks: {}
      };
    }
    const stat = studentStats[sNo];
    if (r.type === 'good_perf') {
      stat.totals.good_perf++;
    } else {
      if (stat.totals[r.type] !== undefined) stat.totals[r.type]++;
      stat.totals.total_infractions++;
    }

    if (r.date === targetDate) {
      stat.today_badges.push({ id: r.id, type: r.type, label: r.label, time: r.time });
    }
    if (previousLessonDate && r.date === previousLessonDate) {
      stat.previous_badges.push({ id: r.id, type: r.type, label: r.label, time: r.time });
      stat.previous_alerts[r.type] = true;
    }
  }

  // Calculate consecutive streaks for students who committed infractions both previous lesson and today
  for (const sNo in studentStats) {
    const st = studentStats[sNo];
    const todayTypes = new Set(st.today_badges.map(b => b.type));
    for (const t of todayTypes) {
      if (st.previous_alerts[t]) {
        st.consecutive_streaks[t] = 2; // at least 2 consecutive lessons
      }
    }
  }

  return {
    studentStats,
    allRecords,
    totalRecords: allRecords.length,
    previousLessonDate,
    scheduledPreviousDate,
    distinctDates,
    isTodayConfirmed,
    confirmedLessons
  };
}

export async function clearClassDisciplineForDate(cls, dateStr) {
  const cleanCls = String(cls || '').trim();
  const d = String(dateStr || todayDateStr()).trim();
  await sql('delete from discipline_records where class = $1 and record_date = $2::date', [cleanCls, d]);
}

/* ------------------------------------------------------------------ bundle */

export async function buildBundle(clsName, asgn, dateStr, overridePrevDate) {
  await ensureSchema();

  const cls = await getClass(clsName);
  if (!cls) throw new Error('No classes configured');

  const curDate = dateStr || todayDateStr();

  let sessions = await getTodaySessions(cls.name);
  if (!asgn || !sessions.includes(asgn)) {
    if (sessions.length) {
      asgn = sessions[0];
    } else {
      asgn = await createSession(cls.name, todayCode());
      sessions = await getTodaySessions(cls.name);
    }
  }

  const sid = sessionId(asgn);
  const [status, names, classes, events, disciplineSummary, dateEvents] = await Promise.all([
    getStatus(sid),
    getStudents(cls.name),
    getClasses(),
    getLessonEvents(sid),
    getClassDisciplineSummary(cls.name, curDate, overridePrevDate),
    getClassDisciplineForDate(cls.name, curDate)
  ]);

  return {
    cls: cls.name,
    asgn,
    date: curDate,
    previousLessonDate: disciplineSummary.previousLessonDate,
    distinctLessonDates: disciplineSummary.distinctDates,
    isTodayConfirmed: disciplineSummary.isTodayConfirmed,
    total: cls.total,
    cols: cls.cols,
    seats: parseSeats(cls.seats, cls.total, cls.cols),
    status,
    events,
    discipline: disciplineSummary,
    dateEvents,
    names,
    classes: classes.map((c) => c.name),
    classList: classes,
    sessions
  };
}
