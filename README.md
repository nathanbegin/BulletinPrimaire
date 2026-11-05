# Bulletin Primaire

Carnet de notes et bulletins pour l'enseignement primaire au Québec. Application web progressive (PWA) : fonctionne dans le navigateur, s'installe sur iPhone/iPad (Safari → Partager → « Sur l'écran d'accueil ») et Android (Chrome → « Installer l'application »), et fonctionne hors ligne.

## Fonctionnalités

- **Groupes** : nom, numéro de groupe, niveau, année scolaire, enseignant(e), école. Les groupes sont triés et regroupés par année scolaire.
- **Élèves** : ajout un par un ou en collant une liste (Excel, « Prénom Nom », « Nom, Prénom »), code permanent, élèves inactifs.
- **Élèves en difficulté** : plan d'intervention (PI), mesures d'adaptation, mesures de modification, dispositions (temps supplémentaire, orthopédagogie, etc.) et notes de suivi. Pastilles PI / Ad / Mo visibles partout pendant la saisie ; filtre « En difficulté / PI » ; mention au bulletin pour les exigences modifiées.
- **Matières du PFEQ** avec leurs compétences et pondérations (Français : Lire 50 %, Écrire 30 %, Communiquer oralement 20 % ; Mathématique : Résoudre 30 %, Raisonner 70 % ; etc.), modifiables.
- **Mode d'évaluation par matière** : pourcentage (points sur un total), cote (A, B, C, D, E, F — échelle configurable) ou Succès/Échec.
- **Étapes** configurables (par défaut 3 étapes pondérées 20 / 20 / 60 %).
- **Tableau de notes façon tableur** : élèves × évaluations, résultats par compétence et par matière, moyenne / médiane / écart type en pied de colonne. Navigation au clavier (Entrée = élève suivant, Tab = évaluation suivante, flèches), copier-coller depuis Excel.
- **Saisie rapide** : un élève à la fois avec pavé numérique géant (ou boutons de cote / Succès-Échec : un seul toucher par élève), passage automatique à l'élève suivant, bouton « note maximale », absent, option « sauter les élèves déjà notés », statistiques en direct. Sur téléphone, toucher une cellule du tableau ouvre aussi le pavé.
- **Statistiques** par évaluation (histogramme, cote z), par groupe (matières et compétences) et par élève (comparaison à la moyenne du groupe).
- **Bulletins** par étape, imprimables / PDF, avec moyenne du groupe, résultat final cumulatif et commentaires.
- **Numérisation par IA** : photographier un relevé papier (ou importer un PDF), Claude lit le tableau, reconnaît les élèves et propose matière, compétence et barème pour chaque colonne. Écran de vérification (cases incertaines en jaune, invalides en rouge) avant l'import ; possibilité d'ajouter les élèves absents de la liste. Nécessite une clé API Anthropic (Réglages → Intelligence artificielle), conservée uniquement sur l'appareil.
- **Exportation Excel** (.xlsx) par groupe : fiche du groupe, élèves et interventions, résultats par étape et final, notes détaillées par étape, statistiques.
- **Sauvegarde** : données stockées sur l'appareil ; export/import JSON pour sauvegarder ou changer d'appareil.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests unitaires (calculs, saisie, export Excel)
npm run build    # version de production dans dist/ (à déployer sur n'importe quel hébergement statique)
```

## Aperçu en ligne (GitHub Pages)

La version compilée est publiée dans `docs/`. Pour la mettre à jour : `npm run build:pages`, puis commit et push.
Activation (une seule fois) : Settings → Pages → Source « Deploy from a branch » → branche `claude/admiring-carson-4pvahu`, dossier `/docs`.
