export type OutboundMediaKind = 'image' | 'document' | 'video' | 'audio';
export declare function classifyOutboundMedia(mimeType: string, size: number): {
    kind: OutboundMediaKind;
    maxBytes: number;
} | {
    error: string;
};
export declare function outboundMediaBodyLabel(params: {
    kind: OutboundMediaKind;
    caption?: string | null;
    filename?: string | null;
}): string;
export declare const OUTBOUND_MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,text/csv,video/mp4,audio/mpeg,audio/ogg,audio/aac";
