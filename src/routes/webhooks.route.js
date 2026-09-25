import express from "express";
import { webhookCheck } from "../controllers/webhook.controller.js";

const webhookRouter = express.Router();

webhookRouter.post("/",webhookCheck);

export default webhookRouter;