// --- State ---
const DEFAULT_SITE_NAME = 'Jellyfin Vote';
let state = {
  token: localStorage.getItem('jf_token') || null,
  userId: localStorage.getItem('jf_userid') || null,
  username: localStorage.getItem('jf_username') || null,
  isAdmin: localStorage.getItem('jf_isAdmin') === 'true',
  view: 'libraries',
  currentLibrary: null,
  siteName: DEFAULT_SITE_NAME,
};

// Load site name from backend, then render
(async () => {
  try {
    const resp = await fetch('/api/config');
    const data = await resp.json();
    state.siteName = data.siteName || DEFAULT_SITE_NAME;
  } catch (e) { /* ignore, use default */ }
  document.title = state.siteName;
  render();
})();

// --- API Helper ---
async function api(path, method = 'GET', body = null) {
  const headers = {
    'x-jellyfin-token': state.token,
    'x-jellyfin-userid': state.userId,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  if (resp.status === 401) {
    logout();
    throw new Error('Session expired');
  }
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// --- Auth ---
function logout() {
  localStorage.removeItem('jf_token');
  localStorage.removeItem('jf_userid');
  localStorage.removeItem('jf_username');
  localStorage.removeItem('jf_isAdmin');
  state = { token: null, userId: null, username: null, isAdmin: false, view: 'libraries', currentLibrary: null, siteName: state.siteName };
  render();
}

function saveAuth(data) {
  state.token = data.token;
  state.userId = data.userId;
  state.username = data.username;
  state.isAdmin = data.isAdmin;
  localStorage.setItem('jf_token', data.token);
  localStorage.setItem('jf_userid', data.userId);
  localStorage.setItem('jf_username', data.username);
  localStorage.setItem('jf_isAdmin', data.isAdmin);
}

// --- Render ---
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (!state.token) {
    renderLogin(app);
  } else if (state.view === 'libraries') {
    renderLibraries(app);
  } else if (state.view === 'library-items') {
    renderLibraryItems(app);
  } else if (state.view === 'delete-list') {
    renderDeleteList(app);
  }
}

// --- Login View ---
function renderLogin(app) {
  app.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <h2>${state.siteName}</h2>
        <div id="login-error" class="error-msg" style="display:none;"></div>
        <form id="login-form">
          <div class="form-group">
            <label>Benutzername</label>
            <input type="text" id="login-username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label>Passwort</label>
            <input type="password" id="login-password" autocomplete="current-password">
          </div>
          <button type="submit" class="login-btn" id="login-btn">Einloggen</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Einloggen...';

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Login failed');
      saveAuth(data);
      render();
    } catch (err) {
      errEl.textContent = err.message === 'Invalid credentials' ? 'Falscher Benutzername oder Passwort' : 'Login fehlgeschlagen';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Einloggen';
    }
  });
}

// --- Header ---
function renderHeader(app, activeView) {
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <h1 onclick="goToLibraries()">${state.siteName}</h1>
    <div class="header-right">
      <button class="nav-btn ${activeView === 'libraries' || activeView === 'library-items' ? 'active' : ''}" onclick="goToLibraries()">Bibliotheken</button>
      <button class="nav-btn ${activeView === 'delete-list' ? 'active' : ''}" onclick="goToDeleteList()">Löschliste</button>
      <span class="user-info">${state.username || ''}</span>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
  `;
  app.appendChild(header);
}

// --- Libraries View ---
async function renderLibraries(app) {
  renderHeader(app, 'libraries');
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Lade Bibliotheken...';
  app.appendChild(loading);

  try {
    const data = await api('/libraries');
    const grid = document.createElement('div');
    grid.className = 'libraries-grid';

    if (data.libraries.length === 0) {
      app.removeChild(loading);
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<h3>Keine Bibliotheken gefunden</h3><p>Du hast möglicherweise keine Bibliotheken freigegeben.</p>';
      app.appendChild(empty);
      return;
    }

    const icons = { movies: '🎬', tvshows: '📺', mixed: '🎞️' };
    for (const lib of data.libraries) {
      const card = document.createElement('div');
      card.className = 'library-card';
      const icon = icons[lib.CollectionType] || '📂';
      card.innerHTML = `
        <div class="icon">${icon}</div>
        <div class="name">${lib.Name}</div>
      `;
      card.addEventListener('click', () => {
        state.view = 'library-items';
        state.currentLibrary = { id: lib.Id, name: lib.Name, collectionType: lib.CollectionType };
        render();
      });
      grid.appendChild(card);
    }
    app.removeChild(loading);
    app.appendChild(grid);
  } catch (err) {
    app.removeChild(loading);
    const errEl = document.createElement('div');
    errEl.className = 'empty-state';
    errEl.innerHTML = `<h3>Fehler</h3><p>${err.message}</p>`;
    app.appendChild(errEl);
  }
}

// --- Library Items View ---
async function renderLibraryItems(app) {
  renderHeader(app, 'library-items');

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '← Zurück zu Bibliotheken';
  back.addEventListener('click', () => goToLibraries());
  app.appendChild(back);

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = state.currentLibrary.name;
  app.appendChild(title);

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Lade Inhalte...';
  app.appendChild(loading);

  try {
    const data = await api(`/library/${state.currentLibrary.id}/items`);
    app.removeChild(loading);

    // Stats bar
    let greenCount = 0, orangeCount = 0, redCount = 0;
    for (const item of data.items) {
      if (item.status === 'keep') greenCount++;
      else if (item.status === 'last-season') orangeCount++;
      else redCount++;
    }

    const stats = document.createElement('div');
    stats.className = 'stats-bar';
    stats.innerHTML = `
      <div class="stat"><div class="dot green"></div> Behalten: <span class="count">${greenCount}</span></div>
      <div class="stat"><div class="dot orange"></div> Letzte Staffel: <span class="count">${orangeCount}</span></div>
      <div class="stat"><div class="dot red"></div> Zum Löschen: <span class="count">${redCount}</span></div>
      <div class="stat">Gesamt: <span class="count">${data.items.length}</span></div>
    `;
    app.appendChild(stats);

    if (data.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<h3>Keine Inhalte gefunden</h3>';
      app.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'items-grid';

    for (const item of data.items) {
      grid.appendChild(createItemCard(item));
    }
    app.appendChild(grid);
  } catch (err) {
    app.removeChild(loading);
    const errEl = document.createElement('div');
    errEl.className = 'empty-state';
    errEl.innerHTML = `<h3>Fehler</h3><p>${err.message}</p>`;
    app.appendChild(errEl);
  }
}

function createItemCard(item) {
  const card = document.createElement('div');
  const statusClass = item.status === 'keep' ? 'voted' : (item.status === 'last-season' ? 'last-season' : 'not-voted');
  card.className = `item-card ${statusClass}`;
  card.dataset.itemId = item.id;

  const isSeries = item.type === 'Series';

  const posterHtml = item.imageTag
    ? `<img class="item-poster" src="/api/image/${item.id}?tag=${item.imageTag}&token=${encodeURIComponent(state.token)}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="item-poster-placeholder" style="display:none;">Kein Cover</div>`
    : `<div class="item-poster-placeholder">Kein Cover</div>`;

  const keepBtnClass = item.status === 'keep' ? 'keep' : 'not-voted';
  const keepBtnActive = item.status === 'keep';

  const seriesBtnHtml = isSeries ? `
    <button class="vote-btn ${item.status === 'last-season' ? 'last-season' : 'not-voted'}" data-vote-type="last-season">
      ${item.status === 'last-season' ? '★ Letzte Staffel' : 'Letzte Staffel'}
    </button>
  ` : '';

  card.innerHTML = `
    ${posterHtml}
    <div class="item-info">
      <div class="item-name">${item.name}</div>
      <div class="item-vote-bar">
        <button class="vote-btn ${keepBtnClass}" data-vote-type="keep">
          ${keepBtnActive ? '✓ Behalten' : 'Behalten'}
        </button>
        ${seriesBtnHtml}
      </div>
      <span class="vote-count">${item.voteCount} ${item.voteCount === 1 ? 'Stimme' : 'Stimmen'}</span>
      ${item.voters && item.voters.length > 0 && state.isAdmin ? `<div class="voters-tooltip">Abgestimmt: ${item.voters.map(v => v.username + (v.voteType === 'last-season' ? ' (letzte Staffel)' : '')).join(', ')}</div>` : ''}
    </div>
  `;

  card.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const voteType = btn.dataset.voteType;
      btn.disabled = true;
      try {
        const result = await api(`/vote/${item.id}`, 'POST', { voteType });
        const updated = { ...item, voteCount: result.voteCount, voters: result.voters, status: result.status };
        card.replaceWith(createItemCard(updated));
      } catch (err) {
        alert('Abstimmung fehlgeschlagen: ' + err.message);
      }
      btn.disabled = false;
    });
  });

  return card;
}

// --- Delete List View ---
async function renderDeleteList(app) {
  renderHeader(app, 'delete-list');

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Löschliste - Inhalte ohne Stimmen';
  app.appendChild(title);

  const desc = document.createElement('p');
  desc.style.color = 'var(--text-muted)';
  desc.style.marginBottom = '20px';
  desc.style.fontSize = '0.9rem';
  desc.textContent = 'Alle Filme und Serien, die niemand behalten möchte - alphabetisch sortiert.';
  app.appendChild(desc);

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Lade Löschliste...';
  app.appendChild(loading);

  try {
    const data = await api('/delete-list');
    app.removeChild(loading);

    const container = document.createElement('div');
    container.className = 'delete-list-container';

    // Movies section
    const moviesSection = document.createElement('div');
    moviesSection.className = 'delete-list-section';
    moviesSection.innerHTML = `<h2>Filme <span class="count">(${data.movies.length})</span></h2>`;
    if (data.movies.length === 0) {
      moviesSection.innerHTML += '<p style="color:var(--text-muted);padding:10px 0;">Keine Filme zum Löschen.</p>';
    } else {
      for (const movie of data.movies) {
        moviesSection.appendChild(createDeleteItem(movie));
      }
    }

    // Series section
    const seriesSection = document.createElement('div');
    seriesSection.className = 'delete-list-section';
    seriesSection.innerHTML = `<h2>Serien <span class="count">(${data.series.length})</span></h2>`;
    if (data.series.length === 0) {
      seriesSection.innerHTML += '<p style="color:var(--text-muted);padding:10px 0;">Keine Serien zum Löschen.</p>';
    } else {
      for (const series of data.series) {
        seriesSection.appendChild(createDeleteItem(series));
      }
    }

    container.appendChild(moviesSection);
    container.appendChild(seriesSection);
    app.appendChild(container);
  } catch (err) {
    app.removeChild(loading);
    const errEl = document.createElement('div');
    errEl.className = 'empty-state';
    errEl.innerHTML = `<h3>Fehler</h3><p>${err.message}</p>`;
    app.appendChild(errEl);
  }
}

function createDeleteItem(item) {
  const div = document.createElement('div');
  div.className = 'delete-item';
  const posterHtml = item.imageTag
    ? `<img class="delete-item-poster" src="/api/image/${item.id}?tag=${item.imageTag}&maxWidth=80&token=${encodeURIComponent(state.token)}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="delete-item-poster-placeholder" style="display:none;"></div>`
    : `<div class="delete-item-poster-placeholder"></div>`;

  div.innerHTML = `
    ${posterHtml}
    <div class="delete-item-info">
      <div class="delete-item-name">${item.name}</div>
      <div class="delete-item-lib">${item.libraryName}</div>
    </div>
    ${state.isAdmin ? `<button class="hide-btn" title="Von Liste ausblenden">Ausblenden</button>` : ''}
  `;

  if (state.isAdmin) {
    div.querySelector('.hide-btn').addEventListener('click', async () => {
      try {
        await api(`/hide/${item.id}`, 'POST');
        div.remove();
      } catch (err) {
        alert('Fehler: ' + err.message);
      }
    });
  }

  return div;
}

// --- Navigation ---
function goToLibraries() {
  state.view = 'libraries';
  state.currentLibrary = null;
  render();
}

function goToDeleteList() {
  state.view = 'delete-list';
  render();
}

// Make functions global for inline onclick
window.goToLibraries = goToLibraries;
window.goToDeleteList = goToDeleteList;
window.logout = logout;

// --- Init ---
render();
