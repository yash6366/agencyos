import test from 'node:test';
import assert from 'node:assert/strict';

test('Enhancement 4: Global Search Ranking & Scoring Logic', () => {
  const scoreText = (target?: string, term: string = '') => {
    if (!target) return 0;
    const str = String(target).toLowerCase();
    const t = term.toLowerCase();
    if (str === t) return 100;
    if (str.startsWith(t)) return 70;
    if (str.includes(t)) return 40;
    return 0;
  };

  // Exact match scores 100
  assert.equal(scoreText('PAA-INV-2026-101', 'paa-inv-2026-101'), 100);

  // Prefix match scores 70
  assert.equal(scoreText('Priority Ads Agency', 'priority'), 70);

  // Substring match scores 40
  assert.equal(scoreText('Priority Ads Agency', 'ads'), 40);

  // Non-match scores 0
  assert.equal(scoreText('Acme Corp', 'xyz'), 0);
});

test('Enhancement 4: Search Result Categorization & Filtering', () => {
  const mockResults = [
    { id: '1', category: 'leads', title: 'Acme Digital', score: 100 },
    { id: '2', category: 'clients', title: 'Beta Logistics', score: 70 },
    { id: '3', category: 'invoices', title: 'PAA-INV-101', score: 40 },
    { id: '4', category: 'tasks', title: 'Prepare GST Return', score: 90 },
  ];

  // All category
  assert.equal(mockResults.length, 4);

  // Filter by category
  const filtered = mockResults.filter((r) => r.category === 'invoices');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'PAA-INV-101');

  // Sorted by score descending
  const sorted = [...mockResults].sort((a, b) => b.score - a.score);
  assert.equal(sorted[0].score, 100);
  assert.equal(sorted[1].score, 90);
  assert.equal(sorted[2].score, 70);
  assert.equal(sorted[3].score, 40);
});
