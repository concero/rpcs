import { RpcEndpoint } from "../types";

export function filterHttpEndpoints(endpoints: RpcEndpoint[]): RpcEndpoint[] {
  return endpoints.filter(
    endpoint =>
      typeof endpoint.url === "string" &&
      (endpoint.url.startsWith("http://") || endpoint.url.startsWith("https://")),
  );
}
