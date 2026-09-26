/**
 * Compatibilidad OpenAI chat/completions entre familias de modelos.
 * gpt-5* / o1 / o3: max_completion_tokens, sin temperature custom.
 * gpt-4* / 4o / mini clásicos: max_tokens + temperature.
 */

export function isNewOpenAiTokenModel(model: string): boolean {
  const m = (model || '').trim().toLowerCase();
  return (
    /^gpt-5/.test(m) ||
    /^o1/.test(m) ||
    /^o3/.test(m) ||
    /^o4/.test(m) ||
    m.includes('gpt-5')
  );
}

/** Modelos que rechazan temperature distinta del default. */
export function openAiRejectsCustomTemperature(model: string): boolean {
  return isNewOpenAiTokenModel(model);
}

/**
 * Aplica límite de salida y temperatura según el modelo.
 * Mutates `body` in place and returns it.
 */
export function applyOpenAiChatCompat(
  body: Record<string, unknown>,
  opts: {
    model: string;
    /** Límite de tokens de salida (completion). */
    maxOutputTokens?: number;
    temperature?: number;
  },
): Record<string, unknown> {
  const model = opts.model || String(body.model || 'gpt-4o-mini');
  body.model = model;

  const maxOut = opts.maxOutputTokens;
  if (maxOut != null && maxOut > 0) {
    if (isNewOpenAiTokenModel(model)) {
      body.max_completion_tokens = maxOut;
      delete body.max_tokens;
    } else {
      body.max_tokens = maxOut;
      delete body.max_completion_tokens;
    }
  }

  if (opts.temperature != null && !openAiRejectsCustomTemperature(model)) {
    body.temperature = opts.temperature;
  } else {
    delete body.temperature;
  }

  return body;
}
