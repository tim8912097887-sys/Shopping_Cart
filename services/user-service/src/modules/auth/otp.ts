import { AUTH_LIMITS } from "./constants.js";
import { TooManyRequestError } from "#common/errors/too-many-request.js";
import { CreateOtpInfo, GetOtpInfo } from "./types.js";
import { RedisClientType } from "redis";

export function otpRepository(cacheDb: RedisClientType) {
    function getOtpKey(getOtpInfo: GetOtpInfo) {
        return `${getOtpInfo.otpType}:${getOtpInfo.userId}`;
    }

    function getCooldownKey(getOtpInfo: GetOtpInfo) {
        return `${getOtpInfo.otpType}:cooldown:${getOtpInfo.userId}`;
    }

    async function createOtp(createOtpInfo: CreateOtpInfo) {
        const otpKey = getOtpKey(createOtpInfo);

        const cooldownKey = getCooldownKey(createOtpInfo);

        const cooldownExists = await cacheDb.exists(cooldownKey);

        if (cooldownExists) {
            throw new TooManyRequestError(
                "Please wait before requesting another verification code.",
            );
        }

        await cacheDb.hSet(otpKey, {
            code: createOtpInfo.code,
            attempt: "0",
            createdAt: new Date().toISOString(),
        });

        await cacheDb.expire(otpKey, AUTH_LIMITS.OTP_EXPIRE_SECONDS);

        await cacheDb.set(cooldownKey, "1", {
            expiration: {
                type: "EX",
                value: AUTH_LIMITS.OTP_RESEND_COOLDOWN_SECONDS,
            },
        });

        return "OK";
    }

    async function getOtp(getOtpInfo: GetOtpInfo) {
        const otpKey = getOtpKey(getOtpInfo);

        const result = await cacheDb.hGetAll(otpKey);

        if (Object.keys(result).length === 0) {
            return null;
        }

        return {
            code: result.code,
            attempt: Number(result.attempt),
            createdAt: result.createdAt,
        };
    }

    async function incrementOtpAttempt(getOtpInfo: GetOtpInfo) {
        const otpKey = getOtpKey(getOtpInfo);

        const attempt = await cacheDb.hIncrBy(otpKey, "attempt", 1);

        if (attempt >= AUTH_LIMITS.OTP_MAX_ATTEMPTS) {
            await cacheDb.del(otpKey);
        }

        return attempt;
    }

    async function deleteOtp(getOtpInfo: GetOtpInfo) {
        return await cacheDb.del(getOtpKey(getOtpInfo));
    }

    async function getCooldownTtl(getOtpInfo: GetOtpInfo) {
        return await cacheDb.ttl(getCooldownKey(getOtpInfo));
    }

    async function otpExists(getOtpInfo: GetOtpInfo) {
        return await cacheDb.exists(getOtpKey(getOtpInfo));
    }

    return {
        getOtpKey,
        getCooldownKey,
        createOtp,
        getOtp,
        incrementOtpAttempt,
        deleteOtp,
        getCooldownTtl,
        otpExists,
    };
}
