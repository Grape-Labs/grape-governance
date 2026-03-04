import routeApiV1 from '../src/server/api-v1/router.js';

export default async function handler(req, res) {
  return routeApiV1(req, res);
}
