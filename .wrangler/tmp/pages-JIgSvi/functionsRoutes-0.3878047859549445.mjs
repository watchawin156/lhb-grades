import { onRequest as __api_data_ts_onRequest } from "C:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\functions\\api\\data.ts"
import { onRequest as __api_telegram_backup_ts_onRequest } from "C:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\functions\\api\\telegram-backup.ts"

export const routes = [
    {
      routePath: "/api/data",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_data_ts_onRequest],
    },
  {
      routePath: "/api/telegram-backup",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_telegram_backup_ts_onRequest],
    },
  ]