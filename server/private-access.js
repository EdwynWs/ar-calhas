import { isIP } from "node:net";
export const normalizeIP = (value) =>
  value?.startsWith("::ffff:") ? value.slice(7) : value;
export function privateIP(value) {
  const ip = normalizeIP(value);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return isIP(ip) === 6 && /^(fc|fd)/i.test(ip);
}
const loopback = (ip) => ["127.0.0.1", "::1"].includes(normalizeIP(ip));
export function accessConfig(env = process.env) {
  const port = Number(env.PORT || 4000),
    mode = env.ACCESS_MODE || "local";
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT deve estar entre 1 e 65535.");
  if (!["local", "private"].includes(mode))
    throw new Error("ACCESS_MODE deve ser local ou private.");
  const bind = env.BIND_HOST || "127.0.0.1";
  if (mode === "local" && !loopback(bind))
    throw new Error("Modo local exige BIND_HOST=127.0.0.1 ou ::1.");
  const split = (v) =>
    (v || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  let peers =
    mode === "local" ? ["127.0.0.1", "::1"] : split(env.ALLOWED_CLIENT_IPS);
  let origins =
    mode === "local"
      ? [
          `http://127.0.0.1:${port}`,
          `http://localhost:${port}`,
          `http://[::1]:${port}`,
        ]
      : split(env.ALLOWED_ORIGINS);
  if (mode === "local" && env.NODE_ENV !== "production")
    origins.push("http://127.0.0.1:5173", "http://localhost:5173");
  if (mode === "private") {
    if (!privateIP(bind))
      throw new Error(
        "Modo privado exige um IP privado específico em BIND_HOST. Não use 0.0.0.0.",
      );
    if (!peers.length || peers.some((ip) => !privateIP(ip)))
      throw new Error(
        "Informe IPs privados individuais em ALLOWED_CLIENT_IPS. Redes inteiras e curingas não são aceitos.",
      );
    if (!origins.length)
      throw new Error(
        "Defina ALLOWED_ORIGINS com o endereço privado exato do sistema.",
      );
  }
  const allowedOrigins = origins.map((value) => {
    let u;
    try {
      u = new URL(value);
    } catch {
      throw new Error("Endereço inválido em ALLOWED_ORIGINS.");
    }
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      (!loopback(host) &&
        !privateIP(host) &&
        !(mode === "local" && host === "localhost"))
    )
      throw new Error(
        "Use uma origem HTTP(S) com IP privado literal (ou localhost no modo local), sem caminho.",
      );
    return u.origin;
  });
  return {
    mode,
    bind,
    port,
    peers: peers.map(normalizeIP),
    origins: allowedOrigins,
    hosts: [...new Set(allowedOrigins.map((o) => new URL(o).host))],
  };
}
export function privateAccess(config) {
  return (req, res, next) => {
    const deny = () =>
      res
        .status(403)
        .json({
          error:
            "Este aparelho ou endereço não tem acesso ao sistema. Peça ajuda ao responsável pela instalação.",
        });
    const peer = normalizeIP(req.socket.remoteAddress);
    // Só o endereço TCP real é aceito. Não confiamos em cabeçalhos de proxy.
    if (!config.peers.includes(peer)) return deny();
    if (
      Object.keys(req.headers).some(
        (h) =>
          h === "forwarded" ||
          h.startsWith("x-forwarded-") ||
          ["x-real-ip", "cf-connecting-ip", "true-client-ip"].includes(h),
      )
    )
      return deny();
    if (!config.hosts.includes((req.headers.host || "").toLowerCase()))
      return deny();
    const origin = req.get("Origin");
    if (origin && !config.origins.includes(origin)) return deny();
    if (req.get("Sec-Fetch-Site") === "cross-site") return deny();
    if (!["GET", "HEAD"].includes(req.method)) {
      if (
        !origin ||
        !config.origins.includes(origin) ||
        req.get("X-AR-Request") !== "1" ||
        !req.is("application/json")
      )
        return deny();
    }
    req.privatePeer = peer;
    next();
  };
}
