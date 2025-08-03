import express, { Router } from "express";
import {
  createRoomController,
  getAllRoomController,
  getRoomReportController,
  joinRoomController,
} from "../controllers/Room.controller";
import { isAuthenticated } from "../middlwares/Auth.middleware";

const router: Router = express.Router();

router.use(isAuthenticated);

router.route("/create").post(createRoomController);
router.route("/join").post(joinRoomController);
router.route("/get-all").get(getAllRoomController);
router.route("/:roomId/report").get(getRoomReportController);

export default router;
