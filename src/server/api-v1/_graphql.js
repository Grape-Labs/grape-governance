const SHYFT_GRAPHQL_ENDPOINT =
  process.env.REALM_PUSH_GRAPHQL_ENDPOINT || 'https://grape.shyft.to/v1/graphql/';

export { SHYFT_GRAPHQL_ENDPOINT };

export function ensureGraphqlIdentifier(value) {
  const candidate = String(value || '');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate)) {
    throw new Error(`Invalid GraphQL identifier: ${candidate}`);
  }
  return candidate;
}

export function graphqlQuote(value) {
  return JSON.stringify(String(value || ''));
}

export async function runQuery(query) {
  const response = await fetch(SHYFT_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${body.slice(0, 350)}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`GraphQL error: ${payload.errors[0]?.message || 'unknown error'}`);
  }
  return payload?.data || {};
}
