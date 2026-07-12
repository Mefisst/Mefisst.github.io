(function () {
  'use strict';

  /*
   * Sisi Plus Patch
   *
   * 1. Миниатюры идут через Vercel image-proxy.
   * 2. Общий фильтр скрывает карточки с признаками trans/gay.
   * 3. Видео не проксируется.
   * 4. Уведомление SisiPlus о загрузке не показывается.
   */

  var SOURCE_SCRIPT = 'http://78.17.216.151:9118/sisi.js';
  var IMAGE_PROXY = 'https://mefisst-github-io.vercel.app/api/proxy?url=';
  var DEBUG = true;

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(
        console,
        ['SisiPlus:'].concat(Array.prototype.slice.call(arguments))
      );
    }
  }

  function replaceFunction(code, functionName, newFunctionCode) {
    var start = code.indexOf('function ' + functionName + '(');

    if (start === -1) {
      log('function not found:', functionName);
      return code;
    }

    var brace = code.indexOf('{', start);

    if (brace === -1) {
      return code;
    }

    var depth = 0;
    var end = -1;

    for (var i = brace; i < code.length; i++) {
      var ch = code[i];

      if (ch === '{') {
        depth++;
      }

      if (ch === '}') {
        depth--;
      }

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    if (end === -1) {
      return code;
    }

    return (
      code.substring(0, start) +
      newFunctionCode +
      code.substring(end)
    );
  }

  var NEW_FIX_CARDS = `
var SISI_PROXY_IMAGES = true;
var SISI_FILTER_GENERAL = true;
var SISI_FILTER_DEBUG = false;
var SISI_IMAGE_PROXY = '${IMAGE_PROXY}';

function sisiCleanUrl(url) {
  if (!url) return '';

  url = String(url).trim();

  if (!url) return '';

  if (url.indexOf(',') !== -1 && url.indexOf(' ') !== -1) {
    url = url.split(',')[0].trim().split(' ')[0];
  }

  url = url
    .replace(/&amp;/g, '&')
    .replace(/\\\\/g, '');

  if (url.indexOf('//') === 0) {
    url = 'https:' + url;
  }

  return url;
}

function sisiIsVideoUrl(url) {
  return /\\.(mp4|webm|m3u8|mpd)(\\?|#|$)/i.test(url || '');
}

function sisiIsProxyUrl(url) {
  return /(images\\.weserv\\.nl|sisi-img\\.mefist\\.workers\\.dev|mefisst-github-io\\.vercel\\.app)/i.test(url || '');
}

function sisiProxyImage(url) {
  url = sisiCleanUrl(url);

  if (!url) return '';
  if (!SISI_PROXY_IMAGES) return url;
  if (!/^https?:\\/\\//i.test(url)) return url;
  if (sisiIsProxyUrl(url)) return url;
  if (sisiIsVideoUrl(url)) return url;

  return SISI_IMAGE_PROXY + encodeURIComponent(url);
}

function sisiPickImage(m) {
  return sisiCleanUrl(
    m.picture ||
    m.poster ||
    m.img ||
    m.background_image ||
    m.thumb ||
    m.thumbnail ||
    m.image ||
    m.cover ||
    ''
  );
}

function sisiTextValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value || '');
  }
}

function sisiNormalizeFilterText(text) {
  text = String(text || '');

  try {
    text = decodeURIComponent(text);
  } catch (e) {}

  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/[-_+./|:]+/g, ' ')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function sisiCardText(m) {
  var fields = [
    'name',
    'title',
    'original_title',
    'description',
    'descr',
    'about',
    'tag',
    'tags',
    'category',
    'categories',
    'genre',
    'genres',
    'search',
    'query',
    'url',
    'link',
    'uri',
    'video',
    'video_url',
    'video_reserve',
    'preview',
    'picture',
    'poster',
    'img',
    'image',
    'thumb',
    'thumbnail',
    'source',
    'site',
    'provider',
    'group',
    'type'
  ];

  var parts = [];

  for (var i = 0; i < fields.length; i++) {
    var key = fields[i];

    if (m && m[key] !== undefined && m[key] !== null) {
      parts.push(sisiTextValue(m[key]));
    }
  }

  return sisiNormalizeFilterText(parts.join(' '));
}

function sisiContainsBlockedPhrase(text, phrase) {
  var normalizedPhrase = sisiNormalizeFilterText(phrase);

  if (!normalizedPhrase) {
    return false;
  }

  return (
    (' ' + text + ' ').indexOf(
      ' ' + normalizedPhrase + ' '
    ) !== -1
  );
}

function sisiIsBlockedCard(m) {
  var text = sisiCardText(m);

  if (!text) {
    return false;
  }

  var blockedPhrases = [
    'trans',
    'transgender',
    'trans gender',
    'transgenders',
    'transsexual',
    'trans sexual',
    'transsexuals',
    'transvestite',
    'trans vestite',
    'transvestites',

    'shemale',
    'she male',
    'shemales',

    'ladyboy',
    'lady boy',
    'ladyboys',

    'tranny',
    'trannies',

    'tgirl',
    't girl',
    't girls',

    'newhalf',
    'new half',

    'femboy',
    'fem boy',
    'femboys',

    'crossdresser',
    'cross dresser',
    'crossdressers',
    'crossdressing',
    'cross dressing',

    'trap',

    'gay',
    'gays',
    'gaysex',
    'gay sex',
    'gayporn',
    'gay porn',
    'gayboy',
    'gay boy',
    'gayboys',
    'gay boys',
    'gayman',
    'gay man',
    'gaymen',
    'gay men',

    'homosexual',
    'homosexuals',
    'homo',

    'twink',
    'twinks',
    'yaoi',

    'm2m',
    'm4m',

    'man on man',
    'men on men',
    'boy on boy',
    'boys on boys',
    'male on male',
    'male male',

    'транс',
    'трансы',
    'трансов',
    'трансами',

    'трансгендер',
    'транс гендер',
    'трансгендеры',
    'трансгендеров',

    'транссексуал',
    'транс сексуал',
    'транссексуалы',
    'транссексуалов',

    'трансвестит',
    'трансвеститы',
    'трансвеститов',

    'ледибой',
    'леди бой',
    'ледибои',

    'фембой',
    'фем бой',
    'фембои',

    'кроссдрессер',
    'кросс дрессер',

    'гей',
    'геи',
    'геев',
    'геями',
    'гейский',
    'гейская',
    'гейское',
    'гейские',
    'гей порно',

    'гомо',
    'гомосексуал',
    'гомосексуалы',
    'гомосексуалов',

    'мужик с мужиком',
    'мужчина с мужчиной',
    'мужчины с мужчинами',
    'парень с парнем',
    'парни с парнями'
  ];

  for (var i = 0; i < blockedPhrases.length; i++) {
    if (sisiContainsBlockedPhrase(text, blockedPhrases[i])) {
      return true;
    }
  }

  if (
    /(?:^| )(трансгендер|транссексуал|трансвестит|гомосексуал|кроссдрессер)[а-я]*(?:$| )/.test(text)
  ) {
    return true;
  }

  if (
    /(?:^| )(transgender|transsexual|transvestite|shemale|ladyboy|femboy|crossdresser|homosexual|twink)[a-z]*(?:$| )/.test(text)
  ) {
    return true;
  }

  return false;
}

function fixCards(json) {
  if (!Array.isArray(json)) {
    return;
  }

  for (var i = json.length - 1; i >= 0; i--) {
    var m = json[i] || {};

    if (
      SISI_FILTER_GENERAL &&
      sisiIsBlockedCard(m)
    ) {
      if (SISI_FILTER_DEBUG && window.console) {
        console.log(
          'SisiPlus: карточка скрыта:',
          m.name || m.title || ''
        );
      }

      json.splice(i, 1);
      continue;
    }

    var original_picture = sisiPickImage(m);

    if (original_picture) {
      var proxied_picture = sisiProxyImage(original_picture);

      m.picture_original = original_picture;
      m.picture = proxied_picture;
      m.background_image = proxied_picture;
      m.poster = proxied_picture;
      m.img = proxied_picture;
    }

    if (m.preview) {
      m.preview = sisiCleanUrl(m.preview);
    }

    m.name = Lampa.Utils
      .capitalizeFirstLetter(m.name || '')
      .replace(/\\&(.*?);/g, '');
  }
}
`;

  function patchOriginalCode(code) {
    code = String(code || '');

    if (!code || code.indexOf('function fixCards') === -1) {
      throw new Error(
        'Не найден оригинальный код sisi.js или функция fixCards'
      );
    }

    code = replaceFunction(code, 'fixCards', NEW_FIX_CARDS);

    code = code.replace(
      /a\.icon\s*=\s*'<img class="size-youtube" src="'\s*\+\s*a\.picture\s*\+\s*'" \/>';?/g,
      "a.icon = '<img class=\"size-youtube\" src=\"' + sisiProxyImage(a.picture) + '\" />';"
    );

    code = code.replace(
      'video.src = element.preview;',
      "video.src = element.preview;\n" +
      "        video.poster = element.picture || element.poster || element.img || element.background_image || '';\n" +
      "        video.onerror = function() { container.addClass('hide'); };"
    );

    code = code.replace(
      "if (!window['plugin_sisi_' + Defined.use_api + '_ready']) {",
      "window['plugin_sisi_' + Defined.use_api + '_ready'] = false;\n" +
      "  if (!window['plugin_sisi_' + Defined.use_api + '_ready']) {"
    );

    return code;
  }

  function runPatched(code) {
    try {
      var patched = patchOriginalCode(code);

      log('patched code ready, length:', patched.length);

      (0, eval)(patched);
    } catch (e) {
      console.error('SisiPlus error:', e);
    }
  }

  function loadOriginal() {
    try {
      if (
        window.Lampa &&
        Lampa.Platform &&
        Lampa.Platform.tv
      ) {
        Lampa.Platform.tv();
      }
    } catch (e) {}

    var network = new Lampa.Reguest();

    function success(data) {
      if (typeof data !== 'string') {
        try {
          data = JSON.stringify(data);
        } catch (e) {
          data = '';
        }
      }

      runPatched(data);
    }

    function error(e) {
      console.error('SisiPlus load error:', e);
    }

    if (network.native) {
      network.native(
        SOURCE_SCRIPT,
        success,
        error,
        false,
        {
          dataType: 'text',
          timeout: 15000
        }
      );
    } else {
      network.silent(
        SOURCE_SCRIPT,
        success,
        error,
        false,
        {
          dataType: 'text',
          timeout: 15000
        }
      );
    }
  }

  function init() {
    if (!window.Lampa || !Lampa.Reguest) {
      setTimeout(init, 500);
      return;
    }

    loadOriginal();
  }

  if (window.appready) {
    init();
  } else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') {
        init();
      }
    });
  } else {
    setTimeout(init, 1000);
  }
})();
