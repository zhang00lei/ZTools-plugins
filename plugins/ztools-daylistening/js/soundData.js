/** Quiet ambient catalog. See THIRD_PARTY_NOTICES.md for sources and credits. */
export const SOUND_CATEGORIES = [
  {
    "id": "nature",
    "name": "自然",
    "desc": "风、水与林间底色"
  },
  {
    "id": "rain",
    "name": "雨声与底色",
    "desc": "轻雨与柔和的连续底噪"
  },
  {
    "id": "animals",
    "name": "生灵低语",
    "desc": "林间与远海的轻声点缀"
  },
  {
    "id": "calm",
    "name": "宁静音乐",
    "desc": "每次选一首，让旋律留白"
  }
];

export const SOUNDS = [
  {
    "id": "forest",
    "name": "森林",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M14 6L6 18h5l-4 8h6l-3 6h12l-3-6h6l-4-8h5L14 6z\"/>\n      <path d=\"M14 38v4\"/>\n      <path d=\"M34 14l-6 10h4l-3 6h5l-2 5h10l-2-5h5l-3-6h4l-6-10z\"/>\n      <path d=\"M34 35v7\"/>\n    </svg>",
    "gain": 0.65
  },
  {
    "id": "waves",
    "name": "海浪",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M6 18c4-4 8-4 12 0s8 4 12 0 8-4 12 0\"/>\n      <path d=\"M6 28c4-4 8-4 12 0s8 4 12 0 8-4 12 0\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "stream",
    "name": "溪流",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M6 18c8-2 16 0 24-2s12-4 12-4\"/>\n      <path d=\"M10 24c8 3 14 6 22 4s8-5 10-6\"/>\n      <path d=\"M6 34c10-2 18 1 24-3s12-3 12-3\"/>\n      <circle cx=\"12\" cy=\"14\" r=\"3\"/>\n      <circle cx=\"36\" cy=\"12\" r=\"2.5\"/>\n      <circle cx=\"28\" cy=\"11\" r=\"2\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "island",
    "name": "海岛",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M6 38c6-2 12-2 18 0s12 2 18 0\"/>\n      <path d=\"M16 38c2-4 6-6 12-6s10 3 12 6\"/>\n      <path d=\"M28 32c0-8-3-14-3-18\"/>\n      <path d=\"M25 14c-4-4-9-3-12 1s-1 7 4 5c4-2 7-5 8-6z\"/>\n      <path d=\"M25 14c4-4 9-3 12 1s1 7-4 5c-4-2-7-5-8-6z\"/>\n      <path d=\"M25 14c-1-5 2-9 6-10s6 5 2 8c-3 3-6 2-8 2z\"/>\n    </svg>",
    "gain": 0.4
  },
  {
    "id": "night",
    "name": "夜晚",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M30 14a14 14 0 1 1-14 22 15 15 0 0 0 14-22z\"/>\n      <path d=\"M18 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z\"/>\n      <path d=\"M36 8l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5z\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "breeze",
    "name": "微风",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M6 18h26a4 4 0 1 0-4-4\"/>\n      <path d=\"M10 26h28a4 4 0 1 1-4 4\"/>\n      <path d=\"M6 34h18a4 4 0 1 0-4-4\"/>\n    </svg>",
    "gain": 0.85
  },
  {
    "id": "cave",
    "name": "洞穴",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M8 38c-2-8 0-22 16-22 14 0 18 12 16 22\"/>\n      <path d=\"M18 38c0-6 2-10 6-10s6 4 6 10\"/>\n      <circle cx=\"10\" cy=\"38\" r=\"2\"/>\n      <circle cx=\"38\" cy=\"38\" r=\"2\"/>\n      <circle cx=\"15\" cy=\"39\" r=\"1.5\"/>\n      <circle cx=\"33\" cy=\"39\" r=\"1.5\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "waterfall",
    "name": "瀑布",
    "category": "nature",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"12\" y=\"8\" width=\"24\" height=\"26\" rx=\"4\"/>\n      <path d=\"M20 12v22\"/>\n      <path d=\"M28 12v22\"/>\n      <path d=\"M24 16v18\"/>\n      <path d=\"M8 38c3-2 6-2 9 0s6 2 9 0 6-2 9 0 5 2 7 0\"/>\n    </svg>",
    "gain": 0.32
  },
  {
    "id": "drizzle",
    "name": "毛毛雨",
    "category": "rain",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M34 22a8 8 0 0 0-15-3 6 6 0 0 0-7 6 6 6 0 0 0 6 6h16a5 5 0 0 0 0-9z\"/>\n      <path d=\"M16 35l-2 5\"/>\n      <path d=\"M24 35l-2 5\"/>\n      <path d=\"M32 35l-2 5\"/>\n    </svg>",
    "gain": 0.55
  },
  {
    "id": "rain_window",
    "name": "窗边雨",
    "category": "rain",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"10\" y=\"8\" width=\"28\" height=\"32\" rx=\"2\"/>\n      <line x1=\"24\" y1=\"8\" x2=\"24\" y2=\"40\"/>\n      <line x1=\"10\" y1=\"24\" x2=\"38\" y2=\"24\"/>\n      <circle cx=\"16\" cy=\"15\" r=\"1\"/>\n      <circle cx=\"18\" cy=\"19\" r=\"1\"/>\n      <circle cx=\"31\" cy=\"16\" r=\"1\"/>\n      <circle cx=\"17\" cy=\"32\" r=\"1\"/>\n      <circle cx=\"33\" cy=\"31\" r=\"1\"/>\n      <circle cx=\"30\" cy=\"35\" r=\"1\"/>\n    </svg>",
    "gain": 0.25
  },
  {
    "id": "rain_tent",
    "name": "帐篷雨",
    "category": "rain",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M8 38L24 14l16 24H8z\"/>\n      <path d=\"M24 14v24\"/>\n      <path d=\"M19 38l5-12 5 12\"/>\n      <path d=\"M12 12l-2 4\"/>\n      <path d=\"M24 8l-1 4\"/>\n      <path d=\"M36 12l-2 4\"/>\n    </svg>",
    "gain": 0.7
  },
  {
    "id": "umbrella",
    "name": "雨伞",
    "category": "rain",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M8 24a16 16 0 0 1 32 0H8z\"/>\n      <path d=\"M24 8v24c0 3 2 5 4 5s3-1 3-3\"/>\n      <path d=\"M14 10l-2 4\"/>\n      <path d=\"M24 4l-1 4\"/>\n      <path d=\"M34 10l-2 4\"/>\n    </svg>",
    "gain": 0.8
  },
  {
    "id": "rain_trees",
    "name": "森林雨",
    "category": "rain",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"18\" cy=\"20\" r=\"9\"/>\n      <path d=\"M18 29v11\"/>\n      <circle cx=\"33\" cy=\"26\" r=\"6\"/>\n      <path d=\"M33 32v8\"/>\n      <path d=\"M10 6l-2 4\"/>\n      <path d=\"M22 6l-2 4\"/>\n      <path d=\"M34 8l-2 4\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "soft_pink",
    "name": "粉噪音",
    "desc": "均匀柔和的合成粉噪音",
    "category": "rain",
    "gain": 1,
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 24h4l3-12 5 24 5-32 5 32 5-24 3 12h6\"/></svg>"
  },
  {
    "id": "soft_brown",
    "name": "棕噪音",
    "desc": "低沉连续的合成棕噪音",
    "category": "rain",
    "gain": 1,
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 24h4l3-12 5 24 5-32 5 32 5-24 3 12h6\"/></svg>"
  },
  {
    "id": "soft_white",
    "name": "柔白噪",
    "desc": "经低通柔化的合成白噪音",
    "category": "rain",
    "gain": 1,
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M6 24h4l3-12 5 24 5-32 5 32 5-24 3 12h6\"/></svg>"
  },
  {
    "id": "birds",
    "name": "鸟鸣",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M38 12c-4 4-9 5-14 3 2 6-2 11-7 13 4 1 8 0 11-2-1 3-4 6-7 7 6 0 12-4 15-9 1-2 2-5 2-8 0-1 1-3 2-4-2 1-4 1-5 0z\"/>\n    </svg>",
    "gain": 0.35
  },
  {
    "id": "crickets",
    "name": "蟋蟀",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <ellipse cx=\"24\" cy=\"24\" rx=\"10\" ry=\"5\"/>\n      <path d=\"M14 24l-6-6\"/>\n      <path d=\"M14 24l-6 6\"/>\n      <path d=\"M34 24l8-8\"/>\n      <path d=\"M34 24l8 8\"/>\n      <path d=\"M20 29l-3 7\"/>\n      <path d=\"M28 29l3 7\"/>\n      <path d=\"M34 22l6-4\"/>\n    </svg>",
    "gain": 1
  },
  {
    "id": "wolf",
    "name": "狼嚎",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M10 32l3-7 4 1 5-6 8 1 5-4 4 1-2 4 4 1-5 5-2 9-3-1-2-5-6 1-2 5-3-1 2-5-4 1z\"/>\n    </svg>",
    "gain": 0.8
  },
  {
    "id": "owl",
    "name": "猫头鹰",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M16 12l4 4h8l4-4v12a10 10 0 0 1-16 0V12z\"/>\n      <circle cx=\"20\" cy=\"20\" r=\"3\"/>\n      <circle cx=\"28\" cy=\"20\" r=\"3\"/>\n      <path d=\"M24 23l-1 2h2l-1-2z\"/>\n      <path d=\"M10 38h28\"/>\n      <path d=\"M16 28c2 4 5 6 8 6s6-2 8-6\"/>\n    </svg>",
    "gain": 0.8,
    "desc": "适合低音量点缀的自然声音"
  },
  {
    "id": "forest_birds",
    "name": "林鸟",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M10 26c3-8 12-12 20-8 3 1 5 4 8 4-4 3-7 5-11 5-4 5-11 6-17-1z\"/>\n      <circle cx=\"30\" cy=\"20\" r=\"1.5\"/>\n      <path d=\"M10 26l-4 4\"/>\n      <path d=\"M22 30v7\"/>\n      <path d=\"M26 29v8\"/>\n    </svg>",
    "gain": 0.32,
    "desc": "适合低音量点缀的自然声音"
  },
  {
    "id": "seagulls",
    "name": "海鸥",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M8 22c5-5 11-5 16 0 5-5 11-5 16 0\"/>\n      <path d=\"M18 26c3-3 6-3 9 0\"/>\n      <path d=\"M24 22v6\"/>\n    </svg>",
    "gain": 0.7,
    "desc": "适合低音量点缀的自然声音"
  },
  {
    "id": "frog",
    "name": "蛙鸣",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"16\" cy=\"16\" r=\"5\"/>\n      <circle cx=\"32\" cy=\"16\" r=\"5\"/>\n      <circle cx=\"16\" cy=\"16\" r=\"2\"/>\n      <circle cx=\"32\" cy=\"16\" r=\"2\"/>\n      <ellipse cx=\"24\" cy=\"28\" rx=\"14\" ry=\"10\"/>\n      <path d=\"M17 28c3 2 11 2 14 0\"/>\n    </svg>",
    "gain": 0.25,
    "desc": "适合低音量点缀的自然声音"
  },
  {
    "id": "whale",
    "name": "深海鲸鱼",
    "category": "animals",
    "iconSvg": "<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M10 26c0-6 6-12 16-12 9 0 14 5 14 12 0 6-6 10-15 10-7 0-15-3-15-10z\"/>\n      <path d=\"M39 24c4-3 6-3 7-1s-1 5-4 6c3 1 5 4 4 6s-3 2-7-1\"/>\n      <circle cx=\"16\" cy=\"24\" r=\"1.5\"/>\n    </svg>",
    "gain": 0.2,
    "desc": "适合低音量点缀的自然声音"
  },
  {
    "id": "calm_1",
    "name": "月下独白",
    "category": "calm",
    "number": "1",
    "desc": "吉姆诺佩蒂 No.1 · 低音量钢琴",
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">1</text></svg>",
    "gain": 0.8
  },
  {
    "id": "calm_2",
    "name": "晨雾微光",
    "category": "calm",
    "number": "2",
    "desc": "吉姆诺佩蒂 No.2 · 低音量钢琴",
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">2</text></svg>",
    "gain": 0.7
  },
  {
    "id": "calm_3",
    "name": "雨后余音",
    "category": "calm",
    "number": "3",
    "desc": "吉姆诺佩蒂 No.3 · 低音量钢琴",
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">3</text></svg>",
    "gain": 0.65
  },
  {
    "id": "calm_6",
    "name": "舒缓氛围",
    "category": "calm",
    "number": "4",
    "desc": "Clean Soul · 电钢琴与贝斯 · Kevin MacLeod",
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">4</text></svg>",
    "gain": 0.8
  },
  {
    "id": "calm_10",
    "name": "冥想钢琴",
    "desc": "Meditation Impromptu 01 · 钢琴 · Kevin MacLeod",
    "category": "calm",
    "gain": 0.61,
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">5</text></svg>",
    "number": "5"
  },
  {
    "id": "calm_11",
    "name": "流动幽境",
    "desc": "Fluidscape · 合成器、长笛与竖琴 · Kevin MacLeod",
    "category": "calm",
    "gain": 0.44,
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">6</text></svg>",
    "number": "6"
  },
  {
    "id": "calm_12",
    "name": "柔光漫游",
    "desc": "Light Awash · 缓慢起音的长篇氛围音乐 · Kevin MacLeod",
    "category": "calm",
    "gain": 0.3,
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">7</text></svg>",
    "number": "7"
  },
  {
    "id": "calm_13",
    "name": "睡莲",
    "desc": "Water Lily · 钢琴、大提琴与低音弦乐 · Kevin MacLeod",
    "category": "calm",
    "gain": 1,
    "iconSvg": "<svg viewBox=\"0 0 48 48\"><circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><text x=\"24\" y=\"30\" font-size=\"18\" text-anchor=\"middle\" fill=\"currentColor\" font-family=\"system-ui, sans-serif\" font-weight=\"300\">8</text></svg>",
    "number": "8"
  }
];
