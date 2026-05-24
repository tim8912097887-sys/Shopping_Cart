import express from "express";

export const initializeApp = async () => {
    const app = express();

    // Healthy check endpoint
    app.get("/health", (_req, res) => {
        res.status(200).json({
            status: "OK",
            service: "email-service",
            timestamp: new Date().toISOString(),
        });
    });

    return app;
};
