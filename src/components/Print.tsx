import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { groupLabel, groupSchool, groupTeacher, groupYear } from '../lib/support';
import type { Group } from '../types';

export function formatStamp(d = new Date()): string {
  const date = d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} à ${time}`;
}

/** Date de génération, rafraîchie à chaque impression / export PDF. */
export function usePrintStamp(): string {
  const [stamp, setStamp] = useState(() => formatStamp());
  useEffect(() => {
    const on = () => setStamp(formatStamp());
    window.addEventListener('beforeprint', on);
    return () => window.removeEventListener('beforeprint', on);
  }, []);
  return stamp;
}

export function printNow() {
  window.dispatchEvent(new Event('beforeprint'));
  // Laisse React rafraîchir la date avant d'ouvrir la boîte d'impression
  setTimeout(() => window.print(), 50);
}

export function useGroupInfo(group: Group) {
  const data = useStore((s) => s.data);
  return {
    school: groupSchool(group, data),
    teacher: groupTeacher(group, data),
    year: groupYear(group, data),
    label: groupLabel(group),
  };
}

/** Ligne de pied de page en petits caractères (école · enseignant(e) · date de génération). */
export function PrintFooterLine({ group, className = '' }: { group: Group; className?: string }) {
  const { school, teacher } = useGroupInfo(group);
  const stamp = usePrintStamp();
  return (
    <div className={`print-footer-line ${className}`}>
      <span>{[school, teacher && `Enseignant(e) : ${teacher}`].filter(Boolean).join(' · ')}</span>
      <span>Généré le {stamp}</span>
    </div>
  );
}

/**
 * Cadre d'impression pour les pages « longues » (tableau de notes, statistiques) :
 * en-tête aux couleurs de l'application et pied de page répété en bas de chaque page.
 */
export function PrintFrame({ group, title, subtitle, children }: { group: Group; title: string; subtitle?: string; children: React.ReactNode }) {
  const { school, teacher, year, label } = useGroupInfo(group);
  return (
    <div className="print-frame">
      <div className="print-frame-head print-only">
        <div className="pf-brand">
          <img src="./icon.svg" alt="" width={34} height={34} />
          <div>
            <div className="pf-school">{school || 'École'}</div>
            <div className="pf-title">{title}</div>
          </div>
        </div>
        <div className="pf-meta">
          <div>
            <span>Groupe</span> <strong>{label}{group.level ? ` · ${group.level}` : ''}</strong>
          </div>
          {teacher && (
            <div>
              <span>Enseignant(e)</span> <strong>{teacher}</strong>
            </div>
          )}
          <div>
            <span>Année scolaire</span> <strong>{year}</strong>
          </div>
          {subtitle && <div className="pf-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="print-frame-body">{children}</div>
      {/* Espace réservé répété sur chaque page pour le pied de page fixe */}
      <div className="print-frame-foot print-only">
        <div className="print-footer-space" />
      </div>
      <PrintFooterLine group={group} className="print-only print-footer-fixed" />
    </div>
  );
}
