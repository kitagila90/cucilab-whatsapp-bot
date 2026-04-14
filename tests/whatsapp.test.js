const { verifyWebhookSignature, sendMessage } = require('../server/whatsapp');
const crypto = require('crypto');

describe('whatsapp', () => {
  describe('verifyWebhookSignature', () => {
    test('returns true for valid signature', () => {
      const secret = 'mysecret';
      const body = '{"test":true}';
      const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
      expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    });

    test('returns false for invalid signature', () => {
      expect(verifyWebhookSignature('body', 'sha256=wrong', 'secret')).toBe(false);
    });

    test('returns false when signature is missing', () => {
      expect(verifyWebhookSignature('body', null, 'secret')).toBe(false);
    });

    test('returns false when appSecret is missing', () => {
      expect(verifyWebhookSignature('body', 'sha256=abc', '')).toBe(false);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] })
      });
    });

    test('calls Meta API with correct payload', async () => {
      await sendMessage('phone_id', 'token', '60123456789', 'Hello!');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/phone_id/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Authorization': 'Bearer token' }),
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: '60123456789',
            type: 'text',
            text: { body: 'Hello!' }
          })
        })
      );
    });

    test('throws on API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, text: async () => 'Unauthorized' });
      await expect(sendMessage('id', 'bad_token', '601', 'Hi')).rejects.toThrow('WhatsApp API error');
    });
  });
});
