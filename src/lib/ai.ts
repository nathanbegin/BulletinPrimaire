/**
 * Numérisation de relevés de notes papier avec Claude (vision + sortie JSON structurée).
 *
 * L'application est 100 % statique : l'appel part directement du navigateur avec la clé
 * API de l'enseignant(e), conservée uniquement sur l'appareil (jamais dans les sauvegardes).
 * Un « serveur relais » optionnel peut remplacer l'adresse de l'API (ex. proxy de l'école
 * qui détient la clé) — dans ce cas la clé peut rester vide côté appareil.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AppData, Group } from '../types';
import { groupStudents, groupSubjects, sortedScale } from './grading';

import { loadAIConfig, aiConfigured, AI_MODEL } from './aiConfig';
export { loadAIConfig, aiConfigured, AI_MODEL };

// ---------------------------------------------------------------------------
// Résultat attendu
// ---------------------------------------------------------------------------

export type ColumnKind = 'points' | 'letter' | 'passfail' | 'unknown';

export interface ScannedColumn {
  title: string;
  subject_id: string; // '' si inconnu
  competency_id: string; // '' si inconnu / sans compétence
  max_score: number; // 0 si inconnu
  kind: ColumnKind;
  date: string; // AAAA-MM-JJ ou ''
}

export interface ScannedCell {
  text: string; // valeur transcrite telle quelle ('' = vide, 'ABS' = absent)
  uncertain: boolean;
}

export interface ScannedRow {
  name_on_sheet: string;
  student_id: string; // '' si aucun élève correspondant
  values: ScannedCell[];
}

export interface ScanResult {
  columns: ScannedColumn[];
  rows: ScannedRow[];
  notes: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['columns', 'rows', 'notes'],
  properties: {
    columns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'subject_id', 'competency_id', 'max_score', 'kind', 'date'],
        properties: {
          title: { type: 'string' },
          subject_id: { type: 'string' },
          competency_id: { type: 'string' },
          max_score: { type: 'number' },
          kind: { type: 'string', enum: ['points', 'letter', 'passfail', 'unknown'] },
          date: { type: 'string' },
        },
      },
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name_on_sheet', 'student_id', 'values'],
        properties: {
          name_on_sheet: { type: 'string' },
          student_id: { type: 'string' },
          values: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'uncertain'],
              properties: { text: { type: 'string' }, uncertain: { type: 'boolean' } },
            },
          },
        },
      },
    },
    notes: { type: 'string' },
  },
} as const;

const SYSTEM = `Tu numérises des relevés de notes papier d'une enseignante du primaire au Québec (photos ou PDF numérisés, souvent manuscrits).
Ta tâche : transcrire fidèlement le tableau de notes et le rattacher aux données de la classe fournies.

Règles :
- Une « colonne » = une évaluation (examen, dictée, projet…). Une « ligne » = un élève. Si le tableau est transposé, adapte-toi.
- Ignore les colonnes de totaux, moyennes ou commentaires calculés par l'enseignante ; ne garde que les évaluations.
- Transcris chaque note telle qu'écrite, sans la convertir : « 17 » si la case contient 17 ou 17/20 (et mets 20 dans max_score de la colonne), « 15,5 » pour 15½, « B+ » ou « B » pour une cote, « S » / « E » pour succès / échec, « ABS » pour absent, « » (vide) pour une case vide.
- max_score : total de points de la colonne s'il est indiqué (en-tête « /20 », « sur 30 ») ou évident ; 0 si inconnu.
- kind : « points », « letter » (cotes A–F), « passfail » (succès/échec) ou « unknown ».
- subject_id / competency_id : choisis parmi les identifiants fournis la matière et la compétence les plus plausibles d'après le titre (ex. « dictée » → Français / Écrire) ; chaîne vide si tu ne peux pas décider.
- student_id : identifiant de l'élève de la liste qui correspond au nom écrit (tolère abréviations, prénom seul, fautes, ordre nom/prénom). Chaîne vide si aucun élève ne correspond ; ne rattache jamais deux lignes au même élève.
- values : exactement une entrée par colonne, dans le même ordre que columns.
- uncertain = true dès qu'une case est difficile à lire ou ambiguë. Ne devine pas en silence.
- date : AAAA-MM-JJ si une date figure sur la colonne, sinon chaîne vide.
- notes : remarques utiles en français pour l'enseignante (pages illisibles, élèves non trouvés, hypothèses faites). Court.`;

function contextFor(data: AppData, group: Group): string {
  const students = groupStudents(data, group.id, true).map((s) => ({ id: s.id, nom: s.lastName, prenom: s.firstName }));
  const subjects = groupSubjects(data, group.id).map((s) => ({
    id: s.id,
    nom: s.name,
    mode: s.mode,
    competences: s.competencies.map((c) => ({ id: c.id, nom: c.name })),
  }));
  const scale = sortedScale(data.settings.letterScale).map((g) => g.code);
  return JSON.stringify({ groupe: group.name, eleves: students, matieres: subjects, cotes: scale }, null, 1);
}

export interface ScanInput {
  /** Données base64 (sans préfixe data:) et type MIME. */
  files: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' }[];
  hint?: string;
}

export class AIError extends Error {}

/** Envoie les pages à Claude et retourne le tableau extrait. */
export async function scanGradeSheet(data: AppData, group: Group, input: ScanInput, signal?: AbortSignal): Promise<ScanResult> {
  const cfg = loadAIConfig();
  if (!aiConfigured(cfg)) throw new AIError('Configurez la clé API Claude dans Réglages → Intelligence artificielle.');

  const client = new Anthropic({
    apiKey: cfg.apiKey.trim() || 'relais',
    baseURL: cfg.baseURL.trim() || undefined,
    // Application sans serveur : la clé de l'enseignant(e) reste sur son appareil.
    dangerouslyAllowBrowser: true,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  input.files.forEach((f, i) => {
    content.push({ type: 'text', text: `Page ${i + 1} :` });
    if (f.mediaType === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
    }
  });
  content.push({
    type: 'text',
    text:
      `Données de la classe (identifiants à utiliser) :\n${contextFor(data, group)}\n\n` +
      (input.hint?.trim() ? `Précisions de l'enseignante : ${input.hint.trim()}\n\n` : '') +
      'Transcris le relevé de notes de ces pages.',
  });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create(
      {
        model: AI_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      },
      { signal },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AIError('Clé API invalide. Vérifiez-la dans les Réglages.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AIError('Accès refusé par l’API (vérifiez les droits de la clé).');
    if (e instanceof Anthropic.RateLimitError) throw new AIError('Trop de demandes pour le moment. Réessayez dans une minute.');
    if (e instanceof Anthropic.BadRequestError) throw new AIError(`Demande refusée : ${e.message}`);
    if (e instanceof Anthropic.APIUserAbortError) throw new AIError('Numérisation annulée.');
    if (e instanceof Anthropic.APIConnectionError) throw new AIError('Impossible de joindre le service. Vérifiez la connexion Internet.');
    if (e instanceof Anthropic.APIError) throw new AIError(`Erreur du service (${e.status ?? '?'}) : ${e.message}`);
    throw e;
  }

  if (response.stop_reason === 'refusal') throw new AIError('Le modèle a refusé de traiter ces images.');
  if (response.stop_reason === 'max_tokens') throw new AIError('Relevé trop volumineux : numérisez moins de pages à la fois.');
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: ScanResult;
  try {
    parsed = JSON.parse(text) as ScanResult;
  } catch {
    throw new AIError('Réponse illisible du modèle. Réessayez avec une photo plus nette.');
  }
  return normalizeScan(parsed, data, group);
}

/** Nettoie le résultat : identifiants inexistants, lignes de longueur incorrecte, doublons d'élèves. */
export function normalizeScan(r: ScanResult, data: AppData, group: Group): ScanResult {
  const studentIds = new Set(groupStudents(data, group.id, true).map((s) => s.id));
  const subjects = groupSubjects(data, group.id);
  const columns = (r.columns ?? []).map((c) => {
    const subj = subjects.find((s) => s.id === c.subject_id);
    return {
      title: String(c.title ?? '').trim() || 'Évaluation',
      subject_id: subj ? subj.id : '',
      competency_id: subj?.competencies.some((x) => x.id === c.competency_id) ? c.competency_id : '',
      max_score: Number(c.max_score) > 0 ? Number(c.max_score) : 0,
      kind: (['points', 'letter', 'passfail'] as const).includes(c.kind as never) ? c.kind : 'unknown',
      date: /^\d{4}-\d{2}-\d{2}$/.test(c.date ?? '') ? c.date : '',
    } satisfies ScannedColumn;
  });
  const used = new Set<string>();
  const rows = (r.rows ?? []).map((row) => {
    let sid = studentIds.has(row.student_id) && !used.has(row.student_id) ? row.student_id : '';
    if (sid) used.add(sid);
    const values = columns.map((_, i) => ({
      text: String(row.values?.[i]?.text ?? '').trim(),
      uncertain: !!row.values?.[i]?.uncertain,
    }));
    return { name_on_sheet: String(row.name_on_sheet ?? '').trim(), student_id: sid, values };
  });
  return { columns, rows, notes: String(r.notes ?? '') };
}

// ---------------------------------------------------------------------------
// Préparation des fichiers
// ---------------------------------------------------------------------------

/** Réduit une photo (max 2000 px) et la convertit en JPEG base64 pour limiter le poids et le coût. */
export async function prepareFile(file: File): Promise<ScanInput['files'][number] & { preview: string; name: string }> {
  if (file.type === 'application/pdf') {
    const data = await toBase64(file);
    return { data, mediaType: 'application/pdf', preview: '', name: file.name };
  }
  const bitmap = await loadImage(file);
  const max = 2000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { data: url.split(',')[1], mediaType: 'image/jpeg', preview: url, name: file.name };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new AIError(`Image illisible : ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new AIError(`Fichier illisible : ${file.name}`));
    r.readAsDataURL(file);
  });
}
