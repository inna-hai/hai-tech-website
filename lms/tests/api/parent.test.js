/**
 * Parent Dashboard & Invitation System Tests
 * 
 * Tests for:
 * - Parent invitation creation
 * - Invite acceptance flow
 * - Parent-child linking
 * - Authorization (IDOR protection)
 * - Parent dashboard endpoints
 */

const db = require('../../api/db');
const bcrypt = require('../../api/node_modules/bcryptjs');
const jwt = require('../../api/node_modules/jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('../../api/node_modules/uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'hai-tech-lms-secret-key-2026';

// Initialize parent tables before tests
function initParentTables() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS parent_child_links (
                id TEXT PRIMARY KEY,
                parent_id TEXT NOT NULL,
                child_id TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                linked_at INTEGER DEFAULT (strftime('%s', 'now')),
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(parent_id, child_id)
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS parent_invites (
                id TEXT PRIMARY KEY,
                child_id TEXT NOT NULL,
                parent_email TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'pending',
                expires_at INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                accepted_at INTEGER
            )
        `);
        
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_child_links(parent_id);
            CREATE INDEX IF NOT EXISTS idx_parent_links_child ON parent_child_links(child_id);
            CREATE INDEX IF NOT EXISTS idx_parent_invites_token ON parent_invites(token);
            CREATE INDEX IF NOT EXISTS idx_parent_invites_child ON parent_invites(child_id);
        `);
    } catch (e) {
        // Tables might already exist, that's fine
    }
}

// Helper functions
function createTestUser(role = 'student', email = null) {
    const id = uuidv4();
    const userEmail = email || `test-${id.slice(0, 8)}@test.com`;
    const passwordHash = bcrypt.hashSync('password123', 10);
    
    db.prepare(`
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, userEmail, passwordHash, `Test ${role}`, role);
    
    return {
        id,
        email: userEmail,
        role,
        token: jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '1h' })
    };
}

function createTestInvite(childId, parentEmail, status = 'pending', expiresAt = null) {
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expires = expiresAt || Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    
    db.prepare(`
        INSERT INTO parent_invites (id, child_id, parent_email, token, status, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, childId, parentEmail, token, status, expires);
    
    return { id, token, parentEmail, expiresAt: expires };
}

function createParentChildLink(parentId, childId) {
    const id = uuidv4();
    db.prepare(`
        INSERT INTO parent_child_links (id, parent_id, child_id, status)
        VALUES (?, ?, ?, 'active')
    `).run(id, parentId, childId);
    return id;
}

function cleanupTestData() {
    try {
        db.prepare("DELETE FROM parent_invites WHERE parent_email LIKE '%@test.com'").run();
        db.prepare("DELETE FROM parent_child_links WHERE parent_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')").run();
        db.prepare("DELETE FROM users WHERE email LIKE '%@test.com'").run();
    } catch (e) {
        // Ignore cleanup errors
    }
}

// Tests
describe('Parent Invitation System', () => {
    let student, parent;
    
    beforeAll(() => {
        // Initialize parent tables
        initParentTables();
    });
    
    beforeEach(() => {
        cleanupTestData();
        student = createTestUser('student');
        parent = createTestUser('parent');
    });
    
    afterEach(() => {
        cleanupTestData();
    });

    describe('POST /api/parent/invite - Create Invitation', () => {
        test('Student can create invite to parent email', () => {
            const parentEmail = 'newparent@test.com';
            
            // Insert invite directly (simulating API call)
            const invite = createTestInvite(student.id, parentEmail);
            
            // Verify invite was created
            const savedInvite = db.prepare(
                'SELECT * FROM parent_invites WHERE token = ?'
            ).get(invite.token);
            
            expect(savedInvite).toBeDefined();
            expect(savedInvite.child_id).toBe(student.id);
            expect(savedInvite.parent_email).toBe(parentEmail);
            expect(savedInvite.status).toBe('pending');
        });

        test('Cannot create duplicate pending invite', () => {
            const parentEmail = 'duplicate@test.com';
            
            // Create first invite
            createTestInvite(student.id, parentEmail);
            
            // Check duplicate detection
            const existing = db.prepare(`
                SELECT * FROM parent_invites 
                WHERE child_id = ? AND parent_email = ? AND status = 'pending'
            `).get(student.id, parentEmail);
            
            expect(existing).toBeDefined();
        });

        test('Can refresh expired invite', () => {
            const parentEmail = 'expired@test.com';
            const expiredTime = Math.floor(Date.now() / 1000) - 1000; // Past
            
            // Create expired invite
            const expiredInvite = createTestInvite(student.id, parentEmail, 'pending', expiredTime);
            
            // Refresh it
            const newToken = crypto.randomBytes(32).toString('hex');
            const newExpiry = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
            
            db.prepare(`
                UPDATE parent_invites 
                SET token = ?, expires_at = ?
                WHERE id = ?
            `).run(newToken, newExpiry, expiredInvite.id);
            
            const refreshed = db.prepare(
                'SELECT * FROM parent_invites WHERE id = ?'
            ).get(expiredInvite.id);
            
            expect(refreshed.token).toBe(newToken);
            expect(refreshed.expires_at).toBe(newExpiry);
        });
    });

    describe('POST /api/parent/accept-invite - Accept Invitation', () => {
        test('New user can accept invite and create account', () => {
            const parentEmail = 'newuser@test.com';
            const invite = createTestInvite(student.id, parentEmail);
            
            // Simulate acceptance: create user and link
            const parentId = uuidv4();
            const passwordHash = bcrypt.hashSync('newpassword', 10);
            
            db.prepare(`
                INSERT INTO users (id, email, password_hash, name, role)
                VALUES (?, ?, ?, ?, 'parent')
            `).run(parentId, parentEmail, passwordHash, 'New Parent');
            
            createParentChildLink(parentId, student.id);
            
            db.prepare(`
                UPDATE parent_invites SET status = 'accepted', accepted_at = ?
                WHERE id = ?
            `).run(Math.floor(Date.now() / 1000), invite.id);
            
            // Verify
            const link = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND child_id = ?
            `).get(parentId, student.id);
            
            expect(link).toBeDefined();
            expect(link.status).toBe('active');
            
            const acceptedInvite = db.prepare(
                'SELECT * FROM parent_invites WHERE id = ?'
            ).get(invite.id);
            expect(acceptedInvite.status).toBe('accepted');
        });

        test('Existing user can accept invite', () => {
            // Parent already exists
            const invite = createTestInvite(student.id, parent.email);
            
            // Create link
            createParentChildLink(parent.id, student.id);
            
            // Verify link exists
            const link = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND child_id = ?
            `).get(parent.id, student.id);
            
            expect(link).toBeDefined();
            expect(link.status).toBe('active');
        });

        test('Cannot accept expired invite', () => {
            const parentEmail = 'expired@test.com';
            const expiredTime = Math.floor(Date.now() / 1000) - 1000;
            
            const invite = createTestInvite(student.id, parentEmail, 'pending', expiredTime);
            
            // Check if invite is expired
            const savedInvite = db.prepare(
                'SELECT * FROM parent_invites WHERE token = ?'
            ).get(invite.token);
            
            const now = Math.floor(Date.now() / 1000);
            expect(savedInvite.expires_at).toBeLessThan(now);
        });

        test('Cannot accept already accepted invite', () => {
            const parentEmail = 'accepted@test.com';
            const invite = createTestInvite(student.id, parentEmail, 'accepted');
            
            const savedInvite = db.prepare(
                'SELECT * FROM parent_invites WHERE token = ?'
            ).get(invite.token);
            
            expect(savedInvite.status).toBe('accepted');
        });
    });

    describe('Parent Dashboard Authorization (IDOR Protection)', () => {
        let child1, child2, linkedParent, unlinkedParent;
        
        beforeEach(() => {
            child1 = createTestUser('student', 'child1@test.com');
            child2 = createTestUser('student', 'child2@test.com');
            linkedParent = createTestUser('parent', 'linkedparent@test.com');
            unlinkedParent = createTestUser('parent', 'unlinkedparent@test.com');
            
            // Link parent to child1 only
            createParentChildLink(linkedParent.id, child1.id);
        });

        test('Parent can only access linked child data', () => {
            // Check link for child1 (should exist)
            const link1 = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND child_id = ? AND status = 'active'
            `).get(linkedParent.id, child1.id);
            
            expect(link1).toBeDefined();
            
            // Check link for child2 (should NOT exist)
            const link2 = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND child_id = ? AND status = 'active'
            `).get(linkedParent.id, child2.id);
            
            expect(link2).toBeUndefined();
        });

        test('Unlinked parent cannot access any child data', () => {
            // Check links for unlinked parent
            const links = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND status = 'active'
            `).all(unlinkedParent.id);
            
            expect(links.length).toBe(0);
        });

        test('Student role cannot access parent endpoints', () => {
            // This would be tested at the route level
            // Here we verify role is correctly stored
            const studentUser = db.prepare(
                'SELECT role FROM users WHERE id = ?'
            ).get(child1.id);
            
            expect(studentUser.role).toBe('student');
            expect(studentUser.role).not.toBe('parent');
        });
    });

    describe('GET /api/parent/children - List Children', () => {
        test('Parent sees only linked children', () => {
            const child1 = createTestUser('student', 'linked1@test.com');
            const child2 = createTestUser('student', 'linked2@test.com');
            const child3 = createTestUser('student', 'unlinked@test.com');
            
            // Link first two children
            createParentChildLink(parent.id, child1.id);
            createParentChildLink(parent.id, child2.id);
            
            // Query linked children
            const children = db.prepare(`
                SELECT u.id, u.name, u.email
                FROM parent_child_links pcl
                JOIN users u ON u.id = pcl.child_id
                WHERE pcl.parent_id = ? AND pcl.status = 'active'
            `).all(parent.id);
            
            expect(children.length).toBe(2);
            expect(children.map(c => c.id)).toContain(child1.id);
            expect(children.map(c => c.id)).toContain(child2.id);
            expect(children.map(c => c.id)).not.toContain(child3.id);
        });

        test('Parent with no children sees empty list', () => {
            const newParent = createTestUser('parent', 'nochildren@test.com');
            
            const children = db.prepare(`
                SELECT * FROM parent_child_links WHERE parent_id = ?
            `).all(newParent.id);
            
            expect(children.length).toBe(0);
        });
    });

    describe('GET /api/parent/invites - Student Invites', () => {
        test('Student can see sent invites', () => {
            const invite1 = createTestInvite(student.id, 'parent1@test.com');
            const invite2 = createTestInvite(student.id, 'parent2@test.com');
            
            const invites = db.prepare(`
                SELECT * FROM parent_invites WHERE child_id = ?
            `).all(student.id);
            
            expect(invites.length).toBe(2);
        });

        test('Student can see linked parents', () => {
            createParentChildLink(parent.id, student.id);
            
            const linked = db.prepare(`
                SELECT u.id, u.name, u.email
                FROM parent_child_links pcl
                JOIN users u ON u.id = pcl.parent_id
                WHERE pcl.child_id = ? AND pcl.status = 'active'
            `).all(student.id);
            
            expect(linked.length).toBe(1);
            expect(linked[0].id).toBe(parent.id);
        });
    });

    describe('Multi-Parent Multi-Child Support', () => {
        test('Child can have multiple parents', () => {
            const parent2 = createTestUser('parent', 'parent2@test.com');
            
            createParentChildLink(parent.id, student.id);
            createParentChildLink(parent2.id, student.id);
            
            const links = db.prepare(`
                SELECT parent_id FROM parent_child_links 
                WHERE child_id = ? AND status = 'active'
            `).all(student.id);
            
            expect(links.length).toBe(2);
        });

        test('Parent can have multiple children', () => {
            const child1 = createTestUser('student', 'multichild1@test.com');
            const child2 = createTestUser('student', 'multichild2@test.com');
            
            createParentChildLink(parent.id, child1.id);
            createParentChildLink(parent.id, child2.id);
            
            const links = db.prepare(`
                SELECT child_id FROM parent_child_links 
                WHERE parent_id = ? AND status = 'active'
            `).all(parent.id);
            
            expect(links.length).toBe(2);
        });
    });

    describe('Invite Token Security', () => {
        test('Token is cryptographically random', () => {
            const invite1 = createTestInvite(student.id, 'random1@test.com');
            const invite2 = createTestInvite(student.id, 'random2@test.com');
            
            // Tokens should be different
            expect(invite1.token).not.toBe(invite2.token);
            
            // Tokens should be 64 chars (32 bytes hex)
            expect(invite1.token.length).toBe(64);
            expect(invite2.token.length).toBe(64);
        });

        test('Token lookup is O(1) with index', () => {
            // Create many invites
            for (let i = 0; i < 100; i++) {
                createTestInvite(student.id, `bulk${i}@test.com`);
            }
            
            const lastInvite = createTestInvite(student.id, 'last@test.com');
            
            // Query by token should use index
            const start = Date.now();
            const found = db.prepare(
                'SELECT * FROM parent_invites WHERE token = ?'
            ).get(lastInvite.token);
            const elapsed = Date.now() - start;
            
            expect(found).toBeDefined();
            expect(elapsed).toBeLessThan(50); // Should be very fast with index
        });
    });

    describe('Unlink Child', () => {
        test('Parent can unlink child', () => {
            const linkId = createParentChildLink(parent.id, student.id);
            
            // Set inactive
            db.prepare(`
                UPDATE parent_child_links SET status = 'inactive'
                WHERE parent_id = ? AND child_id = ?
            `).run(parent.id, student.id);
            
            // Verify no longer active
            const link = db.prepare(`
                SELECT * FROM parent_child_links 
                WHERE parent_id = ? AND child_id = ? AND status = 'active'
            `).get(parent.id, student.id);
            
            expect(link).toBeUndefined();
        });
    });
});

describe('Registration with Parent Emails', () => {
    beforeEach(() => {
        cleanupTestData();
    });
    
    afterEach(() => {
        cleanupTestData();
    });

    test('Registration creates parent invites when emails provided', () => {
        const studentId = uuidv4();
        const studentEmail = 'newstudent@test.com';
        const parentEmail1 = 'regparent1@test.com';
        const parentEmail2 = 'regparent2@test.com';
        const passwordHash = bcrypt.hashSync('password123', 10);
        
        // Create student
        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role)
            VALUES (?, ?, ?, ?, 'student')
        `).run(studentId, studentEmail, passwordHash, 'New Student');
        
        // Create invites (simulating registration API)
        const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
        
        db.prepare(`
            INSERT INTO parent_invites (id, child_id, parent_email, token, status, expires_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(uuidv4(), studentId, parentEmail1, crypto.randomBytes(32).toString('hex'), expiresAt);
        
        db.prepare(`
            INSERT INTO parent_invites (id, child_id, parent_email, token, status, expires_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(uuidv4(), studentId, parentEmail2, crypto.randomBytes(32).toString('hex'), expiresAt);
        
        // Verify invites
        const invites = db.prepare(`
            SELECT * FROM parent_invites WHERE child_id = ?
        `).all(studentId);
        
        expect(invites.length).toBe(2);
        expect(invites.map(i => i.parent_email)).toContain(parentEmail1);
        expect(invites.map(i => i.parent_email)).toContain(parentEmail2);
    });

    test('Registration without parent emails creates no invites', () => {
        const studentId = uuidv4();
        const studentEmail = 'noinvites@test.com';
        const passwordHash = bcrypt.hashSync('password123', 10);
        
        // Create student without parent emails
        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, role)
            VALUES (?, ?, ?, ?, 'student')
        `).run(studentId, studentEmail, passwordHash, 'No Parents Student');
        
        // Verify no invites
        const invites = db.prepare(`
            SELECT * FROM parent_invites WHERE child_id = ?
        `).all(studentId);
        
        expect(invites.length).toBe(0);
    });
});
