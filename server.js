const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  loadVotes,
  saveVotes,
  loadSettings,
  saveSettings,
  DATA_DIR,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://localhost:8096';
const CLIENT_NAME = 'ChrisflixVote';
const CLIENT_VERSION = '1.0.0';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---

function authHeader(token) {
  let header = `MediaBrowser Client="${CLIENT_NAME}", Device="Web", DeviceId="chrisflix-vote-web", Version="${CLIENT_VERSION}"`;
  if (token) {
    header += `, Token="${token}"`;
  }
  return header;
}

async function jellyfinFetch(endpoint, token, options = {}) {
  const url = `${JELLYFIN_URL}${endpoint}`;
  const headers = {
    'Authorization': authHeader(token),
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`Jellyfin API error ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  // Check if response is JSON
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return resp.json();
  }
  return resp;
}

// --- Auth Middleware ---

function requireAuth(req, res, next) {
  const token = req.headers['x-jellyfin-token'];
  const userId = req.headers['x-jellyfin-userid'];
  if (!token || !userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.token = token;
  req.userId = userId;
  next();
}

// --- API Routes ---

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const body = { Username: username, Pw: password || '' };
    const data = await jellyfinFetch('/Users/AuthenticateByName', null, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    res.json({
      token: data.AccessToken,
      userId: data.User.Id,
      username: data.User.Name,
      isAdmin: data.User.Policy ? data.User.Policy.IsAdministrator : false,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user's libraries (views)
app.get('/api/libraries', requireAuth, async (req, res) => {
  try {
    const data = await jellyfinFetch(`/Users/${req.userId}/Views`, req.token);
    // Filter to only show video libraries (movies, tv shows, mixed)
    const libraries = (data.Items || []).filter(item => {
      const collectionType = item.CollectionType;
      return collectionType === 'movies' || collectionType === 'tvshows' || collectionType === 'mixed' || collectionType === null || collectionType === undefined;
    });
    res.json({ libraries });
  } catch (err) {
    console.error('Libraries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch libraries' });
  }
});

// Get items in a library
app.get('/api/library/:libraryId/items', requireAuth, async (req, res) => {
  try {
    const { libraryId } = req.params;
    const params = new URLSearchParams({
      ParentId: libraryId,
      Recursive: 'true',
      Fields: 'ImageTags,ProviderIds',
      EnableImageTypes: 'Primary',
    });
    // First get library info to determine type
    const viewsData = await jellyfinFetch(`/Users/${req.userId}/Views`, req.token);
    const lib = (viewsData.Items || []).find(i => i.Id === libraryId);

    let includeTypes = '';
    if (lib && lib.CollectionType === 'movies') {
      includeTypes = 'Movie';
    } else if (lib && lib.CollectionType === 'tvshows') {
      includeTypes = 'Series';
    } else {
      // Mixed or unknown - get both movies and series
      includeTypes = 'Movie,Series';
    }
    params.set('IncludeItemTypes', includeTypes);

    const data = await jellyfinFetch(
      `/Users/${req.userId}/Items?${params.toString()}`,
      req.token
    );

    const votes = loadVotes();

    // Check if current user is admin
    const currentUserData = await jellyfinFetch(`/Users/${req.userId}`, req.token);
    const isCurrentUserAdmin = currentUserData.Policy && currentUserData.Policy.IsAdministrator;

    const items = (data.Items || []).map(item => {
      const itemVotes = votes[item.Id] || { voters: [] };
      const hasKeep = itemVotes.voters.some(v => !v.voteType || v.voteType === 'keep');
      const hasLastSeason = itemVotes.voters.some(v => v.voteType === 'last-season');
      const status = hasKeep ? 'keep' : (hasLastSeason ? 'last-season' : 'delete');
      return {
        id: item.Id,
        name: item.Name,
        type: item.Type,
        imageTag: item.ImageTags && item.ImageTags.Primary,
        voteCount: itemVotes.voters.length,
        voters: isCurrentUserAdmin ? itemVotes.voters : [],
        status,
      };
    });

    res.json({ items, libraryName: lib ? lib.Name : 'Library' });
  } catch (err) {
    console.error('Library items error:', err.message);
    res.status(500).json({ error: 'Failed to fetch library items' });
  }
});

// Vote for an item
app.post('/api/vote/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { voteType } = req.body; // "keep" or "last-season"
    const votes = loadVotes();

    // Get username from Jellyfin
    const userData = await jellyfinFetch(`/Users/${req.userId}`, req.token);
    const username = userData.Name;

    if (!votes[itemId]) {
      votes[itemId] = { voters: [], keep: false };
    }

    const voterIndex = votes[itemId].voters.findIndex(v => v.userId === req.userId);
    if (voterIndex >= 0) {
      // User already voted - toggle off or change vote type
      if (votes[itemId].voters[voterIndex].voteType === voteType) {
        // Same vote type -> remove vote (toggle off)
        votes[itemId].voters.splice(voterIndex, 1);
      } else {
        // Different vote type -> update
        votes[itemId].voters[voterIndex].voteType = voteType;
      }
    } else {
      // Add vote
      votes[itemId].voters.push({ userId: req.userId, username, voteType: voteType || 'keep' });
    }

    // Determine status: green if any keep vote, orange if only last-season votes, red if no votes
    const hasKeep = votes[itemId].voters.some(v => !v.voteType || v.voteType === 'keep');
    const hasLastSeason = votes[itemId].voters.some(v => v.voteType === 'last-season');
    votes[itemId].status = hasKeep ? 'keep' : (hasLastSeason ? 'last-season' : 'delete');
    saveVotes(votes);

    // Check if current user is admin for voter visibility
    const isCurrentUserAdmin = userData.Policy && userData.Policy.IsAdministrator;

    res.json({
      voteCount: votes[itemId].voters.length,
      voters: isCurrentUserAdmin ? votes[itemId].voters : [],
      status: votes[itemId].status,
    });
  } catch (err) {
    console.error('Vote error:', err.message);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Get vote status for items (used for delete list)
app.get('/api/votes', requireAuth, async (req, res) => {
  try {
    const votes = loadVotes();
    res.json({ votes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// Get all items across all libraries for delete list
app.get('/api/delete-list', requireAuth, async (req, res) => {
  try {
    const viewsData = await jellyfinFetch(`/Users/${req.userId}/Views`, req.token);
    const votes = loadVotes();
    const settings = loadSettings();
    const hiddenIds = new Set(settings.hideFromDeleteList || []);

    const allMovies = [];
    const allSeries = [];

    for (const lib of (viewsData.Items || [])) {
      const collectionType = lib.CollectionType;
      if (!['movies', 'tvshows', 'mixed'].includes(collectionType) && collectionType !== null && collectionType !== undefined) {
        continue;
      }

      let includeTypes = '';
      if (collectionType === 'movies') includeTypes = 'Movie';
      else if (collectionType === 'tvshows') includeTypes = 'Series';
      else includeTypes = 'Movie,Series';

      const params = new URLSearchParams({
        ParentId: lib.Id,
        Recursive: 'true',
        IncludeItemTypes: includeTypes,
        Fields: 'ImageTags',
        EnableImageTypes: 'Primary',
      });

      const data = await jellyfinFetch(
        `/Users/${req.userId}/Items?${params.toString()}`,
        req.token
      );

      for (const item of (data.Items || [])) {
        if (hiddenIds.has(item.Id)) continue;
        const itemVotes = votes[item.Id] || { voters: [] };
        const isRed = itemVotes.voters.length === 0;
        if (!isRed) continue; // Only items with 0 votes in delete list

        const itemObj = {
          id: item.Id,
          name: item.Name,
          type: item.Type,
          libraryName: lib.Name,
          imageTag: item.ImageTags && item.ImageTags.Primary,
        };

        if (item.Type === 'Movie') {
          allMovies.push(itemObj);
        } else if (item.Type === 'Series') {
          allSeries.push(itemObj);
        }
      }
    }

    allMovies.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    allSeries.sort((a, b) => a.name.localeCompare(b.name, 'de'));

    res.json({ movies: allMovies, series: allSeries });
  } catch (err) {
    console.error('Delete list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch delete list' });
  }
});

// Hide item from delete list (admin only)
app.post('/api/hide/:itemId', requireAuth, async (req, res) => {
  try {
    // Check if admin
    const userData = await jellyfinFetch(`/Users/${req.userId}`, req.token);
    if (!userData.Policy || !userData.Policy.IsAdministrator) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { itemId } = req.params;
    const settings = loadSettings();
    if (!settings.hideFromDeleteList) {
      settings.hideFromDeleteList = [];
    }
    if (!settings.hideFromDeleteList.includes(itemId)) {
      settings.hideFromDeleteList.push(itemId);
      saveSettings(settings);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Hide error:', err.message);
    res.status(500).json({ error: 'Failed to hide item' });
  }
});

// Unhide item from delete list (admin only)
app.post('/api/unhide/:itemId', requireAuth, async (req, res) => {
  try {
    const userData = await jellyfinFetch(`/Users/${req.userId}`, req.token);
    if (!userData.Policy || !userData.Policy.IsAdministrator) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { itemId } = req.params;
    const settings = loadSettings();
    if (settings.hideFromDeleteList) {
      settings.hideFromDeleteList = settings.hideFromDeleteList.filter(id => id !== itemId);
      saveSettings(settings);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Unhide error:', err.message);
    res.status(500).json({ error: 'Failed to unhide item' });
  }
});

// Proxy images through backend (so frontend doesn't need direct Jellyfin access)
// Token passed as query param since <img> tags can't set custom headers
app.get('/api/image/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const token = req.query.token || '';
    const tag = req.query.tag || '';
    const maxWidth = req.query.maxWidth || '300';

    if (!token) {
      return res.status(401).send('Not authenticated');
    }

    const params = new URLSearchParams({ maxWidth, quality: '80' });
    if (tag) params.set('tag', tag);

    const resp = await fetch(
      `${JELLYFIN_URL}/Items/${itemId}/Images/Primary?${params.toString()}`,
      { headers: { 'Authorization': authHeader(token) } }
    );

    if (!resp.ok) {
      return res.status(resp.status).send('Image not found');
    }

    const contentType = resp.headers.get('content-type');
    if (contentType) res.set('Content-Type', contentType);
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Failed to fetch image');
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ChrisflixVote running on port ${PORT}`);
  console.log(`Jellyfin server: ${JELLYFIN_URL}`);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
});
