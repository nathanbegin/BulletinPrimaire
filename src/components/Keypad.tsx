import type { GradingMode, LetterGrade, Mark } from '../types';
import { ABSENT } from '../types';
import { sortedScale } from '../lib/grading';
import { Icon } from './Icon';

interface Props {
  mode: GradingMode;
  scale: LetterGrade[];
  maxScore: number;
  draft: string;
  setDraft: (s: string) => void;
  /** Valide la saisie en cours et passe à l'élève suivant. */
  onCommit: () => void;
  /** Attribue directement une note et passe à l'élève suivant. */
  onPick: (m: Mark) => void;
  onClear: () => void;
  onPrev: () => void;
  onNext: () => void;
  compact?: boolean;
}

export function Keypad({ mode, scale, maxScore, draft, setDraft, onCommit, onPick, onClear, onPrev, onNext, compact }: Props) {
  const press = (k: string) => setDraft((draft + k).slice(0, 8));
  const nav = (
    <div className="kp-nav">
      <button type="button" className="kp-key kp-soft" onClick={onPrev}>
        <Icon name="up" /> Préc.
      </button>
      <button type="button" className="kp-key kp-soft" onClick={onClear}>
        Effacer
      </button>
      <button type="button" className="kp-key kp-soft" onClick={onNext}>
        Suiv. <Icon name="down" />
      </button>
    </div>
  );
  // onMouseDown preventDefault : garde le focus sur la grille (bureau)
  const keep = (e: React.MouseEvent) => e.preventDefault();

  if (mode === 'percent') {
    const k = (label: string, onClick: () => void, cls = '') => (
      <button type="button" className={`kp-key ${cls}`} onClick={onClick} key={label}>
        {label}
      </button>
    );
    return (
      <div className={`keypad ${compact ? 'compact' : ''}`} onMouseDown={keep}>
        <div className="kp-grid">
          {k('7', () => press('7'))}
          {k('8', () => press('8'))}
          {k('9', () => press('9'))}
          {k('⌫', () => setDraft(draft.slice(0, -1)), 'kp-soft')}
          {k('4', () => press('4'))}
          {k('5', () => press('5'))}
          {k('6', () => press('6'))}
          {k('ABS', () => onPick(ABSENT), 'kp-soft')}
          {k('1', () => press('1'))}
          {k('2', () => press('2'))}
          {k('3', () => press('3'))}
          <button type="button" className="kp-key kp-soft kp-max" onClick={() => onPick(maxScore)}>
            {String(maxScore).replace('.', ',')}
            <small>max</small>
          </button>
          {k('0', () => press('0'))}
          {k(',', () => press(','))}
          {k('½', () => press(',5'), 'kp-soft')}
          {k('OK', onCommit, 'kp-primary')}
        </div>
        {nav}
      </div>
    );
  }

  const options: { mark: Mark; label: string; sub?: string; cls?: string }[] =
    mode === 'letter'
      ? sortedScale(scale).map((g) => ({ mark: g.code, label: g.code, sub: `${g.min}+` }))
      : [
          { mark: 'S', label: 'Succès', cls: 'kp-success' },
          { mark: 'E', label: 'Échec', cls: 'kp-fail' },
        ];
  return (
    <div className={`keypad ${compact ? 'compact' : ''}`} onMouseDown={keep}>
      <div className={`kp-letters n${Math.min(options.length, 6)}`}>
        {options.map((o) => (
          <button type="button" key={String(o.mark)} className={`kp-key kp-big ${o.cls ?? ''}`} onClick={() => onPick(o.mark)}>
            {o.label}
            {o.sub && <small>{o.sub}</small>}
          </button>
        ))}
        <button type="button" className="kp-key kp-soft" onClick={() => onPick(ABSENT)}>
          ABS
        </button>
      </div>
      {nav}
    </div>
  );
}
