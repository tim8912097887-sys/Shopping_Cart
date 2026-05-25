import { All, Controller, NotFoundException } from "@nestjs/common";

@Controller()
export class CatchAllController {
    @All("*")
    handleNotFound() {
        throw new NotFoundException("Route not found");
    }
}
