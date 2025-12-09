// src/workers/socketSingleton.ts
import { Server as IOServer } from "socket.io";
let io: IOServer | null = null;
export function setIo(server: IOServer) {
  io = server;
}
export function ioSingleton(): IOServer {
  if (!io) throw new Error("io not initialized");
  return io;
}
