import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Database,
  LogOut,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Film,
  KeyRound,
  Lock,
  MonitorPlay,
  Save,
  Upload,
  Volume2,
  Wand2
} from 'lucide-react';
import {
  clearAdminToken,
  createUser,
  deleteVideo,
  getAdminToken,
  getCurrentAdmin,
  getEmbedVideo,
  getStorageInfo,
  listVideos,
  listUsers,
  loginAdmin,
  updateVideo,
  uploadVideo,
  verifyPassword
} from './api.js';

const defaultOptions = {
  width: 800,
  height: 450,
  controls: true,
  muted: false,
  autoplay: false
};

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith('/embed/')) return <EmbedPlayer id={path.split('/').pop()} />;
  return <AdminApp />;
}

function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(Boolean(getAdminToken()));

  useEffect(() => {
    if (!getAdminToken()) return;
    getCurrentAdmin()
      .then((data) => setAdmin(data.user))
      .catch(() => clearAdminToken())
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    clearAdminToken();
    setAdmin(null);
  }

  if (checking) return <main className="shell"><div className="panel loading-panel">Checking admin session...</div></main>;
  if (!admin) return <LoginScreen onLogin={setAdmin} />;
  return <Dashboard admin={admin} onLogout={logout} />;
}

function LoginScreen({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await loginAdmin({
        username: form.get('username'),
        password: form.get('password')
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <span className="login-mark"><Shield size={28} /></span>
        <p className="eyebrow">Admin access</p>
        <h1>VOC PLAY</h1>
        <label>
          Username
          <input name="username" autoComplete="username" />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        <button className="primary-action" disabled={busy}>
          <Shield size={17} />
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}

function Dashboard({ admin, onLogout }) {
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('studio');

  async function refresh() {
    const data = await listVideos();
    setVideos(data.videos);
    setSelectedId((current) => current || data.videos[0]?.id || null);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      const data = await uploadVideo({
        title: form.get('title'),
        password: form.get('password'),
        file: form.get('video')
      });
      formEl.reset();
      await refresh();
      setSelectedId(data.video.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = videos.find((video) => video.id === selectedId);

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand-mark">
          <span><MonitorPlay size={24} /></span>
          <div>
            <p className="eyebrow">VOC PLAY</p>
            <h1>Admin Dashboard</h1>
          </div>
        </div>
        <button className="sample-link" onClick={onLogout}>
          <LogOut size={16} />
          {admin.username}
        </button>
      </section>

      <nav className="tabs">
        <button className={tab === 'studio' ? 'active' : ''} onClick={() => setTab('studio')}>
          <MonitorPlay size={16} />
          Studio
        </button>
        <button className={tab === 'database' ? 'active' : ''} onClick={() => setTab('database')}>
          <Database size={16} />
          Database
        </button>
        {admin.role === 'admin' && (
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            <Users size={16} />
            Users
          </button>
        )}
      </nav>

      {tab === 'users' && admin.role === 'admin' ? (
        <UsersPanel />
      ) : tab === 'database' ? (
        <DatabasePanel videos={videos} onRefresh={refresh} />
      ) : (

      <section className="workspace">
        <aside className="panel upload-panel">
          <div className="panel-title">
            <Upload size={18} />
            <h2>Upload</h2>
          </div>
          <form onSubmit={handleUpload}>
            <label>
              Title
              <input name="title" placeholder="Product walkthrough" />
            </label>
            <label>
              Video file
              <input required name="video" type="file" accept="video/*" />
            </label>
            <label>
              Password optional
              <input name="password" type="password" placeholder="Leave blank for public" />
            </label>
            <button className="primary-action" disabled={busy}>
              <Upload size={17} />
              {busy ? 'Uploading...' : 'Upload and host'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}

          <div className="panel-title library-title">
            <Film size={18} />
            <h2>Library</h2>
          </div>
          <div className="video-list">
            {videos.map((video) => (
              <button
                className={video.id === selectedId ? 'video-row active' : 'video-row'}
                key={video.id}
                onClick={() => setSelectedId(video.id)}
              >
                <span>{video.title}</span>
                <small>{video.passwordEnabled ? 'Protected' : 'Public'}</small>
              </button>
            ))}
            {!videos.length && <p className="muted">No videos uploaded yet.</p>}
          </div>
        </aside>

        <section className="panel editor-panel">
          {selected ? <VideoEditor video={selected} onSaved={refresh} /> : <EmptyState />}
        </section>
      </section>
      )}
    </main>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshUsers() {
    const data = await listUsers();
    setUsers(data.users);
  }

  useEffect(() => {
    refreshUsers().catch((err) => setStatus(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      await createUser({
        username: form.get('username'),
        password: form.get('password'),
        role: form.get('role')
      });
      formEl.reset();
      await refreshUsers();
      setStatus('Account created.');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="users-layout">
      <div className="panel user-create-panel">
        <div className="panel-title">
          <UserPlus size={18} />
          <h2>Create Account</h2>
        </div>
        <form onSubmit={submit}>
          <label>
            Username
            <input name="username" minLength="3" required placeholder="creator1" />
          </label>
          <label>
            Password
            <input name="password" minLength="8" required type="password" placeholder="At least 8 characters" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="user">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="primary-action" disabled={busy}>
            <UserPlus size={17} />
            {busy ? 'Creating...' : 'Create account'}
          </button>
        </form>
        {status && <p className="status">{status}</p>}
      </div>

      <div className="panel table-panel">
        <div className="data-table">
          <div className="user-table-head">
            <span>Username</span>
            <span>Role</span>
            <span>Created</span>
          </div>
          {users.map((user) => (
            <div className="user-table-row" key={user.id}>
              <strong>{user.username}</strong>
              <span>{user.role}</span>
              <span>{new Date(user.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoEditor({ video, onSaved }) {
  const [title, setTitle] = useState(video.title);
  const [passwordEnabled, setPasswordEnabled] = useState(video.passwordEnabled);
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState(video.playerOptions || defaultOptions);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(video.title);
    setPasswordEnabled(video.passwordEnabled);
    setPassword('');
    setOptions(video.playerOptions || defaultOptions);
    setStatus('');
    setCopied(false);
  }, [video.id, video.passwordEnabled, video.playerOptions, video.title]);

  const embedCode = useMemo(() => {
    const origin = window.location.origin;
    return `<iframe src="${origin}/embed/${video.id}" width="${options.width}" height="${options.height}" allow="fullscreen" frameborder="0"></iframe>`;
  }, [video.id, options.width, options.height]);

  async function save() {
    setStatus('Saving...');
    try {
      await updateVideo(video.id, { title, passwordEnabled, password, playerOptions: options });
      await onSaved();
      setStatus('Saved.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setStatus('Copy blocked by browser permissions.');
    }
  }

  return (
    <div className="editor-grid">
      <div className="settings-column">
        <div className="panel-title">
          <Wand2 size={18} />
          <h2>Embed Settings</h2>
        </div>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="toggle">
          <input
            checked={passwordEnabled}
            type="checkbox"
            onChange={(event) => setPasswordEnabled(event.target.checked)}
          />
          <span><Lock size={16} /> Require password</span>
        </label>

        {passwordEnabled && (
          <label>
            New password
            <input
              value={password}
              type="password"
              placeholder="Keep blank to preserve"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}

        <div className="option-grid">
          <label>
            Width
            <input
              type="number"
              value={options.width}
              onChange={(event) => setOptions({ ...options, width: event.target.value })}
            />
          </label>
          <label>
            Height
            <input
              type="number"
              value={options.height}
              onChange={(event) => setOptions({ ...options, height: event.target.value })}
            />
          </label>
        </div>

        <div className="switch-row">
          <label className="toggle">
            <input
              checked={options.controls}
              type="checkbox"
              onChange={(event) => setOptions({ ...options, controls: event.target.checked })}
            />
            <span><Eye size={16} /> Controls</span>
          </label>
          <label className="toggle">
            <input
              checked={options.muted}
              type="checkbox"
              onChange={(event) => setOptions({ ...options, muted: event.target.checked })}
            />
            <span><Volume2 size={16} /> Muted</span>
          </label>
          <label className="toggle">
            <input
              checked={options.autoplay}
              type="checkbox"
              onChange={(event) => setOptions({ ...options, autoplay: event.target.checked })}
            />
            <span><EyeOff size={16} /> Autoplay</span>
          </label>
        </div>

        <button className="primary-action" onClick={save}>
          <Save size={17} />
          Save settings
        </button>
        {status && <p className="status">{status}</p>}
      </div>

      <div className="embed-column">
        <div className="panel-title">
          <Clipboard size={18} />
          <h2>Embed Code</h2>
        </div>
        <textarea readOnly value={embedCode} />
        <button className="secondary-action" onClick={copyCode}>
          {copied ? <Check size={17} /> : <Clipboard size={17} />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <div className="preview-frame">
          <iframe title="Embed preview" src={`/embed/${video.id}`} />
        </div>
      </div>
    </div>
  );
}

function DatabasePanel({ videos, onRefresh }) {
  const [query, setQuery] = useState('');
  const [storage, setStorage] = useState(null);
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    getStorageInfo().then((data) => setStorage(data.storage)).catch((err) => setStatus(err.message));
  }, []);

  const filtered = videos.filter((video) => {
    const haystack = `${video.id} ${video.title} ${video.originalName}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  function embedCode(video) {
    return `<iframe src="${window.location.origin}/embed/${video.id}" width="${video.playerOptions.width}" height="${video.playerOptions.height}" allow="fullscreen" frameborder="0"></iframe>`;
  }

  async function copy(video) {
    try {
      await navigator.clipboard.writeText(embedCode(video));
      setCopiedId(video.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } catch {
      setStatus('Copy blocked by browser permissions.');
    }
  }

  async function remove(video) {
    const confirmed = window.confirm(`Delete "${video.title}" and its uploaded file?`);
    if (!confirmed) return;
    setStatus('Deleting...');
    try {
      await deleteVideo(video.id);
      await onRefresh();
      setStatus('Deleted.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <section className="database-layout">
      <div className="panel database-toolbar">
        <div>
          <div className="panel-title">
            <Database size={18} />
            <h2>Local Database</h2>
          </div>
          {storage && (
            <div className="storage-grid">
              <p><strong>SQLite</strong><span>{storage.databasePath}</span></p>
              <p><strong>Videos</strong><span>{storage.uploadDir}</span></p>
            </div>
          )}
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={query} placeholder="Search records" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="panel table-panel">
        <div className="data-table">
          <div className="table-head">
            <span>Title</span>
            <span>Status</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span>Actions</span>
          </div>
          {filtered.map((video) => (
            <div className="table-row" key={video.id}>
              <div>
                <strong>{video.title}</strong>
                <small>{video.originalName}</small>
                <code>{video.id}</code>
              </div>
              <span>{video.passwordEnabled ? 'Protected' : 'Public'}</span>
              <span>{formatBytes(video.size)}</span>
              <span>{new Date(video.createdAt).toLocaleString()}</span>
              <div className="table-actions">
                <button className="icon-action" title="Copy embed code" onClick={() => copy(video)}>
                  {copiedId === video.id ? <Check size={16} /> : <Clipboard size={16} />}
                </button>
                <button className="icon-action danger" title="Delete video" onClick={() => remove(video)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="muted table-empty">No database records match your search.</p>}
        </div>
        {status && <p className="status">{status}</p>}
      </div>
    </section>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function EmbedPlayer({ id }) {
  const [video, setVideo] = useState(null);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getEmbedVideo(id).then((data) => setVideo(data.video)).catch((err) => setError(err.message));
  }, [id]);

  async function unlock(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await verifyPassword(id, password);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !video) return <div className="embed-shell"><p>{error}</p></div>;
  if (!video) return <div className="embed-shell"><p>Loading video...</p></div>;

  const options = video.playerOptions || defaultOptions;
  const unlocked = !video.passwordEnabled || token;
  const src = `/media/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  return (
    <main className="embed-shell">
      {unlocked ? (
        <video
          src={src}
          title={video.title}
          controls={options.controls}
          muted={options.muted}
          autoPlay={options.autoplay}
          playsInline
        />
      ) : (
        <form className="password-gate" onSubmit={unlock}>
          <KeyRound size={32} />
          <h1>{video.title}</h1>
          <label>
            Password
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button>
            <Lock size={17} />
            Unlock video
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <Film size={42} />
      <h2>Upload a video to generate an embed.</h2>
    </div>
  );
}
