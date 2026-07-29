/**
 * APPINOX — Anime Seed Script
 * Usage: node data/seed-anime.js
 * Seeds the database with anime from anime-sama.to (sibnet embed URLs).
 */
'use strict';
try { require('dotenv').config({ path: require('path').join(__dirname, '../.env') }); } catch {}
const pool   = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────
const sib = id => `https://video.sibnet.ru/shell.php?videoid=${id}`;
const eps = (ids, vf = false) => ids.map((id, i) => ({
  number: i + 1,
  title:  `Épisode ${i + 1}`,
  vostfr: vf ? null : sib(id),
  vf:     vf ? sib(id) : null,
}));
const epsMulti = (vfIds, voIds) => {
  const len = Math.max(vfIds.length, voIds.length);
  return Array.from({ length: len }, (_, i) => ({
    number: i + 1,
    title:  `Épisode ${i + 1}`,
    vf:     vfIds[i] ? sib(vfIds[i]) : null,
    vostfr: voIds[i]  ? sib(voIds[i])  : null,
  }));
};

// ── Episode IDs ───────────────────────────────────────────────────────────────

const SLIME_S1_VO  = [3465132,3465135,3469123,3473011,3477460,3481797,3486082,3489994,3493880,3498350,3502880,3508028,3512433,3522503,3529088,3533654,3538548,3542741,3547801,3552152,3556989,3562423,3566945,3572288,3577690];
const SLIME_S2_VO  = [4668449,4207628,4212571,4217100,4223435,4229051,4234250,4243448,4250261,4257790,4262501,4267954,4282554,5401857,4348133,4354983,4363608,4372158,4377520,4383116,4389555,4395914,4409993,4416614,4423143];
const SLIME_S3_VO  = [5487778,5494173,5502940,5509840,5516684,5523974,5531218,5538018,5544616,5550556,5556401,5562881,5570843,5578649,5587031,5602079,5610220,5618376,5639033,5649802,5657322,5665785,5675111,5684019,5693014];

const MUSHOKU_S1_VO  = [4670916,4670917,4670918,4670919,4670920,4670922,4670923,4670926,4670927,4670928,4670929,4670930,4670931,4670932,4670933,4670934,4670936,4670937,4670938,4670939,4670940,4670942,4670943];
const MUSHOKU_S21_VO = [5186353,5193243,5199557,5205966,5212670,5220585,5226751,5231211,5235472,5242251,5249351,5255407,5260491];
const MUSHOKU_S22_VO = [5496999,5504610,5512013,5518678,5526402,5533510,5546187,5552364,5558087,5565055,5573405,5581041];

const SOLO_S1_VO = [5389406,5397577,5406329,5414604,5421264,5428101,5435724,5444576,5453063,5461770,5470382,5479260,5487838];
const SOLO_S2_VO = [5790524,5795961,5801411,5806488,5811885,5819034,5825877,5832048,5839080,5845645,5851330,5857706,5863647];

const JJK_S1_VF  = [4668025,4668028,4668029,4668030,4668034,4668035,4668038,4668040,4668042,4668044,4668049,4668055,4668061,4668066,4668072,4668077,4668081,4668084,4668086,4668089,4668092,4668096,4668102,4668111];
const JJK_S2_VF  = [5253308,5253310,5258312,5258314,5263543,5263545,5269446,5278562,5278171,5288287,5298421,5306222,5314926,5324699,5334985,5346113,5355754,5364778,5372583,5380126,5395745,5404433,5413795];
const JJK_S1_VO  = [4667514,4667523,4667532,4667548,4667557,4667566,4667578,4667599,4667621,4667634,4667642,4667648,4667656,4667663,4667667,4667673,4667683,4667689,4667696,4667717,4667725,4667735,4667746,4667756];
const JJK_S2_VO  = [5190453,5196965,5203199,5210246,5217464,5238868,5246781,5253009,5258097,5263399,5269261,5277754,5288042,5297930,5305970,5314006,5324440,5334685,5345737,5355176,5364195,5372381,5379934];

const AOT_S1_VF = [6223155,6223169,6223171,6223180,6223201,6223207,6223208,6223212,6223219,6223224,6223232,6223234,6223237,6223238,6223241,6223245,6223248,6223252,6223263,6223273,6223286,6223301,6223307,6223325,6223346];
const AOT_S2_VF = [6225238,6225266,6225293,6225309,6225312,6225317,6225324,6225328,6225331,6225336,6225349,6225354];
const AOT_S3_VF = [6224137,6224154,6224167,6224178,6224201,6224220,6224258,6224322,6224466,6224441,6224549,6224590,6224603,6224656,6224669,6224684,6224701,6224718,6224726,6224728,6224733,6224736];
const AOT_S4_VF = [6224737,6224744,6224759,6224762,6224763,6224765,6224766,6224769,6224796,6224809,6224816,6224819,6224823,6224859,6224881,6224890,6224908,6224925,6224937,6224952,6224964,6224972,6224986,6224999,6225019,6225040,6225064,6225086,6225156];

const NARUTO_VF = [4963284,4963285,4963286,4963287,4963288,4963290,4963291,4963292,4963293,4963294,4963295,4963296,4963297,4963298,4963299,4963300,4963301,4963302,4963303,4963304,4963305,4963306,4963308,4963309,4963310,4963311,4963312,4963313,4963314,4963316,4963317,4963318,4963319,4963320,4963321,4963322,4963324,4963325,4963326,4963327,4963328,4963329,4963330,4963331,4963332,4963335,4963336,4963337,4963339,4963340,4963341,4963342,4963357,4963358,4963360,4963361,4963362,4963363,4963364,4963365,4963368,4963369,4963370,4963371,4963372,5274142,4963375,4963376,4963377,4963378,4963380,4963381,4963382,4963383,4963384,4963385,4963386,4963387,4963389,4963391,4963392,4963393,4963394,4963395,4963396,4963397,4963399,4963487,4963404,4963405,4963406,4963407,4963408,4963409,4963410,4963412,4963414,4963415,4963417,4963418,4963420,4963422,4963425,4963427,4963556,4963558,4963561,4963562,4963563,4963565,4963567,4963569,4963572,4963573,4963575,4963576,4963577,4963580,4963581,4963582,4963584,4963585,4963587,4963589,4963592,4963595,4963596,4963597,4963599,4963601,4963604,4963605,4963607,4963609,4963610,4963611,4963612,4963613,4963615,4963616,4963617,4963620,4963621,4963622,4963624,4963625,4963626,4963627,4963628];

const SAO_S1_VF = [4739152,4739153,4739155,4739156,4739158,4739159,4739160,4739162,4739165,4739167,4739169,4739171,4739173,4739174,4739176,4739177,4739179,4739181,4739183,4739184,4739186,4739187,6250184,4739191,4739193];
const SAO_S2_VF = [4739194,4739195,4739197,4739198,4739200,4739201,4739203,4739204,4739206,4739207,4739209,4739211,4739213,4739216,4739217,4739221,4739222,4739224,4739226,4739227,4739231,4739232,4739234,4739235];

const OP_S1_VF = [4833453,4833454,4833455,4833456,4833458,4833459,4833462,4833465,4833468,3871795,3871796,3871797,3871798,3871799,4833472,4833473,4833475,4833476,4833479,4833480,4833481,4833483,4729232,4833487,4729225,4833489,4833490,4833492,4833493,4729234,4833499,4729236,4729238,4833500,4833501,4833505,4833507,4833512,4833513,4833515,4729239,4729240,4833520,4833522,4833524,4833527,4833530,4833531,4833534,4729249];
const OP_S2_VF = [4834125,4834128,4834132,4834133,4834136,4834140,4834142,4834148,4834151,4834156,4834160,4834162,4834165,4834169,3871873,4834172,4834177,4834180,4834184,4834187,4834193,4834199,4834205,3871883,3871884,3871885,4834207,4834210,4705148,4705166,4705169,4705170,4834212,4834216,4834218,4834219,4834221,4834223,4834224,4834226,4834229,4834231,4834233,4834241,4834243,4834244,4834245,4705198];

// ── Anime catalogue ───────────────────────────────────────────────────────────
const ANIME = [
  {
    title:       'Tensei Shitara Slime Datta Ken',
    genre:       'Anime, Fantasy, Isekai',
    type:        'anime',
    year:        2018,
    audio:       'VOSTFR',
    quality:     'HD',
    description: "Satoru Mikami, un salarié ordinaire de Tokyo, se fait poignarder et se réincarne dans un autre monde sous la forme d'un slime. Il acquiert des compétences uniques et rencontre le dragon Veldora, qui lui donne le nom de Rimuru Tempest.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/tensei-shitara-slime-datta-ken.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=CbpHkgDR20I',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1', episodes: eps(SLIME_S1_VO) },
      { number: 2, name: 'Saison 2', episodes: eps(SLIME_S2_VO) },
      { number: 3, name: 'Saison 3', episodes: eps(SLIME_S3_VO) },
    ],
  },
  {
    title:       'Mushoku Tensei : Jobless Reincarnation',
    genre:       'Anime, Fantasy, Isekai',
    type:        'anime',
    year:        2021,
    audio:       'VOSTFR',
    quality:     'HD',
    description: "Un homme de 34 ans, chômeur et reclus, décède et se retrouve réincarné dans un monde de magie et d'épées. En tant que Rudeus Greyrat, il est décidé à ne pas répéter ses erreurs passées et à vivre une vie sans regret.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/mushoku-tensei.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=EayhQcPpjSo',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1',             episodes: eps(MUSHOKU_S1_VO)  },
      { number: 2, name: 'Saison 2 – Partie 1',  episodes: eps(MUSHOKU_S21_VO) },
      { number: 3, name: 'Saison 2 – Partie 2',  episodes: eps(MUSHOKU_S22_VO) },
    ],
  },
  {
    title:       'Solo Leveling',
    genre:       'Anime, Action, Fantasy',
    type:        'anime',
    year:        2024,
    audio:       'VOSTFR',
    quality:     'HD',
    description: "Dans un monde où des portails reliant la Terre à des donjons sont apparus, Sung Jinwoo est le chasseur le plus faible. Après un incident mystérieux, il obtient un système unique lui permettant d'évoluer sans limite, devenant le chasseur ultime.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/solo-leveling.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=PvxGHOxOHwY',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1', episodes: eps(SOLO_S1_VO) },
      { number: 2, name: 'Saison 2', episodes: eps(SOLO_S2_VO) },
    ],
  },
  {
    title:       'Jujutsu Kaisen',
    genre:       'Anime, Action, Surnaturel',
    type:        'anime',
    year:        2020,
    audio:       'Multi',
    quality:     'HD',
    description: "Yuji Itadori, un lycéen aux capacités physiques extraordinaires, rejoint une organisation secrète de sorciers d'exorcisme après avoir avalé un doigt maudit appartenant au démon Ryomen Sukuna pour sauver ses amis.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/jujutsu-kaisen.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=pkKu9hLT-t8',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1', episodes: epsMulti(JJK_S1_VF, JJK_S1_VO) },
      { number: 2, name: 'Saison 2', episodes: epsMulti(JJK_S2_VF, JJK_S2_VO) },
    ],
  },
  {
    title:       'Shingeki no Kyojin',
    genre:       'Anime, Action, Drame',
    type:        'anime',
    year:        2013,
    audio:       'VF',
    quality:     'HD',
    description: "L'humanité vit retranchée derrière d'immenses remparts pour se protéger des Titans, des géants dévorant les humains. Eren Jäger jure de les exterminer tous après que sa mère a été dévorée lors d'une attaque.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/shingeki-no-kyojin.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=MGRm4IzK1SQ',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1', episodes: eps(AOT_S1_VF, true) },
      { number: 2, name: 'Saison 2', episodes: eps(AOT_S2_VF, true) },
      { number: 3, name: 'Saison 3', episodes: eps(AOT_S3_VF, true) },
      { number: 4, name: 'Saison 4 (Final)', episodes: eps(AOT_S4_VF, true) },
    ],
  },
  {
    title:       'Naruto',
    genre:       'Anime, Action, Aventure',
    type:        'anime',
    year:        2002,
    audio:       'VF',
    quality:     'HD',
    description: "Naruto Uzumaki est un jeune ninja qui aspire à devenir Hokage, le chef de son village. Portant en lui le renard à neuf queues, il doit surmonter les préjugés et prouver sa valeur par sa détermination et son travail acharné.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/naruto.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=EvJXRmJEPOQ',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saison 1 (Éps. 1–148)', episodes: eps(NARUTO_VF, true) },
    ],
  },
  {
    title:       'One Piece',
    genre:       'Anime, Action, Aventure',
    type:        'anime',
    year:        1999,
    audio:       'VF',
    quality:     'HD',
    description: "Monkey D. Luffy, un jeune garçon aux pouvoirs de caoutchouc, part à la recherche du légendaire trésor One Piece pour devenir le Roi des Pirates, accompagné de son équipage de nakamas.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/one-piece.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=MCFpKd1DkTM',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Saga East Blue (Éps. 1–50)',   episodes: eps(OP_S1_VF, true) },
      { number: 2, name: 'Saga Alabasta (Éps. 51–100)', episodes: eps(OP_S2_VF, true) },
    ],
  },
  {
    title:       'Sword Art Online',
    genre:       'Anime, Action, Science-Fiction',
    type:        'anime',
    year:        2012,
    audio:       'VF',
    quality:     'HD',
    description: "Dans un futur proche, le jeu en ligne révolutionnaire Sword Art Online piège ses 10 000 joueurs dans un monde virtuel : ils ne peuvent se déconnecter qu'en atteignant le dernier étage du château, sous peine de mourir dans la réalité.",
    posterUrl:   'https://cdn.statically.io/gh/Anime-Sama/IMG/img/contenu/sword-art-online.jpg',
    trailerUrl:  'https://www.youtube.com/watch?v=6ohYYtxfDCg',
    videoUrl:    null,
    seasons: [
      { number: 1, name: 'Aincrad (Éps. 1–25)',    episodes: eps(SAO_S1_VF, true) },
      { number: 2, name: 'ALfheim Online (Éps. 1–24)', episodes: eps(SAO_S2_VF, true) },
    ],
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 APPINOX — Seeding anime...\n');
  const client = await pool.connect();
  try {
    for (const anime of ANIME) {
      // Check if title already exists
      const { rows: existing } = await client.query(
        'SELECT id FROM catalog WHERE lower(title) = lower($1)',
        [anime.title]
      );

      if (existing.length) {
        // Update seasons data on existing entry
        await client.query(
          `UPDATE catalog SET seasons=$1, audio=$2, poster_url=COALESCE(NULLIF($3,''), poster_url)
           WHERE lower(title) = lower($4)`,
          [JSON.stringify(anime.seasons), anime.audio, anime.posterUrl || '', anime.title]
        );
        console.log(`  ✔  Updated: ${anime.title}`);
      } else {
        const id = 'c-' + require('crypto').randomBytes(4).toString('hex');
        await client.query(
          `INSERT INTO catalog
             (id, title, genre, type, duration, year, audio, quality,
              description, trailer_url, poster_url, video_url, actors, rows, seasons)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            id, anime.title, anime.genre, anime.type,
            `${anime.seasons.reduce((t, s) => t + s.episodes.length, 0)} épisodes`,
            anime.year, anime.audio, anime.quality,
            anime.description, anime.trailerUrl || null,
            anime.posterUrl || null, null,
            '[]', '["trending"]', JSON.stringify(anime.seasons),
          ]
        );
        const totalEps = anime.seasons.reduce((t, s) => t + s.episodes.length, 0);
        console.log(`  ✔  Inserted: ${anime.title} (${totalEps} épisodes, ${anime.seasons.length} saison(s))`);
      }
    }
    console.log('\n✅ Done!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error('✘', e.message); process.exit(1); });
