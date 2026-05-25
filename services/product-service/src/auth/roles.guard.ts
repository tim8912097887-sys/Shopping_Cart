import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext) {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            "roles",
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles) return true;

        const req = context.switchToHttp().getRequest();
        const user = req.user;

        if (!user) return false;

        const hasRole = requiredRoles.includes(user.role);

        if (!hasRole) {
            throw new ForbiddenException("Insufficient permissions");
        }

        return true;
    }
}
