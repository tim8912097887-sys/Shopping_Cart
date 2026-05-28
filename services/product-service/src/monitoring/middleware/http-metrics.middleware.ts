import { Injectable, NestMiddleware } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Response, Request, NextFunction } from "express";
import { Counter } from "prom-client";

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
    constructor(
        @InjectMetric("http_requests_total")
        private readonly requestCounter: Counter<string>,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        res.on("finish", () => {
            this.requestCounter.inc({
                method: req.method,
                route: req.route?.path || req.path,
                status: res.statusCode.toString(),
            });
        });

        next();
    }
}
