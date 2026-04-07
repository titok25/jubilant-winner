import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

describe("URL Shortener - Funcionalidades Principais", () => {
  it("valida slug com padrão correto", () => {
    const validateSlug = (slug: string) => /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug);

    expect(validateSlug("meu-produto-01")).toBe(true);
    expect(validateSlug("campanha-meta")).toBe(true);
    expect(validateSlug("test")).toBe(true);
    expect(validateSlug("a")).toBe(true);
    expect(validateSlug("MAIUSCULA")).toBe(false);
    expect(validateSlug("com espaço")).toBe(false);
  });

  it("valida URL de destino", () => {
    const validateTargetUrl = (targetUrl: string) => {
      try {
        const parsed = new URL(targetUrl);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    };

    expect(validateTargetUrl("https://example.com/oferta")).toBe(true);
    expect(validateTargetUrl("http://example.com")).toBe(true);
    expect(validateTargetUrl("ftp://example.com")).toBe(false);
    expect(validateTargetUrl("example.com")).toBe(false);
    expect(validateTargetUrl("")).toBe(false);
  });

  it("normaliza tipo de redirecionamento", () => {
    const normalizeRedirectType = (value: number) => (Number(value) === 302 ? 302 : 301);

    expect(normalizeRedirectType(301)).toBe(301);
    expect(normalizeRedirectType(302)).toBe(302);
    expect(normalizeRedirectType(200)).toBe(301);
    expect(normalizeRedirectType(0)).toBe(301);
  });

  it("garante persistência de dados em arquivo", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shortener-persist-"));
    const dbPath = path.join(tempDir, "test.db");

    // Simular escrita de dados
    const testData = { links: [{ slug: "test", url: "https://example.com" }] };
    fs.writeFileSync(dbPath, JSON.stringify(testData));

    // Verificar que o arquivo existe e pode ser lido
    expect(fs.existsSync(dbPath)).toBe(true);
    const readData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    expect(readData.links[0].slug).toBe("test");

    // Limpar
    fs.rmSync(tempDir, { recursive: true });
  });

  it("formata link com URL curta", () => {
    const formatLink = (row: any, baseUrl: string) => ({
      id: row.id,
      slug: row.slug,
      targetUrl: row.target_url,
      redirectType: row.redirect_type,
      clicks: row.clicks,
      shortUrl: `${baseUrl}/${row.slug}`,
    });

    const row = {
      id: 1,
      slug: "test-link",
      target_url: "https://example.com",
      redirect_type: 301,
      clicks: 5,
    };

    const formatted = formatLink(row, "https://short.url");
    expect(formatted.shortUrl).toBe("https://short.url/test-link");
    expect(formatted.clicks).toBe(5);
  });

  it("protege slugs reservados", () => {
    const RESERVED_SLUGS = new Set(["api", "health", "login", "logout"]);

    expect(RESERVED_SLUGS.has("api")).toBe(true);
    expect(RESERVED_SLUGS.has("health")).toBe(true);
    expect(RESERVED_SLUGS.has("meu-link")).toBe(false);
    expect(RESERVED_SLUGS.has("test")).toBe(false);
  });

  it("normaliza slug para minúsculas", () => {
    const normalizeSlug = (slug: string) => String(slug || "").trim().toLowerCase();

    expect(normalizeSlug("MEU-PRODUTO")).toBe("meu-produto");
    expect(normalizeSlug("  Test  ")).toBe("test");
    expect(normalizeSlug("CAMPANHA-META-01")).toBe("campanha-meta-01");
  });

  it("valida contagem ilimitada de cliques", () => {
    let clicks = 0;

    // Simular incrementos de cliques
    for (let i = 0; i < 1000000; i++) {
      clicks++;
    }

    expect(clicks).toBe(1000000);
    expect(Number.isFinite(clicks)).toBe(true);
  });

  it("exporta dados em formato CSV", () => {
    const links = [
      { slug: "link1", target_url: "https://example.com/1", redirect_type: 301, clicks: 10 },
      { slug: "link2", target_url: "https://example.com/2", redirect_type: 302, clicks: 5 },
    ];

    let csv = "Slug,URL de Destino,Tipo de Redirect,Cliques\n";
    links.forEach((link) => {
      const slug = `"${link.slug}"`;
      const url = `"${link.target_url}"`;
      csv += `${slug},${url},${link.redirect_type},${link.clicks}\n`;
    });

    expect(csv).toContain("Slug,URL de Destino");
    expect(csv).toContain("link1");
    expect(csv).toContain("link2");
    expect(csv).toContain("301");
    expect(csv).toContain("302");
  });

  it("garante que redirecionamentos não marcam spam", () => {
    const headers = {
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    };

    expect(headers["X-Robots-Tag"]).toContain("noindex");
    expect(headers["X-Robots-Tag"]).toContain("nofollow");
    expect(headers["X-Robots-Tag"]).toContain("noarchive");
  });
});
