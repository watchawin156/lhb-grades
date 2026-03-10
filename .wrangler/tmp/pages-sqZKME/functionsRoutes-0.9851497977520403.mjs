import { onRequest as __api_data_ts_onRequest } from "C:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\functions\\api\\data.ts"

export const routes = [
    {
      routePath: "/api/data",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_data_ts_onRequest],
    },
  ]