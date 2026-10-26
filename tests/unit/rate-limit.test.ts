import { describe, expect, it } from "vitest";
import { IP_LIMIT, GLOBAL_LIMIT, evaluateLoginLimit, limitFor, retryAfterMinutes, unblockingFailureIndex } from "@/lib/auth/rate-limit";

describe("rate-limit 판정 (카운트는 현재 시도 포함)", () => {
  it("IP 실패 5회까지 허용", () => {
    expect(evaluateLoginLimit({ ipFailures: 5, globalFailures: 5, trustedIp: false }).blocked).toBe(false);
  });
  it("6번째 시도는 IP 사유로 차단", () => {
    expect(evaluateLoginLimit({ ipFailures: 6, globalFailures: 6, trustedIp: false })).toEqual({ blocked: true, reason: "ip" });
  });
  it("전체 30회까지 허용, 31번째 시도는 global 사유로 차단", () => {
    expect(evaluateLoginLimit({ ipFailures: 1, globalFailures: 30, trustedIp: false }).blocked).toBe(false);
    expect(evaluateLoginLimit({ ipFailures: 1, globalFailures: 31, trustedIp: false })).toEqual({ blocked: true, reason: "global" });
  });
});

describe("rate-limit 신뢰 IP 예외", () => {
  it("신뢰 IP는 전체 실패가 31이어도 통과", () => {
    expect(evaluateLoginLimit({ ipFailures: 1, globalFailures: 31, trustedIp: true }).blocked).toBe(false);
  });
  it("신뢰 IP도 IP 실패가 6이면 ip 사유로 차단", () => {
    expect(evaluateLoginLimit({ ipFailures: 6, globalFailures: 6, trustedIp: true })).toEqual({
      blocked: true,
      reason: "ip",
    });
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

describe("rate-limit 해제 기준 행", () => {
  it("범위별 한도", () => {
    expect(limitFor("ip")).toBe(IP_LIMIT);
    expect(limitFor("global")).toBe(GLOBAL_LIMIT);
  });
  it("실제 실패가 한도와 같으면 가장 오래된 행(0)이 만료될 때 해제", () => {
    expect(unblockingFailureIndex(5, 5)).toBe(0);
  });
  it("실제 실패가 한도보다 많으면 (실패 수 - 한도 + 1)번째 행", () => {
    expect(unblockingFailureIndex(7, 5)).toBe(2);
    expect(unblockingFailureIndex(32, 30)).toBe(2);
  });
  it("경쟁으로 한도 미만이면 0으로 클램프", () => {
    expect(unblockingFailureIndex(3, 5)).toBe(0);
  });
});
