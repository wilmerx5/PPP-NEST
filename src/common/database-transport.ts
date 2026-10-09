export function databaseTransport(sslFlag?: string, ca?: string) {
  const flag=(sslFlag || '').trim().toLowerCase();
  if (!['','true','false','1','0'].includes(flag)) throw new Error('Invalid DB_SSL_ENABLED');
  if (!['true','1'].includes(flag)) return {};
  return {ssl:{rejectUnauthorized:true,...(ca?.trim() ? {ca:ca.replace(/\\n/g,'\n')} : {})}};
}

export function assertStagingDatabase(input: {
  staging?:string; host?:string; database?:string; expectedHost?:string; expectedDatabase?:string; tls:boolean;
}) {
  if (input.staging !== 'true') return;
  if (!input.expectedHost || !input.expectedDatabase || input.host!==input.expectedHost ||
    input.database!==input.expectedDatabase || !input.tls) {
    throw new Error('Staging requires matching STAGING_EXPECTED_DB_HOST/DATABASE and verified DB TLS');
  }
}
