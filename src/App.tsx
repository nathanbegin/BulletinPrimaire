import { lazy, Suspense, useEffect } from 'react';
import { useRoute, navigate } from './router';
import { useStore, useActiveGroup, useActiveTerm } from './store';
import { Icon } from './components/Icon';
import GridPage from './pages/GridPage';
import QuickEntryPage from './pages/QuickEntryPage';
import EvaluationsPage from './pages/EvaluationsPage';
import StatsPage from './pages/StatsPage';
import BulletinPage from './pages/BulletinPage';
import GroupPage from './pages/GroupPage';
import SettingsPage from './pages/SettingsPage';
import WelcomePage from './pages/WelcomePage';
const ScanPage = lazy(() => import('./pages/ScanPage'));
import { groupLabel, groupsByYear } from './lib/support';

const NAV = [
  { path: 'notes', label: 'Notes', icon: 'grid' },
  { path: 'evaluations', label: 'Évaluations', icon: 'list' },
  { path: 'stats', label: 'Statistiques', icon: 'chart' },
  { path: 'bulletins', label: 'Bulletins', icon: 'doc' },
  { path: 'groupe', label: 'Groupe', icon: 'users' },
  { path: 'reglages', label: 'Réglages', icon: 'settings' },
];

export default function App() {
  const route = useRoute();
  const data = useStore((s) => s.data);
  const groups = data.groups;
  const terms = useStore((s) => s.data.terms);
  const setUI = useStore((s) => s.setUI);
  const group = useActiveGroup();
  const term = useActiveTerm();
  const page = route[0] ?? 'notes';

  useEffect(() => {
    if (!route.length) navigate('notes');
  }, [route.length]);

  let content: React.ReactNode;
  if (!group && page !== 'reglages') content = <WelcomePage />;
  else
    switch (page) {
      case 'saisie':
        content = <QuickEntryPage evalId={route[1]} />;
        break;
      case 'evaluations':
        content = <EvaluationsPage />;
        break;
      case 'numeriser':
        content = (
          <Suspense fallback={<div className="page muted">Chargement…</div>}>
            <ScanPage />
          </Suspense>
        );
        break;
      case 'stats':
        content = <StatsPage tab={route[1]} itemId={route[2]} />;
        break;
      case 'bulletins':
        content = <BulletinPage />;
        break;
      case 'groupe':
        content = <GroupPage tab={route[1]} />;
        break;
      case 'reglages':
        content = <SettingsPage />;
        break;
      default:
        content = <GridPage />;
    }

  const fullscreen = page === 'saisie';

  return (
    <div className={`app ${fullscreen ? 'app-fullscreen' : ''}`}>
      <header className="topbar no-print">
        <div className="brand" onClick={() => navigate('notes')}>
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span className="brand-name">Bulletin</span>
        </div>
        {groups.length > 0 && (
          <div className="topbar-selects">
            <select
              aria-label="Groupe"
              value={group?.id ?? ''}
              onChange={(e) => setUI({ groupId: e.target.value, subjectFilter: null })}
            >
              {groupsByYear(data).map(({ year, groups: gs }) => (
                <optgroup key={year} label={year}>
                  {gs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {groupLabel(g)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select aria-label="Étape" value={term?.id ?? ''} onChange={(e) => setUI({ termId: e.target.value })}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>
      <nav className="sidenav no-print">
        {NAV.map((n) => (
          <a key={n.path} href={`#/${n.path}`} className={page === n.path || ((page === 'saisie' || page === 'numeriser') && n.path === 'evaluations') ? 'active' : ''}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <main className="main">{content}</main>
    </div>
  );
}
