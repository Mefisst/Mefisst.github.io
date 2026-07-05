(function () {
  'use strict';

  /*
   * Sisi Plus Patch
   * Основа: рабочий sisi.js с 78.17.216.151:9118
   * Правка: картинки карточек и иконки рекомендаций идут через image-proxy.
   */

  var SOURCE_SCRIPT = 'http://78.17.216.151:9118/sisi.js';
  var IMAGE_PROXY = 'https://sisi-img.mefist.workers.dev/?url=';
  var DEBUG = true;

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(console, ['SisiPlus:'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function notify(text) {
    try {
      if (window.Lampa && Lampa.Noty) Lampa.Noty.show(text);
    } catch (e) {}
  }

  function replaceFunction(code, functionName, newFunctionCode) {
    var start = code.indexOf('function ' + functionName + '(');
    if (start === -1) {
      log('function not found:', functionName);
      return code;
    }

    var brace = code.indexOf('{', start);
    if (brace === -1) return code;

    var depth = 0;
    var end = -1;

    for (var i = brace; i < code.length; i++) {
      var ch = code[i];

      if (ch === '{') depth++;
      if (ch === '}') depth--;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    if (end === -1) return code;

    return code.substring(0, start) + newFunctionCode + code.substring(end);
  }

  var NEW_FIX_CARDS = `
var SISI_PROXY_IMAGES = true;
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
  return /images\\.weserv\\.nl/i.test(url || '');
}

function sisiProxyImage(url) {
  url = sisiCleanUrl(url);

  if (!url) return '';
  if (!SISI_PROXY_IMAGES) return url;
  if (!/^https?:\\/\\//i.test(url)) return url;
  if (sisiIsProxyUrl(url)) return url;
  if (sisiIsVideoUrl(url)) return url;

  var clean = url.replace(/^https?:\\/\\//i, '');

  return SISI_IMAGE_PROXY + encodeURIComponent(clean);
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

function fixCards(json) {
  json.forEach(function(m) {
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

    m.name = Lampa.Utils.capitalizeFirstLetter(m.name || '').replace(/\\&(.*?);/g, '');
  });
}
`;

  function patchOriginalCode(code) {
    code = String(code || '');

    if (!code || code.indexOf('function fixCards') === -1) {
      throw new Error('Не найден оригинальный код sisi.js или функция fixCards');
    }

    code = replaceFunction(code, 'fixCards', NEW_FIX_CARDS);

    code = code.replace(
      /a\.icon\s*=\s*'<img class="size-youtube" src="'\s*\+\s*a\.picture\s*\+\s*'" \/>';?/g,
      "a.icon = '<img class=\"size-youtube\" src=\"' + sisiProxyImage(a.picture) + '\" />';"
    );

    code = code.replace(
      'video.src = element.preview;',
      "video.src = element.preview;\n        video.poster = element.picture || element.poster || element.img || element.background_image || '';\n        video.onerror = function() { container.addClass('hide'); };"
    );

    code = code.replace(
      "if (!window['plugin_sisi_' + Defined.use_api + '_ready']) {",
      "window['plugin_sisi_' + Defined.use_api + '_ready'] = false;\n  if (!window['plugin_sisi_' + Defined.use_api + '_ready']) {"
    );

    return code;
  }

  function runPatched(code) {
    try {
      var patched = patchOriginalCode(code);

      log('patched code ready, length:', patched.length);

      (0, eval)(patched);

      notify('SisiPlus: Клубничка загружена');
    } catch (e) {
      console.error('SisiPlus error:', e);
      notify('SisiPlus: ошибка патча');
    }
  }

  function loadOriginal() {
    try {
      if (window.Lampa && Lampa.Platform && Lampa.Platform.tv) {
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
      notify('SisiPlus: не удалось загрузить оригинальный sisi.js');
    }

    if (network.native) {
      network.native(SOURCE_SCRIPT, success, error, false, {
        dataType: 'text',
        timeout: 15000
      });
    } else {
      network.silent(SOURCE_SCRIPT, success, error, false, {
        dataType: 'text',
        timeout: 15000
      });
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
      if (e.type === 'ready') init();
    });
  } else {
    setTimeout(init, 1000);
  }
})();
