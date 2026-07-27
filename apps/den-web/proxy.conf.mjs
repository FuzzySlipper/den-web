const target = process.env.DEN_WEB_DEV_EDGE_URL ?? 'http://127.0.0.1:18080';

const proxy = {
  target,
  secure: false,
  changeOrigin: false,
};

export default {
  '/api': proxy,
  '/den-web-config.json': proxy,
  '/den-web-build.json': proxy,
  '/health': proxy,
  '/version': proxy,
};
