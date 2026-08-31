export type WhatsappPaymentFlow = 'immediate' | 'mercadopago';
export type WhatsappPaymentMethodConfig = {
    id: string;
    enabled: boolean;
    label: string;
    keywords: string[];
    optionText: string;
    confirmReply?: string;
    flow: WhatsappPaymentFlow;
};
export declare const DEFAULT_PAYMENT_METHODS: WhatsappPaymentMethodConfig[];
export declare function sanitizePaymentMethodsInput(input: unknown, opts?: {
    allowMercadoPago?: boolean;
}): WhatsappPaymentMethodConfig[];
export declare function resolvePaymentMethods(stored: unknown, opts?: {
    allowMercadoPago?: boolean;
}): WhatsappPaymentMethodConfig[];
export declare function getEnabledPaymentMethods(methods: WhatsappPaymentMethodConfig[]): WhatsappPaymentMethodConfig[];
export declare function findPaymentMethodByText(text: string, methods: WhatsappPaymentMethodConfig[]): WhatsappPaymentMethodConfig | null;
export declare function isPaymentCapabilityQuestion(text: string): boolean;
export declare function buildPaymentOptionsPrompt(methods: WhatsappPaymentMethodConfig[], globalHint?: string | null): string;
export declare function paymentMethodLabel(methodId: string | undefined, methods: WhatsappPaymentMethodConfig[]): string;
export declare function applyPaymentReplyTemplate(tpl: string, vars: Record<string, string>): string;
