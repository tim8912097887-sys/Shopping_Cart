import { Module } from "@nestjs/common";
import { CatchAllController } from "./controllers/catch-all.controller.js";

@Module({
    controllers: [CatchAllController],
})
export class CommonModule {}
