// Dev utility: remove throwaway test accounts created during setup/testing.
import Database from 'better-sqlite3';

const emails = (process.argv.slice(2).length ? process.argv.slice(2) : ['demo@example.com', 'verify-test@example.com'])
  .map((e) => e.toLowerCase());

const db = new Database('data/domashno.db');
db.pragma('foreign_keys = ON');

for (const email of emails) {
  const u = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
  if (!u) {
    console.log(`- ${email}: not found`);
    continue;
  }
  const owned = db.prepare('SELECT COUNT(*) n FROM classes WHERE owner_id = ?').get(u.id).n;
  if (owned) {
    console.log(`! ${email}: owns ${owned} class(es) — skipped`);
    continue;
  }
  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM identities WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM members WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM subject_perms WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM email_tokens WHERE email = ?').run(email);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  })();
  console.log(`✓ ${email}: deleted`);
}

console.log('\nRemaining users:');
for (const r of db.prepare('SELECT name, email, email_verified FROM users ORDER BY created_at').all()) {
  console.log(`  ${r.name} <${r.email ?? '—'}>${r.email_verified ? ' ✓verified' : ''}`);
}
