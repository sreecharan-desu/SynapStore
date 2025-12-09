// src/realtime/socket.ts
import { Server as IOServer } from "socket.io";
import { verifyJwt } from "../lib/auth";
import prisma from "../lib/prisma";

export function initSocket(server: any) {
  const io = new IOServer(server, { path: "/realtime", cors: { origin: "*" } });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization
          ?.toString()
          .replace("Bearer ", "");
      if (!token) return next(new Error("unauthenticated"));

      const claims: any = verifyJwt(token);
      const userId = claims.sub ?? claims.id;
      if (!userId) return next(new Error("unauthenticated"));

      // optional: fetch minimal user row, check active
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, globalRole: true },
      });
      if (!u) return next(new Error("user_not_found"));

      (socket as any).user = { id: u.id, globalRole: u.globalRole };
      return next();
    } catch (err) {
      return next(new Error("invalid_token"));
    }
  });

  io.on("connection", (socket) => {
    // client should join rooms: store:<storeId> or user:<userId>
    socket.on("joinStore", async (storeId: string, cb: Function) => {
      // check access - simple check: userStoreRole exists or SUPERADMIN
      const u = (socket as any).user;
      const allowed = await prisma.userStoreRole.findFirst({
        where: { userId: u.id, storeId },
      });
      if (u.globalRole === "SUPERADMIN" || allowed) {
        socket.join(`store:${storeId}`);
        cb?.({ ok: true });
      } else cb?.({ ok: false, error: "forbidden" });
    });

    socket.on("joinUser", (userId: string) => {
      if (userId === (socket as any).user.id) socket.join(`user:${userId}`);
    });
  });

  return io;
}
