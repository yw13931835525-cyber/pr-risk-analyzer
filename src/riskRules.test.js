const { RISK_RULES } = require('./riskRules');

describe('RISK_RULES', () => {
  test('should have unique rule IDs', () => {
    const ids = RISK_RULES.map(r => r.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds.length).toBe(ids.length);
  });

  test('all rules should have required fields', () => {
    for (const rule of RISK_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(['critical', 'high', 'medium', 'low']).toContain(rule.severity);
      expect(rule.description).toBeTruthy();
      expect(rule.recommendation).toBeTruthy();
      expect(rule.emoji).toBeTruthy();
    }
  });

  test('should have at least one rule per category', () => {
    const categories = RISK_RULES.map(r => r.category);
    const uniqueCategories = [...new Set(categories)];
    expect(uniqueCategories.length).toBeGreaterThanOrEqual(6);
  });

  test('should have critical and high severity rules for database', () => {
    const dbRules = RISK_RULES.filter(r => r.category === 'database');
    expect(dbRules.length).toBeGreaterThan(0);
  });

  test('should have critical severity security rules', () => {
    const criticalSecurityRules = RISK_RULES.filter(
      r => r.category === 'security' && r.severity === 'critical'
    );
    expect(criticalSecurityRules.length).toBeGreaterThan(0);
  });
});
