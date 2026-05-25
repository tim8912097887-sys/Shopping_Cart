import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { TokenVerifierService } from "./token-verifier.service.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly tokenVerifier: TokenVerifierService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();

        const auth = req.headers.authorization;

        if (!auth?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing bearer token");
        }

        const token = auth.split(" ")[1];

        const payload = await this.tokenVerifier.verifyAccessToken(token);

        req.user = payload;

        return true;
    }
}
