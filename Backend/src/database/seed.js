require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initializeSchema, run, queryAll } = require('./schema');

async function seedDatabase() {
  await initializeSchema();

  console.log('Seeding database...');
  console.log('  Skipping hardcoded product seed — all products are AI-generated dynamically.');

  // ── Seed portal users ─────────────────────────────────────────────────────
  // Pre-defined accounts for each role with role-based access
  const portalUsers = [
    { email: 'admin@ganga-maxx.com', pass: 'Pranav@123', name: 'Super Admin', role: 'admin', phone: '+91-9000000000' },
    { email: 'salesadmin@ganga-maxx.com', pass: 'salesadmin@123', name: 'Sales Administrator', role: 'sales_admin', phone: '+91-9000000007' },
    { email: 'salesman@ganga-maxx.com', pass: 'salesman@123', name: 'Field Sales Agent', role: 'salesman', phone: '+91-9000000003' },
    { email: 'warehouse@ganga-maxx.com', pass: 'warehouse@123', name: 'Warehouse Manager', role: 'warehouse_staff', phone: '+91-9000000004' },
    { email: 'accounts@ganga-maxx.com', pass: 'accounts@123', name: 'Accounts Manager', role: 'accounts_manager', phone: '+91-9000000005' },
    { email: 'compliance@ganga-maxx.com', pass: 'compliance@123', name: 'Compliance Officer', role: 'compliance_admin', phone: '+91-9000000006' },
    { email: 'dealer@ganga-maxx.com', pass: 'dealer@123', name: 'Dealer Distributor', role: 'dealer', phone: '+91-9000000002' },
    { email: 'manager@ganga-maxx.com', pass: 'manager@123', name: 'Facility Manager', role: 'field_staff', phone: '+91-9000000001' },
  ];

  const existingUsers = await queryAll('SELECT COUNT(*) as count FROM users').catch(() => [{ count: 0 }]);
  if (!existingUsers.length || existingUsers[0].count === 0) {
    for (const u of portalUsers) {
      const hashedPassword = await bcrypt.hash(u.pass, 10);
      await run(
        `INSERT INTO users (uid, email, passwordHash, displayName, role, phone, age, gender, photoURL, provider, emailVerified, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        ['user_' + uuidv4(), u.email, hashedPassword, u.name, u.role, u.phone, null, '', null, 'password', new Date().toISOString()]
      ).catch(e => console.log('    Skipped ' + u.email + ': ' + e.message));
    }
    console.log('  ' + portalUsers.length + ' portal users seeded with roles');
  } else {
    console.log('  Users table already has data — skipping user seed');
  }

  console.log('\n Database seeding complete!');
}

seedDatabase().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
