import http from "k6/http";
import { check, sleep } from "k6";

// Task 8.2 load test: tutor discovery/search, the highest-traffic read
// endpoint (every session hits it, most sessions never go past it). Run
// against a live local server (`pnpm dev` in services/api, real
// Postgres/Redis via docker-compose) - not a production-capacity claim,
// this environment is a single dev-machine instance, not sized
// infrastructure. The goal is catching real regressions (missing
// indexes, N+1 queries, no caching) under concurrency, not certifying a
// specific production user count.
export const options = {
  scenarios: {
    search: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 },
        { duration: "20s", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

const API_URL = __ENV.API_URL || "http://localhost:4000/api";
const CITIES = ["Jakarta Selatan", "Bandung", "Surabaya", "Yogyakarta", "Medan"];

export default function () {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const res = http.get(`${API_URL}/tutors?limit=12&city=${encodeURIComponent(city)}`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "returns a data array": (r) => Array.isArray(r.json("data")),
  });
  sleep(0.5);
}
