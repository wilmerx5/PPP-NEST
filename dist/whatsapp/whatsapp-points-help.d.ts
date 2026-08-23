export declare const POINTS_REQUIRED_FOR_PRIZE = 9;
export declare const POINTS_PRODUCT_CODES: {
    readonly individual: readonly [1, 99, 4, 98, 89];
    readonly pair: readonly [2, 5];
};
export type PointsHelpContext = {
    websiteUrl?: string | null;
    linkedUserName?: string | null;
    availablePoints?: number | null;
};
export declare function buildPointsHelpUrl(websiteUrl?: string | null): string | null;
export declare function buildPointsOverviewReply(ctx: PointsHelpContext): string;
export declare function buildRegisterPointSteps(ctx: PointsHelpContext): string;
export declare function buildRedeemSteps(available: number): string;
export declare function formatPremioAppliedNote(code: string, expiresAt?: Date | null): string;
export declare function formatCartNeedsHalfChickenForPremio(): string;
