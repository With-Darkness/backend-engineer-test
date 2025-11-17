/**
 * Shared test utilities
 */

/**
 * Helper function to send HTTP requests to the test server
 * Extracted to avoid duplication across test files
 */
export async function sendRequest(
  method: string,
  url: string,
  body?: any
): Promise<{
  statusCode: number;
  status: number;
  body: string;
  json: any;
}> {
  const headers: Record<string, string> = {};

  // Only set Content-Type if there's a body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const responseBody = await response.text();
  let jsonBody: any;
  try {
    jsonBody = JSON.parse(responseBody);
  } catch {
    jsonBody = responseBody;
  }

  return {
    statusCode: response.status,
    status: response.status,
    body: responseBody,
    json: jsonBody
  };
}

