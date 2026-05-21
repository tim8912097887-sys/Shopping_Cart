import { compare, genSalt, hash } from "bcrypt-ts";
import { FastifyReply } from "fastify";
import crypto from "node:crypto";
import QRCode from "qrcode";

export const hashPassword = async (password: string, saltRound = 10) => {
    const salt = await genSalt(saltRound);
    const hashedPassword = await hash(password, salt);
    return hashedPassword;
};

export const comparePassword = async (
    password: string,
    hashedPassword: string,
) => {
    const isMatch = await compare(password, hashedPassword);
    return isMatch;
};

export function generateRefreshToken(sessionId: string) {
    const token = crypto.randomBytes(64).toString("hex");
    return sessionId + "." + token;
}

export async function hashRefreshToken(token: string, saltRound = 10) {
    return hashPassword(token, saltRound);
}

export async function compareRefreshToken(token: string, hash: string) {
    return comparePassword(token, hash);
}

export async function generateQrCode(otpAuthUrl: string) {
    return QRCode.toDataURL(otpAuthUrl, {
        width: 320,
        margin: 4,
        errorCorrectionLevel: "M",
    });
}

export function setRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie("refreshToken", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 7 day
    });
}
export function clearRefreshCookie(reply: FastifyReply) {
    reply.clearCookie("refreshToken", { path: "/" });
}
