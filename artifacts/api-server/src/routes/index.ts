import { Router, type IRouter } from "express";
import healthRouter from "./health";
import courseRouter from "./course";
import assignmentsRouter from "./assignments";
import practiceRouter from "./practice";
import practiceAssignmentsRouter from "./practiceAssignments";
import tutorRouter from "./tutor";
import detectionRouter from "./detection";
import analyticsRouter from "./analytics";
import diagnosticsRouter from "./diagnostics";
import reasoningRouter from "./reasoning";
import adminRouter from "./admin";
import courseCommentsRouter from "./courseComments";
import accessRouter from "./access";
import { reserveAiAction } from "../middlewares/access";

const router: IRouter = Router();

router.use((req, res, next) => {
  const metered =
    req.method === "POST" &&
    (/^\/tutor\/ask$/.test(req.path) ||
      /^\/assignments\/attempts\/[^/]+\/answer\/grade$/.test(req.path) ||
      /^\/practice\/sessions\/[^/]+\/grade$/.test(req.path) ||
      /^\/practice\/assignment-sessions\/[^/]+\/grade$/.test(req.path) ||
      /^\/reasoning\/assessments\/[^/]+\/submit$/.test(req.path));
  if (!metered) {
    next();
    return;
  }
  reserveAiAction(req, res, next);
});

router.use(accessRouter);
router.use(healthRouter);
router.use(courseRouter);
router.use(assignmentsRouter);
router.use(practiceRouter);
router.use(practiceAssignmentsRouter);
router.use(tutorRouter);
router.use(detectionRouter);
router.use(analyticsRouter);
router.use(diagnosticsRouter);
router.use(reasoningRouter);
router.use(adminRouter);
router.use(courseCommentsRouter);

export default router;
