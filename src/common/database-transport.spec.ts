import { databaseTransport, assertStagingDatabase } from './database-transport';
describe('Database transport and staging target',()=> {
  it('preserves the existing default when TLS was not configured',()=>expect(databaseTransport()).toEqual({}));
  it('requires certificate verification when TLS is enabled',()=>expect(databaseTransport('true')).toEqual({ssl:{rejectUnauthorized:true}}));
  it('preserves a supplied CA and restores encoded newlines',()=>expect(databaseTransport('true','first\\nsecond')).toEqual({ssl:{rejectUnauthorized:true,ca:'first\nsecond'}}));
  it('does not silently downgrade a misspelled TLS flag',()=>expect(()=>databaseTransport('treu')).toThrow('DB_SSL_ENABLED'));
  const target={staging:'true',host:'staging.example.invalid',database:'ppp_staging',expectedHost:'staging.example.invalid',expectedDatabase:'ppp_staging',tls:true};
  it('accepts only the declared staging target over TLS',()=>expect(()=>assertStagingDatabase(target)).not.toThrow());
  it.each([{database:'ppp_production'},{expectedDatabase:''},{host:'production.example.invalid'},{tls:false}])(
    'rejects an unverified staging connection', mismatch=>expect(()=>assertStagingDatabase({...target,...mismatch})).toThrow('Staging requires'));
});
