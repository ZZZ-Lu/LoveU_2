let db: Record<string, unknown>;
try {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: {data?: unknown}) => d?.data ?? {},
    update: async (d: {data?: unknown}) => d?.data ?? {},
    delete: async () => ({})
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  }) as Record<string, unknown>;
} catch {
  db = {} as Record<string, unknown>;
}
export function getDb() { return db; }
