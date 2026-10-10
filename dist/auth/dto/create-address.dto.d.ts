export declare class CreateAddressDto {
    label: string;
    address: string;
    isDefault?: boolean;
    type?: 'home' | 'work' | 'other';
    notes?: string;
    lat?: number;
    lng?: number;
    locationConfirmed?: boolean;
}
export declare class GeocodeAddressDto {
    address: string;
}
export declare class ReverseGeocodeDto {
    lat: number;
    lng: number;
}
