// =============================================================================
// Axios HTTP client for the ACP API.
// Uses a request interceptor so the API key is read fresh on every request,
// allowing agent switches without restarting the process.
// =============================================================================

import axios from "axios";
import dotenv from "dotenv";
import { loadApiKey } from "./config.js";

dotenv.config();

loadApiKey();

const client = axios.create({
  baseURL: process.env.ACP_API_URL || "https://claw-api.virtuals.io",
});

client.interceptors.request.use((config) => {
  const key = process.env.LITE_AGENT_API_KEY;
  if (key) {
    config.headers["x-api-key"] = key;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const data = error.response.data;
      const message = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(message.slice(0, 2000));
    }
    throw error;
  }
);

export default client;
