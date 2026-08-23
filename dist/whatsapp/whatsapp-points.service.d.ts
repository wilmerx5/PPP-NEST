import { PointsService } from '../auth/services/points.service';
import type { WhatsappCartItem } from './types/whatsapp-session.types';
import { type PointsHelpContext } from './whatsapp-points-help';
export declare class WhatsappPointsService {
    private readonly pointsService;
    constructor(pointsService: PointsService);
    extractTwelveCharCode(text: string): string | null;
    isPointsTopic(text: string): boolean;
    isBalanceIntent(text: string): boolean;
    isRedeemIntent(text: string): boolean;
    isRegisterIntent(text: string): boolean;
    isPremioApplyIntent(text: string): boolean;
    isRemovePremioIntent(text: string): boolean;
    cartHasHalfChicken(cart: WhatsappCartItem[]): boolean;
    getAvailablePoints(userId: string | null | undefined): Promise<number | null>;
    buildHelpContext(websiteUrl?: string | null, linkedUserName?: string | null, availablePoints?: number | null): PointsHelpContext;
    buildOverviewMessage(ctx: PointsHelpContext): string;
    buildRegisterHelp(ctx: PointsHelpContext): string;
    buildRedeemHelp(available: number): string;
    registerPointForUser(userId: string, code: string): Promise<{
        ok: true;
        available: number;
    } | {
        ok: false;
        message: string;
    }>;
    redeemNinePoints(userId: string): Promise<{
        ok: true;
        code: string;
        expiresAt: Date | null;
        availableAfter: number;
    } | {
        ok: false;
        message: string;
    }>;
    validatePremioCode(code: string, linkedUserId?: string | null): Promise<{
        ok: true;
        code: string;
        expiresAt: Date | null;
    } | {
        ok: false;
        message: string;
    }>;
    tryRegisterOnly(userId: string | null | undefined, code: string): Promise<{
        handled: true;
        message: string;
    } | {
        handled: false;
    }>;
    private mapPointsError;
}
