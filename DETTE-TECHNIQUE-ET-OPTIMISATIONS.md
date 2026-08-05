# BCDevis — Dette technique et optimisations

## Statut du document

- **Audit :** 5 août 2026
- **Référence :** BCDevis 7.0.2, candidat local du 5 août 2026
- **Objectif :** rendre visible la dette qui affecte la fiabilité, la sécurité, les performances et le coût de maintenance
- **Documents associés :** [Améliorations recommandées](AMELIORATIONS-RECOMMANDEES.md) et [Nouvelles fonctionnalités](NOUVELLES-FONCTIONNALITES.md)

## Mesures de référence

| Élément | Mesure au 5 août 2026 | Lecture |
| --- | ---: | --- |
| `app.js` | 4 435 lignes, 235 146 octets | Renderer encore très concentré. |
| `central-sync.js` | 434 lignes, 19 181 octets | Module déjà isolé, mais basé sur un instantané complet. |
| `index.html` | 2 567 lignes, 220 920 octets | Structure et environ 1 729 lignes de CSS intégré. |
| `styles.css` | 3 012 lignes, 213 599 octets | Feuille importante avec plusieurs couches responsive. |
| Serveur central | 873 lignes hors schéma | API compacte, encore sans couche d’administration ni migrations versionnées. |
| Tests | 13 suites dans `npm test` | Couverture large de contrats et un smoke Electron ; pas de mesure de couverture globale. |
| Dépendances | 0 vulnérabilité signalée par `npm audit` | Quelques mises à jour mineures et dépendances transitives dépréciées restent à suivre. |

Commandes exécutées pendant l’audit :

```powershell
npm run check
npm audit
npm audit --omit=dev
npm outdated --json
docker compose -f central-server/compose.yml --env-file central-server/.env.example config
```

## Registre priorisé

### DT-01 — Synchronisation complète et réécriture globale

- **Priorité : critique avant montée en charge**
- **État : ouverte**
- **Preuve :** le client envoie `sharedSnapshot(...)` entier ; `replaceSharedRows()` supprime cinq ensembles de lignes puis les réinsère ; `devices.last_snapshot` conserve une nouvelle copie complète par appareil.
- **Impact :** temps, trafic et volume PostgreSQL augmentent avec tous les devis, même pour modifier une seule note. La limite HTTP de 12 Mo devient une limite fonctionnelle de la base partagée.
- **Traitement :** passer à des mutations par entité, révisions et marqueurs de suppression ; conserver un instantané complet uniquement pour amorçage ou récupération.
- **Validation :** une modification de devis ne touche aucune autre ligne et le volume envoyé reste proportionnel à la modification.

### DT-02 — Absence de migrations PostgreSQL versionnées

- **Priorité : critique avant évolution du schéma**
- **État : ouverte**
- **Preuve :** `migrate()` exécute directement `schema.sql`, composé de `CREATE ... IF NOT EXISTS`.
- **Impact :** ajouter ou transformer une colonne sur une base existante ne dispose pas d’ordre, de version enregistrée ni de procédure de retour arrière.
- **Traitement :** table de version, scripts numérotés, transaction lorsque possible, sauvegarde préalable et test depuis chaque version supportée.
- **Validation :** une base V7.0.1 peuplée atteint le nouveau schéma sans perte et ne réexécute pas une migration appliquée.

### DT-03 — Administration des identités incomplète

- **Priorité : haute**
- **État : ouverte**
- **Preuve :** le premier démarrage crée un administrateur ; aucune route ni commande maintenue ne gère ensuite utilisateurs, rôles, appareils ou révocation globale.
- **Impact :** perte d’un appareil, départ d’un utilisateur et rotation d’urgence nécessitent une intervention manuelle risquée.
- **Traitement :** outil d’administration authentifié ou CLI locale, journalisation, révocation des sessions et procédure de récupération.
- **Validation :** scénarios automatisés admin/editor/reader, compte désactivé, appareil révoqué et mot de passe changé.

### DT-04 — Sauvegardes et restaurations insuffisamment prouvées

- **Priorité : haute**
- **État : ouverte**
- **Preuve :** la restauration locale ne télécharge pas automatiquement l’état remplacé ; le guide central donne `pg_dump` mais ne fournit pas encore une procédure `pg_restore` complète et testée.
- **Impact :** une erreur humaine ou une sauvegarde logique invalide peut rendre la récupération lente ou incertaine.
- **Traitement :** instantané automatique, validation avant import, rotation, chiffrement, restauration périodique dans une base distincte et rapport de contrôle.
- **Validation :** récupération prouvée d’un jeu contenant réglages, devis, suivis, appareils et PDF.

### DT-05 — Jeton central et données locales non chiffrés

- **Priorité : haute selon le modèle de menace**
- **État : ouverte**
- **Preuve :** `bcdevis-central-v1` conserve le jeton porteur dans le stockage du client ; la base locale et les exports JSON restent lisibles.
- **Impact :** un accès au profil utilisateur, une sauvegarde copiée ou une faille d’injection côté PWA peut exposer les coordonnées et la session.
- **Traitement :** coffre système Electron, rotation/révocation, CSP, réduction de durée des sessions selon le besoin, exports chiffrés facultatifs et documentation exacte du risque.
- **Validation :** aucun secret dans les journaux ou livrables ; révocation immédiate testée ; migration sans perte de configuration.

### DT-06 — Renderer monolithique

- **Priorité : moyenne**
- **État : ouverte**
- **Preuve :** `app.js` concentre persistance, migrations, catalogue, devis, historique, suivi, centralisation, PDF, partage, réglages et accessibilité.
- **Impact :** régressions croisées, revues difficiles et tests unitaires plus coûteux.
- **Traitement :** extraction progressive par domaine avec interfaces explicites et fonctions pures ; aucun changement de framework requis.
- **Validation :** modules métier testables sans DOM ni Electron et réduction continue du fichier d’orchestration.

### DT-07 — CSS réparti entre HTML et feuille globale

- **Priorité : moyenne**
- **État : ouverte**
- **Preuve :** près de 98 Ko de CSS restent dans un bloc `<style>` de `index.html`, en plus des 212 Ko de `styles.css`.
- **Impact :** cascade difficile à raisonner, doublons, risque visuel et blocage d’une CSP stricte sans style intégré.
- **Traitement :** extraire par couches, inventorier les sélecteurs et supprimer les doublons seulement après comparaison visuelle.
- **Validation :** captures aux largeurs de référence, quatre thèmes et PDF inchangés ou volontairement approuvés.

### DT-08 — Version dupliquée dans de nombreuses sources

- **Priorité : moyenne**
- **État : ouverte**
- **Preuve :** `7.0.2` apparaît dans `package.json`, le serveur, le service worker, le renderer, les guides, les notes et plusieurs tests ; le schéma local utilise séparément `APP_VERSION = 23`.
- **Impact :** oubli possible lors d’une livraison, cache PWA incohérent ou document portant une ancienne version.
- **Traitement :** générer les constantes et documents depuis `package.json`, tout en conservant un numéro de schéma de données distinct et documenté.
- **Validation :** une seule modification de version met à jour automatiquement application, serveur, cache, noms d’artefacts et contrôles documentaires.

### DT-09 — Tests de production et CI de contrôle manquants

- **Priorité : haute**
- **État : partiellement traitée le 5 août 2026**
- **Preuve initiale :** la centralisation était uniquement testée avec `pg-mem`; les workflows contrôlaient les tags ou construisaient puis publiaient Pages depuis `main`.
- **Réduction réalisée :** `.github/workflows/ci.yml` exécute désormais `npm run check:ci` sur les pull requests et `main`, avec un service PostgreSQL 17. `central-postgres.integration.test.cjs` crée un schéma de test isolé et couvre concurrence des numéros, synchronisation, conflits, JSONB, PDF et audit.
- **Preuve encore attendue :** le moteur Docker local était indisponible pendant l’implémentation ; la syntaxe, le workflow et les suites locales sont validés, mais la première exécution réelle PostgreSQL doit encore réussir en CI.
- **Impact :** un écart PostgreSQL, proxy ou navigateur peut n’apparaître qu’après fusion ou déploiement.
- **Traitement restant :** test HTTPS/proxy, matrice minimale Chromium/Electron et essais de volume.
- **Validation :** aucune publication nécessaire pour obtenir le verdict de CI ; échec reproductible avant fusion.

### DT-10 — Chaîne de livraison non signée et références CI mutables

- **Priorité : moyenne avant diffusion large**
- **État : ouverte**
- **Preuve :** la configuration désactive la signature Windows ; macOS attend signature et notarisation ; les actions GitHub utilisent des tags majeurs.
- **Impact :** alertes système, confiance utilisateur réduite et risque de chaîne d’approvisionnement plus large.
- **Traitement :** signature Windows, signature/notarisation macOS, vérification dans la CI, empreintes publiées et actions épinglées à des SHA revus.
- **Validation :** signature contrôlée sur les artefacts finaux, pas seulement sur les sources.

### DT-11 — Observabilité, rétention et capacité du serveur

- **Priorité : moyenne**
- **État : ouverte**
- **Preuve :** un journal d’audit existe mais n’est pas exposé dans l’application ; documents, audit et réservations n’ont pas de politique de rétention ; les PDF sont stockés en `BYTEA`.
- **Impact :** croissance difficile à anticiper, diagnostic lent et sauvegardes de plus en plus lourdes.
- **Traitement :** journaux structurés sans données sensibles, métriques de latence/erreur/taille, alertes de capacité, rétention décidée et éventuelle séparation du stockage documentaire si le volume l’exige.
- **Validation :** seuils documentés, tableau de capacité et purge contrôlée avec audit.

### DT-12 — Limites du stockage PWA

- **Priorité : moyenne**
- **État : ouverte**
- **Preuve :** la base locale complète reste dans `localStorage`; les erreurs de quota sont interceptées mais la limite varie selon navigateur et profil.
- **Impact :** échec de sauvegarde possible avec historique, logos et suivi volumineux, surtout hors centralisation.
- **Traitement :** mesurer les volumes réels, migrer progressivement vers IndexedDB et conserver export/import compatible.
- **Validation :** migration atomique, interruption simulée, quota faible et reprise depuis une ancienne base.

### DT-13 — Dépendances et artefacts lourds

- **Priorité : basse, surveillance continue**
- **État : ouverte**
- **Preuve :** `electron` et `marked` ont des correctifs mineurs disponibles ; l’arbre de packaging contient des dépendances transitives dépréciées. Les PDF et captures versionnés alourdissent l’historique Git.
- **Impact :** maintenance plus coûteuse, téléchargements et historique plus volumineux.
- **Traitement :** mises à jour séparées avec tests complets, suivi des transitives via `electron-builder`, optimisation des captures et stratégie explicite pour les PDF générés.
- **Validation :** audit vert, artefacts identiques fonctionnellement, tailles comparées et aucun livrable requis supprimé.

## Plan d’optimisation mesurable

### Mesures à automatiser

- taille JSON locale et taille de l’instantané partagé ;
- durée et octets envoyés/reçus par synchronisation ;
- nombre de requêtes SQL et lignes touchées pour une modification ;
- temps d’ouverture, de recherche et de rendu avec 100, 500 et 1 000 devis ;
- taille du cache PWA et des artefacts par plateforme ;
- volume PostgreSQL des devis, instantanés par appareil, PDF et audit ;
- durée d’une sauvegarde et d’une restauration vérifiée.

### Budgets à fixer après la première mesure

Les seuils définitifs doivent être décidés sur l’infrastructure cible. Les contraintes minimales sont toutefois les suivantes :

- aucune synchronisation ordinaire ne doit dépendre de la taille totale de l’historique ;
- aucune action utilisateur ne doit supprimer les données d’une autre entité sans intention explicite ;
- l’historique doit rester interactif avec le volume cible à 24 mois ;
- une limite de taille doit être visible avant l’échec et proposer une action de récupération ;
- chaque sauvegarde déclarée valide doit avoir fait l’objet d’un test de restauration.

## Tests et commandes

Commandes disponibles depuis le premier lot de réduction :

```text
npm run test:central:postgres
npm run check:ci
```

`test:central:postgres` exige `BCDEVIS_TEST_DATABASE_URL` et refuse une base dont le nom ne contient pas `test`. `check:ci` enchaîne les validations habituelles et ce test réel.

Les commandes suivantes restent proposées et n’existent pas encore :

```text
npm run test:e2e
npm run test:performance
npm run check:versions
npm run check:artifacts
```

Leur rôle attendu :

- `test:e2e` : parcours local et central dans le navigateur/Electron ;
- `test:performance` : jeux de 100, 500 et 1 000 devis ;
- `check:versions` : cohérence version, cache, guides et serveur ;
- `check:artifacts` : format, signature, contenu, absence de données utilisateur et empreintes.

## Règles de gestion de la dette

1. Toute nouvelle dette reçoit un identifiant, une preuve, un impact et un critère de sortie.
2. Une dette critique bloque l’extension du périmètre qu’elle fragilise.
3. Une optimisation commence par une mesure reproductible.
4. Les changements de persistance ou synchronisation exigent sauvegarde, migration et retour arrière.
5. Une dépendance n’est pas mise à jour uniquement pour supprimer un avertissement : le livrable final doit être retesté.
6. Les sorties ignorées de `devis-portable/dist` ne doivent jamais être nettoyées en bloc lorsqu’elles contiennent des livrables à conserver.
7. Ce registre doit être revu à chaque version mineure et avant toute mise en production du serveur central.
