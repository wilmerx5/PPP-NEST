import { BusinessService } from './business.service';
export declare class BusinessController {
    private readonly businessService;
    constructor(businessService: BusinessService);
    getStatus(): Promise<import("./business.service").BusinessStatus>;
    getWebDeliveryConfig(): Promise<import("./business.service").WebDeliveryConfig>;
}
