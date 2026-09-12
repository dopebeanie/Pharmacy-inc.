/* PHARMACY Mini App — роутер: home -> album -> track, плавные переходы, кнопка "назад" */
(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    try { tg.ready(); tg.expand(); } catch (e) {}
  }

  var screen = document.getElementById("screen");
  var backBtn = document.getElementById("backBtn");
  var counter = document.getElementById("counter");

  var DATA = null;
  var stack = [{ name: "home", params: {} }];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtTotal(album) {
    var sec = album.tracks.reduce(function (a, t) { return a + (t.seconds || 0); }, 0);
    return Math.floor(sec / 60) + " мин";
  }

  /* ---------- переходы ---------- */
  function current() { return stack[stack.length - 1]; }

  function go(view) {
    stack.push(view);
    render(true);
  }
  function back() {
    if (stack.length > 1) {
      stack.pop();
      render(true);
    }
  }

  function syncBack() {
    var canBack = stack.length > 1;
    backBtn.classList.toggle("is-hidden", !canBack);
    if (tg && tg.BackButton) {
      try {
        if (canBack) { tg.BackButton.show(); } else { tg.BackButton.hide(); }
      } catch (e) {}
    }
  }

  backBtn.addEventListener("click", back);
  if (tg && tg.BackButton) {
    try { tg.BackButton.onClick(back); } catch (e) {}
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { back(); }
  });

  /* ---------- lyrics: подсветка секций [Verse] ---------- */
  function renderLyrics(text) {
    var safe = esc(text || "Текст скоро появится.");
    safe = safe.replace(/^(\[[^\]\n]{1,40}\])$/gm, '<span class="sec">$1</span>');
    return '<div class="lyrics__text">' + safe + "</div>";
  }

  /* ---------- экраны ---------- */
  function viewHome() {
    var cards = DATA.albums.map(function (a, i) {
      return (
        '<article class="card" data-album="' + a.id + '" style="animation: rowIn .5s var(--ease) ' + (i * 0.08) + 's both">' +
          '<div class="card__cover"><img src="' + a.cover + '" alt="' + esc(a.title) + '" loading="lazy" />' +
          '<div class="card__sheen"></div></div>' +
          '<div class="card__body">' +
            '<div class="card__num">0' + (i + 1) + " — " + a.tracks.length + ' ТРЕКОВ</div>' +
            '<div class="card__title">' + esc(a.title) + "</div>" +
            '<div class="card__meta"><span>' + (a.year || "") + " · " + fmtTotal(a) + "</span>" +
            '<span class="card__go">→</span></div>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    return (
      '<section class="view">' +
        '<div class="hero"><h2 class="hero__title">Два альбома.<br /><em>Одна Pharmacy.</em></h2>' +
        '<p class="hero__sub">Выбери альбом — откроется треклист. Клик по треку покажет текст и метаданные.</p></div>' +
        '<div class="cards">' + cards + "</div>" +
      "</section>"
    );
  }

  function viewAlbum(id, query) {
    var a = DATA.albums.find(function (x) { return x.id === id; });
    if (!a) { return viewHome(); }
    var q = (query || "").toLowerCase();
    var list = a.tracks.filter(function (t) {
      return !q || t.title.toLowerCase().indexOf(q) !== -1;
    });
    var rows = list.map(function (t, i) {
      var sub = [t.producer ? "prod. " + t.producer : null, t.note].filter(Boolean).join(" · ");
      return (
        '<li class="track" data-album="' + a.id + '" data-track="' + t.n + '" style="animation-delay:' + Math.min(i * 0.03, 0.5) + 's">' +
          '<span class="track__n">' + String(t.n).padStart(2, "0") + "</span>" +
          '<span class="track__main"><span class="track__title">' + esc(t.title) + "</span>" +
          (sub ? '<span class="track__sub" style="display:block">' + esc(sub) + "</span>" : "") + "</span>" +
          '<span class="track__dur">' + esc(t.duration) + '</span><span class="track__arrow">›</span>' +
        "</li>"
      );
    }).join("");

    return (
      '<section class="view">' +
        '<div class="album-head"><div class="album-head__bg"><img src="' + a.cover + '" alt="" /></div>' +
          '<div class="album-head__fg"><img src="' + a.cover + '" alt="' + esc(a.title) + '" />' +
          "<div><h2>" + esc(a.title) + "</h2><p>" + esc(DATA.artist) + "</p>" +
          '<div class="album-head__badges"><span class="badge">' + a.tracks.length + ' треков</span>' +
          '<span class="badge">' + fmtTotal(a) + '</span><span class="badge">' + (a.year || "") + "</span></div>" +
        "</div></div></div>" +
        '<div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<input id="q" type="search" placeholder="Найти трек…" value="' + esc(query || "") + '" autocomplete="off" /></div>' +
        (rows ? '<ul class="tracks">' + rows + "</ul>" : '<div class="empty glass">Ничего не найдено.</div>') +
      "</section>"
    );
  }

  function otherTrack(a, n, dir) {
    var idx = a.tracks.findIndex(function (t) { return t.n === n; });
    var next = a.tracks[(idx + dir + a.tracks.length) % a.tracks.length];
    return next;
  }

  function viewTrack(albumId, n) {
    var a = DATA.albums.find(function (x) { return x.id === albumId; });
    if (!a) { return viewHome(); }
    var t = a.tracks.find(function (x) { return x.n === n; });
    if (!t) { return viewAlbum(albumId); }
    var prev = otherTrack(a, n, -1);
    var next = otherTrack(a, n, 1);

    return (
      '<section class="view">' +
        '<div class="song-head"><div class="song-head__bg"><img src="' + a.cover + '" alt="" /></div>' +
          '<div class="song-head__fg"><div class="song-head__kicker">ТРЕК ' + String(t.n).padStart(2, "0") + " / " + a.tracks.length + " — " + esc(a.title) + "</div>" +
          "<h2>" + esc(t.title) + "</h2>" +
          '<div class="meta">' +
            '<div class="meta__item"><small>Номер</small><b>' + t.n + "</b></div>" +
            '<div class="meta__item"><small>Длительность</small><b>' + esc(t.duration) + "</b></div>" +
            (t.producer ? '<div class="meta__item"><small>Продюсер</small><b>' + esc(t.producer) + "</b></div>" : "") +
            (t.note ? '<div class="meta__item"><small>Метка</small><b>' + esc(t.note) + "</b></div>" : "") +
          "</div>" +
        "</div></div>" +
        '<div class="lyrics glass">' + renderLyrics(t.lyrics) + "</div>" +
        '<div class="song-actions">' +
          '<button class="btn btn--ghost" data-goto-track="' + prev.n + '">‹ ' + esc(prev.title) + "</button>" +
          '<button class="btn btn--ghost" data-goto-track="' + next.n + '">' + esc(next.title) + " ›</button>" +
        "</div>" +
        '<div class="song-actions">' +
          '<a class="btn btn--primary" href="' + t.genius_url + '" target="_blank" rel="noopener">Открыть на Genius</a>' +
        "</div>" +
      "</section>"
    );
  }

  /* ---------- рендер ---------- */
  function render(animate) {
    var v = current();
    function paint() {
      var html;
      if (v.name === "album") { html = viewAlbum(v.params.id, v.params.q); }
      else if (v.name === "track") { html = viewTrack(v.params.id, v.params.n); }
      else { html = viewHome(); }
      screen.innerHTML = html;
      syncBack();
      bind();
      if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.selectionChanged(); } catch (e) {} }
      screen.querySelector(".view").scrollIntoView({ block: "start" });
    }
    if (!animate) { paint(); return; }
    var old = screen.querySelector(".view");
    if (old) {
      old.classList.add("view--out");
      setTimeout(paint, 160);
    } else { paint(); }
  }

  function bind() {
    screen.querySelectorAll("[data-album]:not([data-track])").forEach(function (el) {
      el.addEventListener("click", function () {
        go({ name: "album", params: { id: el.getAttribute("data-album"), q: "" } });
      });
    });
    screen.querySelectorAll(".track[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        go({ name: "track", params: { id: el.getAttribute("data-album"), n: +el.getAttribute("data-track") } });
      });
    });
    screen.querySelectorAll("[data-goto-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        var v = current();
        stack.pop();
        stack.push({ name: "track", params: { id: v.params.id, n: +el.getAttribute("data-goto-track") } });
        render(true);
      });
    });
    var q = document.getElementById("q");
    if (q) {
      q.addEventListener("input", function () {
        var v = current();
        v.params.q = q.value;
        var pos = q.selectionStart;
        render(false);
        var q2 = document.getElementById("q");
        if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} }
      });
    }
  }

  /* ---------- старт ---------- */
  fetch("data/albums.json")
    .then(function (r) {
      if (!r.ok) { throw new Error("HTTP " + r.status); }
      return r.json();
    })
    .then(function (json) {
      DATA = json;
      var total = DATA.albums.reduce(function (a, x) { return a + x.tracks.length; }, 0);
      counter.textContent = DATA.albums.length + " альбома · " + total + " треков";
      var params = new URLSearchParams(location.search);
      var startAlbum = params.get("album");
      if (startAlbum && DATA.albums.some(function (a) { return a.id === startAlbum; })) {
        stack.push({ name: "album", params: { id: startAlbum, q: "" } });
      }
      render(false);
    })
    .catch(function (err) {
      screen.innerHTML = '<div class="empty glass">Не удалось загрузить данные: ' + esc(err.message) + "</div>";
    });
})();
