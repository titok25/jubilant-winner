import { describe, it, expect } from "vitest";

describe("Cloaker Device Detection", () => {
  function detectDeviceAndBrowser(userAgent: string): string {
    const ua = String(userAgent).toLowerCase();
    if (ua.includes("instagram")) return "instagram";
    if (ua.includes("fban") || ua.includes("fbav") || ua.includes("facebook")) return "facebook";
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|phone|windows phone/i;
    return mobileRegex.test(ua) ? "mobile" : "desktop";
  }

  it("should detect Instagram mobile browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 Instagram 123.0.0.1.0";
    expect(detectDeviceAndBrowser(ua)).toBe("instagram");
  });

  it("should detect Facebook mobile browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 FBAN/FBAV";
    expect(detectDeviceAndBrowser(ua)).toBe("facebook");
  });

  it("should detect mobile device", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15";
    expect(detectDeviceAndBrowser(ua)).toBe("mobile");
  });

  it("should detect Android mobile device", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36";
    expect(detectDeviceAndBrowser(ua)).toBe("mobile");
  });

  it("should detect desktop browser", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124";
    expect(detectDeviceAndBrowser(ua)).toBe("desktop");
  });

  it("should detect desktop Mac browser", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36";
    expect(detectDeviceAndBrowser(ua)).toBe("desktop");
  });

  it("should handle empty user agent as desktop", () => {
    expect(detectDeviceAndBrowser("")).toBe("desktop");
  });

  it("should prioritize Instagram detection over mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 Instagram";
    expect(detectDeviceAndBrowser(ua)).toBe("instagram");
  });

  it("should prioritize Facebook detection over mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 FBAV/123.0.0.1";
    expect(detectDeviceAndBrowser(ua)).toBe("facebook");
  });
});

describe("Cloaker URL Routing Logic", () => {
  function resolveTargetUrl(
    defaultUrl: string,
    cloaker: { desktop_url?: string; mobile_url?: string; instagram_url?: string; facebook_url?: string } | null,
    deviceType: string
  ): string {
    if (!cloaker) return defaultUrl;

    if (deviceType === "instagram" && cloaker.instagram_url) return cloaker.instagram_url;
    if (deviceType === "facebook" && cloaker.facebook_url) return cloaker.facebook_url;
    if (deviceType === "mobile" && cloaker.mobile_url) return cloaker.mobile_url;
    if (deviceType === "desktop" && cloaker.desktop_url) return cloaker.desktop_url;

    return defaultUrl;
  }

  it("should use default URL when no cloaker configured", () => {
    const result = resolveTargetUrl("https://default.com", null, "mobile");
    expect(result).toBe("https://default.com");
  });

  it("should route desktop traffic to desktop URL", () => {
    const cloaker = {
      desktop_url: "https://desktop.com",
      mobile_url: "https://mobile.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "desktop");
    expect(result).toBe("https://desktop.com");
  });

  it("should route mobile traffic to mobile URL", () => {
    const cloaker = {
      desktop_url: "https://desktop.com",
      mobile_url: "https://mobile.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "mobile");
    expect(result).toBe("https://mobile.com");
  });

  it("should route Instagram traffic to Instagram URL", () => {
    const cloaker = {
      desktop_url: "https://desktop.com",
      instagram_url: "https://instagram.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "instagram");
    expect(result).toBe("https://instagram.com");
  });

  it("should route Facebook traffic to Facebook URL", () => {
    const cloaker = {
      mobile_url: "https://mobile.com",
      facebook_url: "https://facebook.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "facebook");
    expect(result).toBe("https://facebook.com");
  });

  it("should fallback to default URL when specific route not configured", () => {
    const cloaker = {
      desktop_url: "https://desktop.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "mobile");
    expect(result).toBe("https://default.com");
  });

  it("should handle partial cloaker configuration", () => {
    const cloaker = {
      instagram_url: "https://instagram.com",
    };
    const result = resolveTargetUrl("https://default.com", cloaker, "desktop");
    expect(result).toBe("https://default.com");
  });
});
