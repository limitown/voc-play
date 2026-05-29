import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  LogOut,
  Pencil,
  Plus,
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
  Wand2,
  X
} from 'lucide-react';
import {
  clearAdminToken,
  createUser,
  deleteVideo,
  getAdminToken,
  getCurrentAdmin,
  getEmbedVideo,
  getPublicVideoPage,
  getVideoPage,
  listVideos,
  listUsers,
  loginAdmin,
  replaceVideoFile,
  saveVideoPage,
  updateVideo,
  uploadVideo,
  verifyPassword
} from './api.js';
import { appBasePath, stripAppBase, withAppBase } from './paths.js';

const defaultOptions = {
  width: 800,
  height: 450,
  controls: true,
  muted: false,
  autoplay: false
};

const pageThemes = [
  { id: 'paper', name: 'Paper', description: 'Warm, bright, and very readable.' },
  { id: 'slate', name: 'Slate', description: 'Modern dark header with clean content.' },
  { id: 'sage', name: 'Sage', description: 'Calm green accents and soft contrast.' },
  { id: 'contrast', name: 'Contrast', description: 'Large type and high visibility.' },
  { id: 'gallery', name: 'Gallery', description: 'Minimal editorial presentation.' }
];

export default function App() {
  const pathname = window.location.pathname;
  const path = stripAppBase(pathname);
  if (path.startsWith('/embed/')) return <EmbedPlayer id={path.split('/').pop()} />;
  if (path.startsWith('/page/')) return <VideoLandingPage slug={path.split('/').pop()} />;
  if (!isAppPath(pathname)) return <HomePage />;
  return <AdminApp />;
}

function isAppPath(pathname) {
  if (!appBasePath || appBasePath === '/') return true;
  return pathname === appBasePath || pathname.startsWith(`${appBasePath}/`);
}

function HomePage() {
  return <main className="blank-home" aria-label="Blank homepage" />;
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('studio');
  const [autoEditVideoId, setAutoEditVideoId] = useState(null);

  async function refresh() {
    const data = await listVideos();
    setVideos(data.videos);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

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
      setAutoEditVideoId(data.video.id);
      setTab('videos');
      setNotice('Video uploaded. Edit settings, replace the file, or copy the embed code below.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
        <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>
          <Film size={16} />
          Videos
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
      ) : tab === 'videos' ? (
        <VideosPanel
          videos={videos}
          autoEditVideoId={autoEditVideoId}
          onAutoEditConsumed={() => setAutoEditVideoId(null)}
          onRefresh={refresh}
        />
      ) : (

      <section className="studio-layout">
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
          {notice && <p className="status">{notice}</p>}
        </aside>
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
  const [fileStatus, setFileStatus] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(video.title);
    setPasswordEnabled(video.passwordEnabled);
    setPassword('');
    setOptions(video.playerOptions || defaultOptions);
    setStatus('');
    setFileStatus('');
    setFileBusy(false);
    setCopied(false);
  }, [video.id, video.passwordEnabled, video.playerOptions, video.title, video.originalName]);

  const embedCode = useMemo(() => {
    return createEmbedCode({
      id: video.id,
      width: options.width,
      height: options.height
    });
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

  async function replaceFile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('video');
    if (!file || file.size === 0) {
      setFileStatus('Choose a replacement video file.');
      return;
    }

    setFileBusy(true);
    setFileStatus('Replacing video...');
    try {
      await replaceVideoFile(video.id, file);
      event.currentTarget.reset();
      await onSaved();
      setFileStatus('Video file replaced. The embed link stayed the same.');
    } catch (err) {
      setFileStatus(err.message);
    } finally {
      setFileBusy(false);
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

        <div className="panel-title library-title">
          <Upload size={18} />
          <h2>Video File</h2>
        </div>
        <div className="file-summary">
          <strong>{video.originalName}</strong>
          <span>{formatBytes(video.size)}</span>
        </div>
        <form onSubmit={replaceFile}>
          <label>
            Replace uploaded file
            <input required name="video" type="file" accept="video/*" />
          </label>
          <button className="secondary-action" disabled={fileBusy}>
            <Upload size={17} />
            {fileBusy ? 'Replacing...' : 'Replace video'}
          </button>
        </form>
        {fileStatus && <p className="status">{fileStatus}</p>}
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
          <iframe title="Embed preview" src={withAppBase(`/embed/${video.id}`)} />
        </div>
      </div>
    </div>
  );
}

function VideosPanel({ videos, autoEditVideoId, onAutoEditConsumed, onRefresh }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [pageEditingId, setPageEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    if (!autoEditVideoId) return;
    setQuery('');
    setEditingId(autoEditVideoId);
    setPageEditingId(null);
    onAutoEditConsumed();
  }, [autoEditVideoId, onAutoEditConsumed]);

  const editingVideo = videos.find((video) => video.id === editingId);
  const pageEditingVideo = videos.find((video) => video.id === pageEditingId);
  const filtered = videos.filter((video) => {
    const haystack = `${video.id} ${video.title} ${video.originalName}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  function embedCode(video) {
    return createEmbedCode({
      id: video.id,
      width: video.playerOptions.width,
      height: video.playerOptions.height
    });
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
      if (editingId === video.id) setEditingId(null);
      if (pageEditingId === video.id) setPageEditingId(null);
      setStatus('Deleted.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <section className="videos-layout">
      <div className="panel videos-toolbar">
        <div>
          <div className="panel-title">
            <Film size={18} />
            <h2>Uploaded Videos</h2>
          </div>
          <p className="muted">Manage uploaded videos, edit settings, copy embed codes, or delete files.</p>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={query} placeholder="Search videos" onChange={(event) => setQuery(event.target.value)} />
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
                <button className="icon-action" title="Edit video" onClick={() => setEditingId(video.id)}>
                  <Pencil size={16} />
                </button>
                <button className="icon-action" title="Create page" onClick={() => setPageEditingId(video.id)}>
                  <FileText size={16} />
                </button>
                <button className="icon-action" title="Copy embed code" onClick={() => copy(video)}>
                  {copiedId === video.id ? <Check size={16} /> : <Clipboard size={16} />}
                </button>
                <button className="icon-action danger" title="Delete video" onClick={() => remove(video)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="muted table-empty">No uploaded videos match your search.</p>}
        </div>
        {status && <p className="status">{status}</p>}
      </div>

      {editingVideo && (
        <section className="panel videos-editor-panel">
          <div className="panel-title">
            <Pencil size={18} />
            <h2>Edit Video</h2>
          </div>
          <VideoEditor video={editingVideo} onSaved={onRefresh} />
        </section>
      )}

      {pageEditingVideo && (
        <section className="panel videos-editor-panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2>Video Page</h2>
          </div>
          <PageBuilder video={pageEditingVideo} />
        </section>
      )}
    </section>
  );
}

function VideoLandingPage({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicVideoPage(slug)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <main className="page-shell theme-paper"><p>{error}</p></main>;
  if (!data) return <main className="page-shell theme-paper"><p>Loading page...</p></main>;

  const { page, video } = data;
  const layout = normalizePageLayout(page.layout);
  const topDescription = !layout.descriptionBelowVideo && page.description;
  const bottomDescription = layout.descriptionBelowVideo && page.description;
  const topBlocks = layout.actionsBelowVideo ? [] : page.blocks;
  const bottomBlocks = layout.actionsBelowVideo ? page.blocks : [];

  return (
    <main className={`page-shell theme-${page.theme}`}>
      <section className="public-page">
        <div className="public-page-copy">
          <p className="eyebrow">VOC PLAY</p>
          <h1>{page.title}</h1>
          {topDescription && <p>{page.description}</p>}
        </div>
        <PublicPageActions blocks={topBlocks} />

        <div className="public-video-card">
          <iframe title={video.title} src={withAppBase(`/embed/${video.id}`)} />
        </div>

        {bottomDescription && <p className="public-page-description">{page.description}</p>}
        <PublicPageActions blocks={bottomBlocks} />
      </section>
    </main>
  );
}

function PublicPageActions({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="public-page-actions">
      {blocks.map((block, index) => (
        block.type === 'button' ? (
          <a className="public-button" href={block.url} key={`${block.label}-${index}`} target="_blank" rel="noreferrer">
            {block.label}
          </a>
        ) : (
          <a className="public-text-link" href={block.url} key={`${block.label}-${index}`} target="_blank" rel="noreferrer">
            {block.label}
          </a>
        )
      ))}
    </div>
  );
}

function PageBuilder({ video }) {
  const [pageName, setPageName] = useState(slugifyPageName(video.title));
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('paper');
  const [layout, setLayout] = useState({ descriptionBelowVideo: false, actionsBelowVideo: true });
  const [blocks, setBlocks] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus('Loading page...');
    getVideoPage(video.id)
      .then((data) => {
        if (data.page) {
          setPageName(data.page.slug);
          setTitle(data.page.title);
          setDescription(data.page.description);
          setTheme(data.page.theme);
          setLayout(normalizePageLayout(data.page.layout));
          setBlocks(data.page.blocks || []);
        } else {
          setPageName(slugifyPageName(video.title));
          setTitle(video.title);
          setDescription('');
          setTheme('paper');
          setLayout({ descriptionBelowVideo: false, actionsBelowVideo: true });
          setBlocks([]);
        }
        setStatus('');
      })
      .catch((err) => setStatus(err.message));
  }, [video.id, video.title]);

  const pageUrl = pageName ? `${window.location.origin}${withAppBase(`/page/${pageName}`)}` : '';

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('Saving page...');
    try {
      const data = await saveVideoPage(video.id, {
        pageName,
        title,
        description,
        theme,
        layout,
        blocks
      });
      setPageName(data.page.slug);
      setStatus('Page saved.');
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  function addBlock(type) {
    setBlocks([...blocks, { type, label: '', url: '' }]);
  }

  function updateBlock(index, patch) {
    setBlocks(blocks.map((block, currentIndex) => (
      currentIndex === index ? { ...block, ...patch } : block
    )));
  }

  function removeBlock(index) {
    setBlocks(blocks.filter((_block, currentIndex) => currentIndex !== index));
  }

  function updateLayout(patch) {
    setLayout({ ...layout, ...patch });
  }

  function downloadHtml() {
    const html = createPageHtml({
      video,
      page: {
        slug: pageName || slugifyPageName(title || video.title),
        title: title || video.title,
        description,
        theme,
        layout,
        blocks
      }
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pageName || slugifyPageName(title || video.title) || 'video-page'}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <form className="page-builder" onSubmit={save}>
      <div className="page-builder-columns">
        <div className="page-builder-controls">
          <div className="page-builder-grid">
            <label>
              Page name
              <input value={pageName} placeholder="my-video-page" onChange={(event) => setPageName(slugifyPageName(event.target.value))} />
            </label>
            <label>
              Title
              <input value={title} placeholder="How to watch this video" onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <label>
            Description
            <textarea className="plain-textarea" value={description} placeholder="Write a clear short description for viewers." onChange={(event) => setDescription(event.target.value)} />
          </label>

          <div className="theme-grid" role="list">
            {pageThemes.map((item) => (
              <button
                className={theme === item.id ? `theme-choice theme-${item.id} active` : `theme-choice theme-${item.id}`}
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <div className="layout-options">
            <label className="toggle">
              <input
                checked={layout.descriptionBelowVideo}
                type="checkbox"
                onChange={(event) => updateLayout({ descriptionBelowVideo: event.target.checked })}
              />
              <span>Description below video</span>
            </label>
            <label className="toggle">
              <input
                checked={layout.actionsBelowVideo}
                type="checkbox"
                onChange={(event) => updateLayout({ actionsBelowVideo: event.target.checked })}
              />
              <span>Buttons and links below video</span>
            </label>
          </div>

          <div className="page-blocks">
            <div className="panel-title">
              <Plus size={18} />
              <h2>Page Add-ons</h2>
            </div>
            {blocks.map((block, index) => (
              <div className="page-block" key={`${block.type}-${index}`}>
                <select value={block.type} onChange={(event) => updateBlock(index, { type: event.target.value })}>
                  <option value="button">Button</option>
                  <option value="linkText">Text with hyperlink</option>
                </select>
                <input value={block.label} placeholder={block.type === 'button' ? 'Button label' : 'Link text'} onChange={(event) => updateBlock(index, { label: event.target.value })} />
                <input value={block.url} placeholder="https://example.com" onChange={(event) => updateBlock(index, { url: event.target.value })} />
                <button className="icon-action danger" type="button" title="Remove" onClick={() => removeBlock(index)}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="page-add-actions">
              <button className="secondary-action" type="button" onClick={() => addBlock('button')}>
                <Plus size={17} />
                Add Button
              </button>
              <button className="secondary-action" type="button" onClick={() => addBlock('linkText')}>
                <Plus size={17} />
                Add Text Link
              </button>
            </div>
          </div>

          <div className="page-builder-actions">
            <button className="primary-action" disabled={busy}>
              <Save size={17} />
              {busy ? 'Saving...' : 'Save page'}
            </button>
            {pageUrl && (
              <a className="secondary-action" href={pageUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={17} />
                Preview test page
              </a>
            )}
            <button className="secondary-action" type="button" onClick={downloadHtml}>
              <Download size={17} />
              Download HTML
            </button>
          </div>
          {pageUrl && <code className="page-url">Preview/test link: {pageUrl}</code>}
          {status && <p className="status">{status}</p>}
        </div>

        <PageBuilderPreview
          page={{
            title,
            description,
            theme,
            layout,
            blocks
          }}
        />
      </div>
    </form>
  );
}

function PageBuilderPreview({ page }) {
  const layout = normalizePageLayout(page.layout);
  const previewBlocks = (page.blocks || []).map((block) => ({
    ...block,
    label: block.label || (block.type === 'button' ? 'Button' : 'Text link')
  }));
  const topDescription = !layout.descriptionBelowVideo && page.description;
  const bottomDescription = layout.descriptionBelowVideo && page.description;
  const topBlocks = layout.actionsBelowVideo ? [] : previewBlocks;
  const bottomBlocks = layout.actionsBelowVideo ? previewBlocks : [];

  return (
    <section className="page-preview" aria-label="Page preview">
      <div className={`page-preview-shell theme-${page.theme}`}>
        <div className="page-preview-copy">
          <p className="eyebrow">VOC PLAY</p>
          <h3>{page.title || 'Page title'}</h3>
          {topDescription && <p>{page.description}</p>}
        </div>
        <PagePreviewActions blocks={topBlocks} />

        <div className="page-preview-video">
          <Film size={34} />
          <span>Video preview</span>
        </div>

        {bottomDescription && <p className="page-preview-description">{page.description}</p>}
        <PagePreviewActions blocks={bottomBlocks} />
      </div>
    </section>
  );
}

function PagePreviewActions({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="page-preview-actions">
      {blocks.map((block, index) => (
        block.type === 'button' ? (
          <span className="page-preview-button" key={`${block.label}-${index}`}>
            {block.label}
          </span>
        ) : (
          <span className="page-preview-link" key={`${block.label}-${index}`}>
            {block.label}
          </span>
        )
      ))}
    </div>
  );
}

function createEmbedCode({ id, width, height }) {
  const src = `${window.location.origin}${withAppBase(`/embed/${id}`)}`;

  return `<iframe src="${src}"
        width="${width}"
        height="${height}"
        allow="fullscreen"
        frameborder="0">
</iframe>`;
}

function createPageHtml({ video, page }) {
  const themeClass = pageThemes.some((theme) => theme.id === page.theme) ? `theme-${page.theme}` : 'theme-paper';
  const layout = normalizePageLayout(page.layout);
  const embedUrl = `${window.location.origin}${withAppBase(`/embed/${video.id}`)}`;
  const links = (page.blocks || [])
    .map((block) => {
      const url = safePageUrl(block.url);
      if (!block.label || !url) return '';
      if (block.type === 'button') {
        return `<a class="public-button" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(block.label)}</a>`;
      }
      return `<a class="public-text-link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(block.label)}</a>`;
    })
    .filter(Boolean)
    .join('\n      ');
  const linksMarkup = links ? `<div class="public-page-actions">\n      ${links}\n      </div>` : '';
  const topDescription = !layout.descriptionBelowVideo && page.description
    ? `<p>${escapeHtml(page.description)}</p>`
    : '';
  const bottomDescription = layout.descriptionBelowVideo && page.description
    ? `<p class="public-page-description">${escapeHtml(page.description)}</p>`
    : '';
  const topLinks = layout.actionsBelowVideo ? '' : linksMarkup;
  const bottomLinks = layout.actionsBelowVideo ? linksMarkup : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>
    :root { font-family: Aptos, Segoe UI, Arial, sans-serif; color: #20231f; background: #fbf8f1; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .page-shell { min-height: 100vh; padding: 42px 20px; }
    .public-page { display: grid; gap: 28px; width: min(1040px, 100%); margin: 0 auto; }
    .eyebrow { margin: 0; color: #124b3f; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; }
    h1 { max-width: 880px; margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 4.2rem; line-height: 1; }
    p { max-width: 760px; margin: 0; font-size: 1.25rem; line-height: 1.7; }
    .public-page-copy { display: grid; gap: 12px; }
    .public-video-card { overflow: hidden; aspect-ratio: 16 / 9; background: #080807; border-radius: 8px; box-shadow: 0 22px 70px rgba(0, 0, 0, 0.16); }
    iframe { display: block; width: 100%; height: 100%; border: 0; }
    .public-page-actions { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
    .public-button { display: inline-flex; align-items: center; min-height: 48px; padding: 0 18px; color: #fffdf8; background: #1c6f5d; border-radius: 8px; font-size: 1.08rem; font-weight: 900; text-decoration: none; }
    .public-text-link { color: inherit; font-size: 1.08rem; font-weight: 900; text-underline-offset: 4px; }
    .theme-slate { color: #f6f7f2; background: #20252a; }
    .theme-slate .public-button { color: #20252a; background: #e4ad3d; }
    .theme-sage { color: #18342d; background: #edf5ed; }
    .theme-contrast { color: #080807; background: #ffffff; }
    .theme-contrast h1 { font-size: 4.7rem; }
    .theme-contrast .public-button { background: #000000; }
    .theme-gallery { color: #26211d; background: #f6f3ec; }
    .theme-gallery .public-video-card { box-shadow: none; border: 1px solid #d8d0c2; }
    @media (max-width: 640px) { h1 { font-size: 2.7rem; } p { font-size: 1.08rem; } .page-shell { padding: 24px 14px; } }
  </style>
</head>
<body class="${themeClass}">
  <main class="page-shell ${themeClass}">
    <section class="public-page">
      <div class="public-page-copy">
        <p class="eyebrow">VOC PLAY</p>
        <h1>${escapeHtml(page.title)}</h1>
        ${topDescription}
      </div>
      ${topLinks}
      <div class="public-video-card">
        <iframe title="${escapeAttribute(video.title)}" src="${escapeAttribute(embedUrl)}" allowfullscreen></iframe>
      </div>
      ${bottomDescription}
      ${bottomLinks}
    </section>
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function safePageUrl(value) {
  const url = String(value || '').trim();
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : '';
}

function normalizePageLayout(layout = {}) {
  return {
    descriptionBelowVideo: Boolean(layout.descriptionBelowVideo),
    actionsBelowVideo: layout.actionsBelowVideo !== false
  };
}

function slugifyPageName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
  const src = `${withAppBase(`/media/${id}`)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  return (
    <main className="embed-shell">
      {unlocked ? (
        <video
          src={src}
          title={video.title}
          controls={options.controls}
          controlsList="nodownload"
          muted={options.muted}
          autoPlay={options.autoplay}
          playsInline
          onContextMenu={(event) => event.preventDefault()}
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
