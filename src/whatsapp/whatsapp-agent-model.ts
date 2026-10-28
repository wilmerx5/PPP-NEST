/** Shared by runtime and read-only staging diagnostics: environment wins. */
export function resolveWhatsappAgentModel(
  configuredModel?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.WHATSAPP_AGENT_MODEL?.trim() || configuredModel || 'gpt-4o-mini';
}

/** Choose once, before proposing or executing tools; never replay applied actions. */
export function resolveWhatsappAgentRoute(
  configuredModel: string | undefined,
  userMessage: string,
  env: NodeJS.ProcessEnv = process.env,
): {model: string; reason: 'primary' | 'conditional' | 'distribution'} {
  const primary = resolveWhatsappAgentModel(configuredModel,env);
  const complex = env.WHATSAPP_AGENT_COMPLEX_MODEL?.trim();
  if (primary !== 'gpt-6-luna' || complex !== 'gpt-6.1-sol') return {model:primary,reason:'primary'};
  const text = userMessage.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/\b(?:si no|si (?:hay|tienen|venden)|en caso de que|siempre que|a menos que)\b/.test(text))
    return {model:complex,reason:'conditional'};
  if (/\b(?:cada (?:uno|una|persona)|reparte|repartir|mitad|un[oa] .+ (?:el|la) otr[oa])\b/.test(text))
    return {model:complex,reason:'distribution'};
  return {model:primary,reason:'primary'};
}
