export declare class CreatePhoneDto {
    number: string;
    label: string;
    isDefault?: boolean;
    type?: 'mobile' | 'home' | 'work' | 'other';
}
