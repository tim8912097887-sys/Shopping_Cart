import * as OTPAuth from "otpauth";

type TotpSecret = string;

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ALGORITHM = "SHA1";

export function twoFactorService() {
    function createTotp(secret: TotpSecret) {
        return new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(secret),
            digits: DEFAULT_DIGITS,
            period: DEFAULT_PERIOD,
            algorithm: DEFAULT_ALGORITHM,
        });
    }

    function generateSecret(): TotpSecret {
        return new OTPAuth.Secret({
            size: 20,
        }).base32;
    }

    function generateOtpAuthUrl(input: {
        email: string;
        secret: TotpSecret;
        issuer: string;
    }) {
        return new OTPAuth.TOTP({
            issuer: input.issuer,
            label: input.email,
            secret: OTPAuth.Secret.fromBase32(input.secret),
            digits: DEFAULT_DIGITS,
            period: DEFAULT_PERIOD,
            algorithm: DEFAULT_ALGORITHM,
        }).toString();
    }

    function generateCode(secret: TotpSecret) {
        return createTotp(secret).generate();
    }

    function verifyTotp(secret: TotpSecret, code: string): boolean {
        const delta = createTotp(secret).validate({
            token: code,
            window: 1,
        });

        return delta !== null;
    }

    return {
        generateSecret,
        generateOtpAuthUrl,
        generateCode,
        verifyTotp,
    };
}
