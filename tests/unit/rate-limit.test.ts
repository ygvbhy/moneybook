import { describe, expect, it } from "vitest";
import { evaluateLoginLimit, retryAfterMinutes } from "@/lib/auth/rate-limit";

describe("rate-limit 판정 (카운트는 현재 시도 포함)", () => {
  it("IP 실패 5회까지 허용", () => {
    expect(evaluateLoginLimit({ ipFailures: 5, globalFailures: 5 }).blocked).toBe(false);
  });
  it("6번째 시도는 IP 사유로 차단", () => {
    expect(evaluateLoginLimit({ ipFailures: 6, globalFailures: 6 })).toEqual({ blocked: true, reason: "ip" });
  });
  it("전체 30회까지 허용, 31번째 시도는 global 사유로 차단", () => {
    expect(evaluateLoginLimit({ ipFailures: 1, globalFailures: 30 }).blocked).toBe(false);
    expect(evaluateLoginLimit({ ipFailures: 1, globalFailures: 31 })).toEqual({ blocked: true, reason: "global" });
  });
});

describe("rate-limit 창 만료 계산", () => {
  const oldest = new Date("2026-10-21T00:00:00Z");
  it("방금 실패하면 15분", () => {
    expect(retryAfterMinutes(oldest, oldest)).toBe(15);
  });
  it("14분 30초 경과 -> 1분 (올림)", () => {
    expect(retryAfterMinutes(oldest, new Date(oldest.getTime() + 14.5 * 60_000))).toBe(1);
  });
  it("15분이 지나면 최소 1분으로 클램프(이미 창 밖이면 호출측이 해제로 판단)", () => {
    expect(retryAfterMinutes(oldest, new Date(oldest.getTime() + 16 * 60_000))).toBe(1);
  });
  it("5분 경과 -> 10분", () => {
    expect(retryAfterMinutes(oldest, new Date(oldest.getTime() + 5 * 60_000))).toBe(10);
  });
});
