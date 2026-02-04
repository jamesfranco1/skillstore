/**
 * API Tests
 * 
 * Run with: npm test
 * Requires server to be running or use supertest
 */

const assert = require('assert');

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Simple test runner
 */
async function runTests() {
  console.log('Running API tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test: GET /api/skills
  try {
    const res = await fetch(`${API_URL}/api/skills`);
    const data = await res.json();
    
    assert(res.ok, 'Response should be OK');
    assert(data.success === true, 'Should return success: true');
    assert(Array.isArray(data.data), 'Data should be array');
    assert(typeof data.stats === 'object', 'Should include stats');
    
    console.log('✓ GET /api/skills');
    passed++;
  } catch (err) {
    console.log('✗ GET /api/skills:', err.message);
    failed++;
  }
  
  // Test: GET /skills.json
  try {
    const res = await fetch(`${API_URL}/skills.json`);
    const data = await res.json();
    
    assert(res.ok, 'Response should be OK');
    assert(data.name === 'skillstore.md', 'Should have correct name');
    assert(Array.isArray(data.skills), 'Skills should be array');
    
    console.log('✓ GET /skills.json');
    passed++;
  } catch (err) {
    console.log('✗ GET /skills.json:', err.message);
    failed++;
  }
  
  // Test: GET /skills.md
  try {
    const res = await fetch(`${API_URL}/skills.md`);
    const text = await res.text();
    
    assert(res.ok, 'Response should be OK');
    assert(text.includes('# skillstore.md'), 'Should be markdown');
    
    console.log('✓ GET /skills.md');
    passed++;
  } catch (err) {
    console.log('✗ GET /skills.md:', err.message);
    failed++;
  }
  
  // Test: POST /api/skills
  try {
    const res = await fetch(`${API_URL}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Skill',
        creator: '@test-agent',
        tags: 'test, automated',
        price: 0.1,
        description: 'Automated test skill',
        content: '# Test\n\nThis is a test skill.'
      })
    });
    const data = await res.json();
    
    assert(res.status === 201, 'Should return 201 Created');
    assert(data.success === true, 'Should return success: true');
    assert(data.data.id, 'Should return skill ID');
    
    console.log('✓ POST /api/skills');
    passed++;
  } catch (err) {
    console.log('✗ POST /api/skills:', err.message);
    failed++;
  }
  
  // Test: POST /api/skills (validation)
  try {
    const res = await fetch(`${API_URL}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Incomplete Skill'
        // Missing required fields
      })
    });
    const data = await res.json();
    
    assert(res.status === 400, 'Should return 400 Bad Request');
    assert(data.success === false, 'Should return success: false');
    
    console.log('✓ POST /api/skills (validation)');
    passed++;
  } catch (err) {
    console.log('✗ POST /api/skills (validation):', err.message);
    failed++;
  }
  
  // Test: GET /api/skills/:id (not found)
  try {
    const res = await fetch(`${API_URL}/api/skills/nonexistent-id`);
    const data = await res.json();
    
    assert(res.status === 404, 'Should return 404 Not Found');
    assert(data.success === false, 'Should return success: false');
    
    console.log('✓ GET /api/skills/:id (not found)');
    passed++;
  } catch (err) {
    console.log('✗ GET /api/skills/:id (not found):', err.message);
    failed++;
  }
  
  // Summary
  console.log(`\nTests: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };


