const rawBase = import.meta.env.BASE_URL || '/';

export const appBasePath = rawBase.endsWith('/')
  ? rawBase.slice(0, -1)
  : rawBase;

export function withAppBase(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${appBasePath}${cleanPath}` || cleanPath;
}

export function stripAppBase(pathname) {
  if (!appBasePath || appBasePath === '/') return pathname;
  if (pathname === appBasePath) return '/';
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length) || '/';
  }
  return pathname;
}
