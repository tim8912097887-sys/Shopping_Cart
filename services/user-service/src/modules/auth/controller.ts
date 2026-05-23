import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "./types.js";
import { InvalidRefreshTokenError } from "./error.js";
import {
    Confirm2FAType,
    LoginUserType,
    RegisterUserType,
    Verify2FAType,
    VerifyAccountType,
} from "./schema.js";
import { clearRefreshCookie, setRefreshCookie } from "./util.js";
import { successResponse } from "#common/response/success.js";

export function authController(deps: { service: AuthService }) {
    const { service } = deps;

    // =========================
    // SIGNUP
    // =========================
    async function signup(
        req: FastifyRequest<{
            Body: RegisterUserType;
        }>,
        reply: FastifyReply,
    ) {
        const result = await service.signup(req.body);

        return okResponse(reply, 201, result);
    }

    // =========================
    // LOGIN
    // =========================
    async function login(
        req: FastifyRequest<{
            Body: LoginUserType;
        }>,
        reply: FastifyReply,
    ) {
        const result = await service.login({
            email: req.body.email,
            password: req.body.password,
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });

        if ("requires2FA" in result) {
            return reply.code(200).send({
                state: "success",
                data: result,
                error: null,
            });
        }

        setRefreshCookie(reply, result.refreshToken);

        const data = {
            accessToken: result.accessToken,
            sessionId: result.sessionId,
        };

        return okResponse(reply, 200, data);
    }

    // =========================
    // VERIFY ACCOUNT
    // =========================
    async function verifyAccount(
        req: FastifyRequest<{
            Body: VerifyAccountType;
        }>,
        reply: FastifyReply,
    ) {
        const result = await service.verifyAccount(req.body);

        return okResponse(reply, 200, result);
    }

    // =========================
    // SETUP 2FA
    // =========================
    async function setup2FA(req: FastifyRequest, reply: FastifyReply) {
        const result = await service.setup2FA(req.user.sub);

        return okResponse(reply, 200, result);
    }

    // =========================
    // CONFIRM 2FA
    // =========================
    async function confirm2FA(
        req: FastifyRequest<{
            Body: Confirm2FAType;
        }>,
        reply: FastifyReply,
    ) {
        const result = await service.confirm2FA({
            userId: req.user.sub,
            code: req.body.code,
        });

        return okResponse(reply, 200, result);
    }

    // =========================
    // VERIFY 2FA LOGIN
    // =========================
    async function verify2FA(
        req: FastifyRequest<{
            Body: Verify2FAType;
        }>,
        reply: FastifyReply,
    ) {
        const result = await service.verify2FA({
            userId: req.body.userId,
            code: req.body.code,
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });

        setRefreshCookie(reply, result.refreshToken);

        const data = {
            accessToken: result.accessToken,
            sessionId: result.sessionId,
        };

        return okResponse(reply, 200, data);
    }

    // =========================
    // DISABLE 2FA
    // =========================
    async function disable2FA(req: FastifyRequest, reply: FastifyReply) {
        const result = await service.disable2FA(req.user.sub);

        return okResponse(reply, 200, result);
    }

    // =========================
    // REFRESH
    // =========================
    async function refresh(req: FastifyRequest, reply: FastifyReply) {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            throw new InvalidRefreshTokenError();
        }

        const result = await service.refresh(refreshToken);

        setRefreshCookie(reply, result.refreshToken);

        const data = {
            accessToken: result.accessToken,
        };

        return okResponse(reply, 200, data);
    }

    // =========================
    // LOGOUT
    // =========================
    async function logout(req: FastifyRequest, reply: FastifyReply) {
        await service.logout(req.user.sid);

        clearRefreshCookie(reply);

        return okResponse(reply, 204, {});
    }

    // =========================
    // LOGOUT ALL
    // =========================
    async function logoutAll(req: FastifyRequest, reply: FastifyReply) {
        await service.logoutAll(req.user.sub);

        clearRefreshCookie(reply);

        return okResponse(reply, 204, {});
    }

    function okResponse<T>(reply: FastifyReply, code: number, data: T) {
        return reply.code(code).send(successResponse(data));
    }

    return {
        signup,
        login,
        setup2FA,
        confirm2FA,
        verify2FA,
        disable2FA,
        refresh,
        logout,
        logoutAll,
        verifyAccount,
    };
}
