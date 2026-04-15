const { shouldEscalate } = require('../server/webhook');

const triggers = 'complaint,refund,problem,tidak puas hati,kecewa';

describe('shouldEscalate', () => {
  test('returns false for normal message', () => {
    expect(shouldEscalate('How much for sofa cleaning?', triggers)).toEqual({ escalate: false, reason: '' });
  });

  test('returns true when trigger word present (English)', () => {
    const result = shouldEscalate('I want a refund', triggers);
    expect(result.escalate).toBe(true);
    expect(result.reason).toBe('Trigger word detected');
  });

  test('returns true when trigger word present (BM)', () => {
    const result = shouldEscalate('Saya tidak puas hati dengan servis', triggers);
    expect(result.escalate).toBe(true);
  });

  test('returns true when customer asks for human', () => {
    const result = shouldEscalate('Can I speak to a real person?', triggers);
    expect(result.escalate).toBe(true);
    expect(result.reason).toBe('Customer requested human');
  });

  test('is case-insensitive', () => {
    expect(shouldEscalate('I have a COMPLAINT', triggers).escalate).toBe(true);
  });
});
