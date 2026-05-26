import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
    getHealth(): { status: string; service: string; timestamp: string } {
        return {
            status: "OK",
            service: "product-service",
            timestamp: new Date().toISOString(),
        };
    }
}
