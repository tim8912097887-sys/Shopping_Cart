import { Module } from "@nestjs/common";
import { TokenVerifierService } from "./token-verifier.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
    providers: [TokenVerifierService, JwtAuthGuard, RolesGuard],
    exports: [TokenVerifierService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
