import { io } from "socket.io-client";

// Create the socket ONLY once
// 'autoConnect: false' prevents it from connecting automatically before you are ready
export const BACKEND_URL = import.meta.env.PROD ? 'https://sids-worldchat.onrender.com' : ''; // for PROD vs DEV environment
export const socket = io(BACKEND_URL || "http://localhost:5000", {
    autoConnect: false,
    transports: ['websocket']
});