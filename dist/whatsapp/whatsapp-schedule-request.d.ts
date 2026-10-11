export type ScheduleRequest = {
    date?: string;
    time?: string;
    clarification?: string;
};
export declare function parseScheduleRequest(text: string): ScheduleRequest | null;
export declare function upsertScheduleNotes(notes: string | undefined, request: ScheduleRequest): string;
