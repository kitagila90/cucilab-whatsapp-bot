const Anthropic = require('@anthropic-ai/sdk');

async function generateReply(claudeApiKey, knowledgeBase, conversationHistory) {
  const client = new Anthropic({ apiKey: claudeApiKey });

  const systemPrompt = `You are the Cucilab WhatsApp assistant. Cucilab is a professional cleaning service in Malaysia.

KNOWLEDGE BASE:
${knowledgeBase}

INSTRUCTIONS:
- Answer only based on the knowledge base above
- Reply in the same language the customer uses (English or Bahasa Malaysia)
- Be friendly, concise, and professional
- Sign off as "Cucilab Assistant" only on the very first message in the conversation
- If you cannot answer confidently from the knowledge base, set escalate to true

You MUST respond with valid JSON only, no other text:
{ "reply": "your reply here", "escalate": false, "reason": "" }`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: conversationHistory
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    return { reply: text, escalate: false, reason: '' };
  }
}

module.exports = { generateReply };
