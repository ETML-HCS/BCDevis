# BCDevis Central 7.1.6

BCDevis Central est le service multi-postes de la V7. L’application Electron ou PWA communique avec cette API en HTTPS. Seule l’API possède les identifiants PostgreSQL ; ils ne sont jamais envoyés aux appareils.

## Données PostgreSQL

Le schéma [schema.sql](schema.sql) crée des tables distinctes pour :

- les organisations, utilisateurs, appareils et sessions ;
- les devis, avec unicité du numéro par organisation ;
- les séquences et réservations de numéros uniques par date ;
- les documents PDF et les factures, distingués par leur type et conservés dans PostgreSQL en `BYTEA` avec taille et empreinte SHA-256 ;
- les réglages partagés, compteurs, contacts, prestations personnalisées et adaptations du catalogue ;
- les révisions de synchronisation et le journal d’activité.

Les préférences d’écran et le brouillon en cours restent sur chaque appareil. Les devis enregistrés, les contacts et les réglages métier sont synchronisés.

## Démarrage avec Docker Compose

1. Copiez `.env.example` vers `.env` dans ce dossier.
2. Remplacez les deux mots de passe et vérifiez les origines autorisées.
3. Depuis `central-server`, démarrez les services :

```powershell
docker compose -f compose.yml --env-file .env up -d --build
```

4. Vérifiez l’API locale :

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/v1/health
```

Le premier démarrage crée le compte défini par `BCDEVIS_ADMIN_EMAIL` et `BCDEVIS_ADMIN_PASSWORD`. Un redémarrage ultérieur ne remplace ni le compte ni son mot de passe.

PostgreSQL reste uniquement sur le réseau Docker privé. Le port `8787` de l’API écoute seulement sur la boucle locale afin d’être publié derrière un proxy HTTPS tel que Caddy, Nginx ou Cloudflare Tunnel.

## Test d’intégration PostgreSQL

La validation habituelle utilise `pg-mem` pour rester rapide. Le test d’intégration dédié exerce en plus l’API sur un vrai PostgreSQL : création du schéma, réservations concurrentes de numéros, synchronisation, conflit, colonnes JSONB, document `BYTEA` et journal d’activité.

Depuis la racine du dépôt, utilisez uniquement une base jetable dont le nom contient `test` :

```powershell
$env:BCDEVIS_TEST_DATABASE_URL='postgresql://bcdevis_test:secret@127.0.0.1:5432/bcdevis_test'
npm run test:central:postgres
```

Le test crée un schéma isolé portant un nom aléatoire et le supprime à la fin. Il refuse volontairement une base dont le nom ne contient pas `test`. La CI exécute automatiquement le même scénario sur PostgreSQL 17 avec `npm run check:ci`.

## Connexion dans BCDevis

Dans **Réglages > Données** :

1. activez **Connecter ce poste** ;
2. indiquez l’adresse publique HTTPS du serveur ;
3. renseignez le compte central et le nom de l’appareil ;
4. utilisez **Tester le serveur**, puis **Se connecter**.

Chaque appareil reçoit un code permanent (`P01`, `P02`, etc.) utilisé dans les nouveaux numéros de devis. Le mot de passe du compte n’est pas conservé ; seul un jeton de session révocable est enregistré localement.

Une fois le poste connecté, **Numéros uniques centralisés** peut être activé dans le même panneau. L’API réserve atomiquement dans PostgreSQL des blocs quotidiens sans doublon. Le poste conserve une petite réserve locale : les numéros déjà attribués restent donc disponibles pendant une coupure, avec des trous possibles si une réservation n’est jamais utilisée.

Les boutons **Documents PDF** et **Factures** ouvrent deux vues de la bibliothèque centrale. Un compte `admin` ou `editor` peut importer un PDF de **8 Mo maximum** avec le type `document` ou `invoice` ; tout compte authentifié peut le lister et l’afficher. Le contenu n’est jamais inclus dans la synchronisation JSON : il est lu séparément, à la demande, par une route authentifiée. Une facture importée depuis un devis accepté clôt son suivi actif côté application seulement après la réussite de l’archivage.

Pour Electron, conservez l’origine `null` dans `BCDEVIS_ALLOWED_ORIGINS`. Pour la PWA, ajoutez uniquement son origine exacte, sans chemin, par exemple `https://etml-hcs.github.io`.

## Conflits et mode hors ligne

Le serveur garde la dernière révision vue par chaque appareil. Les modifications portant sur des devis ou contacts différents sont fusionnées. Si deux appareils modifient le même devis, le même contact ou le même réglage, aucune version n’est écrasée automatiquement : BCDevis demande laquelle conserver et télécharge auparavant une sauvegarde JSON du poste.

Sans réseau, l’application continue d’enregistrer localement. La synchronisation reprend au retour de la connexion.

## Sauvegarde PostgreSQL

Créez régulièrement une sauvegarde hors du serveur :

```powershell
docker compose -f compose.yml --env-file .env exec -T postgres pg_dump -U bcdevis -d bcdevis --format=custom > bcdevis-central.dump
```

Cette sauvegarde comprend aussi le contenu `BYTEA` des PDF. Vérifiez la restauration dans une base PostgreSQL distincte avant de considérer la sauvegarde comme opérationnelle, et surveillez la croissance du volume PostgreSQL.

## Variables sans Docker

L’API accepte soit `BCDEVIS_DATABASE_URL`, soit `BCDEVIS_PGHOST`, `BCDEVIS_PGPORT`, `BCDEVIS_PGDATABASE`, `BCDEVIS_PGUSER` et `BCDEVIS_PGPASSWORD`.

```powershell
$env:BCDEVIS_DATABASE_URL='postgresql://bcdevis:secret@127.0.0.1:5432/bcdevis'
$env:BCDEVIS_ADMIN_EMAIL='admin@cliniquebellecour.ch'
$env:BCDEVIS_ADMIN_PASSWORD='un-mot-de-passe-long-et-unique'
$env:BCDEVIS_ALLOWED_ORIGINS='null,https://etml-hcs.github.io'
npm run central:start
```

En production, placez toujours l’API derrière HTTPS, limitez les origines, protégez les sauvegardes et n’exposez jamais le port PostgreSQL à Internet.
