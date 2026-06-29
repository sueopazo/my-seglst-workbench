export const TAG_PINNED = [
  '[other-noise]',
  '[unintelligible]',
  '[clear-throat]',
  '[swallow]',
  '[lip-smack]',
  '[tsk]',
  '[chuckle]',
  '[laugh]',
  '[sigh]',
  '[exhale]',
  '[inhale]',
  '[breath]',
  '[cough]',
] as const;

export const TAG_EXTRA = [
  '[sniff]',
  '[gasp]',
  '[blow]',
  '[giggle]',
  '[snort]',
  '[scoff]',
  '[grunt]',
  '[groan]',
  '[cry]',
  '[hum-tune]',
  '[whoop]',
  '[whistle]',
  '[tongue-click]',
  '[teeth-suck]',
  '[lip-trill]',
  '[shush]',
  '[sneeze]',
  '[yawn]',
  '[hiccup]',
] as const;

export const TAG_TOOLTIPS: Record<string, string> = {
  '[breath]':       'Audible breath sound without a clear inhale vs exhale distinction.',
  '[inhale]':       'Clear inward breath before or between phrases.',
  '[exhale]':       'Clear outward breath, often after a phrase or under stress.',
  '[sigh]':         'Prolonged or marked sigh.',
  '[sniff]':        'Nasal sniff or sniffle.',
  '[gasp]':         'Sharp gasp or sudden air intake.',
  '[blow]':         'Audible blow through the mouth, not speech.',
  '[laugh]':        'Laughter vocalization.',
  '[chuckle]':      'Softer, shorter, suppressed laugh.',
  '[giggle]':       'Higher-pitched or repeated light laugh.',
  '[snort]':        'Snort through nose or mouth while laughing or reacting.',
  '[scoff]':        'Dismissive exhalation or laugh-like puff.',
  '[grunt]':        'Short grunt or effort vocalization.',
  '[groan]':        'Longer groan or moan.',
  '[cry]':          'Crying, sobbing, or wailing sounds.',
  '[hum-tune]':     'Humming a melody or tune, not lexical humming words.',
  '[whoop]':        'Whoop or cheer-like shout, not normal spoken "whoop."',
  '[whistle]':      'Whistling.',
  '[tongue-click]': 'Tongue click / alveolar click.',
  '[tsk]':          'Tsk-tsk / reproach click.',
  '[lip-smack]':    'Lip smack.',
  '[teeth-suck]':   'Suck through teeth or sharp dental inhale.',
  '[lip-trill]':    'Bilabial trill / lip buzz.',
  '[shush]':        'Shushing sound, not the spoken word.',
  '[swallow]':      'Audible swallow.',
  '[clear-throat]': 'Throat clear / hack / harrumph.',
  '[cough]':        'Cough sound.',
  '[sneeze]':       'Sneeze sound.',
  '[yawn]':         'Yawn sound.',
  '[hiccup]':       'Hiccup sound.',
  '[unintelligible]': 'Speech was likely present but the words cannot be resolved.',
  '[other-noise]':  'Non-speech sound that does not fit a label above.',
};

export const TAGS = [...TAG_PINNED, ...TAG_EXTRA] as const;

export const ACCENTS: Record<string, string> = {
  super: 'súper',
  tambien: 'también',
  aqui: 'aquí',
  ahi: 'ahí',
  alli: 'allí',
  ademas: 'además',
  despues: 'después',
  facil: 'fácil',
  dificil: 'difícil',
  rapido: 'rápido',
  musica: 'música',
  ultimo: 'último',
  ultima: 'última',
  tipico: 'típico',
  practico: 'práctico',
  numero: 'número',
  telefono: 'teléfono',
  comodo: 'cómodo',
  logico: 'lógico',
  minimo: 'mínimo',
  maximo: 'máximo',
  quizas: 'quizás',
  jamas: 'jamás',
  atras: 'atrás',
  interes: 'interés',
  ningun: 'ningún',
  algun: 'algún',
};

export const CONTRACTIONS: Record<string, string> = {
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  cant: "can't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  wont: "won't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  youve: "you've",
  youd: "you'd",
  youll: "you'll",
  hes: "he's",
  shes: "she's",
  theyre: "they're",
  theyve: "they've",
  theyd: "they'd",
  theyll: "they'll",
  weve: "we've",
  thats: "that's",
  whos: "who's",
  whats: "what's",
  yall: "y'all",
};

/** Minimum segment duration (seconds). */
export const GAP = 0.2;

/** dB below peak for voice activity threshold. */
export const REL = 30;

/** Consecutive frames above threshold to count as voice onset/offset. */
export const RUN = 4;

export const HISTORY_LIMIT = 40;
export const STORAGE_KEY = 'seglst-workbench:v1';
export const LANG_KEY = 'seglst-workbench:lang';
export const THEME_KEY = 'seglst-workbench:theme';
