/** Shared by runtime and read-only staging diagnostics: environment wins. */
export function resolveWhatsappAgentModel(
  configuredModel?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.WHATSAPP_AGENT_MODEL?.trim() || configuredModel || 'gpt-4o-mini';
}
