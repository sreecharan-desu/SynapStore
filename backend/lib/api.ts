import { Response } from "express";
import { ZodError } from "zod";

export const sendSuccess = (res: Response, message: string, data: any = null, code: number = 200) => {
  return res.status(code).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res: Response, error: string, code: number = 400, details: any = null) => {
  return res.status(code).json({
    success: false,
    error,
    details,
  });
};

export const handleZodError = (res: Response, err: ZodError) => {
  const details = err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return sendError(res, "Validation failed", 400, details);
};

export const handlePrismaError = (res: Response, err: any, entityName: string = "Record") => {
  console.error(`Prisma Error (${entityName}):`, err);
  if (err.code === "P2002") {
    return sendError(res, `${entityName} already exists`, 409);
  }
  if (err.code === "P2025") {
    return sendError(res, `${entityName} not found`, 404);
  }
  return sendError(res, "Internal database error", 500);
};

export const sendInternalError = (res: Response, err: any, customMessage: string = "Internal server error") => {
  console.error("Internal Error:", err);
  return sendError(res, customMessage, 500);
};
