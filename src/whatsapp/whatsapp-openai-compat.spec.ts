import {
  applyOpenAiChatCompat,
  isNewOpenAiTokenModel,
  openAiRejectsCustomTemperature,
} from './whatsapp-openai-compat';

describe('whatsapp-openai-compat', () => {
  it('detecta gpt-5 / o1 como modelos nuevos', () => {
    expect(isNewOpenAiTokenModel('gpt-5-mini')).toBe(true);
    expect(isNewOpenAiTokenModel('gpt-5')).toBe(true);
    expect(isNewOpenAiTokenModel('o1-mini')).toBe(true);
    expect(isNewOpenAiTokenModel('gpt-4o-mini')).toBe(false);
    expect(isNewOpenAiTokenModel('gpt-4.1-mini')).toBe(false);
  });

  it('gpt-5 usa max_completion_tokens y sin temperature', () => {
    const body = applyOpenAiChatCompat(
      { model: 'gpt-5-mini', messages: [] },
      { model: 'gpt-5-mini', maxOutputTokens: 220, temperature: 0 },
    );
    expect(body.max_completion_tokens).toBe(220);
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(openAiRejectsCustomTemperature('gpt-5-mini')).toBe(true);
  });

  it('gpt-4o-mini usa max_tokens + temperature', () => {
    const body = applyOpenAiChatCompat(
      { model: 'gpt-4o-mini', messages: [] },
      { model: 'gpt-4o-mini', maxOutputTokens: 700, temperature: 0.2 },
    );
    expect(body.max_tokens).toBe(700);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.temperature).toBe(0.2);
  });
});
