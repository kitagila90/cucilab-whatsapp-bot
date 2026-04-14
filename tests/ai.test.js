jest.mock('@anthropic-ai/sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { generateReply } = require('../server/ai');

const mockCreate = jest.fn();
Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

describe('generateReply', () => {
  const history = [{ role: 'user', content: 'How much for sofa cleaning?' }];
  const kb = 'Sofa cleaning: RM150 for 2-seater, RM200 for 3-seater.';

  beforeEach(() => { jest.clearAllMocks(); });

  test('returns reply and escalate:false when AI answers', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '{"reply":"Sofa cleaning costs RM150 for 2-seater.","escalate":false,"reason":""}' }]
    });
    const result = await generateReply('sk-test', kb, history);
    expect(result.reply).toBe('Sofa cleaning costs RM150 for 2-seater.');
    expect(result.escalate).toBe(false);
  });

  test('returns escalate:true when AI cannot answer', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '{"reply":"","escalate":true,"reason":"Not in knowledge base"}' }]
    });
    const result = await generateReply('sk-test', kb, history);
    expect(result.escalate).toBe(true);
    expect(result.reason).toBe('Not in knowledge base');
  });

  test('passes correct model and system prompt to Anthropic', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '{"reply":"ok","escalate":false,"reason":""}' }]
    });
    await generateReply('sk-test', kb, history);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      system: expect.stringContaining(kb),
      messages: history
    }));
  });

  test('handles malformed JSON by returning text as reply', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'Sofa is RM150' }] });
    const result = await generateReply('sk-test', kb, history);
    expect(result.reply).toBe('Sofa is RM150');
    expect(result.escalate).toBe(false);
  });
});
