/**
 * PIXUPLAY – Real Anime & Donghua Streaming Web Application
 * Strict 2-Color Monochrome Design System (Pure Black #000000 & Pure White #FFFFFF)
 * Real streaming powered by wajik-anime-api (Otakudesu, Oploverz, Kuramanime)
 */

document.addEventListener('DOMContentLoaded', () => {

  // Helper for safe ID handling (handles both number and string slugs)
  function parseId(raw) {
    if (raw === undefined || raw === null) return '';
    const num = Number(raw);
    return isNaN(num) ? String(raw) : num;
  }

  // Safe blur to prevent aria-hidden focus warnings
  function safeBlur() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

  // LocalStorage helper
  function loadStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  // ============================================================
  // GLOBAL APPLICATION STATE
  // ============================================================
  const state = {
    currentPage: 'home',
    trending: [],
    donghua: [],
    shounen: [],
    isekai: [],
    classics: [],
    airing: [],
    scheduleData: [],
    azData: [],
    cache: new Map(),
    activeDay: 'Semua',
    azSelectedLetter: '',
    azSelectedGenre: '',
    azSelectedType: '',
    activeLibTab: 'favorit',

    // User collections
    favorites: loadStorage('pixuplay_favorites', []),
    watchlist: loadStorage('pixuplay_watchlist', []),
    history: loadStorage('pixuplay_history', []),
    comments: loadStorage('pixuplay_comments', {}),
    likes: loadStorage('pixuplay_likes', {}),

    // Active player & modal
    currentAnime: null,
    currentEpisode: 1,
    currentServers: [],
    currentServerIdx: 0,
    isTheater: false,
  };

  // ============================================================
  // DOM ELEMENT REFERENCES
  // ============================================================
  const DOM = {
    pages: document.querySelectorAll('.page'),
    navBtns: document.querySelectorAll('.nav-btn, .bnav-item'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    hamburgerBtn: document.getElementById('hamburger-btn'),

    // Topbar & Search
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    searchOverlay: document.getElementById('search-overlay'),
    searchResultsGrid: document.getElementById('search-results-grid'),
    searchQueryTitle: document.getElementById('search-query-title'),
    btnCloseSearch: document.getElementById('btn-close-search'),
    btnQuickTheme: document.getElementById('btn-quick-theme'),
    avatarBtn: document.getElementById('avatar-btn'),

    // Hero Spotlight
    heroBackdrop: document.getElementById('hero-backdrop'),
    heroOrigin: document.getElementById('hero-origin'),
    heroScore: document.getElementById('hero-score'),
    heroTitle: document.getElementById('hero-title'),
    heroDesc: document.getElementById('hero-desc'),
    heroEpInfo: document.getElementById('hero-ep-info'),
    heroGenres: document.getElementById('hero-genres'),
    btnHeroPlay: document.getElementById('btn-hero-play'),
    btnHeroDetail: document.getElementById('btn-hero-detail'),
    btnHeroBookmark: document.getElementById('btn-hero-bookmark'),

    // Home Rows & Grids
    trendingRow: document.getElementById('trending-row'),
    donghuaRow: document.getElementById('donghua-row'),
    shounenRow: document.getElementById('shounen-row'),
    isekaiRow: document.getElementById('isekai-row'),
    classicsRow: document.getElementById('classics-row'),
    airingGrid: document.getElementById('airing-grid'),
    genreChips: document.getElementById('genre-chips'),

    // Donghua Page
    donghuaFullGrid: document.getElementById('donghua-full-grid'),

    // Schedule Page
    dayTabs: document.getElementById('day-tabs'),
    scheduleListGrid: document.getElementById('schedule-list-grid'),

    // A-Z Page
    azLetters: document.getElementById('az-letters'),
    azGenreSelect: document.getElementById('az-genre-select'),
    azTypeSelect: document.getElementById('az-type-select'),
    azFullGrid: document.getElementById('az-full-grid'),

    // Library & Profile
    libraryContainer: document.getElementById('library-container'),
    libTabs: document.querySelectorAll('.lib-tab'),
    statFavCount: document.getElementById('stat-fav-count'),
    statWatchCount: document.getElementById('stat-watch-count'),
    statHistoryCount: document.getElementById('stat-history-count'),

    // Detail Modal
    detailOverlay: document.getElementById('detail-modal-overlay'),
    btnDetailClose: document.getElementById('btn-detail-close'),
    detailBannerWrap: document.getElementById('detail-banner-wrap'),
    detailPoster: document.getElementById('detail-poster'),
    detailTagsRow: document.getElementById('detail-tags-row'),
    detailH1: document.getElementById('detail-h1'),
    detailNative: document.getElementById('detail-native'),
    detailScore: document.getElementById('detail-score'),
    detailEpTotal: document.getElementById('detail-ep-total'),
    detailStatus: document.getElementById('detail-status'),
    detailSynopsis: document.getElementById('detail-synopsis'),
    btnDetailWatchFirst: document.getElementById('btn-detail-watch-first'),
    btnDetailToggleFav: document.getElementById('btn-detail-toggle-fav'),
    btnDetailToggleWatch: document.getElementById('btn-detail-toggle-watch'),
    detailEpGrid: document.getElementById('detail-ep-grid'),

    // Cinema Video Player Modal
    playerOverlay: document.getElementById('player-overlay'),
    playerModal: document.getElementById('player-modal'),
    btnPlayerBack: document.getElementById('btn-player-back'),
    btnPlayerClose: document.getElementById('btn-player-close'),
    btnTheaterMode: document.getElementById('btn-theater-mode'),
    playerTitle: document.getElementById('player-title'),
    playerEpText: document.getElementById('player-ep-text'),
    playerScreen: document.getElementById('player-screen'),
    serverBtns: document.getElementById('server-btns'),
    playerTotalEpLabel: document.getElementById('player-total-ep-label'),
    playerEpList: document.getElementById('player-ep-list'),
    btnPlayerLike: document.getElementById('btn-player-like'),
    playerLikeCounter: document.getElementById('player-like-counter'),
    btnPlayerFav: document.getElementById('btn-player-fav'),
    btnPlayerShare: document.getElementById('btn-player-share'),
    playerCommentInput: document.getElementById('player-comment-input'),
    btnSendComment: document.getElementById('btn-send-comment'),
    playerCommentsList: document.getElementById('player-comments-list'),

    // Toast
    toastPopup: document.getElementById('toast-popup'),
  };

  // ============================================================
  // DATA ACCESS HELPERS
  // ============================================================
  function getTitle(anime) {
    if (!anime) return 'Anime';
    return (
      anime.title?.english ||
      anime.title?.romaji ||
      anime.title?.userPreferred ||
      anime.title?.native ||
      'Anime'
    );
  }

  function getPoster(anime) {
    return (
      anime.coverImage?.extraLarge ||
      anime.coverImage?.large ||
      anime.coverImage?.medium ||
      anime.poster ||
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80'
    );
  }

  function getBanner(anime) {
    return (
      anime.bannerImage ||
      anime.coverImage?.extraLarge ||
      anime.coverImage?.large ||
      getPoster(anime)
    );
  }

  function getMatchPercentage(anime) {
    if (anime.averageScore) {
      return Math.min(99, Math.max(78, anime.averageScore));
    }
    return 94;
  }

  function getEpCount(anime) {
    if (anime.latestReleaseDate) return `${anime.latestReleaseDate}`;
    if (anime.episodes) return `${anime.episodes} Ep`;
    return 'Ongoing';
  }

  function showToast(message) {
    if (!DOM.toastPopup) return;
    DOM.toastPopup.textContent = message;
    DOM.toastPopup.classList.add('show');
    clearTimeout(DOM.toastPopup._timer);
    DOM.toastPopup._timer = setTimeout(() => {
      DOM.toastPopup.classList.remove('show');
    }, 2800);
  }

  // Cache an item by both id and animeId for quick retrieval
  function cacheItem(item) {
    if (!item) return;
    if (item.id) state.cache.set(item.id, item);
    if (item.animeId) state.cache.set(item.animeId, item);
    const titleKey = getTitle(item).toLowerCase().trim();
    state.cache.set(titleKey, item);
  }

  // ============================================================
  // CARD BUILDER (2-COLOR MONOCHROME AESTHETIC)
  // ============================================================
  function buildAnimeCardHTML(anime) {
    const id = anime.id || anime.animeId;
    const title = getTitle(anime);
    const poster = getPoster(anime);
    const matchPct = getMatchPercentage(anime);
    const epCount = getEpCount(anime);
    const isDonghua = anime.countryOfOrigin === 'CN';
    const typeLabel = isDonghua ? 'Donghua' : 'Anime';
    const typeClass = isDonghua ? 'badge-donghua' : 'badge-anime';
    const genres = (anime.genres || []).slice(0, 2).join(' • ') || 'Sub Indo';

    return `
      <article class="anime-card" data-id="${id}" tabindex="0" role="button" aria-label="${title}">
        <div class="card-thumb-wrap">
          <img class="card-poster" src="${poster}" alt="${title}" loading="lazy" />
          <div class="card-overlay">
            <button class="card-quick-play" data-play-id="${id}" title="Putar" aria-label="Putar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
          <span class="card-badge-top ${typeClass}">${typeLabel}</span>
          <span class="card-badge-ep">${epCount}</span>
        </div>
        <div class="card-body">
          <div class="card-score-row">
            <span class="card-star">${matchPct}% Cocok</span>
            <span class="card-status-text">Full HD</span>
          </div>
          <h3 class="card-title" title="${title}">${title}</h3>
          <p class="card-genres">${genres}</p>
        </div>
      </article>
    `;
  }

  // Attach click listeners to cards in any container
  function attachCardListeners(container) {
    if (!container) return;
    container.querySelectorAll('.anime-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const rawId = card.dataset.id;
        const id = parseId(rawId);
        if (e.target.closest('.card-quick-play')) {
          e.stopPropagation();
          openPlayer(id, 1);
        } else {
          openDetailModal(id);
        }
      });
    });
  }

  // ============================================================
  // API FETCH HELPER
  // ============================================================
  async function fetchAPI(endpoint) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn(`[Pixuplay API] ${endpoint} error:`, err);
      return [];
    }
  }

  // ============================================================
  // STARTUP DATA LOADING (REAL OTAKUDESU & KURAMANIME DATA)
  // ============================================================
  async function loadInitialData() {
    console.log('[Pixuplay] Loading live catalog from wajik-anime-api...');

    // 1. Trending Anime (Live Ongoing + Top Completed)
    const trending = await fetchAPI('/api/pixuplay/trending');
    state.trending = trending;
    trending.forEach(cacheItem);

    if (trending.length > 0) {
      renderHero(trending[0]);
    }
    renderRow(DOM.trendingRow, trending, 'Gagal memuat tren. Coba muat ulang.');

    // 2. Real Chinese Donghua (Kuramanime)
    const donghua = await fetchAPI('/api/pixuplay/donghua');
    state.donghua = donghua;
    donghua.forEach(cacheItem);
    renderRow(DOM.donghuaRow, donghua, 'Koleksi Donghua belum tersedia.');
    renderGrid(DOM.donghuaFullGrid, donghua);

    // 3. Shounen & Action Anime
    const shounen = await fetchAPI('/api/pixuplay/shounen');
    state.shounen = shounen;
    shounen.forEach(cacheItem);
    renderRow(DOM.shounenRow, shounen, 'Koleksi Shounen belum tersedia.');

    // 4. Isekai & Fantasy Anime
    const isekai = await fetchAPI('/api/pixuplay/isekai');
    state.isekai = isekai;
    isekai.forEach(cacheItem);
    renderRow(DOM.isekaiRow, isekai, 'Koleksi Isekai belum tersedia.');

    // 5. Masterpiece Classics
    const classics = await fetchAPI('/api/pixuplay/classics');
    state.classics = classics;
    classics.forEach(cacheItem);
    renderRow(DOM.classicsRow, classics, 'Koleksi Masterpiece belum tersedia.');

    // 6. Airing Now (Ongoing Grid)
    const airing = await fetchAPI('/api/pixuplay/ongoing');
    state.airing = airing;
    airing.forEach(cacheItem);
    renderGrid(DOM.airingGrid, airing.slice(0, 16));

    // 7. Schedule Data (Senin - Minggu)
    const schedule = await fetchAPI('/api/pixuplay/schedule');
    state.scheduleData = schedule;
    renderSchedule(state.activeDay);

    // 8. Secondary UI Views
    renderGenreChips();
    renderAZ();
    updateProfileStats();

    console.log(`[Pixuplay] Successfully loaded ${state.cache.size} titles into memory cache.`);
  }

  // ============================================================
  // HERO SPOTLIGHT (CINEMATIC HERO BANNER)
  // ============================================================
  function renderHero(anime) {
    if (!anime) return;
    const banner = getBanner(anime);
    const title = getTitle(anime);
    const matchPct = getMatchPercentage(anime);
    const isDonghua = anime.countryOfOrigin === 'CN';
    const origin = isDonghua ? 'DONGHUA CHINA' : 'ANIME JEPANG';
    const genres = (anime.genres || []).slice(0, 3).join(' • ') || 'Sub Indo';
    const desc = (anime.description || 'Streaming kualitas Full HD dengan subtitle Indonesia terlengkap dan server streaming berkecepatan tinggi di Pixuplay.').replace(/<[^>]*>?/gm, '');

    DOM.heroBackdrop.style.backgroundImage = `url('${banner}')`;
    DOM.heroOrigin.textContent = origin;
    DOM.heroScore.textContent = `${matchPct}% Cocok`;
    DOM.heroTitle.textContent = title;
    DOM.heroDesc.textContent = desc.length > 200 ? desc.slice(0, 200) + '...' : desc;
    DOM.heroEpInfo.textContent = anime.latestReleaseDate ? `Update: ${anime.latestReleaseDate}` : 'Episode Lengkap';
    DOM.heroGenres.textContent = genres;

    const animeId = anime.id || anime.animeId;
    DOM.btnHeroPlay.onclick = () => openPlayer(animeId, 1);
    DOM.btnHeroDetail.onclick = () => openDetailModal(animeId);
    DOM.btnHeroBookmark.onclick = () => toggleWatchlist(anime);

    const isWatch = state.watchlist.some(x => (x.id || x.animeId) === animeId);
    DOM.btnHeroBookmark.classList.toggle('active', isWatch);
  }

  // Generic Row & Grid Renderers
  function renderRow(container, items, emptyMsg) {
    if (!container) return;
    if (!items || !items.length) {
      container.innerHTML = `<p class="empty-state">${emptyMsg}</p>`;
      return;
    }
    container.innerHTML = items.map(buildAnimeCardHTML).join('');
    attachCardListeners(container);
  }

  function renderGrid(container, items) {
    if (!container) return;
    if (!items || !items.length) {
      container.innerHTML = `<p class="empty-state">Tidak ada konten tersedia.</p>`;
      return;
    }
    container.innerHTML = items.map(buildAnimeCardHTML).join('');
    attachCardListeners(container);
  }

  // Filter Chips for Genres
  const GENRE_LIST = [
    'Action', 'Adventure', 'Fantasy', 'Cultivation', 'Martial Arts',
    'Comedy', 'Romance', 'Sci-Fi', 'Supernatural', 'Isekai', 'Mystery', 'Drama'
  ];

  function renderGenreChips() {
    if (!DOM.genreChips) return;
    DOM.genreChips.innerHTML = GENRE_LIST.map(genre => `
      <button class="genre-chip" data-genre="${genre}">
        ${genre}
      </button>
    `).join('');

    DOM.genreChips.querySelectorAll('.genre-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.genre;
        switchPage('az-list');
        DOM.azGenreSelect.value = g;
        state.azSelectedGenre = g;
        renderAZGridFiltered();
      });
    });
  }

  // ============================================================
  // WEEKLY SCHEDULE (SENIN - MINGGU)
  // ============================================================
  function renderSchedule(filterDay) {
    if (!DOM.scheduleListGrid) return;

    let itemsToRender = [];

    // If live schedule data is available from Otakudesu
    if (state.scheduleData && state.scheduleData.length > 0) {
      if (filterDay === 'Semua') {
        state.scheduleData.forEach(dayGroup => {
          (dayGroup.animeList || []).forEach(a => {
            itemsToRender.push({
              id: a.animeId,
              animeId: a.animeId,
              title: { english: a.title, userPreferred: a.title },
              airDay: dayGroup.title,
              countryOfOrigin: 'JP',
            });
          });
        });
      } else {
        const matchedDay = state.scheduleData.find(d =>
          d.title.toLowerCase() === filterDay.toLowerCase()
        );
        if (matchedDay) {
          itemsToRender = (matchedDay.animeList || []).map(a => ({
            id: a.animeId,
            animeId: a.animeId,
            title: { english: a.title, userPreferred: a.title },
            airDay: matchedDay.title,
            countryOfOrigin: 'JP',
          }));
        }
      }
    }

    // Fallback: use airing items if schedule list empty
    if (itemsToRender.length === 0) {
      const combined = [...state.airing, ...state.trending];
      itemsToRender = Array.from(new Map(combined.map(x => [x.id || x.animeId, x])).values());
    }

    if (itemsToRender.length === 0) {
      DOM.scheduleListGrid.innerHTML = `
        <div class="empty-state">
          <p>Tidak ada jadwal tayang untuk hari ${filterDay}.</p>
        </div>
      `;
      return;
    }

    DOM.scheduleListGrid.innerHTML = itemsToRender.map(anime => {
      const title = getTitle(anime);
      const cached = state.cache.get(anime.id || anime.animeId);
      const poster = cached ? getPoster(cached) : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
      const airDay = anime.airDay || 'Update Mingguan';
      const isDonghua = anime.countryOfOrigin === 'CN';

      return `
        <div class="schedule-card" data-id="${anime.id || anime.animeId}">
          <div class="schedule-thumb">
            <img src="${poster}" alt="${title}" loading="lazy" />
          </div>
          <div class="schedule-info">
            <div class="schedule-meta-top">
              <span class="schedule-day-badge">${airDay}</span>
              <span class="schedule-type-badge ${isDonghua ? 'cn' : 'jp'}">${isDonghua ? 'Donghua' : 'Anime'}</span>
            </div>
            <h3 class="schedule-title">${title}</h3>
            <span class="schedule-ep">Sub Indo • Kualitas Full HD</span>
          </div>
          <button class="btn-sched-watch" data-play-id="${anime.id || anime.animeId}">Tonton</button>
        </div>
      `;
    }).join('');

    DOM.scheduleListGrid.querySelectorAll('.schedule-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-sched-watch')) return;
        openDetailModal(parseId(card.dataset.id));
      });
    });

    DOM.scheduleListGrid.querySelectorAll('.btn-sched-watch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlayer(parseId(btn.dataset.playId), 1);
      });
    });
  }

  // Day tabs listener
  if (DOM.dayTabs) {
    DOM.dayTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.day-tab-btn');
      if (!tab) return;
      DOM.dayTabs.querySelectorAll('.day-tab-btn').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      state.activeDay = tab.dataset.day;
      renderSchedule(state.activeDay);
    });
  }

  // ============================================================
  // A-Z KATALOG
  // ============================================================
  function renderAZ() {
    if (!DOM.azLetters) return;
    const alphabet = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    DOM.azLetters.innerHTML = alphabet.map(letter => `
      <button class="az-letter-btn ${letter === 'ALL' ? 'active' : ''}" data-letter="${letter}">
        ${letter}
      </button>
    `).join('');

    DOM.azLetters.addEventListener('click', (e) => {
      const btn = e.target.closest('.az-letter-btn');
      if (!btn) return;
      DOM.azLetters.querySelectorAll('.az-letter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.azSelectedLetter = btn.dataset.letter === 'ALL' ? '' : btn.dataset.letter;
      renderAZGridFiltered();
    });

    // Populate Genre Select dropdown
    if (DOM.azGenreSelect) {
      DOM.azGenreSelect.innerHTML = `<option value="">Semua Genre</option>` +
        GENRE_LIST.map(g => `<option value="${g}">${g}</option>`).join('');

      DOM.azGenreSelect.addEventListener('change', () => {
        state.azSelectedGenre = DOM.azGenreSelect.value;
        renderAZGridFiltered();
      });
    }

    if (DOM.azTypeSelect) {
      DOM.azTypeSelect.addEventListener('change', () => {
        state.azSelectedType = DOM.azTypeSelect.value;
        renderAZGridFiltered();
      });
    }

    renderAZGridFiltered();
  }

  function renderAZGridFiltered() {
    if (!DOM.azFullGrid) return;
    const combined = [...state.trending, ...state.donghua, ...state.shounen, ...state.isekai, ...state.airing];
    let list = Array.from(new Map(combined.map(item => [item.id || item.animeId, item])).values());

    // Filter by Letter
    if (state.azSelectedLetter) {
      if (state.azSelectedLetter === '#') {
        list = list.filter(item => /^[0-9]/.test(getTitle(item)));
      } else {
        list = list.filter(item => getTitle(item).toUpperCase().startsWith(state.azSelectedLetter));
      }
    }

    // Filter by Genre
    if (state.azSelectedGenre) {
      list = list.filter(item => (item.genres || []).includes(state.azSelectedGenre));
    }

    // Filter by Type
    if (state.azSelectedType) {
      list = list.filter(item => item.countryOfOrigin === state.azSelectedType);
    }

    if (list.length === 0) {
      DOM.azFullGrid.innerHTML = `<div class="empty-state"><p>Tidak ada anime/donghua yang sesuai dengan filter.</p></div>`;
      return;
    }

    DOM.azFullGrid.innerHTML = list.map(buildAnimeCardHTML).join('');
    attachCardListeners(DOM.azFullGrid);
  }

  // ============================================================
  // DETAIL MODAL (REAL EPISODE LIST & SYNOPSIS)
  // ============================================================
  async function openDetailModal(id) {
    safeBlur();

    let anime = state.cache.get(id);

    // Fetch fresh enriched details from server
    try {
      const res = await fetch(`/api/pixuplay/detail/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          anime = json.data;
          cacheItem(anime);
        }
      }
    } catch (err) {
      console.warn('Could not fetch extra detail, using cached data', err);
    }

    if (!anime) return;
    state.currentAnime = anime;

    const animeId = anime.id || anime.animeId;
    const title = getTitle(anime);
    const banner = getBanner(anime);
    const poster = getPoster(anime);
    const matchPct = getMatchPercentage(anime);
    const isDonghua = anime.countryOfOrigin === 'CN';
    const statusText = (anime.status || '').toLowerCase().includes('releasing') ? 'Sedang Tayang' : 'Tamat';
    const cleanDesc = (anime.description || 'Sinopsis tidak tersedia.').replace(/<[^>]*>?/gm, '');

    DOM.detailBannerWrap.style.backgroundImage = `url('${banner}')`;
    DOM.detailPoster.src = poster;
    DOM.detailPoster.alt = title;
    DOM.detailH1.textContent = title;
    DOM.detailNative.textContent = anime.title?.native || anime.title?.romaji || '';
    DOM.detailScore.textContent = `${matchPct}% Cocok`;
    DOM.detailEpTotal.textContent = anime.latestReleaseDate || `${anime.episodes || 12} Episode`;
    DOM.detailStatus.textContent = statusText;
    DOM.detailSynopsis.textContent = cleanDesc;

    // Genre Tags
    DOM.detailTagsRow.innerHTML = `
      <span class="badge-genre-tag" style="background:#ffffff;color:#000000;font-weight:800;">${isDonghua ? 'DONGHUA' : 'ANIME'}</span>
      ${(anime.genres || []).map(g => `<span class="badge-genre-tag">${g}</span>`).join('')}
    `;

    // Watch Button
    DOM.btnDetailWatchFirst.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
      Putar Episode 1
    `;
    DOM.btnDetailWatchFirst.onclick = () => {
      closeDetailModal();
      openPlayer(animeId, 1);
    };

    updateDetailFavButtons(anime);

    DOM.btnDetailToggleFav.onclick = () => {
      toggleFavorite(anime);
      updateDetailFavButtons(anime);
    };

    DOM.btnDetailToggleWatch.onclick = () => {
      toggleWatchlist(anime);
      updateDetailFavButtons(anime);
    };

    // Render Real Episode Buttons
    let episodesToRender = [];
    if (anime.episodeList && anime.episodeList.length > 0) {
      episodesToRender = anime.episodeList.map((ep, idx) => {
        const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10) || (idx + 1);
        return {
          num: num,
          title: `Episode ${ep.title}`,
          slug: ep.episodeId,
        };
      });
    } else {
      const epTotal = Math.min(Math.max(anime.episodes || 12, 1), 36);
      episodesToRender = Array.from({ length: epTotal }, (_, i) => ({
        num: i + 1,
        title: `Episode ${i + 1}`,
        slug: '',
      }));
    }

    DOM.detailEpGrid.innerHTML = episodesToRender.map(ep => `
      <button class="ep-grid-btn" data-ep="${ep.num}" data-ep-slug="${ep.slug}">
        ${ep.title}
      </button>
    `).join('');

    DOM.detailEpGrid.querySelectorAll('.ep-grid-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ep = parseInt(btn.dataset.ep, 10) || 1;
        closeDetailModal();
        openPlayer(animeId, ep);
      });
    });

    // Show Detail Modal
    DOM.detailOverlay.classList.add('active');
    DOM.detailOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function updateDetailFavButtons(anime) {
    const id = anime.id || anime.animeId;
    const isFav = state.favorites.some(x => (x.id || x.animeId) === id);
    const isWatch = state.watchlist.some(x => (x.id || x.animeId) === id);

    DOM.btnDetailToggleFav.innerHTML = isFav 
      ? '❤ Tersimpan di Favorit' 
      : '🤍 Favorit';
    DOM.btnDetailToggleFav.classList.toggle('active', isFav);

    DOM.btnDetailToggleWatch.innerHTML = isWatch 
      ? '✓ Di Daftar Saya' 
      : '+ Daftar Saya';
    DOM.btnDetailToggleWatch.classList.toggle('active', isWatch);
  }

  function closeDetailModal() {
    safeBlur();
    DOM.detailOverlay.classList.remove('active');
    DOM.detailOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (DOM.btnDetailClose) DOM.btnDetailClose.addEventListener('click', closeDetailModal);
  if (DOM.detailOverlay) {
    DOM.detailOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.detailOverlay) closeDetailModal();
    });
  }

  // ============================================================
  // CINEMA VIDEO PLAYER (REAL STREAMING POWERED BY WAJIK-ANIME-API)
  // ============================================================
  async function openPlayer(id, ep = 1) {
    safeBlur();
    closeDetailModal();

    let anime = state.cache.get(id);
    if (!anime) {
      try {
        const res = await fetch(`/api/pixuplay/detail/${id}`);
        if (res.ok) {
          const json = await res.json();
          anime = json.data;
          if (anime) cacheItem(anime);
        }
      } catch {}
    }

    if (!anime) {
      anime = {
        id: id,
        animeId: id,
        title: { english: String(id), userPreferred: String(id) },
        episodes: 12,
      };
    }

    state.currentAnime = anime;
    state.currentEpisode = ep;

    const title = getTitle(anime);
    DOM.playerTitle.textContent = title;
    DOM.playerEpText.textContent = `Episode ${ep}`;

    // Record History
    saveToHistory(anime, ep);

    // Show modal immediately with clean loading screen
    DOM.playerOverlay.classList.add('active');
    DOM.playerOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    DOM.playerScreen.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000000; color: #ffffff;">
        <div style="width: 38px; height: 38px; border: 3px solid #222222; border-top: 3px solid #ffffff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
        <p style="font-size: 14px; color: #888888; font-weight: 600; letter-spacing: 0.5px;">Menghubungkan ke server Otakudesu & Oploverz Sub Indo...</p>
      </div>
    `;

    // Render Episode pills bar & Social actions
    renderPlayerEpisodeStrip(anime, ep);
    renderPlayerSocial(anime.id || anime.animeId, ep);

    // Fetch Stream Servers from server.ts
    const streamEndpoint = `/api/pixuplay/stream/${id}/${ep}?title=${encodeURIComponent(title)}`;

    try {
      const res = await fetch(streamEndpoint);
      if (res.ok) {
        const streamData = await res.json();
        state.currentServers = streamData.servers || [];
      } else {
        state.currentServers = [];
      }
    } catch (e) {
      console.error('Failed to fetch stream resolver', e);
      state.currentServers = [];
    }

    renderServerButtons();
    loadStreamSource(0);
  }

  function renderServerButtons() {
    if (!DOM.serverBtns) return;
    if (!state.currentServers.length) {
      DOM.serverBtns.innerHTML = '<span class="server-empty">Server cadangan aktif</span>';
      return;
    }

    DOM.serverBtns.innerHTML = state.currentServers.map((srv, idx) => `
      <button class="server-btn ${idx === state.currentServerIdx ? 'active' : ''}" data-idx="${idx}">
        ${srv.name}
      </button>
    `).join('');

    DOM.serverBtns.querySelectorAll('.server-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        loadStreamSource(idx);
      });
    });
  }

  function loadStreamSource(idx) {
    state.currentServerIdx = idx;
    if (DOM.serverBtns) {
      DOM.serverBtns.querySelectorAll('.server-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
    }

    const srv = state.currentServers[idx];
    if (!srv) {
      DOM.playerScreen.innerHTML = `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0c0c0c; color: #fff; text-align: center; padding: 24px;">
          <p style="margin-bottom: 16px; color: #aaa;">Gagal memuat server video.</p>
          <button class="btn-primary" onclick="openPlayer('${state.currentAnime.id || state.currentAnime.animeId}', ${state.currentEpisode})" style="padding: 10px 24px; background: #fff; color: #000; border: none; border-radius: 4px; font-weight: 700; cursor: pointer;">
            Coba Muat Ulang ↻
          </button>
        </div>
      `;
      return;
    }

    // External Portal Card (e.g. Official Bstation / WeTV fallback)
    if (srv.type === 'external') {
      DOM.playerScreen.innerHTML = `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #080808; border: 1px solid #202020; padding: 28px; text-align: center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" width="48" height="48" style="margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10 8 16 12 10 16 10 8" fill="#ffffff"/>
          </svg>
          <h3 style="font-size: 18px; margin-bottom: 8px; color: #ffffff; font-weight: 700;">${srv.name}</h3>
          <p style="font-size: 14px; color: #888888; max-width: 480px; margin-bottom: 24px; line-height: 1.5;">
            Tonton streaming resmi kualitas HD Sub Indo langsung di platform penyedia resmi.
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
            <a href="${srv.url}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: #ffffff; color: #000000; font-weight: 700; border-radius: 4px; text-decoration: none; font-size: 14px;">
              Buka Streaming di Tab Baru ↗
            </a>
            <button id="btn-return-srv1" style="cursor: pointer; background: transparent; border: 1px solid #444; color: #fff; padding: 12px 20px; border-radius: 4px; font-weight: 600;">
              Server 1 ↺
            </button>
          </div>
        </div>
      `;
      const btnReturn = document.getElementById('btn-return-srv1');
      if (btnReturn) btnReturn.addEventListener('click', () => loadStreamSource(0));
      return;
    }

    // Direct Native HTML5 Video Player (MP4 / HLS)
    if (srv.type === 'direct') {
      DOM.playerScreen.innerHTML = `
        <video 
          src="${srv.url}" 
          controls 
          autoplay 
          playsinline 
          class="player-video"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000000; object-fit: contain;"
        ></video>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; background: rgba(10, 10, 10, 0.95); border-top: 1px solid #202020; font-size: 12px; color: #888888; z-index: 10;">
          <span>Server: <strong style="color: #ffffff;">${srv.name}</strong></span>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span style="background: #ffffff; color: #000000; padding: 2px 6px; border-radius: 2px; font-size: 11px; font-weight: 800;">720P FULL HD</span>
            <span style="background: #ffffff; color: #000000; padding: 2px 6px; border-radius: 2px; font-size: 11px; font-weight: 800;">SUB INDO</span>
            <a href="${srv.url}" target="_blank" rel="noopener noreferrer" style="color: #ffffff; border: 1px solid #333333; padding: 2px 10px; border-radius: 3px; text-decoration: none; font-weight: 600; font-size: 11px;">Buka File Video ↗</a>
          </div>
        </div>
      `;
      return;
    }

    // Embed Player (Desustream via Proxy, Odvidhide, Blogger Video Player)
    const finalEmbedUrl = (srv.url.includes('desustream.net') && !srv.url.includes('/api/pixuplay/embed-proxy'))
      ? `/api/pixuplay/embed-proxy?url=${encodeURIComponent(srv.url)}`
      : srv.url;

    DOM.playerScreen.innerHTML = `
      <div class="iframe-embed-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000000;">
        <iframe 
          src="${finalEmbedUrl}" 
          title="Pixuplay Player - ${getTitle(state.currentAnime)} Ep ${state.currentEpisode}"
          allowfullscreen 
          webkitallowfullscreen 
          mozallowfullscreen 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          class="player-iframe"
          style="width: 100%; height: 100%; border: none;"
        ></iframe>
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; background: rgba(10, 10, 10, 0.95); border-top: 1px solid #202020; font-size: 12px; color: #888888; z-index: 10;">
        <span>Server: <strong style="color: #ffffff;">${srv.name}</strong></span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="background: #ffffff; color: #000000; padding: 2px 6px; border-radius: 2px; font-size: 11px; font-weight: 800;">SUB INDO</span>
          <a href="${srv.url}" target="_blank" rel="noopener noreferrer" style="color: #ffffff; border: 1px solid #333333; padding: 2px 10px; border-radius: 3px; text-decoration: none; font-weight: 600; font-size: 11px;">Buka di Tab Baru ↗</a>
        </div>
      </div>
    `;
  }

  function renderPlayerEpisodeStrip(anime, currentEp) {
    if (!DOM.playerEpList) return;

    let episodes = [];
    if (anime.episodeList && anime.episodeList.length > 0) {
      episodes = anime.episodeList.map((ep, idx) => {
        const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10) || (idx + 1);
        return num;
      });
    } else {
      const total = Math.min(Math.max(anime.episodes || 12, 1), 48);
      episodes = Array.from({ length: total }, (_, i) => i + 1);
    }

    DOM.playerTotalEpLabel.textContent = `${episodes.length} Episode`;

    DOM.playerEpList.innerHTML = episodes.map(ep => `
      <button class="ep-pill-btn ${ep === currentEp ? 'active' : ''}" data-ep="${ep}">
        Ep ${ep}
      </button>
    `).join('');

    DOM.playerEpList.querySelectorAll('.ep-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const ep = parseInt(pill.dataset.ep, 10);
        openPlayer(anime.id || anime.animeId, ep);
      });
    });

    const activePill = DOM.playerEpList.querySelector('.ep-pill-btn.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function renderPlayerSocial(animeId, ep) {
    const key = `${animeId}_${ep}`;
    const likes = state.likes[key] || 128;
    if (DOM.playerLikeCounter) DOM.playerLikeCounter.textContent = likes;

    if (DOM.btnPlayerLike) {
      DOM.btnPlayerLike.onclick = () => {
        state.likes[key] = (state.likes[key] || 128) + 1;
        DOM.playerLikeCounter.textContent = state.likes[key];
        saveStorage('pixuplay_likes', state.likes);
        showToast('Terima kasih atas sukanya!');
      };
    }

    if (DOM.btnPlayerFav) {
      const isFav = state.favorites.some(x => (x.id || x.animeId) === animeId);
      DOM.btnPlayerFav.innerHTML = isFav 
        ? '<svg viewBox="0 0 24 24" fill="#ffffff" width="18" height="18"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Tersimpan'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Simpan';

      DOM.btnPlayerFav.onclick = () => {
        if (state.currentAnime) {
          toggleFavorite(state.currentAnime);
          renderPlayerSocial(animeId, ep);
        }
      };
    }

    if (DOM.btnPlayerShare) {
      DOM.btnPlayerShare.onclick = () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href);
          showToast('Tautan streaming disalin ke papan klip!');
        }
      };
    }

    // Render Comments
    renderComments(key);
  }

  function renderComments(key) {
    if (!DOM.playerCommentsList) return;
    const comments = state.comments[key] || [
      { user: 'OtakuIndo', text: 'Kualitas desustream mantap banget jernih 720p!', time: '10 menit lalu' },
      { user: 'DonghuaLover', text: 'Sub indonya pas dan rapi, recommended.', time: '1 jam lalu' },
    ];

    DOM.playerCommentsList.innerHTML = comments.map(c => `
      <div class="player-comment-item">
        <div class="comment-avatar-circle">${c.user[0].toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-header-row">
            <span class="comment-author">${c.user}</span>
            <span class="comment-time">${c.time}</span>
          </div>
          <p class="comment-text">${c.text}</p>
        </div>
      </div>
    `).join('');
  }

  function sendComment() {
    if (!DOM.playerCommentInput || !state.currentAnime) return;
    const text = DOM.playerCommentInput.value.trim();
    if (!text) return;

    const key = `${state.currentAnime.id || state.currentAnime.animeId}_${state.currentEpisode}`;
    if (!state.comments[key]) state.comments[key] = [];

    state.comments[key].unshift({
      user: 'Pengguna',
      text: text,
      time: 'Baru saja',
    });

    saveStorage('pixuplay_comments', state.comments);
    DOM.playerCommentInput.value = '';
    renderComments(key);
    showToast('Komentar berhasil dikirim');
  }

  if (DOM.btnSendComment) DOM.btnSendComment.addEventListener('click', sendComment);
  if (DOM.playerCommentInput) {
    DOM.playerCommentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendComment();
    });
  }

  // Theater Mode Toggle
  if (DOM.btnTheaterMode) {
    DOM.btnTheaterMode.addEventListener('click', () => {
      state.isTheater = !state.isTheater;
      DOM.playerModal.classList.toggle('theater-mode', state.isTheater);
      showToast(state.isTheater ? 'Mode Teater Aktif' : 'Mode Teater Nonaktif');
    });
  }

  function closePlayer() {
    safeBlur();
    DOM.playerOverlay.classList.remove('active');
    DOM.playerOverlay.setAttribute('aria-hidden', 'true');
    DOM.playerScreen.innerHTML = ''; // Stop audio/video playback immediately
    document.body.style.overflow = '';
  }

  if (DOM.btnPlayerClose) DOM.btnPlayerClose.addEventListener('click', closePlayer);
  if (DOM.btnPlayerBack) DOM.btnPlayerBack.addEventListener('click', closePlayer);

  // ============================================================
  // USER STORAGE & LIBRARY
  // ============================================================
  function toggleFavorite(anime) {
    const id = anime.id || anime.animeId;
    const exists = state.favorites.some(x => (x.id || x.animeId) === id);
    if (exists) {
      state.favorites = state.favorites.filter(x => (x.id || x.animeId) !== id);
      showToast('Dihapus dari Favorit');
    } else {
      state.favorites.unshift({
        id: id,
        animeId: id,
        title: anime.title,
        coverImage: anime.coverImage,
        genres: anime.genres,
        countryOfOrigin: anime.countryOfOrigin,
        averageScore: anime.averageScore,
        episodes: anime.episodes,
      });
      showToast('Ditambahkan ke Favorit');
    }
    saveStorage('pixuplay_favorites', state.favorites);
    updateProfileStats();
    if (state.currentPage === 'library') renderLibrary(state.activeLibTab);
  }

  function toggleWatchlist(anime) {
    const id = anime.id || anime.animeId;
    const exists = state.watchlist.some(x => (x.id || x.animeId) === id);
    if (exists) {
      state.watchlist = state.watchlist.filter(x => (x.id || x.animeId) !== id);
      showToast('Dihapus dari Daftar Saya');
    } else {
      state.watchlist.unshift({
        id: id,
        animeId: id,
        title: anime.title,
        coverImage: anime.coverImage,
        genres: anime.genres,
        countryOfOrigin: anime.countryOfOrigin,
        averageScore: anime.averageScore,
        episodes: anime.episodes,
      });
      showToast('Ditambahkan ke Daftar Saya');
    }
    saveStorage('pixuplay_watchlist', state.watchlist);
    updateProfileStats();
    if (state.currentPage === 'library') renderLibrary(state.activeLibTab);
  }

  function saveToHistory(anime, ep) {
    const id = anime.id || anime.animeId;
    state.history = state.history.filter(x => !((x.id || x.animeId) === id && x.ep === ep));
    state.history.unshift({
      id: id,
      animeId: id,
      title: anime.title,
      coverImage: anime.coverImage,
      genres: anime.genres,
      countryOfOrigin: anime.countryOfOrigin,
      averageScore: anime.averageScore,
      episodes: anime.episodes,
      ep: ep,
      watchedAt: new Date().toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    });
    state.history = state.history.slice(0, 50);
    saveStorage('pixuplay_history', state.history);
    updateProfileStats();
  }

  function renderLibrary(tab) {
    if (!DOM.libraryContainer) return;
    let list = [];
    if (tab === 'favorit') list = state.favorites;
    else if (tab === 'watchlist') list = state.watchlist;
    else if (tab === 'history') list = state.history;

    if (!list.length) {
      DOM.libraryContainer.innerHTML = `
        <div class="empty-state">
          <p>Belum ada serial di folder ${tab}. Mulai jelajahi dan simpan sekarang!</p>
          <button class="btn-primary" style="margin-top: 14px;" data-page="home">Eksplor Koleksi</button>
        </div>
      `;
      DOM.libraryContainer.querySelector('.btn-primary')?.addEventListener('click', () => switchPage('home'));
      return;
    }

    let headerHtml = '';
    if (tab === 'history') {
      headerHtml = `
        <div class="library-action-header">
          <span class="lib-action-title">Total Riwayat: <strong>${list.length} Episode</strong></span>
          <button class="btn-clear-history" id="btn-clear-all-history">
            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Hapus Semua Riwayat
          </button>
        </div>
      `;
    }

    const cardsHtml = list.map(item => {
      const id = item.id || item.animeId;
      const title = getTitle(item);
      const poster = getPoster(item);
      const extraEp = item.ep ? `(Episode ${item.ep}) • ${item.watchedAt || 'Baru ditonton'}` : '';

      return `
        <div class="library-card" data-id="${id}" data-ep="${item.ep || 1}">
          <div class="lib-thumb">
            <img src="${poster}" alt="${title}" loading="lazy" />
          </div>
          <div class="lib-info">
            <h3 class="lib-title">${title}</h3>
            <span class="lib-sub">${extraEp || (item.genres || []).slice(0, 2).join(' • ')}</span>
          </div>
          <div class="lib-actions">
            <button class="btn-lib-play" data-play-id="${id}" data-ep="${item.ep || 1}">Tonton</button>
            <button class="btn-lib-delete" data-del-type="${tab}" data-del-id="${id}" data-del-ep="${item.ep || 1}" title="Hapus item ini">
              ✕ Hapus
            </button>
          </div>
        </div>
      `;
    }).join('');

    DOM.libraryContainer.innerHTML = headerHtml + cardsHtml;

    // Clear all history listener
    const btnClearAll = DOM.libraryContainer.querySelector('#btn-clear-all-history');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        state.history = [];
        saveStorage('pixuplay_history', []);
        updateProfileStats();
        showToast('Semua riwayat tontonan berhasil dihapus');
        renderLibrary('history');
      });
    }

    // Individual delete listeners
    DOM.libraryContainer.querySelectorAll('.btn-lib-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delType = btn.dataset.delType;
        const delId = btn.dataset.delId;
        const delEp = parseInt(btn.dataset.delEp, 10) || 1;

        if (delType === 'history') {
          state.history = state.history.filter(x => !(String(x.id || x.animeId) === String(delId) && Number(x.ep) === Number(delEp)));
          saveStorage('pixuplay_history', state.history);
          showToast('Episode dihapus dari riwayat');
          renderLibrary('history');
        } else if (delType === 'favorit') {
          state.favorites = state.favorites.filter(x => String(x.id || x.animeId) !== String(delId));
          saveStorage('pixuplay_favorites', state.favorites);
          showToast('Dihapus dari favorit');
          renderLibrary('favorit');
        } else if (delType === 'watchlist') {
          state.watchlist = state.watchlist.filter(x => String(x.id || x.animeId) !== String(delId));
          saveStorage('pixuplay_watchlist', state.watchlist);
          showToast('Dihapus dari watchlist');
          renderLibrary('watchlist');
        }
        updateProfileStats();
      });
    });

    DOM.libraryContainer.querySelectorAll('.library-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-lib-delete')) return;
        const id = parseId(card.dataset.id);
        const ep = parseInt(card.dataset.ep, 10) || 1;
        if (e.target.closest('.btn-lib-play')) {
          e.stopPropagation();
          openPlayer(id, ep);
        } else {
          openDetailModal(id);
        }
      });
    });
  }

  // Library Tab Switching
  if (DOM.libTabs) {
    DOM.libTabs.forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        DOM.libTabs.forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        state.activeLibTab = tabBtn.dataset.tab;
        renderLibrary(state.activeLibTab);
      });
    });
  }

  function updateProfileStats() {
    if (DOM.statFavCount) DOM.statFavCount.textContent = state.favorites.length;
    if (DOM.statWatchCount) DOM.statWatchCount.textContent = state.watchlist.length;
    if (DOM.statHistoryCount) DOM.statHistoryCount.textContent = state.history.length;
  }

  // ============================================================
  // LIVE SEARCH (OTAKUDESU + OPLOVERZ MULTI-SEARCH)
  // ============================================================
  let searchTimer = null;

  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchTimer);

      if (q.length < 2) {
        closeSearch();
        return;
      }

      searchTimer = setTimeout(async () => {
        openSearch();
        DOM.searchQueryTitle.textContent = `Mencari "${q}" di database live...`;
        DOM.searchResultsGrid.innerHTML = `<div class="loading-spinner"></div>`;

        const results = await fetchAPI(`/api/pixuplay/search?q=${encodeURIComponent(q)}`);
        DOM.searchQueryTitle.textContent = `Hasil Pencarian "${q}" (${results.length})`;

        if (!results.length) {
          DOM.searchResultsGrid.innerHTML = `<div class="empty-state"><p>Tidak ada hasil untuk "${q}".</p></div>`;
          return;
        }

        results.forEach(cacheItem);
        DOM.searchResultsGrid.innerHTML = results.map(buildAnimeCardHTML).join('');
        attachCardListeners(DOM.searchResultsGrid);
      }, 350);
    });

    DOM.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });
  }

  if (DOM.searchClear) {
    DOM.searchClear.addEventListener('click', () => {
      DOM.searchInput.value = '';
      closeSearch();
    });
  }

  if (DOM.btnCloseSearch) {
    DOM.btnCloseSearch.addEventListener('click', closeSearch);
  }

  function openSearch() {
    DOM.searchOverlay.classList.add('active');
    DOM.searchOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeSearch() {
    safeBlur();
    DOM.searchOverlay.classList.remove('active');
    DOM.searchOverlay.setAttribute('aria-hidden', 'true');
  }

  // ============================================================
  // PAGE NAVIGATION (ROUTER)
  // ============================================================
  function switchPage(pageId) {
    safeBlur();
    state.currentPage = pageId;

    // Switch active page
    DOM.pages.forEach(p => {
      const isTarget = p.id === `page-${pageId}`;
      p.classList.toggle('active', isTarget);
      p.setAttribute('aria-hidden', !isTarget);
    });

    // Update active nav button
    DOM.navBtns.forEach(btn => {
      const itemPage = btn.dataset.page || btn.parentElement.dataset.page;
      const isActive = itemPage === pageId;
      btn.classList.toggle('active', isActive);
      if (btn.parentElement && btn.parentElement.classList.contains('nav-item')) {
        btn.parentElement.classList.toggle('active', isActive);
      }
    });

    closeMobileSidebar();
    closeSearch();

    // Trigger page-specific renders
    if (pageId === 'library') renderLibrary(state.activeLibTab);
    if (pageId === 'profile') updateProfileStats();
    if (pageId === 'az-list') renderAZGridFiltered();
    if (pageId === 'jadwal') renderSchedule(state.activeDay);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Nav click handlers
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-quick-play') || e.target.closest('.btn-sched-watch')) return;
      const targetPage = el.dataset.page;
      if (targetPage) switchPage(targetPage);
    });
  });

  // Mobile hamburger
  function toggleMobileSidebar() {
    DOM.sidebar.classList.toggle('open');
    DOM.sidebarBackdrop.classList.toggle('active');
  }

  function closeMobileSidebar() {
    safeBlur();
    DOM.sidebar.classList.remove('open');
    DOM.sidebarBackdrop.classList.remove('active');
  }

  if (DOM.hamburgerBtn) DOM.hamburgerBtn.addEventListener('click', toggleMobileSidebar);
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Quick theme / contrast toggle
  if (DOM.btnQuickTheme) {
    DOM.btnQuickTheme.addEventListener('click', () => {
      document.body.classList.toggle('light-contrast');
      showToast('Kontras tampilan disesuaikan');
    });
  }

  if (DOM.avatarBtn) {
    DOM.avatarBtn.addEventListener('click', () => switchPage('profile'));
  }

  const btnProfileClearHist = document.getElementById('btn-profile-clear-history');
  if (btnProfileClearHist) {
    btnProfileClearHist.addEventListener('click', () => {
      state.history = [];
      saveStorage('pixuplay_history', []);
      updateProfileStats();
      showToast('Semua riwayat tontonan berhasil dihapus');
    });
  }

  // Global keydown (ESC to close modals)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.playerOverlay.classList.contains('active')) closePlayer();
      else if (DOM.detailOverlay.classList.contains('active')) closeDetailModal();
      else if (DOM.searchOverlay.classList.contains('active')) closeSearch();
    }
  });

  // ============================================================
  // STARTUP INITIALIZATION
  // ============================================================
  loadInitialData();

  console.log('⚡ [Pixuplay] Pure Black & White streaming app live and connected to wajik-anime-api!');
});
