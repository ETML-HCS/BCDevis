#!/usr/bin/env node
"use strict";

const { CentralDatabase } = require("./database.cjs");

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  const database = new CentralDatabase();

  try {
    const isHealthy = await database.health();
    if (!isHealthy) throw new Error("La base PostgreSQL n’est pas joignable.");

    const org = await database.getPrimaryOrganization();
    if (!org) throw new Error("Aucune organisation trouvée. Initialisez d’abord le serveur central.");

    switch (command) {
      case "user:list": {
        const users = await database.listUsers(org.id);
        console.log(`\nUtilisateurs pour l'organisation: ${org.name} (${org.id})\n`);
        console.table(users.map((u) => ({
          ID: u.id.slice(0, 8) + "…",
          Email: u.email,
          Rôle: u.role,
          Actif: u.active ? "Oui" : "Non",
          Créé_le: new Date(u.created_at).toLocaleString("fr-CH")
        })));
        break;
      }

      case "user:create": {
        const email = args[1];
        const password = args[2];
        const role = args[3] || "editor";
        if (!email || !password) {
          console.error("Usage: node central-server/admin.cjs user:create <email> <password> [admin|editor|reader]");
          process.exitCode = 1;
          return;
        }
        const created = await database.createUser({ organizationId: org.id, email, password, role });
        console.log(`\n✅ Utilisateur créé avec succès : ${created.email} (rôle: ${created.role}, id: ${created.id})\n`);
        break;
      }

      case "user:role": {
        const email = args[1];
        const role = args[2];
        if (!email || !role) {
          console.error("Usage: node central-server/admin.cjs user:role <email> <admin|editor|reader>");
          process.exitCode = 1;
          return;
        }
        const user = await database.findUserByEmail(email);
        if (!user) throw new Error(`Utilisateur introuvable pour l'e-mail ${email}`);
        await database.setUserRole({ userId: user.id, role });
        console.log(`\n✅ Rôle mis à jour pour ${email} : ${role}\n`);
        break;
      }

      case "user:password": {
        const email = args[1];
        const password = args[2];
        if (!email || !password) {
          console.error("Usage: node central-server/admin.cjs user:password <email> <nouveau_mot_de_passe>");
          process.exitCode = 1;
          return;
        }
        const user = await database.findUserByEmail(email);
        if (!user) throw new Error(`Utilisateur introuvable pour l'e-mail ${email}`);
        await database.setUserPassword({ userId: user.id, newPassword: password });
        console.log(`\n✅ Mot de passe modifié pour ${email}. Les sessions existantes ont été invalidées.\n`);
        break;
      }

      case "user:disable": {
        const email = args[1];
        if (!email) {
          console.error("Usage: node central-server/admin.cjs user:disable <email>");
          process.exitCode = 1;
          return;
        }
        const user = await database.findUserByEmail(email);
        if (!user) throw new Error(`Utilisateur introuvable pour l'e-mail ${email}`);
        await database.setUserActive({ userId: user.id, active: false });
        console.log(`\n✅ Utilisateur ${email} désactivé. Ses sessions ont été supprimées.\n`);
        break;
      }

      case "user:enable": {
        const email = args[1];
        if (!email) {
          console.error("Usage: node central-server/admin.cjs user:enable <email>");
          process.exitCode = 1;
          return;
        }
        const user = await database.findUserByEmail(email);
        if (!user) throw new Error(`Utilisateur introuvable pour l'e-mail ${email}`);
        await database.setUserActive({ userId: user.id, active: true });
        console.log(`\n✅ Utilisateur ${email} réactivé.\n`);
        break;
      }

      case "device:list": {
        const devices = await database.listDevices(org.id);
        console.log(`\nAppareils connectés pour l'organisation: ${org.name}\n`);
        console.table(devices.map((d) => ({
          Code: d.code,
          Nom: d.name,
          Utilisateur: d.user_email || "—",
          Dernière_révision: d.last_revision ?? "—",
          Vu_le: d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("fr-CH") : "—"
        })));
        break;
      }

      case "device:revoke": {
        const target = args[1];
        if (!target) {
          console.error("Usage: node central-server/admin.cjs device:revoke <code_ou_id>");
          process.exitCode = 1;
          return;
        }
        const devices = await database.listDevices(org.id);
        const device = devices.find((d) => d.code === target || d.id === target);
        if (!device) throw new Error(`Appareil introuvable pour l'identifiant ou code: ${target}`);
        const result = await database.revokeDevice({ deviceId: device.id });
        console.log(`\n✅ Appareil ${result.code} (${result.name}) révoqué. ${result.revokedSessionsCount} session(s) fermée(s).\n`);
        break;
      }

      case "audit": {
        const limit = Number(args[1]) || 20;
        const events = await database.audit(org.id, limit);
        console.log(`\nJournal d'activité (${events.length} derniers événements) :\n`);
        console.table(events.map((e) => ({
          ID: e.id,
          Action: e.action,
          Révision: e.revision ?? "—",
          Utilisateur: e.email || "—",
          Poste: e.device_code || "—",
          Date: new Date(e.created_at).toLocaleString("fr-CH")
        })));
        break;
      }

      case "migrate:status": {
        const migrations = await database.getMigrationStatus();
        console.log(`\nÉtat des migrations PostgreSQL :\n`);
        console.table(migrations.map((m) => ({
          Version: m.version,
          Nom: m.name,
          Appliquée: m.applied ? "Oui" : "Non",
          Appliquée_le: m.applied_at ? new Date(m.applied_at).toLocaleString("fr-CH") : "—"
        })));
        break;
      }

      case "migrate":
      case "migrate:run": {
        const result = await database.migrate();
        console.log(`\n✅ Migration(s) : ${result.applied.length} nouvelle(s) appliquée(s) sur ${result.total} totale(s).\n`);
        break;
      }

      case "session:cleanup": {
        const count = await database.cleanupExpiredSessions();
        console.log(`\n✅ Nettoyage terminé : ${count} session(s) expirée(s) supprimée(s).\n`);
        break;
      }

      case "help":
      default:
        console.log(`
BCDevis Central - Administration CLI

Commandes disponibles :
  user:list                            Lister tous les utilisateurs
  user:create <email> <pass> [rôle]    Créer un compte (admin, editor, reader)
  user:role <email> <rôle>             Changer le rôle d'un utilisateur
  user:password <email> <pass>         Réinitialiser le mot de passe (invalide les sessions)
  user:disable <email>                 Désactiver un compte utilisateur
  user:enable <email>                  Réactiver un compte utilisateur
  device:list                          Lister les appareils autorisés et leur code
  device:revoke <code_ou_id>           Révoquer les sessions actives d'un appareil
  audit [limite]                       Afficher les derniers événements d'audit
  migrate:status                       Afficher l'état d'application des migrations de schéma
  migrate:run                          Appliquer les migrations de schéma en attente
  session:cleanup                      Purger les sessions expirées de la base
`);
        break;
    }
  } finally {
    await database.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\n❌ Erreur : ${error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
