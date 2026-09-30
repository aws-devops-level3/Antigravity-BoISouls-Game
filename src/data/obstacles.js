/**
 * obstacles.js - Datalista för osynliga hinder och AABB-kollisionsrutor (Axis-Aligned Bounding Box)
 *
 * Varje hinder definieras som ett rektangulärt område:
 *   { x, y, width, height, name? }
 *
 *   x: Övre vänstra hörnet i kartans världskoordinater (X-axel)
 *   y: Övre vänstra hörnet i kartans världskoordinater (Y-axel)
 *   width: Rektangelns bredd i pixlar
 *   height: Rektangelns höjd i pixlar
 *
 * Du kan rita nya hinder direkt på skärmen i debug-läget genom att klicka och dra med musen!
 * Nya hinder loggas i konsolen så att du bara kan kopiera in dem i listan nedan.
 */

export const MAP_OBSTACLES = {
  // Helgedomen (SoulsChapel) - Huvudkarta (Spelarens startposition är ca x: 2277, y: 513)
  SoulsChapel: [
    // --- Startrummet (trärummet i nordost) ---
    [
      {
        "x": 1530,
        "y": 1090,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 1-A"
      },
      {
        "x": 1800,
        "y": 1090,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 1-B"
      },
      {
        "x": 2100,
        "y": 1090,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 1-C"
      },
      {
        "x": 2380,
        "y": 1090,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 1-D"
      },
      {
        "x": 1530,
        "y": 1610,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 2-A"
      },
      {
        "x": 1800,
        "y": 1610,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 2-B"
      },
      {
        "x": 2100,
        "y": 1610,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 2-C"
      },
      {
        "x": 2380,
        "y": 1610,
        "width": 38,
        "height": 38,
        "name": "Pelare Rad 2-D"
      },
      {
        "x": 2008,
        "y": 226,
        "width": 30,
        "height": 782
      },
      {
        "x": 2003,
        "y": 198,
        "width": 626,
        "height": 80
      },
      {
        "x": 2593,
        "y": 280,
        "width": 41,
        "height": 541
      },
      {
        "x": 2141,
        "y": 813,
        "width": 494,
        "height": 13
      },
      {
        "x": 2445,
        "y": 519,
        "width": 145,
        "height": 113
      },
      {
        "x": 2405,
        "y": 556,
        "width": 30,
        "height": 43
      },
      {
        "x": 2041,
        "y": 523,
        "width": 18,
        "height": 59
      },
      {
        "x": 2043,
        "y": 380,
        "width": 22,
        "height": 35
      },
      {
        "x": 2042,
        "y": 759,
        "width": 17,
        "height": 48
      },
      {
        "x": 2143,
        "y": 827,
        "width": 35,
        "height": 125
      },
      {
        "x": 2093,
        "y": 936,
        "width": 89,
        "height": 17
      },
      {
        "x": 2090,
        "y": 954,
        "width": 19,
        "height": 60
      },
      {
        "x": 2111,
        "y": 996,
        "width": 395,
        "height": 21
      },
      {
        "x": 1906,
        "y": 1041,
        "width": 97,
        "height": 37
      },
      {
        "x": 2188,
        "y": 1037,
        "width": 105,
        "height": 36
      },
      {
        "x": 2453,
        "y": 1019,
        "width": 55,
        "height": 713
      },
      {
        "x": 1445,
        "y": 1695,
        "width": 1065,
        "height": 40
      },
      {
        "x": 1912,
        "y": 1643,
        "width": 100,
        "height": 34
      },
      {
        "x": 2201,
        "y": 1639,
        "width": 103,
        "height": 39
      },
      {
        "x": 2345,
        "y": 1587,
        "width": 37,
        "height": 45
      },
      {
        "x": 2350,
        "y": 1092,
        "width": 31,
        "height": 30
      },
      {
        "x": 1782,
        "y": 1092,
        "width": 24,
        "height": 21
      },
      {
        "x": 1626,
        "y": 1042,
        "width": 93,
        "height": 33
      },
      {
        "x": 1526,
        "y": 1591,
        "width": 37,
        "height": 17
      },
      {
        "x": 1635,
        "y": 1624,
        "width": 29,
        "height": 23
      },
      {
        "x": 1654,
        "y": 1648,
        "width": 32,
        "height": 16
      },
      {
        "x": 1669,
        "y": 1665,
        "width": 35,
        "height": 18
      },
      {
        "x": 1683,
        "y": 1684,
        "width": 16,
        "height": 11
      },
      {
        "x": 1641,
        "y": 1613,
        "width": 12,
        "height": 13
      },
      {
        "x": 1858,
        "y": 1319,
        "width": 78,
        "height": 73
      },
      {
        "x": 1876,
        "y": 1393,
        "width": 42,
        "height": 11
      },
      {
        "x": 1938,
        "y": 1338,
        "width": 9,
        "height": 36
      },
      {
        "x": 1875,
        "y": 1306,
        "width": 42,
        "height": 12
      },
      {
        "x": 1846,
        "y": 1339,
        "width": 12,
        "height": 34
      },
      {
        "x": 1444,
        "y": 1335,
        "width": 11,
        "height": 397
      },
      {
        "x": 1438,
        "y": 975,
        "width": 569,
        "height": 66
      },
      {
        "x": 1440,
        "y": 1038,
        "width": 18,
        "height": 229
      },
      {
        "x": 1130,
        "y": 1252,
        "width": 330,
        "height": 21
      },
      {
        "x": 1060,
        "y": 1319,
        "width": 397,
        "height": 19
      },
      {
        "x": 200,
        "y": 1319,
        "width": 868,
        "height": 20
      },
      {
        "x": 799,
        "y": 1302,
        "width": 84,
        "height": 15
      },
      {
        "x": 542,
        "y": 1300,
        "width": 85,
        "height": 17
      },
      {
        "x": 346,
        "y": 1298,
        "width": 93,
        "height": 20
      },
      {
        "x": 514,
        "y": 1214,
        "width": 54,
        "height": 51
      },
      {
        "x": 552,
        "y": 1202,
        "width": 51,
        "height": 50
      },
      {
        "x": 271,
        "y": 1212,
        "width": 57,
        "height": 53
      },
      {
        "x": 323,
        "y": 1203,
        "width": 47,
        "height": 51
      },
      {
        "x": 436,
        "y": 1190,
        "width": 42,
        "height": 19
      },
      {
        "x": 443,
        "y": 1207,
        "width": 35,
        "height": 26
      },
      {
        "x": 459,
        "y": 1233,
        "width": 26,
        "height": 34
      },
      {
        "x": 471,
        "y": 1269,
        "width": 30,
        "height": 15
      },
      {
        "x": 485,
        "y": 1246,
        "width": 10,
        "height": 22
      },
      {
        "x": 447,
        "y": 1181,
        "width": 22,
        "height": 9
      },
      {
        "x": 208,
        "y": 1006,
        "width": 46,
        "height": 314
      },
      {
        "x": 77,
        "y": 873,
        "width": 132,
        "height": 136
      },
      {
        "x": 211,
        "y": 548,
        "width": 46,
        "height": 333
      },
      {
        "x": 205,
        "y": 541,
        "width": 155,
        "height": 142
      },
      {
        "x": 357,
        "y": 542,
        "width": 84,
        "height": 48
      },
      {
        "x": 441,
        "y": 543,
        "width": 698,
        "height": 47
      },
      {
        "x": 515,
        "y": 620,
        "width": 90,
        "height": 64
      },
      {
        "x": 676,
        "y": 591,
        "width": 141,
        "height": 101
      },
      {
        "x": 1122,
        "y": 590,
        "width": 21,
        "height": 683
      },
      {
        "x": 1055,
        "y": 1256,
        "width": 79,
        "height": 20
      },
      {
        "x": 949,
        "y": 603,
        "width": 20,
        "height": 33
      },
      {
        "x": 960,
        "y": 636,
        "width": 23,
        "height": 33
      },
      {
        "x": 974,
        "y": 669,
        "width": 33,
        "height": 37
      },
      {
        "x": 983,
        "y": 650,
        "width": 11,
        "height": 19
      },
      {
        "x": 1104,
        "y": 1027,
        "width": 17,
        "height": 28
      },
      {
        "x": 1102,
        "y": 830,
        "width": 18,
        "height": 28
      },
      {
        "x": 1101,
        "y": 635,
        "width": 20,
        "height": 37
      },
      {
        "x": 608,
        "y": 842,
        "width": 86,
        "height": 199
      },
      {
        "x": 626,
        "y": 1042,
        "width": 53,
        "height": 43
      },
      {
        "x": 2079,
        "y": 1557,
        "width": 49,
        "height": 39
      },
      {
        "x": 1804,
        "y": 1558,
        "width": 41,
        "height": 39
      },
      {
        "x": 1782,
        "y": 1136,
        "width": 46,
        "height": 17
      },
      {
        "x": 2080,
        "y": 1128,
        "width": 50,
        "height": 28
      },
      {
        "x": 2083,
        "y": 1094,
        "width": 16,
        "height": 36
      },
      {
        "x": 2393,
        "y": 1294,
        "width": 87,
        "height": 133
      },
      {
        "x": 2233,
        "y": 781,
        "width": 77,
        "height": 32
      },
      {
        "x": 2545,
        "y": 378,
        "width": 44,
        "height": 72
      },
      {
        "x": 2071,
        "y": 367,
        "width": 26,
        "height": 24
      }
    ],

    // --- Pelare i Stora Kryptsalen ---
    { x: 1530, y: 1090, width: 38, height: 38, name: 'Pelare Rad 1-A' },
    { x: 1800, y: 1090, width: 38, height: 38, name: 'Pelare Rad 1-B' },
    { x: 2100, y: 1090, width: 38, height: 38, name: 'Pelare Rad 1-C' },
    { x: 2380, y: 1090, width: 38, height: 38, name: 'Pelare Rad 1-D' },
    { x: 1530, y: 1610, width: 38, height: 38, name: 'Pelare Rad 2-A' },
    { x: 1800, y: 1610, width: 38, height: 38, name: 'Pelare Rad 2-B' },
    { x: 2100, y: 1610, width: 38, height: 38, name: 'Pelare Rad 2-C' },
    { x: 2380, y: 1610, width: 38, height: 38, name: 'Pelare Rad 2-D' },

    // --- Kryptmonument & Sarkofager (Centrala kammaren) ---
    { x: 620, y: 970, width: 90, height: 130, name: 'Central Sarkofag' },
    { x: 630, y: 1040, width: 70, height: 70, name: 'Stenaltare' },
  ],

  // Kyrkogården (CemeterySouls)
  CemeterySouls: [
    [
      {
        "x": 1650,
        "y": 875,
        "width": 126,
        "height": 16
      },
      {
        "x": 1770,
        "y": 875,
        "width": 18,
        "height": 209
      },
      {
        "x": 1874,
        "y": 873,
        "width": 17,
        "height": 212
      },
      {
        "x": 1893,
        "y": 1059,
        "width": 73,
        "height": 21
      },
      {
        "x": 1689,
        "y": 1058,
        "width": 80,
        "height": 25
      },
      {
        "x": 1693,
        "y": 1087,
        "width": 22,
        "height": 373
      },
      {
        "x": 1719,
        "y": 1445,
        "width": 248,
        "height": 14
      },
      {
        "x": 1954,
        "y": 1084,
        "width": 17,
        "height": 360
      },
      {
        "x": 1892,
        "y": 872,
        "width": 136,
        "height": 18
      },
      {
        "x": 2023,
        "y": 756,
        "width": 72,
        "height": 118
      },
      {
        "x": 1893,
        "y": 744,
        "width": 148,
        "height": 12
      },
      {
        "x": 1448,
        "y": 748,
        "width": 339,
        "height": 12
      },
      {
        "x": 1574,
        "y": 236,
        "width": 16,
        "height": 509
      },
      {
        "x": 1718,
        "y": 347,
        "width": 208,
        "height": 237
      },
      {
        "x": 1916,
        "y": 413,
        "width": 92,
        "height": 173
      },
      {
        "x": 1664,
        "y": 445,
        "width": 27,
        "height": 109
      },
      {
        "x": 1660,
        "y": 393,
        "width": 59,
        "height": 33
      },
      {
        "x": 1669,
        "y": 571,
        "width": 53,
        "height": 29
      },
      {
        "x": 1850,
        "y": 586,
        "width": 43,
        "height": 20
      },
      {
        "x": 1924,
        "y": 344,
        "width": 34,
        "height": 41
      },
      {
        "x": 1573,
        "y": 232,
        "width": 468,
        "height": 22
      },
      {
        "x": 2015,
        "y": 234,
        "width": 24,
        "height": 510
      },
      {
        "x": 1448,
        "y": 754,
        "width": 15,
        "height": 397
      },
      {
        "x": 1464,
        "y": 874,
        "width": 51,
        "height": 13
      },
      {
        "x": 1605,
        "y": 871,
        "width": 46,
        "height": 20
      },
      {
        "x": 1638,
        "y": 895,
        "width": 25,
        "height": 570
      },
      {
        "x": 1206,
        "y": 1153,
        "width": 127,
        "height": 31
      },
      {
        "x": 245,
        "y": 1442,
        "width": 1391,
        "height": 79
      },
      {
        "x": 257,
        "y": 1280,
        "width": 30,
        "height": 72
      },
      {
        "x": 441,
        "y": 1404,
        "width": 51,
        "height": 40
      },
      {
        "x": 761,
        "y": 1400,
        "width": 51,
        "height": 41
      },
      {
        "x": 1015,
        "y": 1400,
        "width": 48,
        "height": 43
      },
      {
        "x": 1400,
        "y": 1403,
        "width": 39,
        "height": 35
      },
      {
        "x": 1455,
        "y": 1416,
        "width": 55,
        "height": 24
      },
      {
        "x": 1523,
        "y": 1403,
        "width": 50,
        "height": 38
      },
      {
        "x": 1014,
        "y": 1147,
        "width": 53,
        "height": 22
      },
      {
        "x": 950,
        "y": 1145,
        "width": 53,
        "height": 22
      },
      {
        "x": 839,
        "y": 1148,
        "width": 62,
        "height": 36
      },
      {
        "x": 428,
        "y": 1155,
        "width": 321,
        "height": 26
      },
      {
        "x": 415,
        "y": 1126,
        "width": 1033,
        "height": 24
      },
      {
        "x": 579,
        "y": 887,
        "width": 121,
        "height": 50
      },
      {
        "x": 392,
        "y": 720,
        "width": 98,
        "height": 31
      },
      {
        "x": 213,
        "y": 682,
        "width": 33,
        "height": 792
      },
      {
        "x": 245,
        "y": 692,
        "width": 114,
        "height": 64
      },
      {
        "x": 245,
        "y": 679,
        "width": 518,
        "height": 16
      },
      {
        "x": 739,
        "y": 692,
        "width": 19,
        "height": 254
      },
      {
        "x": 1149,
        "y": 497,
        "width": 19,
        "height": 328
      },
      {
        "x": 1024,
        "y": 501,
        "width": 21,
        "height": 322
      },
      {
        "x": 216,
        "y": 622,
        "width": 357,
        "height": 17
      },
      {
        "x": 979,
        "y": 255,
        "width": 215,
        "height": 168
      },
      {
        "x": 980,
        "y": 423,
        "width": 41,
        "height": 78
      },
      {
        "x": 1169,
        "y": 425,
        "width": 26,
        "height": 74
      },
      {
        "x": 393,
        "y": 397,
        "width": 117,
        "height": 59
      },
      {
        "x": 204,
        "y": 228,
        "width": 52,
        "height": 397
      },
      {
        "x": 254,
        "y": 223,
        "width": 570,
        "height": 56
      },
      {
        "x": 802,
        "y": 281,
        "width": 17,
        "height": 221
      },
      {
        "x": 602,
        "y": 349,
        "width": 19,
        "height": 151
      },
      {
        "x": 621,
        "y": 427,
        "width": 68,
        "height": 14
      },
      {
        "x": 731,
        "y": 349,
        "width": 87,
        "height": 21
      },
      {
        "x": 744,
        "y": 384,
        "width": 48,
        "height": 31,
        "name": "Kista"
      },
      {
        "x": 625,
        "y": 484,
        "width": 179,
        "height": 19
      },
      {
        "x": 540,
        "y": 355,
        "width": 30,
        "height": 206
      },
      {
        "x": 539,
        "y": 347,
        "width": 83,
        "height": 24
      },
      {
        "x": 877,
        "y": 731,
        "width": 146,
        "height": 93
      },
      {
        "x": 774,
        "y": 510,
        "width": 113,
        "height": 56
      },
      {
        "x": 881,
        "y": 564,
        "width": 16,
        "height": 167
      },
      {
        "x": 574,
        "y": 625,
        "width": 188,
        "height": 53
      },
      {
        "x": 1277,
        "y": 251,
        "width": 78,
        "height": 292
      },
      {
        "x": 1281,
        "y": 546,
        "width": 50,
        "height": 72
      },
      {
        "x": 1252,
        "y": 619,
        "width": 70,
        "height": 30
      },
      {
        "x": 1171,
        "y": 643,
        "width": 119,
        "height": 82
      },
      {
        "x": 1289,
        "y": 650,
        "width": 19,
        "height": 31
      },
      {
        "x": 1221,
        "y": 728,
        "width": 54,
        "height": 17
      },
      {
        "x": 1357,
        "y": 320,
        "width": 16,
        "height": 159
      },
      {
        "x": 826,
        "y": 222,
        "width": 748,
        "height": 39
      },
      {
        "x": 1521,
        "y": 428,
        "width": 33,
        "height": 44
      },
      {
        "x": 1487,
        "y": 547,
        "width": 89,
        "height": 89
      }
    ]
  ],

  // Förfädrens Tronsal (SoulsBossRoom1)
  SoulsBossRoom1: [
    { x: 240, y: 440, width: 130, height: 150, name: 'Boss Tron' },

    {
      x: 240,
      y: 440,
      width: 130,
      height: 150,
      name: "Boss Tron"
    },
    {
      x: 1001,
      y: 218,
      width: 21,
      height: 263
    },
    {
      x: 1005,
      y: 557,
      width: 20,
      height: 267
    },
    {
      x: 211,
      y: 802,
      width: 816,
      height: 23
    },
    {
      x: 211,
      y: 218,
      width: 55,
      height: 584
    },
    {
      x: 208,
      y: 212,
      width: 816,
      height: 53
    },
    {
      x: 1021,
      y: 409,
      width: 620,
      height: 28
    },
    {
      x: 1027,
      y: 627,
      width: 329,
      height: 37
    },
    {
      x: 1496,
      y: 635,
      width: 155,
      height: 28
    },
    {
      x: 1638,
      y: 440,
      width: 20,
      height: 192
    },
    {
      x: 1027,
      y: 668,
      width: 226,
      height: 204
    },
    {
      x: 1025,
      y: 872,
      width: 168,
      height: 102
    },
    {
      x: 1023,
      y: 974,
      width: 172,
      height: 221
    },
    {
      x: 1195,
      y: 997,
      width: 30,
      height: 194
    },
    {
      x: 1227,
      y: 1108,
      width: 406,
      height: 89
    },
    {
      x: 1635,
      y: 666,
      width: 39,
      height: 442
    },
    {
      x: 1392,
      y: 840,
      width: 243,
      height: 178
    }
  ]
};

// Standardlista som exporteras direkt
export const obstacles = MAP_OBSTACLES.SoulsChapel;

export default obstacles;
