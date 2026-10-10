export declare function databaseTransport(sslFlag?: string, ca?: string): {
    ssl?: undefined;
} | {
    ssl: {
        ca?: string | undefined;
        rejectUnauthorized: boolean;
    };
};
export declare function assertStagingDatabase(input: {
    staging?: string;
    host?: string;
    database?: string;
    expectedHost?: string;
    expectedDatabase?: string;
    tls: boolean;
}): void;
