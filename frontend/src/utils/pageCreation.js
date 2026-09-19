/**
 * Matches a server-confirmed page only to the client that originated its request.
 * Request IDs correlate the request; socket identity guards against accidental matches.
 */
export function isLocalPageCreation(pendingRequestId, payload, socketId) {
  return Boolean(
    pendingRequestId
    && payload.requestId === pendingRequestId
    && payload.createdBy === socketId
  );
}
