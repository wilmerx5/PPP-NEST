export declare class CreateAddressDto {
    label: string;
    address: string;
    isDefault?: boolean;
    type?: 'home' | 'work' | 'other';
    notes?: string;
}
