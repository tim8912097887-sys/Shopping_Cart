import fp from "fastify-plugin";
import cookie from "@fastify/cookie";

export default fp(
    async function (app) {
        await app.register(cookie);
    },
    {
        name: "cookie",
    },
);
