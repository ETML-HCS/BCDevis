# BCDevis — Dette technique et optimisations

## Statut du document

- **Audit :** 7 août 2026
- **Référence :** BCDevis 7.1.0 et évolutions locales non taguées du 7 août 2026
- **Objectif :** rendre visible la dette qui affecte la fiabilité, la sécurité, les performances et le coût de maintenance
- **Documents associés :** [Améliorations recommandées](AMELIORATIONS-RECOMMANDEES.md) et [Nouvelles fonctionnalités](NOUVELLES-FONCTIONNALITES.md)

## Mesures de référence

| Élément | Mesure au 7 août 2026 | Lecture |
| --- | ---: | --- |
| `app.js` | 5 199 lignes, 273 343 octets | Renderer encore très concentré ; le contrôleur du répertoire doit être le prochain candidat à l’extraction. |
| `contact-core.js` | 244 lignes, 11 001 octets | Formats, normalisation et fusion sont isolés et testables sans DOM. |
| `central-sync.js` | 436 lignes, 19 312 octets | Module déjà isolé, mais basé sur un instantané complet qui inclut désormais les contacts. |
| `index.html` | 2 592 lignes, 227 006 octets | Le répertoire ajoute une surface complète ; environ 1 700 lignes de CSS intégré restent à extraire. |
| `styles.css` | 3 234 lignes, 228 132 octets | Feuille importante avec plusieurs couches responsive ; les styles Contacts s’ajoutent encore à la feuille globale. |
| Centre d’aide | 417 lignes, 33 629 octets | Contenu, présentation et recherche sont isolés dans trois fichiers sans dépendance externe. |
| Serveur central | 875 lignes hors schéma | API compacte, encore sans couche d’administration ni migrations versionnées. |
| Tests | 16 suites dans `npm test` | Le moteur Contacts, le centre d’aide, les ressources PWA et l’intégration Electron sont couverts ; pas de mesure de couverture globale. |
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
- **Preuve :** `migrate()` exécute directement `schema.sql`, composé de `CREATE ... IF NOT EXISTS` et désormais d’un `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pour distinguer documents et factures.
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
- **Preuve :** `7.1.0` apparaît dans `package.json`, le serveur, le service worker, le renderer, les guides, les notes et plusieurs tests ; le schéma local utilise séparément `APP_VERSION = 25`.
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

### DT-14 — Transitions commerciales et immutabilité insuffisantes

- **Priorité initiale : haute**
- **État : fortement réduite localement le 5 août 2026**
- **Preuve initiale :** tout statut pouvait remplacer n’importe quel autre statut ; un devis accepté restait modifiable et un nouvel envoi pouvait le faire revenir à `Envoyé`.
- **Réduction réalisée :** table de transitions autorisées, refus des régressions, verrouillage des états `Accepté`, `Refusé`, `Expiré` et `Facture envoyée`, V2 liée, auteur/poste dans les événements, et clôture `Accepté` → `Facture envoyée` après import PDF réussi.
- **Risque restant :** la logique demeure dans le renderer monolithique ; la contrainte n’est pas encore réappliquée par l’API centrale et le schéma PostgreSQL n’impose pas les transitions.
- **Traitement restant :** extraire une machine d’état pure partagée par les tests, puis valider les mutations sensibles côté serveur si une API par entité remplace les instantanés complets.
- **Validation :** tests unitaires exhaustifs de chaque transition, refus côté serveur d’une régression et preuve multi-postes sur PostgreSQL réel.

### DT-15 — Préférences propres au poste réparties entre plusieurs stockages

- **Priorité : basse**
- **État : dette rendue explicite le 6 août 2026**
- **Preuve :** le dossier PDF natif vit dans `desktop-preferences.json`, le démarrage automatique dépend du système, et les préférences d’affichage locales restent séparées des réglages métier synchronisés.
- **Impact :** cette séparation est correcte fonctionnellement, mais chaque nouvelle préférence locale risque de reproduire sa propre lecture, validation et interface IPC.
- **Traitement :** extraire un petit module de préférences de bureau typées, avec schéma, migrations et contrat commun au preload ; conserver explicitement hors synchronisation les chemins absolus et options système.
- **Validation :** tests de migration du fichier de préférences, corruption récupérable, chemins indisponibles et compatibilité Windows/Linux/macOS.

### DT-16 — Sources d’aide et documents de livraison dupliqués

- **Priorité initiale : moyenne**
- **État : fortement réduite localement le 6 août 2026**
- **Preuve initiale :** les 16 raccourcis étaient copiés dans `index.html`, une fiche Markdown et un PDF ; l’accès dans l’application restait une petite modale sans recherche ni liens contextuels.
- **Réduction réalisée :** `help.html` est la seule source du centre d’aide intégré ; la présentation et la recherche multi-mots sont isolées, les libellés suivent l’interface réelle, l’impression part de ce HTML, l’ancienne modale et ses styles sont supprimés, et les ressources sont incluses dans le cache PWA.
- **Risque restant :** les guides et PDF de livraison 7.1.0 restent des documents de secours séparés ; ils peuvent dériver s’ils continuent à être traités comme documentation vivante.
- **Traitement restant :** à la prochaine version majeure, décider soit de retirer ces PDF d’aide historiques, soit de produire le seul export imprimable directement depuis `help.html` dans la chaîne de livraison.
- **Validation :** aucune information opérationnelle nouvelle n’est ajoutée uniquement dans un PDF ou dans `index.html`, et le test du centre d’aide vérifie tous les thèmes livrés.

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
