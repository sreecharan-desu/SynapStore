// src/routes/v1/suppliers.global.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { z } from "zod";
import { RequestWithUser } from "../../../middleware/store";

const router = Router();

router.all("*", (req: Request, res: Response) => {
  res.redirect(302, "/supplier-requests");
});


export default router;
